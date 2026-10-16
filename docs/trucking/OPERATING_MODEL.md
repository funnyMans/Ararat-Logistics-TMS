# TMS business operating model

This page records the approved business baseline for the modeled company.
Detailed policies that have not been selected are listed in the
[open-decision register](OPEN_QUESTIONS.md); they are not implied by this
summary. The [system blueprint](TMS_SYSTEM_BLUEPRINT.md) owns target
architecture, and [responsibilities](RESPONSIBILITIES.md) owns role
boundaries.

## Business scope

The initial product model describes a US trucking carrier and brokerage with
a home area in LA and West, Central, and East operating areas. Its current
scale and organization are design assumptions, not an industry standard or
product limit.

The operating path connects a broker's commercial commitment to capacity
protection, a distinct Assignment, execution, and an auditable operational
history. Keep these concepts separate:

- A **Load** records what the company agreed to carry and its current
  requirements.
- A **Capacity Commitment** records a protected capacity window and its
  lifecycle.
- An **Assignment** records the Dispatch Planning decision linking a load
  to selected capacity.
- An **Execution** records what actually happens while the work is carried
  out.

## Approved operating rules

- The handling broker decides whether to clarify, book, or decline each
  offer. The decision does not require a supervisor capacity review.
- A booked Load records one positive total Customer rate in USD in the
  initial scope; the TMS does not convert currencies.
- The TMS supports manual tenders to existing approved Carrier profiles and
  records acceptance or rejection. The `contract_capacity_dispatcher` owns
  sending tenders and tracking Carrier responses. Load-board marketplace
  sourcing and automated procurement are outside scope. A tender records
  each offered Carrier rate and, when accepted, the agreed rate and currency;
  these facts do not authorize payables or settlement. The Carrier and
  dispatcher may exchange any number of counteroffers; the dispatcher may accept a
  Carrier counteroffer without blanket supervisor approval. Each new offer or
  counteroffer starts a response period with a one-hour default deadline,
  editable per tender. The responsible dispatcher is notified immediately on
  each Carrier counteroffer, acceptance, rejection, or expiry; no pre-deadline
  reminders are sent. Counteroffers may change only rate and currency; Load
  scope or operating requirement changes use normal Load amendment and
  replanning. Each tender fixes one rate basis: `FLAT_PER_LOAD`, `PER_MILE`,
  `PER_KILOMETER`, `PER_HOUR`, `PER_STOP`, or `OTHER` with an explanation.
  Flat rate is the indicative total. Other standard bases calculate an
  indicative total from planned distance, duration, or stop count in a
  specific Trip Plan revision. No calculated total is shown for these unit
  bases before a plan exists; later plan revisions recalculate the current
  estimate while preserving prior estimates. `OTHER` has no calculated total.
  All tender offers use USD in the initial scope; the TMS does not convert
  currencies. Rates must be positive and have at most two decimal places.
  The dispatcher communicates tenders, counteroffers, and Load-cancellation
  notices through the existing external channel and records sent offers and
  Carrier responses in the TMS; the TMS does not deliver these messages or
  provide a Carrier portal. Each round may include an external message
  reference or supporting attachment, but not a copied message body.
  Indicative USD totals are rounded half up to the nearest cent. Exact tender
  payload remains open. If either party misses a round deadline, the entire
  tender expires and a late response cannot reopen it. The dispatcher cannot
  withdraw an open tender; it remains active until acceptance, rejection, or
  expiry. If the Load is canceled, the TMS cancels its open tenders, notifies
  the responsible dispatcher, who contacts the Carrier through the external
  channel; the TMS preserves negotiation history.
  Carrier acceptance is not capacity protection: the Load remains unsecured
  until Dispatch Planning and Capacity Commitment complete their normal
  confirmation workflow.
- Customer instructions, appointment coordination/changes, and customer
  status communication are tracked as Load-linked internal follow-up owned
  by the broker. Customer portals and standalone CRM/contact-center case
  management are outside the approved scope.
- Customer charge proposals and Carrier cost proposals are distinct
  Load-linked operational workflows; neither authorizes invoicing, payment,
  or settlement. Customer charge proposals use the Carrier accessorial type
  catalogue as separate Customer-charge types and link only to the Load. Only
  the broker responsible for handling the Load may submit; the standard broker
  role includes this permission. The area supervisor
  reviews; if they submitted the proposal, another authorized supervisor
  reviews, with chief-supervisor or transportation-executive coverage.
  On submission, notify the designated reviewer and place the proposal in
  that reviewer's queue; do not send automatic reminders while it awaits
  review.
  Notify the submitter whenever a reviewer records `SUPPORTED`,
  `NOT_SUPPORTED`, or `NEEDS_INFORMATION`. The latter returns the proposal to
  the broker for added information and resubmission as a new immutable revision
  under the same proposal ID, preserving prior revisions and review history.
  Amounts use USD only, are strictly positive, and are stored to two decimal
  places. Each proposal requires an evidence source/reference; attach a
  supporting file when one exists, but an attachment is not mandatory.
  Further review rules remain open. The workflow ends at internal review; the
  TMS records no Customer notice or response and does not track invoicing or
  payment.
- Carrier cost proposals record type, reason, amount/currency, supporting
  evidence, requester, and internal review outcome, and are linked to the
  relevant Load and Carrier profile, not to a tender round. Types are
  `DETENTION`,
  `LAYOVER`, `LUMPER`, `DRIVER_ASSIST`, `REDELIVERY`,
  `TRUCK_ORDERED_NOT_USED`, `FUEL_SURCHARGE`, `TOLL`,
  `EQUIPMENT_SURCHARGE`, `HANDLING`, and `OTHER`; `OTHER` requires an
  explanation. Amounts use USD only, are strictly positive, and are stored to
  two decimal places; no currency conversion is performed. Each proposal must
  reference supporting evidence; attach a file when one exists, but an
  attachment is not mandatory. The standard Carrier cost proposal submission
  permission is granted to `contract_capacity_dispatcher` and the broker
  responsible for handling the Load. Submission also requires access to that
  Load. The Load's area supervisor reviews each proposal, except when that
  supervisor submitted it; another authorized supervisor reviews, with
  chief-supervisor or transportation-executive coverage. On submission,
  notify the designated reviewer and place the proposal in that reviewer's
  queue; do not send automatic reminders while it awaits review. Outcomes are
  `SUPPORTED`, `NOT_SUPPORTED`, or `NEEDS_INFORMATION`;
  notify the submitter whenever one is recorded. The latter returns
  the proposal to the requester for added information and resubmission as a
  new immutable revision under the same proposal ID, preserving prior
  revisions and review history. Further review rules remain open.
- Post-delivery claims, including damage, shortage, loss, and customer or
  carrier disputes, are tracked as operational cases linked to the relevant
  Load and, where applicable, Execution. Each case has a designated owner
  accountable for coordinating it through resolution, regardless of
  department. Cases record supporting evidence, status, and resolution;
  they use the `OPEN`, `IN_PROGRESS`, and `RESOLVED` lifecycle, and reopening
  a resolved case requires an audited transition and reason. Cases support
  internal operational follow-up and referral; formal insurance handling,
  legal adjudication, and financial settlement remain outside the TMS. A case
  may be resolved after operational follow-up or documented referral; the
  TMS does not track the referred claim to external completion. Closure
  outcomes are `OPERATIONALLY_RESOLVED`, `DENIED`, `WITHDRAWN`, `DUPLICATE`,
  or `REFERRED_OUTSIDE_TMS`, with a required reason. `DENIED` is only an
  internal operational disposition. A referral records its destination,
  date/time, available external reference, and supporting evidence. The
  Load's area supervisor assigns and may reassign the designated owner from
  staff with explicit claim-owner permission, regardless of department.
  When the owner cannot progress or needs a decision, the case escalates first
  to the Load's area supervisor, who may escalate through the supervisory
  chain. The owner may escalate whenever the case is blocked or needs a
  decision beyond their authority; no time-based automatic escalation applies.
  The designated owner may resolve a case after recording its outcome and
  reason; all state and outcome transitions are audited, without blanket
  supervisor approval.
- Booking creates a commercial commitment and starts capacity planning; it
  does not itself secure capacity or create an Assignment.
- Before actual execution starts, an approved change to the booking creates
  a new Load revision and may require replanning. After execution starts,
  requested changes follow the operational-exception process rather than
  rewriting the committed requirements.
- A broker may request cancellation before actual execution starts. The
  request is not final until downstream planning and capacity commitments
  are released; once accepted, it cannot be withdrawn. After execution
  starts, resolve the situation through the operational-exception process.
- A Load is complete only after Execution confirms its required closeout;
  each delivery stop needs proof or a reasoned exception approved by the
  accountable area supervisor (or documented supervisory coverage), and an
  individual delivery report alone does not complete the Load. A partial or
  uncompleted delivery creates an operational exception case that blocks
  closeout until an authorized supervisor resolves it.
- Routine planning, reservation, and Assignment proceed automatically when
  current facts and policy allow a valid decision. Human oversight addresses
  exceptions and policy-authorized judgment, not routine approval.
- Dispatch Planning must not treat a nomination as a reservation or let a
  missed nomination hide otherwise eligible capacity from its planning.
- Eligibility, availability, preference, and willingness are distinct.
  Missing or stale facts do not count as approval.
- Verified equipment maintenance status may block readiness or availability.
  Fleet dispatchers record and verify in-house equipment status; contract
  capacity dispatchers do so for contracted equipment. The TMS does not manage
  maintenance work orders, schedules, or parts. The status is `CLEAR` or
  `BLOCKED`, with reason, evidence source/reference, verifier, observed time,
  and valid-through time; `CLEAR` removes only the maintenance blocker and
  does not establish overall equipment eligibility.
  Each status has an explicit validity deadline; missing or expired status
  blocks planning. Use the evidence's valid-through date when present;
  otherwise, the responsible dispatcher sets a finite deadline. Evidence
  must reference a verified maintenance record or inspection. Attach a
  supporting document when one exists; an attachment is not mandatory when
  no document exists.
- Management reporting includes operational performance measures such as
  on-time performance and separate equipment and driver utilization. On-time
  performance compares actual arrival with the confirmed appointment window
  at each stop; pickup and delivery are reported separately, and stops without
  a confirmed appointment are excluded. Initial utilization formulas, eligible
  resource populations, reporting periods, and KPI ownership are established.
  The equipment-utilization numerator is time under a confirmed
  Assignment and Capacity Commitment reservation; driver utilization uses
  time under a confirmed Assignment. Both measures use declared
  operational-availability time, not all calendar time, as their denominator.
  If a confirmed reservation or Assignment is cancelled or superseded, count
  only time through its effective end.
  Unknown or stale availability is excluded and shown separately.
  Corrections to historical availability recalculate prior KPI results while
  retaining source revision history.
  The transportation executive owns company-wide KPI definitions and review.
  KPI dashboards are company-wide for the transportation executive and chief
  supervisor, area-scoped for area supervisors, and unavailable to other roles
  by default.
  Provide daily, weekly, and monthly views using the company-wide
  `America/Los_Angeles` timezone, with weeks beginning Monday at 00:00.
  Include in-house and contracted resources when availability and confirmed
  work are recorded.
  Financial, accounting, and settlement reporting are outside scope.
- The Operations View provides read-only projections across all in-scope TMS
  operational records and workflows. It links users to the owning service for
  actions and does not write authoritative business records. The
  transportation executive and chief supervisor have company-wide access;
  other users are scoped to their area where applicable or to their existing
  resource and relationship authority otherwise.
- A strong avoid-preference or explicit driver objection stops automatic
  finalization for that proposal and requires a bounded, human-owned review.
  It is not silently treated as acceptance or as an unqualified legal veto.
- No actor may bypass hard eligibility, safety, contractual, or concurrency
  gates. When a finalization hard gate fails, Dispatch Planning releases its
  Load-planning lease and returns the Load to planning; CC capacity holds are
  released or retained according to their own reservation state. Releasing a
  planning lease does not establish that capacity is available.

## Outside the approved baseline

Exact deadlines and timezone behavior, trip-profile thresholds, allocation
weights, readiness and availability sources, detailed sourcing policy, and
regulatory or contractual rules are not settled here. Do not infer them from
the reference company's size or geography. Track decisions in
[open decisions](OPEN_QUESTIONS.md) and validate legal or regulatory
requirements from authoritative sources before implementation.
