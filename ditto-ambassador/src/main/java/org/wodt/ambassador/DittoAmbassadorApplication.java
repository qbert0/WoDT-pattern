package org.wodt.ambassador;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class DittoAmbassadorApplication {

    public static void main(String[] args) {
        SpringApplication.run(DittoAmbassadorApplication.class, args);
    }
}
