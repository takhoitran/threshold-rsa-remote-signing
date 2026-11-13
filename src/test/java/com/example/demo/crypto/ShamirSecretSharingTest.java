package com.example.demo.crypto;

import com.example.demo.crypto.ShamirSecretSharing.Share;
import org.junit.jupiter.api.Test;

import java.math.BigInteger;
import java.security.SecureRandom;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class ShamirSecretSharingTest {

    private static final SecureRandom RNG = new SecureRandom();
    // Small prime for fast tests
    private static final BigInteger PRIME = BigInteger.valueOf(104729);

    @Test
    void splitAndCombine_exactThreshold_recoversSecret() {
        BigInteger secret = BigInteger.valueOf(12345);
        List<Share> shares = ShamirSecretSharing.split(secret, 2, 3, PRIME, RNG);
        assertEquals(3, shares.size());

        BigInteger recovered = ShamirSecretSharing.combine(List.of(shares.get(0), shares.get(1)), PRIME);
        assertEquals(secret.mod(PRIME), recovered);
    }

    @Test
    void splitAndCombine_allShares_recoversSecret() {
        BigInteger secret = BigInteger.valueOf(99999);
        List<Share> shares = ShamirSecretSharing.split(secret, 3, 5, PRIME, RNG);

        BigInteger recovered = ShamirSecretSharing.combine(shares, PRIME);
        assertEquals(secret.mod(PRIME), recovered);
    }

    @Test
    void splitAndCombine_differentSubsets_sameSecret() {
        BigInteger secret = BigInteger.valueOf(42000);
        List<Share> shares = ShamirSecretSharing.split(secret, 2, 4, PRIME, RNG);

        BigInteger r1 = ShamirSecretSharing.combine(List.of(shares.get(0), shares.get(1)), PRIME);
        BigInteger r2 = ShamirSecretSharing.combine(List.of(shares.get(1), shares.get(3)), PRIME);
        BigInteger r3 = ShamirSecretSharing.combine(List.of(shares.get(0), shares.get(3)), PRIME);

        assertEquals(secret.mod(PRIME), r1);
        assertEquals(secret.mod(PRIME), r2);
        assertEquals(secret.mod(PRIME), r3);
    }

    @Test
    void belowThreshold_doesNotRecoverSecret() {
        // With threshold=3, combining only 2 shares gives a wrong result
        BigInteger secret = BigInteger.valueOf(77777);
        List<Share> shares = ShamirSecretSharing.split(secret, 3, 5, PRIME, RNG);

        BigInteger wrong = ShamirSecretSharing.combine(List.of(shares.get(0), shares.get(1)), PRIME);
        assertNotEquals(secret.mod(PRIME), wrong);
    }

    @Test
    void split_invalidThreshold_throwsException() {
        assertThrows(IllegalArgumentException.class,
                () -> ShamirSecretSharing.split(BigInteger.ONE, 0, 3, PRIME, RNG));
        assertThrows(IllegalArgumentException.class,
                () -> ShamirSecretSharing.split(BigInteger.ONE, 4, 3, PRIME, RNG));
    }

    @Test
    void combine_emptyShares_throwsException() {
        assertThrows(IllegalArgumentException.class,
                () -> ShamirSecretSharing.combine(List.of(), PRIME));
    }

    @Test
    void splitAndCombine_secretZero_recovers() {
        BigInteger secret = BigInteger.ZERO;
        List<Share> shares = ShamirSecretSharing.split(secret, 2, 3, PRIME, RNG);
        BigInteger recovered = ShamirSecretSharing.combine(List.of(shares.get(0), shares.get(2)), PRIME);
        assertEquals(BigInteger.ZERO, recovered);
    }

    @Test
    void xCoordinates_areDistinctAndStartAtOne() {
        List<Share> shares = ShamirSecretSharing.split(BigInteger.valueOf(1000), 2, 5, PRIME, RNG);
        for (int i = 0; i < shares.size(); i++) {
            assertEquals(i + 1, shares.get(i).x());
        }
    }
}
