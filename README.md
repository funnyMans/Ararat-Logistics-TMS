# Trucking Transportation Management System

This repository is a **software-engineering study project**: we are
designing and building a realistic Transportation Management System (TMS)
for a trucking company that we define ourselves. We are the owners of the
model, not a customer proxy. We use real-world operating practices and legal
constraints to challenge our assumptions, combine useful patterns into a
coherent model, and learn by implementing and testing it. This is not a
customer-validated or production-ready business system.

The company model is a US trucking operation with its own fleet and
brokerage, initially sized around 50–100 trucks. Its working areas are LA
(the home area), West, Central, and East. The scale and organization are
design inputs, not product limits. We aim for a model that can grow without
locking us into hard structures that require wholesale redesign; any
organizational or legal assumption must be examined against real operations
and applicable law.

## Documentation map

Start with the **[TMS system blueprint](docs/trucking/TMS_SYSTEM_BLUEPRINT.md)**.
It is the single authority for the whole business-and-technical target:
what the system is for, how its capabilities fit together, what each owner
and tool is responsible for, which decisions are agreed, and what remains
open. It is a strategy and architecture baseline, not a frozen API or build
specification.

The expanded documents explain one area each; they add detail but cannot
override a confirmed blueprint decision:

- **Business:** [company roles and authority](docs/trucking/RESPONSIBILITIES.md)
  and the [business operating model](docs/trucking/OPERATING_MODEL.md).
- **Technical design:** [technical workflow, records, and failure handling](docs/trucking/TECHNICAL_WORKFLOW.md),
  followed by the shared [message-contract guide](docs/contracts.md).
- **Planning:** [first-slice candidate](docs/trucking/FIRST_SLICE_CANDIDATE.md),
  [open decisions](docs/trucking/OPEN_QUESTIONS.md), and the staged roadmap
  in the blueprint. The first slice is not selected.
- **Engineering reference:** [HTTP/service baseline](docs/SERVICE_CONTRACT.md),
  [monorepo conventions](docs/monorepo.md), and
  [local development environment](infra/README.md).

**Authority order:** the blueprint owns target decisions and architecture;
the open-decisions register owns the current unresolved-question list;
expanded domain documents provide detail under the blueprint; engineering
guides specify repository conventions, not business policy. The blueprint's
roadmap sequences work but does not approve a first slice.

## Current state

The target architecture and company operating model are being established
before TMS business workflows are built. The repository currently contains
the shared Node.js runtime, API gateway, account/profile and authentication
foundation, database support, and local developer tooling. Load, Dispatch
Planning, Capacity Commitment, Execution, Notification, and the wider
supporting capabilities are target boundaries; their business workflows are
not implemented.

Do not treat a configured component, passing local check, scenario, or
company hypothesis as evidence of customer fit, compliance, or production
readiness. The system should become more realistic through explicit
decisions, source-backed assumptions, executable scenarios, and measured
behavior—not through infrastructure or automation added speculatively.

## Development

Requirements: Node.js version from [`.nvmrc`](.nvmrc), pnpm from the
`packageManager` field, and Docker Compose for local PostgreSQL and
observability services.

```sh
cp -n .env.example .env
pnpm install --frozen-lockfile
pnpm build
pnpm lint
pnpm test:unit
docker compose -f infra/docker-compose.dev.yml config --quiet
```

Local infrastructure instructions and current Compose scope are documented
in [`infra/README.md`](infra/README.md). The development stack is for local
engineering, not deployment.

## Scope discipline

Define the whole target system and its operational model before selecting
the first small end-to-end implementation slice. The target includes advisory nominations, automated matching and
reservation/Assignment within explicit policy, exception handling by the
responsible people, execution, notification, and the full offer-to-next-load
workflow. Capacity Commitment is a peer service to Load, Dispatch Planning,
and Execution. The candidate first slice and its explicit exclusions are in the
[first-slice candidate](docs/trucking/FIRST_SLICE_CANDIDATE.md);
it is not yet the approved implementation plan.

The first slice is not yet approved. It should test a small vertical path
through the automated target behavior and an exception path; its exact load
profile, matching rules, source facts, and scope remain to be selected.
Customer booking, validated legal/HOS calculation, broad carrier/customer
portals, billing, and settlement are not implied first-slice requirements.
Their inclusion requires an owned workflow, validated constraints, and
evidence that it is useful.

This project is available under the [MIT License](LICENSE).
