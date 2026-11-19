# Operational Economics Service

**Status:** Provisional working specification, not a finalized service
catalog or production contract. It records the current intended boundary and
distinguishes selected policy from implemented scaffolding. Keep it
provisional until the overall service, adapter, and module inventory is
confirmed; calculation models, source-system mappings, and production message
details remain unapproved. Nothing here authorizes dispatch automation.

## 1. Purpose and ownership

Operational Economics (Economics) independently estimates and versions
economic/time inputs for individual Loads and individual resource units. It
does not determine whether a particular Load is suitable for a particular
Trio.

| Work                                                                      | Owner                                      | Boundary                                                                                                                                                  |
| ------------------------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Publish financial actuals and context-specific cost aggregates            | Financial/Accounting (planned)             | Owns authoritative financial facts and normalized cost aggregates/rates across approved periods and operating contexts; detailed dimensions remain open.  |
| Estimate one Load independently                                           | Economics                                  | Keyed to the Load revision; no Trio, driver, or equipment pairing.                                                                                        |
| Estimate one power-unit/trailer combination independently                 | Economics                                  | Keyed to both equipment identities and owner revisions; no Load pairing.                                                                                  |
| Estimate one driver or driver-team cost profile independently             | Economics                                  | Separately versioned from equipment and Load estimates. Exact individual-driver/team unit is still to be specified.                                       |
| Estimate reusable Load-only route/time inputs                             | Economics                                  | Only when an input does not depend on a selected power unit, trailer, driver/team, or candidate Trip Plan. Exact estimate fields remain open.             |
| Estimate a candidate-specific route and schedule                          | Dispatch Planning                          | Uses the candidate's actual Load stops, resource/vehicle constraints, segment plan, repositioning, appointment windows, and availability.                 |
| Calibrate reusable stop/service-time assumptions                          | Economics, from Execution history          | Uses categorized completed-trip observations and an approved evidence window; Dispatch applies the applicable assumption to each candidate plan.          |
| Produce planning-specific estimates from owner facts and cost aggregates  | Economics                                  | Applies approved estimate models to standalone Load/resource scopes; does not own financial actuals, general financial reporting, or vendor integrations. |
| Refresh estimates and read models                                         | Economics                                  | Recompute affected independent estimates when a relevant source or model revision changes.                                                                |
| Combine a Load with a Trio                                                | Dispatch Planning                          | Selects matching Load, equipment, and driver/team estimates for the frozen planning inputs.                                                               |
| Candidate contribution, rates, and matching index                         | Dispatch Planning                          | Calculated for each feasible Load/Trio plan; Economics does not create per-pair estimates.                                                                |
| Combined economics/matching matrix and planning-cycle snapshot            | Dispatch Planning                          | Joins the selected estimates with the exact source revisions and hard-gate results for that attempt.                                                      |
| HOS availability, feasibility gates, ranking, reservation, and Assignment | HOS owner / Dispatch / Capacity Commitment | Economics supplies no HOS certification or operational decision. Dispatch applies the HOS result as a gate when that capability is approved.              |

Financial/Accounting is the planned owner of actual financial facts and
normalized cost aggregates/rates for approved time periods and operating
contexts, such as loaded/empty operation and territory. Its broader reporting,
analysis, and forecasting must remain distinct from Economics' planning-specific
estimates. Its financial truth includes posted/settled revenue and expense
actuals; Load remains authoritative for contracted revenue terms. The initial
planning cost inventory includes wages/payroll, fuel/taxes, tolls/permits,
maintenance/repairs/tires, and reefer fuel where applicable. Exact aggregate
dimensions and the service's formal name are open.

Fleet Readiness owns technical readiness and may consume verified repair and
ELD facts through their owning services or replaceable integration adapters.
Provider-specific connectivity and schema translation belong behind
replaceable integration boundaries, not inside Economics or Dispatch. The
exact grouping and deployment of those adapters is not selected.

Potential integration examples raised for future evaluation include
Trimble/PC*Miler routing; WEX, EFS, or FleetOne fuel cards; QuickBooks;
Samsara or Motive ELD; factoring providers; and repair, truck-wash, permit,
and toll networks. These are examples, not approved vendors, contracts, or
implementation prerequisites. An adapter may be an independently deployed
integration service where its operational boundary warrants one; do not
assume one service per vendor.

Economics never owns Load, Fleet Readiness, Execution, Financial/Accounting,
route-provider, HOS, or capacity source facts. Its estimate is a derived,
versioned opinion with explicit provenance, not a replacement for a source
record. It does not build a Load-by-Trio cross-product or calculate each
Load's interest to every truck.

## 2. Estimate lifecycle and timing

Economics does not run on the Dispatch allocation clock and has no selected
periodic full-fleet or full-Load recalculation job. It refreshes independent
estimate scopes in response to relevant source/model revisions. It does not
enumerate every Load/Trio combination, and a planning read is not a request
to calculate a pair.

### Source-change refresh

1. **A relevant input revision becomes available.** Examples are a new Load
   revision, a Fleet Readiness revision, an applicable
   Financial/Accounting aggregate revision, an approved provider result,
   an approved benchmark revision, or an Economics model version.
2. **Determine the affected independent scopes.** A Load revision affects
   that Load's estimate. A resource revision affects only estimates for the
   applicable equipment combination and/or driver/team scope. A financial
   aggregate revision affects only scopes whose approved period and
   operating context use that aggregate. The exact dependency map and
   aggregate dimensions remain to be defined; unrelated revisions must not
   trigger recalculation.
3. **Capture and validate exact inputs.** Economics records source identity
   and revision, observation/effective time, units/currency, and model and
   input-schema versions. Economics does not become owner of the source
   facts.
4. **Recalculate and publish affected estimates.** Create immutable new
   estimate records only for affected scopes whose source inputs changed or
   whose approved model changed. Update the applicable latest-estimate
   read models and publish an update only after the estimate and outbox are
   committed. Retries are idempotent; historical estimates are not
   overwritten.

There is no approved scheduled recalculation cadence. External provider and
benchmark polling/refresh cadence, source subscriptions, precise scope
invalidation rules, and freshness thresholds remain open. If an external
source is refreshed by a schedule or webhook, that integration publishes a
versioned result; Economics reacts to that result rather than running its own
unbounded sweep of provider systems.

### Use during a Dispatch planning cycle

1. **Dispatch begins an external scheduled cycle, an event-triggered internal
   attempt, or an authorized exception.** It freezes a
   consistent set of current Load, Registry, Fleet Readiness, CC, policy,
   and preference revisions. It evaluates direct eligibility and
   compatibility facts to identify the relevant candidate Loads and
   resources. Missing/stale owner projections trigger reconciliation and
   block the affected decision.
2. **Dispatch resolves the needed estimate scopes.** From those relevant
   candidates, it forms the unique set of exact Load revisions, equipment
   combinations, and driver/team scopes needed by the cycle. It consumes
   Economics update facts and may issue one bounded batch read for those
   scopes—not one calculation request per Load/Trio pair and not a read of
   every company Load and resource.
3. **Economics returns existing applicable versions and explicit gaps.**
   A read returns the exact estimate records plus missing, stale, or
   incomplete scopes. The read itself does not silently launch an
   unbounded recalculation or return a candidate score. If a scope has no
   suitable estimate, its source/model refresh follows the source-change
   process; Dispatch holds that candidate for visible review or a later
   attempt.
4. **Dispatch obtains plan-specific route results.** For the remaining
   relevant candidate plans, Dispatch uses the provider-neutral routing
   boundary to obtain estimates that depend on the selected vehicle,
   route/segments, or repositioning. It persists their provenance in the
   planning attempt. Economics may own a reusable Load-only route/time
   estimate only when it does not depend on a chosen resource or candidate
   plan; Dispatch must not treat that baseline as a substitute for a
   vehicle/plan-specific route result.
5. **Dispatch completes feasibility, then computes pair economics.** It
   applies all hard gates, including the candidate-specific route/schedule
   check, before ranking. For hard-gate-passing candidates with complete
   required economic inputs, Dispatch combines the standalone estimates
   with plan-specific route, deadhead, repositioning, and stop-time inputs.
   Dispatch computes net estimated revenue, attributable variable cost,
   contribution, rates, matching index, and the combined matrix. It records
   the exact estimate IDs/versions and owner revisions used.
6. **Freeze the attempt.** A source change after the attempt snapshot is
   frozen does not rewrite it. Use the revised estimate in a later cycle or
   an explicitly approved revalidation flow.

External Dispatch cycle times are defined by the
[shared planning policy](../contracts.md#initial-dispatch-planning-policy);
internal attempts begin on the exact current `READY` Load revision or a
relevant owner-fact change. Neither is an Economics recalculation cadence.
Economics does not wait for or initiate an Assignment decision. It supplies independent inputs;
Dispatch owns candidate-specific feasibility, pair calculations, ranking,
Reservation requests, and Assignment decisions. An Economics gap is not by
itself proof that a resource is ineligible or that capacity is unavailable,
but a candidate requiring a missing estimate cannot be scored or
automatically finalized using an unapproved substitute.

## 3. Inputs, ownership, and source precedence

The selected precedence is **company owner facts and actuals/quotes first,
provider estimates second, official public benchmarks as an explicitly
labeled fallback**. A fallback is usable only when its series, effective
period, units, and applicability have been approved. No source may be silently
substituted. The order between a current customer quote and a historical
settled actual for a particular cost field still needs a field-specific rule.

| Information                                                                                    | Authoritative owner/source                                                                                                                   | Economics use and current status                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Contract linehaul, approved accessorials, documented deductions, Load stops, and Load revision | Load Service                                                                                                                                 | Read the exact Load revision. Revenue inputs follow the signed commercial terms; accounting outcomes validate realized revenue. The exact owner event/API and field mapping are open.                                                                                                                                                                                                                                                                                    |
| Power-unit, trailer, driver/team identity, configuration, and owner revisions                  | Fleet Readiness                                                                                                                              | Used to identify the independent resource estimate and its approved applicability. Fleet Readiness is not authoritative for wages, fuel invoices, tolls, or accounting costs. Exact resource profile attributes are open.                                                                                                                                                                                                                                                |
| Financial actuals, quotes, and context-specific cost aggregates/rates                          | Financial/Accounting (planned), consuming company accounting, payroll, fuel, maintenance, and purchasing facts through approved integrations | Financial/Accounting owns posted/settled revenue and expense actuals and the normalized aggregates Economics consumes. The initial cost inventory includes wages/payroll, fuel/taxes, tolls/permits, maintenance/repairs/tires, and reefer fuel where applicable. Periods may include annual, monthly, weekly, daily, or hourly views; contexts may distinguish loaded/empty operation and territory. Exact dimensions, source fields, and allocation rules remain open. |
| Candidate-specific route distance and travel duration                                          | Trimble Maps / PC*Miler behind the provider-neutral route-estimation boundary (D-518), requested by Dispatch Planning                        | Used for a specific candidate vehicle/route/segment plan and retained in Dispatch's planning-attempt provenance. The provider adapter/deployment and detailed handoff remain open. Routing is an estimate, not legal or safety authority.                                                                                                                                                                                                                                |
| Reusable Load-only route distance/duration, when independent of selected resources             | Provider-neutral route-estimation boundary; initial provider choice is Trimble Maps / PC*Miler (D-518)                                       | Economics may retain a standalone estimate only when it is reusable without choosing a vehicle, driver/team, or candidate plan. It cannot replace Dispatch's candidate-specific route estimate; exact fields and handoff remain open.                                                                                                                                                                                                                                    |
| Stop/work service duration                                                                     | Company completed-trip history from Execution (D-519), categorized by stop/work type                                                         | Economics calibrates and versions reusable stop/service-time assumptions when evidence supports them. Dispatch applies the applicable values to candidate-specific schedules. Execution history cohort, categories, sample sufficiency, and production handoff remain open.                                                                                                                                                                                              |
| Fallback market benchmarks                                                                     | Official public datasets, only after field-level approval                                                                                    | Candidate references include EIA diesel-price series, BLS wage/labor statistics, and ATRI trucking-cost studies. These are candidates, not approved runtime inputs; series, geographic/temporal fit, availability, licensing, and update cadence must be verified.                                                                                                                                                                                                       |

For each value used, preserve whether it is **actual, quoted, or estimated**,
its source/reference and revision, currency and unit, effective/observed time,
and any applicable model or benchmark version. Company actuals are used to
validate estimates; they are not transformed into universal defaults without
an approved allocation rule.

Economics should consume revisioned owner facts, Financial/Accounting
aggregates, provider-adapter results, or approved benchmark snapshots; it
should not scrape source systems or place provider credentials in Dispatch
Planning. Exact source-owner event names, APIs, authentication, data
licensing, and refresh mechanisms remain open.

Financial/Accounting outputs must support auditable analysis across time
periods and operating contexts. Analysts should be able to use that history
and its forecasts for charts, comparisons, and deeper analysis; whether the
reporting and visualization surface is part of Financial/Accounting or a
separate read-only consumer remains open.

The first calculation tests should use deterministic simulated inputs through
the same replaceable source ports intended for later integrations. They should
validate estimate behavior and provenance without requiring live provider,
accounting, repair, or ELD connections. Replacing a simulated adapter must not
move source ownership or change the core estimate contract.

## 4. Calculations and calculation ownership

### Economics-owned independent estimates

Economics will calculate and retain separate estimates for:

- a **Load revision**, including standalone Load-scoped economic inputs and
  reusable route/service-time estimates only where those values do not
  depend on selecting a resource or candidate plan;
- a **power-unit/trailer combination**, including its approved independent
  operating-cost inputs/rates; and
- a **driver or driver-team scope**, including its approved payroll/labor
  inputs/rates.

These are input estimates, not final Load profitability or candidate scores.
Exact formulas for converting each source into standardized Load,
equipment-combination, and driver/team estimate fields are not yet selected.
Do not implement guessed fuel-consumption coefficients, cost allocations,
fallback constants, or hidden confidence penalties.

| Output/input product                  | Scope and source data                                                                                                                                                                                                                                                                                                  | Boundary                                                                                                                                                                                                                                                                                 |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Load-scoped estimate                  | Exact Load revision: contracted linehaul, approved accessorials, documented deductions, ordered stops, and other approved Load-level inputs. A reusable distance/duration estimate may be included only if it does not depend on the selected resources or candidate plan.                                             | Does not calculate candidate net revenue, contribution, profitability, or matching score; Dispatch applies the Load terms in its pair calculation.                                                                                                                                       |
| Equipment operating-cost estimate     | One power-unit/trailer combination and the exact Fleet Readiness revisions/configuration, joined to applicable Finance-owned period/context aggregates and approved provider facts. Candidate inputs may include fuel/tax, toll/permit, attributable maintenance/repair/tires, and reefer-fuel costs where applicable. | Economics estimates independent equipment costs/rates; it does not decide whether a Load fits the equipment or compute candidate deadhead/repositioning.                                                                                                                                 |
| Driver/team labor estimate            | One approved driver or driver-team scope and its Fleet Readiness revisions, joined to applicable Finance-owned wage/payroll and employer-cost aggregates.                                                                                                                                                              | Economics estimates independent labor cost/rates; the exact driver/team scope and allocation rules remain open. It does not determine driver eligibility or HOS.                                                                                                                         |
| Reusable stop/service-time assumption | Execution's completed-trip history, categorized by approved stop/work type and evidence window.                                                                                                                                                                                                                        | Economics calibrates/version-controls reusable assumptions when evidence is sufficient and approved. Dispatch chooses/applies the relevant assumption to candidate stops and computes plan duration. This is a planning input, not a fourth estimate-record scope in the current target. |
| Candidate-specific route result       | Candidate Load stops, selected vehicle constraints, route/segment plan, and repositioning, requested from the provider-neutral routing boundary.                                                                                                                                                                       | Owned and retained by Dispatch Planning as planning-attempt provenance. It is not an Operational Economics estimate.                                                                                                                                                                     |

Economics does not request or compute a route estimate for every possible
Load/resource pairing. When vehicle configuration, a selected segment plan,
or repositioning changes the route result, Dispatch obtains and records that
candidate-specific estimate as part of feasibility and planning. Economics'
optional Load-only baseline is not a hard-gate pass and cannot be substituted
for the candidate-specific result.

Financial/Accounting owns the general actuals and period/context cost
aggregates. Economics consumes those versioned outputs and applies its
approved planning-specific estimation models to Load/resource scopes. It
does not recreate the financial ledger, re-aggregate raw transactions, or
turn general financial reports/forecasts into a Load/Trio decision.

### Dispatch-owned pair calculations

The D-527 matching economics policy is selected. For a feasible Load/Trio
plan, Dispatch applies the exact Load, equipment, driver/team, and route/time
inputs and calculates:

1. **Net estimated revenue:** contracted linehaul plus approved accessorials
   minus documented customer/broker deductions.
2. **Directly attributable variable cost:** the approved sum of applicable
   fuel and fuel taxes; driver wages and employer payroll costs; tolls and
   route-specific permits/escorts; and directly attributable equipment costs
   such as maintenance, tires, and reefer fuel.
3. **Contribution:** `net estimated revenue - directly attributable variable
cost`.
4. **Contribution margin:** `contribution / net estimated revenue`, reported
   as a percentage. Behavior when revenue is zero or negative remains to be
   defined.
5. **Plan-mile rate:** plan contribution divided by total operational miles.
   Include deadhead and the shipment route, plus loaded/empty repositioning
   miles when they belong to the proposed plan.
6. **Plan-hour rate:** the same plan contribution divided by committed hours.
   The D-527 initial deadhead estimate is 50 miles/hour; include two hours
   for unloading and the approved stop-service and route-duration estimates.
7. **Matching index:** multiply the plan-hour rate by the plan-mile rate.
   If both rates are positive, use their product; if both are negative, use
   the negative of the product of their absolute values; if either is zero,
   use zero. Opposite signs indicate inconsistent inputs and require review,
   not a silent ranking.

Fixed monthly overhead is excluded from the matching index and allocated
separately for accounting. A negative index is not itself a hard-gate failure.
Dead zones are excluded from the index; the proposed 10% margin tie-breaker is
deferred. Dispatch—not Economics—applies the 60/40 system/dispatcher ranking
policy, hard gates, coverage/remainder optimization, and any approved
tie-breakers.

The authoritative input source and allocation method for every variable
cost, treatment of taxes/credits, units/rounding, zero-denominator behavior,
and validation against company accounting/operating data remain open.
Economics does not determine HOS availability; the initial TMS does not
calculate or certify regulatory HOS compliance.

## 5. Persistence, versioning, and read models

### Target ownership

Economics stores immutable estimate records in its own PostgreSQL boundary.
Each record is scoped to exactly one independent Load, equipment combination,
or driver/team revision and retains:

- stable estimate ID and subject identity/owner revision(s);
- estimate status and reason when incomplete;
- model, input-schema, and result-schema versions;
- exact source values/references/revisions, units/currency, and times used;
- result values, provenance, generation time, and database record time.

A source/model change appends a new record. It does not update the prior
record in place. Separate indexed read models expose the latest applicable
Load estimates and the latest applicable equipment/driver estimates. They are
not a Load-by-Trio matrix. Dispatch alone persists the combined matrix and the
cycle snapshot that references the exact estimate versions used.

The long-term retention, archival, and deletion policy is not selected.
Runtime access must not mutate historical estimate records; corrections are
new versions, not edits.

Financial/Accounting persists its actuals and normalized financial aggregates
in its own service boundary. Economics consumes versioned outputs through an
approved contract; services do not share tables or write into one another's
databases. The exact Financial/Accounting schema, read/update contract, and
aggregation dimensions remain open.

### Current implementation versus target

The repository does not currently calculate or publish operational
economics estimates. The current B4 package is persistence scaffolding, not
the selected target workflow. Its migration creates a generic
`economic_estimate_records` table
with `load` and `candidate` scopes, JSON input/result snapshots, model/schema
versions, provenance, and a content hash. Its runtime provides internal HTTP
create/read/list operations; its PostgreSQL runtime role can read/insert but
not update/delete or run DDL.

The scaffold does **not** yet support independent equipment-combination or
driver/team scopes, estimate calculation, source-change ingestion, separate
read models, stale/incomplete lifecycle, a transactional message outbox, or
RabbitMQ. Its `candidate` record shape is a scaffolding artifact, not the
target ownership model; Economics must not calculate or persist a
Load-by-Trio candidate index. Before implementing the selected target, add
forward-only schema/API migrations; do not edit the applied initial
migration.

## 6. Sharing with Dispatch Planning

Dispatch Planning is the initial consumer. It needs independent estimate
updates and the ability to retrieve an exact/bounded set of estimates for a
frozen attempt. It does not ask Economics to calculate every Load/Trio pair.

The selected target transport is RabbitMQ with durable request/outcome
handling and update events:

| Flow                 | Proposed message                     | Meaning                                                                                                                                                                                       |
| -------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Economics → Dispatch | `economics.estimate.updated.v1`      | A committed standalone estimate/read-model revision is available or is explicitly incomplete/stale. Contains its scope, estimate ID, model/source revisions, status, and retrieval reference. |
| Dispatch → Economics | `economics.estimate.read.v1`         | One bounded request containing the exact Load, equipment-combination, and driver/team scopes/revisions needed for a frozen attempt—not a list of Load/Trio pairs.                             |
| Economics → Dispatch | `economics.estimate.read.outcome.v1` | Returns the exact matching estimate records and explicit missing/stale/incomplete scopes for that request. It does not return pair contribution or matching-index calculations.               |

Messages use the shared TMS envelope, correlation/causation IDs, and
idempotency. Economics commits estimate state and its outbox item atomically;
publication is durable and duplicate delivery is safe. Dispatch records the
estimate IDs and versions in its own matrix snapshot. Queue/exchange names,
bindings/ACLs, batch-size limits, retry/parking policy, and exact JSON payload
schemas are proposed contract work, not implemented broker topology.

Only Dispatch receives these Economics outputs in the initial scope. Load,
Fleet Readiness, Execution, accounting, HOS, and Operations View do not
receive candidate scores from Economics. Any additional consumer needs an
explicit owner contract and data-access policy.

The current internal HTTP persistence API is for local scaffolding and is
not the selected production sharing mechanism. It has no application
authentication. Production exposure is prohibited until the message/read
contract, authorization, security review, and operational recovery are
approved.

## 7. Missing, stale, and invalid inputs

- A missing or stale required input produces an explicit incomplete result
  with a reason; it must not produce a success-shaped numeric estimate using
  an invisible default.
- A prior estimate remains available for audit but is not treated as current
  when its source/model revisions fail the applicable freshness rule.
- Dispatch receives the missing/stale scope and holds that candidate for
  visible human review. It does not calculate or rank a candidate index from
  stale or incomplete required inputs.
- A public/provider fallback can satisfy an input only after that field's
  fallback series, applicability, freshness, and approval status are
  configured and recorded. Otherwise the scope remains incomplete.
- A source/model change during an already frozen planning attempt does not
  rewrite its snapshot; use the updated estimate in a later attempt or an
  explicitly approved revalidation flow.

Exact status/reason codes, freshness thresholds, alerting, source-failure
retry limits, and manual-review/override permissions remain to be specified.

## 8. Decisions still needed before calculation automation

1. Define the Financial/Accounting actual and aggregate schemas, period and
   operating-context dimensions, source lineage, and integration/read/update
   contracts; map every cost/revenue/time field to its authoritative owner,
   revision, and approved fallback series.
2. Approve the standalone estimate result schemas, currencies/units, rounding,
   model coefficients, and allocation formulas; decide whether a driver scope
   means one driver or an assigned driver team.
3. Approve replaceable adapter contracts and route/service-time handoff to
   Dispatch for candidate-specific routing and, if retained, the optional
   Economics Load-only route/time estimate; define evidence sufficiency for
   Economics' reusable historical stop-time calibration. Keep vendor
   credentials and protocol-specific behavior out of the TMS core.
4. Define the axes, freshness selection, and query keys of the separate Load
   and resource read models.
5. Finalize RabbitMQ topic schemas, exchange/queue names, ACLs, bounded
   estimate-read batch limits, retries, duplicate handling, and
   replay/recovery procedures.
6. Approve retention/archive, security, monitoring, and model-validation
   policies before production deployment or automatic use.

Until these are closed and validated against company data, estimates and
matching calculations must remain visible for review and must not silently
enable automated matching or Assignment activation.

## Related specifications

- [D-527 matching/economics policy](./DECISIONS.md#d-527--use-complexity--zone--and-mileage-aware-balanced-matching)
- [Shared planning contract](../contracts.md#initial-dispatch-planning-policy)
- [Operational Economics internal persistence OpenAPI](../api/operational-economics.openapi.yaml)
- [Operational Economics target message contract](../api/operational-economics.asyncapi.yaml)
- [Current service scaffold README](../../services/operational-economics/README.md)
