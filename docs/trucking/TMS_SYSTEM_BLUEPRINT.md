# TMS system blueprint

This document is the concise baseline for the owner-led TMS product:
approved target scope, system ownership, architecture principles, and staged
roadmap. Product direction is owner-defined; customer validation, legal
review, and production controls must be established through evidence.

See the [documentation guide](../README.md) for page ownership and status
labels and the separation between business requirements and technical design.
The [TMS responsibility map](TMS_SCOPE.md) identifies current coverage and
gaps. Detailed business rules belong in the [operating model](OPERATING_MODEL.md);
high-level role boundaries belong in [responsibilities](RESPONSIBILITIES.md);
technical workflow invariants belong in [technical workflow](TECHNICAL_WORKFLOW.md).
Accepted baseline decisions are recorded in the
[decision log](DECISIONS.md); unresolved choices are listed in
[open decisions](OPEN_QUESTIONS.md).

## Project premise

The initial operating model is a US trucking carrier and brokerage with
approximately 50–100 trucks, centered on LA and operating across West,
Central, and East areas. The initial system is for one company; these are
current design assumptions, not product limits or a commitment to support
multiple companies from the first version.

The product direction is defined by its owners. Assumptions and evidence must
be recorded separately from owner decisions; only approved TMS
responsibilities belong to its scope.

The first target is an owner-operated, single-company TMS that reliably
governs a Load from booking through delivery closeout. Architecture,
infrastructure, shared contracts, and recovery readiness are prerequisites
to that operational capability, not a deadline to release a narrow
customer-facing product.

External TMS and carrier practices inform research but do not become
requirements by imitation. Record any practice adopted with its source, date,
applicability to this operating model, and the owner's decision. Validate
legal or regulatory requirements against authoritative sources and qualified
review before adopting them as product policy.

## Approved target architecture

The system keeps four business truths distinct:

| Truth      | Owner                    | Responsibility                                              |
| ---------- | ------------------------ | ----------------------------------------------------------- |
| Reference  | Counterparty Registry    | Distinct Customer and Carrier identities and lifecycle      |
| Readiness  | Fleet Readiness          | Driver/equipment operational status and availability        |
| Commercial | Load                     | Booked transportation commitment and customer requirements  |
| Capacity   | Capacity Commitment (CC) | Reservation lifecycle and capacity-window claims            |
| Decision   | Dispatch Planning        | Matching decision and canonical Assignment                  |
| Movement   | Execution                | Progress, exceptions, evidence, completion, and corrections |

Counterparty Registry owns master identity/status records only; one legal
organization may have separate Customer and Carrier profiles. Fleet
Readiness owns driver/equipment operational records and readiness facts, not
HR, payroll, maintenance, or compliance case management. Load, Dispatch
Planning, CC, and Execution are peer business boundaries. CC is a standalone
peer to Dispatch Planning: it protects capacity selected by policy, but does
not rank candidates or own Assignment. Notification makes action visible but
is not authority for an underlying business fact. Identity owns
authentication and role-grant context; each business owner remains
responsible for resource-level authorization and transitions.

Operations View is a separate, read-only projection boundary for
cross-service operational screens. It consumes versioned owner facts and
reports projection freshness; it does not own business decisions or accept
authoritative writes.

The target deploys each selected service independently. Every service owns
its PostgreSQL cluster and data; services relate records through stable
identifiers and contracts, not cross-service foreign keys. RabbitMQ,
Temporal, NATS, and observability are shared platform clusters. Within each
service, use the agreed `app`, `domain`, `interface`, and `infra` structure
without copying unused layers or generic scaffolding.

The architecture defines ownership independently of deployment. Do not
create a service for every business noun, share databases between owners, or
coordinate business state through synchronous service-to-service call
chains.

## Approved operating principles

- The handling broker alone decides whether to clarify, book, or decline a
  customer offer. Capacity approval is not a prerequisite to booking.
- Routine matching, reservation, and Assignment are automated when current
  trusted facts and policy support a valid choice; routine work does not wait
  for an approval click.
- Hard eligibility, safety, contractual, and concurrency constraints cannot
  be bypassed by automation or human intervention.
- A strong avoid-preference or explicit driver objection blocks automatic
  finalization for that proposal and enters a bounded human-review hold. An
  unresolved hold releases the Dispatch planning lease and returns the Load
  to planning without asserting capacity availability.
- A failed hard gate at finalization stops Assignment, releases the Dispatch
  planning lease, returns the Load to planning, and preserves history.
  Capacity reservations remain governed by CC; releasing a planning lease
  alone does not establish that capacity is available.
- Confirmed facts, assumptions, proposals, implementation, and verification
  are distinct; a fixture or configured tool is not evidence of real-world
  validity.

The [operating model](OPERATING_MODEL.md) and [responsibility model](RESPONSIBILITIES.md)
provide the approved detail without duplicating the architecture catalogue.

## Target tools and current implementation

The target separates durable business messaging, long-running workflow
coordination, and secondary realtime fan-out. The selected shared platform
roles are RabbitMQ, Temporal, and NATS respectively. Temporal stores
cross-service orchestration progress, not business truth. Domain services
remain authoritative for business state. Dispatch Planning and Operations
View consume versioned owner facts into local projections; commands and
final decisions remain with the owning service. These are target choices,
not a claim that they are configured in the current local stack. See
[service contracts](../contracts.md) for transport principles and the
[local development guide](../../infra/README.md) for implemented environment
scope.

The repository currently provides shared Node.js utilities, an API gateway
health/observability baseline, and local observability tooling. The target
Counterparty Registry, Fleet Readiness, Identity, Load, Dispatch Planning,
CC, Execution, Notification, and Operations View are not implemented. Identity and
Counterparty Registry responsibilities are documented from product
decisions, not inferred from current gateway or runtime utilities; their
remaining design gates are in the [open decisions](OPEN_QUESTIONS.md).

## Roadmap

1. Complete the TMS duty map, business workflows, concepts, lifecycles, and
   relationships.
2. Settle system and infrastructure boundaries, data ownership, and internal
   contracts, including failure and recovery behavior.
3. Define detailed role responsibilities, access, MVP scope, and verification
   criteria against the settled domain model and contracts.
4. Review and approve the complete documentation baseline. No TMS capability
   implementation starts before this gate.
5. Establish and verify the platform foundation as a distinct phase before
   TMS business-workflow implementation.
6. Select and implement a bounded end-to-end workflow slice from the approved
   scope; verify it against documented acceptance criteria.
7. Extend the TMS only through an approved scope change with clear ownership
   and verification.

The [first-slice candidate](FIRST_SLICE_CANDIDATE.md) is not selected.
Selection gates and unresolved design questions are tracked in
[open decisions](OPEN_QUESTIONS.md).
