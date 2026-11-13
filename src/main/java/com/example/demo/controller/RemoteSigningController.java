package com.example.demo.controller;

import com.example.demo.dto.RemoteSigningDtos;
import com.example.demo.entity.Document;
import com.example.demo.entity.KeyShareGroup;
import com.example.demo.entity.SigningRequest;
import com.example.demo.entity.User;
import com.example.demo.repository.UserRepository;
import com.example.demo.entity.Notification;
import com.example.demo.service.AuditLogService;
import com.example.demo.service.DocumentService;
import com.example.demo.service.KeyShareGroupService;
import com.example.demo.service.NotificationService;
import com.example.demo.service.PdfSigningService;
import com.example.demo.service.SigningRequestService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/remote-signing")
public class RemoteSigningController {

    private final DocumentService documentService;
    private final SigningRequestService signingRequestService;
    private final AuditLogService auditLogService;
    private final KeyShareGroupService keyShareGroupService;
    private final PdfSigningService pdfSigningService;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final NotificationService notificationService;

    public RemoteSigningController(DocumentService documentService,
                                   SigningRequestService signingRequestService,
                                   AuditLogService auditLogService,
                                   KeyShareGroupService keyShareGroupService,
                                   PdfSigningService pdfSigningService,
                                   UserRepository userRepository,
                                   PasswordEncoder passwordEncoder,
                                   NotificationService notificationService) {
        this.documentService = documentService;
        this.signingRequestService = signingRequestService;
        this.auditLogService = auditLogService;
        this.keyShareGroupService = keyShareGroupService;
        this.pdfSigningService = pdfSigningService;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.notificationService = notificationService;
    }

    // ── Documents ────────────────────────────────────────────────────────────

    @PostMapping("/documents/upload")
    public RemoteSigningDtos.UploadDocumentResponse upload(@RequestParam("file") MultipartFile file,
                                                           Authentication auth) throws Exception {
        Document doc = documentService.upload(file, auth.getName());
        auditLogService.log("DOCUMENT_UPLOADED",
                "documentId=" + doc.getId() + ", fileName=" + doc.getOriginalFileName(),
                auth.getName());
        return new RemoteSigningDtos.UploadDocumentResponse(
                doc.getId(), doc.getOriginalFileName(), doc.getHashBase64(),
                doc.getUploadedAt(), doc.getUploadedBy());
    }

    @GetMapping("/documents")
    public List<RemoteSigningDtos.UploadDocumentResponse> myDocuments(Authentication auth) {
        return documentService.getByUser(auth.getName()).stream()
                .map(d -> new RemoteSigningDtos.UploadDocumentResponse(
                        d.getId(), d.getOriginalFileName(), d.getHashBase64(),
                        d.getUploadedAt(), d.getUploadedBy()))
                .toList();
    }

    // ── Signing Requests ──────────────────────────────────────────────────────

    @PostMapping("/requests")
    public RemoteSigningDtos.CreateSigningRequestResponse create(
            @RequestBody RemoteSigningDtos.CreateSigningRequestRequest req,
            Authentication auth) {
        SigningRequest record = signingRequestService.create(req, auth.getName());
        return toRequestResponse(record);
    }

    @GetMapping("/requests")
    public List<RemoteSigningDtos.CreateSigningRequestResponse> myRequests(Authentication auth) {
        return signingRequestService.getByUser(auth.getName()).stream()
                .map(this::toRequestResponse).toList();
    }

    @GetMapping("/requests/pending")
    public List<RemoteSigningDtos.CreateSigningRequestResponse> pendingForMe(Authentication auth) {
        return signingRequestService.getPendingForParticipant(auth.getName()).stream()
                .map(this::toRequestResponse).toList();
    }

    @GetMapping("/requests/{requestId}")
    public RemoteSigningDtos.CreateSigningRequestResponse getRequest(@PathVariable String requestId) {
        return toRequestResponse(signingRequestService.getRequired(requestId));
    }

    @PostMapping("/requests/{requestId}/partial-sign")
    public ResponseEntity<?> submitPartial(
            @PathVariable String requestId,
            @RequestBody RemoteSigningDtos.SubmitPartialSignatureRequest req,
            Authentication auth) {
        if (req.confirmOtp() == null || req.confirmOtp().isBlank()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Signing OTP is required");
        }
        User user = userRepository.findByUsername(auth.getName())
                .orElseThrow(() -> new IllegalStateException("User not found"));
        if (user.getSigningPin() == null || !passwordEncoder.matches(req.confirmOtp(), user.getSigningPin())) {
            auditLogService.log("SIGN_OTP_FAILED",
                    "requestId=" + requestId + ", participant=" + req.participantId(), auth.getName());
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Invalid signing OTP");
        }
        SigningRequest record = signingRequestService.submitPartial(requestId, req, auth.getName());
        return ResponseEntity.ok(new RemoteSigningDtos.SubmitPartialSignatureResponse(
                record.getId(), req.participantId(),
                record.getPartialSignatures().size(), record.getThreshold(), record.getStatus()));
    }

    @PostMapping("/requests/{requestId}/combine")
    public RemoteSigningDtos.CreateSigningRequestResponse combine(
            @PathVariable String requestId,
            @RequestBody(required = false) RemoteSigningDtos.CombineRequest position,
            Authentication auth) throws Exception {
        SigningRequest record = signingRequestService.combine(requestId, auth.getName(), position);
        return toRequestResponse(record);
    }

    @GetMapping("/documents/{documentId}/content")
    public ResponseEntity<Map<String, String>> getDocumentContent(@PathVariable String documentId) {
        Document doc = documentService.getRequired(documentId);
        String b64 = Base64.getEncoder().encodeToString(doc.getContent());
        return ResponseEntity.ok(Map.of("contentBase64", b64));
    }

    @GetMapping("/requests/{requestId}/signed-pdf")
    public ResponseEntity<byte[]> downloadSignedPdf(@PathVariable String requestId) {
        SigningRequest req = signingRequestService.getRequired(requestId);
        if (req.getSignedPdfBase64() == null || req.getSignedPdfBase64().isBlank())
            return ResponseEntity.notFound().build();
        byte[] pdfBytes = Base64.getDecoder().decode(req.getSignedPdfBase64());
        String filename = "signed.pdf";
        try {
            Document doc = documentService.getRequired(req.getDocumentId());
            filename = "signed_" + doc.getOriginalFileName().replaceAll("[^a-zA-Z0-9._\\-]", "_");
        } catch (Exception ignored) {}
        return ResponseEntity.ok()
                .header("Content-Type", "application/pdf")
                .header("Content-Disposition", "attachment; filename=\"" + filename + "\"")
                .body(pdfBytes);
    }

    @PostMapping("/verify")
    public RemoteSigningDtos.VerifySignatureResponse verify(
            @RequestBody RemoteSigningDtos.VerifySignatureRequest req) throws Exception {
        return signingRequestService.verify(req);
    }

    @PostMapping("/verify-pdf")
    public RemoteSigningDtos.VerifyPdfResponse verifyPdf(
            @RequestParam("file") MultipartFile file,
            Authentication auth) throws Exception {
        byte[] pdfBytes = file.getBytes();
        PdfSigningService.VerifyResult result = pdfSigningService.verifySignedPdf(pdfBytes);
        boolean valid = result.valid();
        String message = valid ? "Chữ ký số trong PDF hợp lệ." : "Chữ ký số trong PDF không hợp lệ hoặc không tìm thấy.";
        String username = auth != null ? auth.getName() : "anonymous";
        auditLogService.log("PDF_VERIFIED",
                "fileName=" + file.getOriginalFilename() + ", valid=" + valid, username);

        List<RemoteSigningDtos.SignerInfo> signers = new ArrayList<>();
        for (String label : result.signerLabels()) {
            Optional<User> user = userRepository.findByUsername(label);
            if (user.isEmpty()) user = userRepository.findByEmployeeId(label);
            if (user.isPresent()) {
                User u = user.get();
                signers.add(new RemoteSigningDtos.SignerInfo(u.getUsername(), u.getEmployeeId(), u.getUnit()));
            } else {
                signers.add(new RemoteSigningDtos.SignerInfo(label, label, null));
            }
        }

        return new RemoteSigningDtos.VerifyPdfResponse(valid, message, signers);
    }

    // ── Key Groups ────────────────────────────────────────────────────────────

    @GetMapping("/keys/groups")
    public List<RemoteSigningDtos.KeyGroupSummaryResponse> listKeyGroups() {
        return keyShareGroupService.getAll().stream()
                .map(this::toKeyGroupResponse).toList();
    }

    @PostMapping("/keys/groups")
    public RemoteSigningDtos.KeyGroupSummaryResponse createKeyGroup(
            @RequestBody RemoteSigningDtos.InitializeKeyGroupRequest req) {
        KeyShareGroup g = keyShareGroupService.initialize(req.participantIds(), req.threshold());
        return toKeyGroupResponse(g);
    }

    @GetMapping("/keys/groups/{groupId}")
    public RemoteSigningDtos.KeyGroupSummaryResponse getKeyGroup(@PathVariable String groupId) {
        KeyShareGroup g = keyShareGroupService.getRequired(groupId);
        return toKeyGroupResponse(g);
    }

    @GetMapping("/keys/groups/{groupId}/participants/{participantId}/share")
    public ResponseEntity<?> getParticipantShare(
            @PathVariable String groupId, @PathVariable String participantId,
            Authentication auth) {
        User caller = userRepository.findByUsername(auth.getName())
                .orElseThrow(() -> new IllegalStateException("User not found"));
        if (!participantId.equals(auth.getName()) && caller.getRole() != com.example.demo.model.Role.ADMIN) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body("Access denied: you can only retrieve your own key share");
        }
        KeyShareGroupService.ParticipantShareView v =
                keyShareGroupService.getParticipantShare(groupId, participantId);
        return ResponseEntity.ok(new RemoteSigningDtos.ParticipantShareResponse(
                v.groupId(), v.participantId(), v.x(), v.yHex(),
                v.threshold(), v.version(), v.rsaModulusHex(), v.rsaPublicExponentHex()));
    }

    @PostMapping("/keys/groups/{groupId}/participants")
    public RemoteSigningDtos.KeyGroupSummaryResponse addKeyGroupParticipant(
            @PathVariable String groupId,
            @RequestBody RemoteSigningDtos.AddKeyGroupParticipantRequest req) {
        KeyShareGroup g = keyShareGroupService.addParticipant(groupId, req.participantId());
        return toKeyGroupResponse(g);
    }

    @DeleteMapping("/keys/groups/{groupId}")
    public ResponseEntity<Void> deleteKeyGroup(@PathVariable String groupId, Authentication auth) {
        keyShareGroupService.delete(groupId, auth.getName());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/keys/groups/{groupId}/participants/{participantId}")
    public RemoteSigningDtos.KeyGroupSummaryResponse removeKeyGroupParticipant(
            @PathVariable String groupId, @PathVariable String participantId) {
        KeyShareGroup g = keyShareGroupService.removeParticipant(groupId, participantId);
        return toKeyGroupResponse(g);
    }

    // ── Audit Logs ────────────────────────────────────────────────────────────

    @GetMapping("/audit-logs")
    public List<RemoteSigningDtos.AuditLogItem> auditLogs(Authentication auth) {
        User caller = userRepository.findByUsername(auth.getName())
                .orElseThrow(() -> new IllegalStateException("User not found"));
        if (caller.getRole() == com.example.demo.model.Role.ADMIN) {
            return auditLogService.getAll();
        }
        return auditLogService.getByUser(auth.getName());
    }

    // ── Notifications ─────────────────────────────────────────────────────────

    @GetMapping("/notifications")
    public List<RemoteSigningDtos.NotificationDto> getNotifications(Authentication auth) {
        return notificationService.getForUser(auth.getName()).stream()
                .map(n -> new RemoteSigningDtos.NotificationDto(
                        n.getId(), n.getMessage(), n.getSigningRequestId(),
                        n.isRead(), n.getCreatedAt()))
                .toList();
    }

    @GetMapping("/notifications/unread-count")
    public Map<String, Long> getUnreadCount(Authentication auth) {
        return Map.of("count", notificationService.countUnread(auth.getName()));
    }

    @PutMapping("/notifications/{id}/read")
    public ResponseEntity<Void> markRead(@PathVariable String id, Authentication auth) {
        notificationService.markRead(id, auth.getName());
        return ResponseEntity.ok().build();
    }

    @PutMapping("/notifications/read-all")
    public ResponseEntity<Void> markAllRead(Authentication auth) {
        notificationService.markAllRead(auth.getName());
        return ResponseEntity.ok().build();
    }

    // ── Error handling ────────────────────────────────────────────────────────

    @ExceptionHandler({IllegalArgumentException.class, IllegalStateException.class})
    public ResponseEntity<String> badRequest(Exception ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ex.getMessage());
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<String> serverError(Exception ex) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body("Lỗi máy chủ: " + ex.getMessage());
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private RemoteSigningDtos.CreateSigningRequestResponse toRequestResponse(SigningRequest r) {
        String documentName = null;
        String documentHashBase64 = null;
        try {
            Document doc = documentService.getRequired(r.getDocumentId());
            documentName = doc.getOriginalFileName();
            documentHashBase64 = doc.getHashBase64();
        } catch (Exception ignored) {}

        List<String> signedParticipantIds = new ArrayList<>(r.getPartialSignatures().keySet());
        List<String> signedParticipantDisplayIds = signedParticipantIds.stream()
                .map(username -> userRepository.findByUsername(username)
                        .map(u -> u.getEmployeeId() != null && !u.getEmployeeId().isBlank()
                                ? u.getEmployeeId() : username)
                        .orElse(username))
                .toList();

        return new RemoteSigningDtos.CreateSigningRequestResponse(
                r.getId(),
                r.getDocumentId(),
                documentName,
                r.getThreshold(),
                r.getParticipants(),
                signedParticipantIds,
                r.getStatus(),
                r.getCreatedAt(),
                r.getKeyGroupId(),
                r.getKeyGroupId() != null ? r.getKeyShareVersion() : null,
                r.getFinalSignatureBase64(),
                r.getSignedPdfBase64(),
                r.getCreatedBy(),
                documentHashBase64,
                r.getRsaModulusHex(),
                r.getSigningOrders(),
                SigningRequestService.computeCurrentSigners(r),
                signedParticipantDisplayIds
        );
    }

    private RemoteSigningDtos.KeyGroupSummaryResponse toKeyGroupResponse(KeyShareGroup g) {
        return new RemoteSigningDtos.KeyGroupSummaryResponse(
                g.getId(),
                g.getThreshold(),
                g.getParticipantIds(),
                g.getParticipantIds().size(),
                g.getVersion(),
                g.getRsaModulusHex(),
                g.getRsaPublicExponentHex()
        );
    }
}
