package org.wodt.ambassador.config;

import io.netty.channel.ChannelOption;
import org.springframework.cloud.gateway.route.RouteLocator;
import org.springframework.cloud.gateway.route.builder.RouteLocatorBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.netty.http.client.HttpClient;

@Configuration
public class GatewayConfiguration {

        @Bean
        RouteLocator dittoRoutes(RouteLocatorBuilder builder, DittoProperties properties) {
        return builder.routes()
                .route("ditto-api", route -> route.path("/api/2/**")
                        .filters(filters -> filters.dedupeResponseHeader(
                                "Access-Control-Allow-Origin " +
                                "Access-Control-Allow-Credentials " +
                                "Access-Control-Expose-Headers",
                                "RETAIN_FIRST"
                        ))
                        .uri(properties.baseUrl()))
                .build();
        }

        @Bean
        WebClient dittoWebClient(DittoProperties properties) {
        HttpClient httpClient = HttpClient.create()
                .option(ChannelOption.CONNECT_TIMEOUT_MILLIS,
                        Math.toIntExact(properties.timeouts().connect().toMillis()))
                .responseTimeout(properties.timeouts().response());

        return WebClient.builder()
                .baseUrl(properties.baseUrl())
                .clientConnector(new ReactorClientHttpConnector(httpClient))
                .build();
        }
}
