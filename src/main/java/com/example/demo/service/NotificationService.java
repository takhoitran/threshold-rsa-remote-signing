package com.example.demo.service;

import com.example.demo.entity.Notification;
import com.example.demo.repository.NotificationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class NotificationService {

    private final NotificationRepository notificationRepository;

    public NotificationService(NotificationRepository notificationRepository) {
        this.notificationRepository = notificationRepository;
    }

    @Transactional
    public void notifyParticipants(List<String> participants, String signingRequestId,
                                   String documentName, String createdBy) {
        Instant now = Instant.now();
        for (String participant : participants) {
            if (participant.equals(createdBy)) continue;
            String message = createdBy + " đã tạo yêu cầu ký tài liệu \"" + documentName
                    + "\" và mời bạn tham gia ký số.";
            Notification n = new Notification(UUID.randomUUID().toString(),
                    participant, message, signingRequestId, now);
            notificationRepository.save(n);
        }
    }

    public List<Notification> getForUser(String username) {
        return notificationRepository.findByRecipientUsernameOrderByCreatedAtDesc(username);
    }

    public long countUnread(String username) {
        return notificationRepository.countByRecipientUsernameAndReadFalse(username);
    }

    @Transactional
    public void markRead(String notificationId, String username) {
        notificationRepository.findById(notificationId).ifPresent(n -> {
            if (n.getRecipientUsername().equals(username)) {
                n.setRead(true);
                notificationRepository.save(n);
            }
        });
    }

    @Transactional
    public void markAllRead(String username) {
        notificationRepository.findByRecipientUsernameOrderByCreatedAtDesc(username)
                .forEach(n -> {
                    if (!n.isRead()) {
                        n.setRead(true);
                        notificationRepository.save(n);
                    }
                });
    }
}
