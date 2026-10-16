# TMS technical workflow

This page records cross-service invariants for the target workflow, not an
approved API, database schema, or implementation plan. The
[system blueprint](TMS_SYSTEM_BLUEPRINT.md) owns target architecture;
[service contracts](../contracts.md) owns shared transport guidance; and
[open decisions](OPEN_QUESTIONS.md) lists unresolved protocols.

## Ownership and lifecycle

The target workflow keeps business state in its owning boundary:

1. **Load** owns commercial bookings, completeness at each required stage,
   ordered requested stops, immutable requirement revisions, and missing-
   information tasks.
2. **Counterparty Registry** owns separate Customer and Carrier master
   records, lifecycle status, external references, and organization-level
   contacts. It does not own Load terms, carrier qualification, capacity, or
   execution.
3. **Fleet Readiness** owns driver/equipment operational records and
   manually maintained availability/readiness facts. It excludes HR,
   payroll, maintenance, and compliance case management.
4. **Dispatch Planning** owns planning attempts and expiring per-Load planning
   leases, versioned Trip Plans, and immutable per-Load Assignment decisions.
5. **Capacity Commitment (CC)** owns atomic reservations for the complete
   resource/time-window set of a Trip Plan revision and authoritative
   reservation expiry. It does not own Load-planning leases.
6. **Execution** owns planned and actual Trip Execution, per-Load execution,
   actual stop milestones, remarks, exceptions, evidence metadata,
   completion, and corrections.
7. **Notification** owns user-facing notification and delivery state; it
   surfaces actionable work but does not own the underlying business fact.
8. **Identity** owns authentication-focused principals, credentials,
   sessions, role grants, and signed identity context; it does not own
   operational profiles or domain permissions.
9. **Operations View** owns read-only projections for operational screens.
   It consumes versioned owner facts, reports projection freshness, and
   cannot authorize or commit business changes.

These are peer service boundaries. A shared planning identifier may
correlate related records, but each owner retains its own record identity,
database, and state transitions.

## Load lifecycle and revision model

Load keeps a mutable head record for its current lifecycle status and current
revision pointer. A successful booking creates a `BOOKED` Load. Its status
remains `BOOKED` while Dispatch Planning, Assignment, and Execution progress;
those domains retain their own authoritative states. A pre-execution
cancellation changes Load to `CANCELLATION_PENDING`, then to `CANCELLED`
only after the required downstream releases. An accepted cancellation
cannot be withdrawn. After Execution confirms closeout, Load consumes that
authoritative fact and sets its summary status to `COMPLETED`; Load does not
independently decide whether execution is complete.

Each immutable `load_revision` has a UUID ID and a monotonically increasing
`revisionNumber`, unique per Load. Every revision is a full snapshot.
Revision-owned stops and freight rows reference the revision ID, preserving
the exact requirements used by planning and execution. Each stop has an ID
scoped to that revision; Execution milestones and delivery evidence refer to
that exact stop, while a later amended revision receives new stop IDs.
Current lifecycle status is not copied into planning, Assignment, or
Execution records as authoritative state; Operations View combines the
owner facts.
Every approved Load amendment submits a complete next-revision snapshot;
Load validates it before creating a new revision. Amendments are
permitted before actual execution starts; after active Assignment, they
require revalidation before further automated progression. Once execution
starts, changes to the Load commitment use the Execution
operational-exception workflow rather than amending its requirements.
Amendments use `If-Match` with the current revision ETag; a stale ETag
returns `412 Precondition Failed` without creating a revision. A conflict
with an active Load finalization guard returns a retryable `409 Conflict`.

Persist customer-rate amounts as exact `NUMERIC(19,4)` values with an ISO
4217 currency code, enforcing that currency's allowed fractional scale.
Public API amounts remain decimal strings; do not use binary floating-point
for money. Persist positive freight quantities as exact `NUMERIC(12,3)`
values and enforce the controlled handling-unit code at validation. When
provided, total gross weight is a positive `NUMERIC(12,3)` value with a
controlled `LB` or `KG` unit; it remains optional at booking and is required
before planning.

## Counterparty record baseline

Counterparty Registry owns separate Customer and Carrier master records.
One legal organization may have both a Customer profile and a Carrier
profile under a shared Counterparty identity; each profile has its own
identifier, status, and lifecycle. A legal name is required; display name,
external business reference, and organization-level contact records are
optional. Carrier USDOT and MC identifiers may be recorded when applicable,
with verification status and source; tax identifiers are deferred until
financial/compliance scope and retention controls are approved.

Both record types use `PENDING`, `ACTIVE`, `SUSPENDED`, and `CLOSED` states.
Load booking requires an `ACTIVE` Customer. An `ACTIVE` Carrier record does
not establish qualification or capacity availability. Counterparty status
changes do not rewrite Load history; each Load revision retains its Customer
ID and a name snapshot. Cross-service references use stable IDs and
versioned facts, not foreign keys. Suspension blocks new bookings against
that Customer and new planning/Assignment against that Carrier. Existing
Loads, reservations, Assignments, and execution history are preserved for
explicit review; suspension never auto-cancels or deletes them.

## Fleet readiness baseline

Fleet Readiness owns the operational records needed to establish in-house
and contracted driver/equipment readiness and availability for planning.
Contracted drivers and equipment reference their Carrier profile; Identity
stores only the associated principal and authentication data. Fleet
Readiness does not own employment/HR, payroll, maintenance, or compliance
case management.
Driver profiles use `PENDING`, `ACTIVE`, `SUSPENDED`, and `CLOSED` states.
Only `ACTIVE` profiles may be considered for new Assignments, subject to
current readiness and qualification gates. Suspension or closure preserves
existing assignments and execution history for explicit review; it does not
automatically cancel or remove active work.
An in-house driver is linked to the company's fleet group. A contracted
driver must link to an `ACTIVE` Carrier profile, and the relationship must
be verified by an authorized `contract_capacity_dispatcher` before the
driver is eligible for planning. Retain the evidence source/reference,
verifier principal, and verification time with the relationship record.
Fleet Readiness may store verified, planning-critical safety and contractual
eligibility facts and enforce approved hard gates. It does not interpret
legal or regulatory requirements, provide regulatory reporting, or manage
safety cases. Specific facts, evidence, owners, and rules require authoritative
sources and qualified review before they become product policy.

Initially, fleet dispatchers maintain equipment and availability/readiness
facts in the TMS, and drivers may report their own factual status. Facts
retain source, observed time, and owner revision. Missing or stale hard-gate
facts are treated as unknown/ineligible, never as approval. Driver and
equipment availability is planning-current for 15 minutes after observation.
Qualification and equipment-compatibility facts remain current until their
recorded expiry, if any, or a superseding owner revision.
Verified equipment maintenance status may act only as a readiness or
availability blocker. Fleet Readiness does not own maintenance records or
work-order management. Fleet dispatchers record and verify status for
in-house equipment; contract capacity dispatchers do so for contracted
equipment. The status is `CLEAR` or `BLOCKED`, with a reason, evidence
source/reference, verifier principal, observed time, and valid-through time.
`BLOCKED` prevents planning; `CLEAR` removes only the maintenance blocker and
does not establish overall readiness. Every status has an explicit validity
deadline, using the evidence's valid-through date when available or a finite
dispatcher-set deadline otherwise. Missing or expired status is unknown and
blocks planning. The evidence reference identifies a verified maintenance
record or inspection; attach a supporting document when one exists, but do
not require an attachment when no document exists.
Represent availability as versioned, time-bounded facts with resource ID,
`AVAILABLE`/`UNAVAILABLE` state, `validFrom`, `validTo`, `observedAt`,
source, and owner revision. Missing or expired availability is `UNKNOWN`;
do not store it as a durable `ready` boolean.

## Booking intake and response

1. The API gateway receives `POST /api/v1/booking-submissions`, applies edge
   authentication and transport-level checks, and routes it to Load. It does
   not decide whether a row is a valid booking or write Load data.
2. Brokers submit a multi-row booking through either an in-app form or a
   spreadsheet upload. Each interface validates its own input format, then
   submits the same normalized booking command to Load for authoritative
   business validation. One row represents one Load.
   The proposed booking-critical minimum is a confirmed Customer, accepted
   commercial terms, pickup and delivery locations/windows, and freight
   description and quantity. Confirm exact fields and rules before
   implementation.
3. A client supplies an `Idempotency-Key`; Load assigns a UUID
   `submissionId`. A well-formed attempt is durably recorded whether accepted
   or rejected. A booking-critical error in any row rejects the full batch,
   records its normalized input and row/field issues, and creates no Loads.
   An identical retry returns the same result; reusing the key with changed
   normalized content returns `409 Conflict`. A correction is a new
   submission linked to the rejected attempt. An accepted Load is changed
   through its amendment workflow, not resubmitted as a new booking.
   Each submission is limited to 100 rows and 5 MB of normalized JSON; an
   oversized request returns `413` and creates no submission.
4. When all rows pass booking-critical validation, Load atomically commits
   the accepted submission outcome, one Load and initial immutable revision
   per row, and outbox entries for subsequent planning. The first durable
   result returns `201 Created`; an identical retry returns `200 OK`. The
   gateway relays Load's immediate response with Load references and
   non-blocking follow-up items. It does not claim capacity is reserved or
   work is assigned. `GET /api/v1/booking-submissions/{submissionId}`
   retrieves the same durable result.
   A Temporal outage does not block this response once Load has committed
   the submission, Load/revision records, and outbox. Planning remains
   queued for recovery; do not claim an Assignment until Dispatch Planning
   confirms it. If Load cannot durably commit, return failure rather than
   success.
5. Stage-specific completeness is evaluated independently. Missing
   planning-stage information may leave a valid booking in a planning hold.
   Invalid secondary input is not authoritative data; Load records its
   unresolved completion task and reason. Notification only surfaces the
   task. Load completeness does not imply Dispatch Planning feasibility.
6. Once a booking transaction commits, each Load proceeds independently.
   One Load's planning or execution exception does not block sibling Loads
   from the same submitted batch.

## Initial Load data contract

The following field groups are agreed for the first booking and planning
baseline. They define business requirements, not final SQL column names or
the complete request schema.

- A row references a confirmed `customerId`. `customerReference` is optional
  and searchable; a possible duplicate is a broker warning, not a uniqueness
  constraint or an automatic merge.
- Each Load has one positive total `customerRate`. The API represents money
  as an exact decimal string and an ISO 4217 currency code. The initial
  customer-rate currency is USD only, with at most two decimal places; the
  TMS performs no currency conversion. The initial model records one total
  rate, not billing or accessorial line items.
- A Load has an ordered list of one or more `PICKUP` and one or more
  `DELIVERY` stops, with at most 50 stops per Load. The types may interleave;
  Dispatch Planning evaluates route feasibility. Each stop stores a
  structured US address snapshot:
  required address line 1, city, two-letter USPS state code, and postal code;
  country is `US` for the initial domestic scope. Address line 2, facility
  name, and coordinates are optional. Each stop requires start/end
  appointment timestamps with explicit RFC 3339 offsets and an IANA time
  zone; start must precede end. Facility name, contact name/phone, and access
  instructions are optional, retained on the Load revision, and may become
  later-stage completeness requirements.
- Each Load has at least one and at most 500 freight lines. Each line has a
  description, positive quantity represented as a decimal string with at most
  three fractional digits, and a controlled
  handling-unit code: `PALLET`, `SKID`, `CASE`, `CARTON`, `BOX`, `PIECE`,
  `CRATE`, `DRUM`, `BAG`, `ROLL`, `CONTAINER`, or `OTHER`. `OTHER` requires
  a short unit description. A Load's total gross weight is required before
  planning, not booking, and uses explicit `LB` or `KG`.
- The initial supported equipment profiles are dry van, reefer, and flatbed.
  An equipment profile is required before planning but not at booking; if
  absent, keep the Load booked and place it on a planning hold without
  defaulting to dry van.
  Reefer Loads require minimum and maximum temperatures stored as signed
  `NUMERIC(5,2)` values with one shared `F` or `C` unit before planning;
  minimum must not exceed maximum. If reefer operating mode is omitted,
  default to `CONTINUOUS`; record the default and show a non-blocking broker
  follow-up so it can be confirmed or corrected. Flatbed Loads require
  positive length, width, and height for each freight line as
  `NUMERIC(10,2)` values with one shared `IN` or `CM` unit, plus an explicit
  tarp-required yes/no, before planning. Missing planning facts hold a
  booked Load from planning.
- Step-deck and oversize capability are later-phase work; tanker and
  hazardous-material capability follow after that. A broker may still record
  a commercial booking that needs a not-yet-supported profile, but it remains
  visibly held and cannot be automatically planned, assigned, or executed
  until the required capability is approved and available.

## Planning, reservation, and Assignment

An accepted manual Carrier tender records the Carrier's response only; it
does not create a reservation or Assignment. Capacity is protected only
after the Load passes the normal Dispatch Planning and Capacity Commitment
finalization workflow.
Each tender has an explicit response deadline and expires unanswered; a
response after expiry cannot accept that tender. The default deadline is one
hour after sending and is editable per tender by the
`contract_capacity_dispatcher`. Notify the responsible
`contract_capacity_dispatcher` immediately on each Carrier counteroffer,
acceptance, rejection, or expiry; send no pre-deadline reminders. Carrier and
dispatcher may exchange any number of counteroffers. Each new offer or
counteroffer starts a response period with a one-hour default deadline,
editable per tender. The responsible dispatcher may accept a Carrier
counteroffer without blanket supervisor approval. Record each offer,
counteroffer, response, rate, currency, and deadline against its tender round;
offers and counteroffers may change only rate and currency. Load scope or
operating requirement changes use the normal Load amendment and replanning
process. If either party misses a round deadline, the entire tender expires;
a late response cannot reopen it. The dispatcher cannot withdraw an open
tender, which remains active until acceptance, rejection, or expiry. Load cancellation automatically
cancels its open tenders, notifies the responsible dispatcher, and preserves
negotiation history. The dispatcher communicates tenders, counteroffers, and
Load-cancellation notices through the existing external channel and records
sent offers and Carrier responses in the TMS; the TMS does not deliver these
messages or provide a Carrier portal. Each round may include an external
message reference or supporting attachment; do not store copied external
message bodies. Carrier acceptance still does not reserve capacity.
Each tender has one fixed rate basis: `FLAT_PER_LOAD`, `PER_MILE`,
`PER_KILOMETER`, `PER_HOUR`, `PER_STOP`, or `OTHER` with an explanation.
`FLAT_PER_LOAD` is the indicative total. For standard unit bases, calculate
the indicative total from the selected Trip Plan revision's planned distance,
duration, or stop count and retain the quantity and revision used. Before a
Trip Plan exists, show the unit rate for these bases without a calculated
total. A later plan revision recalculates the current estimate while
preserving prior estimates. `OTHER` has no calculated total. Tender rates
use USD only in the initial scope, with at most two decimal places; the TMS
does not perform currency conversion, and each rate must be greater than
USD 0.00. Calculated indicative totals round half up to the nearest USD cent.
Exact tender payload remains open.

1. Temporal coordinates the durable workflow. RabbitMQ carries durable
   commands and business facts. Temporal progress is orchestration state,
   not a source of business truth.
2. Dispatch Planning consumes versioned owner events into local planning
   projections. It performs an initial evaluation when a Load becomes
   planning-ready, replans on relevant Load or capacity changes, and uses
   durable timers for freshness expiry and approaching operational deadlines.
   Freshness rules belong to the owner of each fact; facts retain source,
   observed time, recorded time, and owner revision. It also consumes
   Counterparty and Fleet Readiness projections; no synchronous service call
   supplies a planning decision.
3. Dispatch Planning obtains its own persisted, expiring Load-planning lease.
   Its TTL is 10 minutes, renewed every two minutes only during an active
   automated attempt. Release it at completion and before human review;
   expiry makes the attempt stale and eligible for replanning.
   A Trip Plan groups one or more Loads and is divided into ordered resource
   segments. Each segment covers a contiguous route section and contains
   exactly one power unit, one matching trailer, and one or two drivers.
   Any segment boundary that changes the assigned resource set must be an
   explicit planned stop or handoff location. A Load may have at most one
   active Trip Plan
   Assignment at a time, while a Trip Plan may include multiple Loads. A Trip
   Plan revision is immutable; each Load's requirements and requested
   ordered stops are owned by Load in immutable revisions.
   A feasible plan must provide continuous segment coverage, avoid
   overlapping reservations for any resource, meet equipment compatibility
   requirements, allow sufficient resource repositioning time, and satisfy
   driver availability and qualification checks. Missing or stale readiness
   facts block planning; they must not be treated as evidence of eligibility.
4. If no eligible capacity exists, keep the Load booked and unassigned.
   Replan on relevant changes or scheduled freshness/deadline checks; do not
   continuously poll without new information. As a pickup deadline
   approaches or passes, escalate for human action. Do not automatically
   cancel a booked commitment.
5. CC atomically reserves the complete resource/time-window set across every
   segment of a Trip Plan revision or reserves none. Reservation states are
   `HELD`, `CONFIRMED`, `RELEASED`, `EXPIRED`, and `SUPERSEDED`; only `HELD`
   and `CONFIRMED` claims block capacity. CC persists and enforces expiry
   independently of Temporal. A temporary `HELD` reservation lasts five
   minutes. The request identifies the Trip Plan and revision and carries
   every ordered segment's start/end stop IDs, UTC time window, power-unit
   and trailer IDs, one or two driver IDs, and expected Fleet Readiness owner
   revisions for those resources. A successful response identifies the
   single reservation and its expiry; a rejected request leaves no partial
   claims.
   Replacing an active reservation for a
   revised plan is atomic; if replacement is rejected, retain the existing
   reservation.
6. After CC has acquired the temporary hold, Load provides a short-lived
   finalization guard for the exact Load revision. The guard lasts two
   minutes and may be renewed once. A conflicting material
   edit receives a retryable conflict. A change before finalization
   invalidates the affected planning attempt and requires planning against
   the new revision.
7. Dispatch Planning records pending Assignment decisions tied to exact Load
   and Trip Plan revisions. After Load finalization guards pass, CC changes
   the hold from `HELD` to `CONFIRMED` immediately before Dispatch commits
   the active Assignment. If finalization fails, release the hold; if
   Assignment activation is interrupted, preserve the confirmed reservation
   and pending decision and recover against that same reservation.
   Reassignment creates a new immutable Assignment decision linked to the
   one it supersedes; it does not overwrite history. The active Assignment
   identifies the Load/revision, Trip Plan/revision, assigned segment
   resources, and reservation. Execution creates planned Trip and per-Load
   records idempotently by Assignment ID. If that handoff fails, preserve
   the Assignment for visible recovery and do not report active Execution
   until Execution confirms its records.
8. If a hard gate fails for one Load in a multi-Load Trip Plan, remove that
   Load and revalidate the revised plan. Retain other Loads only if the
   revised plan remains feasible; otherwise release affected holds and
   replan. A Load material change after active Assignment preserves the last
   confirmed decision as history, marks revalidation required, and blocks
   further automated progression until revalidation or authorized
   resolution.

## Cancellation and downstream release

Before actual execution starts, a broker may request cancellation of a Load.
Load records the request as `CANCELLATION_PENDING` and immediately blocks new
planning or progression. If no active Dispatch Planning attempt/lease,
Assignment, CC reservation, or planned Execution record exists, Load may
move directly to `CANCELLED`. The Load lifecycle status and the
cancellation-request resource state are separate records.
Otherwise, a durable workflow coordinates release with Dispatch Planning
and CC, plus Execution when a planned execution record exists. Dispatch
Planning confirms that the cancelled Load's planning work and Assignment
are released. CC confirms that this Load's claims are removed, either through
atomic replacement of the remaining segment reservation or full release.
Execution confirms that the affected not-yet-started per-Load Execution is
removed or voided. If the Load belongs to a multi-Load Trip Plan, Dispatch
Planning revalidates the remaining Loads and CC atomically replaces the
segment reservation. Retain the remaining Loads only if the revised plan
remains feasible; otherwise release affected claims and replan. Load becomes
`CANCELLED` only after all applicable confirmations are recorded. A timeout,
failed command, or missing confirmation leaves cancellation pending and
visible for retry/reconciliation; it must not produce a success-shaped
cancellation result.

Cancellation is not available after actual execution starts. Such a Load
continues through Execution's operational-exception workflow. Cancellation
preserves the booking, Assignment, reservation, and release history. The
versioned route, request/response, idempotency, and HTTP status semantics are
specified in [service contracts](../contracts.md); internal command schemas
and detailed compensation procedures remain open.

## Execution, evidence, and closeout

1. Once Assignment and the required reservation are confirmed, Execution
   creates a planned Trip Execution and per-Load execution records. Actual
   pickup/departure changes the relevant execution to `IN_PROGRESS`;
   assignment alone does not assert movement. Trip and per-Load Execution
   use `PLANNED`, `IN_PROGRESS`, and `COMPLETED` lifecycle states, with
   `VOIDED` permitted only before start. Stop milestones/outcomes and
   exception cases are separate records, not additional lifecycle states.
   A segment with two assigned drivers records which driver is active and
   appends each driver handoff as an Execution event.
2. A Trip Execution records shared vehicle movement. Each Load execution
   records its own actual stop milestones, remarks, exceptions, and delivery
   evidence. Planned route/schedule belongs to Dispatch Planning; requested
   stops/windows belong to Load; actual movement and outcomes belong to
   Execution.
   At each planned stop, Execution appends actual `ARRIVED` and `DEPARTED`
   milestones and records a `COMPLETED`, `PARTIAL`, or `NOT_COMPLETED`
   outcome. Delivery outcomes record actual delivered quantities for the
   applicable freight lines. A `PARTIAL` or `NOT_COMPLETED` delivery outcome
   creates an operational exception case and blocks Load closeout until an
   authorized supervisor resolves the case and the delivery stop has its
   proof of delivery or an authorized, reasoned exception.
   Driver-submitted milestones, outcomes, and incident reports require
   idempotency keys; a corrected fact is a new append-only record.
3. Trip Execution completion and per-Load delivery/closeout completion are
   independent. A delivery report records a delivery milestone; it does not
   alone complete the Load. Each delivery stop requires its own proof of
   delivery attachment (PDF, JPEG, or PNG; at most 10 files per stop and
   25 MB per file), or the Load's area supervisor must authorize a reasoned
   exception for that stop before Load closeout. The chief supervisor or
   transportation executive may provide documented coverage; drivers and
   brokers cannot approve the exception. Uploads use an authorized upload
   intent, a private-object presigned URL valid for 30 minutes, and a finalize
   operation that verifies file size, type, and checksum before starting
   asynchronous malware scanning. Expired URLs cannot be extended; create a
   new upload intent. Finalization returns a
   trackable upload; create the evidence record and make the file usable only
   after a clean scan. Infected or unscanned files cannot satisfy closeout
   evidence requirements. Quarantined objects are retained for controlled
   investigation. Upload is permitted for the assigned driver, the
   responsible dispatcher (`fleet_dispatcher` or
   `contract_capacity_dispatcher`, according to the driver's assignment),
   and the Load's area supervisor or documented supervisory coverage.
   Upload permission does not grant exception-approval authority; brokers
   cannot submit delivery evidence.
4. Incident reports include a server-set `reportedAt`, reporter principal
   from authenticated identity, controlled `exceptionType`, required
   description capped at 2,000 characters, and Trip/Load Execution
   association. `occurredAt`, location, and evidence attachments are
   optional when applicable. Remarks are capped at 1,000 characters.
   Reports, remarks, evidence references, and corrections are append-only
   history. A correction is a new record that identifies the prior record
   and includes a reason; it never edits or deletes history. Store a
   shared-trip incident once against its Trip
   Execution and link it to each affected Load exception case; do not
   duplicate the report for every affected Load. A separate exception case
   tracks follow-up and resolution with `OPEN`, `IN_PROGRESS`, and
   `RESOLVED` states. Store its current state separately from append-only
   `exception_case_transitions` containing from/to state, actor, timestamp,
   and reason. Reopening a resolved case requires a reason. Case transitions do not
   rewrite the original report. The
   Load's departure-area supervisor owns case follow-up and resolution; the
   chief supervisor or transportation executive may provide documented
   coverage. Initial `exceptionType` values are `ACCIDENT`, `BREAKDOWN`,
   `DELAY`, `CARGO_DAMAGE`, `CARGO_SHORTAGE`, `PICKUP_ISSUE`,
   `DELIVERY_ISSUE`, `DOCUMENTATION_ISSUE`, and `OTHER`; `OTHER` requires an
   explanation. Store evidence files in object storage; Execution owns their
   metadata, integrity information, access policy, and lifecycle.
   Customer charge proposals and Carrier cost proposals are separate
   Load-linked workflows; neither authorizes invoicing, payment, or settlement.
   Customer charge proposals use the Carrier accessorial type catalogue as
   distinct Customer-charge types and link only to the Load. Only the broker
   responsible for handling the Load may submit; the standard broker role
   includes this permission. The area supervisor
   reviews unless they submitted the proposal; an authorized alternate
   supervisor reviews in that case, with chief-supervisor or
   transportation-executive coverage. On submission, notify the designated
   reviewer and place the proposal in their work queue; do not send automatic
   reminders while it awaits review. Outcomes are
   `SUPPORTED`, `NOT_SUPPORTED`, or `NEEDS_INFORMATION`; notify the submitter
   whenever one is recorded. The latter returns the proposal
   to the broker for added information and resubmission as a new immutable
   revision under the same proposal ID, preserving prior revisions and review
   history. Customer amounts use USD only, are greater than USD 0.00,
   and use two decimal places; no currency conversion occurs. A proposal
   requires an evidence source/reference; attach a supporting file when one
   exists, but an attachment is not mandatory. Further review rules remain
   open. The workflow ends at internal
   review; the TMS records no Customer notice or response and does not track
   invoicing or payment.
   Carrier cost proposals link to the Load and Carrier profile, not to a
   tender round, and record type, reason, amount and currency, supporting
   evidence, requester, and internal review outcome. The standard Carrier
   cost proposal submission permission is granted to
   `contract_capacity_dispatcher` and the broker responsible for handling the
   Load; submission also requires access to that Load. The
   Load's area supervisor reviews each proposal unless they submitted it; an
   authorized alternate supervisor reviews in that case, with chief-supervisor
   or transportation-executive coverage. On submission, notify the designated
   reviewer and place the proposal in their work queue; do not send automatic
   reminders while it awaits review. Outcomes are
   `SUPPORTED`, `NOT_SUPPORTED`, or `NEEDS_INFORMATION`; notify the submitter
   whenever one is recorded. The latter returns the proposal
   to its requester for added information and resubmission as a new immutable
   revision under the same proposal ID, preserving prior revisions and review
   history. Carrier cost proposal types are `DETENTION`, `LAYOVER`,
   `LUMPER`, `DRIVER_ASSIST`, `REDELIVERY`, `TRUCK_ORDERED_NOT_USED`,
   `FUEL_SURCHARGE`, `TOLL`, `EQUIPMENT_SURCHARGE`, `HANDLING`, and `OTHER`;
   `OTHER` requires an explanation. Amounts use USD only, are greater than
   USD 0.00, and use two decimal places; no currency conversion occurs.
   Additional review rules remain open. A proposal requires an
   evidence source/reference; attach a supporting file when one exists, but
   an attachment is not mandatory.
   Post-delivery claim cases reuse the `OPEN`, `IN_PROGRESS`, and `RESOLVED`
   state semantics, including an audited, reasoned reopening. This does not
   imply shared storage or ownership with Execution exception cases; claim
   cases support operational follow-up and referral only, not formal
   insurance handling, legal adjudication, or financial settlement. A claim
   may transition to `RESOLVED` after operational follow-up or documented
   referral; external claim completion is not tracked. Closure outcomes are
   `OPERATIONALLY_RESOLVED`, `DENIED`, `WITHDRAWN`, `DUPLICATE`, or
   `REFERRED_OUTSIDE_TMS`, each with a required reason. `DENIED` is an
   internal operational disposition only. A referral records its destination,
   date/time, external reference when available, and supporting evidence.
   The Load's area supervisor assigns and may reassign the designated owner
   from staff with explicit claim-owner permission, regardless of department.
   When the owner cannot progress or needs a decision, escalation goes first
   to the Load's area supervisor, who may escalate further through the
   supervisory chain. The owner may escalate whenever the case is blocked or
   requires a decision beyond their authority; no time-based automatic
   escalation applies.
   The designated owner may resolve a case after recording an audited
   outcome and reason; no blanket supervisor approval is required.
5. If Execution cannot create its record after Assignment is confirmed,
   preserve the Assignment and recover the handoff. Do not falsely report
   active Execution until its owner confirms the record and applicable
   start milestone.

## End-to-end success sequence

The diagram shows the agreed logical order, not final command/event names.
Each service commits only its own state and outbox; cross-service workflow
steps are coordinated through Temporal and RabbitMQ, not synchronous
service-to-service HTTP calls.

```mermaid
sequenceDiagram
    autonumber
    actor Broker
    participant Gateway as API Gateway
    participant Counterparty as Counterparty Registry
    participant Fleet as Fleet Readiness
    participant Load
    participant Bus as RabbitMQ
    participant Workflow as Temporal
    participant Dispatch as Dispatch Planning
    participant CC as Capacity Commitment
    participant Execution
    participant View as Operations View

    Note over Counterparty,Load: Versioned Customer status facts maintain Load's local projection
    Counterparty-)Bus: Publish Customer status fact from outbox
    Bus-)Load: Update Customer projection
    Fleet-)Bus: Publish driver/equipment readiness facts from outbox
    Bus-)Dispatch: Update planning projections from versioned owner facts
    Broker->>Gateway: POST /api/v1/booking-submissions
    Gateway->>Load: Normalized booking submission
    Load->>Load: Validate and commit submission, Loads, revisions, outbox
    alt Booking-critical validation fails
        Load-->>Gateway: Persist rejected submission and issues; create no Loads
        Gateway-->>Broker: Actionable rejection
    else Booking transaction commits
        Load-->>Gateway: Accepted result, Load references, follow-up items
        Gateway-->>Broker: Confirm durable booking only
        Load-)Bus: Publish committed booking fact from outbox
        Bus-)View: Consume versioned owner facts
        Bus-)Workflow: Start one workflow per Load
        Workflow-)Bus: Start planning command
        Bus-)Dispatch: Planning command
        Dispatch->>Dispatch: Acquire Load lease; build Trip Plan and pending Assignments
        Workflow-)Bus: Reserve full Trip Plan resource set
        Bus-)CC: Temporary reservation command
        CC-)Bus: Hold outcome
        Bus-)Workflow: Hold outcome
        Workflow-)Bus: Guard exact Load revisions
        Bus-)Load: Finalization guard command
        Load-)Bus: Guard outcome
        Bus-)Workflow: Guard outcome
        Workflow-)Bus: Request final hard-gate recheck
        Bus-)Dispatch: Finalization check
        Dispatch-)Bus: Check outcome
        Bus-)Workflow: Check outcome
        Workflow-)Bus: Confirm reservation
        Bus-)CC: Confirm Trip Plan reservation
        CC-)Bus: Reservation confirmation
        Bus-)Workflow: Reservation confirmation
        Workflow-)Bus: Activate pending Assignments
        Bus-)Dispatch: Assignment activation
        Dispatch-)Bus: Active Assignment fact
        Bus-)Workflow: Assignment fact
        Workflow-)Bus: Release finalization guards and planning leases
        Bus-)Load: Release revision guards
        Bus-)Dispatch: Release Load leases
        Workflow-)Bus: Create planned Trip and Load Executions
        Bus-)Execution: Execution creation command
        Execution-)Bus: Planned Execution fact
        Bus-)View: Update Execution projection and freshness
    end
```

## Saga recovery boundaries

- Before CC confirms a reservation, a failed or stale attempt cancels its
  pending Assignment decisions and releases the affected temporary
  reservations and Dispatch planning leases. A failed Load finalization
  guard or changed Load revision returns planning to a fresh attempt.
- For a multi-Load Trip Plan, remove a Load that fails finalization and
  revalidate the revised plan. Preserve other Loads only if the resulting
  plan remains feasible; otherwise release the affected holds and replan.
- Once CC confirms the reservation, recover Dispatch activation forward.
  Preserve confirmed capacity and pending Assignment records while retries
  or reconciliation complete; do not blindly compensate a valid reservation
  because a downstream response was delayed.
- If Execution creation or activation fails after Assignment, preserve the
  Assignment and recover the handoff. Do not report Execution as active until
  the Execution owner confirms its record and the actual start milestone.
- A business rejection is an explicit workflow outcome. Retry only transient
  technical failures, using bounded backoff. Exhausted work is visible for
  authorized inspection and reconciliation; permanently invalid messages
  are quarantined with a reason.
- A `tms_operations_administrator` may inspect technical failures and prepare
  replay/reconciliation. Replaying work that changes business state requires
  approval from the owning business domain; audit the operator, approver,
  reason, and replay result. This grant does not provide Identity or
  transportation authority.
- If a response is lost, the same booking submission reference and unchanged
  content returns the stored result. Changed content requires a new
  submission reference.

## Recovery acceptance scenarios

Inject the following failures and verify durable, owner-correct recovery:

| Injected failure                                                                       | Required acceptance result                                                                                                      |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Load transaction fails before commit                                                   | Return no booking success and create no partial submission, Load, revision, or outbox result.                                   |
| Booking commits but its HTTP response is lost                                          | Same-key retry returns the same submission/Load references; create no duplicate submission result, Load, revision, or outbox.   |
| RabbitMQ is unavailable after booking commits                                          | Return durable booking success; retain the outbox item and publish after recovery without duplicate downstream effects.         |
| Temporal is unavailable after booking commits                                          | Return durable booking success; retain the planning trigger and resume workflow after recovery without asserting Assignment.    |
| A consumer commits an effect but its broker acknowledgement is lost                    | Redelivery is recognized by the local inbox; apply the business effect once only.                                               |
| CC reservation command commits but its response is lost                                | Retry/reconcile to the same complete reservation; create no duplicate or partial resource claims.                               |
| CC confirms but Dispatch Assignment activation is delayed or lost                      | Preserve the reservation and pending decision; recover forward to one active Assignment, never compensate valid capacity.       |
| Execution creates its record but the response is lost                                  | Reconcile the same Execution record; preserve Assignment and do not report active Execution before owner confirmation.          |
| One of Dispatch Planning, CC, or applicable Execution release confirmations is missing | Keep Load `CANCELLATION_PENDING`; after retries exhaust, expose `REQUIRES_RECONCILIATION`; cancel only after all confirmations. |
| A Load is cancelled from a multi-Load Trip Plan                                        | Revalidate the remaining plan; keep other Loads only if feasible and CC confirms atomic reservation replacement.                |
| A committed booking is restored after a declared disaster                              | Demonstrate RPO 0 for acknowledged booking/result/Load/revision/outbox and RTO of at most four hours for critical services.     |

Retries use eight total delivery attempts including the initial attempt.
After a transient failure, wait one second and then exponentially double the
delay with full jitter, capped at five minutes. Exhausted work must be visible
and replayable by authorized operators; replay must preserve the same
idempotent business result.

## Outcome classes

| Situation                                                   | Required outcome                                                                                                                                                                 |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Any booking-critical row is invalid                         | Reject the entire batch with row/field reasons; create no Loads; retain the submission outcome for identical retries.                                                            |
| Booking transaction cannot commit                           | Do not return booking success. Return an explicit retryable technical error where appropriate; same-reference retry must not duplicate a committed result.                       |
| Booking commits but RabbitMQ is unavailable                 | Confirm the durable booking; retain the outbox item and retry publication. Planning remains pending.                                                                             |
| Planning information is incomplete                          | Keep the Load booked, record the missing-field task, and hold planning until correction.                                                                                         |
| No eligible capacity is found                               | Keep the Load booked and unassigned; wait for relevant facts or freshness/deadline timers, then re-evaluate or escalate.                                                         |
| Load changes during planning/finalization                   | Invalidate the stale attempt; return retryable conflict for edits during the finalization guard; replan against the new revision.                                                |
| CC hold or finalization hard gate fails before confirmation | Cancel pending Assignment decisions and release affected holds/leases; revalidate surviving Loads before retaining a multi-Load plan.                                            |
| CC confirms but Dispatch activation is delayed              | Preserve confirmed reservation and pending Assignment; retry/reconcile forward. Do not expose an active Assignment before Dispatch confirms activation.                          |
| Execution handoff fails after Assignment                    | Preserve Assignment; retry/reconcile the Execution creation handoff. Do not claim Execution is active without the Execution owner's record and actual start milestone.           |
| Accident or other operational incident occurs               | Append the report and evidence, create/update the owned exception lifecycle, make required human action visible, and preserve prior history while work continues or is resolved. |
| A delivery stop lacks required proof                        | Record delivery-reported, but keep Load closeout incomplete until each delivery stop has proof or an authorized, reasoned exception.                                             |

## Logical record families by owner

These are agreed logical table families, not finalized SQL schemas. The Load
table boundaries and ownership relationships are selected. Remaining
columns, constraints, indexes, retention, and migration details remain open.
For CC, `reservation_claims` uses `resource_type`, `resource_id`, and
PostgreSQL half-open `[start, end)` `tstzrange` windows with a GiST
exclusion constraint to prevent overlapping active claims for the same
resource. Model repositioning time by extending the affected resource's
reserved interval; a claim ending exactly when another begins does not
overlap.
Execution stores milestones, outcomes, handoffs, reports, and corrections in
typed append-only relational tables, not a generic JSONB event table.
The Operations View projects all in-scope operational records and workflows
for read-only access and links actions to the owning service; it never writes
authoritative business records. The transportation executive and chief
supervisor may query it company-wide; other users are restricted by assigned
area or, without an area grant, by existing resource and relationship
authority.

| Owner                 | Logical record families                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Load                  | `booking_submissions` with versioned JSONB input/result snapshots where applicable; mutable `loads` lifecycle heads; immutable `load_revisions`; revision-owned `load_revision_stops` and `load_revision_freight_lines`; stage-completeness issues/tasks; cancellation requests and release confirmations; business history; inbox deduplication and transactional outbox.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Counterparty Registry | Distinct Customer and Carrier records; `PENDING`, `ACTIVE`, `SUSPENDED`, and `CLOSED` status; optional external business/regulatory references with verification metadata; organization-level contacts; business history; inbox/outbox.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Fleet Readiness       | In-house and contracted driver/equipment operational records; Carrier links; availability and readiness facts with source, observed time, and owner revision; business history; inbox/outbox.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Dispatch Planning     | Expiring Load-planning leases; planning attempts; immutable Trip Plans, revisions, ordered resource segments, and segment assignments; Trip Plan-to-Load membership; pending and active immutable Assignments with supersession links; planning projections; business history; inbox/outbox.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Capacity Commitment   | Reservations and reservation revisions; `reservation_claims` with resource type/ID and PostgreSQL `tstzrange` windows; GiST exclusion constraints preventing overlapping active claims; expiry and transition history; inbox/outbox.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Execution             | Trip and per-Load Executions; typed append-only `stop_milestones`, `stop_outcomes`, `driver_handoffs`, `incident_reports`, and report-correction records; Trip-report-to-Load-exception links; separate exception cases and transitions; per-delivery-stop evidence metadata for PDF/JPEG/PNG objects; inbox/outbox.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Notification          | Actionable notifications/tasks as appropriate to its boundary; recipients; delivery attempts; acknowledgement state; inbox/outbox. Notification does not own Load completeness.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Operations View       | Rebuildable read projections; consumer offsets/owner revisions; projection freshness and rebuild state; daily/weekly/monthly measures using company-wide `America/Los_Angeles`, with weeks starting Monday at 00:00; stop-level on-time from Load appointment windows and Execution `ARRIVED` milestones; equipment/driver utilization for in-house and contracted resources from confirmed Assignment/reservation time over declared operational-availability time, ending at cancellation/supersession and excluding/showing unknown/stale periods separately. The transportation executive owns KPI definitions and company-wide review. Company-wide KPI access belongs to the transportation executive and chief supervisor; area supervisors receive area-scoped access; other roles have none by default. Corrected Fleet Readiness intervals trigger historical recalculation; preserve source revisions. This database is not authoritative business storage. |
| Identity              | Principal, authentication, and session record families remain to be designed from requirements. Business-resource authorization remains with each owning domain.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

Use opaque UUIDs for internal record IDs and keep human-readable business
references separate. Each service owns its PostgreSQL cluster and schema;
cross-service relationships use stable IDs and contracts, never foreign
keys across service databases. The initial TMS supports one company;
multi-company tenant partitioning is deferred. Current-state relational
records coexist with append-only history; full event sourcing is not the
selected approach.
Each service persists required idempotency scopes, normalized content hashes,
and result references transactionally with its business writes; idempotency
state is not shared across service databases.

Load revisions are complete immutable snapshots. Store revision stops and
freight items in relational child tables, not embedded JSON. A rejected
booking attempt retains its versioned normalized row input and issues in
JSONB but has no Load records. Each submission retains its exact outcome
result in versioned JSONB, including rejection issues or accepted
follow-ups, plus the normalized content hash. Accepted field values are
authoritative in relational Load revisions rather than duplicated in the
submission result snapshot. Exact table columns and complete request schemas
remain to be specified; the initial booking issue catalog is in
[service contracts](../contracts.md).
Enforce unique `(load_id, revision_number)`, unique stop and freight-line
ordering within each revision, and ensure a Load head references a revision
owned by that same Load. Revisions and their child rows cannot be updated or
deleted.

## API, security, and operational baseline

- Both manual intake channels use the versioned routes
  `POST /api/v1/booking-submissions` and
  `GET /api/v1/booking-submissions/{submissionId}`. The outcome, idempotency,
  response, and HTTP error semantics are specified in
  [service contracts](../contracts.md); the complete booking request schema
  remains open.
- The synchronous booking deadline is 10 seconds. A `504` may represent an
  unknown commit outcome; retry with the same idempotency key. The submission
  limit is 100 rows and 5 MB of normalized JSON.
- Identity owns authentication-focused principals, account/session lifecycle,
  MFA factors, and role grants. Initial authenticated human users include
  employees and in-house and contracted drivers; customer and carrier office
  accounts are deferred. Invitations are single-use for 72 hours. Accounts
  have `INVITED`, `ACTIVE`, `SUSPENDED`, and `DEACTIVATED` states.
- Driver onboarding starts from an existing Fleet Readiness driver profile.
  The invitation is bound to that profile and its verified contact; redeeming
  it links the principal to that exact driver. The Identity-to-driver link is
  one-to-one. A link correction requires approval from both an Identity
  administrator and the Fleet Readiness owner, with an audit record; users
  cannot relink themselves.
- In-house and contracted driver grants are execution-only and scoped to
  the linked profile and active Assignments. Drivers may report actual
  milestones, handoffs, incidents, and proof of delivery; they cannot book,
  amend, or cancel Loads, change plans, or approve closeout exceptions.
- OIDC Authorization Code with PKCE is the client sign-in flow. Identity
  signs access tokens with `RS256`; services reject `none` and any
  unconfigured algorithm. Signed access tokens last at most 15 minutes and
  carry `iss`, `aud`, `sub`, `iat`,
  `exp`, `jti`, `sid`, `auth_time`, `amr`, `grantVersion`, and grants shaped
  as `{role, scopeType, scopeId}`. Tokens contain no email, phone, or profile
  PII. Refresh sessions rotate on use; privileged
  sessions expire after 30 minutes idle or 12 hours absolute, and
  workforce/driver sessions after 12 hours idle or 30 days absolute.
  Suspension/deactivation revokes refresh sessions immediately; role changes
  may remain in routine tokens for at most 15 minutes. Routine authorization
  may rely on an already-issued token until its 15-minute expiry; high-impact
  actions verify current session revocation immediately.
- Identity signing private keys are managed and rotate every 90 days. Publish
  the next public key before using its private key and retain the previous
  public key for at least 24 hours after rotation.
- Services validate token signature, issuer, audience, time claims, and
  allowed algorithm locally. Cache issuer JWKS for at most five minutes;
  refresh once when an unknown key ID is encountered and reject if it remains
  unresolved. High-impact actions require a live session-revocation check
  and fail closed if that check is unavailable.
- MFA is required for Identity administrators, transportation executives,
  chief and area supervisors, brokers, and dispatchers. It is not required
  for drivers; driver access instead uses a password and app-level
  protections on any device, with secure credential storage and revocable
  sessions. Passkeys are preferred and TOTP is allowed; SMS and email are
  not MFA factors. Fresh MFA step-up is required only for account and role
  changes and must have completed within the preceding five minutes.
- Passwords require at least eight characters and all four character
  classes: uppercase, lowercase, number, and symbol. Common or compromised
  passwords are blocked, and passwords do not expire on a fixed schedule.
  Use Argon2id with 19 MiB memory, two iterations, one lane, and a
  cryptographically random 16-byte salt. Store encoded parameters and rehash
  after successful login when policy is raised. Authentication throttle
  begins after five failed attempts for one account within 15 minutes and
  applies progressive delays from one minute up to 15 minutes rather than a
  permanent lockout. Network-level limits, plus detailed identity audit and
  retention implementation, remain to be specified. The owner accepts the risk of
  password-only driver accounts with this minimum policy; reassess it before
  production.
- Identity stores principal/authentication data, verified sign-in and
  recovery identifiers, account state, sessions, role grants, and security
  audit; it does not own employee/driver or customer/carrier operational
  profiles. A separate `identity_administrator` role manages accounts and
  grants, with two-person approval for privileged grants; initiator and
  approver must be distinct people. Audit the requested grant, decision, and
  effective time. Domain owners map grants to actions and enforce their own
  record and transition rules. Exact permission matrices and
  delegation/coverage rules remain open.
- Identity audit is append-only and covers invitation/account-state changes,
  authentication/MFA outcomes, recovery, session creation/revocation, and
  role grants/approvals. Each event records actor, subject, time, outcome,
  reason, and correlation ID. Never log credentials, secrets, or token
  contents. Retain events in searchable storage for one year, then securely
  delete unless a documented legal or incident hold applies. Limit review
  access to designated Identity/security administrators.
- Workload identities are separate from human accounts. Use 15-minute,
  audience-bound OIDC client-credential tokens for service APIs and unique
  TLS-authenticated RabbitMQ identities with least-privilege permissions.
  Rotate service workload credentials at least every 90 days with a
  24-hour planned-rotation overlap; revoke them immediately if compromise is
  suspected.
- Every workflow should expose correlation-linked state, queue/hold age,
  retry count, and failure reason. Provide authorized inspection, replay, and
  reconciliation. Transient command failures receive eight total delivery
  attempts, including the initial attempt, with exponential backoff capped at
  five minutes; exhausted work remains
  durably visible for authorized review and replay. Permanently invalid
  messages are quarantined with a reason.
- Initial thresholds are a 10-minute Dispatch Planning lease, renewed every
  two minutes only during active planning; a five-minute CC temporary hold;
  and a two-minute Load finalization guard with at most one renewal.
  Operations View projection lag targets p95 at or below five seconds and
  is marked stale after 30 seconds without a required update.
- For an unassigned Load, notify the broker as the primary owner 24 hours
  before pickup, with the departure-area supervisor informed. At four hours
  or less before pickup and at/after the pickup window, the departure-area
  supervisor becomes the primary acknowledgement owner; escalate immediately
  once the window is reached or missed. Do not auto-cancel the booking.
- Persist notifications in the in-app inbox; push is secondary for drivers
  and email secondary for staff. Defer SMS. Notify on booking outcomes and
  follow-up holds, unassigned-load escalations, Assignment/schedule changes,
  incidents/missed milestones/closeout exceptions, Carrier tender
  acceptance/rejection/expiry to the responsible
  `contract_capacity_dispatcher`, and parked workflow failures. Require
  acknowledgement for urgent incidents,
  imminent/missed-pickup escalations, and parked workflow failures; resend
  and escalate after 15 minutes without acknowledgement. Each urgent
  notification has one primary acknowledgement owner; other recipients are
  informed but need not acknowledge. Only the primary owner's acknowledgement
  satisfies the timer. Acknowledgement is receipt only and never closes the
  source business task.
  For an urgent Trip/Load incident, the affected Load's departure-area
  supervisor is primary and the chief supervisor is informed. If no
  acknowledgement is received within 15 minutes, escalate to the
  transportation executive.
  For a parked technical workflow failure, the
  `tms_operations_administrator` is primary and the owning business-domain
  owner is informed. Acknowledgement does not authorize replay; replay that
  changes business state still requires the owning domain's approval.
- Users may suppress optional external delivery for non-urgent classes.
  Durable in-app inbox records remain available, and urgent alerts requiring
  acknowledgement cannot be suppressed by user preferences.
- Test backup and restore for each service database and evidence storage.
  The first operational release targets RPO 0 for acknowledged bookings,
  including their durable submission result, Load/revision records, and
  outbox facts, with RTO at most four hours for critical TMS service
  restoration. The failover mechanism, RPO/RTO for other data, data and
  evidence retention, remaining service objectives, and fact-owner freshness
  rules remain open.

## Cross-service invariants

- A nomination is not a capacity claim. CC owns capacity-window conflict
  handling; Dispatch Planning owns Load-planning leases and Assignment
  decisions.
- Current authoritative revisions, passing hard gates, and no unresolved
  strong avoid-preference or driver objection are required for finalization.
- Releasing a Load-planning lease does not establish that any capacity is
  available; expiring a capacity reservation does not itself alter a Load.
- No service writes another service's database. Do not use distributed
  transactions or synchronous HTTP service-to-service chains to coordinate
  business workflows.
- Services that publish or consume durable messages use transactional
  outboxes and idempotent inbox/deduplication. Retry transient technical
  failures with bounded backoff; expose exhausted work for recovery and
  quarantine permanently invalid messages with an explicit reason. Business
  rejections are workflow outcomes, not transient technical failures.
- Consumers validate inbound data at runtime and handle duplicate, delayed,
  and out-of-order delivery. Owner revisions allow consumers to detect stale
  or missing updates; a shared TypeScript type is not runtime validation.
- Notification delivery and realtime fan-out are secondary to persisted
  business facts. A missed delivery must remain inspectable and recoverable.
- Preserve source, time, and correction history for business facts; do not
  silently rewrite prior decisions or execution evidence.

## Implementation status and open design

The target Counterparty Registry, Fleet Readiness, Identity, Load, Dispatch
Planning, CC, Execution, Notification, and Operations View are not
implemented in this repository. The
target deploys each service independently with its own PostgreSQL cluster.
RabbitMQ, Temporal, NATS, and observability are shared platform clusters.
Each service uses the documented `app`, `domain`, `interface`, and `infra`
organization without unnecessary generic scaffolding. These are target choices, not a
claim that they are configured in the current local stack.

Exact command/event schemas, table columns and constraints, authorization
context, freshness rules, deadline thresholds, expiry/renewal protocol,
replay/reconciliation procedures, and stage-specific required fields remain
open. This workflow baseline does not itself authorize implementation; see
[open decisions](OPEN_QUESTIONS.md).
