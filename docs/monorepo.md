# Repository structure and engineering conventions

This page documents the current repository rather than prescribing a
generic layout for future TMS services. For product boundaries and
implementation status, see the [documentation guide](README.md) and
[system blueprint](trucking/TMS_SYSTEM_BLUEPRINT.md).

## Current packages

- `packages/common/` contains shared logging, tracing, health, metrics,
  configuration, and service-bootstrap utilities.
- `packages/identity-token/` provides the Identity JWT verification contract
  for independent validation by each receiving service. It verifies
  RS256/JWKS signatures and selected claims; it does not issue tokens or
  authorize domain resources.
- `services/api-gateway/` currently exposes gateway health/readiness and
  observability. Its non-health HTTP routes now require an Identity-issued
  bearer token when Identity JWKS settings are configured; it still has no
  TMS business routes and does not make domain authorization decisions.
- `services/load-service/` contains the first DDD-structured Load boundary
  for local token verification and D-513-protected Load/revision/submission
  reads, plus a booking authorization preflight. Its D-514 slice now includes
  the durable Customer fact inbox/projection, snapshot-request outbox and
  recovery worker, and a fail-closed booking fact gate. It still requires an
  injected D-515 area resolver and a durable booking repository.
- `services/counterparty-registry/` implements only the D-514 Customer
  booking-fact owner write, sequenced transactional outbox, completeness
  watermark relay, and authoritative snapshot response. It is not the full
  Counterparty Registry API or Carrier implementation.
- `infra/` contains the local gateway and observability environment.
- `docs/` contains product, business, architecture, and engineering
  documentation.

The Identity service and most TMS business capabilities are not implemented.
The shared token verifier is a library, not an Identity service. The new
Registry and Load persistence/messaging components require deployment-managed
migrations, broker topology, service credentials, and runtime wiring; local
conformance infrastructure is not an application deployment. Create domain
behavior only within its approved service boundary, using the established
`application`, `domain`, `interfaces`, and `infrastructure` organization
without adding unused scaffolding.

The gateway consumes the shared `@app/identity-token` verifier, which
receiving domain services can also use locally. It accepts
`IDENTITY_ISSUER`, `IDENTITY_AUDIENCE`, and
`IDENTITY_JWKS_URI` as one configuration set. If configured, it verifies
RS256 signatures and the selected identity-token claims with a five-minute
JWKS cache. JWKS URLs must use HTTPS; HTTP is accepted only for loopback
endpoints in the test environment. Until the Identity issuer is deployed,
application routes fail closed as unavailable; `/health`, `/ready`, and the
existing `/metrics` scrape endpoint remain public. Domain services must
independently verify identity tokens and enforce their own resource
authorization. The Load service follows this rule through its local
verification hook and D-513 policy; protected routes fail closed until an
Identity issuer is configured.

## Workspace and build

- `package.json` owns workspace-level scripts and package management.
- `pnpm-workspace.yaml` includes `packages/*` and `services/*`.
- `tsconfig.base.json` holds shared TypeScript compiler settings.
- `turbo.json` owns dependency-aware build and development task ordering.
- Run builds through root `pnpm build`; Turbo builds workspace dependencies
  before dependent packages.
- Running a service package script directly assumes its workspace
  dependencies have already been built.
- Service-owned SQL migrations live under each service's `migrations/`
  directory and are applied by the deployment migration job, never on
  application startup. `pnpm test:integration:customer-booking` exercises the
  D-514 PostgreSQL adapters using isolated schemas in local conformance
  PostgreSQL; it does not qualify production database or broker deployment.

## Tests and generated output

- Keep service tests under that service's `tests/` directory.
- Name Vitest files `*.test.ts`; separate integration and environment checks
  by purpose.
- Keep generated artifacts out of `src/`.
- Keep datastore adapters within their owning service; do not share tables or
  migrations across service databases.
