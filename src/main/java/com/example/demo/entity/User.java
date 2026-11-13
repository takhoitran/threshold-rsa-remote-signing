package com.example.demo.entity;

import com.example.demo.model.Role;
import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(unique = true, nullable = false, length = 50)
    private String username;

    @Column(unique = true, nullable = false, length = 100)
    private String email;

    @Column(nullable = false)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Role role;

    @Column(nullable = false)
    private Instant createdAt;

    @Column(nullable = true, length = 100)
    private String signingPin;

    @Column(nullable = true, length = 50, unique = true)
    private String employeeId;

    @Column(nullable = true, length = 100)
    private String unit;

    public User() {}

    public User(String username, String email, String passwordHash, Role role) {
        this.username = username;
        this.email = email;
        this.passwordHash = passwordHash;
        this.role = role;
        this.createdAt = Instant.now();
    }

    public String getId() { return id; }
    public String getUsername() { return username; }
    public String getEmail() { return email; }
    public String getPasswordHash() { return passwordHash; }
    public Role getRole() { return role; }
    public Instant getCreatedAt() { return createdAt; }
    public String getSigningPin() { return signingPin; }
    public String getEmployeeId() { return employeeId; }
    public String getUnit() { return unit; }

    public void setRole(Role role) { this.role = role; }
    public void setPassword(String passwordHash) { this.passwordHash = passwordHash; }
    public void setSigningPin(String signingPin) { this.signingPin = signingPin; }
    public void setEmployeeId(String employeeId) { this.employeeId = employeeId; }
    public void setUnit(String unit) { this.unit = unit; }
}
