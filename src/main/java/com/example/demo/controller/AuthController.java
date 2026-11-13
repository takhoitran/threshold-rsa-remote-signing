package com.example.demo.controller;

import com.example.demo.dto.AuthDtos;
import com.example.demo.entity.User;
import com.example.demo.model.Role;
import com.example.demo.repository.UserRepository;
import com.example.demo.security.JwtUtil;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final AuthenticationManager authenticationManager;

    public AuthController(UserRepository userRepository,
                          PasswordEncoder passwordEncoder,
                          JwtUtil jwtUtil,
                          AuthenticationManager authenticationManager) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
        this.authenticationManager = authenticationManager;
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody AuthDtos.RegisterRequest req) {
        if (req.username() == null || req.username().isBlank())
            return ResponseEntity.badRequest().body("username is required");
        if (req.email() == null || req.email().isBlank())
            return ResponseEntity.badRequest().body("email is required");
        if (req.password() == null || req.password().length() < 6)
            return ResponseEntity.badRequest().body("password must be at least 6 characters");
        if (req.signingPin() == null || !req.signingPin().matches("\\d{6}"))
            return ResponseEntity.badRequest().body("signingPin must be exactly 6 digits");
        if (req.employeeId() == null || req.employeeId().isBlank())
            return ResponseEntity.badRequest().body("employeeId is required");
        if (req.unit() == null || req.unit().isBlank())
            return ResponseEntity.badRequest().body("unit is required");

        if (userRepository.existsByUsername(req.username()))
            return ResponseEntity.status(HttpStatus.CONFLICT).body("username already taken");
        if (userRepository.existsByEmail(req.email()))
            return ResponseEntity.status(HttpStatus.CONFLICT).body("email already registered");
        if (userRepository.existsByEmployeeId(req.employeeId()))
            return ResponseEntity.status(HttpStatus.CONFLICT).body("employeeId already registered");

        User user = new User(
                req.username(),
                req.email(),
                passwordEncoder.encode(req.password()),
                Role.USER
        );
        user.setSigningPin(passwordEncoder.encode(req.signingPin()));
        user.setEmployeeId(req.employeeId());
        user.setUnit(req.unit());
        userRepository.save(user);

        String token = jwtUtil.generateToken(user.getUsername(), user.getRole().name());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(new AuthDtos.AuthResponse(token, user.getUsername(), user.getRole().name()));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody AuthDtos.LoginRequest req) {
        try {
            Authentication auth = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(req.username(), req.password())
            );
            User user = userRepository.findByUsername(auth.getName()).orElseThrow();
            String token = jwtUtil.generateToken(user.getUsername(), user.getRole().name());
            return ResponseEntity.ok(new AuthDtos.AuthResponse(token, user.getUsername(), user.getRole().name()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid username or password");
        }
    }

    @GetMapping("/me")
    public ResponseEntity<?> me(Authentication auth) {
        if (auth == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        User user = userRepository.findByUsername(auth.getName()).orElseThrow();
        return ResponseEntity.ok(toUserInfo(user));
    }

    @PutMapping("/change-password")
    public ResponseEntity<?> changePassword(@RequestBody AuthDtos.ChangePasswordRequest req, Authentication auth) {
        if (auth == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        User user = userRepository.findByUsername(auth.getName()).orElseThrow();
        if (!passwordEncoder.matches(req.currentPassword(), user.getPasswordHash()))
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Current password is incorrect");
        if (req.newPassword() == null || req.newPassword().length() < 6)
            return ResponseEntity.badRequest().body("New password must be at least 6 characters");
        user.setPassword(passwordEncoder.encode(req.newPassword()));
        userRepository.save(user);
        return ResponseEntity.ok("Password changed successfully");
    }

    @PutMapping("/change-signing-pin")
    public ResponseEntity<?> changeSigningPin(@RequestBody AuthDtos.ChangeSigningPinRequest req, Authentication auth) {
        if (auth == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        User user = userRepository.findByUsername(auth.getName()).orElseThrow();
        if (!passwordEncoder.matches(req.currentPin(), user.getSigningPin()))
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Current signing PIN is incorrect");
        if (req.newPin() == null || !req.newPin().matches("\\d{6}"))
            return ResponseEntity.badRequest().body("New signing PIN must be exactly 6 digits");
        user.setSigningPin(passwordEncoder.encode(req.newPin()));
        userRepository.save(user);
        return ResponseEntity.ok("Signing PIN changed successfully");
    }

    @GetMapping("/users/search")
    public ResponseEntity<?> searchUsers(@RequestParam(defaultValue = "") String q, Authentication auth) {
        if (auth == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        if (q.isBlank()) return ResponseEntity.ok(List.of());
        List<AuthDtos.UserInfo> results = userRepository.findTop10ByUsernameStartingWithIgnoreCase(q)
                .stream().map(this::toUserInfo).collect(Collectors.toList());
        return ResponseEntity.ok(results);
    }

    @GetMapping("/users/{username}")
    public ResponseEntity<?> getUserProfile(@PathVariable String username, Authentication auth) {
        if (auth == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        return userRepository.findByUsername(username)
                .<ResponseEntity<?>>map(u -> ResponseEntity.ok(toUserInfo(u)))
                .orElse(ResponseEntity.notFound().build());
    }

    private AuthDtos.UserInfo toUserInfo(User user) {
        return new AuthDtos.UserInfo(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getRole().name(),
                user.getEmployeeId(),
                user.getUnit(),
                user.getCreatedAt() != null ? user.getCreatedAt().toString() : null
        );
    }
}
