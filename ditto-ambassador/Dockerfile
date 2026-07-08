FROM maven:3.9.11-eclipse-temurin-21 AS build

WORKDIR /workspace
COPY pom.xml .
RUN mvn -B -DskipTests dependency:resolve
COPY src ./src
RUN mvn -B package -DskipTests

FROM eclipse-temurin:21-jre-noble

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system ambassador \
    && useradd --system --gid ambassador --home-dir /app ambassador

WORKDIR /app
COPY --from=build /workspace/target/ditto-ambassador-*.jar app.jar

USER ambassador
EXPOSE 8081

HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=4 \
    CMD curl --fail --silent http://localhost:8081/actuator/health >/dev/null || exit 1

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
