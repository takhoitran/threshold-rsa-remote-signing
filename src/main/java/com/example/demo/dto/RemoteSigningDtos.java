package com.example.demo.dto;

import com.example.demo.model.SigningRequestStatus;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public final class RemoteSigningDtos {
    private RemoteSigningDtos() {}

    // Documents
    public record UploadDocumentResponse(
            String id,
            String originalFileName,
            String hashBase64,
            Instant uploadedAt,
            String uploadedBy
    ) {}

    // Policy
    public record PolicyEvaluationResponse(int threshold, List<String> selectedParticipants, String reason) {}

    // Signing Requests
    public record CreateSigningRequestRequest(
            String documentId,
            List<String> participantIds,
            Integer threshold,
            Map<String, Object> metadata,
            String keyGroupId,
            // participantId -> order number (1-based). Same number = parallel signing allowed.
            // null/empty means no ordering enforced.
            Map<String, Integer> signingOrders
    ) {}

    public record CreateSigningRequestResponse(
            String requestId,
            String documentId,
            String documentName,
            int threshold,
            List<String> participantIds,
            List<String> signedParticipantIds,
            SigningRequestStatus status,
            Instant createdAt,
            String keyGroupId,
            Integer keyShareVersion,
            String finalSignatureBase64,
            String signedPdfBase64,
            String createdBy,
            String documentHashBase64,
            String rsaModulusHex,
            // participantId -> order number
            Map<String, Integer> signingOrders,
            // participants who can sign right now (respects ordering levels)
            List<String> currentSignerIds,
            // employee IDs for each signed participant (same order as signedParticipantIds)
            List<String> signedParticipantDisplayIds
    ) {}

    // Key Groups
    public record InitializeKeyGroupRequest(List<String> participantIds, int threshold) {}

    public record InitializeKeyGroupResponse(
            String groupId,
            int threshold,
            List<String> participantIds,
            int totalParticipants,
            int version,
            String fieldPrimeHex,
            String rsaModulusHex,
            String rsaPublicExponentHex
    ) {}

    public record KeyGroupSummaryResponse(
            String groupId,
            int threshold,
            List<String> participantIds,
            int totalParticipants,
            int version,
            String rsaModulusHex,
            String rsaPublicExponentHex
    ) {}

    public record ParticipantShareResponse(
            String groupId,
            String participantId,
            int x,
            String shareEncoded,
            int threshold,
            int version,
            String rsaModulusHex,
            String rsaPublicExponentHex
    ) {}

    public record AddKeyGroupParticipantRequest(String participantId) {}

    // Partial Signing
    public record SubmitPartialSignatureRequest(
            String participantId,
            String partialSignatureBase64,
            String confirmOtp
    ) {}

    public record SubmitPartialSignatureResponse(
            String requestId,
            String participantId,
            int acceptedPartials,
            int threshold,
            SigningRequestStatus status
    ) {}

    // Signature position for combine (percentages of page, top-left origin)
    public record CombineRequest(
            Integer page,       // 1-based, null → 1
            Float xPct,         // % from left, null → 5
            Float yPct,         // % from top, null → 80
            Float widthPct,     // % of page width, null → 40
            Float heightPct,    // % of page height, null → 10
            String signatureDisplayType  // "name" (default) or "id"
    ) {}

    // Combine & Verify
    public record CombineSignatureResponse(
            String requestId,
            String documentId,
            String finalSignatureBase64,
            String signedPdfBase64,
            SigningRequestStatus status
    ) {}

    public record VerifySignatureRequest(String requestId, String signatureBase64) {}

    public record VerifySignatureResponse(
            String requestId,
            boolean valid,
            String message
    ) {}

    public record SignerInfo(String username, String employeeId, String unit) {}

    public record VerifyPdfResponse(boolean valid, String message, List<SignerInfo> signers) {}

    // Audit Logs
    public record AuditLogItem(
            String id,
            Instant timestamp,
            String action,
            String detail,
            String username
    ) {}

    // Notifications
    public record NotificationDto(
            String id,
            String message,
            String signingRequestId,
            boolean read,
            Instant createdAt
    ) {}
}
