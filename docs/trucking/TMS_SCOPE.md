# TMS responsibility map

This page identifies the minimum TMS target currently established by owner
decisions and the additional responsibilities that still require scope
decisions. It is a completeness aid, not a finalized maximum scope or an
approved release checklist.

## Current product baseline

The visual boundary summary is available in the
[TMS ecosystem map](../maps/scope/tms-ecosystem-boundary.svg); this table and
the explicit scope statements below remain authoritative.

| TMS responsibility       | What the current model establishes                                                                                                                                                                                                       |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Counterparty records     | Separate Customer and Carrier profiles share a Counterparty Registry; Fleet Readiness owns versioned planning-critical Carrier eligibility facts and gate-required agreement references, while agreements remain external legal records. |
| Fleet readiness          | Fleet Readiness owns driver/equipment readiness and availability plus manually verified Carrier eligibility facts and gate-required agreement references; broader fleet administration is not assumed.                                   |
| Commercial load decision | A broker clarifies, books, or declines an offer; booking creates a commercial commitment, not a capacity reservation.                                                                                                                    |
| Load requirements        | Load owns the booked commitment, requirements, and their revisions.                                                                                                                                                                      |
| Capacity protection      | Capacity Commitment (CC) owns reservation lifecycle and capacity-window claims.                                                                                                                                                          |
| Planning and assignment  | Dispatch Planning evaluates capacity and policy, explains the decision, and owns the canonical Assignment.                                                                                                                               |
| Transportation execution | Execution owns movement facts, progress, exceptions, evidence, completion, and corrections.                                                                                                                                              |
| Action visibility        | Notification makes actionable work visible; it does not own the underlying business fact.                                                                                                                                                |
| Company accountability   | A high-level set of modeled company roles and responsibility boundaries is documented. Detailed access and procedures are not.                                                                                                           |

These are concept-level boundaries. They do not yet define complete
workflows, record relationships, operating procedures, data fields, or
technical contracts.

The minimum identified operating path is the transportation department's
Load-booked-to-Execution-confirmed-closeout workflow, including reservation
and Assignment handoffs, execution facts, exceptions, and history. Other
responsibilities explicitly marked in scope in the map are connected parts
of this current target. Remaining details and measurable release acceptance
are tracked separately; this minimum does not require a single delivery of
all target capabilities.

## Function boundaries and open extensions

TMS products do not share one fixed functional boundary. For example,
[Descartes describes](https://www.descartes.com/solutions/transportation-management)
transportation optimization, carrier booking and tendering, and real-time
visibility; [McLeod describes](https://www.mcleodsoftware.com/solutions/)
trucking and logistics operations products that can be configured separately
or together with document, accounting, and financial-management capability.
Oracle positions its [Transportation Management product](https://www.oracle.com/scm/logistics/transportation-management/)
as managing transportation activity across a global supply chain. These
vendor descriptions demonstrate breadth and packaging choices, not a
standard that this product must copy.

The following functions are useful areas to assess; products include or
package them differently. The statuses below distinguish responsibilities
already included in the minimum target from explicitly excluded functions
and unresolved extensions; they are not a product-comparison checklist.
Determine each additional TMS boundary and business owner before designing
services or role procedures.

| Business function                         | Typical TMS-related responsibility                                                                                                                              | Current status                                                                                                                                                                                                                                                            |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Brokerage and commercial operations       | Customer/load intake, quote or rate terms, book/decline, customer instructions, and commercial changes                                                          | Booking decision, positive total rate, and basic Customer identity/status are established; broader pricing and change rules remain open.                                                                                                                                  |
| Carrier sourcing and capacity procurement | Manual tenders to existing approved Carriers, recording response, offered/agreed rate, and deadline; one-hour default response window editable per tender       | Manual tendering is in scope; one dispatcher-selected accepted tender binds the Carrier for planning, without reserving capacity. Pre-binding withdrawal is allowed. Marketplace sourcing, automated procurement, payables, and settlement are excluded.                  |
| Transportation operations                 | Load planning, capacity protection, assignment, dispatch, execution, exceptions, and completion                                                                 | This is the established product core; detailed cross-boundary contracts remain open.                                                                                                                                                                                      |
| Customer service and shipment visibility  | Load-linked internal instruction, appointment coordination/change, and status communication tasks                                                               | Broker-owned Load follow-up is in scope; portals and standalone CRM/contact-center case management are deferred.                                                                                                                                                          |
| Documents and delivery evidence           | Load/revision-owned booking and rate-confirmation documents; Execution-owned POD, receipts, and incident evidence                                               | Transportation documents stay with their authoritative Load or Execution record; generic document management is deferred.                                                                                                                                                 |
| Transportation finance                    | Record one USD customer rate per Load plus distinct Load-linked Customer charge proposals and Carrier cost proposals with evidence and internal review outcomes | Both proposal workflows stop at internal review and do not authorize invoicing, Carrier payment, or settlement. Customer communication/payment tracking is excluded; billing, accounting, payables, and settlement belong outside the TMS boundary.                       |
| Fleet and driver administration           | Driver/equipment records, Carrier eligibility, availability, readiness, utilization, and assignment constraints                                                 | Minimal readiness/availability and planning-critical Carrier eligibility facts are owned by Fleet Readiness; maintenance-status facts are recorded by the fleet or contract-capacity dispatcher according to equipment relationship. Broader administration remains open. |
| Maintenance, safety, and compliance       | Verified maintenance status (`CLEAR`/`BLOCKED`) as a readiness/availability gate; approved safety/contractual hard gates                                        | Record reason, evidence reference, verifier, observed time, and valid-through time. Missing/expired status blocks planning. No work orders, scheduling, parts, or safety-case management.                                                                                 |
| Claims and service recovery               | Execution evidence and minimal Load-linked issue records with handoff to the responsible out-of-scope service                                                   | The receiving service owns issue assignment, status, and resolution. TMS does not operate a post-delivery claim lifecycle or send a detailed Load record as an issue handoff; insurance/legal adjudication and settlement remain outside scope.                           |
| Management and operational control        | Work queues, workload/exception oversight, audit history, and on-time/equipment/driver utilization KPIs for in-house and contracted resources                   | KPI periods use company-wide `America/Los_Angeles`; weeks start Monday. Utilization uses confirmed work over declared availability; unknown/stale time is excluded and corrections recalculate history. Financial reporting is excluded.                                  |

These are business functions, not a required organization chart. A small
company may combine several functions in one department or role; a larger
company may separate them. Document the work and authority first, then map
it to the modeled roles.

## Scope boundary

This is a carrier-and-brokerage operating model. It must not silently turn
into a shipper procurement platform, a general accounting product, a fleet
maintenance system, or a broad business-management suite. Include an adjacent
function only when it has a defined TMS duty, accountable owner, record
relationships, workflow, and explicit completion boundary. Exclude it
explicitly otherwise.

The TMS is a foundational transportation system, not an umbrella for every
system used by the company. It owns only the responsibilities explicitly
assigned to its bounded domains. Adjacent systems may depend on TMS-owned
identifiers, facts, and versioned interfaces, while retaining separate
ownership, persistence, and lifecycle. Billing, accounting, accounts
receivable/payable, and settlement are outside the TMS boundary; Load rates
and internal charge/cost proposals do not create financial documents or
payment records. User-facing application packaging remains undecided and
does not determine business-system ownership.

The maximum TMS scope remains undefined. A new responsibility is not
included merely because it is common in commercial TMS products or convenient
to implement alongside an existing service. Additions require an explicit
owner decision covering the business purpose, accountable owner, records,
relationships, lifecycle, cross-system contracts, and exclusions. Safety
and compliance scope remains limited to approved operational gates; the
specific facts and rules require authoritative sources and qualified review.

Vendor capability lists are a discovery checklist, not requirements or
proof of company practice. The scan above is based on public product
descriptions, not a representative industry survey. Confirm scope against
the owners' intended operating model before treating any item as agreed.

## Definition of complete scope

For each responsibility selected for the TMS, document its business owner,
actors, start and end conditions, authoritative records, relationships,
lifecycle, cross-domain handoffs, exception paths, and explicit exclusions.
Then define its system boundary and internal contract. Detailed
role-specific procedures and permissions follow once those boundaries and
contracts are stable.

The [open-decision register](OPEN_QUESTIONS.md) tracks the owner decisions
still required. A capability listed as part of the current minimum target
does not by itself authorize implementation before the implementation-
readiness gate; a capability listed as an open gap is not approved merely
by appearing here.

## Sources reviewed

- [Descartes: Transportation Management](https://www.descartes.com/solutions/transportation-management)
- [McLeod Software: Solutions for Trucking and Logistics](https://www.mcleodsoftware.com/solutions/)
- [Oracle: Transportation Management](https://www.oracle.com/scm/logistics/transportation-management/)
