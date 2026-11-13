package com.example.demo.service;

import com.example.demo.dto.RemoteSigningDtos;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class PolicyEngineServiceTest {

    private PolicyEngineService policy;
    private static final List<String> THREE = List.of("alice", "bob", "charlie");
    private static final List<String> FIVE  = List.of("a", "b", "c", "d", "e");
    private static final List<String> ONE   = List.of("alice");

    @BeforeEach
    void setup() {
        policy = new PolicyEngineService();
    }

    // ── Rule 1: Very high-value contract (≥ 10B VND) ─────────────────────────

    @Test
    void veryHighValue_threeParticipants_unanimousThreshold() {
        var res = policy.evaluate(THREE, Map.of("contract_value", 10_000_000_000L));
        assertEquals(3, res.threshold());
        assertTrue(res.reason().contains("unanimous"));
    }

    @Test
    void veryHighValue_fiveParticipants_allMustSign() {
        var res = policy.evaluate(FIVE, Map.of("contract_value", 15_000_000_000L));
        assertEquals(5, res.threshold());
    }

    // ── Rule 2: High-value contract (1B–9.9B VND) ────────────────────────────

    @Test
    void highValue_threeParticipants_thresholdTwo() {
        var res = policy.evaluate(THREE, Map.of("contract_value", 1_000_000_000L));
        assertEquals(2, res.threshold());
        assertTrue(res.reason().contains("1B"));
    }

    @Test
    void highValue_singleParticipant_cappedAtOne() {
        var res = policy.evaluate(ONE, Map.of("contract_value", 5_000_000_000L));
        assertEquals(1, res.threshold()); // min(2, 1) = 1
    }

    @Test
    void justBelowHighValue_defaultThreshold() {
        var res = policy.evaluate(THREE, Map.of("contract_value", 999_999_999L));
        assertEquals(1, res.threshold());
    }

    // ── Rule 3: Classified document ──────────────────────────────────────────

    @Test
    void classified_threeParticipants_majorityTwo() {
        var res = policy.evaluate(THREE, Map.of("doc_type", "classified"));
        assertEquals(2, res.threshold()); // floor(3/2)+1 = 2
        assertTrue(res.reason().contains("majority") || res.reason().contains("Classified"));
    }

    @Test
    void classified_fiveParticipants_majorityThree() {
        var res = policy.evaluate(FIVE, Map.of("doc_type", "classified"));
        assertEquals(3, res.threshold()); // floor(5/2)+1 = 3
    }

    @Test
    void classified_caseInsensitive() {
        var res = policy.evaluate(THREE, Map.of("doc_type", "CLASSIFIED"));
        assertEquals(2, res.threshold());
    }

    // ── Rule 4: Legal document ────────────────────────────────────────────────

    @Test
    void legal_threeParticipants_thresholdTwo() {
        var res = policy.evaluate(THREE, Map.of("doc_type", "legal"));
        assertEquals(2, res.threshold());
        assertTrue(res.reason().toLowerCase().contains("legal"));
    }

    @Test
    void legal_singleParticipant_cappedAtOne() {
        var res = policy.evaluate(ONE, Map.of("doc_type", "legal"));
        assertEquals(1, res.threshold());
    }

    // ── Rule 5: External document ─────────────────────────────────────────────

    @Test
    void external_threeParticipants_thresholdTwo() {
        var res = policy.evaluate(THREE, Map.of("is_external", true));
        assertEquals(2, res.threshold());
        assertTrue(res.reason().toLowerCase().contains("external"));
    }

    @Test
    void notExternal_defaultThreshold() {
        var res = policy.evaluate(THREE, Map.of("is_external", false));
        assertEquals(1, res.threshold());
    }

    // ── Default rule ──────────────────────────────────────────────────────────

    @Test
    void nullMetadata_defaultThreshold() {
        var res = policy.evaluate(THREE, null);
        assertEquals(1, res.threshold());
        assertTrue(res.reason().toLowerCase().contains("default"));
    }

    @Test
    void emptyMetadata_defaultThreshold() {
        var res = policy.evaluate(THREE, Map.of());
        assertEquals(1, res.threshold());
    }

    // ── Rule priority: high-value overrides doc_type ──────────────────────────

    @Test
    void highValueAndLegal_contractValueWins() {
        // contract_value (rule 2) takes priority over doc_type legal (rule 4)
        var res = policy.evaluate(FIVE,
                Map.of("contract_value", 2_000_000_000L, "doc_type", "legal"));
        assertEquals(2, res.threshold());
        assertTrue(res.reason().contains("1B") || res.reason().contains("high-value"));
    }

    @Test
    void veryHighValueAndClassified_unanimousWins() {
        var res = policy.evaluate(THREE,
                Map.of("contract_value", 10_000_000_000L, "doc_type", "classified"));
        assertEquals(3, res.threshold()); // Rule 1 wins: unanimous
    }

    // ── Response completeness ─────────────────────────────────────────────────

    @Test
    void response_containsAllParticipants() {
        var res = policy.evaluate(THREE, Map.of());
        assertEquals(THREE, res.selectedParticipants());
    }

    @Test
    void response_reasonIsNotBlank() {
        var res = policy.evaluate(THREE, Map.of());
        assertNotNull(res.reason());
        assertFalse(res.reason().isBlank());
    }
}
