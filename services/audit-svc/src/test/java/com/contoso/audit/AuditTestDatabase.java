package com.contoso.audit;

import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;

abstract class AuditTestDatabase {

    private static final Path DATABASE_PATH = createDatabase();

    @DynamicPropertySource
    static void configureDatabase(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> "jdbc:sqlite:" + DATABASE_PATH);
    }

    private static Path createDatabase() {
        try {
            Path database = Files.createTempFile("audit-svc-test-", ".db");
            database.toFile().deleteOnExit();
            return database;
        } catch (IOException exception) {
            throw new UncheckedIOException("Failed to create temporary audit test database", exception);
        }
    }
}
