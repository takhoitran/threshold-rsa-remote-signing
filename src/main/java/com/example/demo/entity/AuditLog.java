package com.example.demo.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "audit_logs")
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(nullable = false)
    private Instant timestamp;

    @Column(nullable = false, length = 60)
    private String action;

    @Column(columnDefinition = "TEXT")
    private String detail;

    private String username;

    public AuditLog() {}

    public AuditLog(String action, String detail, String username) {
        this.timestamp = Instant.now();
        this.action = action;
        this.detail = detail;
        this.username = username;
    }

    public String getId() { return id; }
    public Instant getTimestamp() { return timestamp; }
    public String getAction() { return action; }
    public String getDetail() { return detail; }
    public String getUsername() { return username; }
}
