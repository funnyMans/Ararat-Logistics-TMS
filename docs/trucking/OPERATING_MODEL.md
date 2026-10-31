# TMS business operating model

This page records the approved business baseline for the modeled company.
Detailed policies that have not been selected are listed in the
[open-decision register](OPEN_QUESTIONS.md); they are not implied by this
summary. The [system blueprint](TMS_SYSTEM_BLUEPRINT.md) owns target
architecture, and [responsibilities](RESPONSIBILITIES.md) owns role
boundaries.

## Business scope

The initial product model describes a US trucking carrier and brokerage with
a Los Angeles–Long Beach five-county CSA home area and West, Central, and
East operating rollups. The [Census-based area map](DECISIONS.md#d-515--base-operating-zones-on-census-geography-and-explicit-leaf-grants)
provides ten smaller geographic leaves; brokers and supervisors may be
granted one or more leaves. The Census classification is a common geographic
reference, not an industry operating standard or product limit.

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
- Booking-critical requirements must be valid before the booking batch can
  commit. Invalid optional or later-stage information is omitted from the
  authoritative Load record and tracked for correction; only workflow stages
  that require the missing valid fact are held.
- Only an `ACTIVE` Customer may be booked. A later transition to
  `SUSPENDED` or `CLOSED` blocks future bookings but does not automatically
  hold, amend, or cancel existing Loads; those require a separate authorized
  Load workflow.
- Fleet Readiness owns versioned Carrier eligibility facts and verification
  evidence used by planning gates. Initial verification is manual; live
  external-source integrations are not assumed. Counterparty Registry owns
  Carrier identity and lifecycle status, not qualification. Eligibility
  facts must be evidence-based; the TMS does not interpret law or manage
  compliance cases. Carrier agreements remain external legal records; the
  TMS retains only verified operational facts and agreement references
  required by its gates. When an eligibility fact becomes invalid, expires,
  or is superseded, notify the responsible verifier and affected planning
  owner immediately; hold only the planning actions gated by that fact.
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
  tender expires and a late response cannot reopen it. Before a tender is
  selected as binding for the Load, the responsible
  `contract_capacity_dispatcher` may withdraw it at any time, including after
  Carrier acceptance; the dispatcher records the withdrawal and informs the
  Carrier through the external channel. Preserve the negotiation history.
  If one or more Carriers accept tenders for the same Load, the responsible
  dispatcher explicitly selects exactly one accepted tender as binding and
  closes competing open and accepted tenders externally, recording their
  disposition in the TMS. Dispatch Planning may consider only the Carrier on
  the selected binding tender. Carrier acceptance or binding selection is
  not capacity protection: the Load remains unsecured until Dispatch Planning
  and Capacity Commitment complete their normal confirmation workflow. If
  the selected Carrier cannot pass readiness or capacity checks, keep the
  Load unassigned. Before an Assignment becomes active, the dispatcher may
  auditably supersede the binding selection and select another accepted
  tender only after reconfirming that Carrier's acceptance through the
  external channel, or issue a replacement tender. After Assignment activation,
  a Carrier change must use the Load amendment/replanning or cancellation
  workflow and coordinated Assignment and Capacity Commitment handling.
  A Load amendment before Assignment activation does not automatically clear
  the binding Carrier; Dispatch Planning revalidates the exact amended
  revision against that Carrier and leaves the Load unassigned if required
  checks fail. An amendment does not rewrite historical tender terms;
  whether changed requirements require a new rate or renewed Carrier
  acceptance remains open. Only an `ACTIVE` Carrier may be selected for a
  new binding tender or have a pending Assignment activated. A later
  transition to `SUSPENDED` or `CLOSED` blocks pending activation and
  preserves its Assignment and reservation for explicit dispatcher action;
  if no Assignment has been proposed, the Load remains unassigned. It does
  not automatically alter an active Assignment or Execution; any change to
  existing active work requires the authorized reassignment or cancellation
  workflow.
  If the Load is canceled, the TMS cancels its open tenders, notifies the
  responsible dispatcher, who contacts the Carrier through the external
  channel; the TMS preserves negotiation history.
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
- Post-delivery claims, delivery variances, remaining freight, and other
  operational issues are recorded as minimal issue records linked to the
  Load. The receiving out-of-scope service owns issue assignment, status, and
  resolution; the TMS retains only the issue facts and handoff status. Never
  send the detailed Load record or full Load snapshot as an issue handoff.
  Issue types, type-specific minimum data, recipient services, and message
  contracts remain to be defined. Formal insurance handling, legal
  adjudication, and financial settlement remain outside the TMS.
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
- Execution and Load become `COMPLETED` when the transportation attempt
  ends and every planned stop has a final outcome. Each actual unload needs
  POD or an authorized evidence exception. Own-fleet POD is accepted on
  receipt; contractor and
  outer-Carrier POD requires dispatcher review. Record actual quantities and
  locations. Shortfalls, overages, omitted stops, changed unload locations,
  and remaining freight are linked issues for handoff, not reasons to keep
  the Load or Execution open. A shared trailer need not be physically empty;
  determine completion from the freight for the specific Load. Terminal
  status does not establish customer satisfaction or commercial settlement.
  Trip completion remains independent of per-Load closeout.
- `CANCELLED` and `COMPLETED` are terminal Load outcomes. Linked issue records
  and handoffs remain separate; creating or updating one does not reverse a
  terminal status.
- Routine planning, reservation, and Assignment proceed automatically under
  the rolling horizon, dispatcher-ranking, reallocation, and recovery rules in
  D-511, when current facts and policy allow a valid decision. Human oversight
  addresses exceptions and policy-authorized judgment, not routine approval.
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

The initial 12-hour operational trip classification, driver-specific
return-home classification, hard-gate categories, and lexicographic
resource-candidate ranking are defined in D-499. Dispatcher Load ranking,
the four directional/duration profiles, rolling reservation limits, safe
reallocation, and chain-tail recovery are defined in D-511 and the
[planning contract](../contracts.md#initial-dispatch-planning-policy).
D-500 defines provider-neutral route-estimate provenance, the 15-minute
review acknowledgement/escalation rule, and a fail-closed boundary for
unapproved legal or safety gates. Exact route-estimate sources and
stop-service-time values, the Fleet Readiness fact catalogue and its evidence
rules, measurable product-wide operational acceptance profiles, and
authoritative legal or contractual requirements remain open. Do not infer
them from the reference company's size or geography. Validate legal or
regulatory requirements from authoritative sources before implementation.
