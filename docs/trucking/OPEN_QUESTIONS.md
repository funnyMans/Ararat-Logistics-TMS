# TMS open decisions

This is the concise register of material choices not yet approved. A listed
item must not become a requirement through implementation convenience.
Record an accepted answer in its owning document, including rationale, then
remove it from this register.

## Product and MVP definition

1. **Operational success criteria:** Define measurable criteria for
   demonstrating that the single-company TMS reliably governs Loads from
   booking through delivery closeout, including workflow completion,
   recoverability, and operational record integrity.
2. **Operational release scope and acceptance:** Define the usable
   operational product's approved scope, measurable release acceptance
   criteria, and non-goals. A distinct platform-foundation phase before
   business-workflow implementation is selected; the engineering vertical
   slice must prove a bounded end-to-end capability within that approved
   scope.
3. **Evidence application:** Research practices are evidence, not
   requirements by imitation; adopted practices must record source, date,
   applicability, and owner decision. Legal/regulatory requirements require
   authoritative sources and qualified review. Apply this policy to the
   remaining unresolved operating assumptions and document their evidence.

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
   from both Identity and Fleet Readiness owners.
5. **Identity detail:** OIDC Code + PKCE, access-token claims and role
   scopes, managed signing-key rotation, domain-owned resource authorization,
   short-lived OIDC client-credential tokens for service APIs, and unique
   TLS-authenticated RabbitMQ identities and workload-credential rotation
   are selected. Broker permission configuration remains open.
   Local token validation, bounded JWKS caching, and high-impact live
   revocation checks, `RS256`, and 15-minute audience-bound service tokens
   are selected.
6. **Authentication and lifecycle:** Invitation, account states, MFA
   coverage and factors, password baseline, Argon2id hashing, recovery, and
   session lifetimes are recorded in the
   [technical workflow](TECHNICAL_WORKFLOW.md). Define network-level
   throttling and support identity-verification procedures. Routine
   role-change propagation is bounded by the 15-minute access-token
   lifetime; high-impact session revocation is immediate. The initial
   Argon2id parameters and account-level failed-login throttling policy are
   selected.
7. **Authorization model:** Role grants and two-person approval for
   privileged grants by distinct initiator/approver are established. A separate
   `tms_operations_administrator` may prepare recovery, but business-state
   replay requires owner approval. Define the role-to-action matrix,
   area/load assignment rules, fleet/carrier/individual relationship
   scopes, delegation and absence coverage, and separation-of-duties rules.
   The shared execution-only authority for in-house and contracted drivers
   and the domain-owned write-authority split are selected.
   Each service remains responsible for authorizing its own records and
   transitions.
8. **Identity audit and data protection:** Identity audit events are
   append-only and cover account lifecycle, authentication/MFA, recovery,
   sessions, and grants/approvals without storing secrets. Retention is one
   year except for documented holds, and review is restricted to designated
   Identity/security administrators. Define alert ownership, remaining
   privacy controls, and required evidence for identity administration.

## TMS duty and lifecycle coverage

9. **Complete TMS duty map:** Confirm which responsibilities belong inside
   this TMS and which are explicitly out of scope. The
   [responsibility map](TMS_SCOPE.md) records current coverage and unresolved
   areas without implying that every listed capability is required.
10. **Workflow and record relationships:** Define how TMS work enters,
    changes, moves between responsible domains, and reaches completion,
    including the authoritative records and relationships at each stage.
11. **Adjacent TMS scope:** The core includes a minimal Counterparty Registry
    and Fleet Readiness boundary, plus manual tenders to existing approved
    Carrier profiles. Load-board marketplace sourcing and automated
    procurement are excluded; the `contract_capacity_dispatcher` owns tender
    sending and response tracking. Tenders record the offered Carrier rate
    and, when accepted, the agreed rate and currency; payables and settlement
    are excluded. The Carrier and dispatcher may exchange multiple
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
    The exact tender payload and remaining tender terms are open.
    Carrier acceptance is not capacity protection; normal Dispatch Planning and Capacity
    Commitment confirmation remain required before the Load is considered
    capacity-secured. The dispatcher cannot withdraw an open tender; it
    remains active until acceptance, rejection, or expiry, unless the Load is
    canceled. Load cancellation automatically cancels open tenders and notifies
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
    Customer invoicing, accounting/AR/AP, carrier
    payables, and settlement remain deferred. Post-delivery claims are
    tracked as Load-linked
    operational cases with a designated owner accountable for coordination
    through resolution, evidence, and status, not financial settlement.
    Reuse `OPEN`, `IN_PROGRESS`, and `RESOLVED`, with audited, reasoned
    reopening. Limit claims to internal operational follow-up and referral;
    formal insurance handling, legal adjudication, and financial settlement
    are excluded. A case may close after operational resolution or documented
    referral; the external claim lifecycle is not tracked. The Load's area
    supervisor assigns and may reassign the designated owner from eligible
    staff with explicit claim-owner permission, regardless of department;
    escalation goes first to the Load's area supervisor, who may escalate
    further through the supervisory chain. The owner may escalate whenever a
    case is blocked or requires a decision beyond the owner's authority; no
    time-based automatic escalation applies. The designated owner may resolve
    a case after recording an audited outcome and reason; no blanket supervisor
    approval is required. Closure outcomes are
    `OPERATIONALLY_RESOLVED`, `DENIED` (internal disposition only),
    `WITHDRAWN`, `DUPLICATE`, or `REFERRED_OUTSIDE_TMS`. A referral records
    destination, date/time, external reference when available, and supporting
    evidence.
13. **Safety and compliance details:** The TMS is limited to verified,
    planning-critical safety and contractual facts and approved hard gates;
    it will not interpret legal/regulatory rules, provide regulatory
    reporting, or manage safety cases. Define the specific facts, evidence,
    accountable owners, gate rules, and authoritative sources with qualified
    review before treating any applicable rule as product policy.

## Required before technical implementation readiness

14. **Booking and stage-completeness fields:** The first booking data groups,
    domestic address rules, stop ordering, freight units, and dry-van/reefer/
    flatbed planning gates are recorded in the
    [technical workflow](TECHNICAL_WORKFLOW.md). Still define the complete
    request schema, additional stage-specific issue codes for invalid
    provided values, remaining planning constraints, and field-by-field
    gates for execution start and delivery closeout.
15. **Customer and Carrier boundaries:** The Counterparty Registry, shared
    organization identity with separate Customer/Carrier profiles, initial
    status lifecycle, basic registry fields, applicable DOT/MC references,
    and Customer-name snapshot on Load revisions are selected. Define
    complete customer/carrier onboarding, contact lifecycle, carrier
    qualification and agreement ownership, verification sources, and
    status-change notification/revalidation procedures.
16. **Logical schemas and constraints:** Specify service-owned tables,
    relationships, uniqueness and concurrency constraints, indexes, retention,
    and migration strategy from the logical record families in the
    [technical workflow](TECHNICAL_WORKFLOW.md). Load table boundaries,
    revision-owned stop/freight tables, and booking-submission JSONB snapshots
    are selected. Revision-number/order uniqueness, same-Load head linkage,
    and database-protected revision immutability are selected; remaining
    columns, constraints, indexes, retention, and migration details remain
    open. CC resource claims use a PostgreSQL range/exclusion-constraint
    model to prevent active overlaps, with half-open windows and explicit
    repositioning intervals. Execution facts use typed append-only
    relational tables rather than a generic event/payload table.
17. **API and message contracts:** The versioned booking, cancellation, and
    Load-amendment routes, core outcome/idempotency behavior, response
    representations, and principal HTTP statuses are recorded in the
    [service-contract guide](../contracts.md). Still specify the complete
    booking/amendment request schemas, any additional issue codes, remaining
    routes, command/event names and payload schemas, serialized command
    issuer-context shape and propagation details,
    consumer migration evidence and rollout controls, remaining
    operation-specific idempotency behavior,
    and retention of other technical delivery records. Per-service
    transactional idempotency records, scope uniqueness, and result
    retention for the protected resource's lifetime are selected. Load
    customer rates use USD only, without currency conversion. The owning
    service authorizes the initiating principal and resource access at command
    acceptance; a durably accepted asynchronous command may complete after
    permission changes, subject to domain state and concurrency checks.
    Consumers ignore unrecognized optional fields in supported versions and
    quarantine unsupported versions; define quarantine monitoring and replay
    procedures. Owner services publish specific versioned facts rather than
    full snapshots; consumers reconcile the current owner snapshot when
    required. Exact command/event payload schemas remain open.
18. **CC and Assignment protocol:** Define exact command/event names and
    payloads, transition ordering, cancellation release confirmations from
    Execution when a planned record exists, partial-failure handling, and
    reconciliation across Dispatch Planning, CC, and Load finalization.
    Cancellation of one member
    requires revalidation and atomic reservation replacement for a feasible
    remainder. Complete ordered segment reservation payload and all-or-none
    behavior and privacy-safe accepted/rejected result shape are selected.
    Assignment-to-Execution gating and idempotent record creation are also
    selected, as are reservation states and complete-reservation
    release/replacement semantics. Hold-confirmation/Assignment activation
    ordering and the initial CC rejection-code catalog/replan guidance are
    selected. Cancellation release payloads and detailed reconciliation
    remain open. Consumers apply only newer owner-fact revisions, ignore
    duplicates/stale facts, and reconcile revision gaps with the owner;
    reconcile a gap by fetching the current owner snapshot, advancing to its
    revision, and ignoring older deliveries. Define the lookup contract,
    retry schedule, staleness visibility, and recovery evidence. If the owner
    is unavailable, retain the last projection as stale and do not apply
    later revisions until reconciliation succeeds.
19. **Deadlines, leases, and freshness:** Initial booking response deadline,
    Dispatch lease, CC hold, Load guard, pickup escalation, notification
    acknowledgement, and Operations View freshness thresholds are recorded
    in the [technical workflow](TECHNICAL_WORKFLOW.md). Define freshness
    rules for remaining authoritative facts, recovery if Temporal or an owner
    service is unavailable, and measurable remaining platform objectives.
    Durable booking during a Temporal outage is selected. RPO 0 for
    acknowledged bookings and RTO at most four hours for critical TMS service
    restoration are selected; failover implementation remains open.
20. **Revision concurrency:** Immutable revisions, full-snapshot amendments,
    the pre-execution boundary, and conditional amendment API behavior are
    selected. Specify exact lease and finalization-guard protocols, remaining
    conflicting-edit behavior, Trip Plan amendment and reservation
    replacement, and revalidation outcomes under concurrent changes.
21. **Planning and matching policy:** Ordered resource segments, atomic
    segment reservations, one- or two-driver teams, baseline segment
    feasibility gates, and availability freshness thresholds are selected.
    Define measurable load/trip profiles, remaining readiness sources and
    hard gates, detailed feasibility calculations, allocation objective,
    preference weights/lookback, deterministic conflict behavior, and
    planning horizon. Availability is modeled as a versioned, time-bounded
    fact rather than a stored readiness boolean.
22. **Execution and evidence schema:** Per-delivery-stop proof of delivery
    or an authorized, reasoned exception is required for Load closeout.
    PDF, JPEG, and PNG are the initial formats, capped at 10 files and 25 MB
    per delivery stop. Stop arrival/departure milestones and completed,
    partial, or not-completed outcomes are selected, including delivered
    quantities per freight line. The authorized intent, short-lived
    presigned upload, verified finalize flow, required upload metadata, and
    idempotency are selected. Asynchronous malware scanning and a pollable
    upload state are selected. Presigned URLs last 30 minutes and require a
    new intent after expiry. Define remaining evidence metadata, upload
    headers, create-intent response details, object-storage controls, and
    evidence retention. The poll-status payload and states are selected.
    POD submitters are the assigned driver, responsible dispatcher, and area
    supervisor/coverage; submit authority does not include exception
    approval. The supervisor exception-approval boundary is selected.
    Report descriptions and remarks have selected length limits and
    append-only correction rules.
    Trip and per-Load Execution lifecycle states are selected as `PLANNED`,
    `IN_PROGRESS`, `COMPLETED`, and pre-start-only `VOIDED`. Exception types,
    case ownership, and the `OPEN`/`IN_PROGRESS`/`RESOLVED` lifecycle with
    audited reopening are selected. Partial/not-completed delivery creates a
    blocking exception case until supervisor resolution. Exception cases
    keep current state separately from append-only transition rows with
    actor, timestamp, and reason; detailed columns and transition commands
    remain to be specified.
23. **Notification minimum:** Initial channels, event classes, recipients,
    urgent acknowledgement/escalation behavior, and receipt-versus-
    resolution semantics are recorded in the
    [technical workflow](TECHNICAL_WORKFLOW.md). Define exact event
    templates, delivery retry evidence, retention, and recovery. Immediate
    notification to the designated proposal reviewer on submission, with
    the proposal added to that reviewer's queue, and notification to the
    submitter for every recorded review outcome are selected. No automatic
    reminders are sent while proposals await review.
    internal notifications to the responsible `contract_capacity_dispatcher`
    when tender acceptance/rejection/expiry or Carrier counteroffers are
    recorded are selected; pre-deadline reminders are excluded. Non-urgent external-delivery
    preferences are allowed; urgent
    acknowledgement alerts cannot be suppressed and have one designated
    primary acknowledgement owner. Unassigned-Load, urgent-incident, and
    parked-technical-failure primary-recipient routing is selected.
24. **Operations View:** The read-only view covers all in-scope operational
    records and workflows, links to owning services for actions, and does not
    write authoritative records. Its initial freshness target/stale threshold
    are established. Define exact screens/projections, rebuild/reconciliation
    behavior, and detailed grant mappings. The transportation executive and
    chief supervisor have company-wide Operations View access; other users
    are scoped by area where applicable or by their existing resource and
    relationship authority otherwise. The transportation executive owns the
    company-wide operational KPI set, including definitions and review. The
    transportation executive and chief supervisor have
    company-wide KPI dashboard access; area supervisors have access only for
    their assigned areas; other roles have no KPI dashboard access by default. The
    `America/Los_Angeles` timezone applies company-wide, with weeks beginning
    Monday at 00:00. Unknown/stale availability is excluded and displayed
    separately. The
    on-time KPI uses actual arrival versus confirmed appointment windows per
    stop, with pickup/delivery reported separately and unappointed stops
    excluded.
25. **Recovery and acceptance scenarios:** Failure-injection boundaries
    across booking, outbox, CC, Assignment, Execution, cancellation, and
    disaster restore are selected in the
    [technical workflow](TECHNICAL_WORKFLOW.md). Still define executable
    test cases and evidence, domain-owner replay approval/audit mechanics,
    reconciliation runbooks, and acceptance criteria for
    operational-exception paths.

## Scope decisions retained for later

- Complete Customer and Carrier onboarding, qualification, and operating
  workflows beyond the selected Counterparty Registry baseline.
- The extent of carrier sourcing, customer service, tracking, document
  handling, fleet administration, safety/compliance, billing, settlement,
  claims, and reporting beyond the booked-Load-to-Execution core.
- Explicit exclusions and any future scope-change criteria.

## Other open design

- Same-day emergency and after-hours authority; detailed short/long and
  outbound/return-home policy.
- Preference strength, objection response coverage, and human-review
  conversation and disposition.
- Exact message topology, routing, technical failure-injection cases,
  dead-letter inspection, replay authorization, and compatibility tests.
- Which workflows require durable timers, human waits, and compensation, and
  who owns operational repair.
- Cluster sizing and platform failover, data and file retention, and measured
  security/operability targets beyond the selected booking RPO and critical-
  service RTO.
- Applicable employment, carrier-contract, safety, customer-contract,
  evidence-retention, privacy, and regulatory constraints. These require
  authoritative sources and qualified review.

## Not approved as first-slice requirements

Deeper brokerage negotiation and sourcing automation, customer/carrier
portals, billing, settlement, analytics, fleet maintenance, and hours-of-
service management are not approved for the first engineering slice. Their
inclusion in this list is a scope question, not a commitment to build them.
