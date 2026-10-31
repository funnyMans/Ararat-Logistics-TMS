# Local development environment

The current Compose environment contains the API gateway, local observability
services, loopback-only PostgreSQL, RabbitMQ, and NATS services reserved for
foundation conformance tests, and a test-only Temporal server with a separate
persistent PostgreSQL service. Neither PostgreSQL instance has TMS business
schemas or serves as an application datastore; RabbitMQ and NATS are not
application brokers. NATS is disposable secondary fan-out with no persistent
messages. The planned Identity service and TMS business services are not
included. The gateway currently serves health, readiness, and metrics only.

See the [documentation guide](../docs/README.md) for the distinction between
the product target and implemented repository capabilities.

## Start and inspect

From the repository root:

```sh
cp -n .env.example .env
pnpm install --frozen-lockfile
pnpm build
docker compose -f infra/docker-compose.dev.yml up -d --build
```

The commands above use host-side Node.js/pnpm for dependency installation
and workspace builds; Compose builds and runs the gateway in a separate
container image with its own Node.js/pnpm installation. If you only need the
running containers, the host dependencies are not needed for application
runtime, but are required for host-side linting, tests, and workspace scripts.

The gateway is available at `http://localhost:3000`; the local Nginx entry
point is `http://localhost:8080`. Grafana is at `http://localhost:3005` and
Prometheus at `http://localhost:9090`. The conformance-only PostgreSQL
instance binds to `127.0.0.1:5432` and persists in the `postgres-data` named
volume. Test-only RabbitMQ binds AMQP to `127.0.0.1:5672` and its management
interface to `127.0.0.1:15672`; broker state persists in the `rabbitmq-data`
named volume. Test-only NATS binds clients to `127.0.0.1:4222` and its
monitoring endpoint to `127.0.0.1:8222`; it has no JetStream, persistent
volume, or authoritative state. Its `/healthz` endpoint is available only on
the loopback-published monitoring port. RabbitMQ's development-only
credentials are `foundation_test` / `foundation_test`. Published ports bind
to loopback.
If a host port is occupied, set `API_GATEWAY_HOST_PORT`, `NGINX_HOST_PORT`,
`PROMETHEUS_HOST_PORT`, `GRAFANA_HOST_PORT`, `POSTGRES_HOST_PORT`,
`RABBITMQ_HOST_PORT`, `RABBITMQ_MANAGEMENT_HOST_PORT`, `NATS_HOST_PORT`, or
`NATS_MONITOR_HOST_PORT` in `.env` to an available port; the container ports
and internal service routing do not change.
The gateway's `/health` endpoint reports process/dependency health while
`/ready` returns `503` until startup completes and after graceful shutdown
begins.

```sh
pnpm docker:status
pnpm docker:health
pnpm docker:logs
pnpm docker:down
```

`pnpm docker:postgres:up` starts only the conformance database, and
`pnpm docker:postgres:down` stops it without deleting its data. Run
`pnpm test:integration:postgres` while it is running to verify committed
conformance state survives separate client processes and a PostgreSQL
container restart. `pnpm docker:rabbitmq:up` and
`pnpm docker:rabbitmq:down` start and stop only the conformance broker. Run
`pnpm test:integration:messaging` with both services running to exercise the
test-only outbox, durable routing and queue recovery, confirmed mandatory-route
handling (including parking an unroutable outbox row), and duplicate-safe inbox
handling across broker restarts.
`pnpm docker:temporal:up` starts Temporal and its isolated PostgreSQL backing
service. Temporal uses the local-only credentials `temporal_test` /
`temporal_test`, publishes its frontend only on `127.0.0.1:7233` by default,
and stores persistence in the separate `temporal-postgres-data` volume. Set
`TEMPORAL_HOST_PORT` if that loopback port is occupied. Run
`pnpm test:integration:temporal` while it is running to verify a test-only
workflow resumes on a replacement worker. `pnpm docker:temporal:down` stops
only Temporal and its dedicated PostgreSQL service.
`pnpm docker:nats:up` and `pnpm docker:nats:down` start and stop only the
ephemeral NATS service. Run `pnpm test:integration:nats` with the conformance
PostgreSQL and NATS services available to verify a committed test-only fact
survives a real NATS outage.
After NATS recovers, the test manually reads that PostgreSQL fact and
republishes a message to a subscriber. This is a conformance demonstration,
not an automatic replay worker. The test also checks a single causal trace
across its PostgreSQL/NATS stages and propagated gateway request, the
correlated structured log, and exact before/after Prometheus request counter
and duration histogram values. It stops and restarts only NATS, restores it
when the test exits, and removes only its own conformance row. Do not run this
deliberate outage test in parallel with another NATS conformance test or a
consumer using the local broker.
`pnpm test:integration:foundation-recovery` runs the F5 transaction-failure
and backup/restore drills against PostgreSQL. It creates uniquely named,
test-only schemas and a uniquely named temporary restore database, then
removes those artifacts without changing existing conformance data.

`pnpm docker:down` preserves the named observability and PostgreSQL volumes.
Removing local data is destructive. To reset only PostgreSQL, stop and remove
its container, then remove its named volume explicitly:

```sh
pnpm docker:postgres:down
docker compose -f infra/docker-compose.dev.yml rm -sf postgres
docker volume rm tms-local_postgres-data
pnpm docker:postgres:up
```

To reset only RabbitMQ, stop and remove its container, then remove its named
volume explicitly:

```sh
pnpm docker:rabbitmq:down
docker compose -f infra/docker-compose.dev.yml rm -sf rabbitmq
docker volume rm tms-local_rabbitmq-data
pnpm docker:rabbitmq:up
```

NATS has no persistent volume or authoritative state. To reset its volatile
connections/subscriptions, restart only that service:

```sh
pnpm docker:nats:down
pnpm docker:nats:up
```

Committed PostgreSQL conformance facts remain available for replay. Do not
reset PostgreSQL to clear or recover the NATS projection.

Use `docker compose -f infra/docker-compose.dev.yml down --volumes` only when
you intend to remove all local named data, not as routine cleanup.

## Boundaries

- The PostgreSQL instance and `foundation_conformance` schema are test-only.
  No business or shared product schema is present. Introduce a service-owned
  datastore only with an approved product workflow and explicit ownership.
- RabbitMQ is test-only. Its durable `foundation.conformance` exchange,
  versioned conformance route, queue, outbox, inbox, and side-effect table are
  created only by the gated integration test; no application/business message
  routes, domain events, or production messaging framework are present.
- The RabbitMQ default credentials and ports are for local development only.
  Do not expose the broker or reuse its credentials in a deployed environment.
- NATS uses core, non-persistent publish/subscribe only. The test-only
  `foundation.conformance.fanout.*` subject carries a best-effort message
  derived from `foundation_conformance.fanout_facts`; PostgreSQL remains the
  source of truth. The test manually republishes from the fact after NATS
  restart; there is no automated rebuild/replay worker. NATS has no
  application/business routes, JetStream, or persistent volume. Its
  unauthenticated client and monitoring ports are loopback-published for local
  development only.
- The planned Identity service, authentication, account lifecycle, and
  authorization are not implemented. The current environment has no account
  provisioning operation.
- Prometheus scrapes the gateway and local observability components;
  OpenTelemetry exports traces to local Tempo.
- Local observability is diagnostic, not durable business history or a
  production monitoring design.
- Local configuration and credentials are for development only. Never
  expose this stack or reuse local defaults in a deployed environment.

## F0 runtime baseline

F0 is verified. The gateway reports `/ready` as unavailable before startup
completes and after graceful shutdown begins; it becomes ready after the
listener starts accepting work. `/health` remains a liveness/health report
and does not fail solely because a dependency is degraded. The gateway has no
application dependencies in the current health-only implementation.

Verified in the working tree on 2026-10-28:

- In an isolated Git worktree with the current change set applied: `pnpm install --frozen-lockfile` — passed; `pnpm build` — passed; `pnpm lint` — passed; `pnpm test` — 22 tests passed; `pnpm test:all` — 22 tests passed and 1 environment-gated E2E smoke test skipped.
- `docker compose -f infra/docker-compose.dev.yml config --quiet` — passed.
- Because another local stack already occupied port 3000, the full environment was started with documented loopback overrides: `API_GATEWAY_HOST_PORT=13000 NGINX_HOST_PORT=18080 PROMETHEUS_HOST_PORT=19090 GRAFANA_HOST_PORT=13005 docker compose -f infra/docker-compose.dev.yml up -d --build` — passed; gateway and Nginx became healthy.
- `API_GATEWAY_HOST_PORT=13000 NGINX_HOST_PORT=18080 pnpm docker:health` — passed; health status was `ok` and readiness was `true`.
- `curl -fsS http://127.0.0.1:19090/-/ready` and `curl -fsS http://127.0.0.1:13005/api/health` — passed; Prometheus reported ready and Grafana reported database `ok`.
- `docker compose -f infra/docker-compose.dev.yml stop --timeout 30 api-gateway` — exited with code `0`; `docker compose -f infra/docker-compose.dev.yml start api-gateway` — passed; the gateway returned to ready.
- The Compose stack was left running with the loopback overrides above. Defaults remain unchanged for hosts where those ports are available.

## F1 isolated persistence conformance

F1 is verified. The `postgres` service uses a dedicated `foundation_conformance`
database, loopback-only host publishing, a health check, and the persistent
`postgres-data` volume. The integration test creates only the
`foundation_conformance.restart_probe` table, commits a probe value, restarts
the PostgreSQL container, and reads the committed value from a new `psql`
process. The probe row is removed after a successful test. No TMS business
schema or shared application database is created.

Verified in the working tree on 2026-10-28:

- `docker compose -f infra/docker-compose.dev.yml config --quiet` — passed.
- `pnpm docker:postgres:up` — passed; Compose reported `healthy` and published
  PostgreSQL only on `127.0.0.1:5432`.
- `pnpm test:integration:postgres` — passed; 1 integration test verified
  committed state after a PostgreSQL container restart.
- `pnpm test:all` — passed; 22 tests passed and 2 environment-gated tests
  skipped (the PostgreSQL integration test and gateway E2E smoke test).
- `pnpm build`, `pnpm lint`, formatting checks for supported file types, and
  `git diff --check` — passed.

The local PostgreSQL service and named volume were left running/preserved.
F4–F5 fan-out observability, failure-injection, and backup/restore evidence
remain separate milestones.

## F2 durable messaging conformance

F2 is verified as test infrastructure only. The local `rabbitmq` service
publishes AMQP and the management interface on explicit loopback host bindings,
has a broker health check, and persists broker data in `rabbitmq-data`. The
gated integration test creates only `foundation_conformance.messaging_*`
tables and a uniquely named durable queue bound to the durable
`foundation.conformance` topic exchange with the major-version route
`foundation.conformance.probe.v1`. It commits an outbox row before restarting
RabbitMQ, then reads that committed row and publishes it with mandatory routing,
persistent delivery, and publisher confirms. It also confirms and parks an
unroutable outbox row with a topology error. A second broker restart proves
that the unconsumed durable queue delivery survives restart. The test consumer
commits the inbox record and test side effect in one PostgreSQL transaction,
checks the committed rows before issuing broker ack, and republishes the same
message ID to prove that the side effect is not repeated.

Verified in the working tree on 2026-10-28:

- `docker compose -f infra/docker-compose.dev.yml config --quiet` — passed.
- `pnpm docker:rabbitmq:up` — passed; RabbitMQ reported healthy and published
  only on `127.0.0.1:5672` and `127.0.0.1:15672`.
- `pnpm test:integration:messaging` — passed; 1 integration test verified
  committed outbox publication after restart, durable delivery across another
  broker restart, inbox/side-effect commit before ack, and duplicate-ID
  idempotency.
- `pnpm test:integration:postgres` — passed; the existing F1 restart test
  remained intact.
- `pnpm test:all` — passed; 22 tests passed and 3 environment-gated tests
  skipped (PostgreSQL integration, RabbitMQ integration, and gateway E2E).
- `pnpm build` and `pnpm lint` — passed.
- `pnpm exec prettier --check infra/tests/integration/rabbitmq-messaging.test.ts infra/docker-compose.dev.yml infra/README.md docs/maps/runtime/README.md docs/trucking/TMS_SYSTEM_BLUEPRINT.md package.json` — passed.
- `pnpm exec tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --esModuleInterop --skipLibCheck --strict --types node infra/tests/integration/rabbitmq-messaging.test.ts` — passed.
- `git diff --check` — passed.

RabbitMQ and PostgreSQL are local development dependencies; their named volumes
are preserved. This conformance milestone does not implement production
outbox/inbox workers, retries, business message contracts, or product routes.
F4–F5 remain future milestones.

## F3 persistent workflow recovery

F3 is verified as test infrastructure only. Compose runs the pinned
`temporalio/auto-setup:1.27.2` server with the pinned `postgres:16-alpine`
image in a dedicated `temporal-postgres` service. That service has its own
`temporal-postgres-data` named volume and local-only `temporal_test` /
`temporal_test` credentials; it does not share the F1/F2 `postgres` container,
database, or `foundation_conformance` tables. The server persists workflow
history and timers in PostgreSQL. No TMS business workflow, business record,
route, or service is implemented.

The gated integration test uses a unique workflow ID per test run and a stable
task queue, so concurrent invocations do not terminate or reuse one another's
workflow executions. It starts a test-only workflow, waits until its persisted
progress reaches a timer wait, shuts down and joins the first worker, then
starts a replacement worker. The replacement worker executes the workflow's
completion activity; the test asserts the final workflow state and the
replacement worker identity. SDK connections and both workers are closed by
the test. If a run fails, cleanup terminates only the workflow referenced by
that test's handle.

Verified in the working tree on 2026-10-28:

- `docker compose -f infra/docker-compose.dev.yml config --quiet` — passed.
- `pnpm docker:temporal:up` — passed; the dedicated PostgreSQL service became
  healthy and Temporal started on the loopback binding.
- `pnpm test:integration:temporal` — passed twice; 1 integration test passed
  on each run, confirming persisted workflow recovery after worker restart and
  the expected completed state.
- `pnpm exec eslint --no-warn-ignored infra/tests/integration/temporal/*.ts infra/tests/integration/temporal-workflow-recovery.test.ts --max-warnings 0` — passed.
- `pnpm exec tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --types node --esModuleInterop --strict --skipLibCheck infra/tests/integration/temporal/conformance-workflow.ts infra/tests/integration/temporal-workflow-recovery.test.ts` — passed.

The local Temporal service and its named volume are preserved. To reset only
its persistence, stop and remove the Temporal containers and only its volume:

```sh
pnpm docker:temporal:down
docker compose -f infra/docker-compose.dev.yml rm -sf temporal temporal-postgres
docker volume rm tms-local_temporal-postgres-data
pnpm docker:temporal:up
```

Do not remove the shared Compose volumes as a routine test cleanup.

## F4 secondary fan-out and correlated observability

F4 is verified as test infrastructure only. Compose adds
the pinned `nats:2.10.24-alpine` core NATS server with loopback-only client and
monitoring ports, health checks, and no data volume or JetStream. The integration test
commits a uniquely identified fact in `foundation_conformance.fanout_facts`,
confirms best-effort live fan-out, stops NATS, verifies the monitoring and
client endpoints fail while gateway readiness and the committed PostgreSQL
fact remain available, then restarts NATS and manually republishes one message
assembled from that committed fact. No general replay helper or automatic
replay worker is implemented. The test leaves NATS running and removes only
its own fact.

The test constructs one root trace and child spans for its PostgreSQL commit,
gateway health request and metric probe, Prometheus assertion, NATS publish,
outage, restart, and manual replay. It exports the test spans to the existing
OTel Collector, propagates the metric-probe span's `traceparent` and the same
correlation ID to the gateway, and verifies the gateway server span's parent
in the Tempo response for that exact trace ID. The test snapshots the static
Prometheus `api_gateway_http_requests_total` counter and
`api_gateway_http_request_duration_ms_count` histogram before the correlated
`POST /health` (expected 404, intentionally unmatched) metric probe and
requires each to increase by exactly one. This series is separate from the
periodic gateway/Nginx health checks. Metric labels are limited to static
`method`, `route`, and `status_code`, plus fixed Prometheus scrape-target
`job` and `instance`; correlation IDs occur only in logs, trace attributes,
and test-only fan-out messages, never metric labels. Metrics, logs, and traces
remain diagnostic and are not business history.

The implementation passed both spec-compliance and code-quality review.
The cleanup path was also checked with an intentional test failure immediately
after stopping NATS; the test reported the injected failure, restarted NATS,
waited for its health check, and preserved the original test failure. NATS was
healthy after the recovery check.

Verified in the working tree on 2026-10-28:

- `docker compose -f infra/docker-compose.dev.yml config --quiet` — passed.
- `pnpm docker:nats:up` — passed; NATS reported healthy and published only on
  `127.0.0.1:4222` and `127.0.0.1:8222`.
- `pnpm test:integration:nats` — passed; the integration test verified one
  trace ID with the test stages and parent-linked gateway spans, exact
  before/after increments on two bounded metric series, a real NATS outage,
  retained PostgreSQL fact, and manual replay after recovery, including after
  the NATS cleanup correction.
- `NATS_RECOVERY_TEST_FAILURE=1 pnpm test:integration:nats` — failed as
  intentionally injected after beginning the outage; cleanup restarted NATS
  and waited for health. `curl -fsS http://127.0.0.1:8222/healthz` returned
  `{"status":"ok"}` and Compose reported NATS healthy.
- `pnpm exec tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --types node --esModuleInterop --strict --skipLibCheck infra/tests/integration/nats-fanout-observability.test.ts` — passed.
- `pnpm build` — passed.
- `pnpm lint` — passed.
- `pnpm test:all` — passed; 22 passed, 5 environment-gated tests skipped.
- `pnpm exec prettier --check infra/tests/integration/nats-fanout-observability.test.ts infra/docker-compose.dev.yml infra/README.md docs/maps/runtime/README.md docs/trucking/TMS_SYSTEM_BLUEPRINT.md package.json` — passed.
- `docker compose -f infra/docker-compose.dev.yml config --quiet` and
  `git diff --check` — passed.

The NATS service is left running. No named volume was removed or reset.

## F5 foundation recovery and acceptance (verified)

F5 adds a deterministic transaction-failure check and a real PostgreSQL
backup/restore drill. The transaction test injects a deferred unique-constraint
failure at `COMMIT`, requires the database command to fail explicitly, then
verifies that zero rows from the transaction remain.
The restore test uses `pg_dump` custom format with `--no-owner --no-acl` for a
uniquely named test-only schema, restores it into a fresh uniquely named
database with `pg_restore --exit-on-error`, and verifies the restored row and
the unchanged source. Cleanup targets only the schema and database created by
that test. The complete procedure runs with:

```sh
pnpm test:integration:foundation-recovery
```

For a manual schema-level backup, keep the backup file outside the repository
and restore only into a new, empty target database. These commands use the
Compose container's configured PostgreSQL user; choose a fresh target name and
remove only that target after checking the restored data:

```sh
backup_file="$(mktemp /tmp/foundation_conformance.XXXXXX.dump)"
restore_database="foundation_restore_$(date +%s)_$$"
docker compose -f infra/docker-compose.dev.yml exec -T postgres \
  sh -c 'exec pg_dump --format=custom --no-owner --no-acl --schema=foundation_conformance --username "$POSTGRES_USER" --dbname "$POSTGRES_DB"' \
  > "$backup_file"
docker compose -f infra/docker-compose.dev.yml exec -T postgres \
  sh -c 'exec createdb --username "$POSTGRES_USER" "$1"' foundation-backup "$restore_database"
docker compose -f infra/docker-compose.dev.yml exec -T postgres \
  sh -c 'exec pg_restore --exit-on-error --no-owner --no-acl --username "$POSTGRES_USER" --dbname "$1"' \
  foundation-backup-restore "$restore_database" < "$backup_file"
docker compose -f infra/docker-compose.dev.yml exec -T postgres \
  sh -c 'exec psql --no-psqlrc --username "$POSTGRES_USER" --dbname "$1" --command "\dn foundation_conformance"' \
  foundation-backup-check "$restore_database"
docker compose -f infra/docker-compose.dev.yml exec -T postgres \
  sh -c 'exec dropdb --if-exists --force --username "$POSTGRES_USER" "$1"' foundation-backup-cleanup "$restore_database"
rm -- "$backup_file"
```

The manual commands above are examples for the test-only `foundation_conformance`
schema, not a production backup policy. The automated drill proves a schema
backup can be restored locally without altering its source. It does not qualify
cluster-wide recovery, point-in-time recovery, provider-specific disaster
recovery, production RPO/RTO, or backup retention/encryption policy.

The F0–F4 evidence and lifecycle behavior remain part of the combined
acceptance gate: PostgreSQL and RabbitMQ survive dependency restarts; Temporal
progress resumes on a replacement worker; NATS outage cleanup restores health;
and gateway readiness transitions are checked before startup and during
shutdown. RabbitMQ's injected outage confirms the committed outbox item stays
pending; after recovery it is published. A consumer NACK after the inbox and
side effect commit forces re-delivery before ack; the inbox prevents a second
side effect. No TMS business services, routes, or schemas are included.

Verified in the working tree on 2026-10-28:

- `pnpm install --frozen-lockfile` — passed.
- `pnpm build` — passed.
- `pnpm lint` — passed.
- `pnpm test` — passed; 22 tests.
- `pnpm test:all` — passed; 22 passed, 7 environment-gated tests skipped.
- `pnpm test:integration:foundation-recovery` — passed; 2 tests verified a
  deferred unique-constraint failure at transaction commit leaves no rows and
  a `pg_dump`/`pg_restore` round-trip restores the committed test row to a
  disposable database without changing the source.
- `pnpm test:integration:postgres` — passed; 1 test verified committed state
  survives a PostgreSQL container restart.
- `pnpm test:integration:messaging` — passed; 1 test verified an actual
  connection failure while RabbitMQ is stopped leaves the committed outbox
  item pending, recovery permits publication, and a post-commit NACK/redelivery
  does not duplicate the side effect.
- `pnpm test:integration:temporal` — passed; 1 test resumed persisted workflow
  progress on a replacement worker after the first worker shut down.
- `pnpm test:integration:nats` — passed; 1 test verified NATS outage signals,
  retained PostgreSQL state, manual replay, and correlated observability.
- Strict TypeScript checks passed for
  `infra/tests/integration/foundation-recovery.test.ts` and
  `infra/tests/integration/rabbitmq-messaging.test.ts` using
  `pnpm exec tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --types node --esModuleInterop --strict --skipLibCheck`.
- `pnpm exec prettier --check infra/tests/integration/foundation-recovery.test.ts infra/tests/integration/rabbitmq-messaging.test.ts infra/README.md package.json` — passed.
- `docker compose -f infra/docker-compose.dev.yml config --quiet` — passed.
- `pnpm docker:health` — passed; gateway liveness was `ok` and readiness was
  `true`.
- `git diff --check` — passed.

The intentional PostgreSQL unique-constraint error is expected test output;
Vitest passes only after confirming the command failed and the transaction
left no partial rows. After the recovery sweep, PostgreSQL, RabbitMQ, NATS,
Temporal, gateway, and supporting local services were healthy. A follow-up
query found zero F5 temporary databases and zero temporary recovery schemas.
Existing named volumes remain preserved.

This closes local D-504 foundation acceptance only. It does not qualify
cluster-wide or point-in-time recovery, provider-specific disaster recovery,
production backup retention/encryption, high availability, or product RPO/RTO.
No TMS business implementation has been started by F0–F5.
