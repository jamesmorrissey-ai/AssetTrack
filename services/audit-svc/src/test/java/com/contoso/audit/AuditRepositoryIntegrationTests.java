package com.contoso.audit;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.annotation.Rollback;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Transactional
@Rollback
class AuditRepositoryIntegrationTests extends AuditTestDatabase {

    @Autowired
    private AuditRepository repository;

    @Test
    void recentReturnsSeededRowsInDescendingIdOrder() {
        List<Map<String, Object>> events = repository.recent(2);

        assertThat(events).hasSize(2);
        assertThat(events.get(0))
                .containsEntry("id", 12)
                .containsEntry("event_time", "2025-03-04 17:48:50")
                .containsEntry("actor", "helpdesk")
                .containsEntry("action", "return")
                .containsEntry("entity_type", "asset")
                .containsEntry("entity_id", "CON-KBD-002")
                .containsEntry("details", "Returned by hiroshi.tanaka");
        assertThat(events.get(1))
                .containsEntry("id", 11)
                .containsEntry("action", "permissions");
    }

    @Test
    void searchMatchesActionEntityTypeAndDetails() {
        assertThat(repository.search("assign"))
                .extracting(event -> event.get("id"))
                .containsExactly(10, 3, 2);
        assertThat(repository.search("user"))
                .extracting(event -> event.get("id"))
                .containsExactly(11, 8);
        assertThat(repository.search("monitor"))
                .singleElement()
                .satisfies(event -> assertThat(event)
                        .containsEntry("id", 3)
                        .containsEntry("details", "Dual-monitor request"));
    }

    @Test
    void insertPersistsTheCurrentColumnValues() {
        long id = repository.insert(
                "integration-test",
                "assignment.create",
                "assignment",
                "42",
                "Assigned test asset");

        assertThat(id).isGreaterThan(12);
        assertThat(repository.search("Assigned test asset"))
                .singleElement()
                .satisfies(event -> assertThat(event)
                        .containsEntry("id", Math.toIntExact(id))
                        .containsEntry("actor", "integration-test")
                        .containsEntry("action", "assignment.create")
                        .containsEntry("entity_type", "assignment")
                        .containsEntry("entity_id", "42")
                        .containsEntry("details", "Assigned test asset"));
    }
}
