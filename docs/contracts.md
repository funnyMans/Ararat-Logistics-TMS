# TMS service contracts

The TMS domain owners include Load, Dispatch Planning, Capacity Commitment
(CC), Execution, and Notification. Their contracts represent business
decisions and facts, not a shared database schema. Validate every request at
the receiving service; a TypeScript type does not validate runtime data.

## Contract ownership

- Load defines the ready-load commands and queries, requirements, and
  revision history.
- Dispatch Planning defines full-pool matching, explainable policy decisions,
  nominations/preferences, exception outcomes, and the canonical Assignment.
- CC is a standalone peer service. It defines the commitment/Reservation
  lifecycle and exclusive capacity-window claims, correlated to Dispatch
  Planning by a stable planning ID without sharing record or database
  ownership.
- Execution defines progress facts, exception handoffs, evidence, completion,
  and correction records.
- Notification defines actionable inbox records, recipients, acknowledgements,
  and delivery attempts; it does not own the underlying business fact.
- Identity defines authenticated principals and role grants. A caller's
  grants are authorization inputs; each owning service still checks the
  resource-specific authority and state transition.
- `packages/contracts` may hold stable transport types and schemas used at
  multiple boundaries. Do not move domain policy there merely to share it.

## Cross-service guarantees

Before implementing a cross-service workflow, define:

- Stable load, assignment, capacity, and execution identifiers.
- The exact authorization and load-readiness checks.
- The response if Dispatch persists an assignment but Execution cannot
  create its execution record.
- Idempotency behavior for retried commands and duplicate delivery.
- How pending/failed work is inspected, retried, and reconciled.
- Which service owns each state transition and customer-safe projection.

Do not report a fully active assignment until the defined cross-service
invariants hold. Do not use distributed transactions or synchronous HTTP
service-to-service chains to coordinate business workflows. The selected
transport, workflow, and fan-out tools and their distinct responsibilities
are recorded once in the [TMS system blueprint](./trucking/TMS_SYSTEM_BLUEPRINT.md).
Exact message contracts, topology, and first-slice adoption remain to be
specified.

## Event envelope

Use a versioned, validated event envelope for durable business facts with:

`eventId`, `eventType`, `sourceService`, `version`, `occurredAt`,
`correlationId`, optional `causationId`, and a typed `payload`.

Events state facts that happened; commands request an owner to perform work.
Assume duplicate and delayed delivery. Consumers must validate, be
idempotent, expose failures, and define ordering and replay behavior.

## Evolution

Additive, backward-compatible contract changes may retain a version only
when old receivers can safely accept them. Breaking changes require a new
version and compatibility tests. Runtime parsing belongs at each receiver,
even when producers and consumers share generated types.

The complete first-slice API/event contract is a gate in the
[TMS system blueprint](./trucking/TMS_SYSTEM_BLUEPRINT.md); this note
intentionally does not invent endpoint or event names before domain states
are settled.
