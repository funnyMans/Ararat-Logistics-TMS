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
The service-by-service trigger, responsibility, and dependency sequence is
summarized in the [service interaction map](SERVICE_INTERACTION_MAP.md).
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

The documented initial operational release describes the coherent TMS
capability the owners intend the system ultimately to provide; it is not a
commitment to implement that scope in one delivery or a minimum feature set
chosen to demonstrate value to external customers. The owners are both the
business and engineering stakeholders. Accordingly, the system as a whole
and each of its smallest components are evaluated as parts of one dependable
operational product, not as standalone features whose priority is determined
by customer demonstration or service count.

Product scope, business rules, architecture, interfaces, infrastructure, and
operational controls will be developed iteratively as one coherent design.
Implementation increments will be selected according to their contribution
to system integrity, architectural learning, unresolved technical risk,
dependency order, and the ability to verify end-to-end behavior. A service
or business capability has no inherent priority over the system as a whole;
the next increment is whichever most responsibly advances or validates the
coherent target. The term _MVP_ is therefore not used to imply a narrow
customer-facing release or a reduced standard of technical completeness.
Detailed release scope and measurable operational acceptance remain subject
to explicit approval.

### Minimum identified TMS target and system boundary

The minimum currently identified target is the foundation for governing
transport work from broker booking through Execution-confirmed delivery
closeout. It includes the business capabilities and system foundations
already established in this blueprint and the operating model:

- Identity and access for authorized staff and drivers.
- Minimal Counterparty Registry records for Customers and Carriers, and
  Fleet Readiness records and current facts for drivers, equipment, and
  planning-critical Carrier eligibility.
- Broker-led Load intake, booking outcomes, immutable requirement revisions,
  and Load-linked operational follow-up.
- Dispatch Planning, Capacity Commitment, resource matching, and Assignment,
  with their defined handoffs, state ownership, and recovery boundaries.
- Execution progress, stop milestones, delivery outcomes, evidence,
  operational exceptions, corrections, and closeout.
- Manual tendering to approved Carrier profiles; internal Customer-charge
  and Carrier-cost proposals; Load-linked operational claims; actionable
  notifications; and read-only operational visibility, within the specific
  boundaries already recorded in the owning documents.
- The platform and operating controls on which these workflows depend:
  service-owned persistence, versioned contracts, durable messaging,
  workflow coordination, authentication and authorization, observability,
  deployment, graceful shutdown, backup, and tested recovery.

This is a known minimum for the intended TMS target, not a complete maximum
scope or an approved release checklist. Detailed behavior and acceptance
remain open where the decision register says so. The maximum scope is
deliberately undefined; any additional responsibility requires an explicit
owner decision describing its purpose, owner, authoritative records,
relationships, lifecycle, integrations, and exclusions. Common industry
packaging or technical convenience alone does not bring a responsibility
inside the TMS.

The TMS is intended to be a dependable core on which adjacent business
systems may rely, not a mandate to absorb those systems. Such systems retain
their own bounded responsibilities, data authority, and lifecycle while
interacting with the TMS through explicit, versioned contracts. Billing,
accounting, accounts receivable/payable, and settlement are separate from
the TMS; the agreed Load rates and internal charge/cost proposals do not
constitute invoices, ledgers, payment obligations, or settlement records.
Any future connection to a separate financial system requires an explicit
scope and contract decision. Whether user-facing client applications are
part of the same delivery or are developed separately is also undecided;
application packaging does not alter the TMS's business ownership boundaries.

External TMS and carrier practices inform research but do not become
requirements by imitation. Record any practice adopted with its source, date,
applicability to this operating model, and the owner's decision. Validate
legal or regulatory requirements against authoritative sources and qualified
review before adopting them as product policy.

## Approved target architecture

The system keeps four business truths distinct:

| Truth      | Owner                    | Responsibility                                                                                                |
| ---------- | ------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Reference  | Counterparty Registry    | Distinct Customer and Carrier identities and lifecycle                                                        |
| Readiness  | Fleet Readiness          | Driver/equipment readiness and availability; Carrier eligibility facts and gate-required agreement references |
| Commercial | Load                     | Booked transportation commitment and customer requirements                                                    |
| Capacity   | Capacity Commitment (CC) | Reservation lifecycle and capacity-window claims                                                              |
| Decision   | Dispatch Planning        | Matching decision and canonical Assignment                                                                    |
| Movement   | Execution                | Progress, exceptions, evidence, completion, and corrections                                                   |

Counterparty Registry owns master identity/status records only; one legal
organization may have separate Customer and Carrier profiles. Fleet
Readiness owns driver/equipment operational records, readiness facts,
versioned Carrier eligibility facts with verification evidence, and
gate-required agreement references, not HR, payroll, legal interpretation,
or compliance case management. Load, Dispatch
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

1. Define and refine the coherent intended TMS target, minimum identified
   scope, business workflows, concepts, lifecycles, relationships, and
   ownership as one operational product. The maximum scope may remain
   explicitly open.
2. Develop system boundaries, infrastructure, data authority, internal
   contracts, security, and failure/recovery behavior alongside that product
   definition; resolve dependencies and conflicts before the business
   capabilities that depend on them are implemented.
3. Define detailed role responsibilities, access, operational acceptance,
   and verification before implementing each capability that depends on
   them.
4. Before implementing a business capability, close and review its
   applicable documentation-readiness gates. The
   [implementation-readiness matrix](IMPLEMENTATION_READINESS.md) maps these
   prerequisites without making unrelated open decisions a blanket blocker.
   The separately approved platform-foundation phase below remains the first
   implementation phase.
5. Establish and verify platform foundations before relying on them for
   business workflows.
6. Select implementation increments by technical importance to the system:
   architectural risk and learning, dependency order, system integrity, and
   end-to-end verifiability. Use bounded slices to deliver and validate the
   target incrementally, not to reduce the approved product to a showcase.
7. Extend or revise the intended TMS through explicit owner decisions,
   preserving clear ownership and verification.

### Technical foundation milestones

The first implementation work follows the D-504 platform-foundation phase
below. These are engineering milestones, not business capabilities or a
commitment to implement the target in one delivery. Complete and verify each
milestone's exit evidence before relying on it in a later milestone.

| Milestone                                              | Status   | Depends on                                                | Bounded scope                                                                                                                                                                                                                                                                                                    | Exit evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------ | -------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **F0. Reproducible runtime baseline**                  | Verified | Existing repository baseline                              | Establish clean local bootstrap and build, configuration and secret boundaries, service lifecycle conventions, distinct liveness/readiness behavior, and graceful shutdown. Extend the existing shared utilities and gateway baseline where appropriate; do not create empty business services.                  | A clean checkout passes the D-504 commands: `pnpm install --frozen-lockfile`, `pnpm build`, `pnpm lint`, `pnpm test`, and `pnpm test:all`. Readiness reflects required dependency availability; shutdown stops new work and drains or durably retains accepted work within the configured grace period.                                                                                                                                                                                                                                                 |
| **F1. Isolated persistence conformance**               | Verified | F0                                                        | Add disposable local PostgreSQL for test-only conformance components and verify the pattern for isolated service-owned persistence. Keep database authority separate; create no TMS business schema or shared product database.                                                                                  | `pnpm docker:postgres:up` starts the loopback-only database; `pnpm test:integration:postgres` verifies committed test-only state survives separate client processes and a PostgreSQL container restart. The local database start and explicit, targeted reset procedure are documented in `infra/README.md`.                                                                                                                                                                                                                                            |
| **F2. Durable messaging conformance**                  | Verified | F0, F1                                                    | Add RabbitMQ for durable delivery and exercise test-only publisher/consumer conformance, including the transactional outbox/inbox behavior needed to prove publication recovery and duplicate-safe consumption. No application/business routes, domain events, or production messaging framework are introduced. | `pnpm test:integration:messaging` proves a committed test-only outbox item remains pending during broker unavailability and is published after recovery using mandatory routing and publisher confirms; an unroutable item is parked; durable queue delivery survives broker restart; and a consumer NACK after inbox/side-effect commit causes safe redelivery without repeating the side effect.                                                                                                                                                      |
| **F3. Persistent workflow recovery**                   | Verified | F0 and the persistence configuration required by Temporal | Add a pinned Temporal server backed by its own persistent PostgreSQL service and test-only workflow/worker conformance. Keep workflow progress separate from business truth and do not implement a business workflow.                                                                                            | `pnpm test:integration:temporal` passed twice against the Compose Temporal server; the test waits for persisted workflow progress, shuts down the first worker, starts a replacement worker, and asserts the completed workflow state. Temporal persistence uses a separate PostgreSQL container and volume from `foundation_conformance`.                                                                                                                                                                                                              |
| **F4. Secondary fan-out and correlated observability** | Verified | F0–F3                                                     | Add NATS only for secondary realtime fan-out. Correlate one conformance transaction across structured logging, tracing, and metrics. NATS messages remain non-authoritative. The conformance test explicitly republishes from a durable fact; no automatic replay worker is implemented.                         | `pnpm test:integration:nats` proves a causal trace links the conformance stages and parent-linked gateway requests; before/after snapshots assert exact increments on bounded metric series. It verifies health/readiness and failure signals during a real NATS outage, retained authoritative PostgreSQL state, and manual replay from that fact. Review gates and failure-path recovery checks passed; exact evidence is recorded in `infra/README.md`.                                                                                              |
| **F5. Foundation recovery and acceptance**             | Verified | F0–F4                                                     | Complete deterministic failure-injection coverage, dependency-restart and shutdown scenarios, and the local backup/restore procedure. Reconcile all evidence against D-504; keep provider-specific HA and disaster-recovery qualification separate.                                                              | `pnpm test:integration:foundation-recovery` proves a deferred-constraint commit failure leaves no partial rows and a `pg_dump` schema backup restores into an isolated database without changing the source. `pnpm test:integration:messaging` verifies pending outbox state during broker failure and duplicate-safe redelivery after a post-commit NACK. F1–F4 recovery suites and the D-504 validation commands passed; exact results and limits are in `infra/README.md`. Local verification does not qualify provider HA/DR or production RPO/RTO. |

This sequence does not authorize business services, product-facing business
routes, fabricated operational data, or third-party integrations. In
particular, it does not add accounting/QuickBooks, ELD, load-board, general
fleet-management, yard-management, or legal/compliance systems to the TMS
foundation. The Load booking/read increment is selected as B0. Complete and
verify F0–F5 foundation acceptance before TMS business-service
implementation begins. After that gate, close each capability's applicable
gates in the
[implementation-readiness matrix](IMPLEMENTATION_READINESS.md) and
[open-decision register](OPEN_QUESTIONS.md) before protected operations are
implemented. This selection does not authorize unresolved policy choices.
The sequence does not require closing
the intentionally open maximum scope or unrelated future capability gates.
F0–F5 acceptance qualifies only the tested local platform capabilities;
production qualification remains separate. The near-term operating
assumption remains approximately 50–100 trucks; capacity for 500 trucks is
not claimed by this roadmap and must be revisited and validated before it is
represented as supported.

### Milestone status and documentation

After each milestone is completed, update this roadmap with its actual
status and link the exact validation command and result in the document that
owns that implementation detail (for example, the
[local development guide](../../infra/README.md) for local environment
behavior). Update the implementation-readiness matrix when a gate changes
status, and update the decision log or open-decision register only when an
owner decision or unresolved prerequisite changes. Keep agreed design,
implemented behavior, and verified evidence distinct. Do not mark the whole
foundation accepted until all F0–F5 evidence required by D-504 is recorded.

The selected [Load booking/read increment](FIRST_SLICE_CANDIDATE.md) is
bounded to durable booking outcomes and reads. Its applicable implementation
gates and unresolved design questions are tracked in the
[readiness matrix](IMPLEMENTATION_READINESS.md) and
[open-decision register](OPEN_QUESTIONS.md).

### Business implementation milestones

The sequence below follows F0–F5. B0 is selected as the bounded Load
booking/read increment; later milestones remain a recommended dependency
order, not authorization to implement unresolved policies. Execute only
capabilities whose applicable readiness gates are closed. Keep each
service's business facts and transitions under its documented owner.

| Milestone                                                       | Proposed scope                                                                                                                                                                                                                         | Why this order                                                                                                                                                                              |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **B0. Select and bound the first increment**                    | Selected: the Load booking/read path in [the first business increment](FIRST_SLICE_CANDIDATE.md), including actors, trusted facts, permission boundary, outcomes, acceptance, and exclusions.                                          | Establish a verifiable upstream business boundary without requiring the entire target scope to close; preserve remaining authorization and Customer-status gates.                           |
| **B1. Establish slice-specific identity and authorization**     | D-513 selects the initial human role/action/resource matrix for Load booking and reads. Implement authenticated principal handling and enforce its area, handler, supervisory, and result-visibility rules on the selected operations. | Protected writes need explicit authority boundaries before their routes or message handlers exist. Remaining service-specific workload ACLs stay scoped to the integrations that need them. |
| **B2. Close and implement required owner facts**                | D-514 closes the Customer status/legal-name fact, projection freshness, and snapshot recovery contract. Implement only this Counterparty Registry→Load fact path and its owner-correct recovery. Planning facts remain out of scope.   | Booking must consume an owned, current Customer status and fail safely when it is unavailable or stale.                                                                                     |
| **B3. Implement the required Load lifecycle**                   | Implement the selected booking/read path, including idempotency, durable outcomes, authorization, and dependency-failure behavior. Amendments and cancellation remain out of scope unless separately selected.                         | Load's authoritative state is the input boundary for downstream planning and execution.                                                                                                     |
| **B4. Implement planning, Capacity Commitment, and Assignment** | Close slice-specific route, service-time, deadhead, ranking, authorization, and recovery gates; implement the owner-defined planning and recoverable Capacity Commitment/Assignment handoff.                                           | This is a central cross-owner boundary with contention and recovery risks; its inputs must be approved rather than represented by unverified placeholders.                                  |
| **B5. Implement the corresponding Execution path**              | Implement only the selected progress, evidence, exception, and completion/correction behavior, with owner-authored transitions, audit history, and recovery acceptance.                                                                | Completes the operational path and validates upstream contracts and ownership end to end.                                                                                                   |
| **B6. Complete slice operations and end-to-end acceptance**     | Add the notifications and read-only operational views required by the selected path; verify nominal and deterministic failure scenarios across owners and record outcomes.                                                             | Makes pending work and recovery actionable without giving projections or notifications authority over source state.                                                                         |

**Current progress:** B1 is in progress. The API gateway now verifies the
selected RS256 Identity access-token contract on non-health routes when
configured and fails closed if Identity is not configured. Identity token
issuance, service-local verification, Load-owned D-513 resource authorization,
and their acceptance evidence remain outstanding.

Production qualification—including provider HA/DR, measured production
RPO/RTO, retention, privacy, and deployment controls—remains a separate gate.
These proposed milestones do not require implementing every capability or
closing unrelated open decisions before work can proceed.

## Approved platform-foundation increment

D-504 approves platform foundation as the first implementation phase. This
is a bounded engineering increment, not a business workflow, a customer
demonstration, or authorization to start domain-owned TMS operations before
their specific documentation gates are met. It validates the shared runtime
capabilities on which later services depend. The Load booking/read increment
is selected, but business-service implementation begins only after the F0–F5
foundation acceptance evidence is complete and the capability-specific gates
are closed. This ordering makes
infrastructure readiness a prerequisite to service implementation; it does
not defer business implementation indefinitely or require the maximum TMS
scope to be decided first. Each selected capability must still pass its own
implementation-readiness gates.

The foundation increment may establish and verify reproducible local
infrastructure, service lifecycle and configuration conventions, isolated
service-owned PostgreSQL deployment patterns, durable RabbitMQ delivery,
Temporal persistence and worker recovery, NATS as secondary realtime
fan-out, and correlated logs, metrics, and traces. It must not introduce
empty business services, dummy business records, product-facing business
routes, or a shared database that weakens service ownership. Synthetic
conformance components belong in tests and must be identified as such.

The increment is accepted only when the following evidence is automated
where applicable and recorded with the exact command and result:

1. A clean checkout can install from the lockfile, build, lint, and run
   unit/integration checks with `pnpm install --frozen-lockfile`,
   `pnpm build`, `pnpm lint`, `pnpm test`, and `pnpm test:all`; the local
   platform starts from documented configuration without committed secrets
   or destructive default cleanup.
2. Readiness stays false when a dependency required for accepting that
   service's work is unavailable; liveness remains distinct. A service
   receiving termination stops accepting new work, drains or durably retains
   accepted work within its configured shutdown grace period, and exits
   without losing an acknowledged durable operation.
3. Integration tests use real disposable PostgreSQL, RabbitMQ, and Temporal
   dependencies. They demonstrate that committed database state survives
   process/dependency restart; a committed outbox message is eventually
   published and remains recoverable through broker/publisher restart; inbox
   deduplication makes repeated delivery side-effect safe; and a persisted
   Temporal workflow resumes after worker restart. NATS fan-out may be lost
   and recovered from authoritative durable facts; it must never be treated
   as business authority.
4. Deterministic failure injection verifies recovery at transaction commit,
   message publication/consumption, worker shutdown/restart, and dependency
   unavailability. Tests assert persisted outcomes and no success-shaped
   fallback. The platform provides a documented backup/restore procedure;
   a provider-specific disaster-recovery drill must demonstrate the selected
   RPO/RTO before production qualification.
5. A correlated conformance transaction can be followed through structured
   logs, traces, and bounded-cardinality metrics. Health, readiness, and
   failure signals are inspectable, and local infrastructure ports and
   development credentials remain within the documented development
   boundary.

Passing this phase qualifies only the tested platform capabilities. It does
not qualify production deployment, prove the full TMS operational success
criteria, or authorize a business service whose domain-specific gates remain
open. The exact production provider, capacity sizing, deployment topology,
and provider-specific high-availability validation remain production
qualification decisions.
