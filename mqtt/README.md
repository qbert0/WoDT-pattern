# Local MQTT broker

Eclipse Mosquitto for local development. It runs on the shared `wodt` Docker
network so the Ditto `connectivity` service can reach it as
`tcp://mosquitto:1883`, while host tools and simulators use
`mqtt://localhost:1883`.

## Start / stop

```bash
docker network create wodt   # once; shared with ditto/ and ditto-ambassador

docker compose -f mqtt/docker-compose.yml up -d
docker compose -f mqtt/docker-compose.yml down
```

## Configuration

`config/mosquitto.conf` enables a plain listener on `1883` with
`allow_anonymous true` and persistence disabled. This is for local development
only — do not expose it on an untrusted network.

## Connect Ditto to the broker

`ditto_connection.json` is a Ditto MQTT connection that subscribes to the
device/simulator topics and forwards live messages. Create it once Ditto is up:

```bash
curl --fail-with-body \
  -u devops:foobar \
  -X POST \
  -H 'Content-Type: application/json' \
  --data @mqtt/ditto_connection.json \
  http://localhost:8080/api/2/connections
```

Check it:

```bash
CONNECTION_ID=$(curl -s -u devops:foobar http://localhost:8080/api/2/connections \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["connectionIds"][0])')
curl --fail -u devops:foobar \
  "http://localhost:8080/api/2/connections/$CONNECTION_ID/status"
```

A healthy connection reports `connectionStatus` and `liveStatus` as `open`.
