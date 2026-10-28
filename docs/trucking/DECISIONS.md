# TMS decision log

This log preserves accepted product and target-architecture decisions
recorded in the previous TMS baseline. They are decisions about this
owner-defined model, not customer validation, legal conclusions, or claims
that the target is implemented. The [system blueprint](TMS_SYSTEM_BLUEPRINT.md)
summarizes the current architecture; unresolved choices belong in
[open decisions](OPEN_QUESTIONS.md).

## Accepted baseline

### D-01 — Establish product direction through owner decisions and evidence

**Decision:** Establish the product direction as owners of the intended TMS.
Develop its business model and coherent target scope from owner direction
and recorded operational evidence. The reference scale and operating areas
are current design assumptions, not product limits.

**Reason:** Product ownership must be explicit while distinguishing owner
decisions from claims validated by customers, operations, or law.

### D-02 — Separate the broker's commercial decision from capacity approval

**Decision:** The handling broker alone decides whether to clarify, book, or
decline an offer. Booking does not require a supervisor's capacity approval
and does not itself secure capacity.

**Reason:** The commercial commitment and the operational capacity decision
are distinct responsibilities and records.

### D-03 — Define the coherent target before business implementation

**Decision:** Establish the coherent intended TMS target, minimum identified
scope, domain ownership and relationships, system boundaries, internal
contracts, role responsibilities, and capability-specific failure boundaries
before implementing domain-owned business workflows. The maximum scope may
remain explicitly open. Define detailed role procedures and permission
enforcement after the relevant domain boundaries and contracts are stable.
This does not require implementing every approved capability at once.

D-504 refines the sequencing rule: the approved, bounded platform-foundation
phase may precede completion of all business-capability documentation, but it
must not introduce business behavior or establish domain policy by
implementation.

**Reason:** A slice should test a deliberate part of a coherent system rather
than establish accidental architecture through the first feature built.

### D-04 — Keep Load, Dispatch Planning, CC, and Execution as peer owners

**Decision:** Load owns the commercial commitment; Dispatch Planning owns
matching and the canonical Assignment; Capacity Commitment (CC) owns
Reservations and capacity-window claims; Execution owns movement facts. CC
is an independent peer, not part of Dispatch. Related records may share a
stable correlation identifier but retain distinct identities and ownership.

**Reason:** Each business truth needs an authoritative owner. Correlation
does not require shared data ownership or a shared database.

### D-05 — Keep Notification separate from business authority

**Decision:** Notification is a supporting service boundary for actionable
work and delivery state. A notification does not own or replace the
underlying business fact.

**Reason:** Delivery, acknowledgement, and inbox visibility can fail or
change independently of the authoritative business state.

### D-06 — Give durable messaging, workflow coordination, and fan-out distinct roles

**Decision:** The target choices are RabbitMQ for durable business messaging,
Temporal for long-running workflow coordination, and NATS for secondary
realtime fan-out. One must not substitute for another's authority or
recovery role.

**Reason:** Business delivery, durable orchestration, and ephemeral client
updates have different failure and persistence requirements. The tools are
target choices; they are not all configured in the current development
environment.

### D-07 — Compose policies for distinct shipment and trip profiles

**Decision:** Shipment and trip profiles are composable. Outbound and
return-home work, and short and long trips, must not be forced through
identical decision logic.

**Reason:** Shared ownership and lifecycle invariants can coexist with
different operational policies. D-499 defines the initial short/long and
driver-home-area classifications; D-511 defines the four operational
direction/duration profiles and rolling ranking/reservation policy.

### D-08 — Automate routine matching and Assignment within explicit constraints

**Decision:** Dispatch Planning selects feasible capacity under active
policy; CC protects the required windows; Assignment proceeds automatically
when current hard gates pass and no strong avoid-preference or explicit
driver objection remains unresolved. Routine work does not wait for a
supervisory approval click.

**Reason:** Automation should handle decisions that can be made safely from
current facts and policy, while people retain responsibility for genuine
exceptions and judgment.

### D-09 — Keep planning leases distinct from capacity availability

**Decision:** If finalization fails a hard gate, stop Assignment, release the
Dispatch Planning lease, return the Load to planning, and preserve history.
CC reservations remain governed by CC. Releasing a planning lease does not
establish that any driver or equipment is available.

**Reason:** Planning-lease state and capacity readiness are distinct facts;
conflating them could expose unsafe or already committed capacity.

### D-10 — Establish Identity as a new product service

**Decision:** Design and build the TMS Identity service from a clean
requirements and architecture baseline. Do not carry forward prior
authentication or account-profile implementation details as product
requirements.

**Reason:** Identity is a core product capability and requires a deliberate
design for principals, authentication, account lifecycle, and authorization.
The high-level split is established: Identity authenticates and each domain
authorizes its own resources. Detailed principal, session, and propagation
design remain open.

**Status:** Identity is not implemented. Its principal model, authentication
details, and lifecycle remain open; business-resource authorization belongs
to each owning domain.

### D-11 — Complete capability documentation before business implementation

**Decision:** Do not begin a domain-owned TMS business capability until its
business scope, domain model, architecture, internal contracts, role
responsibilities, and verification requirements are documented consistently
and approved. D-504 separately approves platform-foundation work, bounded by
the system blueprint's explicit scope and acceptance criteria. This exception
does not authorize business APIs, operational records, or workflow behavior.

**Reason:** The product boundary and its responsibilities must be deliberate
before technical work can safely establish them by accident.

### D-12 — Confirm booking at durable Load commit

**Decision:** Brokers may submit multiple booking rows through an in-app
form or spreadsheet. Both formats converge on one Load business validator.
Initially, a booking-critical error rejects the full batch with row-specific
reasons and creates no Loads, but the immutable submission attempt, normalized
input, and issues are retained. On success, atomically commit the Loads,
initial revisions, accepted submission outcome, and planning outbox records;
immediately return the durable booking result and follow-up items without
implying that capacity is reserved or work assigned. Use a client
`Idempotency-Key` and server UUID `submissionId`; a corrected attempt uses a
new key and links only to a rejected attempt. Changes to accepted Loads use
their amendment workflow. After acceptance, each Load proceeds independently.

**Reason:** The broker needs an immediate truthful result while planning and
execution continue asynchronously.

### D-13 — Separate completeness and owner-controlled lifecycles

**Decision:** Booking, planning/Assignment, and execution/delivery have
separate owner-controlled lifecycles. Required fields are evaluated by
workflow stage. Load owns its completeness and missing-information tasks;
invalid secondary input is not accepted as an authoritative fact. A
planning-stage gap may hold planning without undoing a valid booking.

**Reason:** A valid commercial commitment must not be conflated with
operational readiness, feasibility, Assignment, or completed delivery.

### D-14 — Version Load, Trip Plan, and Assignment decisions

**Decision:** Use immutable full snapshots for planning-relevant Load
revisions and immutable Trip Plan revisions. Dispatch Planning owns
Trip Plans and immutable per-Load Assignment decisions; a Load has at most
one active Trip Plan Assignment, while a Trip Plan may group multiple Loads.
Replanning creates a successor Assignment rather than overwriting history.

**Reason:** Every planning and Assignment decision must remain explainable
against the exact requirements and plan it evaluated.

### D-15 — Require CC reservation before active Assignment

**Decision:** Dispatch Planning owns an expiring planning lease per Load;
CC separately owns atomic reservations for the complete resource/time-window
set of a Trip Plan revision and authoritative reservation expiry. An
Assignment remains pending until the required CC reservation is confirmed
and finalization checks pass. Load supplies a short-lived exact-revision
finalization guard. Material changes require revalidation; failed
multi-Load plan validation removes the affected Load and retains other Loads
only if the revised plan remains feasible.

**Reason:** Capacity protection and Assignment have distinct owners, and
neither may present unprotected or stale work as active.

### D-16 — Use service-owned persistence and durable messaging

**Decision:** Each independently deployable service owns a PostgreSQL
cluster. RabbitMQ, Temporal, NATS, and observability are shared platform
clusters. Temporal owns orchestration progress, not business truth. Durable
messaging uses transactional outbox and idempotent inbox/deduplication,
bounded retries, visible recovery, explicit quarantine, and owner revisions
on events. Each service uses `app`, `domain`, `interface`, and `infra`
organization without unnecessary generic scaffolding. Use a small shared transport/error
convention while domain payloads remain owner-defined and runtime-validated.

**Reason:** Independent ownership requires reliable handoffs without shared
databases or distributed transactions.

### D-17 — Preserve execution evidence and separate operational projections

**Decision:** Execution creates planned records after confirmed Assignment
and records actual movement separately. A Trip Execution and per-Load
executions have independent lifecycles; actual milestones are recorded
against stops. Delivery is not complete until required evidence exists or
an authorized, reasoned exception is recorded. Preserve reports and
corrections as history; store evidence files in object storage with metadata
owned by Execution. Operations View provides read-only event-fed operational
projections with visible freshness; all writes remain with source owners.

**Reason:** Planning is not movement, delivery assertions need supporting
evidence, and a convenient combined read model must not become business
authority.

### D-18 — Coordinate planning as a recoverable saga

**Decision:** On the success path, Dispatch claims each ready Load and
creates versioned Trip Plan/pending Assignment records; CC acquires
temporary holds for the whole plan; Load grants short-lived guards for exact
revisions; Dispatch rechecks hard gates; CC confirms the reservation; and
Dispatch activates Assignments only after confirmation. On success, release
the finalization guards and planning leases, then publish owner facts through
their outboxes. Before CC confirmation, cancel pending decisions and release
affected holds/leases on failure. After confirmation, preserve the
reservation and recover forward. Execution handoff failure does not roll
back a valid Assignment.

**Reason:** Each owner persists its own state; a saga with explicit
compensation and forward recovery avoids distributed transactions while
keeping each reported state truthful.

### D-19 — Define stage gates and owner-owned logical records

**Decision:** Booking requires a confirmed Customer, accepted commercial
terms including rate/currency, ordered pickup and delivery stops with
locations/windows, and freight description with quantity/unit. Planning adds
capacity-relevant freight facts and equipment/handling constraints; Dispatch
separately owns feasibility. Execution start requires confirmed Assignment
and required pre-departure facts. Load closeout requires required stop
outcomes and delivery evidence or an authorized reasoned exception, with no
blocking unresolved exception. Logical table families are recorded by owner
in the [technical workflow](TECHNICAL_WORKFLOW.md); full PostgreSQL schemas
remain open. The initial architecture targets one company, opaque UUIDs,
and separate service databases.

**Reason:** Stage-specific completeness prevents missing later-stage data
from being confused with a failed commercial booking or assignment
feasibility.

### D-20 — Normalize booking intake and standardize message metadata

**Decision:** Form and spreadsheet inputs converge on
`POST /api/v1/booking-submissions`; the durable result is retrievable from
`GET /api/v1/booking-submissions/{submissionId}`. The first well-formed
attempt returns `201 Created` for either accepted or rejected business
outcome; an identical retry returns `200 OK`, while changed content under the
same key returns `409 Conflict`. Malformed requests return `400` and create
no submission. The response and HTTP transport-error shapes are recorded in
the [service-contract guide](../contracts.md). Share stable message
identity/type/version, source/target, time,
correlation/causation, owner revision for facts, and HTTP error conventions.
Keep business payload schemas owned and validated by their domain; business
rejections are outcomes, not transient retry conditions.

**Reason:** Consistent transport behavior supports multiple input channels
without coupling domain models or misclassifying business outcomes.

### D-21 — Separate authentication from resource authorization

**Decision:** Identity owns authentication-focused principals, credentials,
session lifecycle, and role grants; the gateway authenticates and routes;
each business service maps grants to actions and authorizes access to its
own resources and transitions. Identity-issued signed OIDC access tokens
carry principal/session facts and current role/scope grants. Initial
authenticated users include staff and in-house and contracted drivers;
customer and carrier office accounts are deferred. Invitation-only account
provisioning and the detailed account/session policy are recorded in the
[technical workflow](TECHNICAL_WORKFLOW.md). Identity does not own
operational employee/driver/customer/carrier profiles. A separate
`identity_administrator` grant has no transportation authority; privileged
grant changes require two-person approval. Detailed permission mappings,
delegation, and identity-to-driver profile link verification remain open.

**Reason:** Identity establishes who is acting; domain owners decide what
that actor may do to their business records.

### D-22 — Make recovery and projection freshness operationally visible

**Decision:** Workflows expose correlation-linked state, queue/hold age,
retry count, and failure reason. Authorized operators can inspect, replay,
and reconcile failed work. Backup and restore for service databases and
evidence storage must be tested. The first operational release has an RPO
of zero for acknowledged bookings and an RTO of at most four hours for
critical TMS service restoration. Initial lease, reservation, projection
freshness, pickup escalation, and retry thresholds are recorded in the
[technical workflow](TECHNICAL_WORKFLOW.md); failover implementation,
retention, other service objectives, and fact-owner freshness rules remain
open.

**Reason:** Asynchronous ownership is safe only when partial progress and
failed handoffs are observable and recoverable.

### D-23 — Keep the first scope centered on transportation execution

**Decision:** The initial technical scope centers on a carrier's
booked-Load-to-delivery/Execution-closeout flow, including basic Customer
and Carrier records, the Fleet Readiness facts needed for planning, and
operational visibility. Finance, settlement, broader sourcing, maintenance,
expanded claims, and analytics remain explicit scope decisions, not assumed
modules.

**Reason:** A coherent core can be specified without silently expanding into
every adjacent company function.

### D-24 — Persist rejected booking attempts and their correction history

**Decision:** Every well-formed booking attempt is a durable submission
resource, including business-rejected attempts. Store normalized submitted
rows and row/field issues, but create no Load records unless every row passes
booking-critical validation. Corrections create new immutable attempts with
new idempotency keys linked to the rejected attempt. A correction link cannot
target an accepted attempt; accepted Loads change through their revision
workflow. Malformed requests that cannot be interpreted are not persisted.

**Reason:** Brokers can return to actionable rejection details without
confusing an intake attempt with a committed commercial Load or weakening
idempotent retry behavior.

### D-25 — Define initial booking data and equipment capabilities

**Decision:** Booking requires a confirmed Customer, positive total customer
rate and currency, ordered US pickup/delivery stop snapshots and appointment
windows, and at least one described freight line with positive quantity and
controlled handling units. The initial stop sequence may interleave pickups and
deliveries. Planning requires total freight weight; reefer Loads additionally
require a temperature range, and flatbed Loads require line dimensions and
an explicit tarp requirement. An equipment profile is required before
planning but is not a booking-critical field; no profile is silently
defaulted. The first equipment profiles are dry van, reefer, and flatbed.
Later phases add step-deck/oversize, then tanker and hazardous-material
workflows. A not-yet-supported profile may be booked but must remain visibly
held from automated planning, Assignment, and Execution. The detailed field
groups and validation gates are in the
[technical workflow](TECHNICAL_WORKFLOW.md).

**Reason:** The booking boundary preserves the commercial decision while
preventing missing or unsupported operational capabilities from being
treated as safe planning facts.

### D-26 — Apply the initial Identity and session policy

**Decision:** Accounts are invitation-only with single-use invitations
expiring after 72 hours. Account states are `INVITED`, `ACTIVE`, `SUSPENDED`,
and `DEACTIVATED`. Use OIDC Authorization Code with PKCE; access tokens are
valid for at most 15 minutes and include current role/scope grants. Rotate
refresh tokens and revoke the session family on reuse. Privileged sessions
expire after 30 minutes idle or 12 hours absolute; workforce/driver sessions
after 12 hours idle or 30 days absolute. Suspension/deactivation revokes
refresh sessions immediately; changed grants may remain in routine access
tokens for at most 15 minutes, with current session-revocation checks for
high-impact actions.

Require MFA for Identity administrators, transportation executives, chief
and area supervisors, brokers, and dispatchers. Drivers use password
authentication and app-level protections on any device, without mandatory
device enrollment or MFA. Passkeys are preferred and TOTP is allowed; SMS
and email are not MFA factors. Require fresh MFA only for account and role
changes. Passwords require at least eight characters and uppercase,
lowercase, number, and symbol; block common/compromised values and do not
impose fixed periodic expiration. Use verified sign-in/recovery identifiers,
single-use expiring reset links, and audited two-person recovery for
privileged accounts. Account recovery revokes existing sessions.

**Reason:** Authentication strength and session lifetime should reflect
operational authority while keeping driver access practical and identity
records separate from transportation data.

The owner accepts the documented risk that driver accounts do not require
MFA and use an eight-character minimum with all four character classes.
Argon2id hashing, compromised-password blocking, authentication throttling,
app-level credential protection, and session revocation are required
mitigations. Reassess this risk before production use.

### D-27 — Establish a Counterparty Registry boundary

**Decision:** Add a Counterparty Registry service for shared legal
organization identities with distinct Customer and Carrier profiles,
profile lifecycle status, external business references, and
organization-level contacts. Require legal name; display name, external
reference, and contacts are optional. Carrier USDOT/MC identifiers may be
recorded when applicable with verification status/source; tax IDs are
deferred pending approved financial/compliance scope and retention. Both
profiles use `PENDING`, `ACTIVE`, `SUSPENDED`, and `CLOSED` states. Load
booking requires an `ACTIVE` Customer profile; an `ACTIVE` Carrier profile
does not itself prove capacity or qualification. Load revisions retain the
Customer profile ID and a name snapshot. Suspension blocks new bookings
against that Customer and new planning/Assignment against that Carrier,
while preserving existing commitments for review and never auto-cancelling
or deleting them. Carrier qualification, agreements, and capacity remain
with their responsible domains. The initial record boundary is described in
the [technical workflow](TECHNICAL_WORKFLOW.md).

**Reason:** Load and capacity workflows need stable Customer and Carrier
references without making either service the owner of all counterparty
business data.

### D-28 — Set initial operational and notification thresholds

**Decision:** Use a 10-minute Dispatch Planning lease renewed every two
minutes only during active planning; a five-minute CC temporary hold; and a
two-minute Load finalization guard with at most one renewal. Target
Operations View lag p95 at or below five seconds and mark projections stale
after 30 seconds. Escalate unassigned Loads 24 hours and four hours before
pickup, then immediately at or after the pickup window. A synchronous
booking request has a 10-second deadline. For transient commands, make
eight total delivery attempts, including the initial attempt, with
exponential backoff capped at five minutes before visible parking; retain
outbox facts until publication is confirmed.

Persist notifications in the in-app inbox; use push for drivers and email
for staff, with no SMS initially. Deliver booking/follow-up outcomes,
unassigned-load escalations, Assignment/schedule changes, incidents/missed
milestones/closeout exceptions, and parked workflow failures to the
responsible roles. Require acknowledgement for urgent incidents,
imminent/missed-pickup escalations, and parked failures; resend/escalate
after 15 minutes without acknowledgement. Acknowledgement records receipt
only and does not resolve business work.

**Reason:** Measurable deadlines and explicit notification semantics make
asynchronous work visible without turning notification delivery into
business authority or supervisor approval.

### D-29 — Gate Load cancellation on downstream release

**Decision:** A broker may request cancellation before actual execution
starts. Cancellation immediately blocks new planning and moves the Load to
`CANCELLATION_PENDING`; it becomes `CANCELLED` only after Dispatch Planning
and CC confirm release of their active work/claims, and Execution confirms
that any planned, not-yet-started per-Load Execution is removed or voided.
When one Load is cancelled from a multi-Load Trip Plan, Dispatch Planning
revalidates the remaining Loads and CC atomically replaces the segment
reservation. Retain other Loads only if the revised plan remains feasible;
otherwise release affected claims and replan. If no downstream work exists,
the Load may transition directly to `CANCELLED`.
Once actual execution has started, cancellation is not available; the Load
must proceed through the
operational-exception workflow. Once accepted, a cancellation request cannot
be withdrawn; it remains pending through retry/reconciliation until release
is confirmed. Cancellation never deletes the booking or its history. The
public cancellation API is specified in D-31 and the
[service-contract guide](../contracts.md); internal release commands and
compensation behavior remain open.

**Reason:** A commercial cancellation request must not leave an active
Assignment or capacity reservation behind, and must not erase an execution
that has already begun.

### D-30 — Limit Fleet Readiness to planning-critical operational facts

**Decision:** Fleet Readiness owns the operational driver/equipment
profiles and readiness/availability facts required by planning, including
contracted drivers linked to their Carrier profile. It does not own HR,
payroll, maintenance, or compliance case management. Fleet dispatchers and
drivers maintain the initial facts manually. A missing or stale hard-gate
fact means unknown and ineligible for automated planning, not approval.
Detailed profile fields, evidence, freshness sources, and update workflows
remain open.

**Reason:** Planning needs an authoritative readiness boundary without
silently expanding the initial TMS into a full fleet-administration suite.

### D-31 — Expose cancellation as an asynchronous request resource

**Decision:** Create cancellation through
`POST /api/v1/loads/{loadId}/cancellation-requests`, requiring an
`Idempotency-Key`, and poll through
`GET /api/v1/cancellation-requests/{cancellationRequestId}`. A new valid
request returns `202 Accepted`; identical retries return the stored resource
with `200 OK`, and a key reused with changed content returns `409 Conflict`.
Require a reason code from `CUSTOMER_REQUEST`, `DUPLICATE_BOOKING`,
`BOOKING_ERROR`, `LOAD_NO_LONGER_NEEDED`, or `OTHER`. An optional note is
limited to 500 characters, and is required for `OTHER`.

The request resource moves through `PENDING_RELEASE`,
`REQUIRES_RECONCILIATION`, and `CANCELLED`. Exhausted automated retries
require visible reconciliation and do not create a terminal failure.
Accepted requests cannot be withdrawn.
Different-key duplicates while pending return `409 CANCELLATION_ALREADY_PENDING`
with the existing request ID. Already-cancelled Loads return
`409 LOAD_ALREADY_CANCELLED`, including the request ID when available.
Requests after actual execution starts return
`409 CANCELLATION_NOT_ALLOWED_EXECUTION_STARTED` and create no request.
The resource exposes a stable failure code/time and reconciliation flag, but
not internal stack traces. The complete response and error contract is in
the [service-contract guide](../contracts.md).

**Reason:** Cancellation is durable business intent followed by asynchronous
cross-service release, so the broker needs prompt acknowledgement and a
reliable way to observe completion or repair.

### D-32 — Make booking validation issues stable and actionable

**Decision:** Each booking validation issue contains `rowNumber` (one-based),
`fieldPath` as an RFC 6901 JSON Pointer into the submitted request (array
indexes remain zero-based), stable, cause-specific uppercase `SNAKE_CASE`
`code`, readable `message`, and `correctiveAction`. Do not echo submitted
field values in issue details. The initial booking rejection code catalog
is recorded in the [service-contract guide](../contracts.md).

**Reason:** Brokers need precise corrections while clients depend on stable
codes rather than parsing prose or receiving unnecessary copies of submitted
data.

### D-33 — Separate Load lifecycle state from immutable revisions

**Decision:** Keep a mutable Load head for current lifecycle state and the
current revision pointer. Each `load_revision` has a UUID ID and a
monotonically increasing `revisionNumber`, unique with its Load ID. Stops
and freight rows reference their owning revision ID, and each revision is a
full immutable snapshot. The Load lifecycle is `BOOKED`,
`CANCELLATION_PENDING`, `CANCELLED`, or `COMPLETED`. It remains `BOOKED`
while planning, Assignment, and execution progress; those states remain
authoritative in their respective services. Load changes to `COMPLETED`
only after consuming Execution's authoritative closeout fact; Load makes no
independent closeout decision.

**Reason:** Immutable revisions preserve the exact commercial requirements
used by each decision, while separate service-owned states avoid competing
planning and execution authorities.

### D-34 — Scope idempotency keys to the caller and operation

**Decision:** Scope an HTTP `Idempotency-Key` to the authenticated principal,
the operation, and its target resource when present. A key reused in a
different scope is distinct. In the same scope, unchanged normalized content
resolves to the existing resource; changed content returns `409 Conflict`.

**Reason:** Scoped keys support safe retries without accidental collisions
between principals, endpoints, or target Loads.

### D-35 — Store money without binary floating-point

**Decision:** Persist customer-rate amounts as PostgreSQL `NUMERIC(19,4)`
alongside an ISO 4217 currency code. Enforce the currency's allowed
fractional scale. Keep API amounts as decimal strings and do not use binary
floating-point for monetary values.

**Reason:** Exact decimal storage avoids rounding errors while preserving
currency-specific precision rules.

### D-36 — Store freight quantities at a fixed decimal scale

**Decision:** Persist positive freight quantities as PostgreSQL
`NUMERIC(12,3)` values. The public API accepts decimal strings with no more
than three fractional digits; validate controlled handling-unit codes
separately.

**Reason:** Fixed-scale exact storage avoids binary rounding and gives
consistent validation across booking and planning.

### D-37 — Make total freight weight a planning gate

**Decision:** Store total gross weight, when provided, as a positive
`NUMERIC(12,3)` value with a controlled `LB` or `KG` unit. Weight is optional
at booking and required before planning.

**Reason:** Weight is needed for safe planning but should not prevent
capturing an otherwise valid commercial booking.

### D-38 — Store reefer temperature requirements precisely

**Decision:** Store reefer minimum and maximum temperatures as signed
`NUMERIC(5,2)` values with one required shared `F` or `C` unit. Enforce
minimum less than or equal to maximum; require both values before planning.

**Reason:** A shared explicit unit and exact signed values make the range
unambiguous for carrier and equipment matching.

### D-39 — Store flatbed freight dimensions at fixed precision

**Decision:** For flatbed Loads, each freight line requires positive length,
width, and height stored as `NUMERIC(10,2)` values with one shared `IN` or
`CM` unit before planning. The flatbed Load also requires an explicit tarp
yes/no value before planning.

**Reason:** Line-level dimensions and a shared unit support clear equipment
fit checks without relying on unstructured descriptions.

### D-40 — Avoid duplicating accepted Load snapshots in JSONB

**Decision:** Retain a versioned normalized-input JSONB snapshot and issues
for rejected booking submissions, which have no Load records. Accepted
submissions retain their durable outcome, result, and normalized content
hash; their accepted field values remain authoritative in relational Load
revisions rather than being duplicated in submission JSONB.

**Reason:** Rejected attempts need durable, actionable correction context;
accepted transportation facts need one authoritative relational history.

### D-41 — Bound booking row cardinality

**Decision:** Limit each Load to 50 stops and 500 freight lines. A per-Load
limit violation is a booking-rule rejection persisted in the submission with
row issues. The aggregate request remains limited to 100 rows and 5 MB; an
aggregate limit violation returns `413` before creating a submission.

**Reason:** Per-Load bounds protect validation and planning while preserving
actionable correction history; aggregate transport limits protect intake
resources before a durable request can be accepted.

### D-42 — Require proof or an authorized exception per delivery stop

**Decision:** Each delivery stop must have its own proof of delivery before
Load closeout. If proof is unavailable, an authorized person must record a
reasoned exception for that specific stop. The Load's area supervisor
authorizes the exception; the chief supervisor or transportation executive
may provide documented coverage. Drivers and brokers cannot approve it.
A delivery milestone alone does not establish closeout.

**Reason:** Multi-delivery Loads need evidence for each delivered destination
without letting a report of progress substitute for required proof.

### D-43 — Restrict initial proof-of-delivery attachment formats

**Decision:** Initial per-delivery-stop proof-of-delivery attachments accept
PDF, JPEG, or PNG files, with at most 10 files per delivery stop and a
maximum size of 25 MB per file. Execution owns the evidence metadata and the
object-storage reference; other file formats are deferred.

**Reason:** A small allow-list supports common document and image evidence
while keeping validation and storage controls explicit.

### D-44 — Require failure-injection recovery acceptance

**Decision:** Acceptance must inject failures before and after booking
commit, during outbox publication, CC reservation, Assignment activation,
Execution creation, and cancellation release. Verify idempotent recovery,
no duplicate records or claims, no partial booking success, no false
active/cancelled state, and forward recovery after confirmed reservations.
Include disaster-recovery evidence for the selected acknowledged-booking
RPO and critical-service RTO.

**Reason:** A successful happy path does not prove that independently owned
services recover safely from lost responses and partial handoffs.

### D-45 — Separate incident reports from exception cases

**Decision:** Preserve incident/exception reports, remarks, evidence
references, and corrections as append-only history. Track follow-up and
resolution in a separate exception case with its own transitions; do not
rewrite or replace the original report.

**Reason:** Keeping an immutable account of what was first reported separate
from ongoing resolution preserves a trustworthy operational record.

### D-46 — Define the initial exception-case lifecycle

**Decision:** Execution exception cases use `OPEN`, `IN_PROGRESS`, and
`RESOLVED` states. A resolved case may be reopened through a new audited
transition. State changes never overwrite the append-only reports and
remarks associated with the case.

**Reason:** The lifecycle distinguishes unassigned work, active follow-up,
and resolution while preserving the full operational history.

### D-47 — Assign operational exception follow-up to the area supervisor

**Decision:** The Load's departure-area supervisor owns follow-up and
resolution of Execution exception cases. Drivers submit factual reports but
do not resolve their own exception cases. The chief supervisor or
transportation executive may provide documented coverage.

**Reason:** One accountable operational owner prevents incidents from
remaining without follow-up while keeping reporting separate from resolution
authority.

### D-48 — Use controlled initial Execution exception types

**Decision:** Initial Execution exception types are `ACCIDENT`, `BREAKDOWN`,
`DELAY`, `CARGO_DAMAGE`, `CARGO_SHORTAGE`, `PICKUP_ISSUE`,
`DELIVERY_ISSUE`, `DOCUMENTATION_ISSUE`, and `OTHER`. `OTHER` requires a
brief explanation. Reports remain append-only, with resolution handled by
the separate exception case.

**Reason:** Controlled types support consistent triage and reporting while
retaining a bounded extension path for incidents not yet classified.

### D-49 — Record shared-trip incidents once

**Decision:** Record an incident affecting a shared Trip Execution once at
the Trip level and link it to each affected Load exception case. Do not
duplicate the same report for every affected Load; Load-specific reports
remain linked to their Load Execution.

**Reason:** A single authoritative incident report prevents conflicting
copies while preserving visibility and follow-up for every affected Load.

### D-50 — Preserve authoritative Execution report metadata

**Decision:** Each append-only Execution report records a server-set
`reportedAt`, the reporter principal derived from authenticated identity, a
controlled `exceptionType`, required description, and its Trip/Load
Execution association. `occurredAt`, location, and evidence attachments are
optional when applicable.

**Reason:** Server time and authenticated reporter identity preserve
provenance while optional event/location facts accommodate reports that are
incomplete or not tied to a precise place.

### D-51 — Route Load changes through immutable revisions

**Decision:** Every approved Load amendment creates a new immutable revision.
Amendments are permitted before actual execution starts. A change after
active Assignment requires revalidation before automated progression.
After execution starts, requested changes use the Execution
operational-exception workflow and do not rewrite Load requirements.

**Reason:** This preserves what was agreed and planned while allowing
pre-execution corrections to trigger safe revalidation.

### D-52 — Submit complete Load amendment snapshots

**Decision:** A Load amendment submits the complete next-revision snapshot,
not a partial patch. Load validates the entire new snapshot before
committing it as the next immutable revision. The amendment route and
concurrency behavior are specified in D-53 and D-54.

**Reason:** Full-snapshot validation keeps each revision self-contained and
prevents omission or accidental inheritance of prior field values.

### D-53 — Use conditional writes for Load amendments

**Decision:** Require `If-Match` with the current Load revision's ETag for
every amendment. A stale ETag returns `412 Precondition Failed` and creates
no revision. A conflicting amendment during an active finalization guard
remains a retryable `409 Conflict`, as specified by the technical workflow.

**Reason:** Conditional writes prevent silent lost updates; the separate
guard conflict identifies a short-lived workflow lock rather than stale
client knowledge.

### D-54 — Expose Load amendments as conditional revision creation

**Decision:** Retrieve the current Load at
`GET /api/v1/loads/{loadId}` and a specific immutable revision at
`GET /api/v1/loads/{loadId}/revisions/{revisionId}`. Create an amendment at
`POST /api/v1/loads/{loadId}/revisions` with a complete snapshot, current
`If-Match` ETag, and `Idempotency-Key`. A valid change returns `201 Created`
with the new revision resource and whether revalidation is required. Same-key
retries replay the same revision; changed content under that key returns
`409`.

Missing `If-Match` returns `428`; stale ETag returns `412`. A finalization
guard conflict returns retryable `409`. A change after execution starts
returns `409 LOAD_AMENDMENT_NOT_ALLOWED_EXECUTION_STARTED`; a
`CANCELLATION_PENDING`, `CANCELLED`, or `COMPLETED` Load returns
`409 LOAD_NOT_AMENDABLE`. Invalid snapshots return `422
LOAD_AMENDMENT_INVALID` with field issues but no revision or attempt
resource. The `422` outcome consumes its idempotency key; corrected content
requires a new key.

**Reason:** A conditional, idempotent revision-creation endpoint keeps
concurrent edits safe and makes lost-response retries unambiguous.

### D-55 — Keep urgent notifications mandatory

**Decision:** Users may change preferences for non-urgent notification
classes and suppress their optional external delivery. Durable in-app inbox
records remain available. Urgent notifications requiring acknowledgement
cannot be suppressed by user preferences.

**Reason:** Personalization should reduce non-critical noise without hiding
work that requires timely operational action.

### D-56 — Scope stop identity to its Load revision

**Decision:** Each requested stop has an ID scoped to its immutable Load
revision. Execution milestones and delivery evidence reference that exact
revision stop. An amended revision creates new stop IDs rather than carrying
stop identity across revisions.

**Reason:** Exact revision-scoped references preserve which requested stop
was planned and executed without ambiguous identity across amended snapshots.

### D-57 — Separate technical replay authority from business authority

**Decision:** A company-wide `tms_operations_administrator` grant may inspect
technical workflow failures and prepare replay/reconciliation. Replaying work
that changes business state requires approval from the owning business
domain. Record the operator, approver, reason, and result. This grant has no
Identity administration or transportation authority.

**Reason:** Technical recovery requires controlled tooling, but replay must
not become a bypass of the service that owns a business transition.

### D-58 — Make booking follow-ups stage-aware

**Decision:** Each accepted-booking `followUpItem` identifies `loadId`,
`fieldPath` as an RFC 6901 JSON Pointer, stable cause-specific uppercase
`SNAKE_CASE` `code`, readable `message`, `requiredStage`, and `blocksStage`.
Use `PLANNING`, `EXECUTION_START`, or `DELIVERY_CLOSEOUT` when a fact gates a
stage; use `null` for informational follow-ups. `blocksStage` is true only
when the fact prevents that stage. Such follow-ups do not reject a booking.
The initial follow-up code catalog is recorded in the
[service-contract guide](../contracts.md).

**Reason:** Brokers receive actionable information about later-stage
completeness without delaying the immediate booking decision.

### D-59 — Reserve Trip Plans as ordered resource segments

**Decision:** A Trip Plan may contain multiple ordered resource segments,
each covering a contiguous route section and reserving exactly one power
unit, one matching trailer, and its assigned driver set. Any segment
boundary that changes resources must be an explicit planned stop or handoff
location. CC atomically reserves the complete resource/time-window set for
all segments or reserves none.

**Reason:** Explicit segments support planned resource changes without
allowing untracked swaps or partial capacity claims.

### D-60 — Support two-driver teams within a Trip Plan segment

**Decision:** A segment may assign one driver or a team of two drivers.
Execution records which team member is actively driving and appends each
driver handoff as an event.

**Reason:** Team operations can be modeled without weakening driver
accountability or losing handoff history.

### D-61 — Assign one acknowledgement owner per urgent notification

**Decision:** Each urgent notification has one designated primary
acknowledgement owner. Other recipients are informed but do not need to
acknowledge; only the primary owner's acknowledgement satisfies the
15-minute resend/escalation timer. Acknowledgement records receipt and does
not resolve the underlying business task.

**Reason:** One accountable recipient prevents ambiguous acknowledgement
ownership without treating a notification receipt as completed work.

### D-62 — Route unassigned-Load alerts by urgency

**Decision:** For an unassigned Load, the broker is the primary
acknowledgement owner for the 24-hour pre-pickup reminder, with the
departure-area supervisor informed. At four hours or less before pickup, and
at or after the pickup window, the departure-area supervisor becomes the
primary acknowledgement owner. Escalate immediately when the pickup window
is reached or missed; do not cancel the booking automatically.

**Reason:** The broker owns initial booking follow-up, while operational
accountability transfers to the supervisor as the pickup deadline becomes
urgent.

### D-63 — Apply hard feasibility gates to Trip Plan segments

**Decision:** A feasible Trip Plan must provide continuous segment coverage,
avoid overlapping reservations for any resource, meet equipment
compatibility requirements, allow sufficient repositioning time, and satisfy
driver availability and qualification checks. Missing or stale readiness
facts block planning and cannot be treated as evidence of eligibility.

**Reason:** Planning must rely on current, verifiable resource eligibility
and a physically feasible schedule rather than assuming that incomplete
readiness data is acceptable.

### D-64 — Define Fleet Readiness fact freshness

**Decision:** Driver and equipment availability facts are planning-current
for 15 minutes after observation. Qualification and equipment-compatibility
facts remain current until their recorded expiry, if any, or a superseding
owner revision. Missing or stale hard-gate facts block automated planning.

**Reason:** Time-bounded availability prevents planning from relying on
outdated operational status, while qualifications and compatibility use
their source-record validity and revision.

### D-65 — Separate Execution lifecycle from outcomes

**Decision:** Trip and per-Load Execution use `PLANNED`, `IN_PROGRESS`, and
`COMPLETED` lifecycle states. `VOIDED` is permitted only before execution
starts. Stop milestones and outcomes, and exception cases, are separate
records rather than additional Execution lifecycle states.

**Reason:** A small shared lifecycle keeps movement, delivery outcomes, and
operational follow-up distinct without conflating their state transitions.

### D-66 — Record actual stop milestones and outcomes

**Decision:** For each planned stop, Execution appends actual `ARRIVED` and
`DEPARTED` milestones and records a `COMPLETED`, `PARTIAL`, or
`NOT_COMPLETED` outcome. Delivery outcomes include the actual delivered
quantity for each applicable freight line. Each delivery stop still requires
its own proof of delivery or an authorized, reasoned exception for Load
closeout.

**Reason:** Stop-level movement and outcome records make partial or failed
service visible without conflating those outcomes with Execution lifecycle
state.

### D-67 — Upload evidence through private object storage

**Decision:** Execution evidence uploads use an authorized upload intent,
followed by a short-lived presigned URL to private object storage and a
finalize operation. Finalization verifies file size, type, and checksum
before attaching the evidence to its stop. Existing per-delivery-stop file
count, size, and format limits apply.

**Reason:** Direct private-object upload avoids routing file bytes through
the application API while ensuring only verified evidence becomes part of
the Execution record.

### D-68 — Expose evidence upload intents and finalization

**Decision:** Create upload intents with
`POST /api/v1/load-executions/{loadExecutionId}/stops/{stopId}/evidence-uploads`,
returning `201 Created` with the `uploadId`, short-lived presigned URL,
expiry, and required headers. After direct object upload, finalize with
`POST /api/v1/evidence-uploads/{uploadId}/finalization`. The asynchronous
scan and finalization response behavior is superseded by D-86.

**Reason:** Separate upload authorization from evidence finalization so
unverified or incomplete objects cannot appear as accepted Execution
evidence.

### D-69 — Validate upload metadata before issuing URLs

**Decision:** Upload-intent requests require an `Idempotency-Key` and
`fileName`, allow-listed `contentType`, exact `sizeBytes`, and SHA-256
checksum. Validate the target stop, authorization, file-count limit, type,
and size before issuing a presigned URL. Finalization verifies the stored
object against the declared size, allowed type, and checksum.

**Reason:** Preflight validation avoids unnecessary object uploads, while
post-upload verification ensures that accepted evidence matches the request.

### D-70 — Standardize evidence-upload error statuses

**Decision:** Evidence upload operations return `413 Content Too Large` for
an oversized file, `415 Unsupported Media Type` for an unsupported declared
type, `422 Unprocessable Content` for a stored-object type or checksum
mismatch, `410 Gone` for an expired upload intent, `409 Conflict` when stop
lifecycle or file-count constraints prevent the operation, and `404 Not
Found` when a target is missing or not visible to the caller.

**Reason:** Cause-specific HTTP statuses let clients distinguish correctable
input problems, expired intents, business conflicts, and inaccessible
resources.

### D-71 — Make evidence finalization idempotent per upload

**Decision:** Finalization is idempotent by `uploadId`; retries do not
duplicate finalization or evidence creation. The original synchronous
`201`/`200` response behavior is superseded by D-86.

**Reason:** Clients can safely recover from lost responses without creating
duplicate evidence records.

### D-72 — Give internal commands an explicit idempotent envelope

**Decision:** Internal commands carry a stable `commandId`, command type and
schema version, source and target services, issuer identity, `issuedAt`,
correlation and causation IDs, an idempotency key, an expected owner
revision when the operation depends on one, and a typed payload. Business
acceptance/rejection is distinct from technical delivery failure. The
issuer identifies the initiating principal or service; its exact
representation remains to be specified.

**Reason:** Explicit command identity and revision preconditions make
cross-service retries and stale-command detection reliable without treating
business rejection as a transport failure.

### D-73 — Reserve all Trip Plan segment resources atomically

**Decision:** Dispatch Planning's CC reservation command identifies the
`tripPlanId` and revision and includes the complete ordered segment set.
Each segment carries start/end stop IDs, a UTC time window, power-unit and
trailer IDs, one or two driver IDs, and expected Fleet Readiness owner
revisions for each assigned resource. CC returns one reservation identifier
and expiry or rejects the request without partial claims. Temporary holds
expire after five minutes.

**Reason:** Capacity must be committed against one complete, versioned
feasible plan so retries or conflicts cannot leave partial reservations.

### D-74 — Return actionable, privacy-safe CC outcomes

**Decision:** A successful CC result returns `outcome: RESERVED`,
`reservationId`, `tripPlanId`, `tripPlanRevision`, and `expiresAt`. A business
rejection returns `outcome: REJECTED`, a stable reason code, and affected
segment/resource IDs. Results must not disclose other customers' or
carriers' reservation details.

**Reason:** Dispatch needs enough information to correct or replan failed
segments without learning another party's private capacity commitments.

### D-75 — Gate Execution creation on confirmed Assignment

**Decision:** Dispatch publishes an immutable active Assignment only after
CC confirms the reservation and Load finalization guards pass. The
Assignment identifies its ID, Load and revision, Trip Plan and revision,
assigned segment resources, and reservation. Execution creates planned Trip
and per-Load records idempotently by Assignment ID. If record creation
fails, preserve the Assignment for visible recovery and do not report active
Execution until Execution confirms its records.

**Reason:** The handoff preserves Dispatch's committed Assignment while
preventing a false claim that Execution exists or has started.

### D-76 — Rotate Identity signing keys with overlap

**Decision:** Identity signing private keys are managed and rotate every
90 days. Publish the next public key before using its private key and retain
the previous public key for at least 24 hours after rotation.

**Reason:** Pre-publishing and overlapping verification keys allows token
issuance and validation to continue through routine rotation.

### D-77 — Validate tokens locally with bounded key caching

**Decision:** Services validate token signature, issuer, audience, time
claims, and allowed algorithm locally. Cache issuer JWKS for at most five
minutes; refresh once on an unknown key ID and reject the token if the key
remains unresolved. High-impact actions require a live session-revocation
check and fail closed if it is unavailable.

**Reason:** Local verification avoids a network call on every request while
bounded key caching and live high-impact revocation checks preserve timely
security controls.

### D-78 — Set the initial Argon2id password baseline

**Decision:** Hash passwords with Argon2id using 19 MiB memory, two
iterations, one lane, and a cryptographically random 16-byte salt. Store the
encoded parameters and rehash after successful authentication when the
policy is raised.

**Reason:** A versioned encoded hash permits a documented initial cost
baseline and future parameter upgrades without changing the stored password
representation.

### D-79 — Throttle repeated sign-in failures progressively

**Decision:** Begin throttling after five failed sign-in attempts for one
account within 15 minutes. Apply progressive delays starting at one minute
and capped at 15 minutes; do not permanently lock the account. Network-level
limits remain to be specified.

**Reason:** Progressive delays raise the cost of repeated guessing while
avoiding a permanent account lockout that could be abused to deny access.

### D-80 — Bind driver invitations to Fleet Readiness profiles

**Decision:** Driver onboarding begins from an existing Fleet Readiness
driver profile. The invitation is bound to that profile and its verified
contact; redemption links the new Identity principal to that exact driver.
Drivers cannot self-select or change the linked profile.

**Reason:** A profile-bound invitation prevents a driver account from
claiming another person's operational record.

### D-81 — Route urgent incident acknowledgements to operations leadership

**Decision:** For an urgent Trip/Load incident, the affected Load's
departure-area supervisor is the primary acknowledgement owner and the chief
supervisor is informed. If no acknowledgement is received within 15
minutes, escalate to the transportation executive.

**Reason:** The supervisor closest to the affected Load owns the first
response, with a clear leadership escalation when that response is not
acknowledged.

### D-82 — Route parked technical failures to operations administration

**Decision:** For a parked technical workflow failure, the
`tms_operations_administrator` is the primary acknowledgement owner and the
owning business-domain owner is informed. Acknowledgement does not authorize
replay; replay that changes business state still requires approval from the
owning domain.

**Reason:** Technical failures need an accountable operator without granting
technical operations authority over business-state changes.

### D-83 — Preserve Execution report and remark corrections

**Decision:** Cap incident report descriptions at 2,000 characters and
remarks at 1,000 characters. Corrections create a new append-only record
that identifies the prior record and includes a reason; records are never
edited or deleted.

**Reason:** Bounded text supports predictable handling, while explicit
correction records preserve an auditable account of what was reported and
changed.

### D-84 — Hold closeout for partial or failed delivery

**Status:** Superseded by D-512.

**Decision:** A `PARTIAL` or `NOT_COMPLETED` delivery outcome creates an
operational exception case and blocks Load closeout until an authorized
supervisor resolves the case and the delivery stop has its proof of delivery
or an authorized, reasoned exception.

**Reason:** Incomplete delivery must remain visible and owned through
resolution rather than being mistaken for a completed Load.

### D-85 — Quarantine evidence until malware scanning succeeds

**Decision:** Uploaded evidence remains quarantined until malware scanning
succeeds. Infected or unscanned files cannot satisfy closeout evidence
requirements. Quarantined objects are retained for controlled investigation.

**Reason:** An unverified file must not be treated as trusted operational
evidence or satisfy a delivery closeout gate.

### D-86 — Make evidence malware scanning asynchronous

**Decision:** After stored-object size/type/checksum verification,
finalization returns `202 Accepted` and starts asynchronous malware
scanning. `GET /api/v1/evidence-uploads/{uploadId}` exposes `SCANNING`,
`AVAILABLE`, `REJECTED`, or `EXPIRED`. Create the evidence record and make
it usable only after a clean scan. Finalization retries are idempotent by
`uploadId` and return the current upload state without duplicate scans or
evidence.
This supersedes the synchronous finalization response semantics in D-68
and D-71.

**Reason:** Asynchronous scanning avoids holding an API request open while
preventing unscanned or infected files from becoming trusted evidence.

### D-87 — Require distinct approval for privileged role grants

**Decision:** Two-person approval for a privileged role grant requires a
distinct initiator and approver; self-approval is prohibited. Audit the
requested grant, the decision, and the time it becomes effective.

**Reason:** Separation between request and approval reduces the risk of
unreviewed privilege escalation and provides an accountable change history.

### D-88 — Restrict driver grants to assigned execution work

**Decision:** In-house and contracted drivers have the same execution-only
authority, scoped to their linked driver profile and active Assignments.
They may report actual milestones, handoffs, incidents, and proof of
delivery. They may not book, amend, or cancel Loads, change plans, or approve
closeout exceptions.

**Reason:** Drivers need to report operational facts for assigned work
without receiving authority over commercial commitments, planning, or
supervisory closeout decisions.

### D-89 — Keep authoritative writes within owning domains

**Decision:** Brokers own Load bookings, pre-execution amendments, and
cancellation requests. Dispatchers own Trip Plans, capacity-reservation
requests, and Assignments. Fleet dispatchers own driver/equipment readiness
facts. Area supervisors authorize closeout exceptions and own operational-
case resolution; Execution records those decisions. Each domain's owning
service is the only authority that writes its business records; role grants
do not confer cross-domain write access.

**Reason:** Clear domain ownership prevents responsibilities and data
authority from being blurred across transportation roles.

### D-90 — Make driver-submitted Execution facts idempotent

**Decision:** Driver-submitted stop milestones, stop outcomes, and incident
reports require an `Idempotency-Key` scoped to the Execution record and
operation. Identical normalized retries return the stored fact; changed
content under the same key returns `409 Conflict`. Corrections are new
append-only records that identify the prior record and include a reason.

**Reason:** Mobile retries must not duplicate operational events, while
correction history remains explicit and auditable.

### D-91 — Persist booking outcomes as versioned JSONB snapshots

**Decision:** Each immutable booking submission stores a versioned JSONB
snapshot of its exact accepted or rejected result, including rejection
issues or accepted follow-ups. Accepted Load field values remain
authoritative in normalized Load revision tables and are not duplicated in
the result snapshot.

**Reason:** A durable response snapshot supports exact idempotent replay
without making API-result JSON the source of truth for Load data.

### D-92 — Expire evidence upload URLs after 30 minutes

**Decision:** Presigned evidence-upload URLs expire 30 minutes after
issuance and cannot be extended. After expiry, the client must create a new
upload intent.

**Reason:** A bounded URL lifetime limits exposure of upload capability
while allowing time for large evidence files to transfer.

### D-93 — Model Fleet Readiness availability as versioned facts

**Decision:** Represent availability as versioned, time-bounded facts with
resource ID, `AVAILABLE`/`UNAVAILABLE` state, `validFrom`, `validTo`,
`observedAt`, source, and owner revision. Missing or expired availability
is `UNKNOWN`; do not persist it as a durable `ready` boolean.

**Reason:** Versioned validity and source information allow Dispatch Planning
to distinguish a current availability assertion from missing or stale data.

### D-94 — Keep durable booking intake available during Temporal outages

**Decision:** A valid booking returns success during a Temporal outage if
Load durably commits the submission, Load/revision records, and outbox.
Planning remains queued for recovery and no Assignment is asserted before
Dispatch Planning confirms it. If Load cannot durably commit, return failure
rather than success.

**Reason:** Booking acknowledgement reflects durable Load ownership, while
planning recovery remains asynchronous and cannot be misrepresented as
completed.

### D-95 — Normalize Load revisions within the Load service database

**Decision:** The Load service stores mutable lifecycle heads in `loads`,
immutable snapshots in `load_revisions`, and revision-owned ordered stops
and freight lines in `load_revision_stops` and
`load_revision_freight_lines`. The same Load-owned database stores
`booking_submissions` with versioned JSONB input/result snapshots where
applicable. These are not separate services, and cross-service foreign keys
are not used.

**Reason:** Normalized revision-owned relational data preserves Load
authority and revision integrity while keeping booking acceptance atomic
within one service boundary.

### D-96 — Classify Capacity Commitment rejection outcomes

**Decision:** CC business rejections use stable codes
`RESOURCE_UNAVAILABLE`, `STALE_READINESS_REVISION`,
`SEGMENT_TIME_CONFLICT`, `INCOMPATIBLE_RESOURCE`, or
`TRIP_PLAN_REVISION_STALE`. Each rejection identifies affected segment and
resource IDs and includes `replanMayResolve`. Results do not disclose other
customers' or carriers' reservation details.

**Reason:** Cause-specific, privacy-safe outcomes let Dispatch distinguish
resource contention from stale or invalid plans and choose whether to retry
or replan.

### D-97 — Enforce immutable Load revision integrity

**Decision:** Enforce unique `(load_id, revision_number)` in
`load_revisions`, and unique stop and freight-line ordering within each
revision. Ensure `loads.current_revision_id` references a revision owned by
that same Load. Protect revisions and their child rows from update and
deletion.

**Reason:** Database constraints preserve revision ordering, head
consistency, and the immutable Load history used by planning and Execution.

### D-98 — Persist idempotency state within each owning service

**Decision:** Each service that accepts idempotent operations persists its
own idempotency record, scoped to authenticated principal, operation, and
target resource when present. Store the normalized content hash and durable
result reference in the same transaction as the business write, and enforce
scope uniqueness to prevent duplicate records under concurrent retries.
Do not use a shared idempotency database or service.

**Reason:** Transactional local idempotency preserves each domain's
authority and ensures retries cannot outlive or diverge from the business
record they protect.

### D-99 — Release or replace complete CC reservations atomically

**Decision:** CC release commands identify the current `reservationId` and
Trip Plan revision. Each command either releases the complete reservation or
atomically replaces it with the complete feasible remaining segment set.
Individual segment claims are never released piecemeal.

**Reason:** Complete-set operations prevent a cancellation or plan change
from leaving a partially reserved Trip Plan.

### D-100 — Enforce capacity exclusivity with range constraints

**Decision:** CC stores resource claims in `reservation_claims` with
`resource_type`, `resource_id`, and PostgreSQL `tstzrange` windows. A GiST
exclusion constraint prevents overlapping active claims for the same
resource.

**Reason:** A database-enforced range constraint closes the race between
concurrent reservation attempts that an application-only availability check
could not safely prevent.

### D-101 — Use half-open capacity reservation windows

**Decision:** Capacity claims use half-open `[start, end)` `tstzrange`
windows. A new claim may begin exactly when a prior claim ends. Represent
repositioning time by extending the affected resource's reserved interval.

**Reason:** Half-open windows provide consistent boundary behavior without
creating artificial conflicts; actual travel time remains part of the
resource schedule.

### D-102 — Sign Identity access tokens with RS256

**Decision:** Identity signs access tokens with `RS256`. Receiving services
reject `none` and any algorithm not explicitly configured.

**Reason:** A single configured asymmetric algorithm provides consistent
signature validation across services and prevents algorithm negotiation from
weakening token verification.

### D-103 — Store typed Execution facts in relational tables

**Decision:** Execution stores stop milestones, stop outcomes, driver
handoffs, incident reports, and report corrections in separate typed,
append-only relational tables rather than one generic JSONB event table.

**Reason:** Typed tables preserve the distinct required fields and
relationships of each operational fact while maintaining immutable history.

### D-104 — Track CC reservation lifecycle explicitly

**Decision:** CC reservation states are `HELD`, `CONFIRMED`, `RELEASED`,
`EXPIRED`, and `SUPERSEDED`. Only `HELD` and `CONFIRMED` resource claims
block capacity. A temporary `HELD` reservation expires after five minutes.

**Reason:** Explicit reservation states distinguish temporary planning
protection from committed capacity and preserve release/expiry history.

### D-105 — Confirm capacity after Load finalization

**Decision:** After Load finalization guards pass, CC transitions the hold
from `HELD` to `CONFIRMED` immediately before Dispatch activates the
Assignment. A failed finalization releases the hold. An interrupted
Assignment activation preserves the confirmed reservation and pending
decision for recovery against the same reservation.

**Reason:** Capacity becomes committed only after Load facts are finalized,
while retaining the claim during Assignment recovery prevents duplicate
planning from taking the same resources.

### D-106 — Authorize POD uploads for driver and accountable staff

**Decision:** POD upload intents may be created by the assigned driver, the
dispatcher responsible for that driver, and the Load's area supervisor or
documented supervisory coverage. The responsible dispatcher is the
`fleet_dispatcher` or `contract_capacity_dispatcher` whose scope covers the
driver's assignment. Upload permission does not grant closeout-exception
approval; brokers cannot submit delivery evidence.

**Reason:** Drivers and accountable operational staff can preserve POD
evidence without giving brokers or upload submitters authority to approve
their own closeout exceptions.

### D-107 — Return privacy-safe evidence upload status

**Decision:** `GET /api/v1/evidence-uploads/{uploadId}` returns `uploadId`,
status, and expiry. Include `evidenceId` only for `AVAILABLE` and a stable
`reasonCode` only for `REJECTED`; never return the object-storage URL.
Unfinalized intents become `EXPIRED` when their presigned URL expires.

**Reason:** Clients can track upload and scan results without exposing a
reusable storage capability.

### D-108 — Persist complete transactional outbox delivery state

**Decision:** Each service's local outbox stores a unique message ID,
type/schema version, source/target, correlation/causation IDs, payload,
creation time, publish attempt count, next-attempt time, and terminal or
parked failure reason. Commit the outbox row atomically with the owning
business state.

**Reason:** Durable delivery metadata makes publication retries inspectable
and recoverable without separating message state from its business fact.

### D-109 — Deduplicate messages through local transactional inboxes

**Decision:** Each consumer keeps a local inbox unique on
`(consumer_service, message_id)` with `RECEIVED`, `PROCESSED`, or `PARKED`
status, attempt count, last error, and timestamps. Duplicate delivery is a
no-op. Commit a successful business effect and the `PROCESSED` state
atomically in the consumer's database.

**Reason:** Durable deduplication ensures at-least-once message delivery
cannot duplicate a consumer's business effect.

### D-110 — Bound transient delivery retries with jitter

**Decision:** Make eight total delivery attempts including the initial
attempt. After a transient failure, wait one second and exponentially double
the delay with full jitter, capped at five minutes. Park exhausted work for
authorized recovery.

**Reason:** Bounded jittered retries avoid synchronized retry storms while
giving temporary failures time to recover before requiring operator action.

### D-111 — Require fresh MFA for sensitive Identity changes

**Decision:** Account and privileged role changes require an MFA step-up
completed within the preceding five minutes. Older authentication context is
not sufficient; the administrator must complete a new step-up challenge.

**Reason:** A short authentication-freshness window protects sensitive
account administration if a privileged session is left unattended.

### D-112 — Bound service-token lifetime and audience

**Decision:** Service-to-service OIDC client-credential access tokens expire
after 15 minutes and are audience-bound to the receiving service.

**Reason:** Audience restriction limits token reuse across service
boundaries, while a finite workload-token lifetime bounds exposure.

### D-113 — Rotate service workload credentials regularly

**Decision:** Rotate service workload credentials at least every 90 days
with a 24-hour overlap for planned rotation. Revoke credentials immediately
if compromise is suspected.

**Reason:** Regular rotation limits the lifetime of exposed workload
credentials while overlap avoids planned service interruption.

### D-114 — Bound routine access after role changes

**Decision:** Suspension or deactivation revokes refresh sessions
immediately. Routine authorization may continue to rely on an already-issued
token until its maximum 15-minute expiry; high-impact actions must verify
current session revocation immediately. Role changes may likewise remain in
routine token grants for no more than 15 minutes.

**Reason:** A bounded token lifetime gives predictable propagation without
requiring online revocation checks for every routine request, while
high-impact actions remain immediately protected.

### D-115 — Retain idempotency results with protected resources

**Decision:** Retain each idempotency result for the lifetime of the
resource it protects, including booking submissions, amendment revisions,
cancellation requests, and Execution facts. Do not expire results on a
shorter fixed timer.

**Reason:** A late retry must still resolve to its original durable business
result rather than creating duplicate work after a fixed key-retention
window.

### D-116 — Audit exception-case transitions separately

**Decision:** Store each exception case's current state separately from
append-only `exception_case_transitions` containing from/to state, actor,
timestamp, and reason. Reopening a resolved case requires a reason.

**Reason:** Dedicated transition records preserve who changed case
ownership/state and why, without overwriting the current case's history.

### D-117 — Verify contracted drivers' Carrier relationships

**Decision:** A contracted driver links to an `ACTIVE` Carrier profile and
is ineligible for planning until an authorized `contract_capacity_dispatcher`
verifies the relationship. Retain the evidence source/reference, verifier
principal, and verification time with the relationship record.

**Reason:** Carrier affiliation is an operational prerequisite, not an
assumption based on an account invitation or driver-submitted claim.

### D-118 — Separate driver profile lifecycle from assigned work

**Decision:** Fleet Readiness driver profiles use `PENDING`, `ACTIVE`,
`SUSPENDED`, and `CLOSED` states. Only `ACTIVE` profiles may be considered
for new Assignments, subject to current readiness and qualification gates.
Suspension or closure preserves existing Assignments and Execution history
for explicit review and does not automatically cancel or remove active work.

**Reason:** Profile lifecycle controls future eligibility without
silently changing already-committed operational work.

### D-119 — Control one-to-one Identity-to-driver links

**Decision:** Link each Identity principal to at most one Fleet Readiness
driver profile and each driver profile to at most one principal. Correcting
a link requires approval from both an Identity administrator and the Fleet
Readiness owner and an audit record; users cannot relink themselves.

**Reason:** A dual-owner, one-to-one link prevents account claims from
rewriting driver identity and preserves operational accountability.

### D-120 — Audit Identity security events without secrets

**Decision:** Identity keeps append-only audit events for invitation and
account-state changes, authentication and MFA outcomes, recovery, session
creation/revocation, and role grants/approvals. Each records actor, subject,
time, outcome, reason, and correlation ID. Never log credentials, secrets,
or token contents.

**Reason:** Security-relevant account actions need traceability without
turning audit logs into a source of authentication secrets.

### D-121 — Restrict and retain Identity audit records

**Decision:** Retain Identity audit events in searchable storage for one
year, then securely delete them unless a documented legal or incident hold
applies. Limit review access to designated Identity/security administrators.

**Reason:** A defined retention and access boundary supports investigation
while limiting unnecessary exposure of security and personal data.

### D-122 — Keep customer service Load-linked and internal

**Decision:** Customer instructions, appointment coordination/changes, and
status communication are internal follow-up tasks linked to a Load and
owned by its broker. Customer portals and standalone CRM/contact-center
case management are outside the approved scope.

**Reason:** Load-linked follow-up supports the transportation workflow
without expanding the TMS into a general customer relationship platform.

### D-123 — Keep documents with their owning transportation records

**Decision:** Document handling is limited to transportation records
attached to their owning Load revision or Execution. This includes booking
and rate-confirmation documents on the Load side, and POD, receipts, and
incident evidence on the Execution side. Generic document management and
unrelated company files are outside scope.

**Reason:** Keeping each document with its authoritative transportation
record preserves domain ownership without introducing a general-purpose
document repository.

### D-124 — Defer transportation accounting and settlement

**Decision:** The TMS records the agreed Load rate and operational
adjustment facts, but customer invoicing, accounting/AR/AP, carrier payables,
and settlement workflows are deferred. Define any operational adjustment
records separately; do not infer that an adjustment fact authorizes an
invoice or payment.

**Reason:** Retaining commercial context supports transportation operations
without turning the initial TMS scope into an accounting system.

### D-125 — Limit safety and compliance scope to approved operational gates

**Decision:** The TMS may store verified, planning-critical safety and
contractual eligibility facts and enforce approved hard gates. It does not
independently interpret legal or regulatory requirements, provide regulatory
reporting, or manage safety cases. Applicable rules must be validated using
authoritative sources and qualified review before they become product policy.
The specific facts, evidence, owners, and gate rules remain to be defined.

**Reason:** This supports operational readiness without implying that the TMS
is a compliance authority or a full safety-management system.

### D-126 — Record operational adjustment proposals without settlement

**Decision:** The TMS records Load-linked operational adjustment proposals,
including the adjustment type, reason, amount and currency, supporting
evidence, requester, and internal review outcome. Examples include detention,
layover, and handling charges. A recorded proposal or review outcome does not
authorize customer invoicing, carrier payment, or settlement. The adjustment
catalogue and detailed review workflow remain to be defined.

**Reason:** Recording the operational facts and their review supports Load
history while preserving the boundary against accounting and settlement.

### D-127 — Track post-delivery claims as operational Load-linked cases

**Status:** Superseded by D-512.

**Decision:** The TMS tracks post-delivery claims, including damage,
shortage, loss, and customer/carrier disputes, as cases linked to the
relevant Load and, where applicable, Execution. Cases record an accountable
owner, supporting evidence, status, and resolution. Claim tracking does not
include invoicing, payment, or settlement. The accountable department and
detailed lifecycle remain to be defined.

**Reason:** A bounded operational case record preserves follow-through and
evidence after delivery without expanding the TMS into a financial system.

### D-128 — Assign a designated owner to each post-delivery claim

**Status:** Superseded by D-512.

**Decision:** Each post-delivery claim case has a designated owner who is
accountable for coordinating it through resolution, regardless of the
owner's department. This establishes case accountability, not a new
department or role grant; permitted actions and escalation remain to be
defined.

**Reason:** A named case owner prevents cross-functional claims from becoming
unowned while allowing the company to assign responsibility flexibly.

### D-129 — Reuse the established case lifecycle for post-delivery claims

**Status:** Superseded by D-512.

**Decision:** Post-delivery claim cases use the established `OPEN`,
`IN_PROGRESS`, and `RESOLVED` lifecycle. Reopening a resolved claim requires
a reason and an audited transition. Claim-specific actions, outcomes, and
escalation remain to be defined.

**Reason:** A shared lifecycle keeps operational case handling consistent
without forcing claims into the Execution exception workflow or data store.

### D-130 — Limit claim cases to operational follow-up and referral

**Status:** Superseded by D-512.

**Decision:** Claim cases support internal operational follow-up and referral,
recording facts, evidence, ownership, status, and outcome. The TMS does not
manage formal insurance handling, legal adjudication, or financial settlement
of claims.

**Reason:** A clear boundary preserves operational accountability without
turning the TMS into an insurance, legal, or financial claims system.

### D-131 — Include manual tenders to existing approved Carriers

**Decision:** The TMS supports manual tendering to existing approved Carrier
profiles, including recording the tender and the Carrier's acceptance or
rejection. Load-board marketplace sourcing and automated procurement are
outside this scope. The `contract_capacity_dispatcher` owns sending tenders
and tracking Carrier responses. Tender terms, response timing, and the
response window remain to be defined.

**Reason:** This supports coordinated use of known Carrier relationships
without introducing a marketplace or automated procurement capability. It
keeps carrier-side coordination with the role responsible for contracted
capacity.

### D-132 — Require normal capacity confirmation after tender acceptance

**Decision:** A Carrier's tender acceptance records acceptance only; it does
not itself secure capacity or create an Assignment. The Load remains
unprotected until Dispatch Planning and Capacity Commitment complete their
normal eligibility, reservation, and Assignment finalization workflow.

**Reason:** Carrier agreement and system-confirmed resource capacity are
distinct facts; treating acceptance as a reservation could expose the Load
to unverified or conflicting capacity.

### D-133 — Record offered and agreed Carrier rates on tenders

**Decision:** A manual Carrier tender records the offered Carrier rate and,
when accepted, the agreed rate and currency as operational facts. Recording
the agreed rate does not authorize carrier payables, payment, or settlement.

**Reason:** Preserving the carrier-side commercial agreement supports Load
operations and history without expanding the TMS into accounting.

### D-134 — Expire unanswered Carrier tenders at an explicit deadline

**Decision:** Every manual Carrier tender has an explicit response deadline.
If no response is recorded by that deadline, the tender expires and a later
response cannot accept that expired tender. The default response interval was
left open initially and is set by D-135; notification policy remains to be
defined.

**Reason:** A bounded response window prevents an unanswered offer from
remaining active indefinitely or being mistaken for secured capacity.

### D-135 — Set a one-hour default Carrier tender deadline

**Decision:** A manual Carrier tender defaults to a response deadline one
hour after it is sent. The `contract_capacity_dispatcher` may edit the
deadline on an individual tender.

**Reason:** A defined default makes tender handling consistent while allowing
the responsible dispatcher to account for the circumstances of a specific
offer.

### D-136 — Notify the tender owner of Carrier responses and expiry

**Decision:** Immediately notify the responsible
`contract_capacity_dispatcher` when a Carrier accepts or rejects a tender, or
when the tender expires. D-169 later resolved the reminder policy: no
pre-deadline reminders are sent.

**Reason:** Promptly surfacing terminal tender events lets the responsible
dispatcher continue planning without relying on repeated manual checks.

### D-137 — Include operational performance reporting

**Decision:** Management reporting includes operational performance measures,
including on-time performance and utilization. KPI definitions, calculation
rules, reporting periods, and accountable owners remain to be defined.
Financial, accounting, and settlement reporting are outside the approved
scope.

**Reason:** Operational measures support oversight of transportation work
without introducing deferred financial-management functions.

### D-138 — Measure on-time performance at confirmed stop appointments

**Decision:** On-time performance is measured at each stop with a confirmed
appointment window, using the recorded `ARRIVED` milestone. Report pickup
and delivery stops separately. Exclude stops without a confirmed appointment
window from this measure.

**Reason:** Comparing actual arrival with the agreed stop window measures
performance against an explicit operating commitment and avoids treating
unconfirmed targets as appointments.

### D-139 — Report equipment and driver utilization separately

**Decision:** Operational reporting includes separate utilization measures
for equipment and drivers. The formulas, eligible time/resource populations,
and treatment of contracted capacity remain to be defined.

**Reason:** Separate measures distinguish vehicle deployment from driver
deployment and make utilization gaps actionable without conflating resources.

### D-140 — Measure equipment utilization by confirmed commitment time

**Decision:** The equipment-utilization numerator is time under a confirmed
Assignment and Capacity Commitment reservation. The denominator, reporting
period, and treatment of cancelled or superseded commitments remain to be
defined.

**Reason:** Confirmed commitment time reflects equipment capacity allocated
to work without conflating planned or unprotected tenders with actual
utilization.

### D-141 — Measure driver utilization by confirmed Assignment time

**Decision:** The driver-utilization numerator is time under a confirmed
Assignment. Report it separately from equipment utilization. The denominator,
reporting period, and treatment of cancelled or superseded Assignments remain
to be defined.

**Reason:** Using the same confirmed-work basis for both resource types
supports comparison while preserving separate driver and equipment measures.

### D-142 — Use declared availability as the utilization denominator

**Decision:** Equipment and driver utilization use each resource's declared
operational-availability time as the denominator, rather than all calendar
time. Unknown or stale availability is handled as defined in D-143;
overlapping or revised intervals remain to be defined.

**Reason:** Availability-based denominators measure deployment against time
the resource was actually offered for operational work.

### D-143 — Exclude unknown availability from utilization denominators

**Decision:** Periods with unknown or stale availability are excluded from
equipment and driver utilization denominators and reported separately as
unknown. They are not treated as available or unavailable time.

**Reason:** This avoids overstating or understating utilization when the TMS
does not have a current availability fact.

### D-144 — Provide daily, weekly, and monthly KPI periods

**Decision:** Initial operational KPI reporting supports daily, weekly, and
monthly periods. The timezone and exact period-boundary rules remain to be
defined.

**Reason:** These periods support both short-term operating review and
longer-term performance oversight without requiring arbitrary custom ranges
at the outset.

### D-145 — Use a company-wide KPI reporting timezone

**Decision:** Daily, weekly, and monthly KPI periods use the company-wide
`America/Los_Angeles` timezone, following its daylight-saving rules. The
weekly period start is defined in D-146.

**Reason:** One named reporting timezone provides consistent company-wide
periods while following the local civil-time calendar of the company's
initial home area.

### D-146 — Start KPI reporting weeks on Monday

**Decision:** Weekly KPI periods begin Monday at 00:00 in the
`America/Los_Angeles` timezone and end immediately before the next Monday.

**Reason:** A Monday start aligns weekly operational review with the
ISO-style work week and remains consistent across daylight-saving changes.

### D-147 — Include contracted resources in utilization reporting

**Decision:** Equipment and driver utilization includes both in-house and
contracted resources when Fleet Readiness has declared availability and a
confirmed Assignment/reservation exists.

**Reason:** Reporting on all eligible operational capacity avoids omitting
contracted resources that the company relies on to execute Loads.

### D-148 — Stop utilization time at cancellation or supersession

**Decision:** For a cancelled or superseded confirmed reservation or
Assignment, count only the interval during which it was confirmed/active.
Stop counting at the effective cancellation or supersession time; do not
count the unused remainder of the original planned interval.

**Reason:** This reflects the time capacity was actually committed and
prevents cancelled work from inflating utilization.

### D-149 — Recalculate historical utilization from corrected availability

**Decision:** When Fleet Readiness corrects a past availability interval,
historical utilization results are recalculated from the corrected owner
facts. Preserve the underlying append-only owner revision history.

**Reason:** Corrected authoritative availability should improve historical
measurement without erasing the record of what was previously reported.

### D-150 — Limit maintenance scope to readiness blockers

**Decision:** The TMS uses verified equipment maintenance status only as a
readiness or availability blocker. Maintenance work orders, scheduling,
parts, and maintenance-management workflows are outside the current scope.
Evidence requirements and the details of the validity deadline remain to be
defined; status vocabulary is set by D-152.

**Reason:** Maintenance status can prevent unsafe or unavailable equipment
from entering planning without making the TMS a maintenance-management
system.

### D-151 — Assign maintenance-status facts by equipment relationship

**Decision:** The `fleet_dispatcher` records and verifies maintenance-status
readiness facts for in-house equipment. The
`contract_capacity_dispatcher` records and verifies them for contracted
equipment. Neither role owns maintenance work orders or scheduling.

**Reason:** The role responsible for each equipment relationship can verify
its operational status without creating an unapproved maintenance department.

### D-152 — Use a binary maintenance readiness status

**Decision:** The maintenance readiness fact uses `CLEAR` or `BLOCKED` and
includes a reason and evidence reference. `BLOCKED` prevents equipment from
being considered for planning; `CLEAR` removes only the maintenance blocker
and does not establish overall equipment eligibility.

**Reason:** A small, explicit gate prevents a maintenance status from being
mistaken for full readiness or a complete maintenance lifecycle.

### D-153 — Require an explicit expiry for maintenance status

**Decision:** Every maintenance-status fact has an explicit validity
deadline. Missing or expired status is unknown and blocks equipment from
planning; a `CLEAR` status does not remain valid indefinitely. The deadline
selection rule is set in D-154.

**Reason:** An explicit validity period prevents an old `CLEAR` fact from
being treated as current after equipment condition may have changed.

### D-154 — Align maintenance-status expiry with verified evidence

**Decision:** Use the verified evidence's valid-through date as the
maintenance-status validity deadline when it provides one. If it does not,
the responsible dispatcher sets a finite deadline for that status.

**Reason:** Evidence-based expiry keeps a status current through its support
period without allowing an unsupported `CLEAR` fact to remain valid
indefinitely.

### D-155 — Record maintenance-status verification provenance

**Decision:** Each maintenance-status fact records its status, reason,
evidence source/reference, verifier principal, observed time, and valid-through
time.

**Reason:** Provenance makes the readiness decision reviewable and supports
expiry enforcement without requiring the TMS to manage maintenance documents.

### D-156 — Close claim cases when referral is documented

**Status:** Superseded by D-512.

**Decision:** A post-delivery claim case may be marked `RESOLVED` when its
operational follow-up is complete or when its referral outside the TMS is
documented. The TMS does not track the referred claim through the external
party's completion. Closure outcomes are defined by D-157; referral details
are defined by D-158.

**Reason:** Documented referral provides an auditable handoff without
extending the TMS into external insurance or legal claim management.

### D-157 — Record controlled claim closure outcomes

**Status:** Superseded by D-512.

**Decision:** Claim closure records one of `OPERATIONALLY_RESOLVED`,
`DENIED`, `WITHDRAWN`, `DUPLICATE`, or `REFERRED_OUTSIDE_TMS`, with a
required reason. `DENIED` is an internal operational disposition only; it
does not assert legal liability or an insurer's claim decision.

**Reason:** Controlled outcomes support consistent reporting while keeping
legal and insurance determinations outside the TMS.

### D-158 — Record claim referral details

**Status:** Superseded by D-512.

**Decision:** A referred claim records the referral destination and date/time,
any available external reference, and supporting evidence. Recording these
details documents the handoff; it does not create or track an external claim
workflow.

**Reason:** A concise referral record provides auditable evidence of handoff
while keeping external claim handling outside the TMS.

### D-159 — Let the designated claim owner resolve the case

**Status:** Superseded by D-512.

**Decision:** The designated owner may transition a claim case to `RESOLVED`
after recording a permitted closure outcome and required reason. Audit all
outcome and state transitions; no blanket supervisor approval is required.

**Reason:** The accountable owner can complete the operational handoff while
preserving reviewable decision history without adding routine supervisory
approval.

### D-160 — Assign claim owners through the Load's area supervisor

**Status:** Superseded by D-512.

**Decision:** The Load's area supervisor assigns and may reassign the
designated owner of a post-delivery claim from eligible staff. Escalation
rules remain open.

**Reason:** Supervisory assignment establishes clear accountability while
allowing the case owner to be selected from the function best suited to
coordinate the specific claim.

### D-161 — Require explicit claim-owner permission

**Status:** Superseded by D-512.

**Decision:** An area supervisor may assign a post-delivery claim to any staff
member with explicit claim-owner permission, regardless of department.

**Reason:** This enables cross-functional ownership without granting claim
authority through department membership alone or creating a dedicated claims
role.

### D-162 — Escalate claim cases through the Load's area supervisor

**Status:** Superseded by D-512.

**Decision:** When the claim owner needs a decision or cannot progress the
case, escalation goes first to the Load's area supervisor. The supervisor may
escalate further through the supervisory chain.

**Reason:** The area supervisor remains accountable for the Load's operational
outcome while retaining the existing supervisory path for issues beyond that
authority.

### D-163 — Make claim escalation owner-initiated

**Status:** Superseded by D-512.

**Decision:** The claim owner may escalate whenever the case is blocked or
requires a decision beyond the owner's authority. Escalation is not triggered
automatically by elapsed time.

**Reason:** Escalation responds to an actual need for intervention rather than
creating an arbitrary timer for cases that may be progressing appropriately.

### D-164 — Assign operational adjustment review to the area supervisor

**Decision:** The Load's area supervisor reviews a Load-linked operational
adjustment proposal and records the review outcome. Neither the proposal nor
its review authorizes invoicing, carrier payment, or settlement.

**Reason:** The accountable supervisor can assess the proposal against the
Load's operational record while preserving the boundary between operational
review and financial processing.

### D-165 — Use explicit operational adjustment review outcomes

**Decision:** The area supervisor records one of `SUPPORTED`,
`NOT_SUPPORTED`, or `NEEDS_INFORMATION` as the internal review outcome for an
operational adjustment proposal. These outcomes do not authorize invoicing,
carrier payment, or settlement.

**Reason:** A small controlled outcome set makes the operational assessment
clear and reportable without implying financial approval.

### D-166 — Return incomplete adjustment proposals for resubmission

**Decision:** When a proposal is marked `NEEDS_INFORMATION`, return it to the
requester to add information and resubmit for review. Preserve the prior
review history.

**Reason:** The requester can supply missing details without losing the
auditable history of earlier assessments.

### D-167 — Cover common Carrier accessorial proposals

**Decision:** The operational adjustment catalogue covers common Carrier
accessorial proposals, including fuel, toll, and equipment-related charges as
well as detention, layover, and handling. Allow `OTHER` with a required
explanation. The exact initial type list remains to be finalized.

**Reason:** The proposal record should accommodate common operational
adjustments without making the initial catalogue depend on a narrow set of
examples.

### D-168 — Permit authorized Load-linked adjustment submissions

**Decision:** Any staff member with explicit adjustment-proposal submission
permission and access to the relevant Load may submit a Load-linked
operational adjustment proposal.

**Reason:** Staff closest to the operational facts can record a proposal
without making submission authority depend on department membership.

### D-169 — Omit pre-deadline Carrier tender reminders

**Decision:** Do not send pre-deadline reminders for unanswered Carrier
tenders. Continue to notify the responsible `contract_capacity_dispatcher`
immediately on acceptance, rejection, or expiry.

**Reason:** Terminal tender events provide the required action signal without
adding reminder notifications before the configured response deadline.

### D-170 — Support multi-round Carrier tender negotiations

**Decision:** A Carrier and the responsible `contract_capacity_dispatcher`
may exchange counteroffers over multiple rounds. Each new offer or
counteroffer starts a new response period, with a one-hour default deadline
editable per tender. Carrier acceptance remains distinct from capacity
reservation.

**Reason:** Iterative negotiation supports manual Carrier coordination while
preserving an explicit response window for each offer and the established
separation between commercial agreement and secured capacity.

### D-171 — Allow the tender owner to accept Carrier counteroffers

**Decision:** The responsible `contract_capacity_dispatcher` may accept a
Carrier counteroffer on behalf of the company without blanket supervisor
approval.

**Reason:** The role responsible for manual tender negotiation can conclude
the operational agreement without adding routine approval outside its
established responsibility.

### D-172 — Notify the tender owner of each Carrier counteroffer

**Decision:** Immediately notify the responsible
`contract_capacity_dispatcher` whenever a Carrier counteroffer is recorded in
the TMS.
This is an internal TMS notification; the dispatcher communicates with the
Carrier through the existing external channel under D-178.

**Reason:** Each counteroffer requires timely action to continue, accept, or
end the negotiation.

### D-173 — Do not allow dispatcher withdrawal of an open tender

**Decision:** The responsible `contract_capacity_dispatcher` cannot withdraw
an open tender. It remains active until acceptance, rejection, or expiry,
unless the Load is canceled under D-174.

**Reason:** A fixed set of terminal outcomes keeps manual tender lifecycle
transitions explicit and predictable.

### D-174 — Cancel open tenders when their Load is canceled

**Decision:** When a Load is canceled, automatically cancel its open Carrier
tender and notify the responsible `contract_capacity_dispatcher`. The
dispatcher informs the Carrier through the existing external channel under
D-178. Preserve the tender's negotiation history.

**Reason:** A tender should not remain actionable after its underlying Load
commitment has been canceled.

### D-175 — Limit tender counteroffers to rate and currency

**Decision:** A tender offer or counteroffer may change only the offered rate
and currency. Changes to Load scope or operating requirements must use the
normal Load amendment and replanning process.

**Reason:** Keeping tender negotiation limited to compensation prevents
commercial negotiation from bypassing the authoritative Load and planning
workflows.

### D-176 — Fix one rate basis for each tender negotiation

**Decision:** Each tender uses one rate basis selected from `FLAT_PER_LOAD`,
`PER_MILE`, `PER_KILOMETER`, `PER_HOUR`, `PER_STOP`, or `OTHER`. `OTHER`
requires an explanation. The basis remains fixed throughout negotiation;
counteroffers may change the numeric rate and currency only.

**Reason:** A stable basis makes offers comparable across counteroffer rounds
while allowing the Carrier and dispatcher to negotiate the amount and
currency.

### D-177 — Calculate indicative tender totals from Trip Plan quantities

**Decision:** A `FLAT_PER_LOAD` amount is itself the indicative total without
requiring a Trip Plan. For `PER_MILE`, `PER_KILOMETER`, `PER_HOUR`, and
`PER_STOP`, calculate an indicative total from the selected Trip Plan
revision's planned distance, duration, or stop count. Show the quantity and
Trip Plan revision used. Until a plan exists, show the unit rate for these
bases without a calculated total. When a new Trip Plan revision changes the
quantities, recalculate the current indicative total and preserve the previous
estimate history. For `OTHER`, record the explained rate but do not calculate
a total.

**Reason:** A revision-linked estimate provides useful planning context
without presenting a plan-dependent amount as final or erasing earlier
estimates when the plan changes.

### D-178 — Keep Carrier tender communication manual

**Decision:** In this phase, the responsible
`contract_capacity_dispatcher` communicates tenders, counteroffers, and Load-
cancellation notices to Carriers through the existing external channel and
records sent offers and Carrier responses in the TMS. The TMS does not deliver
these external messages or provide a Carrier portal. The dispatcher sends the
Carrier notice required by D-174.

**Reason:** Manual communication supports the approved tender workflow
without introducing an external messaging integration or Carrier-facing
application.

### D-179 — Limit initial Carrier tender currency to USD

**Decision:** Carrier tender offers and counteroffers use USD in the initial
TMS scope; currency conversion is not performed.

**Reason:** A single initial currency avoids introducing exchange-rate
management into operational tendering.

### D-180 — Limit stored tender rates to two decimal places

**Decision:** Store Carrier tender rates with a maximum of two decimal places
for every rate basis.

**Reason:** A consistent precision keeps all tender rate inputs aligned with
the initial USD currency scope.

### D-181 — Round indicative tender totals half up

**Decision:** Round calculated indicative USD totals to two decimal places
using half-up rounding to the nearest cent.

**Reason:** A single explicit rounding rule makes calculated tender estimates
consistent and reproducible.

### D-182 — Do not cap Carrier tender counteroffer rounds

**Decision:** Carrier tender negotiations have no fixed maximum number of
counteroffer rounds. Each round remains governed by its response deadline.

**Reason:** The agreed deadline for every new offer provides a bounded
response window without imposing an arbitrary limit on a live negotiation.

### D-183 — Require positive Carrier tender rates

**Decision:** A Carrier tender rate must be greater than USD 0.00; zero and
negative rates are invalid.

**Reason:** A tender represents a commercial offer to transport the Load and
must carry a positive rate.

### D-184 — Expire the tender when a negotiation round times out

**Decision:** If either party does not respond before the current offer or
counteroffer deadline, the entire tender expires. A late response cannot
reopen it.

**Reason:** A single terminal outcome prevents a stale negotiation round from
being mistaken for an active offer.

### D-185 — Assign company-wide KPI ownership to the transportation executive

**Decision:** The transportation executive owns the company-wide operational
KPI set, including its definitions and review.

**Reason:** Company-wide ownership keeps KPI interpretation and performance
review consistent across operational areas.

### D-186 — Restrict initial operational KPI dashboard access

**Decision:** The transportation executive and chief supervisor may view
company-wide operational KPIs. Area supervisors may view KPIs only for their
assigned areas. Other roles receive no KPI dashboard access by default.

**Reason:** Scoped dashboard access aligns visibility with supervisory
accountability and avoids granting broad management data access to every TMS
user.

### D-187 — Keep the company-wide Operations View read-only

**Decision:** The Operations View covers all in-scope TMS operational records
and workflows as read-only projections. It links users to the owning service
for actions and never writes authoritative business records.

**Reason:** A cross-domain view provides broad operational visibility without
duplicating domain ownership or bypassing service-level authorization.

### D-188 — Scope Operations View access to role and resource authority

**Decision:** The transportation executive and chief supervisor may access
Operations View records company-wide. Other users are scoped to their assigned
area where applicable, or to their existing resource and relationship
authority when they have no area grant.

**Reason:** The read-only view should preserve the TMS's established
authorization boundaries rather than creating broader record access through
aggregation.

### D-189 — Require verified evidence references for maintenance status

**Decision:** A maintenance-status fact must reference a verified maintenance
record or inspection. Attach a supporting document when one exists; an
attachment is not mandatory when no document exists.

**Reason:** A verifiable source supports readiness decisions without turning
the TMS into a maintenance-document repository.

### D-190 — Separate Customer and Carrier adjustment workflows

**Decision:** Customer charge proposals and Carrier cost proposals are
distinct operational workflows, and both are in scope. The review, outcome,
and submission decisions in D-164 through D-168 apply to the Carrier cost
workflow only. They do not define the Customer charge workflow.

**Reason:** Keeping the two proposal types distinct prevents their owners,
review outcomes, or operational meaning from being conflated.

### D-191 — Prevent self-review of Carrier cost proposals

**Decision:** The Load's area supervisor reviews Carrier cost proposals. If
that supervisor submitted the proposal, another authorized supervisor reviews
it; the chief supervisor or transportation executive may provide coverage.

**Reason:** A proposal's submitter should not make its own internal review
decision, while an established supervisory role can maintain review
continuity.

### D-192 — Apply controlled review outcomes to Carrier cost proposals

**Decision:** A Carrier cost proposal review records `SUPPORTED`,
`NOT_SUPPORTED`, or `NEEDS_INFORMATION`. A `NEEDS_INFORMATION` proposal
returns to its requester for added information and resubmission, preserving
prior review history. These outcomes do not authorize payment or settlement.

**Reason:** A controlled operational assessment supports correction and audit
without implying financial approval.

### D-193 — Limit Carrier cost proposal submission to authorized staff

**Decision:** Any staff member with explicit Carrier cost proposal submission
permission and access to the relevant Load may submit a proposal.

**Reason:** Staff with relevant operational information can initiate review
without granting submission authority solely through department membership.

### D-194 — Use a controlled Carrier accessorial catalogue

**Decision:** Carrier cost proposal types are `DETENTION`, `LAYOVER`,
`LUMPER`, `DRIVER_ASSIST`, `REDELIVERY`, `TRUCK_ORDERED_NOT_USED`,
`FUEL_SURCHARGE`, `TOLL`, `EQUIPMENT_SURCHARGE`, `HANDLING`, and `OTHER`.
`OTHER` requires an explanation.

**Reason:** A controlled catalogue supports consistent review and reporting
while retaining a reasoned path for uncommon accessorials.

### D-195 — Limit initial Carrier cost proposals to USD

**Decision:** Carrier cost proposals use USD in the initial TMS scope; the
TMS does not perform currency conversion.

**Reason:** A single initial currency aligns operational cost records with
Carrier tendering without adding exchange-rate management.

### D-196 — Require positive Carrier cost proposal amounts

**Decision:** A Carrier cost proposal amount must be greater than USD 0.00;
zero and negative amounts are invalid.

**Reason:** A cost proposal represents a positive amount for internal
operational review.

### D-197 — Store Carrier cost proposal amounts to cents

**Decision:** Store Carrier cost proposal amounts with two decimal places,
representing USD cents.

**Reason:** Cent precision is consistent with the initial USD-only currency
scope and provides a clear amount for internal review.

### D-198 — Require evidence references for Carrier cost proposals

**Decision:** A Carrier cost proposal must include a source or reference to
supporting evidence. Attach a supporting file when one exists; a file
attachment is not mandatory.

**Reason:** Requiring traceable support grounds the internal review without
requiring the TMS to duplicate every external record as an attachment.

### D-199 — Link Carrier cost proposals to the Carrier profile

**Decision:** Each Carrier cost proposal is linked to its Load and the
relevant Carrier profile. It does not require a link to a tender round.

**Reason:** Carrier identity is necessary to establish the subject of a cost
proposal, while the proposal remains independent of the tender negotiation
record.

### D-200 — Assign Customer charge proposal submission to the Load broker

**Decision:** The broker responsible for the Load may submit a Customer
charge proposal when they hold explicit Customer-charge submission
permission.

**Reason:** The Load's broker owns customer communication and can record the
operational basis for a proposed charge.

### D-201 — Assign Customer charge review to the area supervisor

**Decision:** The Load's area supervisor reviews a Customer charge proposal.
If the area supervisor submitted it, another authorized supervisor reviews;
the chief supervisor or transportation executive may provide coverage.

**Reason:** Supervisory review separates commercial communication from
operational assessment and prevents self-review.

### D-202 — Apply controlled review outcomes to Customer charge proposals

**Decision:** A Customer charge proposal review records `SUPPORTED`,
`NOT_SUPPORTED`, or `NEEDS_INFORMATION`. These outcomes do not authorize
invoicing or settlement.

**Reason:** A controlled operational assessment supports consistent review
without implying financial approval.

### D-203 — Return incomplete Customer charge proposals to the broker

**Decision:** A Customer charge proposal marked `NEEDS_INFORMATION` returns
to its broker requester for added information and resubmission. Preserve
prior review history.

**Reason:** The broker can complete the request while retaining an auditable
record of each assessment.

### D-204 — Reuse accessorial types in a separate Customer charge workflow

**Decision:** Customer charge proposals use the same type catalogue as
Carrier cost proposals, but remain separate records and workflow instances.

**Reason:** Shared type names aid consistent operational classification
without conflating Customer charges with Carrier costs.

### D-205 — Limit initial Customer charge proposals to USD

**Decision:** Customer charge proposals use USD in the initial TMS scope;
the TMS does not perform currency conversion.

**Reason:** A single initial currency avoids exchange-rate management in
operational charge proposals.

### D-206 — Require positive Customer charge amounts to the nearest cent

**Decision:** A Customer charge proposal amount must be greater than
USD 0.00 and is stored with two decimal places.

**Reason:** Positive cent-precision amounts provide an unambiguous value for
internal operational review.

### D-207 — Require evidence references for Customer charge proposals

**Decision:** A Customer charge proposal must include a source or reference
to supporting evidence. Attach a supporting file when one exists; a file
attachment is not mandatory.

**Reason:** A traceable source supports review without requiring the TMS to
duplicate every external record as an attachment.

### D-208 — Link Customer charge proposals to the Load only

**Decision:** A Customer charge proposal is linked to its Load and does not
require a separate Customer-profile link.

**Reason:** The Load already identifies the Customer, so a second Customer
relationship is unnecessary for this workflow.

### D-209 — Stop Customer charge proposals at internal review

**Decision:** The Customer charge workflow ends with its internal review
outcome. The TMS does not record Customer notification or response and does
not authorize or track invoicing or payment.

**Reason:** The proposal provides an internal operational assessment without
expanding into Customer communications or financial processing.

### D-210 — Limit initial Load customer rates to USD

**Decision:** A Load's recorded customer rate uses USD in the initial TMS
scope. The TMS does not perform currency conversion.

**Reason:** A single initial currency avoids exchange-rate management in
Load records.

### D-211 — Allow optional references for manual tender communications

**Decision:** A tender round may include an external message reference or a
supporting attachment. Do not copy external message bodies into the TMS.

**Reason:** Optional references preserve communication traceability without
duplicating external conversations or introducing message delivery.

### D-212 — Limit Customer charge submission to the handling broker

**Decision:** Only the broker responsible for handling a Load may submit a
Customer charge proposal for it, and the broker must hold the explicit
Customer-charge submission permission.

**Reason:** Restricting proposal creation to the broker accountable for the
Load preserves clear operational ownership.

### D-213 — Include Customer charge submission in the broker role

**Decision:** The standard broker role includes the Customer-charge
submission permission. Submission remains limited to the broker responsible
for handling the Load.

**Reason:** Role-based inclusion avoids ad hoc grants while retaining the
Load-level ownership boundary.

### D-214 — Grant Carrier cost submission to dispatchers and handling brokers

**Decision:** The standard Carrier cost proposal submission permission is
granted to `contract_capacity_dispatcher` and the broker responsible for
handling the Load. Submission also requires access to that Load. This
supersedes the broader eligibility in D-193.

**Reason:** These roles are positioned to identify Carrier cost adjustments,
while Load access and the existing review workflow constrain their authority.

### D-215 — Version breaking service-contract changes

**Decision:** API, command, and event contract changes within a version must
be backward-compatible and additive. Breaking changes require a new contract
version and a migration window during which affected consumers can transition.

**Reason:** Explicit evolution rules reduce cross-service deployment coupling
and prevent an owner service from unexpectedly breaking its consumers.

### D-216 — Preserve user and service identity in user-originated commands

**Decision:** A durable command initiated by a user through a service
preserves both the initiating principal and the issuing service. A
service-initiated command identifies its initiating service.

**Reason:** Keeping both identities supports business-level accountability
and technical tracing across service boundaries.

### D-217 — Authorize commands when the owning service accepts them

**Decision:** The owning service authorizes the initiating principal and
resource access when it accepts a command. Once durably accepted, asynchronous
processing may complete even if the principal's permissions later change.
Domain state and concurrency rules still apply during processing.

**Reason:** A durable accepted command should not depend on a later human
session or permission state, while domain invariants continue to protect
business records.

### D-218 — Retire prior contract versions after consumer migration

**Decision:** A breaking contract version has no fixed migration-window
duration. Retire the prior version only after all affected consumers have
migrated and the contract owner approves retirement.

**Reason:** Consumer readiness, rather than an arbitrary calendar period,
determines when a prior contract version can be safely removed.

### D-219 — Quarantine unsupported message versions

**Decision:** Consumers ignore unrecognized optional fields within a
supported message version. They reject and quarantine messages that use an
unsupported contract version.

**Reason:** Tolerating additive optional fields preserves compatibility;
quarantining unknown versions prevents unsafe best-effort processing.

### D-220 — Reconcile owner-fact revision gaps

**Decision:** Consumers apply only owner-fact revisions newer than the
highest applied revision for that resource. Ignore duplicate or stale facts.
When a revision gap is detected, reconcile the resource with its owning
service before advancing.

**Reason:** Monotonic revision handling prevents older deliveries from
overwriting newer state, while reconciliation repairs missed facts.

### D-221 — Publish specific versioned owner facts

**Decision:** Owner services publish the specific versioned business fact
that occurred, not a full resource snapshot on every event. Consumers
reconcile the current owner snapshot when needed.

**Reason:** Fact-specific messages preserve event meaning without
unnecessarily duplicating the full resource state in every delivery.

### D-222 — Reconcile revision gaps from owner snapshots

**Decision:** When a consumer detects a revision gap, it fetches the
resource's current authoritative snapshot from the owner by resource ID,
updates its projection to that snapshot's revision, and ignores later-
delivered facts at or below that revision.

**Reason:** A current owner snapshot repairs missing updates without requiring
every historical event to be replayed.

### D-223 — Hold projections stale while revision gaps cannot be reconciled

**Decision:** If the owner is unavailable during gap reconciliation, retain
the last projection, mark it stale, and retry. Do not apply later revisions
for that resource until reconciliation succeeds.

**Reason:** Holding a resource at its last known state avoids presenting an
inconsistent projection as current.

### D-224 — Version proposal resubmissions under the same proposal

**Decision:** When a proposal returns as `NEEDS_INFORMATION`, resubmission
creates a new immutable revision under the same proposal ID. Preserve prior
proposal revisions and review outcomes.

**Reason:** Immutable revisions retain a complete, auditable history while
keeping one proposal identity across its review cycle.

### D-225 — Notify the designated proposal reviewer

**Decision:** On submission of a Customer charge or Carrier cost proposal,
notify the designated internal reviewer and place the proposal in that
reviewer's work queue.

**Reason:** Direct notification makes review work actionable without
broadcasting it to supervisors who are not responsible for that proposal.

### D-226 — Notify proposal submitters of every review outcome

**Decision:** Notify the proposal submitter whenever a reviewer records
`SUPPORTED`, `NOT_SUPPORTED`, or `NEEDS_INFORMATION`.

**Reason:** Timely outcome notification informs submitters whether the
proposal was supported, declined, or requires further information.

### D-227 — Do not send automatic proposal-review reminders

**Decision:** After the initial submission notification, send no automatic
reminders while a proposal is awaiting review.

**Reason:** The reviewer queue remains the source for outstanding work; the
initial scope avoids adding reminder timing and escalation behavior.

### D-228 — Use OpenAPI 3.1 as the canonical HTTP contract

**Decision:** Specify TMS HTTP APIs canonically in OpenAPI 3.1. Keep shared
transport rules in the service-contract guide and business meaning in the
owning domain documentation.

**Reason:** A machine-readable contract makes request, response, and error
schemas precise without duplicating business policy.

### D-229 — Keep OpenAPI contracts service-owned

**Decision:** Maintain one OpenAPI document per API-owning TMS service.

**Reason:** Service-owned specifications preserve API ownership and allow
each boundary to evolve without making a workflow-wide contract document the
owner of routes from multiple services.

### D-230 — Reject unknown HTTP request properties

**Decision:** HTTP request schemas reject properties not defined by the
operation's contract version. API consumers must tolerate unrecognized
response properties.

**Reason:** Strict request validation catches misspelled or unsupported
input, while tolerant response parsing permits additive evolution.

### D-231 — Persist unknown booking fields as rejected attempts

**Decision:** An unknown property in a booking row is a booking-rule issue,
not a transport error. Reject the entire submitted batch, persist the
submission, and return the row and JSON Pointer field path with code
`UNKNOWN_FIELD`; create no Loads.

**Reason:** Durable row-level feedback preserves the booking correction and
audit flow while maintaining all-or-nothing batch acceptance.

### D-232 — Store OpenAPI documents under the documentation tree

**Decision:** Store canonical service-owned OpenAPI documents under
`docs/api/`, with one named document per API-owning service.

**Reason:** Keeping contracts in the documentation tree makes them available
before service implementation while preserving ownership boundaries.

### D-233 — Structure HTTP validation error details

**Decision:** Each HTTP `error.details` validation entry contains a stable
`code`, an RFC 6901 `fieldPath` when the issue is field-specific, and a safe
`message`. Never echo submitted field values.

**Reason:** Structured, value-safe issues support consistent client
correction without exposing submitted data in error responses.

### D-234 — Use AsyncAPI 3.0 for service message contracts

**Decision:** Specify durable cross-service commands and facts in
service-owned AsyncAPI 3.0 documents with versioned message and payload
schemas.

**Reason:** A machine-readable message contract complements OpenAPI while
preserving service ownership and explicit payload validation.

### D-235 — Encode command initiators without duplicating the source service

**Decision:** A command's `sourceService` identifies its issuing service.
User-originated commands additionally include `initiatingPrincipalId`;
service-originated commands omit that field.

**Reason:** The envelope retains both user accountability and service
provenance without duplicating the service identifier.

### D-236 — Version message schemas semantically

**Decision:** Represent `schemaVersion` as a semantic version string.
Increment `MINOR` for backward-compatible additions, `PATCH` for corrections
that do not change contract shape or meaning, and `MAJOR` for breaking
changes.

**Reason:** A uniform semantic version communicates compatibility and
distinguishes payload evolution from unrelated message delivery attempts.

### D-237 — Assign message schemas to domain owners

**Decision:** The receiving domain service owns the schema for commands it
accepts. The publishing domain service owns the schema for facts it
publishes.

**Reason:** The service responsible for validating a requested transition or
asserting an authoritative fact controls that contract's meaning.

### D-238 — Return asynchronous command outcomes as messages

**Decision:** The receiving service reports a durable command's business
acceptance or rejection in a typed, versioned outcome message correlated by
`commandId`. Technical delivery failures are not business outcomes.

**Reason:** A correlated outcome makes the owner's decision observable
without synchronous service-to-service calls or conflating transport failure
with business rejection.

### D-239 — Define command acceptance as durable queueing

**Decision:** `ACCEPTED` means the receiver durably recorded the command for
processing. Any later business completion is reported through domain facts.
`REJECTED` is a final business refusal of the command.

**Reason:** Separating durable intake from workflow completion makes
asynchronous progress explicit without repeated mutable outcome messages.

### D-240 — Use forward-only service-owned database migrations

**Decision:** Each service owns ordered, forward-only database migrations.
Use expand/contract for compatible rollout. Correct an applied migration
through a new migration rather than rolling the schema backward.

**Reason:** Forward-only evolution supports independently deployed services
and avoids relying on destructive rollback across application versions.

### D-241 — Run migrations as a lock-protected deployment job

**Decision:** Run each service's migrations in a single, lock-protected
deployment job before promoting the new service version. Application
instances do not run migrations at startup.

**Reason:** A distinct migration step avoids startup races and makes schema
changes a visible release gate.

### D-242 — Block promotion when a migration fails

**Decision:** A failed migration blocks service-version promotion. Preserve
the failure details and retain the currently running application version
when the database schema remains compatible. Repair forward with a new
migration; do not automatically roll back the database.

**Reason:** A visible release gate and forward repair avoid concealing
partial schema changes or compounding them with automatic rollback.

### D-243 — Separate schema expansion from contract cleanup

**Decision:** Run additive expansion migrations before promoting the new
application version. Run destructive contract-cleanup migrations separately
only after all old application instances have been drained.

**Reason:** The sequence preserves compatibility for old and new application
versions during rollout.

### D-244 — Bound and audit outbound notification delivery

**Decision:** Retry transient outbound email and push delivery failures for
eight total attempts, including the initial attempt, using exponential
backoff with full jitter from a one-second base and a five-minute cap. After
exhaustion, mark that channel delivery failed without removing the durable
in-app notification. Retain each delivery-attempt record for one year from
its attempt timestamp, including channel, attempt number and timestamps,
outcome, provider reference, and sanitized error code. Do not retain rendered
email or push bodies in attempt logs.

**Reason:** Bounded retries make provider failure recoverable without
allowing unbounded work, while durable inbox state and limited delivery
evidence preserve visibility without duplicating message content.

### D-245 — Retain in-app notifications through acknowledgement

**Decision:** Retain in-app notification records for one year from creation.
Do not purge an urgent acknowledgement notification before it is
acknowledged; after acknowledgement, retain it for one year.

**Reason:** A fixed retention period supports routine review, while urgent
notifications remain available until their required receipt is recorded.

### D-246 — Audit operator recovery of failed notification delivery

**Decision:** After automatic delivery retries are exhausted, the
`tms_operations_administrator` may requeue the failed channel delivery for
the existing notification, preserving its identity and recipient. Audit the
operator, reason, and result of the requeue.

**Reason:** Technical operations can recover provider delivery without
changing notification ownership or creating a duplicate inbox record.

### D-247 — Generate internal record identifiers as UUIDv7

**Decision:** Each owning service generates UUIDv7 identifiers for its
internal records. Keep these identifiers opaque in user-facing business
references and use them for cross-service references through contracts.

**Reason:** Time-ordered identifiers improve index locality while retaining
the stable, non-business identity required for distributed service
references.

### D-248 — Store operational instants in UTC

**Decision:** Store event instants and deadlines in PostgreSQL `timestamptz`
and exchange them as RFC 3339 UTC timestamps. Where a local schedule's
meaning must be preserved, store its IANA timezone identifier separately.

**Reason:** A single instant representation supports reliable ordering and
cross-service comparison while preserving the local-time rules needed for
operational schedules.

### D-249 — Author migrations as service-local SQL

**Decision:** Each service owns ordered SQL migration files and an applied-
migration ledger with checksum verification. Execute migrations only in the
lock-protected deployment migration job; do not run them at application
startup.

**Reason:** SQL-first, service-local ownership keeps database evolution
explicit and reviewable without coupling services to a shared ORM or
migration changelog.

### D-250 — Constrain lifecycle values with named checks

**Decision:** Store finite lifecycle and status values in `TEXT` columns and
enforce each allowed value set with a named PostgreSQL `CHECK` constraint.

**Reason:** Database-enforced values prevent invalid states while keeping
forward migration of evolving workflows straightforward.

### D-251 — Index declared references and operational query paths

**Decision:** Retain primary-key and unique constraints, index foreign-key
columns and documented operational query paths, and avoid speculative
indexes until workload measurement justifies them.

**Reason:** This baseline supports referential lookups and known operational
queries without imposing unmeasured write and storage costs.

### D-252 — Separate technical replay from business approval

**Decision:** A business-state replay requires an owning-domain approver
distinct from the `tms_operations_administrator` who operates the replay.
Replay the original work unchanged. Audit the request, operator, approver,
reason, and result.

**Reason:** Technical recovery must not grant technical operators authority
to change business outcomes, and distinct approval preserves accountability.

### D-253 — Park unreconciled owner-revision gaps

**Decision:** When an owner-revision gap requires a snapshot, retry transient
snapshot lookup failures for eight attempts using the shared bounded-backoff
policy. Then park an inspectable failure, keep the projection stale, and
block later revisions until reconciliation succeeds.

**Reason:** A projection must not silently skip authoritative facts or
present incomplete state as current; parked failures make recovery explicit.

### D-254 — Verify recovery with fault-injected integration tests

**Decision:** Verify cross-service recovery scenarios with automated
integration tests using disposable real PostgreSQL, RabbitMQ, and Temporal
dependencies, deterministic fault injection, and persisted-state assertions.
Verify RPO/RTO through separate backup and restore drills.

**Reason:** Real dependency behavior and durable state must be exercised to
demonstrate recovery; mocks alone cannot establish persistence or redelivery
behavior.

### D-255 — Enforce relational integrity within service databases

**Decision:** Enforce same-service relational invariants with PostgreSQL
foreign-key, `UNIQUE`, and `CHECK` constraints. Represent cross-service
relationships through versioned contracts and stable identifiers, never
cross-database foreign keys.

**Reason:** Database constraints protect each service's authoritative
records, while service boundaries remain independent and asynchronously
integrated.

### D-256 — Make OpenAPI the HTTP contract source of truth

**Decision:** Treat each service-owned OpenAPI 3.1 document as the source of
truth for its HTTP API. Validate requests against the contract at runtime,
generate types and clients where practical, and check compatibility in CI.

**Reason:** A canonical contract with runtime enforcement and compatibility
checks limits drift between documentation, client code, and service behavior.

### D-257 — Make AsyncAPI the durable message contract source of truth

**Decision:** Treat each service-owned AsyncAPI 3.0 document as the source
of truth for its durable message channels and versioned payload schemas.
Validate messages at runtime and check compatibility in CI.

**Reason:** Canonical message contracts expose incompatible producer and
consumer changes before deployment and prevent undocumented runtime shapes.

### D-258 — Preserve initiating-principal provenance across handoffs

**Decision:** Propagate the original `initiatingPrincipalId` through
causally linked commands and outcomes. `sourceService` continues to identify
the immediate publisher. Autonomous work without a user initiator omits
`initiatingPrincipalId`.

**Reason:** Preserving the initiating principal supports end-to-end
accountability without confusing user attribution with service identity.

### D-259 — Use domain-owned asynchronous rejection codes

**Decision:** An asynchronous business rejection includes a stable,
domain-owned `reasonCode`, a safe human-readable message, and optional
structured details. Publish the code catalogue with its versioned schema;
never echo secrets or raw submitted values.

**Reason:** Stable domain codes support reliable client behavior while safe
messages and structured context make refusals understandable without
exposing sensitive input.

### D-260 — Quarantine invalid messages without rewriting them

**Decision:** Quarantine permanently invalid or unsupported-version
messages unchanged with their failure reason. Alert the
`tms_operations_administrator` and owning service. Permit audited replay
only after the consumer or contract is repaired; business-state changes
still require owning-domain approval.

**Reason:** Preserving the original message supports investigation and safe
recovery without silently modifying producer data or bypassing business
authority.

### D-261 — Retain delivery metadata through workflow completion

**Decision:** Retain cross-service business-message outbox/inbox metadata
and consumer deduplication records until the related workflow is terminal
and for one year afterward. This excludes Notification provider
delivery-attempt logs, which follow D-244. Do not replay after expiry unless
the owning domain authorizes a new command.

**Reason:** Keeping deduplication evidence through the supported recovery
window prevents duplicate effects while bounding technical-record retention.

### D-262 — Keep notifications concise and authorization-aware

**Decision:** Use versioned event-specific notification templates with a
concise, safe summary, an opaque resource deep link, and the required action
or deadline. Do not duplicate sensitive business payloads. Recheck
authorization when the user opens the owning service.

**Reason:** Notifications make work actionable without becoming a second
source of business data or bypassing the owning service's access controls.

### D-263 — Deploy message consumers before breaking producers

**Decision:** For a breaking MAJOR message-schema change, deploy consumer
support before producers emit the new version. Retain old-version support
until old producers and queued messages are drained; remove it only through
a separate verified cleanup.

**Reason:** Consumer-first rollout preserves message processing across
independent deployments and avoids discarding queued work during incompatible
contract changes.

### D-264 — Use synchronous database failover for acknowledged bookings

**Decision:** Run the Load service's booking-critical PostgreSQL cluster as
a single-region HA deployment with a synchronous standby and automatic
failover, plus continuous point-in-time backups and tested restore drills.
The acknowledged-booking RPO 0 target includes the submission result,
Load/revision records, and outbox facts in the committed transaction.

**Reason:** Synchronous replication supports the no-loss booking target,
while backups and restore drills address corruption and broader recovery
scenarios.

### D-265 — Require reviewed retention schedules before production

**Decision:** Do not invent universal retention periods for business, audit,
or evidence data. Require a reviewed, data-class-specific retention schedule
before production and keep automated deletion disabled until that schedule
is approved.

**Reason:** Retention obligations vary by data class and applicable
jurisdiction; unsupported assumptions could cause premature deletion or
unjustified retention.

### D-266 — Version breaking HTTP contracts in the URL

**Decision:** Introduce a new major URL version for breaking HTTP contract
changes. Retain the old version while clients migrate, then remove it only
after a separately verified deprecation and cleanup.

**Reason:** Explicit parallel versions support independently deployed
clients and services without silently changing an existing contract.

### D-267 — Restrict deletion of authoritative parent records

**Decision:** Use `ON DELETE RESTRICT` by default for same-service
authoritative records. Permit cascading only for explicitly disposable
subordinate data; approved retention jobs handle intentional deletion.

**Reason:** Restrictive references protect business and audit history from
accidental deletion while preserving a controlled path for approved data
retention.

### D-268 — Run migrations transactionally by default

**Decision:** Run each SQL migration in a transaction by default. Isolate
non-transactional PostgreSQL operations explicitly, with recovery steps and
deployment gates.

**Reason:** Transactional migrations limit partial schema changes; explicit
handling makes unavoidable non-transactional work reviewable and recoverable.

### D-269 — Assign immutable company-wide Load references

**Decision:** Assign each committed Load a company-wide, monotonically
increasing human-readable reference with the fixed `LD-` prefix, separate
from its UUID. The Load service formats it from a PostgreSQL sequence and
stores it as part of the successful Load commit. Gaps are acceptable;
references are immutable and never reused.

**Reason:** A stable sequence is easy to communicate and search while
keeping internal identity separate from a business-facing reference.

### D-270 — Number Load revisions consecutively per Load

**Decision:** Start each Load's revision numbering at 1 and increment by
exactly one for each committed revision. In one transaction, lock the Load
head, create the next revision, and advance the head to that revision.
Enforce unique `(load_id, revision_number)` and same-Load head linkage;
failed transactions consume no revision number.

**Reason:** Consecutive per-Load numbering makes the immutable history
unambiguous while transactional head updates prevent concurrent amendments
from creating competing successors.

### D-271 — Link accepted Loads to their submission rows

**Decision:** Keep each immutable normalized booking batch input and exact
result in the `booking_submissions` JSONB snapshots. For every accepted row,
store `booking_submission_id` and its 1-based source row number on the Load,
with a foreign key to the submission and a unique constraint on
`(booking_submission_id, source_row_number)`.

**Reason:** Durable snapshots support exact response replay, while a
relational row link preserves the accepted Load's source without duplicating
the authoritative booking data.

### D-272 — Use contiguous 1-based revision row ordering

**Decision:** Store each Load revision stop and freight line with a
positive, 1-based `sequence_number`, unique within its revision and guarded
by a database `CHECK`. Require accepted snapshots to contain contiguous
sequence numbers from 1 through the row count; Load validates contiguity
before committing a revision.

**Reason:** Explicit stable ordering preserves the submitted and planned
sequence while making gaps or duplicates invalid rather than ambiguous.

### D-273 — Protect Load revision rows with database permissions

**Decision:** Grant the runtime database role `SELECT` and `INSERT` on Load
revision and revision-child tables, with column-scoped `UPDATE` on the
revision construction state only. Deny general `UPDATE` and `DELETE`.
Database triggers reject revision/child mutations except the one-way
`BUILDING` to `COMMITTED` state transition. Reserve other mutation
privileges for separate migration and approved retention roles.

**Reason:** Least-privilege grants make ordinary application writes
append-only, while database triggers provide a second barrier against
accidental history changes and permit only the controlled revision
finalization transition.

### D-274 — Finalize Load revisions before transaction commit

**Decision:** A new Load revision is `BUILDING` only inside its creation
transaction. Allow stop and freight child inserts only while their parent
revision is `BUILDING`. Finalize it through a one-way transition to
`COMMITTED` before the transaction commits; triggers reject later child
inserts and prevent reversing the final state. No other transaction can
observe a `BUILDING` revision.

**Reason:** A database-enforced construction boundary prevents later
additions from silently changing a committed immutable snapshot.

### D-275 — Record Load lifecycle transitions append-only

**Decision:** Keep the current lifecycle state on `loads` and append one
typed `load_lifecycle_transitions` row for every accepted state change in
the same transaction. Record prior and new state, timestamp, actor or source,
reason code, and correlation reference. Protect transition rows from update
and deletion.

**Reason:** A current-state field supports efficient reads, while
transactional append-only transitions preserve a complete, auditable state
history.

### D-276 — Reject command-ID reuse with changed content

**Decision:** Deduplicate commands by issuing service and `commandId`.
Persist a normalized content hash and outcome in the receiver's inbox.
Redelivery with matching content returns the stored outcome; changed content
under the same key is quarantined as an ID-reuse contract violation and
applies no business effect.

**Reason:** A stable command identity must denote one immutable request;
rejecting altered retries prevents duplicate or ambiguous business outcomes.

### D-277 — Record initial Load state in lifecycle history

**Decision:** Insert an initial `NULL` to `BOOKED` row in
`load_lifecycle_transitions` in the booking transaction. Permit a null prior
state only for this initial transition; subsequent transitions record both
the prior and new state.

**Reason:** A complete lifecycle history must explain the Load's initial
state as well as every later change.

### D-278 — Enforce same-Load revision heads with a composite foreign key

**Decision:** Give `load_revisions` a unique `(load_id, revision_id)` key
and make `(loads.id, loads.current_revision_id)` reference it as a
deferrable foreign key. Defer the circular Load/revision references until
the booking transaction commits, so a Load and its initial revision are
created atomically without a nullable head pointer.

**Reason:** The composite constraint makes cross-Load head pointers
impossible at the database boundary while supporting atomic initial
creation.

### D-279 — Route durable messages through domain-owned exchanges

**Decision:** Use a durable RabbitMQ topic exchange owned by each domain
service. Route commands to the receiving service's durable queue; publish
facts on the owning service's exchange and let consumers bind their own
queues to the required fact routes.

**Reason:** Domain ownership remains visible in the broker topology, while
receiver-owned queues provide durable command intake and independent fact
consumption.

### D-280 — Schedule consumer retries from the durable inbox

**Decision:** Persist each received message to the consumer's local inbox
and acknowledge it to RabbitMQ only after that transaction commits. A
consumer worker retries transient processing failures from the inbox using
the shared eight-attempt jittered schedule. After exhaustion, park the inbox
record with its failure reason for authorized recovery; do not use broker
redelivery as the processing retry scheduler.

**Reason:** Durable receipt separates broker availability from domain
processing and makes retry timing, attempt evidence, and exhausted work
explicitly recoverable.

### D-281 — Version RabbitMQ routes by message major version

**Decision:** Use lower-case, dot-separated domain/type/action routing keys
with the message schema's MAJOR version as a suffix, for example
`load.booking.accepted.v1`. Keep MINOR and PATCH versions in the message
envelope so compatible versions share the route.

**Reason:** Major-version routing lets consumers bind explicitly to supported
breaking contracts without multiplying routes for compatible changes.

### D-282 — Park confirmed but unroutable outbox messages

**Decision:** Publish with RabbitMQ `mandatory` routing and publisher
confirms. If no durable queue is bound, park the outbox record immediately
with a topology error and alert the publisher owner and
`tms_operations_administrator`. After bindings are repaired, requeue with an
audit record of the operator, reason, and result, preserving the original
message ID.

**Reason:** An unroutable publish indicates a deterministic topology defect,
not a transient delivery failure; immediate visibility prevents silent loss
and retry noise.

### D-283 — Do not expire durable business messages by default

**Decision:** Set no default RabbitMQ TTL on durable business commands or
facts. Encode business deadlines in the command/workflow and validate them
at the owner; keep delayed messages recoverable rather than discarding them.

**Reason:** Broker availability must not silently erase business obligations;
the owning domain, not transport retention, determines whether a delayed
command is still valid.

### D-284 — Coordinate planning with one Temporal workflow per Load

**Decision:** Start one durable Temporal planning workflow for each accepted
Load, linked to its booking submission but independently progressing,
retrying, and escalating. Use a stable workflow ID derived from the Load ID
so duplicate outbox delivery cannot start duplicate planning workflows.

**Reason:** Per-Load workflow ownership matches independent Load progression
within a batch and isolates one Load's planning failure from its siblings.

### D-285 — Resume planning workflows from owner facts and durable timers

**Decision:** Resume a per-Load Temporal workflow from consumed, versioned
owner facts delivered as workflow signals. Use durable timers for explicit
freshness and operational deadlines; do not run continuous polling loops.
Signals carry the owner resource ID and revision; the workflow ignores
duplicate or stale revisions. Mark the consumer inbox item processed only
after Temporal confirms signal acceptance.

**Reason:** Event-driven wakeups react to authoritative changes promptly,
while durable timers handle time-based decisions without repeated queries.

### D-286 — Bound Temporal activity retries

**Decision:** Retry transient Temporal activity failures for eight total
attempts, including the initial attempt, using exponential full jitter from
a one-second base capped at five minutes. On exhaustion, park the workflow
for authorized inspection and recovery without changing business state.

**Reason:** Bounded activity retries recover transient faults without
allowing indefinitely running attempts to hide a durable workflow failure.

### D-287 — Preserve Temporal workflow history compatibility

**Decision:** Require deterministic history-replay compatibility tests for
Temporal workflow code changes. Use Temporal workflow version markers for
incompatible behavior changes and retain the old worker version until
affected executions have drained.

**Reason:** Existing workflow histories must replay deterministically across
deployments; explicit version markers and worker retention protect
long-running work from incompatible code changes.

### D-288 — Coordinate each Load through its terminal outcome

**Decision:** Keep the per-Load Temporal workflow active from accepted
booking through cancellation or Execution-confirmed closeout. It coordinates
saga steps only; each domain remains authoritative for its own state and
facts.

**Reason:** A Load-scoped workflow preserves recovery context across the
full operational lifecycle without transferring business authority to
Temporal.

### D-289 — Bound long-running workflow history with Continue-As-New

**Decision:** Use Temporal Continue-As-New when a workflow reaches a
configurable history threshold, initially 10,000 history events. Carry
forward current orchestration state, last-applied owner revisions, and
active deadlines; verify continuation behavior with replay tests.

**Reason:** A Load-scoped workflow may remain open for an extended period;
bounded histories support reliable replay and worker processing.

### D-290 — Restrict RabbitMQ permissions per service identity

**Decision:** Give each service a unique TLS-authenticated RabbitMQ identity.
Grant write access only to its own fact exchange and explicitly approved
receiver exchanges for commands, and read access only to its own queues.
Runtime identities have no topology-management permissions; a separate
deployment identity provisions exchanges, queues, and bindings.

**Reason:** Per-service least privilege limits message forgery and
cross-domain access while keeping broker topology under controlled
deployment ownership.

### D-291 — Provision RabbitMQ topology through deployment

**Decision:** Keep exchange, queue, and binding declarations
version-controlled with service contracts. Apply them through a dedicated
deployment job before service rollout and verify topology in CI/release
checks. Applications do not create or modify broker topology at startup.

**Reason:** Versioned, ordered topology changes prevent runtime identities
from silently changing message routing and make compatibility checks
repeatable.

### D-292 — Publish one booking fact per accepted Load

**Decision:** After an accepted booking transaction commits, Load publishes
one `LoadBooked` fact for each created Load. The fact identifies the
immutable initial Load revision and its originating booking submission;
each Load proceeds independently. Use message type `load.booked`, routing
key `load.booked.v1`, and schema version `1.0.0`.

**Reason:** Per-Load facts preserve independent progression and recovery
while linking each Load back to the broker's accepted batch submission.

### D-293 — Order Load facts with a dedicated owner revision

**Decision:** A Load fact carries a per-Load monotonically increasing
`ownerRevision`, separate from the immutable `loadRevisionNumber`. Advance
it for each published Load fact; consumers use it for ordering,
deduplication, and gap detection.

**Reason:** Content-revision numbers do not order lifecycle-only facts.
A dedicated fact-stream revision provides one sequence across all facts
about a Load.

### D-294 — Include the immutable revision in the booking fact

**Decision:** The `LoadBooked` payload contains the complete immutable
initial Load revision snapshot needed by consumers. Consumers project it
without a synchronous Load read; later corrections are published as
separate revision facts.

**Reason:** Dispatch can begin from durable facts without adding a
synchronous cross-service dependency to the booking-to-planning workflow.

### D-295 — Correlate sibling booking facts by submission

**Decision:** Set `correlationId` on each per-Load `load.booked` fact to the
accepted `bookingSubmissionId`, shared by all Loads created from that batch.
Omit `causationId` because the root cause is an HTTP request, not a durable
message; later facts set it when caused by a specific message or command.

**Reason:** A shared submission correlation supports batch-level tracing
without inventing a message cause for an HTTP-originated operation.

### D-296 — Include explicit booking state in the booking fact

**Decision:** Include `lifecycleStatus: "BOOKED"` explicitly in the
`load.booked` payload alongside its full initial revision snapshot.

**Reason:** An explicit state makes the authoritative initial lifecycle
fact unambiguous to consumers and projections.

### D-297 — Give the booking fact a fixed payload shape

**Decision:** The `load.booked` payload has top-level `loadId`,
`loadReference`, `bookingSubmissionId`, `sourceRowNumber`,
`lifecycleStatus`, and `loadRevision` fields. `loadRevision` contains
`revisionId`, `revisionNumber`, `createdAt`, and the canonical complete
revision data.

**Reason:** A stable outer shape separates Load identity and booking
provenance from the immutable business snapshot consumers need to project.

### D-298 — Generate revision row IDs in Load

**Decision:** Load generates UUIDv7 `stopId` and `freightLineId` values when
committing each revision. Clients submit ordered rows without IDs; each
amended revision receives new row IDs.

**Reason:** Owner-assigned revision-scoped identities allow downstream
milestones and evidence to reference the exact committed rows without
accepting client-controlled identifiers.

### D-299 — Carry user attribution in the message envelope

**Decision:** Place `initiatingPrincipalId` as an optional top-level message
envelope field. Include it when the message descends from a user action and
preserve it through causal handoffs; omit it for autonomous work.

**Reason:** Envelope-level attribution is consistent across message types
and does not mix security provenance into domain payloads.

### D-300 — Issue planning requests from the Load workflow activity

**Decision:** After Load reports the exact current revision as planning
`READY`, a Temporal activity hosted by Load publishes the planning command
to Dispatch Planning. Use message type
`dispatch.load.plan`, routing key `dispatch.load.plan.v1`, and schema
version `1.0.0`. Identify `sourceService: "load"` and
`targetService: "dispatch-planning"`; set `causationId` to the `messageId`
of the current `load.planning.readiness.changed` fact that authorized it.

**Reason:** Load initiates planning as a consequence of its committed
booking while Dispatch Planning retains authority over planning decisions.

### D-301 — Treat planning-command acceptance as durable receipt

**Decision:** The response to `dispatch.load.plan` reports only durable
command acceptance or final business rejection. `ACCEPTED` means Dispatch
has recorded the command for processing, not that planning is complete;
subsequent planning progress and Assignment decisions are reported through
separate facts.

**Reason:** Durable intake and planning completion are distinct outcomes in
an asynchronous workflow and must not be conflated.

### D-302 — Reference the event-built Load projection in planning requests

**Decision:** The `dispatch.load.plan` payload contains `loadId`,
`loadRevisionId`, `loadRevisionNumber`, and `expectedLoadOwnerRevision`.
Dispatch Planning validates these references against its projection built
from the `load.booked` fact; the command does not repeat the revision
snapshot.

**Reason:** A compact command avoids duplicating the complete immutable
snapshot while ensuring planning uses the exact booked Load version.

### D-303 — Scope planning-command idempotency to one intent

**Decision:** `commandId` identifies and correlates one durable command.
`idempotencyKey` is opaque and scoped to source service, message type, and
Load; reuse both IDs/keys for redelivery or retry of that intent. A deliberate
new planning intent gets new IDs and a new key, even when it references the
same Load revision.

**Reason:** Stable retry identity prevents duplicate planning effects while
allowing a later, deliberate replan of an unchanged Load.

### D-304 — Reject planning commands for superseded Load revisions

**Decision:** If Dispatch's current Load projection is newer than the
`expectedLoadOwnerRevision`, return final `REJECTED` with
`STALE_LOAD_REVISION` and make no planning decision. Temporal issues a new
command for the latest projected revision. If Dispatch has not yet applied
the expected revision, durably accept the command but defer planning until
the exact revision is available.

**Reason:** Dispatch must never plan from stale requirements or silently
substitute a newer snapshot than the command requested.

### D-305 — Publish a typed planning-command outcome

**Decision:** Report the durable outcome of `dispatch.load.plan` in
`dispatch.load.plan.outcome`, routed on
`dispatch.load.plan.outcome.v1` with schema version `1.0.0`.

**Reason:** A command-specific outcome gives the issuing workflow a
versioned, typed receipt without conflating command intake with later
planning facts.

### D-306 — Define the planning-command outcome payload

**Decision:** The outcome payload includes `commandId`, `loadId`,
`expectedLoadOwnerRevision`, and `outcome` (`ACCEPTED` or `REJECTED`). A
rejection additionally includes stable `reasonCode`, safe `message`, and
optional structured `details`. The envelope `occurredAt` records when the
outcome was produced.

**Reason:** A compact outcome is sufficient for correlation and retry
decisions while keeping detailed business state in its owning fact stream.

### D-307 — Publish owner-authored planning readiness per revision

**Decision:** For every committed Load revision, publish
`load.planning.readiness.changed` with state `READY` or `HELD` and reason
codes for blocking missing planning information. Only `READY` authorizes
the workflow to issue `dispatch.load.plan`; `HELD` keeps it waiting for a
later revision/readiness fact.

**Reason:** Load owns stage completeness. Explicit readiness facts prevent
Dispatch from interpreting incomplete data or inferring readiness from
absence of a hold.

### D-308 — Publish amended revisions as complete facts

**Decision:** For every committed amendment, Load publishes
`load.revision.created` with the complete immutable revision snapshot,
separate from the per-revision `load.planning.readiness.changed` fact. The
initial revision remains represented by `load.booked`.

**Reason:** Consumers need the authoritative new snapshot independently of
whether the amendment changes planning readiness.

### D-309 — Explain planning holds with field-addressed issues

**Decision:** `load.planning.readiness.changed` includes `blockingIssues`.
Each issue has a stable `code`, RFC 6901 `fieldPath`, and optional safe
`message`; `READY` carries an empty array.

**Reason:** Field-addressed blockers let operators correct incomplete
planning requirements without exposing submitted values or forcing consumers
to infer Load rules.

### D-310 — Identify planning attempts

**Decision:** Dispatch assigns a UUIDv7 `planningAttemptId` to every
planning attempt and includes it in that attempt's result facts.

**Reason:** A stable attempt identity distinguishes repeated outcomes for
the same Load revision and supports correlation across planning progress and
results.

### D-311 — Keep unassigned diagnostics safe and actionable

**Decision:** An `UNASSIGNED` planning result contains stable reason codes
and safe explanatory messages. It does not disclose candidate identities or
internal scoring.

**Reason:** Operations needs actionable reasons without exposing other
resources' details or Dispatch's internal ranking data.

### D-312 — Report all applicable unassigned reasons

**Decision:** An `UNASSIGNED` planning result reports every applicable
stable reason code, each with a safe message, deduplicated within that
attempt.

**Reason:** Multiple independent constraints may prevent assignment; a
complete, deduplicated reason set avoids concealing actionable blockers.

### D-313 — Use actionable capacity constraint categories

**Decision:** The initial `load.planning.unassigned` reason catalogue
contains `NO_CAPACITY_IN_TIME_WINDOW`, `INCOMPATIBLE_EQUIPMENT`,
`NO_QUALIFIED_DRIVER_COVERAGE`, `NO_FEASIBLE_SEGMENT_COVERAGE`, and
`INSUFFICIENT_REPOSITIONING_TIME`. These codes describe constraint
categories, never individual candidates.

**Reason:** Constraint-level reasons give operations useful next actions
without revealing candidate identities or internal scoring.

### D-314 — Trigger unassigned re-planning from durable changes

**Decision:** After an `UNASSIGNED` result, start another planning attempt
only when the current Load revision becomes `READY`, an owner fact can change
resource eligibility or capacity, or an explicit durable deadline fires.
Do not use general polling.

**Reason:** Durable, causally relevant triggers avoid wasted repeated work
while ensuring changed requirements or capacity can be reconsidered.

### D-315 — Keep planning progress internal

**Decision:** Do not publish a separate planning-started or phase-progress
fact. The durable `ACCEPTED` command receipt confirms processing intake;
consumers receive terminal business outcomes, including the unassigned
result or active Assignment.

**Reason:** The additional progress facts duplicate internal workflow state
without changing business decisions or ownership.

### D-316 — Publish successful Assignment activation

**Decision:** After CC confirms the reservation and Load finalization
succeeds, Dispatch Planning publishes `dispatch.assignment.activated`,
routing key `dispatch.assignment.activated.v1`, schema version `1.0.0`.
The fact means the Assignment is operationally active.

**Reason:** The named terminal fact distinguishes an active Assignment from
a merely created or pending record and gives Execution an authoritative
handoff point.

### D-317 — Publish an immutable Assignment snapshot

**Decision:** `dispatch.assignment.activated` carries the immutable
Assignment snapshot: `assignmentId`, `planningAttemptId`, Load and Trip Plan
revision references, ordered assigned segments and resources, and the
confirmed reservation. It does not duplicate the complete Load snapshot.

**Reason:** Consumers can process the activation idempotently from one
authoritative fact while using owner revision references rather than
duplicating Load-owned data.

### D-318 — Preserve Fleet Readiness provenance in Assignments

**Decision:** The activated Assignment includes the Fleet Readiness owner
revision used to validate each assigned driver, power unit, and trailer.

**Reason:** Recording the source revision makes the eligibility decision
auditable and lets consumers distinguish the assignment-time validation
from later readiness changes.

### D-319 — Use ordered reservation segments in Assignments

**Decision:** Each Assignment uses the complete CC reservation segment
shape: one-based contiguous `sequenceNumber`, start/end stop IDs, UTC time
window, power unit, trailer, one or two drivers, and the Fleet Readiness
owner revision for each assigned resource.

**Reason:** Reusing the reserved segment set ensures the active Assignment
describes precisely the capacity CC confirmed.

### D-320 — Represent segment windows as UTC intervals

**Decision:** Each CC reservation and activated Assignment segment
represents its interval as `timeWindow: {startAt, endAt}`. Both values are
RFC 3339 UTC timestamps ending in `Z`.

**Reason:** One unambiguous UTC interval shape avoids local-time and daylight
saving interpretation differences between services.

### D-321 — Pair resource IDs with readiness revisions

**Decision:** Each segment carries `resourceReadinessRevisions[]` entries
with `resourceType`, `resourceId`, and the Fleet Readiness `ownerRevision`.
There is exactly one entry for each assigned driver, power unit, and
trailer.

**Reason:** Explicit resource/revision pairs make the validated source
version unambiguous, including for segments with multiple drivers.

### D-322 — Reference the confirmed reservation version

**Decision:** `dispatch.assignment.activated` includes the confirmed
reservation's `reservationId`, current `reservationRevision`, and explicit
`state: CONFIRMED`; it does not include a temporary expiry.

**Reason:** Consumers can identify the exact CC decision without duplicating
the reservation's complete claim record.

### D-323 — Version reservation state transitions

**Decision:** CC starts `reservationRevision` at 1 when it creates a
`HELD` reservation and increments it once for every committed state
transition. An atomic replacement creates a new reservation ID with
revision 1; the superseded reservation advances its own revision.

**Reason:** A reservation-specific revision distinguishes the exact
confirmed or terminal state, while a new identity preserves the immutable
history of replaced claims.

### D-324 — Command Dispatch Assignment activation

**Decision:** After CC confirms the reservation and Load finalization
succeeds, orchestration sends Dispatch Planning the durable
`dispatch.assignment.activate` command using routing key
`dispatch.assignment.activate.v1` and schema version `1.0.0`. Dispatch
validates and commits activation before publishing
`dispatch.assignment.activated`.

**Reason:** Explicit owner-validated command handling keeps the Assignment
lifecycle in Dispatch Planning and makes activation idempotent and
recoverable.

### D-325 — Identify Load as the Assignment activation producer

**Decision:** The `dispatch.assignment.activate` command is emitted by the
per-Load orchestration activity hosted by Load, with
`sourceService: "load"` and `targetService: "dispatch-planning"`.

**Reason:** This preserves the established orchestration and envelope
identity used by `dispatch.load.plan`.

### D-326 — Link activation to its final prerequisite

**Decision:** The `causationId` on `dispatch.assignment.activate` points to
the CC reservation-confirmation outcome, the final prerequisite before
activation. The command separately references the successful Load
finalization guard.

**Reason:** The shared envelope retains one causal parent, while the command
payload preserves the other required authorization evidence.

### D-327 — Activate from authoritative references

**Decision:** `dispatch.assignment.activate` carries `assignmentId`,
`planningAttemptId`, exact Load and Trip Plan revisions, the confirmed
reservation ID/revision, and the Load finalization-guard reference. It does
not repeat the Assignment snapshot; Dispatch validates these references
against its pending Assignment.

**Reason:** Dispatch remains authoritative for its pending record, while
the command identifies the exact prerequisites required for safe activation.

### D-328 — Return activation as a terminal business result

**Decision:** Successful activation is reported by
`dispatch.assignment.activated`. A business refusal is reported by a
separate durable rejection fact; do not publish a separate `ACCEPTED`
receipt for this transactional command.

**Reason:** The active Assignment fact is already the required durable
success handoff. An additional receipt would duplicate success without
changing workflow behavior.

### D-329 — Name Assignment activation rejections

**Decision:** Dispatch Planning reports a business refusal using
`dispatch.assignment.activation.rejected`, routing key
`dispatch.assignment.activation.rejected.v1`, schema version `1.0.0`.

**Reason:** A separately named rejection fact makes the non-activation
outcome explicit without conflating it with successful activation.

### D-330 — Reconcile rejected activation before compensation

**Decision:** Following activation rejection after CC confirmation, do not
retry the rejected command or release capacity blindly. Reconcile Dispatch,
the Load finalization guard, and CC. If activation is no longer valid,
explicitly release the confirmed reservation and replan. If the original
intent remains valid, recovery requires an audited, owner-approved new
command.

**Reason:** Reconciliation prevents both orphaned confirmed capacity and
unsafe compensation after an ambiguous cross-service outcome.

### D-331 — Report one primary activation-rejection reason

**Decision:** `dispatch.assignment.activation.rejected` contains one stable
`reasonCode` for the primary failed validation gate, a safe message, and
optional structured details. Dispatch documents the validation order used
to select that primary reason.

**Reason:** A deterministic primary reason keeps rejection responses
actionable and stable when more than one prerequisite is invalid.

### D-332 — Order Assignment activation validation

**Decision:** Dispatch checks activation in this order: pending Assignment
and planning-attempt identity; Load finalization guard and exact Load
revision; Trip Plan revision; then the confirmed CC reservation ID and
revision.

**Reason:** A fixed order makes the single primary rejection reason
deterministic and checks Dispatch-owned intent before its external gates.

### D-333 — Use cause-specific activation rejection codes

**Decision:** The activation rejection catalogue is
`ASSIGNMENT_NOT_FOUND`, `ASSIGNMENT_NOT_PENDING`,
`PLANNING_ATTEMPT_MISMATCH`, `LOAD_FINALIZATION_GUARD_INVALID`,
`LOAD_REVISION_MISMATCH`, `TRIP_PLAN_REVISION_MISMATCH`,
`RESERVATION_NOT_FOUND`, `RESERVATION_NOT_CONFIRMED`, and
`RESERVATION_REVISION_MISMATCH`. Within each gate, check existence before
state and version consistency.

**Reason:** Stable cause-specific codes tell operators which owner
precondition failed without exposing internal resource candidates.

### D-334 — Name the complete-capacity reservation command

**Decision:** Dispatch Planning requests a temporary full-plan capacity
claim with `capacity.reservation.reserve`, routing key
`capacity.reservation.reserve.v1`, schema version `1.0.0`. Acceptance creates
a five-minute `HELD` reservation.

**Reason:** The command name expresses the reservation operation while the
result state makes its temporary nature explicit.

### D-335 — Assign the planning saga to Dispatch Planning

**Decision:** After durable acceptance of `dispatch.load.plan`, a
Dispatch-Planning-hosted Temporal workflow owns capacity reservation, Load
finalization, final eligibility checks, reservation confirmation, and
Assignment activation. The Load-hosted workflow waits for terminal facts.

**Reason:** Dispatch owns the proposed plan and pending Assignment, so it
can coordinate their completion without publishing a proposal-progress
message that duplicates its internal workflow state.

### D-336 — Keep Assignment activation inside Dispatch Planning

**Decision:** In the booking-to-planning path, the Load-hosted workflow
publishes `dispatch.load.plan` and waits for terminal planning results.
After durable acceptance, a Dispatch Planning Temporal workflow owns
capacity reservation, Load finalization, final eligibility checks,
reservation confirmation, and Assignment activation. Activation is an
idempotent Dispatch-owned transaction, not a self-directed bus command.
Commit the active Assignment and `dispatch.assignment.activated` outbox
fact atomically. Preserve `dispatch.assignment.activation.rejected` as the
durable business-refusal fact; its `causationId` references the CC
reservation-confirmation outcome. This supersedes the separate
activation-command design in D-324–D-327 and the command-receipt framing in
D-328. The terminal fact names and rejection validation/recovery rules in
D-316 and D-329–D-333 remain in effect.

**Reason:** Dispatch owns the proposed plan and pending Assignment, so its
workflow can complete the saga without a proposal-progress message or a
self-directed command. The Load workflow retains its durable booking and
readiness responsibilities while awaiting the terminal result.

### D-337 — Name the CC reservation outcome

**Decision:** Capacity Commitment responds to
`capacity.reservation.reserve` with
`capacity.reservation.reserve.outcome`, routing key
`capacity.reservation.reserve.outcome.v1`, schema version `1.0.0`, and
`outcome: RESERVED` or `REJECTED`.

**Reason:** A durable, command-specific response lets the Dispatch Planning
workflow distinguish an acquired temporary hold from a business refusal.

### D-338 — Define the CC reservation outcome payload

**Decision:** Every `capacity.reservation.reserve.outcome` contains
`commandId`, `planningAttemptId`, `tripPlanId`, `tripPlanRevision`, and
`outcome`. `RESERVED` adds `reservationId`, `reservationRevision: 1`,
`state: HELD`, and `expiresAt`. `REJECTED` adds a stable `reasonCode`, safe
`message`, affected segment/resource IDs, and `replanMayResolve`.

**Reason:** Dispatch can match the response to its exact plan and make the
appropriate next decision without exposing unrelated reservation details.

### D-339 — Limit reservation rejection diagnostics to submitted resources

**Decision:** A `REJECTED` outcome includes `affectedSegments[]`. Each entry
identifies a submitted segment by `sequenceNumber` and may identify only the
submitted resource that failed validation by `resourceType` and
`resourceId`. Do not include alternative candidates or other customers'
reservation details.

**Reason:** Dispatch receives actionable references to its own request
without learning unrelated capacity or claims.

### D-340 — Scope reservation idempotency to a planning attempt

**Decision:** Scope a `capacity.reservation.reserve` idempotency key to
`sourceService`, message type, and `planningAttemptId`. Delivery retries
reuse the same `commandId` and key; a new planning attempt receives new
values.

**Reason:** A single attempt cannot create duplicate reservation claims,
while re-planning the same Load remains a distinct business intent.

### D-341 — Define reservation replan guidance

**Decision:** Set `replanMayResolve: true` for `RESOURCE_UNAVAILABLE`,
`SEGMENT_TIME_CONFLICT`, and `INCOMPATIBLE_RESOURCE`. Set it to `false` for
`STALE_READINESS_REVISION` and `TRIP_PLAN_REVISION_STALE` until Dispatch
refreshes its readiness facts or creates a current Trip Plan revision.

**Reason:** A replan signal should distinguish a fresh plan that may resolve
a resource conflict from a repeated request that still uses stale inputs.

### D-342 — Name reservation confirmation command

**Decision:** Dispatch Planning requests transition of a temporary hold to
confirmed capacity with `capacity.reservation.confirm`, routing key
`capacity.reservation.confirm.v1`, schema version `1.0.0`.

**Reason:** A separate confirmation command makes the transition from
temporary planning hold to committed capacity explicit and owner-controlled.

### D-343 — Name reservation confirmation outcome

**Decision:** Capacity Commitment responds to
`capacity.reservation.confirm` with
`capacity.reservation.confirm.outcome`, routing key
`capacity.reservation.confirm.outcome.v1`, schema version `1.0.0`, and
`outcome: CONFIRMED` or `REJECTED`.

**Reason:** A command-specific durable result lets Dispatch distinguish
committed capacity from a failed or stale confirmation request.

### D-344 — Define reservation confirmation payloads

**Decision:** The confirmation command contains `commandId`,
`idempotencyKey`, `reservationId`, expected `reservationRevision`,
`tripPlanId`, and `tripPlanRevision`. Its outcome echoes `commandId`,
reservation and Trip Plan references, `outcome`, and the current
`reservationRevision` when the reservation exists. `CONFIRMED` adds
`state: CONFIRMED`; `REJECTED` adds a stable `reasonCode` and safe `message`.

**Reason:** Versioned references make confirmation conditional on the exact
hold and Trip Plan without retransmitting reservation claims.

### D-345 — Link reservation confirmation to Load finalization

**Decision:** `capacity.reservation.confirm` sets `causationId` to the
successful Load finalization-guard outcome that authorized confirmation.
The command's reservation ID and expected revision identify the prior CC
hold without using it as the causal parent.

**Reason:** The Load guard is the final business authorization for moving a
temporary hold into committed capacity; the reservation identity remains
explicit in the command payload.

### D-346 — Scope reservation confirmation idempotency

**Decision:** Scope a `capacity.reservation.confirm` idempotency key to
`sourceService`, message type, and `reservationId`. Redelivery/retry of the
same confirmation intent reuses its `commandId` and key; a new reservation
uses a new key.

**Reason:** A reservation may transition to `CONFIRMED` only once, and
retrying its confirmation must not create another transition or outcome.

### D-347 — Define reservation confirmation rejection codes

**Decision:** The confirmation rejection catalogue is
`RESERVATION_NOT_FOUND`, `RESERVATION_NOT_HELD`,
`RESERVATION_REVISION_MISMATCH`, and `TRIP_PLAN_REVISION_MISMATCH`, in that
validation order. Within the reservation checks, verify existence, state,
then revision.

**Reason:** Cause-specific codes identify stale or invalid confirmation
references without exposing other reservation claims.

### D-348 — Separate reservation release and replacement

**Decision:** Capacity Commitment exposes separate commands:
`capacity.reservation.release` to release a complete reservation and
`capacity.reservation.replace` to atomically replace a reservation with a
complete feasible remainder. Each command uses its matching `.v1` routing
key and schema version `1.0.0`.

**Reason:** Distinct command types make full release and all-or-none claim
replacement explicit, avoiding ambiguous partial-release behavior.

### D-349 — Require exact reservation references for release operations

**Decision:** Both release and replacement commands identify
`commandId`, `idempotencyKey`, current `reservationId`,
`reservationRevision`, `tripPlanId`, and `tripPlanRevision`. Release has no
segment payload. Replacement carries the complete ordered feasible
remaining segment set using the established reservation segment shape.

**Reason:** Expected revisions prevent stale release or replacement, and a
complete replacement payload allows CC to validate and swap claims
atomically.

### D-350 — Give release operations command-specific outcomes

**Decision:** CC responds to release and replacement with
`capacity.reservation.release.outcome` and
`capacity.reservation.replace.outcome`, respectively. Each uses its matching
`.v1` routing key and schema version `1.0.0`.

**Reason:** Separate outcomes preserve command identity and let the workflow
correlate completion without interpreting a generic reservation mutation.

### D-351 — Report release and replacement state transitions

**Decision:** Successful release and replacement outcomes echo
`commandId`, `tripPlanId`, `tripPlanRevision`, and `outcome`. Release reports
the released reservation ID, incremented revision, and `state: RELEASED`.
Replacement reports the old reservation ID/revision as `SUPERSEDED` and the
new reservation ID at revision 1 as `HELD`, with `expiresAt`.

**Reason:** The command result identifies both committed state transitions
and the new hold without requiring a follow-up read to continue the saga.

### D-352 — Report reservation mutation rejections without implying effects

**Decision:** Rejected release/replacement outcomes echo `commandId` and Trip
Plan references, and include one stable `reasonCode`, a safe `message`, and
the current reservation ID, revision, and state when known. A rejection
must not imply a partial release or replacement.

**Reason:** Dispatch can reconcile against CC's authoritative current state
without mistaking a refusal for a committed capacity change.

### D-353 — Preserve reservation commitment state during replacement

**Decision:** An atomic replacement preserves the old reservation's
commitment state. Replacing `HELD` creates a new `HELD` reservation with a
five-minute expiry; replacing `CONFIRMED` creates a new `CONFIRMED`
reservation without a temporary expiry. This supersedes D-351's
unconditional `HELD` state for replacement outcomes.

**Reason:** Cancellation of one Load from a confirmed multi-Load Trip Plan
must not downgrade the remaining committed capacity to a temporary hold.

### D-354 — Scope reservation mutation idempotency

**Decision:** Scope release and replacement idempotency separately by
`sourceService`, message type, and the old `reservationId`. Retries reuse the
same `commandId` and key; a subsequent mutation uses the newly created
reservation ID.

**Reason:** Distinct command types remain independent, and reservation
identity provides a natural concurrency boundary for each complete claim set.

### D-355 — Reuse capacity codes for reservation mutations

**Decision:** Release and replacement share the guard rejection codes
`RESERVATION_NOT_FOUND`, `RESERVATION_NOT_ACTIVE`,
`RESERVATION_REVISION_MISMATCH`, and `TRIP_PLAN_REVISION_MISMATCH`.
Replacement may additionally return
`RESOURCE_UNAVAILABLE`, `STALE_READINESS_REVISION`,
`SEGMENT_TIME_CONFLICT`, or `INCOMPATIBLE_RESOURCE`.

**Reason:** Common guard codes keep mutation errors consistent; replacement
reuses established capacity feasibility reasons instead of creating a
parallel vocabulary.

### D-356 — Order reservation mutation validation

**Decision:** CC checks mutation commands in this order: reservation
existence; active state (`HELD` or `CONFIRMED`); reservation revision; Trip
Plan identity and revision; then replacement-segment feasibility when
applicable.

**Reason:** Deterministic ordering makes the primary rejection reason
stable and avoids assessing replacement capacity against a stale or
terminal reservation.

### D-357 — Link reservation mutation to its authorizing result

**Decision:** Release/replacement commands set `causationId` to the
immediate durable business result that authorizes the mutation, such as a
failed Load guard for planning release or an approved cancellation event for
Trip Plan replacement. Preserve the saga's `correlationId`.

**Reason:** The causal chain points to the event that actually made the
mutation necessary, while the correlation ties it to the larger workflow.

### D-358 — Centralize reservation mutations in Dispatch Planning

**Decision:** Dispatch Planning publishes all reservation release and
replacement commands to Capacity Commitment. A Load/cancellation workflow
sends durable cancellation intent to Dispatch Planning, which reconciles
its Trip Plan before releasing or replacing capacity.

**Reason:** Dispatch Planning owns the Trip Plan and Assignment lifecycle;
centralizing mutations there prevents Load or other workflows from changing
capacity claims without reconciling affected plans.

### D-359 — Name the Load-to-Dispatch cancellation command

**Decision:** After committing a cancellation request, Load sends
`dispatch.load.cancel` to Dispatch Planning, using routing key
`dispatch.load.cancel.v1` and schema version `1.0.0`.

**Reason:** A durable command gives Dispatch Planning an explicit request to
reconcile its owned plan and assignments while Load remains the owner of the
cancellation request and Load lifecycle.

### D-360 — Reference the committed cancellation and Load revision

**Decision:** `dispatch.load.cancel` contains `cancellationRequestId`,
`loadId`, exact `loadRevisionId` and `loadRevisionNumber`, and
`expectedLoadOwnerRevision`. Dispatch uses its Load projection; Load retains
the cancellation reason, note, and requesting-principal details.

**Reason:** The command identifies the exact durable request and Load
version without duplicating Load-owned request data or requiring a
synchronous lookup.

### D-361 — Correlate the cancellation command to its HTTP request

**Decision:** Set `dispatch.load.cancel`'s `correlationId` to
`cancellationRequestId`. Omit `causationId` because the root request
originates directly from HTTP, and propagate the authenticated actor as
`initiatingPrincipalId`.

**Reason:** The request ID gives cancellation its own workflow correlation,
while principal attribution and root-cause semantics follow the shared
envelope rules.

### D-362 — Separate cancellation receipt from release completion

**Decision:** Dispatch Planning responds to `dispatch.load.cancel` with a
durable `ACCEPTED` or `REJECTED` command outcome. After its planning and CC
release work completes, it publishes a separate terminal release fact.
Receipt acceptance does not mean that the Load is cancelled.

**Reason:** Durable command intake and downstream release completion are
distinct milestones in the asynchronous cancellation workflow.

### D-363 — Name the cancellation command outcome

**Decision:** Dispatch Planning responds with
`dispatch.load.cancel.outcome`, routing key
`dispatch.load.cancel.outcome.v1`, schema version `1.0.0`.

**Reason:** A command-specific outcome lets Load correlate durable receipt
or refusal to the committed cancellation request.

### D-364 — Define cancellation command receipt payload

**Decision:** `dispatch.load.cancel.outcome` always contains `commandId`,
`cancellationRequestId`, `loadId`, and `outcome`. `REJECTED` adds one
stable domain-owned `reasonCode` and a safe `message`.

**Reason:** Load can update the exact cancellation request without a lookup
or a duplicated Dispatch snapshot.

### D-365 — Publish Dispatch/CC cancellation release separately

**Decision:** When Dispatch Planning and CC have completed their applicable
release work for a cancellation request, Dispatch publishes
`dispatch.load.cancellation.released`, routing key
`dispatch.load.cancellation.released.v1`, schema version `1.0.0`. This fact
confirms only Dispatch/CC release; Execution's release confirmation and
Load's final `CANCELLED` transition remain separate.

**Reason:** The message records a domain-owned release milestone without
claiming that every downstream owner has completed cancellation.

### D-366 — Identify the cancelled Load and affected Trip Plan

**Decision:** `dispatch.load.cancellation.released` contains
`cancellationRequestId`, `loadId`, `disposition` (`FULL_RELEASE`,
`REMOVED_WITH_PLAN_REPLACEMENT`, or `NO_ACTIVE_DISPATCH_WORK`), and the
affected `tripPlanId` and revision when one exists. Replacement outcomes
also identify the old and new reservation IDs, revisions, and states.

**Reason:** Load can complete its Dispatch/CC cancellation checklist and
retain concise evidence of the exact plan change without receiving full
segment claims.

### D-367 — Link Dispatch cancellation completion to its final result

**Decision:** `dispatch.load.cancellation.released` uses the final CC
release/replacement outcome as `causationId` when one occurred. If no CC
command was needed, it uses the accepted `dispatch.load.cancel` command.
Always set `correlationId` to `cancellationRequestId`.

**Reason:** The fact records the terminal Dispatch/CC step when present
without inventing a missing CC cause for Loads with no active reservation.

### D-368 — Scope cancellation-command idempotency

**Decision:** Scope `dispatch.load.cancel` idempotency to
`sourceService`, message type, and `cancellationRequestId`. Redelivery/retry
reuses the same `commandId` and `idempotencyKey`; each new committed
cancellation request uses new values.

**Reason:** Each cancellation request is one durable business intent, and
retries must not create duplicate Dispatch cancellation work.

### D-369 — Defer cancellation until its Load projection is current

**Decision:** If Dispatch's Load projection has not reached the command's
`expectedLoadOwnerRevision`, durably retain the command and defer processing
until that exact revision is applied. Do not fetch Load synchronously.

**Reason:** Event-built projections preserve the service boundary while
ensuring cancellation acts on the Load state that authorized the request.

### D-370 — Reconcile a newer Load projection before cancellation

**Decision:** If Dispatch has already applied a revision newer than the
command's expected owner revision, reconcile with the current Load snapshot.
Process only if the exact `cancellationRequestId` remains pending and the
Load is still cancellable; otherwise return a stable business rejection.

**Reason:** A newer projection may contain the committed cancellation state
or may show that the request is no longer applicable; Dispatch must verify
the current owner state rather than act on stale intent.

### D-371 — Reject cancellation when execution has started

**Decision:** The initial cancellation-receipt rejection codes are
`CANCELLATION_REQUEST_NOT_PENDING` and
`CANCELLATION_NOT_ALLOWED_EXECUTION_STARTED`, checked in that order. The
second code is used only when the current Execution owner confirms actual
execution has begun.

**Reason:** The request must still be active and the Load must remain before
actual execution for automatic cancellation release to proceed.

### D-372 — Keep a raced execution-start cancellation visible

**Decision:** If the Load cancellation request was already accepted but
Execution confirms that actual execution started before release completed,
keep the request in `REQUIRES_RECONCILIATION`. Do not mark it `CANCELLED` or
discard it; route it to operational-exception/review handling.

**Reason:** The accepted request and the started execution are both durable
business facts; visible reconciliation preserves both without falsely
claiming cancellation or automatically stopping active work.

### D-373 — Command cancellation of a planned Execution

**Decision:** When a planned per-Load Execution exists and actual execution
has not started, the Load cancellation workflow sends
`execution.load.cancel-planned`, routing key
`execution.load.cancel-planned.v1`, schema version `1.0.0`. Execution
validates the not-started gate and owns removing or voiding its record.

**Reason:** Execution remains authoritative for its records and start
milestones; Load cancellation cannot delete or assume release of them.

### D-374 — Identify the exact planned Execution for cancellation

**Decision:** `execution.load.cancel-planned` contains
`cancellationRequestId`, `loadId`, `assignmentId`, `executionId`, and
`expectedExecutionOwnerRevision`. Execution validates these references
against its owner record and actual-start state.

**Reason:** Exact record and owner-revision references make the cancellation
conditional on the intended planned execution without repeating Assignment
data.

### D-375 — Return a terminal result for planned Execution cancellation

**Decision:** Execution responds to `execution.load.cancel-planned` with
`execution.load.cancel-planned.outcome`, routing key
`execution.load.cancel-planned.outcome.v1`, schema version `1.0.0`, and
`outcome: CANCELLED` or `REJECTED`. `CANCELLED` confirms that the planned
record was removed or voided.

**Reason:** The cancellation workflow needs Execution-owner confirmation
before Load can complete cancellation; a separate intake receipt adds no
business value for this transactional operation.

### D-376 — Report the voided Execution revision

**Decision:** `execution.load.cancel-planned.outcome` always contains
`commandId`, `cancellationRequestId`, `loadId`, `assignmentId`,
`executionId`, and `outcome`. `CANCELLED` adds `executionState: VOIDED` and
the resulting Execution owner revision. `REJECTED` adds one stable
`reasonCode` and a safe `message`.

**Reason:** Load receives authoritative evidence that the exact planned
record was voided, or a safe, actionable refusal tied to its request.

### D-377 — Scope Execution cancellation idempotency

**Decision:** Scope `execution.load.cancel-planned` idempotency to
`sourceService`, message type, and `cancellationRequestId`. Delivery retries
reuse the same `commandId` and `idempotencyKey`; apply the resulting
Execution owner revision once.

**Reason:** A single cancellation request must not void the planned
Execution more than once or create duplicate lifecycle history.

### D-378 — Prioritize started Execution in cancellation rejection

**Decision:** Execution validates a planned-cancellation command in order:
record existence, Assignment match, owner revision, started state, then
other non-`PLANNED` states. Return
`CANCELLATION_NOT_ALLOWED_EXECUTION_STARTED` for `IN_PROGRESS` and
`EXECUTION_NOT_PLANNED` for other states that are not `PLANNED`.

**Reason:** The specific started-state reason ensures Load routes a raced
execution start to visible reconciliation rather than treating it as a
generic state conflict.

### D-379 — Publish the completed Load cancellation fact

**Decision:** When Load commits the final `CANCELLED` transition after all
applicable release confirmations, it publishes
`load.cancellation.completed`, routing key
`load.cancellation.completed.v1`, schema version `1.0.0`. The fact
identifies the cancelled Load and its `cancellationRequestId`.

**Reason:** Consumers need an owner-published terminal Load fact rather
than inferring completion from a command receipt or polling a status API.

### D-380 — Include the final Load cancellation snapshot

**Decision:** `load.cancellation.completed` contains `loadId`,
`loadReference`, exact `loadRevisionId` and `loadRevisionNumber`,
`cancellationRequestId`, `state: CANCELLED`, and `completedAt`. The
individual downstream confirmations remain in Load's audit record.

**Reason:** Consumers receive the exact cancelled Load version and
completion time without embedding other services' records in the Load fact.

### D-381 — Link Load cancellation completion to its final confirmation

**Decision:** `load.cancellation.completed` uses the last applicable
durable release confirmation from Dispatch/CC or Execution as
`causationId`. Omit `causationId` only when no downstream work existed and
Load completed directly from the root HTTP request. Set `correlationId` to
`cancellationRequestId` and preserve `initiatingPrincipalId`.

**Reason:** The fact's causal parent is the final release that enabled the
Load transition, while its correlation remains the cancellation request.

### D-382 — Reconcile snapshots through RabbitMQ request/reply

**Decision:** When an owner snapshot is required to repair a message
revision gap, consumers request it from the owner through RabbitMQ
request/reply. Do not query another service's database or make a synchronous
service-to-service HTTP call for this recovery.

**Reason:** The authoritative owner remains the sole source of the current
record while reconciliation uses the established asynchronous service
boundary.

### D-383 — Use typed owner snapshot messages

**Decision:** Define snapshot request/reply messages per owning service and
resource type, using that owner's versioned domain schema (for example,
`load.snapshot.get` and `load.snapshot.result`), rather than a polymorphic
generic snapshot payload.

**Reason:** Owner-specific schemas keep reconciliation responses
type-safe and avoid an unbounded generic resource contract.

### D-384 — Identify the revision gap in snapshot requests

**Decision:** A typed snapshot request contains the resource ID,
`lastAppliedOwnerRevision`, and incoming `observedOwnerRevision`. The owner
replies with the resource ID, current `ownerRevision`, and the complete
current owner snapshot.

**Reason:** The owner can return an authoritative repair point, and the
consumer can audit which gap triggered reconciliation.

### D-385 — Keep missing snapshot resources visibly unreconciled

**Decision:** If the requested resource does not exist, the owner returns
an explicit `NOT_FOUND` result with the resource ID and a stable owner
reason. The consumer keeps its projection stale, parks reconciliation
visibly, and does not apply later facts for that resource until repaired.

**Reason:** A missing owner record is an integrity/reconciliation failure,
not an empty snapshot or permission to advance past the gap.

### D-386 — Name typed snapshot request/reply pairs

**Decision:** Name owner/resource-specific snapshot messages with paired
`*.snapshot.get` request and `*.snapshot.result` reply message types and
matching `.v1` routes, for example `load.snapshot.get.v1` and
`load.snapshot.result.v1`.

**Reason:** Matching request/result names make the recovery protocol
discoverable while preserving owner-specific typed payloads.

### D-387 — Reject snapshots older than the observed fact

**Decision:** If a snapshot reply's `ownerRevision` is lower than the
incoming fact's `observedOwnerRevision`, treat it as an owner consistency
failure. Keep the projection stale, retry reconciliation with bounded
backoff, and do not advance or apply later facts until the owner returns a
snapshot at least as new as the observed fact. Park visibly after retries
are exhausted.

**Reason:** A stale snapshot cannot repair a known gap and must not permit
the consumer to skip or misorder committed owner facts.

### D-388 — Persist reconciliation evidence

**Decision:** Persist a reconciliation record with consumer/resource IDs,
last-applied and observed revisions, request/message IDs, attempt count,
timestamps, returned snapshot revision or `NOT_FOUND`, and final
`REPAIRED` or `PARKED` status. Retain the repaired projection rather than a
duplicate full snapshot.

**Reason:** Durable evidence supports recovery audit and operations without
duplicating authoritative domain data.

### D-389 — Correlate each snapshot-reconciliation exchange

**Decision:** Assign a UUIDv7 `reconciliationId` to each
consumer/resource-gap reconciliation and use it as `correlationId`. The
reply references the request `messageId` as `causationId`; delivery retries
reuse the same request identity.

**Reason:** Reconciliation has its own durable lifecycle and must remain
correlatable independently of the business workflow that exposed the gap.

### D-390 — Use positive integer owner revisions

**Decision:** Serialize `ownerRevision` and `reservationRevision` as
positive JSON integers beginning at 1 and store them as PostgreSQL `BIGINT`.
Reject zero, negative, and fractional values.

**Reason:** Numeric monotonic revisions support explicit ordering and
efficient indexed projection/reconciliation checks.

### D-391 — Bound JSON revision integers to safe precision

**Decision:** Limit serialized owner and reservation revisions to positive
safe integers no greater than `Number.MAX_SAFE_INTEGER`
(`9,007,199,254,740,991`); store only that bounded range in PostgreSQL.

**Reason:** JavaScript services can compare and serialize the agreed numeric
revision representation without precision loss.

### D-392 — Use the same numeric format for business revisions

**Decision:** Serialize immutable business revision numbers, including
`loadRevisionNumber` and `tripPlanRevision`, as positive safe JSON integers
starting at 1, stored within the bounded PostgreSQL `BIGINT` range.

**Reason:** A common numeric format simplifies validation and comparisons
across resource revisions and owner fact streams.

### D-393 — Fix the Assignment segment wire shape

**Decision:** Each immutable Assignment segment contains positive contiguous
one-based `sequenceNumber`, UUIDv7 `startStopId` and `endStopId`,
`timeWindow: {startAt, endAt}` as RFC 3339 UTC strings ending in `Z`,
UUIDv7 `powerUnitId`, UUIDv7 `trailerId`, one or two distinct UUIDv7
`driverIds`, and one `resourceReadinessRevisions` entry per assigned
resource. Each resource-revision entry contains `resourceType`
(`POWER_UNIT`, `TRAILER`, or `DRIVER`), UUIDv7 `resourceId`, and positive
safe-integer `ownerRevision`.

**Reason:** Exact typed segment fields ensure the Assignment describes the
same ordered capacity claims CC confirmed and preserves readiness provenance.

### D-394 — Run independent cancellation releases in parallel

**Decision:** After Load commits `CANCELLATION_PENDING`, it requests
Dispatch Planning/CC release and planned Execution voiding in parallel when
both work records exist. Load commits `CANCELLED` only after every applicable
owner confirmation is durably recorded.

**Reason:** Dispatch/CC and Execution release are independent owner actions;
parallel requests reduce delay without weakening the all-confirmations
completion gate.

### D-395 — Reconcile cancellation-request state separately

**Decision:** When Dispatch Planning reconciles a newer Load projection
before processing `dispatch.load.cancel`, it also requests the exact
cancellation-request resource from Load using
`load.cancellation-request.snapshot.get` and
`load.cancellation-request.snapshot.result`, with matching `.v1` routes and
schema version `1.0.0`. The request identifies `cancellationRequestId`; the
reply identifies that request, its `loadId`, current request-resource
`ownerRevision`, and state, or returns explicit `NOT_FOUND`. Do not return
the cancellation reason, note, or requesting-principal details in this
snapshot response. Dispatch proceeds only when the request belongs to the
command's Load, remains `PENDING_RELEASE`, and the current Load remains
cancellable. If the request exists but is no longer pending or belongs to a
different Load, Dispatch returns the applicable stable business rejection.
An explicit `NOT_FOUND` is an integrity/reconciliation mismatch, not a
business rejection; keep the projection stale and park reconciliation under
D-385.

**Reason:** Load lifecycle and cancellation-request state are separate
resources; reconciling one must not be treated as proof of the other's
current state, and Dispatch needs only the minimum request data required to
validate its durable command.

### D-396 — Park exhausted cancellation work for audited recovery

**Decision:** When an applicable cancellation release or voiding step
exhausts the shared automated retry budget, Load keeps the Load in
`CANCELLATION_PENDING`, moves the request to `REQUIRES_RECONCILIATION`, and
retains the latest stable failure code and time. The request is not terminal,
and no automated completion occurs while it is parked. After the underlying
issue is repaired and current owner state permits cancellation, an authorized
operator may resume the same workflow through an audited action; the request
returns to `PENDING_RELEASE`, retaining its original identity and history.
Actual execution having started remains subject to D-372's operational
review and is not automatically resumed as a cancellation.

**Reason:** A parked workflow must be visible and recoverable without
misrepresenting failure as completion or creating a second cancellation
intent.

### D-397 — Release the full reservation when cancellation replacement is infeasible

**Decision:** When CC definitively rejects a cancellation-driven atomic
replacement because the revalidated remaining Trip Plan is infeasible, the
old reservation remains unchanged under the no-partial-effect rule. Dispatch
Planning then issues a full release for that old reservation, caused by the
durable replacement rejection. After CC confirms the release, Dispatch
reports cancellation release completion; the remaining Loads have no active
reservation and re-enter event-driven planning. A stale revision or other
guard rejection is not an infeasibility result and must be reconciled before
choosing this fallback. `STALE_READINESS_REVISION` also requires readiness
refresh and replacement re-evaluation; this fallback applies only to a
definitive `RESOURCE_UNAVAILABLE`, `SEGMENT_TIME_CONFLICT`, or
`INCOMPATIBLE_RESOURCE` rejection after the required current-state checks.

**Reason:** Full release prevents the cancelled Load from remaining in an
active claim set while preserving CC's atomic replacement guarantee; the
remaining Loads can be replanned through existing durable triggers without
relying on a rejected partial reservation.

### D-398 — Define freshness per owner fact

**Decision:** Each owning service defines freshness and validity by fact
type; there is no universal time-to-live for all planning inputs. Include
observation and validity/expiry metadata where applicable. A missing or
expired hard-gate fact is unknown and ineligible, not approval. Existing
fact-specific thresholds remain in force, including the 15-minute
planning-current window for driver and equipment availability.

**Reason:** Different operational facts have different sources and validity
periods; owner-defined rules avoid both unsafe reuse of expired data and
unnecessary expiry of durable facts.

### D-399 — Preserve accepted owner work during Temporal outages

**Decision:** If Temporal becomes unavailable after a saga starts, owning
services may complete commands they have durably accepted, applying their
normal idempotency rules and publishing outcomes through their outboxes.
Pause further orchestration decisions while Temporal is unavailable; when it
recovers, resume from durable workflow state and recorded owner outcomes.
Do not discard accepted work, repeat its business effect, or compensate
solely because Temporal was unavailable.

**Reason:** Workflow-engine availability must not invalidate domain work
that an owning service has already accepted durably.

### D-400 — Fail closed when current Customer status is unavailable

**Decision:** Load may validate booking against a current, valid Customer
status fact. If that fact is missing or expired and Load cannot establish
current status because Counterparty Registry is unavailable, do not commit a
submission or any Loads. Return a retryable `503 Service Unavailable`; the
client may retry the unchanged request with the same idempotency key after
recovery. A known inactive Customer remains a normal durable business
rejection, not a service-unavailability error.

**Reason:** Booking requires an active Customer, and stale or unavailable
owner data cannot safely authorize a new commercial commitment.

### D-401 — Name the unavailable Customer-status error

**Decision:** The retryable `503 Service Unavailable` defined in D-400 uses
`error.code: CUSTOMER_STATUS_UNAVAILABLE` in the shared HTTP error envelope.

**Reason:** A stable, domain-specific code lets clients distinguish a
temporarily unverifiable Customer from a known inactive Customer without
depending on internal service details.

### D-402 — Keep Customer status current until superseded

**Decision:** A Customer lifecycle-status fact used for booking has no
wall-clock TTL; the latest applied owner revision remains valid until
superseded by a newer revision. Monitor projection lag. Once Load detects a
revision gap, keep the Customer projection stale and reconcile it with
Counterparty Registry before booking against that status. If the projection
is missing or known stale and the owner cannot be reached, apply D-400 and
return `503` without committing a submission.

**Reason:** Customer lifecycle status changes through explicit owner
transitions, while revision-gap handling prevents booking against a known
incomplete projection without imposing periodic owner lookups.

### D-403 — Apply projection-freshness targets to hard-gate consumers

**Decision:** Event-fed projections, including Operations View and service
projections used for hard-gate decisions, target owner-fact application lag
at p95 of no more than five seconds. Mark a projection stale when a required
owner update remains unapplied for 30 seconds. Do not use stale projections
to authorize a booking, planning, or other hard-gate decision; block the
decision until the required update or reconciliation is applied. These are
projection-lag targets, not time-to-live values for owner facts.

**Reason:** A shared, measurable lag objective makes stale operational state
visible and prevents a projection known to be behind from authorizing work.

### D-404 — Set an internal critical-service availability objective

**Decision:** The initial operational release targets 99.5% monthly
availability for critical TMS APIs and workflows. This is an internal
engineering objective, not a customer-facing service-level agreement.

**Reason:** A measurable initial target informs reliability work without
making an external commitment before operating evidence and service-specific
measurement boundaries are established.

### D-405 — Defer availability maintenance exclusions

**Decision:** Defer whether planned maintenance is excluded from the 99.5%
monthly availability calculation until the SLO measurement specification is
defined. Do not imply an exclusion in the meantime.

**Reason:** The target is an internal reliability objective; its measurement
boundaries should be explicit before maintenance treatment is assumed.

### D-406 — Omit absent optional Load revision fields

**Decision:** In the canonical immutable `loadRevision` snapshot, omit
optional fields when they have no value. Use `null` only where the field's
contract explicitly defines a meaningful nullable value. Apply this rule
consistently to `load.booked`, `load.revision.created`, and owner snapshot
responses carrying a Load revision.

**Reason:** Distinguishing absence from an explicitly represented null keeps
the immutable snapshot unambiguous and avoids serializing unused fields as
empty data.

### D-407 — Normalize appointment timestamps to UTC

**Decision:** Booking input supplies RFC 3339 `startAt` and `endAt` values
with explicit UTC offsets and a valid IANA `timeZone`. Load verifies that
each supplied offset matches the named zone at that instant. The canonical
immutable Load revision stores both instants normalized to UTC strings
ending in `Z` and retains the supplied IANA zone. A mismatch is a durable
booking-rule rejection with `STOP_TIME_ZONE_OFFSET_MISMATCH` at the affected
`startAt` or `endAt` field; it creates no Loads.

**Reason:** UTC instants give services an unambiguous ordering basis while
the IANA zone preserves the local operational context and daylight-saving
rules.

### D-408 — Snapshot the Customer legal name on each Load revision

**Decision:** `customerNameSnapshot` stores the Customer's legal name as
resolved by Counterparty Registry when Load creates the immutable revision.
Do not substitute the optional display name or include it in this snapshot
field. A later Customer name change does not rewrite an existing Load
revision.

**Reason:** The legal name gives the commercial record a stable
counterparty identity while preserving the exact value in force when that
revision was created.

### D-409 — Represent reefer temperature as a typed range

**Decision:** Represent reefer requirements as
`temperatureRange: {minimum, maximum, unit}` in the Load request and
canonical revision. `minimum` and `maximum` are decimal strings with at most
two fractional digits, persistable as signed `NUMERIC(5,2)` values; `unit` is
one shared `F` or `C`. Require the range before planning a reefer Load, and
require `minimum <= maximum`. Omit `temperatureRange` when absent; do not
use `null` as a missing-value marker.

**Reason:** A single typed range keeps endpoints and their unit together,
prevents mismatched units, and supports exact decimal parsing without
floating-point loss.

### D-410 — Hold invalid reefer ranges without rejecting the booking

**Decision:** A malformed or internally invalid optional
`temperatureRange` does not reject an otherwise valid booking. Do not store
the invalid range as an authoritative Load fact. Accept the Load, omit the
invalid `temperatureRange` from its canonical revision, and return the
planning-blocking follow-up code `REEFER_TEMPERATURE_RANGE_INVALID` at
`/temperatureRange`. Planning remains held until the broker supplies a valid
range; the existing `REEFER_TEMPERATURE_REQUIRED` applies when no valid range
is present for a reefer Load.

**Reason:** The temperature range is a planning-stage requirement, so
invalid optional secondary data should create visible corrective work
without undoing a valid commercial booking.

### D-411 — Store flatbed dimensions per freight line

**Decision:** Represent flatbed freight dimensions on each freight line as
an optional `dimensions: {length, width, height, unit}` object. All three
measurements are positive decimal strings with at most two fractional
digits, persistable as `NUMERIC(10,2)`, and share one `IN` or `CM` unit.
Require complete dimensions for every freight line before planning a
flatbed Load; omit the object when absent.

**Reason:** Dimensions describe individual freight lines, and grouping each
line's measurements with their common unit prevents partial or mixed-unit
interpretation.

### D-412 — Hold invalid flatbed dimensions without rejecting the booking

**Decision:** If supplied flatbed dimensions are partial, malformed,
non-positive, out of range, or use an unsupported unit, do not treat them as
an authoritative Load fact and do not reject an otherwise valid booking.
Omit the invalid dimensions from the canonical revision and return the
planning-blocking follow-up `FLATBED_DIMENSIONS_INVALID` at the affected
`/freightLines/{index}/dimensions` path. Planning remains held until every
freight line has complete valid dimensions.

**Reason:** Dimensions are required for the later planning stage, not for
booking acceptance; the broker can correct them without losing a valid
commercial commitment.

### D-413 — Require an explicit boolean tarp decision for flatbed

**Decision:** Represent the flatbed tarp requirement as optional boolean
`tarpRequired` in the booking request and canonical revision. A valid
`true` or `false` is required before flatbed planning; absence does not mean
`false` and returns the existing `FLATBED_TARP_REQUIREMENT_REQUIRED`
planning-blocking follow-up. If a value is supplied with a non-boolean type,
omit it from the canonical revision and return
`FLATBED_TARP_REQUIREMENT_INVALID` as a planning-blocking follow-up rather
than rejecting an otherwise valid booking.

**Reason:** An explicit affirmative or negative value prevents an omitted
tarp decision from being interpreted as approval to plan.

### D-414 — Use a dedicated planning-readiness blocker catalogue

**Decision:** The `load.planning.readiness.changed` fact uses readiness-
specific blocker codes, distinct from booking `followUpItem` codes. Its
initial catalogue prefixes every code with `READINESS_`: `READINESS_EQUIPMENT_PROFILE_MISSING`,
`READINESS_EQUIPMENT_PROFILE_UNSUPPORTED`,
`READINESS_GROSS_WEIGHT_MISSING`,
`READINESS_REEFER_TEMPERATURE_RANGE_MISSING`,
`READINESS_REEFER_TEMPERATURE_RANGE_INVALID`,
`READINESS_FLATBED_DIMENSIONS_MISSING`,
`READINESS_FLATBED_DIMENSIONS_INVALID`,
`READINESS_FLATBED_TARP_REQUIREMENT_MISSING`,
`READINESS_FLATBED_TARP_REQUIREMENT_INVALID`, and
`READINESS_SPECIAL_HANDLING_UNSUPPORTED`. Every blocker includes the exact
RFC 6901 field path defined in the service contract. An invalid optional
planning fact is omitted from the Load revision and produces its
corresponding readiness blocker; it is not a booking rejection. `READY` has
no blockers.

**Reason:** A dedicated catalogue lets booking follow-up presentation and
planning readiness evolve independently while retaining precise field-level
repair guidance.

### D-415 — Represent gross weight as a value-and-unit object

**Decision:** Represent Load total gross weight in the request and canonical
revision as `totalGrossWeight: {value, unit}`. `value` is a positive decimal
string with at most three fractional digits, persistable as `NUMERIC(12,3)`;
`unit` is `LB` or `KG`. The object is optional at booking and required
before planning. Omit it when absent.

**Reason:** Keeping the measurement and unit together prevents ambiguous or
unitless gross-weight values while preserving exact decimal input.

### D-416 — Reject malformed supplied gross weight at booking

**Decision:** If `totalGrossWeight` is supplied at booking but its value is
malformed, non-positive, exceeds three fractional digits, exceeds the
`NUMERIC(12,3)` range, or its unit is not `LB` or `KG`, reject the entire
booking submission with the durable field-specific issue code
`TOTAL_GROSS_WEIGHT_INVALID`. Create no Loads. This validation applies
although a valid gross-weight object is optional until planning.

**Reason:** A supplied measurement is a booking assertion; malformed or
unit-invalid assertions must not be silently dropped or converted into
planning follow-up work.

### D-417 — Define reefer operating mode

**Decision:** Use `reeferMode` with allowed values `CONTINUOUS` and
`START_STOP` for reefer Loads. If omitted, persist `CONTINUOUS` in the
canonical Load revision and return the non-blocking informational follow-up
`REEFER_MODE_DEFAULTED` at `/reeferMode`, inviting the broker to confirm or
correct the default. The defaulted mode does not block planning.

**Reason:** Recording the mode explicitly gives planning and operations a
stable requirement while preserving booking progress when the broker omits
it.

### D-418 — Validate applicability of reefer-only fields

**Decision:** If `equipmentProfile` explicitly identifies a non-`REEFER`
profile, supplying `temperatureRange` or `reeferMode` rejects that booking
row with the durable issue code `REEFER_REQUIREMENT_NOT_APPLICABLE` at the
specific reefer-only field path. If `equipmentProfile` is omitted, accept and
retain structurally valid reefer-only fields and defer applicability
validation until the profile is selected. A later amendment may not commit a
non-`REEFER` profile while retaining these reefer-only fields.

**Reason:** An omitted profile is an unresolved planning-stage fact, not
evidence that valid reefer requirements are inapplicable; an explicit
conflicting profile is a booking inconsistency that must not be accepted.

### D-419 — Defer reefer-mode default until profile selection

**Decision:** Apply the `CONTINUOUS` default and emit
`REEFER_MODE_DEFAULTED` only when `equipmentProfile` is `REEFER` and
`reeferMode` is omitted. If the equipment profile is absent, do not insert a
reefer-mode default or emit that follow-up; evaluate it when the profile is
later selected. An explicitly supplied `reeferMode` remains subject to
D-418's applicability rule.

**Reason:** Applying a reefer-specific default while equipment type is
unknown would add an inapplicable requirement to a potentially non-reefer
Load.

### D-420 — Recover from an invalid supplied reefer mode

**Decision:** For a Load explicitly profiled as `REEFER`, if a supplied
`reeferMode` is not `CONTINUOUS` or `START_STOP`, accept an otherwise valid
booking, omit the invalid mode, and persist `CONTINUOUS` in the canonical
revision. Return the non-blocking informational follow-up
`REEFER_MODE_INVALID` at `/reeferMode`; do not also emit
`REEFER_MODE_DEFAULTED`. The broker may confirm or correct the default.

**Reason:** Operating mode is not a booking-critical requirement, and a
safe documented default allows planning to proceed while preserving an
actionable correction notice.

### D-421 — Defer invalid reefer-mode correction with unknown profile

**Decision:** If `equipmentProfile` is absent and a supplied `reeferMode` is
invalid, omit the invalid value but do not default it or emit a mode
follow-up yet. Evaluate the missing mode when the equipment profile is later
selected: apply D-417 when it is `REEFER`; no reefer-mode follow-up is needed
for a non-reefer profile.

**Reason:** While the profile is unknown, Load cannot determine whether the
reefer-specific field is applicable; deferring both default and correction
work avoids creating an unnecessary task for a later non-reefer Load.

### D-422 — Normalize the optional Customer reference

**Decision:** `customerReference` is optional. Trim surrounding whitespace,
preserve internal spacing and case, and limit the normalized value to 100
Unicode code points. If trimming leaves an empty value, treat it as absent
and omit it from the canonical Load revision. A non-empty value over the
limit rejects the booking row with `CUSTOMER_REFERENCE_TOO_LONG`. Do not
enforce uniqueness; duplicate detection remains advisory.

**Reason:** Normalized bounded input is searchable and safe to store without
changing the broker's meaningful reference text or preventing legitimate
reuse.

### D-423 — Bound optional stop contact and access text

**Decision:** Optional `facilityName` and `contactName` values are trimmed
and limited to 120 Unicode code points each; `contactPhone` is trimmed and
limited to 32 code points while preserving its submitted formatting; and
`accessInstructions` is trimmed and limited to 1,000 code points. A value
that becomes empty after trimming is treated as absent and omitted from the
canonical stop snapshot.

**Reason:** Bounded optional stop text protects storage and interface
usability without altering meaningful internal spacing or phone formatting.

### D-424 — Reject overlength optional stop values

**Decision:** If a supplied `facilityName`, `contactName`, `contactPhone`,
or `accessInstructions` exceeds its D-423 limit after trimming, reject the
booking row with `STOP_OPTIONAL_FIELD_TOO_LONG` at that field's RFC 6901
path. This is a booking-rule issue and rejects the full batch; do not
silently omit the value or convert it into a follow-up task.

**Reason:** Explicitly supplied stop details are part of the booking request;
accepting them only after silent truncation or omission would misrepresent
the broker's submission.

### D-425 — Validate stop phone syntax without reformatting

**Decision:** After trimming, accept `contactPhone` only when it contains
7–15 main digits, an optional leading `+`, and only digits separated by
spaces, parentheses, hyphens, or periods. An optional extension may follow
using `x`, `ext`, `ext.`, or `#` and contain 1–6 digits. Preserve the
trimmed submitted formatting rather than normalizing the value.

**Reason:** A permissive syntax check catches obvious non-phone text while
supporting common human-readable formats without changing the contact's
preferred display.

### D-426 — Follow up on invalid optional stop phone values

**Decision:** If an optional `contactPhone` is within its length limit but
fails D-425's syntax validation, accept the otherwise valid booking, omit
the invalid phone from the canonical stop snapshot, and return the
non-blocking follow-up `STOP_CONTACT_PHONE_INVALID` at the exact stop phone
field path. Overlength values remain subject to D-424 and reject the booking
row.

**Reason:** A malformed optional phone does not invalidate the commercial
Load, but the broker should be prompted to correct contact details before
they are relied on operationally.

### D-427 — Bound and normalize freight-line descriptions

**Decision:** Trim surrounding whitespace from each freight-line
`description`, preserve internal spacing, and require a non-empty normalized
value of at most 500 Unicode code points. Reject an empty value with
`FREIGHT_DESCRIPTION_REQUIRED` and an overlength value with
`FREIGHT_DESCRIPTION_TOO_LONG`, each at the affected field path. These
booking-rule issues reject the full submission; store the trimmed
description in the canonical Load revision.

**Reason:** Bounded, normalized descriptions keep freight records usable
across storage and operational interfaces while preserving the wording
provided by the broker.

### D-428 — Bound freight-line quantity precision and range

**Decision:** Represent each freight-line `quantity` in the request as a
positive decimal string with at most three fractional digits and persist it
as `NUMERIC(12,3)`, with a maximum of `999999999.999`. A malformed,
non-positive, over-precision, or out-of-range quantity rejects the full
booking submission with `FREIGHT_QUANTITY_INVALID` at the affected field
path.

**Reason:** An explicit decimal precision and range ensure values can be
validated before persistence without rounding or overflow.

### D-429 — Bound the `OTHER` handling-unit description

**Decision:** When `handlingUnitCode` is `OTHER`, require
`handlingUnitDescription`. Trim its surrounding whitespace, preserve internal
spacing, and require 1–120 Unicode code points after trimming. Reject a
missing or empty normalized value with
`OTHER_HANDLING_UNIT_DESCRIPTION_REQUIRED`; reject a longer value with
`OTHER_HANDLING_UNIT_DESCRIPTION_TOO_LONG`. Include the row and field path,
and reject the full booking submission for either issue. Store the trimmed
description in the canonical Load revision.

**Reason:** A bounded explanation makes the custom handling unit
operationally meaningful while avoiding unbounded free-text values.

### D-430 — Reject inapplicable handling-unit descriptions

**Decision:** If `handlingUnitDescription` is supplied when
`handlingUnitCode` is not `OTHER`, reject the full booking submission with
`HANDLING_UNIT_DESCRIPTION_NOT_APPLICABLE` at the description field path.
Do not silently omit the supplied value.

**Reason:** Rejecting an explicitly supplied but inapplicable field makes
the request contract unambiguous and gives the broker a clear correction.

### D-431 — Bound stop street-address lines

**Decision:** Trim surrounding whitespace from stop `addressLine1` and
`addressLine2`, preserving internal spacing. Require a non-empty
`addressLine1` of at most 200 Unicode code points; treat an empty
`addressLine2` as absent and omit it, and limit a non-empty `addressLine2`
to 200 Unicode code points. Reject a missing or empty `addressLine1` with
`STOP_ADDRESS_FIELD_REQUIRED`; reject either overlength line with
`STOP_ADDRESS_FIELD_TOO_LONG`. Include the row and exact field path, and
reject the full booking submission.

**Reason:** Explicit, bounded street-address lines protect the booking
record from unusable or unbounded input without altering meaningful
internal spacing.

### D-432 — Validate US postal-code format

**Decision:** Treat each stop `postalCode` as a string. Trim surrounding
whitespace, accept either five digits (`12345`) or ZIP+4 in hyphenated form
(`12345-6789`), and preserve the accepted trimmed format. Reject any other
value with `STOP_POSTAL_CODE_INVALID` at the exact field path; this
booking-rule issue rejects the full submission.

**Reason:** Supporting both standard US ZIP and ZIP+4 formats covers normal
domestic address use while retaining leading zeroes and the broker's valid
format.

### D-433 — Limit initial state codes to states and DC

**Decision:** For the initial US-only address scope, accept `stateCode` only
as the uppercase two-letter USPS abbreviation for one of the 50 US states or
the District of Columbia. Do not accept territories or other USPS region
codes. Reject an unsupported or invalid value with
`STOP_STATE_CODE_INVALID` at the exact field path; this booking-rule issue
rejects the full submission.

**Reason:** The initial operating scope is limited to the states and DC;
territories may require distinct transport and operating policies.

### D-434 — Bound stop city names

**Decision:** Trim surrounding whitespace from each stop `city`, preserve
internal spacing and capitalization, and require 1–120 Unicode code points
after trimming. Reject a missing or empty city with
`STOP_ADDRESS_FIELD_REQUIRED`; reject an overlength city with
`STOP_CITY_TOO_LONG`. Include the row and exact field path, and reject the
full booking submission.

**Reason:** A bounded city value supports reliable address storage and
display without changing its meaningful spelling or capitalization.

### D-435 — Normalize state-code casing

**Decision:** Superseding D-433's uppercase-input requirement, trim
surrounding whitespace from `stateCode` and accept valid two-letter USPS
abbreviations for the 50 states and DC regardless of input casing. Normalize
accepted values to uppercase in the canonical Load revision. Values that do
not identify an in-scope state or DC reject the full booking submission with
`STOP_STATE_CODE_INVALID` at the exact field path.

**Reason:** Case normalization accepts routine broker input variation while
keeping the stored address representation consistent.

### D-436 — Default an omitted stop country code to US

**Decision:** `countryCode` is optional in a stop address request. If omitted,
default it to `US` in the canonical Load revision. If supplied, it must
identify the United States; reject another country with
`STOP_COUNTRY_UNSUPPORTED` at the exact field path. Non-US stops remain
outside the initial scope.

**Reason:** Defaulting the country keeps the initial domestic booking
workflow concise without weakening the US-only address boundary.

### D-437 — Normalize supplied country-code casing

**Decision:** When `countryCode` is supplied, trim surrounding whitespace,
accept `US` regardless of letter casing, and store it as uppercase `US` in
the canonical Load revision. A supplied value that is empty after trimming
or does not identify the United States rejects the full booking submission
with `STOP_COUNTRY_UNSUPPORTED` at the exact field path. Omission continues
to default to `US` under D-436.

**Reason:** Consistent case normalization prevents routine input casing from
causing false rejections while preserving one canonical country code.

### D-438 — Reject unknown special-handling codes

**Decision:** Permit only `OVERSIZE` and `HAZMAT` in
`specialHandlingCodes`. These known codes may be booked but remain blocked
from planning while their capabilities are unsupported. Reject any
unrecognized value with `SPECIAL_HANDLING_CODE_INVALID` at its indexed field
path; this booking-rule issue rejects the full submission.

**Reason:** A closed code set prevents typos and unknown capabilities from
being silently persisted as understood Load requirements.

### D-439 — Deduplicate known special-handling codes

**Decision:** Treat `specialHandlingCodes` as a set in the canonical Load
revision. Accept repeated known values in booking input, retain each code
only once, and preserve the first-occurrence order.

**Reason:** A repeated code does not represent an additional requirement;
deduplication avoids rejecting a valid booking while keeping the canonical
requirement list unambiguous.

### D-440 — Reject unrecognized equipment profiles

**Decision:** `equipmentProfile` may be omitted at booking, but when
supplied it must be one of `DRY_VAN`, `REEFER`, `FLATBED`, `STEP_DECK`, or
`TANKER`. Reject any other value with `EQUIPMENT_PROFILE_INVALID` at the
exact field path; this booking-rule issue rejects the full submission.
`STEP_DECK` and `TANKER` remain accepted known profiles but are held from
planning while unsupported.

**Reason:** A closed profile set prevents typos and arbitrary equipment
values from being persisted as meaningful requirements while retaining
explicit support for known future profiles.

### D-441 — Normalize equipment-profile casing

**Decision:** When `equipmentProfile` is supplied, trim surrounding
whitespace and accept recognized profile codes regardless of letter casing.
Store the accepted value in uppercase in the canonical Load revision.
After normalization, any value outside the recognized set defined by D-440
rejects the full booking submission with `EQUIPMENT_PROFILE_INVALID`.

**Reason:** Normalizing routine casing and whitespace variation preserves a
single canonical profile representation without widening the supported
profile set.

### D-442 — Normalize special-handling codes

**Decision:** For each `specialHandlingCodes` value, trim surrounding
whitespace and accept `OVERSIZE` or `HAZMAT` regardless of letter casing.
Normalize known values to uppercase before deduplication. Reject an empty or
unrecognized normalized value with `SPECIAL_HANDLING_CODE_INVALID` at its
indexed field path; this booking-rule issue rejects the full submission.

**Reason:** Normalization and deduplication give the set a consistent
canonical representation while keeping validation closed to known codes.

### D-443 — Omit empty special-handling sets from revisions

**Decision:** `specialHandlingCodes` is optional in booking input. When
omitted or supplied as an empty array, omit it from the canonical Load
revision; do not serialize an empty array or `null` to mean that no
requirements exist. A non-empty array follows the value validation,
normalization, and deduplication rules in D-438, D-439, and D-442.

**Reason:** Omitting an empty optional set follows the canonical revision
absence rule and avoids storing equivalent no-requirement states differently.

### D-444 — Normalize optional stop coordinates

**Decision:** Accept optional `address.coordinates` as a WGS 84 object with
JSON-number `latitude` and `longitude`. Latitude must be within −90..90 and
longitude within −180..180; each value may have at most six fractional
digits. If supplied coordinates are partial, malformed, over-precision, or
out of range, accept the otherwise valid booking, omit the coordinates from
the canonical address snapshot, and return non-blocking
`STOP_COORDINATES_INVALID` at the exact `address.coordinates` field path.

**Reason:** Optional verified coordinates can improve downstream
geospatial work, while invalid values should not erase an otherwise valid
commercial booking.

### D-445 — Normalize handling-unit codes

**Decision:** Trim surrounding whitespace from each `handlingUnitCode`,
accept recognized codes regardless of letter casing, and normalize the
canonical value to uppercase before applying the `OTHER` description rules.
Reject an empty or unrecognized value with `HANDLING_UNIT_INVALID` at the
exact freight-line field path; this booking-rule issue rejects the full
submission.

**Reason:** Case and whitespace normalization improves broker input
tolerance while preserving a single controlled handling-unit vocabulary.

### D-446 — Normalize customer-rate currency codes

**Decision:** Trim surrounding whitespace from `customerRate.currency` and
normalize its casing to uppercase before validation. Reject a value that is
not a valid ISO 4217 code with `CUSTOMER_CURRENCY_INVALID`; reject a valid
code other than `USD` with `CUSTOMER_CURRENCY_UNSUPPORTED`. Store the accepted
currency as uppercase `USD`. A missing currency remains invalid.

**Reason:** Normalization accepts routine formatting variation while
preserving the initial USD-only commercial contract.

### D-447 — Bound the customer-rate amount

**Decision:** Represent `customerRate.amount` as a positive decimal string
with at most two fractional digits and persist it as `NUMERIC(12,2)`. The
maximum is `9999999999.99` USD. A malformed, non-positive, over-precision,
or out-of-range amount rejects the full booking submission with
`CUSTOMER_RATE_AMOUNT_INVALID` at the exact amount field path.

**Reason:** Explicit precision and range prevent rounding and database
overflow while supporting the initial one-total-rate-per-Load model.

### D-448 — Define customer-rate amount notation

**Decision:** Trim surrounding whitespace from `customerRate.amount`, then
accept only plain decimal notation matching digits with an optional decimal
point followed by one or two digits. Do not accept signs, grouping
separators, or exponent notation. The normalized value must remain positive
and within the D-447 range; otherwise reject the submission with
`CUSTOMER_RATE_AMOUNT_INVALID` at the exact amount field path.

**Reason:** A strict decimal grammar preserves exact money values and
prevents locale-specific or floating-point representations from being
interpreted inconsistently.

### D-449 — Canonicalize customer-rate scale

**Decision:** After validating and trimming `customerRate.amount`, serialize
it in the canonical Load revision with exactly two fractional digits and no
redundant leading zeroes. For example, `0001250.5` becomes `1250.50`.

**Reason:** Fixed-scale canonical money values compare and serialize
consistently while preserving the exact accepted monetary amount.

### D-450 — Canonicalize freight quantity scale

**Decision:** After validating a freight-line `quantity`, serialize it in
the canonical Load revision with exactly three fractional digits and no
redundant leading zeroes. For example, `12` becomes `12.000` and `0.5`
becomes `0.500`.

**Reason:** Fixed-scale quantities compare and serialize consistently with
their `NUMERIC(12,3)` storage representation.

### D-451 — Define freight-quantity notation

**Decision:** Trim surrounding whitespace from each freight-line
`quantity`, then accept only plain decimal notation consisting of digits
with an optional decimal point followed by one to three digits. Do not accept
signs, grouping separators, or exponent notation. The normalized value must
be positive and within the D-428 range; otherwise reject the full submission
with `FREIGHT_QUANTITY_INVALID` at the exact field path.

**Reason:** A strict decimal grammar preserves exact quantities and prevents
locale-specific or floating-point representations from being interpreted
inconsistently.

### D-452 — Normalize stop-type values

**Decision:** Trim surrounding whitespace from each stop `type`, accept
`PICKUP` or `DELIVERY` regardless of letter casing, and store the normalized
value in uppercase. Reject an empty or unrecognized value with
`STOP_TYPE_INVALID` at the exact stop-type field path; this booking-rule
issue rejects the full submission.

**Reason:** Normalizing case and whitespace accepts ordinary input variation
while retaining a controlled stop-type vocabulary and canonical values.

### D-453 — Normalize gross-weight units

**Decision:** Trim surrounding whitespace from `totalGrossWeight.unit`,
accept `LB` or `KG` regardless of letter casing, and store the accepted unit
in uppercase in the canonical Load revision. An empty or unsupported unit
remains invalid and rejects the full booking submission with
`TOTAL_GROSS_WEIGHT_INVALID` at the exact unit field path.

**Reason:** Unit normalization accepts routine input variation while
preserving explicit, canonical weight units.

### D-454 — Canonicalize gross-weight scale

**Decision:** After validating `totalGrossWeight.value`, serialize it in the
canonical Load revision with exactly three fractional digits and no
redundant leading zeroes. For example, `1250.5` becomes `1250.500`.

**Reason:** Fixed-scale weight values compare and serialize consistently
with their `NUMERIC(12,3)` storage representation.

### D-455 — Define gross-weight value notation

**Decision:** Trim surrounding whitespace from `totalGrossWeight.value`,
then accept only plain decimal notation consisting of digits with an
optional decimal point followed by one to three digits. Do not accept signs,
grouping separators, or exponent notation. The normalized value must be
positive and within the `NUMERIC(12,3)` range; otherwise reject the full
submission with `TOTAL_GROSS_WEIGHT_INVALID` at the exact value field path.

**Reason:** A strict decimal grammar prevents locale-specific and
floating-point representations from being interpreted inconsistently.

### D-456 — Normalize reefer temperature units

**Decision:** Trim surrounding whitespace from `temperatureRange.unit`,
accept `F` or `C` regardless of letter casing, and normalize recognized
values to uppercase before validating the range. An empty or unsupported
unit makes the supplied range invalid; apply the existing
`REEFER_TEMPERATURE_RANGE_INVALID` planning-blocking follow-up behavior.

**Reason:** Unit normalization accepts common input variations while
retaining one canonical representation and the existing stage-gated
correction path.

### D-457 — Canonicalize reefer temperature scale

**Decision:** After validating a reefer temperature endpoint, serialize each
accepted `temperatureRange.minimum` and `.maximum` in the canonical Load
revision with exactly two fractional digits, preserving its sign. For
example, `2` becomes `2.00` and `-5.5` becomes `-5.50`.

**Reason:** Fixed-scale temperature values compare and serialize
consistently with their signed `NUMERIC(5,2)` storage representation.

### D-458 — Define reefer temperature notation

**Decision:** Trim surrounding whitespace from each
`temperatureRange.minimum` and `.maximum`. Accept signed plain decimal
notation with an optional leading minus sign, an optional decimal point
followed by one or two digits, and values within the signed `NUMERIC(5,2)`
range. Do not accept a leading plus sign, grouping separators, or exponent
notation. A malformed or out-of-range supplied endpoint makes the range
invalid and follows D-410's planning-blocking follow-up behavior.

**Reason:** The signed decimal grammar supports below-zero temperatures
while preserving exact values without locale or floating-point ambiguity.

### D-459 — Normalize flatbed dimension units

**Decision:** Trim surrounding whitespace from each flatbed freight-line
`dimensions.unit`, accept `IN` or `CM` regardless of letter casing, and
normalize recognized values to uppercase before validating dimensions. An
empty or unsupported unit makes the supplied dimensions invalid and follows
D-412's planning-blocking follow-up behavior.

**Reason:** Unit normalization accepts routine input variations while
preserving a single canonical measurement unit.

### D-460 — Canonicalize flatbed dimension scale

**Decision:** After validating each flatbed dimension, serialize accepted
`length`, `width`, and `height` values in the canonical Load revision with
exactly two fractional digits, consistent with `NUMERIC(10,2)`.

**Reason:** Fixed-scale dimensions compare and serialize consistently with
their database representation.

### D-461 — Define flatbed dimension notation

**Decision:** Trim surrounding whitespace from each flatbed dimension. Accept
only positive plain decimal notation consisting of digits with an optional
decimal point followed by one or two digits, without signs, grouping
separators, or exponent notation. Values must fit `NUMERIC(10,2)`. A malformed,
non-positive, over-precision, or out-of-range supplied value makes the
dimensions invalid and follows D-412's planning-blocking follow-up behavior.

**Reason:** A strict decimal grammar prevents locale-specific or
floating-point representations from being interpreted inconsistently while
preserving the agreed stage-gated correction behavior.

### D-462 — Normalize reefer-mode values

**Decision:** Trim surrounding whitespace from `reeferMode`, accept
`CONTINUOUS` or `START_STOP` regardless of letter casing, and normalize
recognized values to uppercase before applying the existing default and
correction rules. Unrecognized values continue to follow D-420 and D-421.

**Reason:** Normalizing recognized enum values avoids unnecessary correction
notices while preserving the agreed safe-default behavior for truly invalid
modes.

### D-463 — Require UUIDv7 Customer identifiers

**Decision:** Require booking `customerId` to be a syntactically valid
UUIDv7 issued by Counterparty Registry. Reject a missing ID with
`CUSTOMER_ID_REQUIRED`; reject malformed or non-UUIDv7 values with
`CUSTOMER_ID_INVALID` at the exact field path. These booking-rule issues
reject the full submission. Perform Customer-status lookup only for a
syntactically valid UUIDv7.

**Reason:** Validating identifier shape before owner lookup avoids pointless
service calls and keeps cross-service references within the established
UUIDv7 identifier convention.

### D-464 — Require pickup-first and delivery-last stop order

**Decision:** A booking's ordered stop list must begin with a `PICKUP` and
end with a `DELIVERY`, and must contain at least one of each type.
Intermediate pickups and deliveries may interleave. Reject a list that
violates the endpoint or presence rules with `STOP_SEQUENCE_INVALID` at the
stop-list field path; this booking-rule issue rejects the full submission.
Dispatch Planning remains responsible for route feasibility.

**Reason:** The first and last stop types establish a coherent transport
direction at booking while preserving operationally valid multi-pickup and
multi-delivery sequences for planning.

### D-465 — Return all independent booking issues

**Decision:** When a booking submission contains multiple validation
failures, collect all independently detectable booking-critical issues rather
than stopping at the first issue. Sort the durable `issues` array by
`rowNumber` ascending, then `fieldPath` lexicographically ascending, with
`code` lexicographically ascending as a tie-breaker. Do not emit duplicate
or cascading issues when one invalid value prevents a dependent check.

**Reason:** A complete, deterministic issue list lets brokers correct a
rejected submission efficiently and gives clients stable response ordering.

### D-466 — Separate missing and malformed postal codes

**Decision:** A stop's `postalCode` is required. Reject a missing or
whitespace-only value with `STOP_ADDRESS_FIELD_REQUIRED`. For a supplied
non-empty value, trim surrounding whitespace and accept five digits or
hyphenated ZIP+4; reject any other format with `STOP_POSTAL_CODE_INVALID`.
Include the exact field path and reject the full booking submission.

**Reason:** Distinct required-field and format errors tell the broker whether
to provide a value or correct its format.

### D-467 — Separate missing and invalid state codes

**Decision:** A stop's `stateCode` is required. Reject a missing or
whitespace-only value with `STOP_ADDRESS_FIELD_REQUIRED`. Otherwise trim the
value, normalize valid in-scope state/DC abbreviations regardless of casing,
and store them uppercase. Reject malformed codes and codes outside the 50
states plus DC with `STOP_STATE_CODE_INVALID` at the exact field path.
Booking-rule failures reject the full submission.

**Reason:** The distinction gives clear corrective guidance without
weakening the agreed state-code scope or normalization.

### D-468 — Distinguish missing rate from missing amount

**Decision:** Use `CUSTOMER_RATE_REQUIRED` only when the entire
`customerRate` object is absent. If the object is present but `amount` is
missing or whitespace-only after trimming, reject the full submission with
`CUSTOMER_RATE_AMOUNT_INVALID` at the amount field path, as for any other
malformed, non-positive, over-precision, or out-of-range amount.

**Reason:** Separate codes identify whether the broker must add the rate
object or correct its amount.

### D-469 — Defer hazardous-goods details while HAZMAT is held

**Decision:** In the initial booking schema, `HAZMAT` is a special-handling
flag only; do not require hazardous-goods detail fields at booking. Continue
to accept the flag but hold the Load from planning and Assignment with
`SPECIAL_HANDLING_UNSUPPORTED` until a dedicated hazardous-goods workflow
and its required details are defined.

**Reason:** This preserves the selected initial booking behavior without
implying that a HAZMAT Load is safe or ready for operational execution.

### D-470 — Persist rejected Load amendment attempts

**Decision:** When a complete Load amendment snapshot fails booking-rule
validation, durably retain the rejected attempt and its validation issues in
the Load service's idempotency result. Order issues by `fieldPath`
lexicographically, then by `code` lexicographically. Do not create a Load
revision or publish a revision fact. An identical retry with the same
idempotency key replays the stored rejection; corrected content requires a
new key.

**Reason:** Durable, deterministic rejection results support reliable client
retries and auditable correction without changing the committed Load state.

### D-471 — Hold active Assignment through amendment revalidation

**Decision:** When a Load amendment commits while an Assignment is active but
Execution has not started, freeze Dispatch progression. Retain the existing
Assignment and confirmed Capacity Commitment while the amended Load revision
is replanned and replacement capacity is confirmed. Do not supersede the
Assignment or release its commitment until the replacement plan and capacity
confirmation are durable. Then perform a coordinated, recoverable handoff to
the Assignment and commitment for the exact amended revision before resuming
progression. If revalidation cannot complete, keep the Load held; do not
resume the old plan against the amended revision.

**Reason:** Retaining the current commitment avoids an unprotected capacity
gap, while freezing progression prevents execution from relying on stale
requirements.

### D-472 — Keep Customer identity immutable across Load revisions

**Decision:** An amendment must retain the Load's original `customerId`.
Reject a changed value with `LOAD_CUSTOMER_IMMUTABLE` at `/customerId`.
Changing the Customer is not a Load amendment; create a separate booking and
handle the existing Load through its normal lifecycle controls.

**Reason:** Customer identity determines the commercial and authorization
context for the Load; changing it in place would rewrite ownership semantics
across an immutable operational history.

### D-473 — Clear omitted optional values in Load amendments

**Decision:** A Load amendment is a complete replacement snapshot. An
optional field omitted from the new snapshot has no value in that revision;
do not inherit its value from the previous revision. Apply the field's
existing validation and canonicalization rules to supplied values.

**Reason:** Explicit replacement semantics make each immutable revision a
self-contained statement of current requirements and prevent stale values
from silently surviving a broker's amendment.

### D-474 — Treat null as omission for optional request fields

**Decision:** In booking and amendment request bodies, treat an explicit
`null` for an optional field that is not defined as nullable as omission.
Continue to apply normal validation to required fields and the explicitly
defined semantics of nullable fields. Canonical Load revisions and emitted
facts continue to omit fields with no value unless their contract defines a
meaningful `null`.

**Reason:** Accepting `null` as absence makes request normalization tolerant
of common client serialization while preserving the canonical distinction
between absent data and meaningful null values.

### D-475 — Generate freight-line IDs for each revision

**Decision:** Generate a new UUIDv7 `freightLineId` for every freight line
when creating a Load revision, including lines whose business values are
unchanged from the prior revision. Freight-line identifiers are revision-
scoped and are never carried across revisions.

**Reason:** Revision-scoped row identity keeps each immutable snapshot
self-contained and prevents later edits from changing the meaning of a
freight-line reference in historical records.

### D-476 — Bind amendment idempotency to its base revision

**Decision:** Include the normalized replacement snapshot and `If-Match`
base-revision ETag in the Load amendment idempotency fingerprint. Resolve an
existing idempotency result before re-evaluating the current ETag, so an
identical retry replays the original outcome even if the Load has since
advanced. Reusing the key with a different snapshot or base ETag returns
`409 Conflict`.

**Reason:** The base revision is part of the amendment's concurrency
precondition; binding it to the key prevents one idempotency key from
representing distinct amendment commands.

### D-477 — Bound active-Assignment amendment revalidation

**Decision:** The protective retention of an existing Assignment and
confirmed Capacity Commitment during amendment revalidation expires ten
minutes after the amendment commits; this deadline is not renewed by retries.
If replacement planning and capacity confirmation are not both durable by
then, retire that revalidation attempt and begin coordinated release of the
old Assignment and commitment. Keep the Load blocked until both owners
confirm release, then return it to normal planning. Late results from the
expired attempt must not reactivate the old handoff. This supersedes D-471's
instruction to keep the Load held when revalidation cannot complete.

**Reason:** A fixed deadline prevents an unresolved amendment from holding
capacity indefinitely while ensuring the Load cannot re-enter planning until
its prior Assignment and commitment are safely released.

### D-478 — Persist stale-ETag amendment outcomes

**Decision:** When an amendment's `If-Match` ETag is stale, durably retain
the `412 Precondition Failed` outcome against its idempotency key and
fingerprint. An identical retry replays the stored `412`; it creates no Load
revision or revision fact.

**Reason:** Persisting precondition failures makes retries deterministic and
prevents a stale amendment command from being reinterpreted after later Load
changes.

### D-479 — Persist missing-precondition amendment outcomes

**Decision:** When an amendment omits required `If-Match`, return
`428 Precondition Required` and durably retain the outcome against its
idempotency fingerprint. An identical retry replays the `428` and creates no
revision. Supplying the missing ETag changes the fingerprint, so the corrected
request requires a new idempotency key.

**Reason:** Consistent durable handling of amendment precondition failures
keeps a key bound to one immutable command and makes client recovery
unambiguous.

### D-480 — Acknowledge expired amendment-revalidation release

**Decision:** When the ten-minute amendment-revalidation deadline expires
and the old Assignment and Capacity Commitment have both been released,
immediately notify the responsible dispatcher as the primary
acknowledgement owner and inform the broker. Require dispatcher
acknowledgement and apply the existing urgent-notification resend and
15-minute escalation protocol.

**Reason:** The dispatcher must promptly know that prior capacity protection
has ended and that the Load has returned to planning; acknowledgement confirms
receipt without resolving or changing the Load's business state.

### D-481 — Define the Execution-start gate

**Decision:** Execution may accept actual pickup/departure and transition a
Trip or per-Load Execution from `PLANNED` to `IN_PROGRESS` only when the
Assignment is active for the exact current Load revision, its Capacity
Commitment is confirmed, the current Load revision is `READY`, and all
required Fleet Readiness facts used for the assigned resources remain current
and valid. Do not require an additional per-start dispatcher approval or
driver pre-trip attestation in the initial workflow. Actual pickup/departure
is recorded by Execution as the start fact; assignment alone does not mean
that movement has begun. This does not preclude separately reviewed legal or
safety requirements.

**Reason:** The gate relies on authoritative, revision-matched operational
records and avoids treating an Assignment as proof of movement or adding an
unapproved approval step.

### D-482 — Prioritize the coherent TMS over showcase features

**Decision:** Define the intended initial operational release as the coherent
TMS capability the owners intend the system ultimately to provide, not as a
narrow minimum feature set selected to demonstrate value to external
customers. This does not require implementing the entire target in one
delivery. Treat business scope, architecture, infrastructure, contracts,
security, and operational controls as interconnected parts of one system
and refine them iteratively. Select implementation increments according to
their technical importance to the whole system, including architectural
learning, unresolved risk, dependency order, system integrity, and
end-to-end verifiability; no individual service or business function has
inherent priority over system coherence. Use bounded vertical slices to
implement and validate increments, not to redefine the target as a showcase.
Do not use _MVP_ to imply a narrow customer-facing scope or a reduced
technical standard. Detailed operational scope and measurable acceptance
criteria remain subject to explicit approval.

**Reason:** The owners are both the business and engineering stakeholders,
so the objective is to establish a dependable, coherent TMS rather than to
optimize for customer demonstration or feature quantity. Architecture-led
sequencing directs effort toward the decisions and dependencies with the
greatest impact on correctness and recoverability.

### D-483 — Establish the minimum TMS target and preserve system boundaries

**Decision:** Treat the currently documented booked-Load-to-Execution-
confirmed-closeout workflow and its already selected connected
responsibilities as the minimum identified TMS target, not as a finalized
maximum scope or an approved release checklist. The minimum includes the
foundational identity, counterparty and fleet-readiness records; Load
booking/revisions; planning, capacity protection and Assignment; Execution,
evidence, exception handling and closeout; and the connected operational
capabilities explicitly recorded as in scope in the system blueprint and
responsibility map. It also requires the platform and operational controls
needed to make those responsibilities dependable. Detailed requirements,
acceptance criteria, and implementation timing remain governed by their
owning documents and the implementation-readiness gate.

Keep the TMS a bounded, foundational transportation system on which adjacent
business systems may rely through explicit contracts; do not absorb
independent systems or mix their authoritative responsibilities into TMS
services. Billing, accounting, accounts receivable/payable, and settlement
remain outside the TMS. TMS rates and internal charge/cost proposals are not
financial ledgers, invoices, payment obligations, or settlement records.
Whether user-facing client applications are delivered with the TMS or
separately remains open and does not change business ownership boundaries.
The maximum scope is intentionally undefined. Any addition or exclusion
requires an explicit owner decision identifying purpose, ownership, records,
relationships, lifecycle, integrations, and completion boundary.

This decision refines and supersedes the scope boundary in D-23 where later
decisions have explicitly brought bounded manual tendering, internal
Customer-charge and Carrier-cost proposals, and Load-linked operational
claims into the TMS target. D-23's exclusion of broader sourcing,
financial execution, maintenance management, and unrestricted claims
handling remains in force as clarified by the current responsibility map.

**Reason:** Establishing the minimum gives architecture and implementation
planning a concrete foundation without falsely treating current coverage as
the full product boundary. Preserving independent system ownership prevents
scope growth from collapsing distinct business responsibilities into one
TMS.

### D-484 — Select one accepted Carrier tender as binding

**Decision:** Carrier acceptance of a manual Load tender records the
Carrier's commercial response but does not itself reserve capacity or bind
the Load to that Carrier. If one or more tenders are accepted, the responsible
`contract_capacity_dispatcher` explicitly selects exactly one accepted tender
as the binding tender for the Load and records that selection. Dispatch
Planning may consider only the Carrier on the selected binding tender for
that Load. The binding selection does not assert that capacity is available:
the normal Dispatch Planning and Capacity Commitment workflow must still
establish a feasible Assignment and confirmed reservation. If the selected
Carrier cannot pass readiness or capacity checks, keep the Load unassigned
until an authorized dispatcher action changes the tender selection.

When a tender is selected as binding, the dispatcher closes competing open
and accepted tenders through the existing external channel and records their
disposition; the TMS does not contact Carriers automatically. Preserve all
tender rounds, acceptances, selection history, and closure records.

Before an Assignment becomes active, the responsible dispatcher may
explicitly supersede the binding selection and select another accepted
tender only after reconfirming that Carrier's acceptance through the external
channel, or issue a replacement tender. Record the actor, time, reason, old
and new tender references, and required external communications. Once an
Assignment is active, a Carrier change must use the Load amendment/replanning
or cancellation workflow and its coordinated Assignment and Capacity
Commitment handling; do not replace the Carrier directly on the active
Assignment.

**Reason:** An explicit binding selection resolves multiple Carrier
acceptances without losing negotiation history. Constraining planning to the
selected Carrier preserves the recorded commercial agreement, while keeping
reservation and Assignment authority with their existing owners prevents a
tender from being misrepresented as secured capacity.

### D-485 — Permit tender withdrawal before binding selection

**Decision:** The responsible `contract_capacity_dispatcher` may withdraw a
tender at any time before it is selected as the Load's binding tender,
including after a Carrier has accepted it. Record withdrawal as a terminal
tender disposition, preserve all prior rounds and responses, and have the
dispatcher communicate the withdrawal through the existing external
channel. A tender selected as binding cannot be directly withdrawn; use the
pre-Assignment reselection process in D-484 or the Load amendment/replanning
or cancellation workflow after Assignment activation.

This supersedes D-173's prohibition on withdrawing an open tender. D-174's
automatic cancellation of open tenders when a Load is canceled remains in
force.

**Reason:** Allowing the responsible dispatcher to end a negotiation before
binding supports changing operational circumstances, while preserving a
clear control boundary once a Carrier is selected for the Load.

### D-486 — Preserve the binding Carrier through pre-Assignment amendments

**Decision:** A committed Load amendment before Assignment activation does not
by itself clear or replace the selected binding Carrier. Dispatch Planning
must revalidate the exact amended Load revision against that Carrier's
readiness and capacity. If the bound Carrier cannot pass the required checks,
keep the Load unassigned until the responsible dispatcher takes an explicit
re-tender or reselection action under D-484. Do not silently substitute
another Carrier. A Load amendment does not rewrite the accepted tender's
historical terms; whether amended requirements require a new rate or renewed
Carrier acceptance remains open.

**Reason:** Retaining the binding Carrier avoids an implicit change to the
commercial selection, while exact-revision revalidation prevents planning
against stale Load requirements. Rate renegotiation remains a separate
commercial decision rather than an automatic consequence of snapshot
replacement.

### D-487 — Preserve valid bookings when secondary input is invalid

**Decision:** If all booking-critical data is valid, an invalid value in an
optional field or a field required only at a later workflow stage does not
reject the booking or its batch. Do not treat the invalid value as an
authoritative Load fact; omit it from the canonical revision and create a
field-addressed completion task that identifies the issue and required
correction. Hold any later stage that requires that fact until valid data is
provided and revalidated; unrelated stages and Loads may proceed. If the
invalid field is not required by a stage gate, the completion task is
non-blocking. Booking-critical omissions or invalid values continue to reject
the entire batch without creating Loads.

This supersedes conflicting booking-rejection behavior for invalid optional
or later-stage values in D-416, D-422, D-424, D-426, D-430, D-438, D-440,
D-441, D-442, D-453, D-454, and D-455. It does not change rejection of
booking-critical fields or conditionally required booking data, such as the
description required when a freight line uses `OTHER`. Existing field
normalization rules remain in force. Exact completion-task and
planning-readiness codes and payloads remain subject to the open contract
work.

**Reason:** Booking commits the commercial Load only when its essential
requirements are valid. Treating malformed optional or later-stage data as
an actionable correction preserves that commitment without allowing
unverified facts to pass a later operational gate.

### D-488 — Limit Customer status gating to future bookings

**Decision:** A Customer status other than `ACTIVE` prevents new bookings
for that Customer. A later transition from `ACTIVE` to `SUSPENDED` or
`CLOSED` does not automatically hold, amend, or cancel Loads that were
already accepted. Existing Loads continue under their current lifecycle
unless separately amended or canceled through the authorized workflow.
Status-change notifications and any Carrier/Fleet Readiness revalidation
remain subject to their respective contracts.

**Reason:** A Customer status change governs whether the company accepts
additional commercial work; it does not silently reverse existing
commitments or bypass the Load amendment and cancellation controls.

### D-489 — Preserve active Carrier work after a status change

**Decision:** Only an `ACTIVE` Carrier may be selected for new binding
tenders or have a pending Assignment activated. If a Carrier becomes
`SUSPENDED` or `CLOSED` before Assignment activation, do not activate a
pending Assignment for that Carrier. Retain that pending Assignment and any
existing Capacity Commitment reservation for explicit dispatcher
re-tender/reselection or coordinated release; if no Assignment has been
proposed, keep the Load unassigned pending dispatcher action. Do not
automatically release a reservation, hold, amend, or cancel an already active
Assignment or its Execution. Existing active work continues under its
current lifecycle unless an authorized dispatcher performs the applicable
coordinated reassignment or cancellation workflow. Status-change
notifications and owner-fact freshness/revalidation procedures remain open.

**Reason:** Carrier status controls new operational commitments and
activation, while preserving already-active work avoids silent reassignment
or cancellation outside the coordinated Load, Assignment, and Capacity
Commitment workflows.

### D-490 — Assign Carrier eligibility facts to Fleet Readiness

**Decision:** Fleet Readiness owns versioned Carrier eligibility facts and
their verification evidence when those facts are required as planning gates.
Counterparty Registry continues to own Carrier identity and lifecycle status,
not qualification. Fleet Readiness records facts and enforces approved
hard gates; it does not interpret law or manage compliance cases. The exact
fact catalogue, verification sources and roles, validity periods, and
Carrier agreement lifecycle and ownership remain open.

**Reason:** Planning-critical eligibility needs a clear operational owner
and an auditable evidence trail, without expanding Counterparty Registry or
Fleet Readiness into legal interpretation or compliance case management.

### D-491 — Evaluate Carrier eligibility per applicable fact

**Decision:** Dispatch Planning evaluates each applicable, evidence-backed
Carrier eligibility fact independently. A required fact that is missing,
expired, invalid, or not verified blocks planning; no single aggregate
Carrier-level `QUALIFIED` flag may substitute for those facts. Dispatch
Planning derives the eligibility outcome from the current owner facts. The
exact fact catalogue, verification sources, and fact-specific validity
periods remain open.

**Reason:** Independent fact evaluation preserves the evidence and failure
reason for each planning gate and prevents an aggregate status from
concealing a missing, stale, or invalid requirement.

### D-492 — Record Carrier eligibility from manual evidence review

**Decision:** In the initial scope, an authorized verifier manually reviews
an approved authoritative source and records the resulting Carrier
eligibility fact in Fleet Readiness. Retain the evidence source/reference,
verifier, observation time, owner revision, and applicable validity period.
Do not assume or require live external-source integration for this workflow.
Missing, expired, or unverified required evidence remains blocking under
D-491. The approved source catalogue, verifier roles, and fact-specific
validity periods remain open.

**Reason:** Manual evidence review establishes an auditable initial path
without coupling core planning to unselected external integrations or
treating an unsupported assertion as verified eligibility.

### D-493 — Keep Carrier agreements externally authoritative

**Decision:** Carrier agreements remain external legal records; the TMS does
not own their authoring, signature, renewal, termination, or full lifecycle.
When an agreement is required for a planning or tender gate, Fleet Readiness
stores only the versioned, verified operational eligibility fact and
agreement reference needed for that gate, together with its evidence and
validity metadata. Do not treat the TMS reference as the agreement itself.
This resolves the agreement-ownership question left open in D-490. The exact
reference fields, agreement sources, verification roles, and validity rules
remain open.

**Reason:** Keeping the legal agreement in its authoritative external
boundary avoids duplicating legal lifecycle management while retaining the
verified operational fact needed by TMS workflows.

### D-494 — Notify owners when Carrier eligibility facts change

**Decision:** When a Carrier eligibility fact becomes invalid, reaches its
validity deadline, or is superseded, immediately notify the responsible
verifier and affected planning owner. Apply the stage-specific gate in D-491:
hold only planning actions that require the invalid or unavailable fact.
This notice does not automatically hold, amend, or cancel an active
Assignment or Execution under D-489. The notification channel, delivery
retry, and acknowledgement rules remain open; this does not settle notices
for Counterparty Registry status changes.

**Reason:** Immediate, owner-directed notice makes a changed eligibility
fact actionable while preserving stage ownership and the explicit
reassignment/cancellation controls for active work.

### D-495 — Require an explicit Execution closeout gate

**Decision:** Execution alone determines whether a Trip or per-Load
Execution may enter `COMPLETED`. A Trip Execution may complete after every
planned Trip stop has its required actual arrival/departure milestones and
stop outcome, and the final planned stop has been departed. Trip completion
does not require per-Load closeout, proof-of-delivery approval, or resolution
of a Load-specific delivery exception.

A per-Load Execution may confirm closeout after the transportation attempt
has ended and its planned stops have final actual outcomes. Each delivery
stop at which freight was unloaded requires clean, `AVAILABLE`
proof-of-delivery evidence or an authorized, reasoned exception when that
evidence cannot be uploaded. A stop with no delivery requires a final
`PARTIAL` or `NOT_COMPLETED` outcome and linked issue, not a fabricated POD.
An own-fleet POD may satisfy the evidence gate on receipt. A contractor or
outer-Carrier POD requires dispatcher review before closeout. If POD upload
is unavailable, an authorized dispatcher may record the delivery statement
and closeout basis; this is an explicit evidence exception, not a received
or verified POD, and must create a linked issue for follow-up.

Record actual delivered quantity for each applicable freight line at each
delivery stop. Preserve shortfalls, overages, refused or omitted stops, and
actual unload locations as factual outcomes and linked issue records. These
outcomes do not keep the Load or Execution open after the transportation
attempt has ended, and they do not certify that the Customer's commercial
obligations are satisfied. If all freight for the Load has been unloaded,
both Load and per-Load Execution become `COMPLETED`, including when the
actual final unload location differs from the planned location. If freight
remains on the equipment after the final attempted delivery, both records
still become `COMPLETED`; the remaining-freight issue is recorded and handed
to its receiving service. A Load may share equipment with other Loads, so
completion is determined from this Load's freight, not whether the whole
trailer is empty.

Persist the closeout decision and its evidence/exception references as an
Execution-owned fact. Load becomes `COMPLETED` only after consuming that
authoritative fact under D-33; Load does not independently infer closeout.
This consolidates D-19, D-42, D-65, and D-66 without changing the
Execution-start gate in D-481. D-512 supersedes D-84's blocking-exception
closeout rule. D-503 subsequently defines the logical quantity
representation and closeout-fact schema. Exact operation payloads and
evidence-retention controls remain open.

**Reason:** An explicit owner-computed gate makes each delivery's evidence,
quantity, and exception status auditable while preventing Trip completion
from being confused with completion of every Load on that Trip.

### D-496 — Keep exception cases independent of terminal lifecycle state

**Decision:** Load terminal states are `CANCELLED` and `COMPLETED`; neither
may transition to the other or back to a non-terminal Load state. Reaching
`CANCELLED` requires the downstream release confirmations defined in D-29.
Reaching `COMPLETED` requires the Execution closeout fact defined in D-495.
An exception case does not itself reverse or delay cancellation once those
required releases are confirmed.

Execution-owned movement and evidence records retain their own history
independently of Load lifecycle. D-512 supersedes the internal TMS lifecycle
for post-delivery claims and operational issues: the Load service retains a
minimal Load-linked issue record and handoff state, while the receiving
out-of-scope service owns issue assignment, status, and resolution. A linked
issue neither delays nor reverses terminal Load or Execution status.

Trip and per-Load Execution lifecycle completion records the end of movement,
not the resolution of every linked issue. Corrected reports and late evidence
are appended as new records and do not silently alter a terminal state.

**Reason:** Lifecycle status represents the disposition of transportation
work; exception state represents follow-up. Keeping these histories
independent preserves terminal-state meaning while allowing operational
investigation and post-delivery claims to continue.

### D-497 — Define booking validation outcomes and correction tasks

**Decision:** The booking contract in [`contracts.md`](../contracts.md)
defines the semantic request field inventory and the durable result
envelopes for accepted and rejected submissions. Booking-critical errors
reject the entire batch and produce ordered, field-addressed `issues`.
Accepted results return one Load reference per source row, retaining the
one-based row number and deterministic row order.
Invalid optional or later-stage values are omitted from the canonical Load
revision and produce accepted `followUpItems`; the task identifies the Load,
source row, request field path, cause, safe explanation, corrective action,
and the affected stage gate. Informational follow-ups do not block a stage.
The Load readiness fact separately reports deterministic, field-addressed
blockers for the current revision. None of these completion tasks is an
exception case or changes the booking outcome.

**Reason:** Explicitly distinguishing intake rejection, accepted correction
work, and planning readiness preserves D-487's salvage behavior while making
the client and asynchronous planning contracts actionable and consistent.
This resolves D-487's deferred decision on exact completion-task and
planning-readiness codes and payloads. The semantic contract does not replace
the service-owned OpenAPI and AsyncAPI specifications.

### D-498 — Define freight-line counts and stackability

**Decision:** Each freight line represents one homogeneous commodity and
handling-unit group. Its positive integer `quantity` is the count of
handling units identified by `handlingUnitCode`, not a count of products
contained within each unit. Accept it as an integer decimal string from
`1` through `999999999999` and persist it as `NUMERIC(12,0)`. Missing counts
reject with `FREIGHT_QUANTITY_REQUIRED`; malformed, non-integer,
non-positive, or out-of-range counts reject with `FREIGHT_QUANTITY_INVALID`.
A contained-product quantity and unit are not part of the present booking
contract. This supersedes the quantity precision and fractional-scale rules
in D-36, D-428, D-450, and D-451.

Every freight line requires an explicit boolean `stackable` at booking. It
applies to every handling unit in that line; groups with different
stackability or dimensions must be separate lines. When `stackable` is true,
dimensions describe one handling unit and must be supplied before planning.
Flatbed Loads also require dimensions for every freight line, including
non-stackable freight. Missing or invalid required dimensions are accepted
booking follow-ups that block planning; use one field-addressed task when
both rules require the same dimensions. Missing or non-boolean `stackable`
is booking-critical and rejects the entire batch. Invalid dimensions supplied when
not currently required are omitted with a non-blocking correction task;
absent dimensions create no task until a requirement applies.
The shared freight-dimension follow-up and readiness codes replace the
flatbed-only dimension codes in D-411 and D-412.

These facts establish a minimum stacking constraint and basic freight
geometry only. They do not define a complete trailer packing or capacity
model, including orientation, weight-bearing limits, stack height, partial-
load space optimization, or a feasible arrangement. Those capabilities
remain future planning scope. Hazardous-material detail and later
Customer/Carrier links or supplemental child records remain separate
discussion items; this decision does not introduce those fields.

**Reason:** A precise unit count avoids conflating the number of pallets or
other handling units with their contents. Explicit stackability and
per-unit dimensions preserve the minimum information needed for planning
while preventing the current schema from implying a complete trailer
optimization capability.

### D-499 — Establish initial Dispatch Planning hard gates and ranking

**Decision:** Dispatch Planning evaluates only the exact current planning-
ready Load revision against current owner facts. It applies hard eligibility,
Carrier, equipment, driver, route/schedule, geometry, and complete-capacity
reservation gates before candidate ranking. Missing or stale hard-gate facts
are unknown/ineligible; missing or stale projections defer for reconciliation
and never establish unavailability. A missing required route or stop-service
time estimate defers the attempt for visible human review. The initial system
does not claim to calculate or certify regulatory hours-of-service
compliance; applicable legal gates require authoritative review before
automation relies on them.

Rank only candidates passing all hard gates, lexicographically by confirmed
appointment-window buffer, minimum deadhead/repositioning time, valid
explicit resource preferences, minimum unnecessary resource changes and
driver/segment count, then stable UUID ordering. A strong avoid-preference or
driver objection blocks automatic finalization for bounded human review;
neither may bypass a hard gate. Persist evaluated owner revisions, route
estimate source/model versions, and policy version for reproducibility.

Planning evaluates each Load against its actual requested windows, subject
to the rolling reservation horizon and chain limits in D-511. Multi-Load
consolidation considers only current `READY` Loads with overlapping
operational windows and revalidates the complete combined plan. Profile
definitions are composable: `SHORT` is
at most 12 elapsed hours from first pickup arrival to final delivery
departure, `LONG` is more than 12 hours; `RETURN_HOME` means the assigned
driver's final planned stop is inside that driver's explicitly configured
home-area boundary, otherwise `OUTBOUND` when a home boundary is configured.
Without a configured boundary, do not assign a direction profile. These are
operational matching classifications, not legal driving limits; do not infer
a home area from company headquarters or operating area.

Capacity Commitment's atomic reservation outcome resolves resource
contention. A successful complete reservation wins; rejected attempts retain
no partial claims and must replan from current projections. New attempts
start only for a relevant owner revision/fact, an explicit durable timer, or
an authorized human request. Full trailer packing, partial-load space
optimization, orientation/stack-strength proof, and regulatory driving-time
compliance are not established by these gates.
This settles D-07's initial short/long classification threshold and the
planning/matching-policy baseline in item 21; the remaining prerequisites
are recorded in D-500.

**Reason:** Separating feasibility from preferences prevents optimization
scores from weakening safety or contractual requirements. Deterministic
ranking and recorded input versions make decisions explainable and
reproducible while preserving owner authority for eligibility and capacity.

### D-500 — Bound planning review and preserve estimate provenance

**Decision:** Dispatch Planning uses a provider-neutral route-estimation
interface. Each route estimate records its covered legs, distance and travel
duration, applicable vehicle/route constraints, calculation time,
source/provider (or reviewed manual source reference), and model/policy
version. Stop service-time assumptions are explicit, versioned policy
inputs. No vendor is selected by this decision. Missing required estimates
or approved service-time policies defer the attempt for visible human review;
an unverified manual estimate cannot support automatic finalization.

A strong avoid-preference, driver objection, or missing required estimate
creates a durable human-review task and keeps the proposal on hold. The
responsible dispatcher must acknowledge the task within 15 minutes; absent
acknowledgement, escalate to the transportation executive under the existing
urgent-notification policy. Acknowledgement is receipt only. The hold ends
only after an authorized, reasoned disposition; timer expiry does not
automatically assign or reject the proposal.

An unapproved legal or safety eligibility rule is not presumed satisfied.
Automated finalization for affected work remains disabled until qualified
review approves the authoritative rule, evidence source, and verification
gate. This does not establish hours-of-service calculation or certification.
Resource-fact validity continues to follow the owning service's fact-type
policy; do not introduce a universal time-to-live or duplicate owner facts in
Dispatch Planning. The existing 15-minute availability freshness rule and
explicit maintenance-status expiry remain in force.

Operational acceptance profiles define measurable system capacity and
service targets separately from `SHORT`, `LONG`, `OUTBOUND`, and
`RETURN_HOME` planning classifications. Do not infer numeric product limits
from the reference organization's design assumptions; record the targets in
the product-wide acceptance criteria.

**Reason:** A provider-neutral boundary preserves replaceability while
versioned provenance makes planning reproducible. Acknowledgement and
resolution are distinct operational events, and an unresolved human or
legal gate must never be converted into an automatic decision.

### D-501 — Define the Load and booking-submission logical schema

**Decision:** Define the first logical database schema slice in the
[technical workflow](TECHNICAL_WORKFLOW.md#load-and-booking-submission-relational-schema).
Load persists one versioned `booking_submissions` record per durable POST,
including normalized input/result JSONB snapshots, normalized content hash,
authenticated principal, idempotency key, correction link, outcome, and
timestamps. The submission key is unique within the authenticated principal
and booking operation. Rejected submissions persist issues and create no
Load rows; accepted submissions atomically create one Load per input row,
its initial committed revision, lifecycle transition, and planning outbox
fact.

The schema defines `loads` as mutable lifecycle/current-revision heads,
`load_lifecycle_transitions` as append-only history, `load_revisions` as
complete immutable requirement snapshots, and revision-owned ordered
`load_revision_stops`, `load_revision_freight_lines`, and
`load_revision_special_handling_codes` as typed relational children. Booking
input/result JSONB is a replay and audit snapshot, not the authoritative
accepted Load data model. Stop, freight-line, and controlled multi-valued
special-handling requirements remain relational rather than embedded arrays
or generic metadata.

Use the existing exact `NUMERIC` precisions, UTC `timestamptz` instants,
UUIDv7 identities, controlled `TEXT` values with named checks, same-service
foreign keys, consecutive revision numbering, contiguous 1-based child
ordering, same-Load composite head reference, and database-enforced
revision immutability. The mutable Load head also stores the current
Load-owned fact `owner_revision`, independent of its Load revision and
lifecycle-transition sequence. Increment it once per published Load fact
and commit the counter and outbox row atomically; the initial
`load.booked` fact uses owner revision 1. Preserve the all-or-nothing booking
transaction and accepted follow-up salvage behavior. No cross-service
foreign keys are permitted.

This decision defines the logical field inventory, key integrity rules, and
initial indexes for Load and booking persistence; it does not define
production migration SQL, a physical ORM mapping, retention durations, or
the lifecycle schema for completion tasks, cancellation, inbox/outbox, and
other services. Retention remains disabled until the reviewed data-class
schedule is approved.

**Reason:** Explicit authority and typed relational revisions preserve
business integrity and planning reproducibility, while durable JSONB
snapshots make request retries and exact result retrieval reliable without
turning the Load into an opaque document.

### D-502 — Define Dispatch Planning and Capacity Commitment schemas

**Decision:** Define separate logical PostgreSQL schemas for Dispatch
Planning and Capacity Commitment in the
[technical workflow](TECHNICAL_WORKFLOW.md#dispatch-planning-and-capacity-commitment-relational-schemas).
Dispatch Planning persists exact-revision planning attempts, leases, the
owner-revision set evaluated, provider-neutral route and stop-service
estimates, evaluated preference outcomes, stable outcome reasons, durable
review tasks/events, immutable Trip Plan revisions and typed
membership/segment/resource children, and immutable per-Load Assignment
decisions with lifecycle history. A planning attempt records Load
revision/owner revision, policy version, source revisions and estimate
provenance. A review acknowledgement is receipt only; the review hold remains
until authorized disposition or recorded supersession.

Capacity Commitment persists each reservation as a versioned state head,
append-only transitions, and one resource-window claim per assigned
resource per segment. Claims use finite half-open `[start, end)` `tstzrange`
windows and a GiST exclusion constraint on resource type, resource ID, and
overlapping window for `HELD`/`CONFIRMED` claims. The constraint is
deferrable so a complete reservation replacement can atomically deactivate
the previous claim set and insert its replacement. `btree_gist` is required
for scalar equality operators. Claim-state changes, reservation state and
revision, and the corresponding outbox result commit together. Rejected
operations have no partial capacity effect.

Keep owner boundaries explicit: Dispatch Planning owns the plan and
Assignment decision; CC owns reservation state and capacity claims; Load and
Fleet Readiness facts remain external references. Preserve the existing
10-minute planning lease with two-minute renewal, 15-minute review
acknowledgement/escalation, five-minute CC hold, segment composition rules,
atomic replacement semantics, and active Assignment uniqueness. Never use
cross-service foreign keys. Index the documented lease, review, attempt,
plan, Assignment, reservation-recovery, and claim access paths; do not add
speculative candidate indexes before workload measurement.

This establishes a logical schema, not production migration SQL or
query-plan benchmarks. Exact operational acceptance scale, retention
durations, and implementation-specific index refinements remain open.

**Reason:** Durable planning inputs support deterministic audit and
recovery. Database-enforced resource-window exclusion makes concurrent
capacity decisions safe, while service ownership and immutable plan/decision
records preserve clear authority.

### D-503 — Define the Execution and evidence logical schema

**Decision:** Define the Execution-owned relational schema in the
[technical workflow](TECHNICAL_WORKFLOW.md#execution-and-evidence-relational-schema).
Persist shared Trip Executions and per-Load Executions separately, with
append-only lifecycle transitions, actual Trip/Load stop milestones and
outcomes, per-freight-line delivery counts, driver handoffs, incident
reports/corrections, private upload intents, clean-scan evidence records, and
immutable per-Load closeout facts with typed evidence, stop, and quantity
snapshots. Post-delivery and delivery-variance issues are minimal
Load-linked records owned by Load for capture and handoff; the receiving
out-of-scope service owns their follow-up lifecycle under D-512.

Delivered quantity is a non-negative integer count of the freight line's
handling units, represented and stored as `NUMERIC(12,0)`. Record the actual
count, including over-delivery; do not clamp it. At closeout, aggregate all
delivery-stop quantities against the exact committed Load revision and
record actual delivered, undelivered, and over-delivery quantities. Preserve
any variance in the closeout fact and create a minimal Load-linked issue for
handoff. A shortfall or overage does not block terminal closeout or require
an internal TMS case resolution.

Each closeout is unique to one Load Execution and immutable. It requires the
transportation attempt to end and final actual outcomes for its planned
stops. Each stop at which freight was unloaded requires clean available POD
evidence or an authorized reasoned evidence exception; a stop with no
delivery requires a final outcome and linked issue, not a fabricated POD.
Contractor and outer-Carrier POD requires dispatcher review; own-fleet POD
may satisfy the evidence gate on receipt. A dispatcher may record a
delivery statement when POD upload is unavailable, but must record that
exception basis and create a linked issue.
Closeout records actual delivered and undelivered quantities and actual stop
locations. A quantity variance or remaining freight creates an issue and
does not block terminal closeout. Publish the closeout fact through the
Execution-owned transactional outbox. Late evidence and report corrections
append history and do not rewrite the fact or reopen terminal lifecycle
states.

Presigned uploads remain private and expire after 30 minutes. Define the
selected 25 MB per-file maximum as 25,000,000 bytes, with at most 10 files
per delivery stop and only PDF, JPEG, or PNG. Verify stored size, type, and
SHA-256 before asynchronous malware scanning; create usable evidence only
after a clean scan. The upload-intent record stores the declared metadata
and private object key, never the presigned URL. Execution persists its own
scoped idempotency result transactionally with each accepted write. An
unfinalized intent has an internal `ISSUED` state; the public poll endpoint
does not expose it and returns `409 Conflict` until finalization or expiry.
Public poll states remain `SCANNING`, `AVAILABLE`, `REJECTED`, and `EXPIRED`.

This logical schema does not select an object-storage provider, signed
headers, malware-scanner implementation, retention/deletion schedule, or
final service-owned event payloads. Automated evidence deletion remains
disabled until reviewed retention rules are approved.
This decision resolves D-495's previously open logical-schema and quantity
representation questions; production evidence-retention controls remain
open.

**Reason:** Typed append-only facts retain the source evidence for movement
and delivery decisions. Exact integer handling-unit counts preserve the Load
contract, while immutable closeout and clean-scan gates prevent late changes
or unverified files from silently altering terminal business outcomes.

### D-504 — Approve a bounded platform-foundation phase

**Decision:** The first implementation phase is platform foundation, not a
business vertical slice. Its scope and measurable acceptance evidence are
defined in the [system blueprint](TMS_SYSTEM_BLUEPRINT.md#approved-platform-foundation-increment).
It establishes and verifies reproducible local infrastructure, isolated
service-owned PostgreSQL deployment patterns, durable RabbitMQ delivery,
Temporal persistence and worker recovery, NATS as secondary realtime
fan-out, service lifecycle behavior, and correlated observability. Conformance
components are test-only; this phase creates no empty business services,
dummy business records, product-facing business routes, or shared database
authority.

The phase is accepted only with documented, automated evidence for clean
bootstrap/build/test, dependency-aware readiness, graceful shutdown without
loss of acknowledged durable work, recovery across process and dependency
restarts, duplicate-safe durable delivery, Temporal workflow resumption,
deterministic failure injection with persisted-state assertions, backup and
restore procedure, and correlated logs/traces/metrics. Provider-specific
high-availability and disaster-recovery drills remain prerequisites for
production qualification.

Open business decisions are capability-scoped gates, not a blanket bar to
platform-foundation work. Detailed resource authorization and canonical
service contracts are required before protected business routes or message
flows; logical schemas and source-fact/policy definitions are required before
implementing their owning business capabilities; workflow-specific recovery
and acceptance scenarios are required before implementing those workflows.
The F0–F5 platform-foundation increment must be accepted before TMS
business-service implementation begins. After that foundation gate, business
capabilities proceed incrementally as their applicable gates close. The
business vertical slice remains proposed and unselected. This decision does
not approve the maximum TMS scope or production deployment. D-505 separately
defines product-wide operational acceptance.

**Reason:** Verifying shared runtime behavior first addresses the system's
architectural risks without forcing premature business policy or using an
incomplete workflow as a demonstration. Explicit phase gates allow unrelated
foundation work to advance while preserving the requirement that each
business capability be specified and tested before it is implemented.

### D-505 — Separate platform, capability, and product acceptance

**Decision:** Use three acceptance levels. D-504 owns platform-foundation
acceptance. Every business capability must define measurable scope-specific
acceptance before its implementation begins. Overall TMS operational
acceptance evaluates the coherent booked-Load-to-Execution-closeout target;
it does not require the undefined maximum scope or delivery of every
capability in one increment.

For the overall target, acceptance must demonstrate that acknowledged
business writes are not lost or duplicated; authoritative state and
cross-service references remain owner-correct and auditable; each accepted
Load reaches a correct terminal outcome or remains visibly pending with an
actionable recovery path; and nominal plus deterministic failure scenarios
complete without silent failure or a success-shaped fallback. Apply the
selected internal service availability target of 99.5% monthly, RPO 0 for
acknowledged bookings, and RTO at most four hours for critical TMS service
restoration. Prove RPO/RTO through restore drills, not unit tests. Product
owners may add operational measures as their definitions and evidence
sources are approved.

**Reason:** Separating acceptance prevents an infrastructure milestone from
being mistaken for business readiness while avoiding an all-at-once scope
gate or an arbitrary customer-showcase threshold.

### D-506 — Enforce default-deny, domain-owned resource authorization

**Decision:** Every protected business operation is denied unless the
requesting human or workload identity is authenticated and explicitly
authorized. Identity establishes the principal, session, and role grants;
the service that owns a business record authorizes its action and transition.
Authorization combines the granted role with applicable area, resource,
relationship, assignment, and lifecycle scope. A role grant alone never
confers access to every record or transition in that role's nominal domain.

Use explicit, time-bounded delegation and supervisory coverage recorded
against the granting authority; delegation cannot exceed the grantor's
authority and is audited. Enforce separation of duties where selected,
including distinct people for privileged-grant initiation/approval and
prohibition of self-approval for designated review decisions. Technical
operators may inspect and prepare recovery but cannot approve business-state
replay. Each service's action-to-role/resource matrix is a required input
before implementing its protected writes or production authorization policy.
Unauthenticated health/readiness operations remain limited to their documented
operational purpose.

**Reason:** Default-deny and owner-enforced resource checks prevent role
labels or cross-service convenience from becoming implicit business
authority.

### D-507 — Define logical schemas for target service owners

**Decision:** The logical schemas for Counterparty Registry, Fleet Readiness,
Load completion/cancellation, Load charge/cost proposals and operational
claims, Identity, Notification, Operations View, and service-owned inbox,
outbox, and idempotency records are defined in the
[technical workflow](TECHNICAL_WORKFLOW.md#logical-record-families-by-owner).
Use PostgreSQL, UUIDv7 identities, service-local foreign keys, named
constraints, append-only transition/evidence history where required, and
stable cross-service IDs without cross-database foreign keys. Follow the
existing immutable-revision, owner-revision, transactional-outbox, inbox
deduplication, and operation-scoped idempotency conventions. Use typed
owner-specific tables; do not introduce a shared database or generic
entity/attribute store.

These are logical contracts for engineering and review, not production DDL
or ORM mappings. Concrete SQL migrations, migration-runner code,
workload-measured index refinements, data retention implementation, and
provider-specific operations are completed and verified with the owning
service implementation. Do not treat an unfinished schema for one owner as
a blocker to unrelated platform work.

**Reason:** A complete logical record boundary makes service ownership and
consistency constraints explicit without prematurely binding the project to
physical implementation details.

### D-508 — Publish canonical service-owned API and message contracts

**Decision:** Keep `docs/contracts.md` as the shared semantic and
cross-service contract guide. Each HTTP-owning service publishes one
service-owned OpenAPI 3.1 specification under `docs/api/`; each durable
message-owning service publishes its channels and versioned payloads in an
AsyncAPI 3.0 specification under `docs/api/`. Those specifications are the
canonical executable contract for their respective boundary. Validate
requests and messages at runtime and validate compatibility in CI.
Current artifacts and their partial coverage are catalogued in the
[API specification index](../api/README.md); publication alone does not close
the remaining route, message, or operation-specific contracts.

Complete the specifications and operation-specific outcomes required by a
capability before implementing that capability's protected API or durable
message flow. Do not require every future service's complete specification
before platform foundation or an unrelated capability can proceed. A
semantic rule is not open merely because its canonical machine-readable
representation has not yet been published; track the artifact as an
implementation prerequisite separately.

**Reason:** Service-owned specifications prevent semantic prose, generated
types, and runtime behavior from drifting while keeping the implementation
sequence dependency-scoped.

### D-509 — Fail closed on unverified planning inputs

**Decision:** Dispatch Planning may use only versioned owner facts with
recorded source, observation time, verifier/owner, and applicable validity
information. Missing, stale, invalid, or unverified facts required by a hard
gate make the candidate ineligible; do not infer approval from an aggregate
flag or stale projection. Fleet Readiness owns the planning-critical
readiness and eligibility fact catalogue and its evidence/validity rules.
Legal or safety gates require authoritative sources and qualified review
before activation.

Route estimates use a provider-neutral adapter and immutable estimate
provenance. Before Dispatch Planning is enabled, select and document one
approved initial route-estimate source and the versioned service-time
assumptions; do not silently switch providers or substitute an unqualified
estimate. Preserve source/version, requested route inputs, estimate time,
distance, duration, and any applied service-time policy in each planning
attempt. Source selection and calibration require documented evidence and
owner approval.

**Reason:** Explicit fact freshness, provenance, and fail-closed gates
preserve explainable planning decisions without mistaking the existence of a
data feed for authoritative evidence.

### D-510 — Require owner-correct forward recovery and verified outcomes

**Decision:** Business writes that publish durable facts commit owner state,
the transactional outbox, and their idempotency outcome atomically.
Consumers durably persist inbox identity before acknowledging delivery and
deduplicate by sender and command identity. Retry transient failures only
under the selected bounded policy; park exhausted or permanently invalid
work with inspectable reasons. Reconcile revision gaps from an authoritative
owner snapshot before applying later revisions. Business-state replay is
unchanged, audited, and requires approval by the owning domain distinct from
the technical operator. After a confirmed external commitment, recover
forward and reconcile before attempting compensation.

Before implementing each business workflow, define its failure boundaries,
owner-specific recovery and reconciliation behavior, measurable acceptance
cases, and persisted-state assertions. Verify nominal and deterministic
failure paths against disposable real dependencies. D-504 remains the
separate foundation acceptance baseline; backup/restore drills prove the
selected RPO/RTO before production qualification.

**Reason:** Durable owner state and explicit recovery authority prevent
transport retries, workflow restarts, or operator intervention from
silently changing business outcomes.

### D-511 — Bound rolling Load reservations and dispatcher re-ranking

**Decision:** Dispatch Planning uses a rolling reservation horizon limited by
both of these conditions: a pickup must fall within 14 days of the planning
time, and a trio may have no more than five future Load reservations in its
sequential chain. A new slot opens only after the earliest reserved Load has
been assigned and Execution has recorded its actual pickup. Loads booked for
later dates are not immediately reserved or ranked for a trio whose horizon
or five-Load limit is full.

The four composable policy profiles are outbound/return-home crossed with
short/long duration. Use the existing `SHORT`, `LONG`, `OUTBOUND`, and
`RETURN_HOME` classifications, subject to their authoritative inputs and
limitations. Outbound planning must account for concentrated home-area
capacity and competition by ranking the best available trios and drivers.
Short outbound work supports rapid western and west-central trips and
roundtrips, with their greater stop frequency. Return-home planning reflects
scarcer eastbound trios and may collect and compare suitable Loads over the
available horizon before routing unsuitable work to a Contractor or outside
Carrier. Long-trip feasibility includes the required rest-place capability.
These profiles do not relax any hard eligibility, safety, schedule, or
capacity gate.

Dispatcher Load ranking is distinct from D-499's automated ranking of
feasible resource candidates. A newly eligible booked Load within the
planning horizon creates ranking opportunities for dispatchers managing
feasible trios, and the responsible dispatchers are notified. A dispatcher
may rank eligible booked Loads for their
managed trio, including while that trio has a reserved chain, but only the
final Load in the chain may be re-ranked. With four future reservations, the
fifth Load is the only next position available for ranking and reservation;
no sixth Load may be ranked or reserved while the five-Load limit is full.

Planning first uses currently unassigned feasible capacity to maximize
coverage of booked Loads. It may then improve the rolling schedule using
explicit dispatcher rankings and the complete affected chain. A reallocation is automatic only
when the ranked alternative is feasible and the complete replan preserves
other valid Load coverage and all hard gates. If the system identifies a
material company-benefit Load that the dispatcher did not rank, it may
invite the dispatcher to accept it; declining or not responding preserves
the current reservation.

Same-day Loads do not wait for ranking. For next-day Loads booked by 14:00
local time in `America/Los_Angeles`, accept rankings until 16:00 local time
and then plan. A later booking may wait until the next normal planning cycle
only when that delay preserves a feasible plan; otherwise planning proceeds
immediately without waiting for ranking.

When a Load in a reserved chain is canceled or becomes infeasible, review
the affected suffix immediately and preserve the valid prefix. First try
replacing the affected Load with a booked, unreserved Load having matching
pickup and delivery areas within the approved deadhead allowance. If no
replacement preserves feasibility, release the affected future tail and
return the trio's resulting capacity to planning. Never release completed
or in-progress work as part of this recovery.

When a Trip or per-Load Execution ends earlier than planned, use its
authoritative actual closeout location to immediately revalidate the
unstarted reservation suffix and replan the available trio from that
location, minimizing feasible deadhead. Preserve suffix Loads that remain
feasible; apply the replacement/release rule above to the first infeasible
Load and its affected tail. Do not wait for the next ranking cycle. A
missing/stale resource fact or remaining freight does not establish that the
trio is available; require current owner facts before assigning new work.
Customer pricing, responsibility, and commercial resolution remain with
the broker and are not inferred by Dispatch Planning.

The five-Load/14-day chain is a planning policy, not the five-minute
Capacity Commitment `HELD` lease. CC continues to reserve complete resource
windows atomically. The numeric deadhead allowance and validated
route/service-time inputs remain prerequisites to enabling automatic
replacement and planning.

**Reason:** A bounded rolling chain limits disruption when a future Load
fails, while dispatcher rankings preserve team preferences and free capacity
is used first to maximize feasible Load coverage.

### D-512 — Close transportation records and hand off minimal issue records

**Decision:** Execution and Load lifecycle completion records the end of the
transportation attempt, not a guarantee of full delivery, customer
satisfaction, or commercial settlement. After the final attempted delivery,
both the per-Load Execution and Load become `COMPLETED`, whether all freight
for that Load was unloaded or freight remains on the equipment. Record actual
delivered and undelivered quantities, final actual locations, and evidence
in the immutable Execution closeout fact. Completion is evaluated per Load's
freight, not by whether shared equipment is physically empty.

For normal closeout, each stop at which freight was unloaded requires
clean, `AVAILABLE` POD evidence. A stop with no delivery requires a final
actual outcome and linked issue, not a fabricated POD. Receipt is sufficient
for an own-fleet POD; a contractor or outer-Carrier POD requires dispatcher
review. When POD upload is unavailable, an authorized dispatcher may enter
the delivery statement and closeout basis, explicitly marking the evidence
exception and creating a linked issue. Such a statement is not represented
as a received or verified POD.
These rules do not make a Load's `COMPLETED` status a commercial
determination about disputed locations, shortages, or remaining freight.

The Load service retains only a minimal issue record linked to the Load and
its handoff status. It sends the issue record, not the detailed Load record
or a full Load snapshot, to the responsible out-of-scope service. The
receiving service owns issue assignment, status, and resolution. TMS does
not operate an internal post-delivery claim lifecycle. Issue types,
type-specific fields, receiving-service routing, and the exact message
contracts remain to be defined; no such issue may delay or reverse terminal
Load or Execution status.

This decision supersedes D-127 through D-130 and D-156 through D-163, which
assigned post-delivery issue ownership and resolution to an internal TMS
case lifecycle. It clarifies D-495 and D-503: quantity variance, incomplete
delivery, or remaining freight is recorded and handed off, not held open as
a Load/Execution lifecycle or used to block closeout.

**Reason:** Terminal transportation records preserve an accurate,
immutable account of the attempt, while issue-specific services handle
customer, carrier, technical, or other follow-up without receiving unrelated
Load detail or expanding TMS into claims or settlement management.

## Record maintenance

When a decision changes, update this entry and the owning document together.
Record the superseding decision and rationale rather than silently replacing
the earlier history. Use an individual architecture decision record when a
choice needs alternatives, consequences, or implementation-specific detail.
