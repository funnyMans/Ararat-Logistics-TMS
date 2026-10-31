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
- `infra/` contains the local gateway and observability environment.
- `docs/` contains product, business, architecture, and engineering
  documentation.

The Identity service and TMS business services are not implemented. The
shared token verifier is a library, not an Identity service. Create a domain
service only when its approved responsibility and contracts are ready, and
use the agreed `app`, `domain`, `interface`, and `infra` organization without
adding unused scaffolding.

The gateway consumes the shared `@app/identity-token` verifier, which
receiving domain services can also use locally. It accepts
`IDENTITY_ISSUER`, `IDENTITY_AUDIENCE`, and
`IDENTITY_JWKS_URI` as one configuration set. If configured, it verifies
RS256 signatures and the selected identity-token claims with a five-minute
JWKS cache. Until the Identity issuer is deployed, application routes fail
closed as unavailable; `/health`, `/ready`, and the existing `/metrics`
scrape endpoint remain public. Domain services must independently verify
identity tokens and enforce their own resource authorization when those
services are implemented.

## Workspace and build

- `package.json` owns workspace-level scripts and package management.
- `pnpm-workspace.yaml` includes `packages/*` and `services/*`.
- `tsconfig.base.json` holds shared TypeScript compiler settings.
- `turbo.json` owns dependency-aware build and development task ordering.
- Run builds through root `pnpm build`; Turbo builds workspace dependencies
  before dependent packages.
- Running a service package script directly assumes its workspace
  dependencies have already been built.

## Tests and generated output

- Keep service tests under that service's `tests/` directory.
- Name Vitest files `*.test.ts`; separate integration and environment checks
  by purpose.
- Keep generated artifacts out of `src/`.
- Add datastore, migration, and generated-client conventions only when an
  approved service actually introduces them.
