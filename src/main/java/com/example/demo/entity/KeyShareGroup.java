package com.example.demo.entity;

import jakarta.persistence.*;
import java.math.BigInteger;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Entity
@Table(name = "key_share_groups")
public class KeyShareGroup {

    @Id
    private String id;

    private int threshold;
    private int version;

    @OneToMany(mappedBy = "group", cascade = CascadeType.ALL, fetch = FetchType.EAGER, orphanRemoval = true)
    @OrderColumn(name = "position")
    private List<KeyShare> keyShares = new ArrayList<>();

    @Column(columnDefinition = "TEXT")
    private String rsaModulusHex;

    @Column(columnDefinition = "TEXT")
    private String rsaPublicExponentHex;

    @Column(columnDefinition = "TEXT")
    private String fieldPrimeHex;

    @Column(columnDefinition = "TEXT")
    private String certificateBase64;

    public KeyShareGroup() {}

    public KeyShareGroup(String id, int threshold, int version) {
        this.id = id;
        this.threshold = threshold;
        this.version = version;
    }

    public String getId() { return id; }
    public int getThreshold() { return threshold; }
    public int getVersion() { return version; }
    public List<KeyShare> getKeyShares() { return keyShares; }
    public String getRsaModulusHex() { return rsaModulusHex; }
    public String getRsaPublicExponentHex() { return rsaPublicExponentHex; }
    public String getFieldPrimeHex() { return fieldPrimeHex; }
    public String getCertificateBase64() { return certificateBase64; }

    public void setThreshold(int threshold) { this.threshold = threshold; }
    public void setVersion(int version) { this.version = version; }
    public void setRsaModulusHex(String v) { this.rsaModulusHex = v; }
    public void setRsaPublicExponentHex(String v) { this.rsaPublicExponentHex = v; }
    public void setFieldPrimeHex(String v) { this.fieldPrimeHex = v; }
    public void setCertificateBase64(String v) { this.certificateBase64 = v; }

    // Helpers for service compatibility
    public List<String> getParticipantIds() {
        List<String> ids = new ArrayList<>();
        for (KeyShare ks : keyShares) ids.add(ks.getParticipantId());
        return ids;
    }

    public Map<String, Integer> getParticipantToX() {
        Map<String, Integer> map = new LinkedHashMap<>();
        for (KeyShare ks : keyShares) map.put(ks.getParticipantId(), ks.getX());
        return map;
    }

    public Map<String, BigInteger> getShareY() {
        Map<String, BigInteger> map = new LinkedHashMap<>();
        for (KeyShare ks : keyShares) map.put(ks.getParticipantId(), new BigInteger(ks.getYHex(), 16));
        return map;
    }
}
