package org.wodt.ambassador;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.reactive.server.WebTestClient;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class AmbassadorIntegrationTest {

    private static final AtomicReference<ExchangeHandler> HANDLER = new AtomicReference<>();
    private static final HttpServer DITTO = startDittoServer();
    private static final String REGULAR_AUTH = basicAuth("ditto-user", "ditto-pass");
    private static final String DEVOPS_AUTH = basicAuth("devops-user", "devops-pass");

    @LocalServerPort
    int port;

    WebTestClient client;

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("ditto.base-url", () -> "http://localhost:" + DITTO.getAddress().getPort());
        registry.add("ditto.credentials.regular.username", () -> "ditto-user");
        registry.add("ditto.credentials.regular.password", () -> "ditto-pass");
        registry.add("ditto.credentials.devops.username", () -> "devops-user");
        registry.add("ditto.credentials.devops.password", () -> "devops-pass");
        registry.add("ditto.timeouts.connect", () -> "1s");
        registry.add("ditto.timeouts.response", () -> "2s");
        registry.add("spring.cloud.gateway.server.webflux.httpclient.connect-timeout", () -> "1000");
        registry.add("spring.cloud.gateway.server.webflux.httpclient.response-timeout", () -> "2s");
    }

    @BeforeEach
    void resetHandler() {
        client = WebTestClient.bindToServer()
                .baseUrl("http://localhost:" + port)
                .responseTimeout(Duration.ofSeconds(5))
                .build();
        HANDLER.set(exchange -> respond(exchange, 404, "{}"));
    }

    @AfterAll
    static void stopServer() {
        DITTO.stop(0);
    }

    @Test
    void createsThingWithAtomicPreconditionAndBackendCredentials() {
        HANDLER.set(exchange -> {
            assertThat(exchange.getRequestURI().getPath()).isEqualTo("/api/2/things/org.example:machine-1");
            assertThat(exchange.getRequestHeaders().getFirst("If-None-Match")).isEqualTo("*");
            assertThat(exchange.getRequestHeaders().getFirst(HttpHeaders.AUTHORIZATION)).isEqualTo(REGULAR_AUTH);
            assertThat(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8))
                    .contains("org.example:policy");
            exchange.getResponseHeaders().add(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE);
            exchange.getResponseHeaders().add(HttpHeaders.ETAG, "\"rev:1\"");
            respond(exchange, 201, "{\"thingId\":\"org.example:machine-1\"}");
        });

        client.put()
                .uri("/api/digital-twins/org.example:machine-1")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue("{\"policyId\":\"org.example:policy\"}")
                .exchange()
                .expectStatus().isCreated()
                .expectHeader().valueEquals(HttpHeaders.ETAG, "\"rev:1\"")
                .expectBody()
                .jsonPath("$.thingId").isEqualTo("org.example:machine-1");
    }

    @Test
    void reportsGoalAgentAvailabilityFromDittoSearch() {
        HANDLER.set(exchange -> {
            assertThat(exchange.getRequestURI().getPath()).isEqualTo("/api/2/search/things");
            assertThat(URLDecoder.decode(exchange.getRequestURI().getRawQuery(), StandardCharsets.UTF_8))
                    .contains("filter=eq(attributes/goalAgentId,\"G_USED\")")
                    .contains("option=size(1)");
            assertThat(exchange.getRequestHeaders().getFirst(HttpHeaders.AUTHORIZATION)).isEqualTo(REGULAR_AUTH);
            exchange.getResponseHeaders().add(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE);
            respond(exchange, 200, "{\"items\":[{\"thingId\":\"smart-home:grinder\"}]}");
        });

        client.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/api/digital-twins/goal-agent-availability")
                        .queryParam("goalAgentId", " G_USED ")
                        .build())
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.goalAgentId").isEqualTo("G_USED")
                .jsonPath("$.available").isEqualTo(false)
                .jsonPath("$.conflictingThingId").isEqualTo("smart-home:grinder");
    }

    @Test
    void rejectsCreateWhenGoalAgentIdAlreadyExists() {
        AtomicBoolean putAttempted = new AtomicBoolean();
        HANDLER.set(exchange -> {
            if (exchange.getRequestURI().getPath().equals("/api/2/search/things")) {
                exchange.getResponseHeaders().add(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE);
                respond(exchange, 200, "{\"items\":[{\"thingId\":\"smart-home:grinder\"}]}");
                return;
            }
            putAttempted.set(true);
            respond(exchange, 201, "{}");
        });

        client.put()
                .uri("/api/digital-twins/smart-home:parent")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue("{\"attributes\":{\"goalAgentId\":\"G_USED\"}}")
                .exchange()
                .expectStatus().isEqualTo(409)
                .expectBody()
                .jsonPath("$.code").isEqualTo("GOAL_AGENT_ALREADY_EXISTS")
                .jsonPath("$.message").value(message -> assertThat(message.toString())
                        .contains("smart-home:grinder"));

        assertThat(putAttempted).isFalse();
    }

    @Test
    void createsThingWhenGoalAgentIdIsAvailable() {
        AtomicInteger requestCount = new AtomicInteger();
        HANDLER.set(exchange -> {
            requestCount.incrementAndGet();
            if (exchange.getRequestURI().getPath().equals("/api/2/search/things")) {
                exchange.getResponseHeaders().add(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE);
                respond(exchange, 200, "{\"items\":[]}");
                return;
            }

            assertThat(exchange.getRequestURI().getPath()).isEqualTo("/api/2/things/smart-home:parent");
            assertThat(exchange.getRequestHeaders().getFirst("If-None-Match")).isEqualTo("*");
            respond(exchange, 201, "{}");
        });

        client.put()
                .uri("/api/digital-twins/smart-home:parent")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue("{\"attributes\":{\"goalAgentId\":\"G_AVAILABLE\"}}")
                .exchange()
                .expectStatus().isCreated();

        assertThat(requestCount).hasValue(2);
    }

    @Test
    void refusesCreateWhenGoalAgentUniquenessCannotBeVerified() {
        HANDLER.set(exchange -> respond(exchange, 503, "{\"status\":503}"));

        client.put()
                .uri("/api/digital-twins/smart-home:parent")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue("{\"attributes\":{\"goalAgentId\":\"G_UNVERIFIED\"}}")
                .exchange()
                .expectStatus().isEqualTo(502)
                .expectBody()
                .jsonPath("$.code").isEqualTo("DITTO_UNAVAILABLE");
    }

    @Test
    void mapsExistingThingToConflict() {
        HANDLER.set(exchange -> respond(exchange, 412, "{\"status\":412}"));

        client.put()
                .uri("/api/digital-twins/org.example:existing")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue("{}")
                .exchange()
                .expectStatus().isEqualTo(409)
                .expectBody()
                .jsonPath("$.code").isEqualTo("DIGITAL_TWIN_ALREADY_EXISTS")
                .jsonPath("$.thingId").isEqualTo("org.example:existing");
    }

    @Test
    void forwardsRegularApiAndReplacesInboundAuthorization() {
        HANDLER.set(exchange -> {
            assertThat(exchange.getRequestMethod()).isEqualTo("PATCH");
            assertThat(exchange.getRequestURI().toString()).isEqualTo("/api/2/things/org.example:one?condition=eq(attributes/x,1)");
            assertThat(exchange.getRequestHeaders().getFirst(HttpHeaders.AUTHORIZATION)).isEqualTo(REGULAR_AUTH);
            assertThat(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8)).isEqualTo("{\"x\":2}");
            respond(exchange, 204, "");
        });

        client.patch()
                .uri("/api/2/things/org.example:one?condition=eq(attributes/x,1)")
                .header(HttpHeaders.AUTHORIZATION, "Bearer must-not-reach-ditto")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue("{\"x\":2}")
                .exchange()
                .expectStatus().isNoContent();
    }

    @Test
    void usesDevopsCredentialsForConnections() {
        HANDLER.set(exchange -> {
            assertThat(exchange.getRequestHeaders().getFirst(HttpHeaders.AUTHORIZATION)).isEqualTo(DEVOPS_AUTH);
            respond(exchange, 200, "[]");
        });

        client.get().uri("/api/2/connections")
                .exchange()
                .expectStatus().isOk()
                .expectBody().json("[]");
    }

    @Test
    void concurrentCreatesAllowOnlyOneWinnerWhenDittoEnforcesThePrecondition() {
        AtomicBoolean created = new AtomicBoolean();
        HANDLER.set(exchange -> {
            assertThat(exchange.getRequestHeaders().getFirst("If-None-Match")).isEqualTo("*");
            if (created.compareAndSet(false, true)) {
                respond(exchange, 201, "{}");
            } else {
                respond(exchange, 412, "{}");
            }
        });

        CompletableFuture<Integer> first = createConcurrently();
        CompletableFuture<Integer> second = createConcurrently();

        assertThat(CompletableFuture.allOf(first, second).thenApply(ignored ->
                        java.util.List.of(first.join(), second.join())).join())
                .containsExactlyInAnyOrder(201, 409);
    }

    @Test
    void returnsGatewayTimeoutWhenDittoDoesNotRespondInTime() throws InterruptedException {
        CountDownLatch upstreamFinished = new CountDownLatch(1);
        HANDLER.set(exchange -> {
            try {
                Thread.sleep(2_300);
            } finally {
                upstreamFinished.countDown();
            }
        });

        client.put()
                .uri("/api/digital-twins/org.example:slow")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue("{}")
                .exchange()
                .expectStatus().isEqualTo(504)
                .expectBody()
                .jsonPath("$.code").isEqualTo("DITTO_TIMEOUT");

        assertThat(upstreamFinished.await(1, TimeUnit.SECONDS)).isTrue();
    }

    @Test
    void acceptsCorsPreflightFromConfiguredClientOrigin() {
        client.options()
                .uri("/api/2/things")
                .header(HttpHeaders.ORIGIN, "http://localhost:5173")
                .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "GET")
                .exchange()
                .expectStatus().isOk()
                .expectHeader().valueEquals(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN,
                        "http://localhost:5173");
    }

    @Test
    void acceptsCorsPreflightForCreateEndpoint() {
        client.options()
                .uri("/api/digital-twins/org.example:one")
                .header(HttpHeaders.ORIGIN, "http://localhost:5173")
                .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "PUT")
                .header(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "content-type")
                .exchange()
                .expectStatus().isOk()
                .expectHeader().valueEquals(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN,
                        "http://localhost:5173")
                .expectHeader().valueMatches(HttpHeaders.ACCESS_CONTROL_ALLOW_METHODS,
                        ".*PUT.*");
    }

    @Test
    void returnsOnlyAmbassadorCorsHeadersFromCreateEndpoint() {
        HANDLER.set(exchange -> {
            exchange.getResponseHeaders().add(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN,
                    "http://localhost:5173");
            respond(exchange, 201, "{}");
        });

        client.put()
                .uri("/api/digital-twins/org.example:cors")
                .header(HttpHeaders.ORIGIN, "http://localhost:5173")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue("{}")
                .exchange()
                .expectStatus().isCreated()
                .expectHeader().valueEquals(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN,
                        "http://localhost:5173");
    }

    private CompletableFuture<Integer> createConcurrently() {
        return CompletableFuture.supplyAsync(() -> client.put()
                .uri("/api/digital-twins/org.example:concurrent")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue("{}")
                .exchange()
                .returnResult(byte[].class)
                .getStatus()
                .value());
    }

    private static HttpServer startDittoServer() {
        try {
            HttpServer server = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
            server.createContext("/", exchange -> {
                try {
                    HANDLER.get().handle(exchange);
                } catch (AssertionError | Exception error) {
                    error.printStackTrace();
                    respond(exchange, 500, "{\"error\":\"test handler failed\"}");
                } finally {
                    exchange.close();
                }
            });
            server.start();
            return server;
        } catch (IOException error) {
            throw new IllegalStateException("Could not start mock Ditto server", error);
        }
    }

    private static String basicAuth(String username, String password) {
        String value = username + ":" + password;
        return "Basic " + Base64.getEncoder().encodeToString(value.getBytes(StandardCharsets.UTF_8));
    }

    private static void respond(HttpExchange exchange, int status, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        if (status == 204) {
            exchange.sendResponseHeaders(status, -1);
        } else {
            exchange.sendResponseHeaders(status, bytes.length);
            exchange.getResponseBody().write(bytes);
        }
    }

    @FunctionalInterface
    private interface ExchangeHandler {
        void handle(HttpExchange exchange) throws Exception;
    }
}
