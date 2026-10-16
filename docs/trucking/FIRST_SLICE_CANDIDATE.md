# TMS first-slice candidate

**Status: proposed, not selected.** The [system blueprint](TMS_SYSTEM_BLUEPRINT.md)
owns the approved target architecture. This page records a candidate
direction only; it is not authorization to implement the full target.

An engineering vertical slice is not automatically the product MVP. Define
the MVP's users, operational value, scope, and release acceptance criteria
before selecting an engineering slice from it.

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

The first slice, exact scenarios, matching profile, and data sources remain
open. See [open decisions](OPEN_QUESTIONS.md).
