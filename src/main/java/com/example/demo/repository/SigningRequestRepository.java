package com.example.demo.repository;

import com.example.demo.entity.SigningRequest;
import com.example.demo.model.SigningRequestStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface SigningRequestRepository extends JpaRepository<SigningRequest, String> {
    List<SigningRequest> findByCreatedByOrderByCreatedAtDesc(String createdBy);
    List<SigningRequest> findByStatus(SigningRequestStatus status);

    @Query("SELECT r FROM SigningRequest r WHERE :participantId MEMBER OF r.participants")
    List<SigningRequest> findByParticipant(@Param("participantId") String participantId);
}
