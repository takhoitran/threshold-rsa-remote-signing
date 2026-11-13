package com.example.demo.dto;

public final class AuthDtos {
    private AuthDtos() {}

    public record RegisterRequest(String username, String email, String password, String signingPin,
                                  String employeeId, String unit) {}

    public record LoginRequest(String username, String password) {}

    public record AuthResponse(String token, String username, String role) {}

    public record UserInfo(String id, String username, String email, String role,
                           String employeeId, String unit, String createdAt) {}

    public record ChangePasswordRequest(String currentPassword, String newPassword) {}

    public record ChangeSigningPinRequest(String currentPin, String newPin) {}
}
