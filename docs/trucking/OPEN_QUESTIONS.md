# TMS decision register

This page is the current list of decisions that remain open. The
[TMS system blueprint](./TMS_SYSTEM_BLUEPRINT.md) is the canonical place for
architecture decisions, status, rationale, dependencies, and consequences.
Do not resolve a question simply because an implementation would be easier
with an invented answer.

The first implementation slice has **not** been selected. The whole target
workflow is being defined first; a small slice can then be chosen from it.

## Decision gates before slice approval

1. **CC and Assignment protocol:** Define the idempotent transition between
   Capacity Commitment's hold/finalize/release state and Dispatch Planning's
   canonical Assignment decision. Specify which owner authorizes each
   transition, what happens on timeout, and how the state is reconciled.
2. **Commitment deadline and exception hold:** Define the deadline
   calculation, timezone, pickup-time-change behavior, exact hard gates
   before automatic Assignment, and how component claims are handled on
   expiry, failure, or release. The default remains automated Assignment;
   an unresolved, explicitly requested exception hold releases the load
   claim back to the queue at its deadline. Capacity availability remains a
   separate fact.
3. **Concurrent revisions:** Define how Load requirement revisions,
   commitment updates, and assignment decisions are serialized without a
   distributed transaction or synchronous service-call chain.
4. **First end-to-end slice:** Choose its actors, start conditions, data
   provenance, automated success path, human exception/replay/correction
   scenarios, and explicit placeholders. The chosen slice must exercise the
   selected infrastructure rather than hand-built substitutes.
5. **Eligibility and readiness source:** Identify which facts are trusted
   for the selected slice, who reports/verifies them, how stale facts are
   detected, and what the system must reject when facts are absent.
6. **Notification minimum:** Choose the actionable inbox events, recipient
   rules, acknowledgement behavior, and failure/recovery evidence for the
   initial implementation.
7. **Matching-policy parameters:** Select one measurable load/trip profile
   and define its hard eligibility gates, company-benefit factors, allocation
   objective across competing loads/capacity, preference weights and
   lookback, deterministic tie/conflict behavior, and exact planning horizon.
   Preserve the selected human-agency rules in the blueprint: strong
   avoid-preferences and explicit driver objections stop automatic
   finalization and enter a bounded human-review hold; no routine wiser
   approval; hard gates cannot be overridden.
   Do not create a generic score or claim legal validity without evidence.

## Open business policy

- Same-day emergency handling and after-hours/weekend assignment authority.
- How preference strength is captured, allocation/fairness weights and
  lookback, response/coverage times for an objection, and the detailed
  conversation/decision process. The selected baseline is that an objection
  or strong avoid-preference blocks automatic finalization and enters a
  bounded human-review hold; it is neither silently accepted nor an
  unqualified contractual/legal veto.
- Short/long trip classification, policy catalog, and detailed outbound/
  return-home differences. Preserve direction now; do not invent thresholds.
- Treatment of requirement/readiness changes before a commitment deadline,
  while preserving the agreed hard-gate failure outcome.
- Applicable employment, owner-operator, carrier-contract, safety,
  customer-contract, evidence-retention, and privacy requirements. These
  require authoritative sources and qualified review before they become
  executable rules.

## Open technical design

- Versioned command/event schemas, ownership, durable-message routing,
  retry bounds, dead-letter inspection, replay authorization, and schema
  compatibility.
- Which workflows need durable timers, signals, human waits, and
  compensation; identify workflow owners and operational repair paths.
- Which post-commit UI updates merit ephemeral fan-out and how clients
  recover by querying the owning service.
- Service deployment boundaries, data retention, backup/restore objectives,
  and security/operability objectives. Do not invent numeric SLOs or
  deployment requirements without usage and risk evidence.

## Park until a workflow requires it

Brokerage negotiations and external sourcing automation, managed-carrier
rate logic, fleet/maintenance/HOS integrations, customer and carrier portals,
settlement, billing, analytics, and broad CRM/ERP/TMS capabilities remain
target-system considerations, not implied first-slice requirements.

When resolved, record the decision and rationale in the blueprint, then
remove it from this open list.
