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
approximately 50–100 trucks, centered on the Los Angeles–Long Beach
five-county CSA and operating across West, Central, and East rollups over
Census-based geographic leaves.
The initial system is for one company; these are current design assumptions,
not product limits or a commitment to support multiple companies from the
first version.

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
identifiers and contracts, not cross-service foreign keys. PostgreSQL,
RabbitMQ, Temporal, NATS, and observability are platform tools/products, not
business microservices or business-data owners. They may be self-hosted or
managed independently of domain-service runtimes. Within each service, use
the agreed `app`, `domain`, `interface`, and `infra` structure without
copying unused layers or generic scaffolding.

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

The target uses RabbitMQ as durable message transport, Temporal for
long-running workflow coordination, and NATS for secondary realtime fan-out.
These are platform tools, not company business microservices; they may be
self-hosted or managed and their process placement does not change domain
ownership. Temporal stores cross-service orchestration progress, not
business truth. Domain services remain authoritative for business state.
Dispatch Planning and Operations View consume versioned owner facts into
local projections; commands and final decisions remain with the owning
service. These are target choices, not a claim that they are configured in
the current local stack. See
[service contracts](../contracts.md) for transport principles and the
[local development guide](../../infra/README.md) for implemented environment
scope.

Redis is a potential future supporting tool to evaluate for measured
cross-instance ephemeral needs such as cache acceleration or shared
rate-limit counters. It is not currently selected, required, or deployed.
Any proposal must define data expiry, outage behavior, and consistency needs;
Redis must not become authority for business records, Identity grants or
sessions, or durable workflow state, and does not replace PostgreSQL,
RabbitMQ, or Temporal.

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

| Milestone                                                       | Proposed scope                                                                                                                                                                                                                                                                                                                                                               | Why this order                                                                                                                                                    |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **B0. Select and bound the first increment**                    | Selected: the Load booking/read path in [the first business increment](FIRST_SLICE_CANDIDATE.md), including actors, trusted facts, permission boundary, outcomes, acceptance, and exclusions.                                                                                                                                                                                | Establish a verifiable upstream business boundary without requiring the entire target scope to close; preserve remaining authorization and Customer-status gates. |
| **B1. Establish slice-specific identity and authorization**     | Define the operation-level role/action/resource matrix and required workload permissions; implement only the authentication and authorization behavior needed by the selected protected operations.                                                                                                                                                                          | Protected writes need explicit authority boundaries before their routes or message handlers exist.                                                                |
| **B2. Close and implement required owner facts**                | D-514 closes the Customer status/legal-name fact, projection freshness, and snapshot recovery contract. Implement only this Counterparty Registry→Load fact path and its owner-correct recovery. Planning facts remain out of scope.                                                                                                                                         | Booking must consume an owned, current Customer status and fail safely when it is unavailable or stale.                                                           |
| **B3. Implement the required Load lifecycle**                   | Implement the selected booking/read path, including idempotency, durable outcomes, authorization, and dependency-failure behavior. Amendments and cancellation remain out of scope unless separately selected.                                                                                                                                                               | Load's authoritative state is the input boundary for downstream planning and execution.                                                                           |
| **B4. Implement planning, Capacity Commitment, and Assignment** | The initial 100-mile replacement deadhead limit and `America/Los_Angeles` cycle schedule are selected in D-517. Implement the contract-defined Capacity Commitment reservation lifecycle first; keep automated planning/Assignment gated on approved route estimates, calibrated service times, source-backed Fleet facts, operation configuration, and recovery acceptance. | This is a central cross-owner boundary with contention and recovery risks; its inputs must be approved rather than represented by unverified placeholders.        |
| **B5. Implement the corresponding Execution path**              | Implement only the selected progress, evidence, exception, and completion/correction behavior, with owner-authored transitions, audit history, and recovery acceptance.                                                                                                                                                                                                      | Completes the operational path and validates upstream contracts and ownership end to end.                                                                         |
| **B6. Complete slice operations and end-to-end acceptance**     | Add the notifications and read-only operational views required by the selected path; verify nominal and deterministic failure scenarios across owners and record outcomes.                                                                                                                                                                                                   | Makes pending work and recovery actionable without giving projections or notifications authority over source state.                                               |

**Current progress:** B1's operation-level Load role/action/resource matrix
is settled in D-513 and reflected in the relevant Load OpenAPI operations.
D-513 limits Load's Registry access to the Customer status and legal name
needed for booking; D-514 and the owner AsyncAPI documents define the related
fact, watermark, and snapshot exchanges. Exact RabbitMQ ACLs remain a
separate implementation and production gate. The shared
`@app/identity-token` verifier and the gateway's fail-closed authentication
hook are implemented. The DDD-structured Load service now contains local token
verification hooks, protected read-route/application boundaries, a
Load-owned D-513 policy, and a booking authorization preflight that checks
derived areas and correction ownership before dispatching a write. D-515's
provider port and deterministic Census/CSA classifier are implemented; the
exact provider adapter and operational controls remain open. The initial Load
booking schema migration, transactional writer, contract-driven evaluator,
authorization-aware idempotency/replay, canonical read adapter, and complete
`load.booked` transactional outbox envelope are implemented and covered by
unit and PostgreSQL integration tests. Load's confirm-based outbox relay
preserves pending facts after publication failure and is covered by worker
and PostgreSQL retry tests. B2 now
has bounded Counterparty Registry owner-fact production, durable
outbox/watermark/snapshot behavior, and Load's persistent
fact inbox, projection, reconciliation outbox, recovery worker, and booking
gate. The Load service still needs deployment-managed migration execution,
RabbitMQ topology/credentials, runtime wiring, and an approved concrete
geocoding provider adapter. Do not move D-513 decisions into the gateway or a
detached shared module. No Identity issuer/service exists, and Identity HTTP
operations/contracts remain open for real issuance; the Load verifier fails
closed until it is configured. Real issuance and end-to-end production
enablement remain Identity and deployment gates beyond the implemented
Load-owned authorization behavior. Exact RabbitMQ ACLs remain a separate
production gate.

B4 has started with the contract-defined Capacity Commitment reservation
owner: the local service package implements durable reserve, confirm, release,
and atomic replacement outcomes, PostgreSQL capacity claims and lifecycle
history, and independent temporary-hold expiry. B4.1 now adds a standalone
forward-only checksum migration job, runtime worker, dedicated local
PostgreSQL database and RabbitMQ vhost, restricted runtime credentials,
health/readiness/metrics, graceful shutdown, and an operator runbook. Local
runtime integration verifies command consumption, durable outcome
publication, and that runtime credentials cannot publish to the command
exchange. Production topology, monitoring, HA/DR, and operational recovery
qualification remain separate.

D-518 through D-526 record the initial route provider (Trimble Maps /
PC*Miler), history-based service-time calibration, manual source-backed Fleet
facts, seven-day cycle calendar, four-hour pickup notice, supervisor-approved
emergency cycles, invariant plus historical-replay acceptance, and the
staged evidence-validation method and baseline-first approval of
operational-quality thresholds. The method uses sandbox checks followed by
read-only route shadowing, up to 24 months of stratified trip history for
calibration, reviewable Fleet fact groups, and up to 12 stratified months
for historical replay. Dispatch owners approve numeric thresholds after
reviewing replay baselines and coverage. These choices define the method,
not the evidence.
Automated Dispatch Planning and Assignment activation remain gated until
route and service-time evidence is validated, the fact-by-fact Fleet
catalogue is approved, and replay/recovery evidence passes. The contractor
offer/acceptance/commitment lifecycle remains outside B4.

For B4.2, the Dispatch Planning package now contains a strict evidence
contract, structural completeness evaluator, offline Trimble Route Reports
request/response provenance capture, and immutable candidate snapshots that
exclude any Load/Trio pair with a failed hard gate. Synthetic fixtures verify
these boundaries. No provider network calls are made, and no allocator or
runtime is wired; this scaffold cannot enable Dispatch. Representative
provider outcomes, completed-trip history, the approved fact-by-fact
catalogue, historical replay, and owner acceptance remain outstanding.

#### B4 follow-on milestones and recommended staffing

The milestones below break the remaining B4 work into deliverable gates.
The legacy B4.4 "scheduled Dispatch Planning" label describes the external
long-haul lane only. Its implementation scope also includes D-530's separate,
serialized, event-triggered internal lane and D-531's evaluation and
acceptance evidence for a provider, custom, or hybrid HOS strategy.
Staffing recommendations name the required business and engineering
responsibilities, not specific people or headcount; combine roles where
practical, while retaining independent review for legal, safety, and
production-acceptance decisions. Do not start a dependent milestone until its
prerequisites and owner decisions are recorded.

| Milestone                                                      | Depends on                                                                 | Bounded scope and exit evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Recommended staff                                                                                                                                                                                                                                                   |
| -------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **B4.1. Operationalize Capacity Commitment**                   | B4 CC service package and migration                                        | **Local implementation and recovery checks complete.** The standalone migration job, worker runtime, dedicated local database/broker, least-privilege roles/ACLs, health/readiness, metrics, and runbook are in place. Local checks verify idempotent migrations, changed-checksum rejection, durable command/outcome flow, PostgreSQL-unavailable readiness and recovery, and runtime restart/recovery after RabbitMQ returns. Production deployment, monitoring, HA/DR, and operational qualification remain separate gates; keep production enablement disabled until accepted.                                                                                                                                                                                                                                                                                                                                                                            | CC/backend engineer; platform or SRE engineer; QA/reliability engineer; dispatch operations reviewer for alerts and runbooks.                                                                                                                                       |
| **B4.2. Close planning inputs and acceptance**                 | None; can proceed in parallel with B4.1                                    | **Synthetic evidence-contract scaffold implemented; validation method selected under D-525 and baseline-first threshold approval under D-526; milestone exit remains blocked on real owner evidence.** Run provider sandbox checks then read-only representative-lane shadow validation; calibrate from up to 24 stratified months of company history; complete the full planning-critical Fleet Readiness catalogue in reviewable fact groups; replay up to 12 representative stratified months; then have Dispatch owners approve numeric operational-quality thresholds based on replay metrics and cohort coverage. D-521 through D-523 already select the calendar, notice, and emergency authority. These methods do not replace actual outcomes, adequate data, source approvals, or owner acceptance.                                                                                                                                                 | Transportation executive or designated product decision-maker; fleet dispatcher and contract-capacity dispatcher SMEs; Dispatch operations lead; route/data analyst; technical lead; qualified legal/safety reviewer where a gate depends on legal or safety facts. |
| **B4.3. Deliver planning-critical Fleet Readiness facts**      | B4.2; B4.1 before operational integration                                  | Implement only the approved fact catalogue, source/evidence references, verification and expiry behavior, revisions/freshness, and change notifications needed by Dispatch. Demonstrate fail-closed behavior for missing, stale, invalid, and superseded facts, plus correction/reconciliation behavior. Do not infer facts from unapproved integrations or placeholder defaults.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Fleet Readiness domain engineer; fleet dispatcher and contract-capacity dispatcher fact owners; integration engineer; QA engineer; Dispatch representative to verify consuming gates.                                                                               |
| **B4.4. Implement scheduled Dispatch Planning**                | B4.1, B4.2, and B4.3                                                       | Persist planning attempts and exact input/estimate provenance; evaluate feasible Load/Trio candidates against approved gates; implement D-527's complexity-, zone-, and mileage-based matching after the remaining D-528 prerequisites are approved: authoritative requirement/capability mappings, rank-point and tie rules, precedence among policy stages, fallback tie-breaks, deadline source, and route-mileage/chain accounting. D-527 already settles the system/dispatcher blend, matching-index formula, and Reservation lifecycle/timing. Defer competition tiers until operating data supports them; do not introduce trip-duration matching bands. Preserve frozen eligibility snapshots, CC atomic reserve/replace handoffs, and guarded Assignment activation. Exercise configured calendars and failure cases with deterministic fixtures. Keep any unapproved route/fact gate fail-closed and do not activate Assignments in this milestone. | Dispatch Planning domain engineer; Dispatch operations lead and dispatcher SMEs; route/data analyst; CC integration engineer; QA/test-automation engineer.                                                                                                          |
| **B4.5. Implement guarded Assignment activation and recovery** | B4.4 acceptance; B4.1 operational CC; Load and Execution handoff contracts | Implement the pickup-day activation guard, finalization checks, CC confirmation, immutable Assignment publication, and Execution acknowledgement/recovery. Prove refusal and recovery paths for changed Load requirements, stale readiness, failed confirmation, Assignment activation refusal, duplicate delivery, and failed Execution creation without losing committed state.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Dispatch domain engineer; CC engineer; Load and Execution owner engineers; Dispatch operations lead; QA/reliability engineer.                                                                                                                                       |
| **B4.6. Run end-to-end acceptance and enablement review**      | B4.1–B4.5                                                                  | Rehearse nominal cycles and agreed failure/recovery scenarios across Fleet Readiness, Dispatch Planning, CC, Load, and Execution; verify alerts, audit evidence, access controls, and operator procedures. Enable the capability only after owner acceptance and separate production qualification. Contractor offer/acceptance/commitment remains explicitly out of scope.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Technical lead; SRE/platform engineer; QA/reliability lead; Dispatch and Fleet operations owners; transportation executive for acceptance; security/privacy or legal reviewer where applicable.                                                                     |

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
