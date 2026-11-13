package com.example.demo.crypto;

import com.example.demo.crypto.ShamirSecretSharing.Share;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.math.BigInteger;
import java.security.KeyPair;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class ThresholdRsaUtilTest {

    private static KeyPair keyPair;
    private static BigInteger n, e, d;
    private static BigInteger fieldPrime;
    private static byte[] docHash;

    @BeforeAll
    static void setup() throws Exception {
        keyPair = ThresholdRsaUtil.generateRsaKeyPair();
        n = ((RSAPublicKey) keyPair.getPublic()).getModulus();
        e = ((RSAPublicKey) keyPair.getPublic()).getPublicExponent();
        d = ((RSAPrivateKey) keyPair.getPrivate()).getPrivateExponent();
        fieldPrime = ThresholdRsaUtil.generateFieldPrime(d);

        byte[] content = "test document content for threshold rsa".getBytes();
        docHash = MessageDigest.getInstance("SHA-256").digest(content);
    }

    @Test
    void generateRsaKeyPair_produces2048BitKey() {
        assertEquals(2048, n.bitLength());
    }

    @Test
    void fieldPrime_isGreaterThanD() {
        assertTrue(fieldPrime.compareTo(d) > 0,
                "Field prime must be greater than d to avoid information loss in Shamir split");
    }

    @Test
    void fieldPrime_isProbablePrime() {
        assertTrue(fieldPrime.isProbablePrime(80));
    }

    @Test
    void verifyFinalSignature_validSignature_returnsTrue() {
        BigInteger sig = ThresholdRsaUtil.computeFinalSignature(docHash, d, n);
        assertTrue(ThresholdRsaUtil.verifyFinalSignature(sig, e, n, docHash));
    }

    @Test
    void verifyFinalSignature_wrongDocument_returnsFalse() throws Exception {
        BigInteger sig = ThresholdRsaUtil.computeFinalSignature(docHash, d, n);
        byte[] otherHash = MessageDigest.getInstance("SHA-256").digest("other content".getBytes());
        assertFalse(ThresholdRsaUtil.verifyFinalSignature(sig, e, n, otherHash));
    }

    @Test
    void partialSignatureVerify_correctShare_returnsTrue() throws Exception {
        SecureRandom rng = new SecureRandom();
        List<Share> shares = ShamirSecretSharing.split(d, 2, 3, fieldPrime, rng);

        Share s0 = shares.get(0);
        BigInteger partial = ThresholdRsaUtil.computePartialSignature(docHash, s0.y(), n);
        assertTrue(ThresholdRsaUtil.verifyPartialSignature(partial, s0.y(), n, docHash));
    }

    @Test
    void partialSignatureVerify_wrongShare_returnsFalse() throws Exception {
        SecureRandom rng = new SecureRandom();
        List<Share> shares = ShamirSecretSharing.split(d, 2, 3, fieldPrime, rng);

        // Partial computed with share[0], verified against share[1] — must fail
        BigInteger partial = ThresholdRsaUtil.computePartialSignature(docHash, shares.get(0).y(), n);
        assertFalse(ThresholdRsaUtil.verifyPartialSignature(partial, shares.get(1).y(), n, docHash));
    }

    @Test
    void fullFlow_thresholdReconstructAndVerify() throws Exception {
        SecureRandom rng = new SecureRandom();
        int threshold = 2;
        int total = 3;

        List<Share> shares = ShamirSecretSharing.split(d, threshold, total, fieldPrime, rng);

        // Reconstruct d from first t shares
        BigInteger reconstructedD = ShamirSecretSharing.combine(
                List.of(shares.get(0), shares.get(1)), fieldPrime);

        // Final signature with reconstructed d
        BigInteger sig = ThresholdRsaUtil.computeFinalSignature(docHash, reconstructedD, n);
        assertTrue(ThresholdRsaUtil.verifyFinalSignature(sig, e, n, docHash),
                "Threshold-reconstructed d must produce a valid final signature");
    }

    @Test
    void buildPrivateKey_returnsUsableKey() throws Exception {
        assertNotNull(ThresholdRsaUtil.buildPrivateKey(n, d));
    }

    @Test
    void generateSelfSignedCert_isNotNull() throws Exception {
        assertNotNull(ThresholdRsaUtil.generateSelfSignedCert(keyPair.getPublic(), keyPair.getPrivate()));
    }

    @Test
    void certRoundTrip_base64EncodeDecode() throws Exception {
        var cert = ThresholdRsaUtil.generateSelfSignedCert(keyPair.getPublic(), keyPair.getPrivate());
        String b64 = ThresholdRsaUtil.certToBase64(cert);
        var decoded = ThresholdRsaUtil.certFromBase64(b64);
        assertArrayEquals(cert.getEncoded(), decoded.getEncoded());
    }
}
