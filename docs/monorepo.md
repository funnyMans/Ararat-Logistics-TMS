# TMS monorepo and service structure

This repository contains the TMS study system. Its target domain boundaries
include Load, Dispatch Planning, Capacity Commitment, Execution,
Notification, and supporting brokerage/workforce/fleet capabilities. Keep
generated artifacts out of `src/`, and use only the layers that make each
service's business responsibility easier to understand and test.

## Root conventions

- `package.json` — workspace-level scripts and dependency management
- `pnpm-workspace.yaml` — workspace membership
- `tsconfig.base.json` — shared TypeScript compiler settings
- `eslint.config.mjs` — single active lint configuration
- `docs/` — TMS company model, architecture, contracts, and development guidance
- `infra/` — runtime infrastructure and compose files

## Shared packages

- `packages/common/` — shared logger, tracing, health, config, and bootstrap helpers
- `packages/contracts/` — stable TMS transport types and runtime validation shared by multiple owners
- `services/api-gateway/` — authenticated public API entrypoint and route composition
- `services/auth-service/` — credentials, JWT access, refresh rotation/revocation, and role grants
- `services/users/` — workforce/person profile records, with no independent role authority

## TMS business boundaries

The target peer business services include Load, Dispatch Planning, Capacity
Commitment, and Execution, supported by Notification and the wider service
map in the [TMS system blueprint](./trucking/TMS_SYSTEM_BLUEPRINT.md). The
current repository does not implement these business workflows. Add concrete
service packages only after the full architecture and first slice are
approved:

- `services/loads/` — Load ownership.
- `services/dispatch/` — automated matching, policy decisions, and canonical
  Assignment ownership.
- `services/capacity-commitment/` — peer service owning Reservations and
  exclusive capacity-window claims.
- `services/execution/` — movement facts and exceptions.
- `services/notifications/` — actionable inbox and delivery state.

Brokerage, Workforce/Fleet/Capacity, Documents, and external adapters are
explicit target boundaries. They may be represented by carefully scoped
modules or deterministic fixtures until their full workflows are selected.
Any fake must identify fixture provenance and reject unsupported operations;
it must not claim to provide authoritative real-world facts. The service
map and extraction conditions are in the
[TMS system blueprint](./trucking/TMS_SYSTEM_BLUEPRINT.md).

Once a runnable service is justified, use a structure such as:

- `package.json`
- `Dockerfile`
- `tsconfig.json`
- `prisma/schema.prisma`
- `src/server.ts` — process entry point
- `src/bootstrap.ts` — app assembly and dependency wiring
- `src/domain/` — entities, value objects, and domain rules
- `src/app/` — use cases, commands, queries, and orchestration
- `src/infrastructure/` — DB, config, clients, security, metrics, and external adapters
- `src/interfaces/http/` — controllers, routes, and request/response handling
- `tests/` — unit and integration tests

## DDD rules

- `domain/` owns business language and invariants
- `app/` owns orchestration and use cases
- `infrastructure/` owns adapters and external dependencies
- `interfaces/http/` owns transport concerns only
- `bootstrap.ts` is the single assembly point for each service
- `server.ts` is always the runtime entrypoint for the process

## Generated client rules

- Prisma clients are generated into a service-local output folder such as `generated/`
- Do not keep generated client output under `src/`
- Ensure each service's `prebuild`/`predev` scripts generate its own Prisma client

## Workspace build orchestration

- Run builds through the root `pnpm build` command so Turbo builds shared
  workspace dependencies before dependent services.
- Service lifecycle hooks may clean that service's output and generate its own
  Prisma client, but must not recursively build shared workspace packages.
  Turbo owns dependency ordering; recursive package builds can race by deleting
  shared `dist/` output while another service is compiling.
- Docker builder stages use `pnpm exec turbo run build --filter=<service>...`
  to build the selected service together with its workspace dependencies.
- `pnpm dev` uses the same dependency graph for shared packages before starting
  service watchers. Running a service package script directly assumes its
  workspace dependencies have already been built.

## Test placement

- Keep all service tests under `services/<service>/tests/`
- Use `*.test.ts` naming for unit and integration coverage
- Keep infrastructure or environment-specific checks separated by purpose

## Standardization checklist

- One runtime server entrypoint per service
- One bootstrap assembly entrypoint per service
- One config module per service
- One Prisma schema per service
- One generated Prisma client location per service
- No stale `index.ts` launchers for service runtimes
