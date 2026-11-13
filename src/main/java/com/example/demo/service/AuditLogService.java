package com.example.demo.service;

import com.example.demo.dto.RemoteSigningDtos;
import com.example.demo.entity.AuditLog;
import com.example.demo.repository.AuditLogRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;

    public AuditLogService(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    public void log(String action, String detail) {
        log(action, detail, null);
    }

    public void log(String action, String detail, String username) {
        auditLogRepository.save(new AuditLog(action, detail, username));
    }

    public List<RemoteSigningDtos.AuditLogItem> getAll() {
        return auditLogRepository.findAllByOrderByTimestampDesc().stream()
                .map(e -> new RemoteSigningDtos.AuditLogItem(
                        e.getId(), e.getTimestamp(), e.getAction(), e.getDetail(), e.getUsername()))
                .toList();
    }

    public List<RemoteSigningDtos.AuditLogItem> getByUser(String username) {
        return auditLogRepository.findByUsernameOrderByTimestampDesc(username).stream()
                .map(e -> new RemoteSigningDtos.AuditLogItem(
                        e.getId(), e.getTimestamp(), e.getAction(), e.getDetail(), e.getUsername()))
                .toList();
    }
}
