package com.example.demo;

import com.example.demo.entity.User;
import com.example.demo.model.Role;
import com.example.demo.repository.UserRepository;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

@Component
public class DataInitializer implements ApplicationRunner {

    private static final String[] DEPARTMENTS = {
        "Engineering", "Finance", "Legal", "Administration",
        "Operations", "Research", "Human Resources", "Management"
    };

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public DataInitializer(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(ApplicationArguments args) {
        seedUser("admin",   "admin@mpc.local",   "admin123",   Role.ADMIN, "000000", "ADM001", "Management");
        seedUser("alice",   "alice@mpc.local",   "alice123",   Role.USER,  "111111", "EMP001", "Engineering");
        seedUser("bob",     "bob@mpc.local",     "bob123",     Role.USER,  "222222", "EMP002", "Finance");
        seedUser("charlie", "charlie@mpc.local", "charlie123", Role.USER,  "333333", "EMP003", "Legal");
        seedUser("dave",    "dave@mpc.local",    "dave123",    Role.USER,  "444444", "EMP004", "Operations");
        seedUser("eve",     "eve@mpc.local",     "eve123",     Role.USER,  "555555", "EMP005", "Research");

        backfillMissingFields();
    }

    private void seedUser(String username, String email, String password, Role role,
                          String defaultPin, String employeeId, String unit) {
        userRepository.findByUsername(username).ifPresentOrElse(
            existing -> {
                existing.setPassword(passwordEncoder.encode(password));
                if (existing.getSigningPin() == null) {
                    existing.setSigningPin(passwordEncoder.encode(defaultPin));
                }
                if (existing.getEmployeeId() == null) existing.setEmployeeId(employeeId);
                if (existing.getUnit() == null) existing.setUnit(unit);
                userRepository.save(existing);
            },
            () -> {
                User u = new User(username, email, passwordEncoder.encode(password), role);
                u.setSigningPin(passwordEncoder.encode(defaultPin));
                u.setEmployeeId(employeeId);
                u.setUnit(unit);
                userRepository.save(u);
            }
        );
    }

    /** Fill employeeId and unit for any user that was created before these fields existed. */
    private void backfillMissingFields() {
        List<User> users = userRepository.findAll();
        AtomicInteger counter = new AtomicInteger(100);
        for (User u : users) {
            boolean dirty = false;
            if (u.getEmployeeId() == null) {
                String candidate = "EMP" + String.format("%03d", counter.getAndIncrement());
                // Ensure uniqueness
                while (userRepository.existsByEmployeeId(candidate)) {
                    candidate = "EMP" + String.format("%03d", counter.getAndIncrement());
                }
                u.setEmployeeId(candidate);
                dirty = true;
            }
            if (u.getUnit() == null) {
                int idx = Math.abs(u.getUsername().hashCode()) % DEPARTMENTS.length;
                u.setUnit(DEPARTMENTS[idx]);
                dirty = true;
            }
            if (dirty) userRepository.save(u);
        }
    }
}
