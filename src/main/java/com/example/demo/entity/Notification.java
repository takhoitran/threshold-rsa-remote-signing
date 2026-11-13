package com.example.demo.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "notifications")
public class Notification {

    @Id
    private String id;

    @Column(nullable = false)
    private String recipientUsername;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String message;

    private String signingRequestId;

    @Column(nullable = false)
    private boolean read = false;

    @Column(nullable = false)
    private Instant createdAt;

    public Notification() {}

    public Notification(String id, String recipientUsername, String message,
                        String signingRequestId, Instant createdAt) {
        this.id = id;
        this.recipientUsername = recipientUsername;
        this.message = message;
        this.signingRequestId = signingRequestId;
        this.read = false;
        this.createdAt = createdAt;
    }

    public String getId() { return id; }
    public String getRecipientUsername() { return recipientUsername; }
    public String getMessage() { return message; }
    public String getSigningRequestId() { return signingRequestId; }
    public boolean isRead() { return read; }
    public Instant getCreatedAt() { return createdAt; }

    public void setRead(boolean read) { this.read = read; }
}
