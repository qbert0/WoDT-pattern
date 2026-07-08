package org.wodt.ambassador.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.time.Duration;

@Validated
@ConfigurationProperties(prefix = "ditto")
public record DittoProperties(
        @NotBlank String baseUrl,
        @Valid @NotNull Credentials credentials,
        @Valid @NotNull Timeouts timeouts
) {
    public record Credentials(
            @Valid @NotNull Account regular,
            @Valid @NotNull Account devops
    ) {
    }

    public record Account(
            @NotBlank String username,
            @NotBlank String password
    ) {
    }

    public record Timeouts(
            @NotNull Duration connect,
            @NotNull Duration response
    ) {
    }
}
