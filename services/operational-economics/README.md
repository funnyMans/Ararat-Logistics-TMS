# Operational Economics Service

The selected target boundary, source precedence, calculation ownership,
update lifecycle, persistence/read models, and async Dispatch exchange are
documented in
[`docs/trucking/OPERATIONAL_ECONOMICS_SERVICE.md`](../../docs/trucking/OPERATIONAL_ECONOMICS_SERVICE.md).
The target is for Economics to calculate independent Load,
power-unit/trailer, and driver/team estimates and refresh them when relevant
source/model revisions change. Dispatch Planning combines exact estimates,
calculates each Load/Trio contribution and matching index, and persists the
combined matrix.

## Current B4 scaffold

The package currently provides PostgreSQL persistence and an internal
HTTP API for versioned estimate artifacts. It does not calculate estimates,
ingest source changes, maintain the selected separate read models, or publish
RabbitMQ messages. The prototype persistence schema accepts Load and
candidate scopes; candidate-scope estimates are not the target ownership
model. Supporting independent equipment and driver/team records requires
forward-only schema and contract changes.

The current internal API stores preformed artifacts and is not the selected
production sharing path. The target async contract is in
[`docs/api/operational-economics.asyncapi.yaml`](../../docs/api/operational-economics.asyncapi.yaml).
Economics does not own source facts, HOS checks, Load/Trio matching,
reservations, or Assignment decisions.

## Scaffold estimate-record API

- `POST /internal/v1/estimate-records` stores an immutable v1 artifact.
- `GET /internal/v1/estimate-records/{estimateId}` retrieves an exact record.
- `GET /internal/v1/estimate-records?loadId={uuid}[&trioId={uuid}][&limit=100][&cursor={opaque}]`
  lists records for a Load, optionally narrowed to a Trio. The limit defaults
  to 100 and cannot exceed 100; when more results exist, the response includes
  `hasMore: true` and a `nextCursor` for the following page.
- `GET /health`, `GET /ready`, and `GET /metrics` expose liveness, readiness,
  and Prometheus-format process metrics.

The internal persistence API is not the final calculate-estimate API. It has
no application authentication yet and is intended only for trusted local
service-network use; production exposure is disabled pending authentication,
authorization, and deployment review.

## Local profile

The service uses a dedicated PostgreSQL database. The one-shot migration job
applies forward-only SQL under an advisory lock and checks checksums of applied
migrations. The runtime role can read and insert estimates but cannot update
or delete them or run DDL.

```sh
pnpm docker:economics:up
curl -fsS http://127.0.0.1:8087/health
curl -fsS http://127.0.0.1:8087/ready
pnpm docker:economics:logs
pnpm docker:economics:down
```

Local-only database passwords are configured in `.env.example`. They must not
be reused outside local development.

The opt-in PostgreSQL persistence test runs inside the local migration
container, which can reach the profile's database:

```sh
docker compose --profile operational-economics -f infra/docker-compose.dev.yml \
  run --rm --entrypoint pnpm operational-economics-migrate \
  run test:integration:economics
```
