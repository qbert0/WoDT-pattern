package org.wodt.ambassador.api;

import io.netty.handler.timeout.ReadTimeoutException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.buffer.DataBufferLimitException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientRequestException;
import org.wodt.ambassador.config.DittoProperties;
import reactor.core.publisher.Mono;
import tools.jackson.core.JacksonException;
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

    public DigitalTwinController(WebClient dittoWebClient,
                                 DittoProperties properties,
                                 ObjectMapper objectMapper) {
        this.webClient = dittoWebClient;
        this.properties = properties;
        this.objectMapper = objectMapper;
    }

    @PutMapping(path = "/{thingId}", consumes = MediaType.APPLICATION_JSON_VALUE)
    public Mono<ResponseEntity<byte[]>> createDigitalTwin(@PathVariable String thingId,
                                                           @RequestBody byte[] payload) {
        long startedAt = System.nanoTime();

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
                                response.headers().asHttpHeaders(), body)))
                .onErrorResume(error -> mapUpstreamFailure(thingId, error))
                .doOnEach(signal -> {
                    if (signal.isOnNext()) {
                        long elapsedMs = (System.nanoTime() - startedAt) / 1_000_000;
                        LOGGER.info("Create digital twin {} -> {} ({} ms)", thingId,
                                signal.get().getStatusCode().value(), elapsedMs);
                    }
                });
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

        boolean timedOut = hasCause(error, ReadTimeoutException.class)
                || hasCause(error, TimeoutException.class);
        HttpStatus status = timedOut ? HttpStatus.GATEWAY_TIMEOUT : HttpStatus.BAD_GATEWAY;
        String code = timedOut ? "DITTO_TIMEOUT" : "DITTO_UNAVAILABLE";
        String message = timedOut ? "Ditto did not respond before the configured timeout."
                : "Could not connect to Ditto.";

        if (!(error instanceof WebClientRequestException)) {
            LOGGER.warn("Unexpected error while creating Digital Twin {}", thingId, error);
        }
        return Mono.just(jsonError(status, new ApiError(code, message, thingId)));
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
