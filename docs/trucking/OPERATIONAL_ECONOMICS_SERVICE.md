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

1. **A relevant input changes.** An authoritative owner revision, a
   Financial/Accounting cost-aggregate revision, a result from a replaceable
   provider adapter, an approved public-benchmark revision, or an Economics
   model version changes. The owning integration identifies the affected
   independent estimate scopes. Irrelevant source-field changes must not
   cause needless recalculation.
2. **Economics captures the exact inputs.** It records source identity,
   revision, observation/effective time, units/currency, and the model and
   input-schema versions used. The input snapshot is sufficient to explain
   and reproduce the estimate; it does not make Economics the fact owner.
3. **Economics validates and estimates each independent scope.** It produces
   a new immutable Load, equipment-combination, or driver/team estimate.
   Changed values create a new estimate version; existing history is not
   overwritten.
4. **Economics updates its read models and publishes the change.** A durable
   estimate-update event is published only after the estimate and its
   read-model pointer are committed. Retries are idempotent.
5. **Dispatch obtains the exact independent estimates it needs.** Dispatch
   consumes update events to keep a local projection current and may issue a
   bounded batch read for the exact subject revisions referenced by a frozen
   planning attempt. The batch is by estimate scope, not one request per
   Load/Trio pair.
6. **Dispatch calculates the pairing.** Dispatch combines the selected
   Load, equipment, and driver/team estimates with the plan-specific route,
   deadhead, and repositioning facts. It computes candidate contribution,
   the matching index, and its own matrix, then persists those exact estimate
   IDs/versions and values in the planning-cycle snapshot.

There is no scheduled recalculation cadence selected. Internal owner changes
should trigger updates by revision; external providers and public benchmarks
must refresh when their source publishes a new version or when an approved
refresh process retrieves it. The external polling cadence, freshness limits,
and exact event subscriptions remain to be defined. A source change received
after a planning attempt is frozen applies to a later attempt; it must not
silently mutate an in-progress matrix.

Economics does not wait for or initiate an assignment decision. A Load may
remain operationally held for missing/stale economics even while its source
record remains valid and active.

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
| Commercial route distance and travel duration                                                  | Trimble Maps / PC*Miler behind the provider-neutral route-estimation boundary (D-518)                                                        | The initial commercial routing provider is selected. Preserve request/profile/response provenance. Routing is an estimate, not legal or safety authority. Use a replaceable adapter; its deployment owner and the estimate handoff to Economics remain open.                                                                                                                                                                                                             |
| Stop/work service duration                                                                     | Company completed-trip history (D-519), categorized by stop/work type                                                                        | Calibrate and version assumptions from observed operations; dispatcher review remains until the evidence is sufficient and approved. Execution history cohort, categories, sample sufficiency, and delivery contract remain open.                                                                                                                                                                                                                                        |
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

- a **Load revision**, including approved Load-level commercial inputs and
  independent route/service-time estimates where those values do not require
  selecting a truck;
- a **power-unit/trailer combination**, including its approved independent
  operating-cost inputs/rates; and
- a **driver or driver-team scope**, including its approved payroll/labor
  inputs/rates.

These are input estimates, not final Load profitability or candidate scores.
Exact formulas for converting each source into standardized Load,
equipment-combination, and driver/team estimate fields are not yet selected.
Do not implement guessed fuel-consumption coefficients, cost allocations,
fallback constants, or hidden confidence penalties.

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

The current B4 package is persistence scaffolding, not the selected target
workflow. Its migration creates a generic `economic_estimate_records` table
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
   Economics; define evidence sufficiency for historical stop-time
   calibration. Keep vendor credentials and protocol-specific behavior out
   of the TMS core.
4. Define the axes, freshness selection, and query keys of the separate Load
   and resource read models.
5. Finalize RabbitMQ topic schemas, exchange/queue names, ACLs, batch limits,
   retries, duplicate handling, and replay/recovery procedures.
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
