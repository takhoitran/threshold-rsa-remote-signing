package com.example.demo.service;

import com.example.demo.entity.Document;
import com.example.demo.repository.DocumentRepository;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

@Service
public class DocumentService {

    private final DocumentRepository documentRepository;

    public DocumentService(DocumentRepository documentRepository) {
        this.documentRepository = documentRepository;
    }

    public Document upload(MultipartFile file, String uploadedBy) throws Exception {
        byte[] content = file.getBytes();
        String documentId = UUID.randomUUID().toString();
        String hashBase64 = sha256Base64(content);
        String fileName = file.getOriginalFilename() == null ? "document.pdf" : file.getOriginalFilename();
        Document doc = new Document(documentId, fileName, content, hashBase64, Instant.now(), uploadedBy);
        return documentRepository.save(doc);
    }

    public Document getRequired(String documentId) {
        return documentRepository.findById(documentId)
                .orElseThrow(() -> new IllegalArgumentException("Document not found: " + documentId));
    }

    public List<Document> getByUser(String username) {
        return documentRepository.findByUploadedByOrderByUploadedAtDesc(username);
    }

    String sha256Base64(byte[] input) throws Exception {
        return Base64.getEncoder().encodeToString(
                MessageDigest.getInstance("SHA-256").digest(input));
    }
}
