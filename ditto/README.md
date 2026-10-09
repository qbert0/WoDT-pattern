# Ditto

Local Eclipse Ditto deployment.

- `docker/` — the official Eclipse Ditto Docker deployment (`docker-compose.yml`,
  nginx config, basic-auth files). It was adapted for this repo:
  - a **persistent named volume** `ditto_mongodb_data` is mounted at Mongo's
    `/data/db`, so Digital Twins and policies survive restarts;
  - the stack joins the shared external Docker network **`wodt`** so
    `mqtt/` and `ditto-ambassador/` can reach it by service name;
  - the gateway's direct published port was moved to **8082** (the public HTTP
    API is served by nginx on **8080**); 8081 is used by `ditto-ambassador`.

> The Docker Hub repo `eclipse/ditto` is the **Helm chart**, not a runnable
> image. `docker/` uses the individual runtime images, which for the current
> release are tagged **`3.9`** (`docker/.env` pins `DITTO_VERSION=3.9`).

## Start / stop

```bash
docker network create wodt   # once; shared with mqtt/ and ditto-ambassador/

cd ditto/docker
docker compose up -d
docker compose ps
docker compose down          # data stays in the ditto_mongodb_data volume
```

First start takes 1–2 minutes while the JVMs form the cluster.

## Endpoints

| Purpose | URL | Credentials |
| --- | --- | --- |
| HTTP API (via nginx) | `http://localhost:8080/api/2` | `ditto` / `ditto` |
| Connections (DevOps) | `http://localhost:8080/api/2/connections` | `devops` / `foobar` |
| Health | `http://localhost:8080/health` | none |
| Direct gateway | `http://localhost:8082` | (pre-auth header required) |

```bash
curl --fail -u ditto:ditto http://localhost:8080/api/2/things
curl --fail http://localhost:8080/health
```

Other containers reach Ditto at `http://nginx/api/2` (used by
`ditto-ambassador/.env`).
