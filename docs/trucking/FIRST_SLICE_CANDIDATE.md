# TMS first-slice candidate

**Status: proposed, not selected.** This document preserves a candidate
vertical slice and its test scenarios; it does not approve implementation
scope. The [TMS system blueprint](./TMS_SYSTEM_BLUEPRINT.md) owns target
architecture and decisions. See the [business operating model](./OPERATING_MODEL.md)
for detailed operating hypotheses and the
[technical workflow](./TECHNICAL_WORKFLOW.md) for conceptual contracts,
records, and recovery behavior.

## Candidate boundary

Start with a load that is already ready for operations. The candidate path
is policy-driven capacity matching, automatic Capacity Commitment (CC),
separate Assignment, execution progress, one exception handoff, completion,
and an auditable correction. The broker's booking decision and full
brokerage/carrier sourcing processes are upstream. This candidate tests
routine automation as the default and a human-owned exception path; it does
not make supervisory approval a prerequisite for every assignment.

The intended learning is whether the model preserves commercial commitment,
capacity protection, human authority, and execution truth across failures.
It is not a customer-validated feature plan or a production-readiness claim.

## Select the slice only after these gates

- Confirm the selected actors, resource-level authority, load-ready
  requirements, and trusted source/provenance for capacity readiness.
- Settle the CC/Assignment asynchronous protocol, idempotency identity,
  stale-revision handling, and reconciliation owner.
- Define the exact deadline/time-zone rules and safe capacity-claim behavior
  needed by selected scenarios.
- Select minimum execution milestones, completion evidence, exception
  ownership, correction permissions, and customer-safe projection fields.
- Prove the selected messaging, workflow, and fan-out tools in their distinct
  target roles before choosing a slice that relies on them. Explicitly
  unsupported capabilities must not return success-shaped fake results.
- Choose a small subset of the scenarios below and convert it into exact
  state, message, permission, and recovery expectations.

## Candidate acceptance scenarios

These are scenario outlines, not a commitment to implement all of them in
the first slice:

1. **Successful movement:** a ready load has an accountable supervisor;
   Dispatch Planning evaluates the full eligible capacity pool and makes an
   explainable policy-driven selection; CC atomically protects the load and
   capacity window; current hard gates pass and no driver objection or strong
   avoid-preference is unresolved; the system finalizes the distinct
   Assignment without a routine approval click. The dispatcher can inspect or
   challenge it; Execution records progress and delivery evidence;
   completion and history are visible.
2. **Exception handoff:** a driver or carrier reports an issue; Execution
   records the facts; the accountable supervisor receives actionable work;
   the broker can communicate verified customer-relevant status; the issue
   is resolved or remains explicitly open.
3. **Readiness changes while committed:** a reported capacity change refreshes
   the CC snapshot/history and notifies the responsible people. Manual
   release requires a reason and verified component status/next availability.
   Missed manual review or failed auto-finalization releases the load claim
   to the queue, not an assertion that capacity is available.
4. **Capacity loss or changed requirements after Assignment:** before
   movement, preserve the changed requirements and original capacity facts;
   terminalize the old execution as `no_start` before safely releasing its
   claim; seek replacement capacity, then outside capacity, then broker-led
   amendment/cancellation. Once movement begins, use the Execution exception
   path and do not immediately release capacity.
5. **Competing claims:** concurrent requests for the same load or overlapping
   capacity windows are arbitrated atomically; the first valid transaction
   wins and the other receives a conflict. Non-overlapping future windows
   may coexist. Nominations alone reserve nothing.
6. **Customer change:** refresh an active commitment and notify the
   supervisor and dispatcher. Preserve requested/effective/recorded times,
   old/new requirements, affected capacity, execution milestone, and the
   decision for broker review.
7. **Partial failure and replay:** if notification delivery fails or
   Execution is unavailable after Assignment, preserve the authoritative
   claim, expose pending work, retry/reconcile idempotently, and create no
   duplicate execution or competing claim.
8. **Unassignment and status:** every policy-driven or authorized human
   unassignment records a structured reason; verified component status and
   next availability are retained. A load-side release does not mark healthy
   capacity out of service, and unknown availability does not return capacity
   to candidate lists.
9. **Day-before responsibility:** an unassigned ordinary load receives a
   reason, next-action owner, and due time (such as sourcing, a supervisor
   backlog, a dispatcher planning gap, or overbooking). The area broker
   remains commercially accountable.
10. **Correction:** an authorized post-completion correction preserves the
    original fact and audit history without reopening the execution.
11. **Preference conflict (optional slice scenario):** a strong
    avoid-preference or explicit driver objection prevents automatic
    finalization and enters a bounded, human-owned review hold; the supervisor
    records discussion and disposition. If unresolved by the hold deadline,
    release the load claim without asserting capacity availability.
12. **Competing loads and cancellation (optional slice scenario):** planning
    considers multiple feasible loads and capacity together, accounts for
    recorded preferences and prior outcomes, and explains when preferred
    loads are already claimed. A last-minute cancellation triggers a fresh
    availability/rest/preference assessment rather than automatic assignment
    to a disliked remaining load.

Exact states, evidence sources, permissions, initial capacity type, and
customer-visible fields remain contract decisions. Settle each before a
selected scenario depends on it; do not import every broad operating
hypothesis into the first implementation.
