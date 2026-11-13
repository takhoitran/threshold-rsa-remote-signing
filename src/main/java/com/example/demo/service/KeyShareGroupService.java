package com.example.demo.service;

import com.example.demo.crypto.ShamirSecretSharing;
import com.example.demo.crypto.ShamirSecretSharing.Share;
import com.example.demo.crypto.ThresholdRsaUtil;
import com.example.demo.entity.KeyShare;
import com.example.demo.entity.KeyShareGroup;
import com.example.demo.repository.KeyShareGroupRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigInteger;
import java.security.KeyPair;
import java.security.SecureRandom;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class KeyShareGroupService {

    private final SecureRandom random = new SecureRandom();
    private final KeyShareGroupRepository keyShareGroupRepository;
    private final AuditLogService auditLogService;

    public KeyShareGroupService(KeyShareGroupRepository keyShareGroupRepository,
                                AuditLogService auditLogService) {
        this.keyShareGroupRepository = keyShareGroupRepository;
        this.auditLogService = auditLogService;
    }

    @Transactional
    public KeyShareGroup initialize(List<String> participants, int threshold) {
        validateParticipantList(participants);
        if (threshold < 1 || threshold > participants.size())
            throw new IllegalArgumentException("threshold must be in range 1..participants.size");

        try {
            // Generate RSA-2048 keypair — private exponent d is the Shamir secret
            KeyPair kp = ThresholdRsaUtil.generateRsaKeyPair();
            RSAPrivateKey rsaPriv = (RSAPrivateKey) kp.getPrivate();
            RSAPublicKey rsaPub = (RSAPublicKey) kp.getPublic();

            BigInteger n = rsaPub.getModulus();
            BigInteger e = rsaPub.getPublicExponent();
            BigInteger d = rsaPriv.getPrivateExponent();

            // ℓ > d so Shamir reconstructs d exactly without modular reduction
            BigInteger fieldPrime = ThresholdRsaUtil.generateFieldPrime(d);

            // Split d using Shamir over GF(ℓ)
            List<Share> shares = ShamirSecretSharing.split(d, threshold, participants.size(), fieldPrime, random);

            String groupId = UUID.randomUUID().toString();
            KeyShareGroup group = new KeyShareGroup(groupId, threshold, 1);
            group.setRsaModulusHex(n.toString(16));
            group.setRsaPublicExponentHex(e.toString(16));
            group.setFieldPrimeHex(fieldPrime.toString(16));

            // Generate and store self-signed certificate
            var cert = ThresholdRsaUtil.generateSelfSignedCert(kp.getPublic(), kp.getPrivate());
            group.setCertificateBase64(ThresholdRsaUtil.certToBase64(cert));

            for (int i = 0; i < participants.size(); i++) {
                Share sh = shares.get(i);
                group.getKeyShares().add(new KeyShare(group, participants.get(i), sh.x(), sh.y().toString(16)));
            }

            keyShareGroupRepository.save(group);
            auditLogService.log("KEY_GROUP_INITIALIZED",
                    "groupId=" + groupId + ", threshold=" + threshold + ", n=" + participants.size());
            return group;
        } catch (IllegalArgumentException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to initialize key group: " + ex.getMessage(), ex);
        }
    }

    public List<KeyShareGroup> getAll() {
        return keyShareGroupRepository.findAll();
    }

    public KeyShareGroup getRequired(String groupId) {
        return keyShareGroupRepository.findById(groupId)
                .orElseThrow(() -> new IllegalArgumentException("Key group not found: " + groupId));
    }

    public void assertParticipantsMatchGroup(String groupId, List<String> requestParticipants) {
        KeyShareGroup g = getRequired(groupId);
        Set<String> groupSet = new HashSet<>(g.getParticipantIds());
        if (requestParticipants == null || requestParticipants.isEmpty())
            throw new IllegalArgumentException("participantIds must not be empty");
        List<String> notInGroup = requestParticipants.stream()
                .filter(p -> !groupSet.contains(p))
                .collect(Collectors.toList());
        if (!notInGroup.isEmpty())
            throw new IllegalArgumentException("participants not in key group: " + notInGroup);
    }

    /**
     * Snapshot format: participantId → "x|yHex"
     * Both x and y are needed: x for Lagrange combine, y for partial-sig verification.
     */
    public Map<String, String> snapshotSharesHex(String groupId) {
        KeyShareGroup g = getRequired(groupId);
        Map<String, String> snap = new LinkedHashMap<>();
        for (KeyShare ks : g.getKeyShares()) {
            snap.put(ks.getParticipantId(), ks.getX() + "|" + ks.getYHex());
        }
        return snap;
    }

    public int getVersion(String groupId) {
        return getRequired(groupId).getVersion();
    }

    public ParticipantShareView getParticipantShare(String groupId, String participantId) {
        KeyShareGroup g = getRequired(groupId);
        KeyShare ks = g.getKeyShares().stream()
                .filter(s -> s.getParticipantId().equals(participantId))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("participant not in group: " + participantId));
        return new ParticipantShareView(groupId, participantId, ks.getX(), ks.getYHex(),
                g.getThreshold(), g.getVersion(), g.getRsaModulusHex(), g.getRsaPublicExponentHex());
    }

    @Transactional
    public KeyShareGroup addParticipant(String groupId, String newParticipantId) {
        if (newParticipantId == null || newParticipantId.isBlank())
            throw new IllegalArgumentException("participantId is required");
        KeyShareGroup g = getRequired(groupId);
        if (g.getParticipantIds().contains(newParticipantId))
            throw new IllegalArgumentException("participant already in group");

        BigInteger secret = reconstructSecret(g);
        List<String> next = new ArrayList<>(g.getParticipantIds());
        next.add(newParticipantId);
        redistribute(g, secret, next);
        g.setVersion(g.getVersion() + 1);
        keyShareGroupRepository.save(g);
        auditLogService.log("KEY_GROUP_PARTICIPANT_ADDED",
                "groupId=" + groupId + ", participant=" + newParticipantId + ", version=" + g.getVersion());
        return g;
    }

    @Transactional
    public void delete(String groupId, String username) {
        KeyShareGroup g = getRequired(groupId);
        keyShareGroupRepository.delete(g);
        auditLogService.log("KEY_GROUP_DELETED", "groupId=" + groupId, username);
    }

    @Transactional
    public KeyShareGroup removeParticipant(String groupId, String participantId) {
        if (participantId == null || participantId.isBlank())
            throw new IllegalArgumentException("participantId is required");
        KeyShareGroup g = getRequired(groupId);
        if (!g.getParticipantIds().contains(participantId))
            throw new IllegalArgumentException("participant not in group");

        List<String> next = new ArrayList<>(g.getParticipantIds());
        next.remove(participantId);
        if (next.size() < g.getThreshold())
            throw new IllegalArgumentException("cannot remove: group size would be below threshold");

        BigInteger secret = reconstructSecret(g);
        redistribute(g, secret, next);
        g.setVersion(g.getVersion() + 1);
        keyShareGroupRepository.save(g);
        auditLogService.log("KEY_GROUP_PARTICIPANT_REMOVED",
                "groupId=" + groupId + ", participant=" + participantId + ", version=" + g.getVersion());
        return g;
    }

    private BigInteger reconstructSecret(KeyShareGroup g) {
        BigInteger fieldPrime = new BigInteger(g.getFieldPrimeHex(), 16);
        int t = g.getThreshold();
        List<Share> shares = new ArrayList<>(t);
        for (int i = 0; i < t; i++) {
            KeyShare ks = g.getKeyShares().get(i);
            shares.add(new Share(ks.getX(), new BigInteger(ks.getYHex(), 16)));
        }
        return ShamirSecretSharing.combine(shares, fieldPrime);
    }

    private void redistribute(KeyShareGroup g, BigInteger secret, List<String> newOrder) {
        BigInteger fieldPrime = new BigInteger(g.getFieldPrimeHex(), 16);
        List<Share> newShares = ShamirSecretSharing.split(secret, g.getThreshold(), newOrder.size(), fieldPrime, random);
        g.getKeyShares().clear();
        for (int i = 0; i < newOrder.size(); i++) {
            Share sh = newShares.get(i);
            g.getKeyShares().add(new KeyShare(g, newOrder.get(i), sh.x(), sh.y().toString(16)));
        }
    }

    private static void validateParticipantList(List<String> participants) {
        if (participants == null || participants.isEmpty())
            throw new IllegalArgumentException("participants must not be empty");
        Set<String> seen = new HashSet<>();
        for (String p : participants) {
            if (p == null || p.isBlank()) throw new IllegalArgumentException("participant id must not be blank");
            if (!seen.add(p)) throw new IllegalArgumentException("duplicate participant: " + p);
        }
    }

    public record ParticipantShareView(
            String groupId, String participantId, int x, String yHex,
            int threshold, int version, String rsaModulusHex, String rsaPublicExponentHex) {}
}
