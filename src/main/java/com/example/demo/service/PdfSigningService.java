package com.example.demo.service;

import com.example.demo.dto.RemoteSigningDtos;
import com.itextpdf.kernel.geom.Rectangle;
import com.itextpdf.kernel.pdf.PdfDictionary;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfName;
import com.itextpdf.kernel.pdf.PdfReader;
import com.itextpdf.kernel.pdf.PdfString;
import com.itextpdf.signatures.BouncyCastleDigest;
import com.itextpdf.signatures.IExternalDigest;
import com.itextpdf.signatures.IExternalSignature;
import com.itextpdf.signatures.PdfSigner;
import com.itextpdf.signatures.PrivateKeySignature;
import com.itextpdf.signatures.PdfPKCS7;
import com.itextpdf.signatures.SignatureUtil;
import org.bouncycastle.asn1.x500.X500Name;
import org.bouncycastle.cert.X509CertificateHolder;
import org.bouncycastle.cert.jcajce.JcaX509CertificateConverter;
import org.bouncycastle.cert.jcajce.JcaX509v3CertificateBuilder;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.bouncycastle.operator.ContentSigner;
import org.bouncycastle.operator.jcajce.JcaContentSignerBuilder;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.util.ArrayList;
import java.util.List;
import java.io.ByteArrayOutputStream;
import java.math.BigInteger;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PrivateKey;
import java.security.SecureRandom;
import java.security.Security;
import java.security.cert.Certificate;
import java.security.cert.X509Certificate;
import java.util.Date;

import static com.itextpdf.signatures.DigestAlgorithms.SHA256;

@Service
public class PdfSigningService {

    private volatile KeyPair signingKeyPair;
    private volatile X509Certificate signingCertificate;
    private final Object initLock = new Object();

    private void ensureInitialized() {
        if (signingKeyPair != null && signingCertificate != null) {
            return;
        }

        synchronized (initLock) {
            if (signingKeyPair != null && signingCertificate != null) {
                return;
            }

            Security.addProvider(new BouncyCastleProvider());

            try {
                KeyPairGenerator kpg = KeyPairGenerator.getInstance("RSA", "BC");
                kpg.initialize(2048, new SecureRandom());
                signingKeyPair = kpg.generateKeyPair();

                X500Name subject = new X500Name("CN=DATN Remote Signing Demo");
                BigInteger serial = new BigInteger(160, new SecureRandom()).abs();
                Date notBefore = new Date(System.currentTimeMillis() - 60_000L);
                Date notAfter = new Date(System.currentTimeMillis() + 365L * 24 * 60 * 60 * 1000);

                JcaX509v3CertificateBuilder certBuilder = new JcaX509v3CertificateBuilder(
                        subject,
                        serial,
                        notBefore,
                        notAfter,
                        subject,
                        signingKeyPair.getPublic()
                );

                ContentSigner contentSigner = new JcaContentSignerBuilder("SHA256withRSA")
                        .setProvider("BC")
                        .build(signingKeyPair.getPrivate());

                X509CertificateHolder holder = certBuilder.build(contentSigner);
                signingCertificate = new JcaX509CertificateConverter()
                        .setProvider("BC")
                        .getCertificate(holder);
            } catch (Exception e) {
                throw new IllegalStateException("Failed to initialize demo signing certificate", e);
            }
        }
    }

    /** Sign using the key group's RSA key and certificate (Threshold RSA path). */
    public byte[] signPdf(byte[] pdfBytes, String fieldName, PrivateKey privateKey, Certificate[] chain,
                          List<String> signers, List<String> signerDisplayLabels, int threshold,
                          RemoteSigningDtos.CombineRequest position) throws Exception {
        if (Security.getProvider("BC") == null) {
            Security.addProvider(new BouncyCastleProvider());
        }
        return doSign(pdfBytes, fieldName, privateKey, chain, signerDisplayLabels, threshold, position);
    }

    /** Sign using the ephemeral in-memory key (fallback path, no key group). */
    public byte[] signPdf(byte[] pdfBytes, String fieldName, List<String> signers, List<String> signerDisplayLabels,
                          int threshold, RemoteSigningDtos.CombineRequest position) throws Exception {
        ensureInitialized();
        PrivateKey privateKey = signingKeyPair.getPrivate();
        Certificate[] chain = new Certificate[]{signingCertificate};
        return doSign(pdfBytes, fieldName, privateKey, chain, signerDisplayLabels, threshold, position);
    }

    private Rectangle computeRect(byte[] pdfBytes, RemoteSigningDtos.CombineRequest pos) {
        int page = (pos == null || pos.page() == null) ? 1 : pos.page();
        float xPct    = (pos == null || pos.xPct()      == null) ? 5f  : pos.xPct();
        float yPct    = (pos == null || pos.yPct()      == null) ? 80f : pos.yPct();
        float wPct    = (pos == null || pos.widthPct()  == null) ? 40f : pos.widthPct();
        float hPct    = (pos == null || pos.heightPct() == null) ? 10f : pos.heightPct();
        try (PdfDocument doc = new PdfDocument(new PdfReader(new ByteArrayInputStream(pdfBytes)))) {
            Rectangle pageSize = doc.getPage(page).getPageSize();
            float pw = pageSize.getWidth();
            float ph = pageSize.getHeight();
            float w = wPct / 100f * pw;
            float h = hPct / 100f * ph;
            float x = xPct / 100f * pw;
            // yPct is from top in screen coords → convert to PDF (from bottom)
            float y = ph - yPct / 100f * ph - h;
            return new Rectangle(x, Math.max(0, y), w, h);
        } catch (Exception e) {
            return new Rectangle(36, 36, 280, 70);
        }
    }

    private byte[] doSign(byte[] pdfBytes, String fieldName, PrivateKey privateKey, Certificate[] chain,
                          List<String> signerDisplayLabels, int threshold,
                          RemoteSigningDtos.CombineRequest position) throws Exception {
        ByteArrayOutputStream signedOut = new ByteArrayOutputStream();

        PdfSigner signer = new PdfSigner(
                new PdfReader(new ByteArrayInputStream(pdfBytes)),
                signedOut,
                new com.itextpdf.kernel.pdf.StampingProperties()
        );
        signer.setFieldName(fieldName);

        String signerList = String.join(", ", signerDisplayLabels);
        int total = signerDisplayLabels.size();
        String timestamp = java.time.ZonedDateTime.now(java.time.ZoneId.of("Asia/Ho_Chi_Minh"))
                .format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss z"));
        String appearanceText = "MPC Threshold Signature (" + threshold + "-of-" + total + ")\n"
                + "Signed by: " + signerList + "\n"
                + "Signed at: " + timestamp;

        int pageNum = (position == null || position.page() == null) ? 1 : position.page();
        Rectangle rect = computeRect(pdfBytes, position);
        signer.getSignatureAppearance()
                .setReason("MPC Threshold Signature " + threshold + "-of-" + total
                        + " | Signers: " + signerList)
                .setContact(signerList)
                .setLocation("Vietnam")
                .setPageRect(rect)
                .setPageNumber(pageNum)
                .setRenderingMode(com.itextpdf.signatures.PdfSignatureAppearance.RenderingMode.DESCRIPTION)
                .setLayer2Text(appearanceText);

        IExternalDigest digest = new BouncyCastleDigest();
        IExternalSignature signature = new PrivateKeySignature(privateKey, SHA256, "BC");
        signer.signDetached(digest, signature, chain, null, null, null, 0, PdfSigner.CryptoStandard.CMS);

        return signedOut.toByteArray();
    }

    public record VerifyResult(boolean valid, List<String> signerLabels) {}

    public VerifyResult verifySignedPdf(byte[] signedPdfBytes) {
        try (PdfDocument pdfDocument = new PdfDocument(new PdfReader(new ByteArrayInputStream(signedPdfBytes)))) {
            SignatureUtil signatureUtil = new SignatureUtil(pdfDocument);
            var names = signatureUtil.getSignatureNames();
            if (names == null || names.isEmpty()) return new VerifyResult(false, List.of());

            String first = names.iterator().next();
            PdfPKCS7 pkcs7 = signatureUtil.readSignatureData(first);
            boolean valid = pkcs7.verifySignatureIntegrityAndAuthenticity();

            List<String> signerLabels = new ArrayList<>();
            PdfDictionary sigDict = signatureUtil.getSignatureDictionary(first);
            if (sigDict != null) {
                PdfString contact = sigDict.getAsString(PdfName.ContactInfo);
                if (contact != null && !contact.getValue().isBlank()) {
                    for (String label : contact.getValue().split(",\\s*")) {
                        String trimmed = label.trim();
                        if (!trimmed.isEmpty()) signerLabels.add(trimmed);
                    }
                }
            }

            return new VerifyResult(valid, signerLabels);
        } catch (Exception e) {
            return new VerifyResult(false, List.of());
        }
    }
}

