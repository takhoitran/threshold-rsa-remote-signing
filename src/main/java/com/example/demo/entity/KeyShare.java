package com.example.demo.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "key_shares")
public class KeyShare {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "group_id", nullable = false)
    private KeyShareGroup group;

    @Column(nullable = false)
    private String participantId;

    @Column(nullable = false)
    private int x;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String yHex;

    public KeyShare() {}

    public KeyShare(KeyShareGroup group, String participantId, int x, String yHex) {
        this.group = group;
        this.participantId = participantId;
        this.x = x;
        this.yHex = yHex;
    }

    public String getId() { return id; }
    public KeyShareGroup getGroup() { return group; }
    public String getParticipantId() { return participantId; }
    public int getX() { return x; }
    public String getYHex() { return yHex; }

    public void setParticipantId(String participantId) { this.participantId = participantId; }
    public void setX(int x) { this.x = x; }
    public void setYHex(String yHex) { this.yHex = yHex; }
}
