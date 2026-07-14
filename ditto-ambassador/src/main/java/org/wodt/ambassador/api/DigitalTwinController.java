package org.wodt.ambassador.api;

import io.netty.handler.timeout.ReadTimeoutException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.buffer.DataBufferLimitException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientRequestException;
import org.wodt.ambassador.config.DittoProperties;
import reactor.core.publisher.Mono;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.concurrent.TimeoutException;

@RestController
@RequestMapping("/api/digital-twins")
public class DigitalTwinController {

    private static final Logger LOGGER = LoggerFactory.getLogger(DigitalTwinController.class);
    private static final Set<String> HOP_BY_HOP_HEADERS = Set.of(
            "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
            "te", "trailer", "transfer-encoding", "upgrade"
    );

    private final WebClient webClient;
    private final DittoProperties properties;
    private final ObjectMapper objectMapper;
    private final GoalAgentUniquenessService goalAgentUniquenessService;

    public DigitalTwinController(WebClient dittoWebClient,
                                 DittoProperties properties,
                                 ObjectMapper objectMapper,
                                 GoalAgentUniquenessService goalAgentUniquenessService) {
        this.webClient = dittoWebClient;
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.goalAgentUniquenessService = goalAgentUniquenessService;
    }

    @GetMapping(path = "/goal-agent-availability", produces = MediaType.APPLICATION_JSON_VALUE)
    public Mono<ResponseEntity<GoalAgentAvailability>> getGoalAgentAvailability(
            @RequestParam String goalAgentId) {
        String normalizedGoalAgentId = goalAgentId.trim();
        if (normalizedGoalAgentId.isEmpty()) {
            return Mono.just(ResponseEntity.badRequest().build());
        }

        return goalAgentUniquenessService.findOwningThingId(normalizedGoalAgentId)
                .map(owner -> ResponseEntity.ok(new GoalAgentAvailability(
                        normalizedGoalAgentId,
                        owner.isEmpty(),
                        owner.orElse(null)
                )))
                .onErrorResume(error -> {
                    LOGGER.warn("Could not verify Goal Agent ID {}", normalizedGoalAgentId, error);
                    return Mono.just(ResponseEntity.status(upstreamFailureStatus(error)).build());
                });
    }

    @PutMapping(path = "/{thingId}", consumes = MediaType.APPLICATION_JSON_VALUE)
    public Mono<ResponseEntity<byte[]>> createDigitalTwin(@PathVariable String thingId,
                                                           @RequestBody byte[] payload) {
        long startedAt = System.nanoTime();

        String goalAgentId = extractGoalAgentId(payload);
        Mono<ResponseEntity<byte[]>> operation = goalAgentId == null
                ? createAtDitto(thingId, payload)
                : goalAgentUniquenessService.findOwningThingId(goalAgentId)
                        .flatMap(owner -> {
                            if (owner.isPresent()) {
                                String conflictingThingId = owner.get();
                                return Mono.just(jsonError(HttpStatus.CONFLICT, new ApiError(
                                        "GOAL_AGENT_ALREADY_EXISTS",
                                        "Goal Agent ID '" + goalAgentId + "' is already used by Digital Twin '"
                                                + conflictingThingId + "'.",
                                        thingId
                                )));
                            }
                            return createAtDitto(thingId, payload);
                        });

        return operation
                .onErrorResume(error -> mapUpstreamFailure(thingId, error))
                .doOnEach(signal -> {
                    if (signal.isOnNext()) {
                        long elapsedMs = (System.nanoTime() - startedAt) / 1_000_000;
                        LOGGER.info("Create digital twin {} -> {} ({} ms)", thingId,
                                signal.get().getStatusCode().value(), elapsedMs);
                    }
                });
    }

    private Mono<ResponseEntity<byte[]>> createAtDitto(String thingId, byte[] payload) {
        return webClient.put()
                .uri(uriBuilder -> uriBuilder.path("/api/2/things/{thingId}").build(thingId))
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON)
                .headers(headers -> {
                    DittoProperties.Account account = properties.credentials().regular();
                    headers.setBasicAuth(account.username(), account.password(), StandardCharsets.UTF_8);
                    headers.setIfNoneMatch("*");
                })
                .bodyValue(payload)
                .exchangeToMono(response -> response.bodyToMono(byte[].class)
                        .defaultIfEmpty(new byte[0])
                        .map(body -> mapDittoResponse(thingId, response.statusCode().value(),
                                response.headers().asHttpHeaders(), body)));
    }

    private String extractGoalAgentId(byte[] payload) {
        try {
            JsonNode root = objectMapper.readTree(payload);
            JsonNode goalAgentNode = root.path("attributes").path("goalAgentId");
            if (!goalAgentNode.isTextual()) {
                return null;
            }

            String goalAgentId = goalAgentNode.asText().trim();
            return goalAgentId.isEmpty() ? null : goalAgentId;
        } catch (RuntimeException error) {
            return null;
        }
    }

    private ResponseEntity<byte[]> mapDittoResponse(String thingId, int status,
                                                     HttpHeaders upstreamHeaders, byte[] body) {
        if (status == HttpStatus.PRECONDITION_FAILED.value()) {
            return jsonError(HttpStatus.CONFLICT, new ApiError(
                    "DIGITAL_TWIN_ALREADY_EXISTS",
                    "Digital Twin with thingId '" + thingId + "' already exists.",
                    thingId
            ));
        }

        HttpHeaders responseHeaders = new HttpHeaders();
        upstreamHeaders.forEach((name, values) -> {
            if (!HOP_BY_HOP_HEADERS.contains(name.toLowerCase())
                    && !name.equalsIgnoreCase(HttpHeaders.CONTENT_LENGTH)
                    && !name.toLowerCase().startsWith("access-control-")) {
                responseHeaders.put(name, values);
            }
        });
        return new ResponseEntity<>(body, responseHeaders, HttpStatus.valueOf(status));
    }

    private Mono<ResponseEntity<byte[]>> mapUpstreamFailure(String thingId, Throwable error) {
        if (error instanceof DataBufferLimitException) {
            return Mono.just(jsonError(HttpStatus.BAD_GATEWAY, new ApiError(
                    "DITTO_RESPONSE_TOO_LARGE", "Ditto returned a response that is too large.", thingId)));
        }

        HttpStatus status = upstreamFailureStatus(error);
        boolean timedOut = status == HttpStatus.GATEWAY_TIMEOUT;
        String code = timedOut ? "DITTO_TIMEOUT" : "DITTO_UNAVAILABLE";
        String message = timedOut ? "Ditto did not respond before the configured timeout."
                : "Could not connect to Ditto.";

        if (!(error instanceof WebClientRequestException)) {
            LOGGER.warn("Unexpected error while creating Digital Twin {}", thingId, error);
        }
        return Mono.just(jsonError(status, new ApiError(code, message, thingId)));
    }

    private HttpStatus upstreamFailureStatus(Throwable error) {
        boolean timedOut = hasCause(error, ReadTimeoutException.class)
                || hasCause(error, TimeoutException.class);
        return timedOut ? HttpStatus.GATEWAY_TIMEOUT : HttpStatus.BAD_GATEWAY;
    }

    private ResponseEntity<byte[]> jsonError(HttpStatus status, ApiError error) {
        try {
            return ResponseEntity.status(status)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(objectMapper.writeValueAsBytes(error));
        } catch (JacksonException exception) {
            return ResponseEntity.status(status)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(("{\"code\":\"" + error.code() + "\"}").getBytes(StandardCharsets.UTF_8));
        }
    }

    private boolean hasCause(Throwable error, Class<? extends Throwable> causeType) {
        Throwable current = error;
        while (current != null) {
            if (causeType.isInstance(current)) {
                return true;
            }
            current = current.getCause();
        }
        return false;
    }
}
