# Company roles and authority

This is the selected role model for the owner-led TMS company, not
a staffing recommendation for every carrier. Role grants are authorization
inputs, not unrestricted access: each owning service must also check access
to the specific record and transition.

This page defines high-level business accountability, not a complete
permission matrix. Under D-506, each record-owning service enforces
default-deny authorization using the role grant and applicable
resource/relationship scope. Detailed action-to-role matrices, delegation
rules, and technical enforcement remain capability-specific prerequisites
before protected writes are implemented.

An account may have multiple grants. Grants may be area-scoped to `la`,
`west`, `central`, or `east` where the role permits it. Area scope does not
replace load, assignment, or relationship checks.

## Role boundaries

| Grant                                | Scope                                  | Primary responsibility                                                                                       |
| ------------------------------------ | -------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `identity_administrator`             | Company-wide                           | Invitation, suspension, credential recovery, and role-grant administration; no transportation authority      |
| `transportation_executive`           | Company-wide                           | Department-level escalation, cross-department decisions, and company-wide operational KPI definitions/review |
| `chief_supervisor`                   | Company-wide                           | Supervisory coordination and company-level continuity                                                        |
| `area_supervisor`                    | One or more areas                      | Accountable operational outcome for departing loads; policy oversight and exception handling                 |
| `broker`                             | One or more areas                      | Load quality, commercial book/clarify/decline decision, sourcing coordination, and customer communication    |
| `outer_fleet_broker`                 | Company-wide                           | External capacity sourcing when that capability is in scope                                                  |
| `fleet_dispatcher`                   | Fleet group(s), optionally area-scoped | In-house fleet coordination, readiness reporting, maintenance-status facts, and operational context          |
| `contract_capacity_dispatcher`       | Carrier relationship(s)                | Manual tendering to approved Carriers, response tracking, contracted-equipment status, and coordination      |
| `in_house_driver`                    | Individual driver                      | Safe execution and factual progress, exception, and evidence reporting                                       |
| `contracted_driver`                  | Carrier relationship and individual    | Contracted execution and required reporting                                                                  |
| `customer_contact` (deferred)        | Own customer/load relationships        | Future: submit instructions and receive explicitly permitted customer status                                 |
| `outside_carrier_contact` (deferred) | Own carrier/load relationships         | Future: accept or tender work and report agreed execution milestones                                         |
| `outer_fleet_supervisor`             | Company-wide; future capability        | Contract-capacity oversight if the program grows enough to justify it                                        |

Both driver grants are execution-only and scoped to the driver's linked
profile and active Assignments. Drivers may report actual milestones,
handoffs, incidents, and proof of delivery. They may not book, amend, or
cancel Loads, change plans, or approve closeout exceptions.
The responsible dispatcher for the assigned driver and the Load's area
supervisor (or documented supervisory coverage) may also upload delivery
evidence. Submission authority does not confer approval authority.

Area-scoped grants use `la`, `west`, `central`, or `east`. Area supervisors
and brokers require an area; fleet dispatchers may optionally have one.
Other grants do not accept an area scope.

Operational KPI dashboards are visible company-wide to the transportation
executive and chief supervisor, area-scoped to area supervisors, and
unavailable to other roles by default.
The read-only Operations View is available company-wide to the transportation
executive and chief supervisor; other users are scoped by area or, when they
have no area grant, by their existing resource and relationship authority.

## Domain-owned write authority

- Brokers own Load booking, pre-execution amendments, and cancellation
  requests; they do not make planning or Assignment decisions.
- Dispatchers own Trip Plans, capacity-reservation requests, and Assignments;
  they do not rewrite Load requirements or Fleet Readiness facts.
- Fleet dispatchers own driver/equipment readiness facts; they do not create
  Load bookings or Assignments.
- Fleet dispatchers record and verify maintenance-status readiness facts for
  in-house equipment; contract capacity dispatchers do so for contracted
  equipment. They record `CLEAR` or `BLOCKED`, with a reason and evidence
  reference. Neither role owns maintenance work orders or scheduling.
- Contract capacity dispatchers own sending manual tenders to approved
  Carriers, negotiating multiple counteroffer rounds, and tracking tender
  responses. They may accept Carrier counteroffers without blanket supervisor
  approval. They communicate through the existing external channel and record
  sent offers and Carrier responses in the TMS; this does not make Carrier
  acceptance a capacity reservation.
- Area supervisors authorize closeout exceptions and own execution-exception
  resolution; Execution records those decisions and case transitions.
- Customer charge proposals and Carrier cost proposals are separate
  Load-linked workflows; their roles and review procedures are not
  interchangeable.
- Only the broker responsible for handling a Load may submit a Customer
  charge proposal for it. The standard broker role includes this permission.
  The Load's area supervisor reviews; if they submitted the proposal, another
  authorized supervisor reviews, with the chief supervisor or transportation
  executive providing coverage as needed.
- Customer charge proposals use the Carrier accessorial catalogue as distinct
  Customer-charge types. Their submission does not authorize invoicing or
  settlement.
- The standard Carrier cost proposal submission permission is granted to
  `contract_capacity_dispatcher` and the broker responsible for handling the
  Load; submission also requires Load access. The Load's area supervisor
  reviews and records its operational outcome. If the area supervisor
  submitted the proposal, another authorized supervisor reviews it; the chief
  supervisor or transportation executive may provide coverage. This review
  does not authorize invoicing, Carrier payment, or settlement.
- The Load service records a minimal Load-linked issue and its handoff
  status. It does not assign an internal claim owner or manage post-delivery
  issue resolution. The receiving out-of-scope service owns issue assignment,
  status, and resolution; the handoff contains the issue record, not the
  detailed Load record or full Load snapshot.
- Each domain's owning service remains the only authority that writes its
  business records. A role grant does not confer cross-domain write access.

## Technical operations authority

| Grant                          | Scope        | Responsibility                                                                                                                   |
| ------------------------------ | ------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `tms_operations_administrator` | Company-wide | Inspect technical failures and prepare replay/reconciliation; execute recovery only after the owning business domain approves it |

This grant does not provide Identity administration or transportation
authority. A replay that changes business state requires approval from the
owning business domain; technical access alone cannot authorize a business
transition.

## Accountability principles

- The departure-area supervisor is accountable for the operational outcome
  and exceptions for that load.
- The broker owns the commercial decision to book or decline and
  customer-facing communication.
- Routine matching and Assignment follow system policy; a supervisor
  monitors and handles exceptions rather than approving every decision.
- Local support, delegation, and absence coverage must be explicit. A role
  grant alone does not establish operational ownership or authority over a
  particular record.
- Employee, owner-operator, contractor, and customer relationships must not
  be conflated. Applicable law and agreements govern the actual authority.

This role model is a business authority baseline, not an implemented
authentication or authorization system. Identity and session requirements
are recorded, and D-506 establishes the authorization model. Detailed
role-to-action and resource-level matrices remain capability-specific
prerequisites in [open decisions](OPEN_QUESTIONS.md). Customer and carrier
office accounts are deferred. Privileged identity-grant changes require a
second approver; the identity administrator grant does not confer access to
transportation operations.
