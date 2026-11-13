package com.example.demo.service;

import com.example.demo.dto.RemoteSigningDtos;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * Evaluates business rules to recommend a signing threshold for a request.
 *
 * Supported metadata keys:
 *   contract_value  (long/number) — monetary value in VND
 *   doc_type        (String)      — "classified" | "legal" | "internal" (default)
 *   is_external     (boolean)     — true if document crosses organizational boundaries
 */
@Service
public class PolicyEngineService {

    public RemoteSigningDtos.PolicyEvaluationResponse evaluate(
            List<String> participants, Map<String, Object> metadata) {

        int n = participants.size();
        long contractValue = readLong(metadata, "contract_value", 0L);
        String docType = readString(metadata, "doc_type", "internal").toLowerCase();
        boolean isExternal = readBoolean(metadata, "is_external", false);

        int threshold;
        String reason;

        // Rule 1: Very high-value contract (≥ 10 billion VND) — unanimous approval
        if (contractValue >= 10_000_000_000L) {
            threshold = n;
            reason = "Very high-value contract (≥10B VND): unanimous approval required (" + n + "-of-" + n + ").";
        }
        // Rule 2: High-value contract (≥ 1 billion VND) — at least 2 approvals
        else if (contractValue >= 1_000_000_000L) {
            threshold = Math.min(2, n);
            reason = "High-value contract (≥1B VND): minimum 2 approvals required.";
        }
        // Rule 3: Classified document — strict majority (⌊n/2⌋ + 1)
        else if ("classified".equals(docType)) {
            threshold = (n / 2) + 1;
            reason = "Classified document: strict majority approval required (" + threshold + "-of-" + n + ").";
        }
        // Rule 4: Legal document — at least 2 approvals
        else if ("legal".equals(docType)) {
            threshold = Math.min(2, n);
            reason = "Legal document: minimum 2 approvals required.";
        }
        // Rule 5: External/cross-organization document — at least 2 approvals
        else if (isExternal) {
            threshold = Math.min(2, n);
            reason = "External document: cross-organizational signing requires minimum 2 approvals.";
        }
        // Default: single approval sufficient
        else {
            threshold = 1;
            reason = "Default policy: single approval is sufficient for internal documents.";
        }

        return new RemoteSigningDtos.PolicyEvaluationResponse(threshold, participants, reason);
    }

    // ── Metadata readers ──────────────────────────────────────────────────────

    private long readLong(Map<String, Object> metadata, String key, long defaultValue) {
        if (metadata == null || !metadata.containsKey(key) || metadata.get(key) == null)
            return defaultValue;
        Object v = metadata.get(key);
        if (v instanceof Number num) return num.longValue();
        try { return Long.parseLong(String.valueOf(v)); }
        catch (NumberFormatException ignored) { return defaultValue; }
    }

    private String readString(Map<String, Object> metadata, String key, String defaultValue) {
        if (metadata == null || !metadata.containsKey(key) || metadata.get(key) == null)
            return defaultValue;
        return String.valueOf(metadata.get(key));
    }

    private boolean readBoolean(Map<String, Object> metadata, String key, boolean defaultValue) {
        if (metadata == null || !metadata.containsKey(key) || metadata.get(key) == null)
            return defaultValue;
        Object v = metadata.get(key);
        if (v instanceof Boolean b) return b;
        return Boolean.parseBoolean(String.valueOf(v));
    }
}
