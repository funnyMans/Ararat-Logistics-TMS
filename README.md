# Trucking Transportation Management System

This repository is the product and engineering baseline for an owner-led
Transportation Management System (TMS) initiative. The owners define the
product direction and are establishing its business model, target scope,
measurable acceptance, and system architecture. Product assumptions,
accepted requirements, evidence, legal conclusions, and implemented
capabilities are recorded as distinct things.

The initial operating model is a US trucking carrier and brokerage with its
own fleet, approximately 50–100 trucks, and working areas in LA, West,
Central, and East. These are current design assumptions, not product limits.

## Documentation map

Start with the [documentation guide](docs/README.md) for the documentation
hierarchy, business/technical separation, and product-establishment path. The
[TMS system blueprint](docs/trucking/TMS_SYSTEM_BLUEPRINT.md) summarizes
the currently agreed system scope and architecture.

Quick links: [TMS responsibility map](docs/trucking/TMS_SCOPE.md),
[business operating model](docs/trucking/OPERATING_MODEL.md),
[roles and authority](docs/trucking/RESPONSIBILITIES.md),
[technical workflow](docs/trucking/TECHNICAL_WORKFLOW.md),
[accepted decision log](docs/trucking/DECISIONS.md),
[open decisions](docs/trucking/OPEN_QUESTIONS.md),
[first-slice candidate](docs/trucking/FIRST_SLICE_CANDIDATE.md),
[service contracts](docs/contracts.md),
[monorepo conventions](docs/monorepo.md),
[local development environment](infra/README.md).

## Current implementation

The implementation currently contains shared Node.js utilities, an API
gateway with health and observability endpoints, and local development
observability. The TMS business workflows and the planned Identity service have not yet
been implemented.

Record validation evidence with the product or operational claim it supports.
Do not present an unverified assumption, an infrastructure component, or a
passing local check as evidence of market fit, legal compliance, or
production readiness.

## Development

Requirements: Node.js version from [`.nvmrc`](.nvmrc), pnpm from the
`packageManager` field, and Docker Compose for the local API gateway and
observability services.

```sh
cp -n .env.example .env
pnpm install --frozen-lockfile
pnpm build
pnpm lint
pnpm test:unit
docker compose -f infra/docker-compose.dev.yml config --quiet
```

See the [local development guide](infra/README.md) for the current Compose
scope, including the test-only PostgreSQL conformance dependency. It is not
an application database or a deployment environment.

## Product-establishment discipline

The approved implementation sequence is to complete and verify platform
foundation milestones F0–F5 before starting TMS business-service
implementation. This does not require resolving the intentionally open
maximum product scope or every future capability in advance. After the
foundation is accepted, implement business capabilities incrementally, closing
their applicable scope, ownership, contract, authorization, recovery, and
acceptance gates before starting each capability. The
[candidate slice](docs/trucking/FIRST_SLICE_CANDIDATE.md) remains proposed,
not selected; capability-specific prerequisites are tracked in
[open decisions](docs/trucking/OPEN_QUESTIONS.md).

This project is available under the [MIT License](LICENSE).
