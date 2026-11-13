package com.example.demo.crypto;

import org.bouncycastle.asn1.x500.X500Name;
import org.bouncycastle.cert.jcajce.JcaX509CertificateConverter;
import org.bouncycastle.cert.jcajce.JcaX509v3CertificateBuilder;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.bouncycastle.operator.ContentSigner;
import org.bouncycastle.operator.jcajce.JcaContentSignerBuilder;

import java.io.ByteArrayInputStream;
import java.math.BigInteger;
import java.security.*;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.security.spec.RSAPrivateKeySpec;
import java.util.Base64;
import java.util.Date;

/**
 * Threshold RSA crypto primitives.
 *
 * Flow:
 *   Init : generate RSA-2048 (n,e,d); generate Shamir prime ℓ > d; split d over GF(ℓ).
 *   Partial: σi = H(doc)^yi mod n  (yi = Shamir share y-value for participant i)
 *   Combine: reconstruct d = Lagrange(shares, ℓ); final_sig = H(doc)^d mod n.
 *   Verify : final_sig^e mod n == H(doc) mod n.
 */
public final class ThresholdRsaUtil {

    static {
        if (Security.getProvider("BC") == null) {
            Security.addProvider(new BouncyCastleProvider());
        }
    }

    private ThresholdRsaUtil() {}

    public static KeyPair generateRsaKeyPair() throws GeneralSecurityException {
        KeyPairGenerator kpg = KeyPairGenerator.getInstance("RSA", "BC");
        kpg.initialize(2048, new SecureRandom());
        return kpg.generateKeyPair();
    }

    /**
     * Generate a prime ℓ > d so Shamir splits d exactly (no reduction mod ℓ).
     * The result is ~2049 bits.
     */
    public static BigInteger generateFieldPrime(BigInteger d) {
        BigInteger start = d.add(BigInteger.ONE);
        if (start.bitLength() <= d.bitLength()) {
            start = BigInteger.ONE.shiftLeft(d.bitLength());
        }
        return start.nextProbablePrime();
    }

    /**
     * Compute partial signature: σi = H(doc)^yi mod n.
     * docHashBytes must be the raw 32-byte SHA-256 digest of the document content.
     */
    public static BigInteger computePartialSignature(byte[] docHashBytes, BigInteger yi, BigInteger n) {
        return hashToInt(docHashBytes, n).modPow(yi, n);
    }

    /**
     * Verify partial signature by recomputing: expected = H^yi mod n.
     */
    public static boolean verifyPartialSignature(BigInteger sigma, BigInteger yi, BigInteger n, byte[] docHashBytes) {
        return computePartialSignature(docHashBytes, yi, n).equals(sigma);
    }

    /**
     * Compute final threshold signature: H(doc)^d mod n using the reconstructed private exponent.
     */
    public static BigInteger computeFinalSignature(byte[] docHashBytes, BigInteger d, BigInteger n) {
        return hashToInt(docHashBytes, n).modPow(d, n);
    }

    /**
     * Verify final signature: sig^e mod n == H(doc) mod n.
     */
    public static boolean verifyFinalSignature(BigInteger sig, BigInteger e, BigInteger n, byte[] docHashBytes) {
        return sig.modPow(e, n).equals(hashToInt(docHashBytes, n));
    }

    /**
     * Convert raw hash bytes to a BigInteger in range [0, n-1] (textbook RSA input).
     */
    static BigInteger hashToInt(byte[] hashBytes, BigInteger n) {
        return new BigInteger(1, hashBytes).mod(n);
    }

    /**
     * Build a PrivateKey from raw (n, d) components for use with iText signing.
     */
    public static PrivateKey buildPrivateKey(BigInteger n, BigInteger d) throws GeneralSecurityException {
        return KeyFactory.getInstance("RSA", "BC").generatePrivate(new RSAPrivateKeySpec(n, d));
    }

    /**
     * Generate a self-signed X.509 certificate for the RSA key pair.
     */
    public static X509Certificate generateSelfSignedCert(PublicKey publicKey, PrivateKey privateKey) throws Exception {
        X500Name subject = new X500Name("CN=DATN Threshold RSA Demo");
        BigInteger serial = new BigInteger(160, new SecureRandom()).abs();
        Date notBefore = new Date(System.currentTimeMillis() - 60_000L);
        Date notAfter = new Date(System.currentTimeMillis() + 365L * 24 * 60 * 60 * 1000);

        JcaX509v3CertificateBuilder builder = new JcaX509v3CertificateBuilder(
                subject, serial, notBefore, notAfter, subject, publicKey);

        ContentSigner signer = new JcaContentSignerBuilder("SHA256withRSA")
                .setProvider("BC")
                .build(privateKey);

        return new JcaX509CertificateConverter()
                .setProvider("BC")
                .getCertificate(builder.build(signer));
    }

    public static String certToBase64(X509Certificate cert) throws Exception {
        return Base64.getEncoder().encodeToString(cert.getEncoded());
    }

    public static X509Certificate certFromBase64(String b64) throws Exception {
        byte[] der = Base64.getDecoder().decode(b64);
        return (X509Certificate) CertificateFactory.getInstance("X.509")
                .generateCertificate(new ByteArrayInputStream(der));
    }
}
