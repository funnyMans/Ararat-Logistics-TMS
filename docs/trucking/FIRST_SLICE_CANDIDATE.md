# TMS first business increment

**Status: selected bounded increment.** The first business increment is
Load booking and outcome reads. It is intentionally narrower than the
eventual booked-Load-to-Execution-closeout target and does not constitute a
customer-facing release or a decision to implement the target in one
delivery.

The existing planning/matching candidate is not selected. Its dependent
automated gates remain blocked on approved source-backed Fleet facts,
route-estimate source, calibrated service-time assumptions, and the numeric
deadhead allowance.

## Selected scope

Implement the Load-owned path for a handling broker to submit a booking and
retrieve its durable submission outcome and accepted Load. The path begins
when the broker has made the commercial decision to book and has the required
Load facts. It ends when the Load service has durably accepted or rejected
the submission and the caller can retrieve that result. A committed accepted
booking may leave planning work pending; it does not reserve capacity,
create an Assignment, or claim that execution has started.

### Actors and trusted facts

- The handling broker supplies the requested commercial commitment, Customer
  identifier, stop and freight details, and idempotency key.
- Counterparty Registry owns Customer identity and status. A new booking
  requires the latest applied Customer status to be `ACTIVE`; missing or
  stale status must be reconciled, and unavailable status fails closed using
  the documented retryable `503` outcome.
- Load owns the durable booking submission, accepted Load, initial immutable
  revision, and planning outbox state. Its committed state, not a gateway
  response or downstream projection, is authoritative.
- The Load service assigns business identifiers and records accepted or
  rejected outcomes. Planning, capacity, Assignment, and Execution state are
  outside this increment.

### Permission boundary

The [Load booking/read matrix](DECISIONS.md#d-513--scope-load-booking-and-read-access)
is selected. A broker may submit rows only for granted areas and becomes the
handling broker for each created Load. Handling brokers read their own Loads;
area supervisors read within their grants; chief supervisors and
transportation executives read company-wide. Submission outcomes are visible
to their creator, or to another actor only when authorized for every
included Load; rejected outcomes remain creator-only. All other access is
denied by default. No dispatcher, driver, Customer, or Carrier portal access
is added.

### Outcomes and acceptance

- A well-formed submission returns a durable accepted or business-rejected
  outcome. A rejected outcome has no Load references; an accepted outcome
  identifies each created Load and may report follow-up work.
- A retry with the same idempotency key and normalized content replays the
  same result without creating duplicate submissions, Loads, revisions, or
  outbox records. Reusing the key with different content conflicts.
- Booking-critical validation is all-or-nothing. The rejected attempt is
  retained for correction and creates no Load.
- An accepted result is returned only after the Load, initial revision,
  submission result, and planning outbox records commit atomically.
- A lost HTTP response followed by a retry returns the committed result.
  A database commit failure never returns booking success.
- If Customer status is missing or stale and its owner is unavailable, the
  request fails with the documented retryable `503` and creates no
  submission. Broker-facing error and projection-reconciliation behavior
  must be covered by acceptance tests.
- If RabbitMQ is unavailable after the Load transaction commits, booking
  remains successful and the outbox item remains recoverable; no downstream
  planning success is implied.
- Verify one-row accepted and rejected submissions, durable outcome reads,
  idempotent replay, conflicting key reuse, Customer-status dependency
  failure, transaction failure, and outbox recovery before accepting this
  increment.

## Explicit exclusions

This increment does not implement Load amendments or cancellation, Customer
or Carrier onboarding, Fleet Readiness, automated planning or route
estimation, Capacity Commitment, Assignment, tendering, Execution, evidence,
notifications, or operational dashboards. Those responsibilities remain
under their existing service owners and readiness gates.

## Implementation gates

The repository already defines substantial booking and read contracts in
the [Load API](../api/load.openapi.yaml) and
[service contract](../contracts.md). Before implementing the protected
business routes, complete the remaining applicable Load and Identity gates in the
[readiness matrix](IMPLEMENTATION_READINESS.md), including exact
request/response and validation behavior, the Customer-status integration
and stale/unknown recovery, authentication implementation, and measurable
nominal/failure acceptance. D-513 settles the initial human access matrix;
do not choose unresolved integration or policy behavior by implementation
convenience.
