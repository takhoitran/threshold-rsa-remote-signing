package com.example.demo.entity;

import com.example.demo.model.SigningRequestStatus;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Entity
@Table(name = "signing_requests")
public class SigningRequest {

    @Id
    private String id;

    @Column(nullable = false)
    private String documentId;

    @Column(nullable = false)
    private int threshold;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "signing_request_participants",
            joinColumns = @JoinColumn(name = "request_id"))
    @Column(name = "participant_id")
    @OrderColumn(name = "position")
    private List<String> participants = new ArrayList<>();

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "partial_signatures",
            joinColumns = @JoinColumn(name = "request_id"))
    @MapKeyColumn(name = "participant_id")
    @Column(name = "signature_base64", columnDefinition = "TEXT")
    private Map<String, String> partialSignatures = new LinkedHashMap<>();

    @Column(nullable = false)
    private Instant createdAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private SigningRequestStatus status;

    @Column(columnDefinition = "TEXT")
    private String finalSignatureBase64;

    @Column(columnDefinition = "TEXT")
    private String signedPdfBase64;

    private String keyGroupId;
    private int keyShareVersion;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "key_share_snapshots",
            joinColumns = @JoinColumn(name = "request_id"))
    @MapKeyColumn(name = "participant_id")
    @Column(name = "share_entry", columnDefinition = "TEXT")
    private Map<String, String> keyShareSnapshot;

    @Column(columnDefinition = "TEXT")
    private String rsaModulusHex;

    @Column(columnDefinition = "TEXT")
    private String rsaPublicExponentHex;

    @Column(columnDefinition = "TEXT")
    private String fieldPrimeHex;

    private String createdBy;

    // Kept for backward compat with NOT NULL DB column; derived from signingOrders
    @Column(nullable = false)
    private boolean ordered = false;

    // participantId -> signing order (1-based). Same number = parallel, higher = must wait.
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "signing_request_orders",
            joinColumns = @JoinColumn(name = "request_id"))
    @MapKeyColumn(name = "participant_id")
    @Column(name = "signing_order")
    private Map<String, Integer> signingOrders = new LinkedHashMap<>();

    public SigningRequest() {}

    public SigningRequest(String id, String documentId, int threshold, List<String> participants,
                          Instant createdAt, String createdBy) {
        this.id = id;
        this.documentId = documentId;
        this.threshold = threshold;
        this.participants = new ArrayList<>(participants);
        this.createdAt = createdAt;
        this.createdBy = createdBy;
        this.status = SigningRequestStatus.WAITING_PARTIALS;
        this.keyShareVersion = 0;
        this.partialSignatures = new LinkedHashMap<>();
        this.signingOrders = new LinkedHashMap<>();
        this.ordered = false;
    }

    public String getId() { return id; }
    public String getDocumentId() { return documentId; }
    public int getThreshold() { return threshold; }
    public List<String> getParticipants() { return participants; }
    public Map<String, String> getPartialSignatures() { return partialSignatures; }
    public Instant getCreatedAt() { return createdAt; }
    public SigningRequestStatus getStatus() { return status; }
    public String getFinalSignatureBase64() { return finalSignatureBase64; }
    public String getSignedPdfBase64() { return signedPdfBase64; }
    public String getKeyGroupId() { return keyGroupId; }
    public int getKeyShareVersion() { return keyShareVersion; }
    public Map<String, String> getKeyShareSnapshot() { return keyShareSnapshot; }
    public String getRsaModulusHex() { return rsaModulusHex; }
    public String getRsaPublicExponentHex() { return rsaPublicExponentHex; }
    public String getFieldPrimeHex() { return fieldPrimeHex; }
    public String getCreatedBy() { return createdBy; }
    public Map<String, Integer> getSigningOrders() { return signingOrders; }

    /** True if signingOrders has at least 2 distinct values (some must wait for others). */
    public boolean isOrdered() { return ordered; }

    public void setStatus(SigningRequestStatus status) { this.status = status; }
    public void setFinalSignatureBase64(String v) { this.finalSignatureBase64 = v; }
    public void setSignedPdfBase64(String v) { this.signedPdfBase64 = v; }
    public void setKeyGroupId(String v) { this.keyGroupId = v; }
    public void setKeyShareVersion(int v) { this.keyShareVersion = v; }
    public void setKeyShareSnapshot(Map<String, String> v) {
        this.keyShareSnapshot = v == null ? null : new LinkedHashMap<>(v);
    }
    public void setRsaModulusHex(String v) { this.rsaModulusHex = v; }
    public void setRsaPublicExponentHex(String v) { this.rsaPublicExponentHex = v; }
    public void setFieldPrimeHex(String v) { this.fieldPrimeHex = v; }

    public void setSigningOrders(Map<String, Integer> orders) {
        this.signingOrders = orders == null ? new LinkedHashMap<>() : new LinkedHashMap<>(orders);
        // Derive the ordered flag: true if any two participants have different order values
        long distinctValues = this.signingOrders.values().stream().distinct().count();
        this.ordered = distinctValues > 1;
    }
}
