# TMS open decisions

This register tracks unresolved decisions and capability-specific
implementation prerequisites. Items may also summarize approved baselines so
that settled choices are not mislabeled as open. Do not turn an unresolved
item into a requirement through implementation convenience; record an
accepted decision in its owning document, including rationale, and update
this register to show what remains.

## Product intent and operational acceptance

1. **Operational success criteria:** Define measurable criteria for
   demonstrating that the single-company TMS reliably governs Loads from
   booking through delivery closeout. D-505 establishes the overall
   acceptance baseline: no loss or duplication of acknowledged writes,
   owner-correct and auditable state, terminal outcome or visibly actionable
   pending recovery for every accepted Load, and successful nominal and
   deterministic failure-path scenarios. It applies the selected 99.5%
   monthly availability, RPO 0 for acknowledged bookings, and RTO at most
   four hours for critical restoration targets. D-504 separately owns
   platform-foundation acceptance. Business-specific scenarios and any
   additional operational KPIs must be defined with the capability that
   owns them; no blanket product-acceptance decision remains open.
2. **Target operational scope and acceptance:** Define the intended coherent
   TMS capability, measurable operational acceptance criteria, and any
   exclusions or additions beyond the minimum target. The minimum currently
   identified scope and the principle that the TMS remains a bounded core
   distinct from adjacent systems are recorded in the system blueprint and
   responsibility map. This is not a commitment to implement the full target
   in one delivery or to prioritize a narrow customer-facing showcase.
   Product, business, architecture, infrastructure, contracts, and operations
   are developed iteratively as one system; implementation increments are
   prioritized by technical importance, architectural learning, risk,
   dependency order, system integrity, and end-to-end verifiability. A
   distinct platform-foundation phase before business-workflow implementation
   is selected. The prioritization principles are agreed in D-482; the
   maximum scope remains intentionally undefined. Product-wide baseline
   acceptance is selected in D-505; each business capability must still
   define bounded acceptance before implementation. Neither open maximum
   scope nor a customer-showcase release blocks D-504 platform foundation.
3. **Evidence application:** Research practices are evidence, not
   requirements by imitation; adopted practices must record source, date,
   applicability, and owner decision. Legal/regulatory requirements require
   authoritative sources and qualified review. Apply this policy to the
   remaining unresolved operating assumptions and document their evidence.
   This is a gate for adopting operational or legal policy, not for
   implementing the platform foundation.

## Identity and access

4. **Principal and account model:** Staff and in-house/contracted drivers
   authenticate in the initial operational release; customer and carrier
   office accounts are deferred. Fleet Readiness owns driver operational
   profiles. Driver invitations are bound to an existing profile and its
   verified contact, and the driver cannot self-select or change the link.
   Contracted-driver profiles require a verified link to an active Carrier
   with recorded relationship evidence. Driver profile states and
   preservation of active work on suspension/closure are selected. Define
   detailed Carrier relationship verification/reverification procedures.
   Identity-to-driver linking is one-to-one and corrections require approval
   from both Identity and Fleet Readiness owners. The unresolved
   relationship procedure blocks driver onboarding and contracted-driver
   authorization, not the platform-foundation phase.
5. **Identity detail:** OIDC Code + PKCE, access-token claims and role
   scopes, managed signing-key rotation, domain-owned resource authorization,
   short-lived OIDC client-credential tokens for service APIs, and unique
   TLS-authenticated RabbitMQ identities and workload-credential rotation
   are selected. Runtime identities have least-privilege access and cannot
   manage topology; the exact per-service broker ACL matrix remains open and
   is required before enabling each service's production messaging identity.
   Local token validation, bounded JWKS caching, and high-impact live
   revocation checks, `RS256`, and 15-minute audience-bound service tokens
   are selected.
6. **Authentication and lifecycle:** Invitation, account states, MFA
   coverage and factors, password baseline, Argon2id hashing, recovery, and
   session lifetimes are recorded in the
   [technical workflow](TECHNICAL_WORKFLOW.md). Define network-level
   throttling and support identity-verification procedures before exposing
   Identity to its intended users. Routine
   role-change propagation is bounded by the 15-minute access-token
   lifetime; high-impact session revocation is immediate. The initial
   Argon2id parameters and account-level failed-login throttling policy are
   selected.
7. **Authorization model:** Role grants and two-person approval for
   privileged grants by distinct initiator/approver are established. A separate
   `tms_operations_administrator` may prepare recovery, but business-state
   replay requires owner approval. Define the role-to-action matrix and
   provider-specific geography normalization, confidence, and operations,
   fleet/carrier/individual relationship scopes, delegation and absence
   coverage, and separation-of-duties rules.
   The shared execution-only authority for in-house and contracted drivers
   and the domain-owned write-authority split are selected.
   D-506 selects default-deny authorization, Identity-owned authentication
   and grants, and owner-service authorization combining role with applicable
   area, resource, relationship, Assignment, and lifecycle scope. Explicit
   time-bounded delegation, audit, and selected separation-of-duties rules
   are also selected. D-513 and D-515 close the initial Load booking/read
   matrix and its geographic scope: Load derives a leaf zone from the first
   pickup under the Census-based state/division map with a Los Angeles–
   Long Beach five-county CSA carve-out;
   area-scoped brokers submit and become handling brokers; handling brokers,
   area supervisors, and the specified company-wide supervisory roles have
   distinct read scopes; submission results require creator or complete
   resource access. Other protected services must still publish their
   operation-level role/action/resource matrices before implementing
   protected writes or enabling their production authorization policies.
   Detailed delegation and coverage rules remain open outside the explicit
   Load access granted by D-513. This is a capability-specific implementation
   gate, not an open authorization architecture decision or a blocker to
   platform conformance tests and documented unauthenticated
   health/readiness endpoints.
   The Load geocoding direction is selected: use an integrated provider
   behind a Load-owned port to resolve normalized pickup addresses to state
   and county FIPS. Do not use ZIP-only lookup as an authorization fallback;
   unresolved or ambiguous results fail closed. Before production use, select
   and validate the exact provider, normalization procedure, provider/data
   versioning and refresh controls, privacy/retention terms, timeout and
   availability behavior, and confidence/ambiguity handling. A future route
   integration remains a separate planning contract and capability gate.
8. **Identity audit and data protection:** Identity audit events are
   append-only and cover account lifecycle, authentication/MFA, recovery,
   sessions, and grants/approvals without storing secrets. Retention is one
   year except for documented holds, and review is restricted to designated
   Identity/security administrators. Define alert ownership, remaining
   privacy controls, and required evidence for Identity production
   qualification. Apply the approved one-year Identity audit retention
   baseline; do not represent its exact implementation controls as settled.

## TMS duty and lifecycle coverage

9. **Complete TMS duty map:** The minimum target currently includes the
   booked-Load-to-Execution-closeout core and connected responsibilities
   marked in scope in the [responsibility map](TMS_SCOPE.md). Confirm any
   additions or exclusions beyond that minimum and maintain the maximum-scope
   boundary; the map is not a final release checklist.
10. **Workflow and record relationships:** Define how TMS work enters,
    changes, moves between responsible domains, and reaches completion,
    including the authoritative records and relationships at each stage.
    The accepted-tender-to-planning relationship is selected in D-484;
    complete the remaining lifecycle and handoff map without reopening
    settled ownership boundaries.
11. **Adjacent TMS scope:** The core includes a minimal Counterparty Registry
    and Fleet Readiness boundary, plus manual tenders to existing approved
    Carrier profiles. Load-board marketplace sourcing and automated
    procurement are excluded; the `contract_capacity_dispatcher` owns tender
    sending and response tracking. Tenders record the offered Carrier rate
    and, when accepted, the agreed rate and currency; payables and settlement
    are excluded. A responsible dispatcher may withdraw a tender before it
    is selected as binding, including after acceptance. When multiple
    Carriers accept, the dispatcher selects one accepted tender as binding;
    only that Carrier is eligible for planning. Competing tenders are closed
    externally and their history is preserved. Before Assignment activation,
    the binding selection may be auditably superseded; reselection of an
    earlier acceptance requires Carrier reconfirmation. After activation,
    Carrier changes use Load amendment/replanning or cancellation. Carrier
    acceptance and tender selection do not reserve capacity. The Carrier and
    dispatcher may exchange multiple
    counteroffers. Each new offer or counteroffer starts a response period
    with a one-hour default deadline, editable per tender. The responsible
    `contract_capacity_dispatcher` may accept a Carrier counteroffer without
    blanket supervisor approval. Notify the dispatcher immediately on each
    Carrier counteroffer, acceptance, rejection, or expiry; do not send
    pre-deadline reminders. Counteroffer rounds have no fixed maximum.
    Counteroffers may change only rate and currency;
    if either party misses a round deadline, the entire tender expires and a
    late response cannot reopen it.
    Load scope or operating requirement changes use normal Load amendment and
    replanning. Each tender has one fixed rate basis:
    `FLAT_PER_LOAD`, `PER_MILE`, `PER_KILOMETER`, `PER_HOUR`, `PER_STOP`, or
    `OTHER` with an explanation. Flat rate is the indicative total. Other
    bases calculate an indicative total from planned distance, duration, or
    stop count in a specific Trip Plan revision; no calculated total is shown
    for these unit bases before a plan exists. A new revision recalculates the
    current estimate while preserving prior estimates. `OTHER` has no
    calculated total. USD is the only initial currency; no conversion occurs.
    The responsible dispatcher contacts Carriers through
    the existing external channel and records sent offers and responses in
    the TMS; automatic external delivery and a Carrier portal are excluded.
    Each round may include an external message reference or supporting
    attachment; copied message bodies are excluded.
    Tender rates use at most two decimal places and must be greater than
    USD 0.00. Indicative USD totals are rounded half up to the nearest cent.
    The exact tender payload and remaining tender terms are open. A Load
    amendment preserves the binding Carrier and requires replanning of the
    exact new revision; whether changed requirements require a new rate or
    renewed Carrier acceptance remains open. Load cancellation automatically
    cancels open tenders and notifies
    the responsible dispatcher, who contacts the Carrier through the external
    channel; the TMS preserves negotiation history.
    Customer-service follow-up is Load-linked and internal; portals and
    standalone CRM/case management are deferred. Transportation documents
    remain with their owning Load revision or Execution; generic document
    management is deferred. Operational reporting includes KPIs such as
    on-time performance and utilization. On-time measurement compares
    recorded arrival with confirmed appointment windows at each stop, reports
    pickup and delivery separately, and excludes stops without a confirmed
    appointment. Equipment utilization uses time under a confirmed Assignment
    and Capacity Commitment reservation as its numerator; its denominator is
    declared operational-availability time. Unknown/stale availability is
    excluded from both denominators and reported separately. Corrected past
    availability intervals recalculate historical metrics while preserving
    source revisions. Driver utilization uses confirmed Assignment time as
    its numerator and declared operational-availability time as its
    denominator. Cancelled/superseded reservations and Assignments count only
    until their effective end. Fleet Readiness is the source for declared
    availability; define its detailed freshness/revision rules and
    accountable owners for both measures. Include in-house and contracted
    resources when declared available and confirmed. Daily, weekly, and
    monthly periods use the company-wide `America/Los_Angeles` timezone;
    weeks begin Monday at 00:00. Financial, accounting, and settlement
    reporting are excluded. Maintenance status may block
    readiness/availability only. The `fleet_dispatcher` records and verifies
    in-house equipment status; the `contract_capacity_dispatcher` does so for
    contracted equipment. Each fact records status, reason, evidence
    source/reference, verifier principal, observed time, and valid-through
    time. Missing/expired status is unknown and blocks planning. Use the
    evidence's valid-through date when present; otherwise, the dispatcher sets
    a finite deadline. Evidence must reference a verified maintenance record
    or inspection; attach a supporting document when one exists, but an
    attachment is not mandatory. Work orders, maintenance scheduling, and
    parts management are outside scope. Broader fleet administration remains
    open.
12. **Operational adjustments and claims:** Customer charge proposals and
    Carrier cost proposals are distinct Load-linked workflows, both in scope;
    neither authorizes invoicing, Carrier payment, or settlement. The Customer
    workflow uses the Carrier accessorial type catalogue as distinct Customer
    charge types, but links each proposal only to its Load. Only the broker
    responsible for handling a Load may submit its proposal; the standard
    broker role includes this permission. The area supervisor
    reviews; if they submitted the proposal, another authorized supervisor
    reviews, with chief-supervisor or transportation-executive coverage.
    Outcomes are `SUPPORTED`, `NOT_SUPPORTED`, or `NEEDS_INFORMATION`; the
    latter returns the proposal to the broker for added information and
    resubmission as a new immutable revision under the same proposal ID,
    preserving prior revisions and review history. Customer proposals use USD
    only, require a positive amount to two decimal places, and require an
    evidence source/reference; attach a file when one exists, but an
    attachment is not mandatory. The standard broker role includes Customer-
    charge submission permission, limited to the broker handling the Load.
    Further review rules remain open. The workflow ends at internal review; the TMS records
    no Customer notice or response and does not track invoicing or payment.
    Carrier cost proposals record type, reason, amount/currency, evidence,
    requester, and internal review outcome; link each to its Load and Carrier
    profile, not to a tender round. The Load's area supervisor reviews them,
    except that a supervisor cannot review their own submission; another
    authorized supervisor reviews, with chief-supervisor or
    transportation-executive coverage. Outcomes are `SUPPORTED`,
    `NOT_SUPPORTED`, or `NEEDS_INFORMATION`; the latter returns the proposal
    to its requester for added information and resubmission as a new
    immutable revision under the same proposal ID, preserving prior revisions
    and review history. `contract_capacity_dispatcher` and the broker handling
    the Load have Carrier cost proposal submission permission; submission
    requires Load access. Initial types are
    `DETENTION`, `LAYOVER`, `LUMPER`, `DRIVER_ASSIST`, `REDELIVERY`,
    `TRUCK_ORDERED_NOT_USED`, `FUEL_SURCHARGE`, `TOLL`,
    `EQUIPMENT_SURCHARGE`, `HANDLING`, and `OTHER`; `OTHER` requires an
    explanation. Carrier cost proposals use USD only, require an amount
    greater than USD 0.00 to two decimal places, and require an evidence
    source/reference; attach a file when one exists, but an attachment is not
    mandatory. Further review rules and alternate-supervisor grant
    administration remain open.
    Customer invoicing, accounting/AR/AP, Carrier payables, and settlement
    remain deferred. Under D-512, the TMS records a minimal Load-linked issue
    and handoff status; the receiving out-of-scope service owns assignment,
    status, and resolution. The TMS does not maintain an internal post-
    delivery claim lifecycle and never sends the detailed Load record as the
    issue handoff. Issue types, type-specific minimum data, recipient
    services, and message contracts remain to be defined. Formal insurance
    handling, legal adjudication, and financial settlement are outside TMS
    scope.
13. **Safety and compliance details:** The TMS is limited to verified,
    planning-critical safety and contractual facts and approved hard gates;
    it will not interpret legal/regulatory rules, provide regulatory
    reporting, or manage safety cases. Define the specific facts, evidence,
    accountable owners, gate rules, and authoritative sources with qualified
    review before treating any applicable rule as product policy.

## Capability-specific implementation-readiness gaps

D-504 approves the platform-foundation phase and its acceptance evidence in
the [system blueprint](TMS_SYSTEM_BLUEPRINT.md#approved-platform-foundation-increment).
The gaps below are not a blanket prohibition on that phase. Each is a
readiness gate for the named business capability or production qualification;
do not implement the dependent behavior by assumption. The
[implementation-readiness matrix](IMPLEMENTATION_READINESS.md) summarizes
which increment each gate affects; this register remains authoritative for
the unresolved details.

14. **Booking and stage-completeness fields:** Decisions D-497 and D-498
    and [the shared contract](../contracts.md) now define the semantic booking
    request inventory and the exact durable issue, accepted follow-up, and
    planning-readiness payloads, including D-487's omission-and-correction
    behavior, freight-line handling-unit counts, required stackability, and
    conditional per-unit dimensions. Hazardous-material detail, supplemental
    Customer/Carrier links, and future trailer packing optimization remain
    out of this booking contract. The semantic booking decision does not
    close transport-level contract work: a partial Load OpenAPI specification
    is published, with remaining API details tracked in item 17. Remaining
    planning-source and calibration gaps are
    tracked in item 21. D-503 settles the Execution/evidence logical
    schema and delivered-quantity representation; exact operation payloads
    and production evidence controls remain in item 22.
    Decisions D-495 and D-512 establish the Trip and per-Load Execution
    closeout gates, evidence rules, actual quantity/location recording, and
    separation of Trip completion from Load closeout. Both Load and
    per-Load Execution become terminal when the transportation attempt ends,
    including when freight remains or delivered quantities differ. The
    Execution-start gate is selected in D-481. D-496 preserves terminal
    lifecycle state; D-512 assigns ongoing issue follow-up to the receiving
    out-of-scope service and requires only a minimal linked issue record and
    handoff state in TMS.
15. **Customer and Carrier boundaries:** The Counterparty Registry, shared
    organization identity with separate Customer/Carrier profiles, initial
    status lifecycle, basic registry fields, applicable DOT/MC references,
    and Customer-name snapshot on Load revisions are selected. D-514 closes
    the Load-specific status/legal-name fact projection, freshness,
    reconciliation, and booking-failure behavior. Define complete customer/carrier
    onboarding and contact lifecycle, exact
    eligibility facts and verification sources, and status-change
    notification/revalidation procedures for responsible owners. These gate
    the dependent Counterparty Registry and Fleet Readiness workflows, not platform
    foundation. D-507 defines their logical record schemas. D-509 selects
    source-backed, versioned, fail-closed planning facts; the fact catalogue
    and each required field's approved source, verifier, and validity period
    must be completed before enabling the corresponding planning gate.
    Decisions D-490 and D-491 assign
    planning-critical Carrier eligibility facts and evidence to Fleet
    Readiness, with Dispatch Planning evaluating each applicable fact
    independently. Decision D-492 selects manual evidence review without
    assuming live integration. Still define the fact catalogue, approved
    authoritative sources, verifier roles, validity periods, and required
    agreement-reference fields and verification rules. Carrier agreements
    remain externally authoritative under D-493. D-494 requires immediate
    notice to responsible owners when an eligibility fact becomes invalid,
    expires, or is superseded; delivery and acknowledgement mechanics, and
    notifications to responsible owners about Registry status changes,
    remain open. Decision D-488
    establishes that a Customer status change blocks future bookings only;
    already accepted Loads continue unless separately amended or canceled.
    Decision D-489 establishes that a non-active Carrier cannot be selected
    for a new binding tender or have a pending Assignment activated;
    pending Assignments and reservations are retained for explicit dispatcher
    action, while existing active Assignments and Execution continue until an
    authorized reassignment or cancellation.
16. **Schema implementation and production controls:** D-501 defines the Load and booking
    schema; D-502 and the
    [Dispatch Planning/CC schema baseline](TECHNICAL_WORKFLOW.md#dispatch-planning-and-capacity-commitment-relational-schemas)
    define planning attempts and leases, exact input/estimate provenance,
    human-review records, immutable Trip Plans and Assignments, reservation
    revisions/transitions, resource claims, and the GiST exclusion rule.
    D-503 and the
    [Execution/evidence schema baseline](TECHNICAL_WORKFLOW.md#execution-and-evidence-relational-schema)
    define Execution/evidence records. D-507 defines logical schemas for
    Counterparty Registry, Fleet Readiness,
    Load stage-completeness/follow-up, cancellation/release confirmations,
    charge/cost proposals, operational claims, Identity, Notification,
    Operations View, and reusable service-local inbox/outbox/idempotency
    records. This completes the target owners' logical-schema baseline;
    schemas do not constitute production migrations or ORM mappings.
    Relationships, named constraints, and access-path indexes are specified
    at the logical level. Each service retains its own database and
    authority; do not create cross-service foreign keys or a global
    relational schema.
    Apply PostgreSQL foreign-key, `UNIQUE`, and named `CHECK` constraints;
    default to `ON DELETE RESTRICT`, allowing cascades only for explicitly
    disposable subordinate data. Use ordered, service-local SQL migrations
    with a checksum-verified ledger, a lock-protected deployment job, and
    transactional execution by default. Apply additive expansion before
    promotion; perform destructive cleanup only after old instances drain.
    Failed migrations block promotion and require forward repair. Production
    migration SQL, migration-runner behavior, workload-measured query-plan
    validation, and approved data-class-specific retention schedules remain
    implementation/production work; automated deletion remains disabled
    until the relevant retention schedule is approved.
17. **API and message contracts:** D-508 selects the shared contract guide
    as semantic/cross-service guidance and one canonical service-owned
    OpenAPI 3.1 specification per HTTP service plus one AsyncAPI 3.0
    specification per durable-message owner, under `docs/api/`. Runtime
    validation and CI compatibility checks are selected. The semantic
    booking inventory and selected shared behavior are not open. The
    [API specification index](../api/README.md) lists the currently
    published partial Load and Execution OpenAPI documents and the partial
    Load, Execution, Capacity Commitment, and Dispatch Planning AsyncAPI
    documents. Complete the remaining HTTP-service route inventories,
    operation-specific validation outcomes, and amendment request/response
    schemas. Rejected amendment attempts are retained in their idempotency
    results with deterministically ordered issues; they create no Load
    revision or revision fact. Fill operation-specific idempotency gaps and
    validate contract compatibility in CI. These artifacts and remaining
    contract details are prerequisites for their own APIs/message flows, not
    for unrelated capabilities or the platform foundation. Item 18 tracks
    remaining message schemas and recovery scenarios.
18. **CC, Assignment, and cancellation protocols:** The core command/outcome
    identities, ownership, reservation and Assignment state transitions,
    idempotency scopes, cancellation coordination, and recovery rules are
    recorded in [the service contracts](../contracts.md),
    [the decision log](DECISIONS.md), and
    [the technical workflow](TECHNICAL_WORKFLOW.md). The currently specified
    message exchanges have partial owner-specific schemas in the
    [API specification index](../api/README.md). Complete the durable
    message inventories and payloads for all remaining service interactions,
    including owner-specific snapshot request/results, before implementing
    those workflows. Add executable acceptance coverage for the coordinated
    active-Assignment amendment handoff, including its ten-minute
    revalidation expiry and release recovery, before implementing that
    handoff. Item 17 tracks the shared contract-publication and compatibility
    work.

19. **Deadlines, leases, and freshness:** Initial booking response deadline,
    Dispatch lease, CC hold, Load guard, pickup escalation, notification
    acknowledgement, ten-minute active-Assignment amendment-revalidation
    expiry, and Operations View freshness thresholds are recorded in the
    [technical workflow](TECHNICAL_WORKFLOW.md). Owner-defined,
    per-fact freshness is selected; Customer status remains valid until
    superseded, while availability has its selected 15-minute window.
    Event-fed projection lag targets are p95 at or below five seconds and
    stale at 30 seconds for required updates. Determine remaining individual
    validity values before the corresponding planning or eligibility gates
    are enabled; define recovery for other owner-service outages before the
    affected workflows depend on them; and settle the internal availability
    measurement boundaries, including planned-
    maintenance treatment. Booking
    fails closed with retryable `503` and `CUSTOMER_STATUS_UNAVAILABLE` when
    current Customer status cannot be established. During Temporal outages,
    durably accepted owner work continues idempotently and orchestration
    resumes from durable state after recovery. The internal availability
    target is 99.5% monthly for critical APIs/workflows, not a customer-facing
    SLA. RPO 0 for
    acknowledged bookings and RTO at most four hours for critical TMS service
    restoration are selected. The platform-neutral baseline is a
    Load's booking-critical PostgreSQL cluster uses a single-region HA
    deployment with synchronous standby, automatic failover, continuous
    point-in-time backups, and tested restore drills; provider-specific
    implementation remains open.
20. **Revision concurrency:** Immutable revisions, full-snapshot amendments,
    the pre-execution boundary, and conditional amendment API behavior are
    selected. Specify exact lease and finalization-guard protocols, remaining
    conflicting-edit behavior, Trip Plan amendment and reservation
    replacement, and revalidation outcomes under concurrent changes.
21. **Planning policy implementation prerequisites:** Decisions D-499,
    D-498, D-511, D-516, D-529, D-530, D-531, and
    [D-527](DECISIONS.md#d-527--use-complexity--zone--and-mileage-aware-balanced-matching),
    together with the
    [shared planning contract](../contracts.md#initial-dispatch-planning-policy),
    define hard-gate categories, fail-closed treatment of missing/stale facts,
    the D-515 LA homeland zone, mileage-based trip-length inputs, the
    14-day/five-Load rolling reservation limit, atomic CC behavior, and bounded
    planning cycles. D-529 defines one append-or-final-replacement change per
    external cycle; D-530 separates internal, event-triggered autonomous
    matching from scheduled external matching with dispatcher lists. D-531
    requires an explicit provider/custom/hybrid HOS strategy before
    HOS-dependent automation. Approve the authoritative owner and write
    permissions for the two Trio pool classifications before implementation.
    D-527 supersedes D-516's ordinal matching,
    requirement-level partition, preference/fallback passes, coverage
    priority, upgrade ordering, and same-day Assignment timing. Retain
    D-516's frozen eligibility snapshot, CC authority, and atomic replacement
    safeguards where compatible.

    Before matching implementation, approve: (a) authoritative Load
    requirement fields and evidence for assigning the four D-527 complexity
    levels; (b) evidence-backed Trio mapping to independently supported
    primary and auxiliary levels from driver, tractor, and trailer facts,
    including how revisions affect membership and an in-progress cycle;
    (c) any additional classes, equipment variants, and exceptions;
    (d) exact capability evidence and allocation treatment for surplus and
    already-reserved Trios under D-527's same-level-first, nearest-higher-
    level surplus sequence, including any reservation states outside its
    lower-class-held and same-class-held sublevels;
    (e) the matching-index formula is selected: multiply pair-specific
    contribution per committed hour by contribution per total operational
    mile, using a negative score when both rates are negative, zero when
    either rate is zero, and review when their signs conflict. Fixed monthly
    overhead is excluded from matching and accounted for separately. The
    system/dispatcher rank blend is selected at 60/40. Normalize each list
    linearly to 0-100 rank points; the original system list supplies system
    points and the dispatcher-submitted list supplies dispatcher points.
    Tie handling within an ordering remains open. Score priority governs
    while submitted lists remain; after exhaustion, remainder allocation
    maximizes coverage first and then aggregate signed index among
    equal-coverage variations. Dispatcher-removed Loads may still be selected
    at fallback and submitted to CC without another dispatcher confirmation
    if hard gates pass. A 10% margin and stop/day/HOS tie-breaks are deferred.
    Still define auditable variable-cost inputs and their sources and allocation methods;
    validate revenue, expense, time, and mileage calculations against company
    operating/accounting data; and approve any future coefficients for
    measurable non-monetary execution factors. Version one remains limited
    to monetary technical inputs and must not apply subjective complexity
    weights. The service boundary is selected: planned Financial/Accounting
    owns actual financial facts and context/time cost aggregates; Economics
    consumes them for planning-specific estimates. See
    [the service specification](OPERATIONAL_ECONOMICS_SERVICE.md). Exact
    source-system mappings, aggregate dimensions/formulas, per-scope
    estimate formulas/fields, freshness rules, read-model dimensions, and
    production message details remain open;
    (f) evidence-backed technical criteria and their ordering for LA-
    destined Load/Trio matching and remaining-capacity allocation; remaining
    conflicts across sole stages and any strong resource-review hold that
    blocks final Assignment activation; and (g) the authoritative
    route-mileage source and multi-Load chain accounting for the cumulative
    3,400-mile away-trip limit, farther-away test, and exemption/reset at LA
    departure/return; (h) inventory required HOS calculations, source data,
    and acceptance coverage, then evaluate qualified provider, custom, or
    hybrid implementations without preselecting a vendor or code owner; and
    (i) select the authoritative owner and entry/approval/event contract for
    Trio pool membership and driver future-unavailability intervals, distinct
    from HOS-derived rest.

    Before allocator implementation, define CC rejection and stale-snapshot
    handling. Distinguish transient technical failures, business capacity
    conflicts, and changed source revisions. Recommended starting behavior:
    retry transient failures at most twice after the initial idempotent
    request; do not retry an unchanged business-conflict claim, but refresh
    capacity and reallocate; restart the cycle from a fresh snapshot if
    cycle inputs become stale, rather than mixing revisions.

    D-527 settles the Reservation lifecycle and guarded Assignment
    activation: create new Reservations in non-morning scheduled or
    authorized exception allocation cycles, replace only through CC's
    atomic operation, and activate Assignments only from valid confirmed
    Reservations after exact-revision guard and hard-gate checks. The
    morning cycle remains forecast-only for new capacity. Other matching
    details above remain open prerequisites, not a numeric or executable
    matcher specification.

    Defer market-competition tiers until operating data identifies the zones
    in which the company concentrates its work. Do not invent trip-duration
    bands; use actual duration only where schedule or feasibility requires it.

    Existing secondary candidate gates and planning criteria to review when
    finalizing category filters are: Carrier/equipment/driver suitability;
    current readiness and legal/safety facts; pickup/delivery geography and
    route; appointment windows, schedule buffer, calibrated stop times and
    long-trip rest-place capability; load dimensions and weight within the
    initial planner's stated limits; complete resource-window capacity;
    the 14-day horizon and five-Load chain limit; minimum pickup notice; and
    strong explicit driver/resource objections. D-499's resource-plan
    ranking—appointment buffer, deadhead/repositioning, valid preferences,
    unnecessary changes and segments, then stable IDs—applies only among
    hard-gate-passing plans and is not itself the new Load/Trio benefit score.
    D-517's 100-mile replacement-Load deadhead allowance remains a separate
    recovery rule.

    D-517 selects the initial `America/Los_Angeles` schedule, four daily
    allocation times at 10:00, 13:00, 16:00, and
    19:00, followed by the next-day 07:00 closing/morning run; a 15-minute
    preference cutoff applies to allocation cycles. D-521 configures the
    sequence for all seven days, including holidays unless an explicit
    operation-calendar closure applies. The 100-mile replacement-load
    deadhead limit remains.
    D-522 sets a four-hour minimum pickup notice for both scheduled and
    emergency cycles and marks Loads with under four hours to the fulfillment
    deadline as `EMERGENCY` in the morning run; this label does not waive
    pickup notice. The authoritative Load field/source for fulfillment
    deadline and missing-deadline behavior still require definition. D-527
    routes zero-technically-feasible unassigned Loads with under 72 hours
    to deadline externally at the first daily cycle, and technically
    feasible Loads still unassigned after the 19:00 cycle externally for
    next-morning follow-up. Under
    D-523, an authorized dispatcher requests an
    emergency cycle only when waiting for the next scheduled cycle would miss
    the latest-safe planning time; an area supervisor approves, with the
    chief supervisor as fallback. The four-hour minimum is not waived.

    D-518 selects Trimble Maps / PC*Miler as the initial source behind the
    provider-neutral route adapter. Representative-lane and actual-outcome
    validation, vehicle/load profile completeness, and immutable request/
    response provenance must be demonstrated before route-dependent
    automated finalization. Routing output is not legal or safety authority.
    D-519 selects calibration from the company's completed-trip history,
    with versioned assumptions and dispatcher review until the evidence is
    sufficient. The history cohort, stop categories, calibrated values, and
    evidence sufficiency must still be established and approved.

    D-520 selects manual evidence review and defers live integrations for
    the initial planning-critical Fleet Readiness catalogue. The fact-by-fact
    definitions, authoritative sources, verifiers, evidence references,
    validity periods, revision/freshness rules, and consuming gate behavior
    remain to be completed under item 15. Obtain qualified authoritative
    review before enabling legal or safety gates. Missing, stale, invalid, or
    superseded facts remain fail-closed; do not treat an aggregate Carrier
    flag as proof.

    D-524 selects zero hard-gate violations and zero double commitments,
    deterministic fixtures for the approved matching policy, representative
    historical replay,
    and nominal/failure/recovery scenarios as Dispatch enablement evidence.
    Define and record the replay cohort, results, known limits, and any
    operational-quality thresholds before enablement. The external
    contractor offer/acceptance/commitment lifecycle and commercial cutoff
    remain outside this B4 increment; unselected Loads must not be handed
    off or double-committed. Do not claim regulatory compliance or complete
    trailer packing from the initial matching policy.

    D-525 selects sandbox checks followed by a read-only Trimble shadow pilot,
    up to 24 months of completed-trip history stratified by stop/work
    category and season, reviewable Fleet fact groups with every dependent
    gate held closed until the complete catalogue is approved, and an
    initial replay of up to 12 representative months stratified by season
    and operating conditions. These methods do not satisfy the evidence
    gates by themselves. Actual route outcomes, adequate categorized trip
    samples, approved authoritative facts, and replay results/limitations
    remain to be established and documented before enablement. Under D-526,
    report replay metric baselines and coverage first; Dispatch owners must
    approve numeric operational-quality thresholds before enablement.
    The Dispatch Planning scaffold can capture offline provider request/
    response provenance and freeze the hard-gate candidate set, but does not
    perform network calls or matching. Before implementing the allocator,
    define a deterministic requirement-level partition for strict-subset
    feasible-Trio sets when incomparable sets interleave strict-subset
    relationships; the current statement that all incomparable sets share
    a level does not uniquely define such a partition for every graph.

    Route-source validation, service-time calibration, the full Fleet fact
    catalogue, and replay evidence block dependent automated planning, not
    the independent Capacity Commitment reservation lifecycle, platform
    foundation, or unrelated service work. The local Capacity Commitment
    deployment/runtime wiring and recovery checks are implemented; production
    deployment and operational qualification remain separate enablement gates.

22. **Execution and evidence production controls:** D-503 and D-512 plus the
    [Execution/evidence schema baseline](TECHNICAL_WORKFLOW.md#execution-and-evidence-relational-schema)
    settle the logical records, integer handling-unit quantity
    representation, closeout-fact structure, 25 MB decimal per-file limit,
    and internal `ISSUED` upload state. The public polling contract continues
    to expose only `SCANNING`, `AVAILABLE`, `REJECTED`, and `EXPIRED`;
    polling an unfinalized, unexpired intent returns `409 Conflict`.
    POD is required for each stop where freight is unloaded; a stop with no
    delivery requires a final actual outcome and linked issue. An authorized,
    reasoned evidence exception is available for upload failure. Own-fleet
    POD is accepted on receipt; contractor/outer-Carrier POD requires
    dispatcher review. A dispatcher may record a delivery statement when
    upload is unavailable. Execution
    and Load close when the transportation attempt ends, even when freight
    remains or quantities differ; a minimal issue record is handed to the
    receiving out-of-scope service, which owns follow-up. Stop
    arrival/departure milestones and
    completed, partial, or not-completed outcomes are selected, including
    delivered quantities per freight line. The authorized intent,
    30-minute presigned upload, verified finalize flow, required upload
    metadata, and idempotency are selected. Asynchronous malware scanning
    and the public poll states are selected.
    POD submitters are the assigned driver, responsible dispatcher, and area
    supervisor/coverage. An authorized dispatcher may enter a delivery
    statement when POD upload is unavailable; exact operation-level
    authorization mapping remains to be specified.
    Report descriptions and remarks have selected length limits and
    append-only correction rules.
    Trip and per-Load Execution lifecycle states are selected as `PLANNED`,
    `IN_PROGRESS`, `COMPLETED`, and pre-start-only `VOIDED`. Execution
    incident and delivery outcomes remain append-only facts; post-delivery
    issue assignment and resolution belong to the receiving service.
    Detailed transition commands, exact outcome payloads, create-intent
    response headers, authorization mapping, verification-failure codes,
    and issue-handoff contracts remain to be specified. These details
    gate Execution APIs and evidence production. Production migration SQL,
    query plans, storage policy, signed headers, scanner integration, and
    reviewed evidence-retention rules remain
    production gates; automated evidence deletion stays disabled until
    those rules are approved.
23. **Notification:** Logical tables for durable inbox records, recipients,
    primary acknowledgement, versioned templates, preferences, channel
    deliveries and attempts, and audited requeue are defined under D-507 in
    the [technical workflow](TECHNICAL_WORKFLOW.md). Channels, event classes,
    recipients, acknowledgement and escalation behavior, and
    receipt-versus-resolution semantics are selected. Proposal review
    notices, Carrier tender updates, expired amendment-revalidation release
    notices, external-delivery preferences, retry limits, attempt evidence,
    retention, and authorized recovery are also selected. Versioned
    templates use concise safe summaries and authorization-aware links.
    Define the exact per-event template catalogue and delivery recovery
    runbooks before implementing or productionizing Notification.
24. **Operations View:** The logical schema under D-507 defines typed
    read projections for Loads, Assignments, Executions, exceptions, and
    resource availability, together with owner-revision watermarks,
    reconciliation, and rebuild records. The read-only view covers all
    in-scope operational records and workflows, links to owning services for actions, and does not
    write authoritative records. Its initial freshness target/stale threshold
    are established. Define exact screens/projections, rebuild/reconciliation
    behavior, and detailed grant mappings. The transportation executive and
    chief supervisor have company-wide Operations View access; other users
    are scoped by area where applicable or by their existing resource and
    relationship authority otherwise. The transportation executive owns the
    company-wide operational KPI set, including definitions and review. The
    transportation executive and chief supervisor have company-wide KPI
    dashboard access; area supervisors have access only for their assigned
    areas; other roles have no KPI dashboard access by default. The
    `America/Los_Angeles` timezone applies company-wide, with weeks beginning
    Monday at 00:00. Unknown/stale availability is excluded and displayed
    separately. The on-time KPI uses actual arrival versus confirmed
    appointment windows per stop, with pickup/delivery reported separately
    and unappointed stops excluded. Remaining projection, rebuild, and grant
    The selected utilization measure compares confirmed Assignment/reservation
    time with declared operational availability for in-house and contracted
    drivers and equipment; unknown/stale availability is shown separately.
    Corrected Fleet Readiness intervals require historical recalculation.
    Remaining screen definitions, reconciliation/rebuild runbooks, detailed
    grant mappings, and the transportation executive's complete KPI catalogue
    gate Operations View and KPI implementation, not upstream authoritative
    services or platform foundation.
25. **Recovery and acceptance scenarios:** Failure-injection boundaries
    across booking, outbox, CC, Assignment, Execution, cancellation, and
    disaster restore are selected in the
    [technical workflow](TECHNICAL_WORKFLOW.md). Automated integration tests
    use disposable real dependencies, deterministic fault injection, and
    persisted-state assertions; restore drills prove RPO/RTO. Business-state
    replay requires an owning-domain approver distinct from the technical
    operator; replay is unchanged and audited. D-504 defines acceptance
    evidence for platform foundation; D-505 defines overall TMS acceptance;
    and D-510 establishes owner-correct forward recovery, durable
    idempotency/inbox/outbox behavior, and capability-scoped fault testing.
    Before implementing each business workflow, define its exact
    failure-injection cases, reconciliation runbook, and measurable
    capability-specific acceptance, especially for operational exceptions.
    Production qualification additionally requires the approved storage,
    retention, security, and provider-specific disaster-recovery controls.

## Scope decisions retained for later

- Complete Customer and Carrier onboarding, qualification, and operating
  workflows beyond the selected Counterparty Registry baseline.
- The maximum scope beyond the minimum TMS target, including any extensions
  to carrier sourcing, customer service, tracking, document handling, fleet
  administration, safety/compliance, claims, and reporting. Existing
  boundaries remain in force: billing, accounting, accounts receivable/payable,
  and settlement are outside the TMS; marketplace sourcing and automated
  procurement are not included in the current minimum.
- Whether user-facing client applications are delivered with the TMS or
  developed separately. This is a packaging decision, not a change to
  business-system ownership.
- Client API composition remains open: evaluate owner REST APIs behind the
  API Gateway against a future Apollo Federation graph. A separate BFF is not
  recommended without a distinct client-specific need. The proposal and
  decision gates are documented in [API edge options](../api/API_EDGE_OPTIONS.md);
  no GraphQL/Federation runtime or production ingress has been selected.
- Explicit additions, exclusions, and future scope-change criteria.

## Other open design

- Same-day emergency and after-hours authority; the detailed
  complexity-, zone-, and mileage-aware matching policy and its prerequisites in
  D-527 and D-528.
- Preference strength, objection response coverage, and human-review
  conversation and disposition.
- Exact RabbitMQ exchange/queue names, per-message bindings and ACL matrix,
  routing-key catalogue, and operational monitoring/recovery runbooks.
  Domain-owned exchanges, receiver/consumer-owned queues, MAJOR-version
  routing, no default TTL, least-privilege identities, and deployment-
  managed versioned topology are selected.
- The per-Load Temporal workflow spans accepted booking through cancellation
  or Execution-confirmed closeout; it is event-signaled and does not own
  domain state. Activity retries use the shared bounded eight-attempt
  jittered policy; exhaustion parks for authorized recovery. Workflow
  changes require replay compatibility tests, version markers for
  incompatible behavior, and old-worker retention until affected executions
  drain. Continue-As-New bounds history at an initial threshold of 10,000
  events and carries forward orchestration state, owner revisions, and
  deadlines. Exact activity boundaries, timer thresholds, human waits,
  compensation, and operational repair ownership remain to be specified.
- Cluster sizing and platform failover, data and file retention, and measured
  security/operability targets beyond the selected availability objective and
  booking RPO/critical-service RTO.
- Applicable employment, carrier-contract, safety, customer-contract,
  evidence-retention, privacy, and regulatory constraints. These require
  authoritative sources and qualified review.

## Not approved as first-slice requirements

Deeper brokerage negotiation and sourcing automation, customer/carrier
portals, billing, settlement, advanced analytics, fleet maintenance, and
hours-of-service management are not approved for the first engineering
slice. Their inclusion in this list is not a commitment to build them.
