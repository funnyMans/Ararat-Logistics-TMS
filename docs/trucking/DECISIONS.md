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
Develop its business model and MVP from owner direction and recorded
operational evidence. The reference scale and operating areas are current
design assumptions, not product limits.

**Reason:** Product ownership must be explicit while distinguishing owner
decisions from claims validated by customers, operations, or law.

### D-02 — Separate the broker's commercial decision from capacity approval

**Decision:** The handling broker alone decides whether to clarify, book, or
decline an offer. Booking does not require a supervisor's capacity approval
and does not itself secure capacity.

**Reason:** The commercial commitment and the operational capacity decision
are distinct responsibilities and records.

### D-03 — Define the whole target before selecting a small implementation

**Decision:** Establish and approve the complete TMS scope, domain ownership
and relationships, system boundaries, infrastructure shape, internal
contracts, role responsibilities, and failure boundaries before
implementation. Define detailed role procedures and permission enforcement
after the domain boundaries and contracts are stable. This does not require
implementing every approved capability at once.

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
different operational policies. Exact profile thresholds and policy
parameters remain open.

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

### D-11 — Complete TMS documentation before implementation

**Decision:** Do not begin implementation of TMS capabilities until the TMS
business scope, domain model, architecture, internal contracts, role
responsibilities, MVP scope, and verification requirements are documented
consistently and approved. Product implementation begins only from that
settled baseline.

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

**Decision:** The TMS tracks post-delivery claims, including damage,
shortage, loss, and customer/carrier disputes, as cases linked to the
relevant Load and, where applicable, Execution. Cases record an accountable
owner, supporting evidence, status, and resolution. Claim tracking does not
include invoicing, payment, or settlement. The accountable department and
detailed lifecycle remain to be defined.

**Reason:** A bounded operational case record preserves follow-through and
evidence after delivery without expanding the TMS into a financial system.

### D-128 — Assign a designated owner to each post-delivery claim

**Decision:** Each post-delivery claim case has a designated owner who is
accountable for coordinating it through resolution, regardless of the
owner's department. This establishes case accountability, not a new
department or role grant; permitted actions and escalation remain to be
defined.

**Reason:** A named case owner prevents cross-functional claims from becoming
unowned while allowing the company to assign responsibility flexibly.

### D-129 — Reuse the established case lifecycle for post-delivery claims

**Decision:** Post-delivery claim cases use the established `OPEN`,
`IN_PROGRESS`, and `RESOLVED` lifecycle. Reopening a resolved claim requires
a reason and an audited transition. Claim-specific actions, outcomes, and
escalation remain to be defined.

**Reason:** A shared lifecycle keeps operational case handling consistent
without forcing claims into the Execution exception workflow or data store.

### D-130 — Limit claim cases to operational follow-up and referral

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

**Decision:** A post-delivery claim case may be marked `RESOLVED` when its
operational follow-up is complete or when its referral outside the TMS is
documented. The TMS does not track the referred claim through the external
party's completion. Closure outcomes are defined by D-157; referral details
are defined by D-158.

**Reason:** Documented referral provides an auditable handoff without
extending the TMS into external insurance or legal claim management.

### D-157 — Record controlled claim closure outcomes

**Decision:** Claim closure records one of `OPERATIONALLY_RESOLVED`,
`DENIED`, `WITHDRAWN`, `DUPLICATE`, or `REFERRED_OUTSIDE_TMS`, with a
required reason. `DENIED` is an internal operational disposition only; it
does not assert legal liability or an insurer's claim decision.

**Reason:** Controlled outcomes support consistent reporting while keeping
legal and insurance determinations outside the TMS.

### D-158 — Record claim referral details

**Decision:** A referred claim records the referral destination and date/time,
any available external reference, and supporting evidence. Recording these
details documents the handoff; it does not create or track an external claim
workflow.

**Reason:** A concise referral record provides auditable evidence of handoff
while keeping external claim handling outside the TMS.

### D-159 — Let the designated claim owner resolve the case

**Decision:** The designated owner may transition a claim case to `RESOLVED`
after recording a permitted closure outcome and required reason. Audit all
outcome and state transitions; no blanket supervisor approval is required.

**Reason:** The accountable owner can complete the operational handoff while
preserving reviewable decision history without adding routine supervisory
approval.

### D-160 — Assign claim owners through the Load's area supervisor

**Decision:** The Load's area supervisor assigns and may reassign the
designated owner of a post-delivery claim from eligible staff. Escalation
rules remain open.

**Reason:** Supervisory assignment establishes clear accountability while
allowing the case owner to be selected from the function best suited to
coordinate the specific claim.

### D-161 — Require explicit claim-owner permission

**Decision:** An area supervisor may assign a post-delivery claim to any staff
member with explicit claim-owner permission, regardless of department.

**Reason:** This enables cross-functional ownership without granting claim
authority through department membership alone or creating a dedicated claims
role.

### D-162 — Escalate claim cases through the Load's area supervisor

**Decision:** When the claim owner needs a decision or cannot progress the
case, escalation goes first to the Load's area supervisor. The supervisor may
escalate further through the supervisory chain.

**Reason:** The area supervisor remains accountable for the Load's operational
outcome while retaining the existing supervisory path for issues beyond that
authority.

### D-163 — Make claim escalation owner-initiated

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

## Record maintenance

When a decision changes, update this entry and the owning document together.
Record the superseding decision and rationale rather than silently replacing
the earlier history. Use an individual architecture decision record when a
choice needs alternatives, consequences, or implementation-specific detail.
