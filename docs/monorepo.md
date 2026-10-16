# Repository structure and engineering conventions

This page documents the current repository rather than prescribing a
generic layout for future TMS services. For product boundaries and
implementation status, see the [documentation guide](README.md) and
[system blueprint](trucking/TMS_SYSTEM_BLUEPRINT.md).

## Current packages

- `packages/common/` contains shared logging, tracing, health, metrics,
  configuration, and service-bootstrap utilities.
- `services/api-gateway/` currently exposes gateway health/readiness and
  observability. It has no implemented Identity or TMS business routes.
- `infra/` contains the local gateway and observability environment.
- `docs/` contains product, business, architecture, and engineering
  documentation.

The Identity service and the TMS business services are not implemented.
Their ownership and responsibilities are target product boundaries, not
existing workspace packages. Define a service's structure when its MVP
responsibility and contracts are approved; do not create empty packages to
mirror conceptual nouns.

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
