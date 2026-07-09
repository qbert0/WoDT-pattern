package org.wodt.ambassador.gateway;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import org.wodt.ambassador.config.DittoProperties;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;

@Component
public class DittoAuthenticationFilter implements GlobalFilter, Ordered {

    private static final Logger LOGGER = LoggerFactory.getLogger(DittoAuthenticationFilter.class);
    private static final String DITTO_API_ROOT = "/api/2";
    private static final String CONNECTIONS_PREFIX = "/api/2/connections";

    private final DittoProperties properties;

    public DittoAuthenticationFilter(DittoProperties properties) {
        this.properties = properties;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String path = exchange.getRequest().getURI().getPath();
        if (!path.equals(DITTO_API_ROOT) && !path.startsWith(DITTO_API_ROOT + "/")) {
            return chain.filter(exchange);
        }

        DittoProperties.Account account = path.equals(CONNECTIONS_PREFIX)
                || path.startsWith(CONNECTIONS_PREFIX + "/")
                ? properties.credentials().devops()
                : properties.credentials().regular();

        ServerWebExchange authenticatedExchange = exchange.mutate()
                .request(request -> request.headers(headers -> {
                    headers.remove(HttpHeaders.AUTHORIZATION);
                    headers.setBasicAuth(account.username(), account.password(), StandardCharsets.UTF_8);
                }))
                .build();

        long startedAt = System.nanoTime();
        return chain.filter(authenticatedExchange)
                .doFinally(signal -> {
                    int status = authenticatedExchange.getResponse().getStatusCode() == null
                            ? 0
                            : authenticatedExchange.getResponse().getStatusCode().value();
                    long elapsedMs = (System.nanoTime() - startedAt) / 1_000_000;
                    LOGGER.info("Ditto proxy {} {} -> {} ({} ms)",
                            exchange.getRequest().getMethod(), path, status, elapsedMs);
                });
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE;
    }
}
