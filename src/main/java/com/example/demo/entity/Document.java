package com.example.demo.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "documents")
public class Document {

    @Id
    private String id;

    @Column(nullable = false)
    private String originalFileName;

    @Column(columnDefinition = "BYTEA", nullable = false)
    private byte[] content;

    @Column(nullable = false, length = 128)
    private String hashBase64;

    @Column(nullable = false)
    private Instant uploadedAt;

    private String uploadedBy;

    public Document() {}

    public Document(String id, String originalFileName, byte[] content, String hashBase64, Instant uploadedAt, String uploadedBy) {
        this.id = id;
        this.originalFileName = originalFileName;
        this.content = content;
        this.hashBase64 = hashBase64;
        this.uploadedAt = uploadedAt;
        this.uploadedBy = uploadedBy;
    }

    public String getId() { return id; }
    public String getOriginalFileName() { return originalFileName; }
    public byte[] getContent() { return content; }
    public String getHashBase64() { return hashBase64; }
    public Instant getUploadedAt() { return uploadedAt; }
    public String getUploadedBy() { return uploadedBy; }
}
