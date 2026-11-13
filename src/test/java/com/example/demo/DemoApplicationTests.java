package com.example.demo;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
@Disabled("Integration test: requires a running PostgreSQL instance. " +
          "Run manually: ./gradlew test --tests DemoApplicationTests")
class DemoApplicationTests {

    @Test
    void contextLoads() {
        // Verifies that the full Spring Boot application context starts successfully
        // (all beans wired, DB connected, security configured).
    }
}
