package com.contoso.audit;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.annotation.Rollback;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.hamcrest.Matchers.greaterThan;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@Rollback
class AuditControllerIntegrationTests extends AuditTestDatabase {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void healthReturnsCurrentServiceStatusJson() throws Exception {
        mockMvc.perform(get("/health"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(content().json("""
                        {
                          "status": "ok",
                          "service": "audit-svc"
                        }
                        """, true));
    }

    @Test
    void eventsReturnsMostRecentSeededRowsInCurrentJsonShape() throws Exception {
        mockMvc.perform(get("/events").queryParam("limit", "2"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].id").value(12))
                .andExpect(jsonPath("$[0].event_time").value("2025-03-04 17:48:50"))
                .andExpect(jsonPath("$[0].actor").value("helpdesk"))
                .andExpect(jsonPath("$[0].action").value("return"))
                .andExpect(jsonPath("$[0].entity_type").value("asset"))
                .andExpect(jsonPath("$[0].entity_id").value("CON-KBD-002"))
                .andExpect(jsonPath("$[0].details").value("Returned by hiroshi.tanaka"))
                .andExpect(jsonPath("$[1].id").value(11))
                .andExpect(jsonPath("$[1].action").value("permissions"));
    }

    @Test
    void eventsQueryReturnsCurrentSearchResults() throws Exception {
        mockMvc.perform(get("/events").queryParam("query", "assign"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$", hasSize(3)))
                .andExpect(jsonPath("$[0].id").value(10))
                .andExpect(jsonPath("$[0].action").value("assign"))
                .andExpect(jsonPath("$[1].id").value(3))
                .andExpect(jsonPath("$[2].id").value(2));
    }

    @Test
    void createReturnsNumericIdAndPersistsCurrentDefaults() throws Exception {
        mockMvc.perform(post("/events")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "actor": "integration-test",
                                  "details": "Captured current default values"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.id", greaterThan(12)));

        mockMvc.perform(get("/events").queryParam("query", "Captured current default values"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].actor").value("integration-test"))
                .andExpect(jsonPath("$[0].action").value("unknown"))
                .andExpect(jsonPath("$[0].entity_type").value("unknown"))
                .andExpect(jsonPath("$[0].entity_id").value(""))
                .andExpect(jsonPath("$[0].details").value("Captured current default values"));
    }
}
