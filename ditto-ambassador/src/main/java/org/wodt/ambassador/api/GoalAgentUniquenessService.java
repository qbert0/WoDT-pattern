package org.wodt.ambassador.api;

import org.springframework.stereotype.Service;
import org.springframework.http.MediaType;
import org.springframework.web.reactive.function.client.WebClient;
import org.wodt.ambassador.config.DittoProperties;
import reactor.core.publisher.Mono;
import tools.jackson.databind.JsonNode;

import java.nio.charset.StandardCharsets;
import java.util.Optional;

@Service
public class GoalAgentUniquenessService {

    private final WebClient webClient;
    private final DittoProperties properties;

    public GoalAgentUniquenessService(WebClient dittoWebClient, DittoProperties properties) {
        this.webClient = dittoWebClient;
        this.properties = properties;
    }

    public Mono<Optional<String>> findOwningThingId(String goalAgentId) {
        String normalizedGoalAgentId = goalAgentId.trim();
        String filter = "eq(attributes/goalAgentId,\"" + escapeRqlString(normalizedGoalAgentId) + "\")";

        return webClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/api/2/search/things")
                        .queryParam("filter", filter)
                        .queryParam("option", "size(1)")
                        .build())
                .accept(MediaType.APPLICATION_JSON)
                .headers(headers -> {
                    DittoProperties.Account account = properties.credentials().regular();
                    headers.setBasicAuth(account.username(), account.password(), StandardCharsets.UTF_8);
                })
                .retrieve()
                .bodyToMono(JsonNode.class)
                .map(this::extractFirstThingId)
                .defaultIfEmpty(Optional.empty());
    }

    private Optional<String> extractFirstThingId(JsonNode response) {
        JsonNode items = response.path("items");
        if (!items.isArray() || items.isEmpty()) {
            return Optional.empty();
        }

        String thingId = items.get(0).path("thingId").asText("").trim();
        return thingId.isEmpty() ? Optional.empty() : Optional.of(thingId);
    }

    private String escapeRqlString(String value) {
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
