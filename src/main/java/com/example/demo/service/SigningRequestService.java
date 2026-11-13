package com.example.demo.service;

import com.example.demo.crypto.ShamirSecretSharing;
import com.example.demo.crypto.ShamirSecretSharing.Share;
import com.example.demo.crypto.ThresholdRsaUtil;
import com.example.demo.dto.RemoteSigningDtos;
import com.example.demo.entity.Document;
import com.example.demo.entity.KeyShareGroup;
import com.example.demo.entity.SigningRequest;
import com.example.demo.model.SigningRequestStatus;
import com.example.demo.repository.SigningRequestRepository;
import com.example.demo.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.PrivateKey;
import java.security.cert.Certificate;
import java.security.cert.X509Certificate;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class SigningRequestService {

    private final SigningRequestRepository signingRequestRepository;
    private final DocumentService documentService;
    private final PolicyEngineService policyEngineService;
    private final AuditLogService auditLogService;
    private final PdfSigningService pdfSigningService;
    private final KeyShareGroupService keyShareGroupService;
    private final NotificationService notificationService;
    private final UserRepository userRepository;

    public SigningRequestService(SigningRequestRepository signingRequestRepository,
                                 DocumentService documentService,
                                 PolicyEngineService policyEngineService,
                                 AuditLogService auditLogService,
                                 PdfSigningService pdfSigningService,
                                 KeyShareGroupService keyShareGroupService,
                                 NotificationService notificationService,
                                 UserRepository userRepository) {
        this.signingRequestRepository = signingRequestRepository;
        this.documentService = documentService;
        this.policyEngineService = policyEngineService;
        this.auditLogService = auditLogService;
        this.pdfSigningService = pdfSigningService;
        this.keyShareGroupService = keyShareGroupService;
        this.notificationService = notificationService;
        this.userRepository = userRepository;
    }

    @Transactional
    public SigningRequest create(RemoteSigningDtos.CreateSigningRequestRequest req, String createdBy) {
        if (req.participantIds() == null || req.participantIds().isEmpty())
            throw new IllegalArgumentException("participantIds must not be empty");

        Document document = documentService.getRequired(req.documentId());
        RemoteSigningDtos.PolicyEvaluationResponse policy =
                policyEngineService.evaluate(req.participantIds(), req.metadata());

        int threshold = req.threshold() == null ? policy.threshold() : req.threshold();
        if (threshold <= 0 || threshold > req.participantIds().size())
            throw new IllegalArgumentException("threshold must be in range 1..participantIds.size");

        String requestId = UUID.randomUUID().toString();
        SigningRequest request = new SigningRequest(
                requestId, req.documentId(), threshold, req.participantIds(), Instant.now(), createdBy);

        if (req.signingOrders() != null && !req.signingOrders().isEmpty()) {
            request.setSigningOrders(req.signingOrders());
        }

        if (req.keyGroupId() != null && !req.keyGroupId().isBlank()) {
            keyShareGroupService.assertParticipantsMatchGroup(req.keyGroupId(), req.participantIds());
            request.setKeyGroupId(req.keyGroupId());
            request.setKeyShareVersion(keyShareGroupService.getVersion(req.keyGroupId()));
            request.setKeyShareSnapshot(keyShareGroupService.snapshotSharesHex(req.keyGroupId()));

            KeyShareGroup g = keyShareGroupService.getRequired(req.keyGroupId());
            request.setRsaModulusHex(g.getRsaModulusHex());//n
            request.setRsaPublicExponentHex(g.getRsaPublicExponentHex());//e
            request.setFieldPrimeHex(g.getFieldPrimeHex());//l
        }

        signingRequestRepository.save(request);
        auditLogService.log("REQUEST_CREATED",
                "requestId=" + requestId + ", threshold=" + threshold + ", participants=" + req.participantIds(),
                createdBy);

        notificationService.notifyParticipants(
                req.participantIds(), requestId, document.getOriginalFileName(), createdBy);

        return request;
    }

    @Transactional
    public SigningRequest submitPartial(String requestId,
                                       RemoteSigningDtos.SubmitPartialSignatureRequest req,
                                       String currentUser) {
        SigningRequest request = getRequired(requestId);

        if (!request.getParticipants().contains(req.participantId()))
            throw new IllegalArgumentException("participant not in request");
        if (request.getStatus() == SigningRequestStatus.SIGNED)
            throw new IllegalStateException("request already signed");
        if (req.partialSignatureBase64() == null || req.partialSignatureBase64().isBlank())
            throw new IllegalArgumentException("partialSignatureBase64 is required");

        // Enforce signing order: all participants with a lower order must have already signed
        Map<String, Integer> orders = request.getSigningOrders();
        if (orders != null && !orders.isEmpty()) {
            int myOrder = orders.getOrDefault(req.participantId(), 1);
            for (String p : request.getParticipants()) {
                int pOrder = orders.getOrDefault(p, 1);
                if (pOrder < myOrder && !request.getPartialSignatures().containsKey(p)) {
                    throw new IllegalStateException(
                            "Chưa đến lượt. Vui lòng chờ người ký ở thứ tự " + pOrder + " ký trước.");
                }
            }
        }

        if (request.getKeyShareSnapshot() != null && request.getRsaModulusHex() != null) {
            verifyRsaPartialSignature(request, req.participantId(), req.partialSignatureBase64());
        }

        request.getPartialSignatures().put(req.participantId(), req.partialSignatureBase64());
        if (request.getPartialSignatures().size() >= request.getThreshold())
            request.setStatus(SigningRequestStatus.READY_TO_COMBINE);//ready to combine

        signingRequestRepository.save(request);
        auditLogService.log("PARTIAL_SUBMITTED",
                "requestId=" + requestId + ", participant=" + req.participantId(), currentUser);
        return request;
    }

    @Transactional
    public SigningRequest combine(String requestId, String currentUser,
                                  RemoteSigningDtos.CombineRequest position) throws Exception {
        SigningRequest request = getRequired(requestId);
        if (!request.getCreatedBy().equals(currentUser))
            throw new IllegalStateException("Chỉ người tạo request mới được phép combine chữ ký");
        if (request.getPartialSignatures().size() < request.getThreshold())
            throw new IllegalStateException("not enough partial signatures");
        if (request.getStatus() == SigningRequestStatus.SIGNED)
            return request;

        Document document = documentService.getRequired(request.getDocumentId());

        if (request.getRsaModulusHex() != null) {
            combineThresholdRsa(request, document, position);
        } else {
            combineHashBased(request, document, position);
        }

        signingRequestRepository.save(request);
        auditLogService.log("SIGNATURE_COMBINED",
                "requestId=" + requestId + ", threshold=" + request.getThreshold(), currentUser);
        return request;
    }

    public RemoteSigningDtos.VerifySignatureResponse verify(RemoteSigningDtos.VerifySignatureRequest req) throws Exception {
        SigningRequest request = getRequired(req.requestId());
        if (request.getSignedPdfBase64() == null || request.getSignedPdfBase64().isBlank())
            return new RemoteSigningDtos.VerifySignatureResponse(req.requestId(), false, "Request has not been signed yet.");
        if (request.getFinalSignatureBase64() == null)
            return new RemoteSigningDtos.VerifySignatureResponse(req.requestId(), false, "Request has not been combined yet.");

        Document document = documentService.getRequired(request.getDocumentId());
        boolean valid;

        if (request.getRsaModulusHex() != null) {
            BigInteger n = new BigInteger(request.getRsaModulusHex(), 16);
            BigInteger e = new BigInteger(request.getRsaPublicExponentHex(), 16);
            byte[] sigBytes = Base64.getDecoder().decode(request.getFinalSignatureBase64());
            BigInteger sig = new BigInteger(1, sigBytes);
            byte[] docHash = Base64.getDecoder().decode(document.getHashBase64());
            valid = ThresholdRsaUtil.verifyFinalSignature(sig, e, n, docHash);
        } else {
            String signatureToVerify = req.signatureBase64() == null || req.signatureBase64().isBlank()
                    ? request.getFinalSignatureBase64()
                    : req.signatureBase64();
            String recomputed = Base64.getEncoder().encodeToString(
                    MessageDigest.getInstance("SHA-256").digest(
                            buildCombineInput(document.getHashBase64(), request).getBytes(StandardCharsets.UTF_8)));
            valid = recomputed.equals(signatureToVerify) && signatureToVerify.equals(request.getFinalSignatureBase64());
        }

        byte[] signedPdfBytes = Base64.getDecoder().decode(request.getSignedPdfBase64());
        boolean validPdf = pdfSigningService.verifySignedPdf(signedPdfBytes).valid();
        boolean overallValid = valid && validPdf;

        String message = overallValid ? "Threshold RSA signature and PDF signature are valid."
                : !valid ? "Threshold signature is invalid." : "PDF signature is invalid.";

        auditLogService.log("SIGNATURE_VERIFIED",
                "requestId=" + req.requestId() + ", valid=" + overallValid);
        return new RemoteSigningDtos.VerifySignatureResponse(req.requestId(), overallValid, message);
    }

    public SigningRequest getRequired(String requestId) {
        return signingRequestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("Signing request not found: " + requestId));
    }

    public List<SigningRequest> getByUser(String username) {
        return signingRequestRepository.findByCreatedByOrderByCreatedAtDesc(username);
    }

    public List<SigningRequest> getPendingForParticipant(String participantId) {
        return signingRequestRepository.findByParticipant(participantId).stream()
                .filter(r -> r.getStatus() == SigningRequestStatus.WAITING_PARTIALS
                        || r.getStatus() == SigningRequestStatus.READY_TO_COMBINE)
                .toList();
    }

    /**
     * Returns the list of participants who are currently allowed to sign.
     * With ordering: those at the minimum unsigned order level.
     * Without ordering: all unsigned participants.
     */
    public static List<String> computeCurrentSigners(SigningRequest r) {
        Map<String, Integer> orders = r.getSigningOrders();
        List<String> unsigned = r.getParticipants().stream()
                .filter(p -> !r.getPartialSignatures().containsKey(p))
                .toList();

        if (orders == null || orders.isEmpty() || !r.isOrdered()) {
            return unsigned;
        }

        int minOrder = unsigned.stream()
                .mapToInt(p -> orders.getOrDefault(p, 1))
                .min()
                .orElse(Integer.MAX_VALUE);

        if (minOrder == Integer.MAX_VALUE) return List.of();

        final int min = minOrder;
        return unsigned.stream()
                .filter(p -> orders.getOrDefault(p, 1) == min)
                .toList();
    }

    // Private helpers

    private void verifyRsaPartialSignature(SigningRequest request, String participantId, String partialSigBase64) {
        String shareEntry = request.getKeyShareSnapshot().get(participantId);
        if (shareEntry == null)
            throw new IllegalArgumentException("no key share snapshot for participant");

        String[] parts = shareEntry.split("\\|", 2);
        if (parts.length != 2)
            throw new IllegalStateException("corrupted key share snapshot entry");

        BigInteger yi = new BigInteger(parts[1], 16);
        BigInteger n = new BigInteger(request.getRsaModulusHex(), 16);

        Document document = documentService.getRequired(request.getDocumentId());
        byte[] docHash = Base64.getDecoder().decode(document.getHashBase64());

        BigInteger expected = ThresholdRsaUtil.computePartialSignature(docHash, yi, n);

        byte[] got;
        try {
            got = Base64.getDecoder().decode(partialSigBase64.trim());
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("partialSignatureBase64 is not valid Base64");
        }
        BigInteger gotInt = new BigInteger(1, got);
        if (!expected.equals(gotInt))
            throw new IllegalArgumentException("partial RSA signature does not match key share for this document");
    }

    private void combineThresholdRsa(SigningRequest request, Document document,
                                      RemoteSigningDtos.CombineRequest position) throws Exception {
        BigInteger fieldPrime = new BigInteger(request.getFieldPrimeHex(), 16);
        BigInteger n = new BigInteger(request.getRsaModulusHex(), 16);
        BigInteger e = new BigInteger(request.getRsaPublicExponentHex(), 16);

        List<Share> shares = new ArrayList<>();
        for (String participantId : request.getPartialSignatures().keySet()) {
            String shareEntry = request.getKeyShareSnapshot().get(participantId);
            String[] parts = shareEntry.split("\\|", 2);
            int x = Integer.parseInt(parts[0]);
            BigInteger y = new BigInteger(parts[1], 16);
            shares.add(new Share(x, y));
        }

        BigInteger d = ShamirSecretSharing.combine(shares, fieldPrime);//compute d from shares

        byte[] docHash = Base64.getDecoder().decode(document.getHashBase64());
        BigInteger finalSig = ThresholdRsaUtil.computeFinalSignature(docHash, d, n);//compute final signature
        request.setFinalSignatureBase64(Base64.getEncoder().encodeToString(finalSig.toByteArray()));

        PrivateKey privKey = ThresholdRsaUtil.buildPrivateKey(n, d);//build private key
        KeyShareGroup group = keyShareGroupService.getRequired(request.getKeyGroupId());
        X509Certificate cert = ThresholdRsaUtil.certFromBase64(group.getCertificateBase64());//get certificate from group

        List<String> signers = new ArrayList<>(request.getPartialSignatures().keySet());//get signers
        List<String> displayLabels = resolveDisplayLabels(signers, position);//get display labels
        String fieldName = "sig-" + request.getId();//get field name from request id
        byte[] signedPdfBytes = pdfSigningService.signPdf(
                document.getContent(), fieldName, privKey, new Certificate[]{cert},
                signers, displayLabels, request.getThreshold(), position);
        request.setSignedPdfBase64(Base64.getEncoder().encodeToString(signedPdfBytes));//set signed pdf base64
        request.setStatus(SigningRequestStatus.SIGNED);//set status to signed               
    }

    private void combineHashBased(SigningRequest request, Document document,
                                   RemoteSigningDtos.CombineRequest position) throws Exception {
        String input = buildCombineInput(document.getHashBase64(), request);
        String finalSignature = Base64.getEncoder().encodeToString(
                MessageDigest.getInstance("SHA-256").digest(input.getBytes(StandardCharsets.UTF_8)));
        request.setFinalSignatureBase64(finalSignature);

        List<String> signers = new ArrayList<>(request.getPartialSignatures().keySet());
        List<String> displayLabels = resolveDisplayLabels(signers, position);
        String fieldName = "sig-" + request.getId();
        byte[] signedPdfBytes = pdfSigningService.signPdf(document.getContent(), fieldName,
                signers, displayLabels, request.getThreshold(), position);
        request.setSignedPdfBase64(Base64.getEncoder().encodeToString(signedPdfBytes));
        request.setStatus(SigningRequestStatus.SIGNED);
    }

    private List<String> resolveDisplayLabels(List<String> usernames, RemoteSigningDtos.CombineRequest position) {
        boolean useId = position != null && "id".equals(position.signatureDisplayType());
        if (!useId) return usernames;
        return usernames.stream().map(username ->
            userRepository.findByUsername(username)
                .map(u -> u.getEmployeeId() != null ? u.getEmployeeId() : username)
                .orElse(username)
        ).collect(Collectors.toList());
    }

    private String buildCombineInput(String documentHashBase64, SigningRequest request) {
        String orderedPartials = request.getPartialSignatures().entrySet().stream()
                .sorted(Comparator.comparing(Map.Entry::getKey))
                .map(e -> e.getKey() + "=" + e.getValue())
                .collect(Collectors.joining("|"));
        String base = documentHashBase64 + ":" + request.getThreshold() + ":" + orderedPartials;
        if (request.getKeyGroupId() != null && !request.getKeyGroupId().isBlank())
            base = base + "|kg=" + request.getKeyGroupId() + "|kv=" + request.getKeyShareVersion();
        return base;
    }
}
