package com.example.demo.crypto;

import com.example.demo.crypto.ShamirSecretSharing.Share;
import org.junit.jupiter.api.Test;

import java.math.BigInteger;
import java.security.*;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.util.Arrays;
import java.util.List;

/**
 * Performance benchmark: measures avg and std-dev for each crypto operation.
 * Runs WARMUP rounds first (discarded), then MEASURE rounds.
 */
public class PerformanceBenchmark {

    private static final int WARMUP   = 5;
    private static final int MEASURE  = 20;

    // ---------------------------------------------------------------
    @Test
    void runBenchmark() throws Exception {
        System.out.println("\n========== PERFORMANCE BENCHMARK ==========");
        System.out.printf("Warmup: %d rounds (discarded)  |  Measure: %d rounds%n%n", WARMUP, MEASURE);

        /* ---- shared setup ---- */
        byte[] content = "thesis benchmark document content for sha256".getBytes();
        byte[] docHash = MessageDigest.getInstance("SHA-256").digest(content);
        SecureRandom rng = new SecureRandom();

        /* ---- 1. RSA-2048 key generation ---- */
        long[] tKeyGen = new long[MEASURE];
        KeyPair kp = null;
        for (int i = 0; i < WARMUP; i++) {
            ThresholdRsaUtil.generateRsaKeyPair();
        }
        for (int i = 0; i < MEASURE; i++) {
            long t0 = System.nanoTime();
            kp = ThresholdRsaUtil.generateRsaKeyPair();
            tKeyGen[i] = (System.nanoTime() - t0) / 1_000_000;
        }
        print("RSA-2048 key generation", tKeyGen);

        BigInteger n = ((RSAPublicKey)  kp.getPublic()).getModulus();
        BigInteger e = ((RSAPublicKey)  kp.getPublic()).getPublicExponent();
        BigInteger d = ((RSAPrivateKey) kp.getPrivate()).getPrivateExponent();
        BigInteger fieldPrime = ThresholdRsaUtil.generateFieldPrime(d);

        /* ---- 2. Shamir split (n=3, t=2) ---- */
        long[] tSplit = new long[MEASURE];
        List<Share> shares = null;
        for (int i = 0; i < WARMUP; i++) {
            ShamirSecretSharing.split(d, 2, 3, fieldPrime, rng);
        }
        for (int i = 0; i < MEASURE; i++) {
            long t0 = System.nanoTime();
            shares = ShamirSecretSharing.split(d, 2, 3, fieldPrime, rng);
            tSplit[i] = (System.nanoTime() - t0) / 1_000_000;
        }
        print("Shamir split (n=3, t=2)", tSplit);

        /* ---- 3. Partial signature ---- */
        BigInteger yi = shares.get(0).y();
        long[] tPartial = new long[MEASURE];
        BigInteger partial0 = null;
        for (int i = 0; i < WARMUP; i++) {
            ThresholdRsaUtil.computePartialSignature(docHash, yi, n);
        }
        for (int i = 0; i < MEASURE; i++) {
            long t0 = System.nanoTime();
            partial0 = ThresholdRsaUtil.computePartialSignature(docHash, yi, n);
            tPartial[i] = (System.nanoTime() - t0) / 1_000_000;
        }
        print("Partial signature (H^yi mod n, 2048-bit share)", tPartial);

        /* ---- 4. Shamir reconstruction (t=2) ---- */
        long[] tReconstruct = new long[MEASURE];
        List<Share> twoShares = List.of(shares.get(0), shares.get(1));
        for (int i = 0; i < WARMUP; i++) {
            ShamirSecretSharing.combine(twoShares, fieldPrime);
        }
        for (int i = 0; i < MEASURE; i++) {
            long t0 = System.nanoTime();
            ShamirSecretSharing.combine(twoShares, fieldPrime);
            tReconstruct[i] = (System.nanoTime() - t0) / 1_000_000;
        }
        print("Shamir reconstruction (t=2, Lagrange)", tReconstruct);

        /* ---- 5. Final RSA signature (H^d mod n) ---- */
        long[] tFinalSign = new long[MEASURE];
        for (int i = 0; i < WARMUP; i++) {
            ThresholdRsaUtil.computeFinalSignature(docHash, d, n);
        }
        for (int i = 0; i < MEASURE; i++) {
            long t0 = System.nanoTime();
            ThresholdRsaUtil.computeFinalSignature(docHash, d, n);
            tFinalSign[i] = (System.nanoTime() - t0) / 1_000_000;
        }
        print("Final RSA signature (H^d mod n)", tFinalSign);

        /* ---- 6. Verification (sig^e mod n) ---- */
        BigInteger sig = ThresholdRsaUtil.computeFinalSignature(docHash, d, n);
        long[] tVerify = new long[MEASURE];
        for (int i = 0; i < WARMUP; i++) {
            ThresholdRsaUtil.verifyFinalSignature(sig, e, n, docHash);
        }
        for (int i = 0; i < MEASURE; i++) {
            long t0 = System.nanoTime();
            ThresholdRsaUtil.verifyFinalSignature(sig, e, n, docHash);
            tVerify[i] = (System.nanoTime() - t0) / 1_000_000;
        }
        print("Threshold signature verify (sig^e mod n)", tVerify);

        /* ---- 7. Fallback mode: ephemeral key gen + sign ---- */
        long[] tFallbackFull = new long[MEASURE];
        for (int i = 0; i < WARMUP; i++) {
            KeyPair ekp = ThresholdRsaUtil.generateRsaKeyPair();
            BigInteger ed = ((RSAPrivateKey) ekp.getPrivate()).getPrivateExponent();
            BigInteger en2 = ((RSAPublicKey) ekp.getPublic()).getModulus();
            ThresholdRsaUtil.computeFinalSignature(docHash, ed, en2);
        }
        for (int i = 0; i < MEASURE; i++) {
            long t0 = System.nanoTime();
            KeyPair ekp = ThresholdRsaUtil.generateRsaKeyPair();
            BigInteger ed = ((RSAPrivateKey) ekp.getPrivate()).getPrivateExponent();
            BigInteger en2 = ((RSAPublicKey) ekp.getPublic()).getModulus();
            ThresholdRsaUtil.computeFinalSignature(docHash, ed, en2);
            tFallbackFull[i] = (System.nanoTime() - t0) / 1_000_000;
        }
        print("Fallback: ephemeral key gen + sign", tFallbackFull);

        /* ---- 8. Threshold combine crypto only (reconstruct + final sign) ---- */
        long[] tCombineCrypto = new long[MEASURE];
        for (int i = 0; i < WARMUP; i++) {
            BigInteger rec = ShamirSecretSharing.combine(twoShares, fieldPrime);
            ThresholdRsaUtil.computeFinalSignature(docHash, rec, n);
        }
        for (int i = 0; i < MEASURE; i++) {
            long t0 = System.nanoTime();
            BigInteger rec = ShamirSecretSharing.combine(twoShares, fieldPrime);
            ThresholdRsaUtil.computeFinalSignature(docHash, rec, n);
            tCombineCrypto[i] = (System.nanoTime() - t0) / 1_000_000;
        }
        print("Threshold combine crypto (reconstruct + final sign)", tCombineCrypto);

        System.out.println("\n========== END ==========");
    }

    // ---------------------------------------------------------------
    private static void print(String label, long[] ms) {
        double avg = Arrays.stream(ms).average().orElse(0);
        double variance = Arrays.stream(ms)
                .mapToDouble(v -> (v - avg) * (v - avg))
                .average().orElse(0);
        double std = Math.sqrt(variance);
        System.out.printf("%-52s  avg=%6.1f ms  std=%5.1f ms  [min=%d, max=%d]%n",
                label, avg, std, Arrays.stream(ms).min().orElse(0), Arrays.stream(ms).max().orElse(0));
    }
}
