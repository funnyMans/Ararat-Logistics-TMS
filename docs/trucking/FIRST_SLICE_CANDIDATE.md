# TMS first-slice candidate

**Status: business vertical slice proposed, not selected.** The
[platform-foundation phase](TMS_SYSTEM_BLUEPRINT.md#approved-platform-foundation-increment)
is separately approved as the first implementation phase. This page records
a candidate business-workflow direction only; it is not authorization to
implement that workflow or the full target.

The coherent target operational scope is not defined as a narrow product MVP
or customer-facing showcase. An engineering vertical slice is an incremental
method for implementing and validating part of that target. Select it based
on technical risk, architectural learning, dependencies, system integrity,
and end-to-end verifiability, not feature count or demonstration value.

## Candidate direction

Start from a load that is ready for capacity planning. Exercise a small
vertical path through policy-driven matching, a distinct Capacity Commitment
and Assignment, execution progress, one human-owned exception, and completion
or correction.

The candidate should test routine automation as the default and an explicit
exception path. It should not turn supervisory approval into a prerequisite
for every assignment. Fixtures must identify their provenance and must not
claim to supply authoritative real-world facts.

## Selection gates

Before selecting this or another slice:

- Specify its actors, resource-level permissions, and start conditions.
- Identify trusted source facts and what happens when they are stale or
  absent.
- Resolve the CC/Assignment protocol, idempotency, deadlines, and recovery
  for the chosen path.
- Define measurable success and exception outcomes, including any
  placeholders and unsupported operations.
- Prove any platform capability on which the slice depends.

The later business slice, exact scenarios, matching profile, and data sources
remain open. In particular, planning implementation requires the source-fact
and calibration gates in items 15 and 21 of
[open decisions](OPEN_QUESTIONS.md).
