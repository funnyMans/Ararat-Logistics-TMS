# TMS maps and diagrams

This directory contains the system's visual reference maps, grouped by
concern. The SVG files are standalone vector graphics rather than embedded
Mermaid blocks to provide consistent rendering, zooming, and printing across
Markdown viewers.

These visuals summarize the requirements; they do not replace the owning
documents. Where a diagram and its source text differ, the linked decision,
contract, or workflow document is authoritative. Message labels shown
conceptually are not implementation-ready contracts unless the service
specification says so.

## Architecture

- [Service dependency map](architecture/service-dependencies.svg) — service
  authorities and the direction of their most important facts, commands, and
  projections.
- [TMS ecosystem boundary](scope/tms-ecosystem-boundary.svg) — internal
  responsibilities, external actors, integrations that remain open, and
  explicit exclusions from current scope.
- [Runtime deployment views](runtime/README.md) — the implemented local
  Compose stack compared with the logical target deployment pattern.

## API edge

- [Client API edge options](api/client-api-options.svg) — current Gateway and
  owner APIs, alongside the possible future Apollo Federation edge and the
  boundaries it must preserve. The recommendation and decision gates are in
  [API edge options](../api/API_EDGE_OPTIONS.md).

## Load lifecycle

- [Booking through closeout](load-lifecycle/booking-to-closeout.svg) — the
  technical owner handoffs from a booking request through planning,
  reservation, Assignment, Execution, and Load closeout.
- [Technical interaction sequence](load-lifecycle/technical-interaction-sequence.svg)
  — actors, HTTP, RabbitMQ, Temporal, owner databases, and the timing of the
  principal handoffs. Exact open message contracts are marked as such.
- [Cancellation and release](load-lifecycle/cancellation-release.svg) — the
  pending cancellation workflow, parallel owner confirmations, atomic
  capacity handling, and reconciliation outcomes.
- [Partial failures and recovery](load-lifecycle/partial-failures.svg) — the
  required behavior when HTTP, message delivery, workflow coordination,
  reservations, Assignment activation, or Execution handoff fail.

## Dispatch planning

- [Rolling reservation and replanning](planning/rolling-reservation.svg) —
  the 14-day/five-Load bound, final-Load re-ranking rule, slot opening, and
  event-driven replanning feedback.

## Owners and related documents

| Map                                | Authoritative source                                                                                                              |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Service dependency map             | [System blueprint](../trucking/TMS_SYSTEM_BLUEPRINT.md), [service interaction map](../trucking/SERVICE_INTERACTION_MAP.md)        |
| TMS ecosystem boundary             | [TMS scope](../trucking/TMS_SCOPE.md), [system blueprint](../trucking/TMS_SYSTEM_BLUEPRINT.md)                                    |
| Technical interaction sequence     | [Technical workflow](../trucking/TECHNICAL_WORKFLOW.md), [service contracts](../contracts.md)                                     |
| Partial failures and recovery      | [Technical workflow](../trucking/TECHNICAL_WORKFLOW.md#end-to-end-sequence), [service contracts](../contracts.md)                 |
| Booking through closeout           | [Technical workflow](../trucking/TECHNICAL_WORKFLOW.md), [service interaction map](../trucking/SERVICE_INTERACTION_MAP.md)        |
| Cancellation and release           | [Technical workflow](../trucking/TECHNICAL_WORKFLOW.md#cancellation-and-downstream-release), [service contracts](../contracts.md) |
| Rolling reservation and replanning | [Decision log](../trucking/DECISIONS.md), [technical workflow](../trucking/TECHNICAL_WORKFLOW.md)                                 |
| Client API edge options            | [API edge options](../api/API_EDGE_OPTIONS.md), [API specifications](../api/README.md)                                            |
| Runtime deployment views           | [Target architecture](../trucking/TMS_SYSTEM_BLUEPRINT.md), [local environment](../../infra/README.md)                            |

When an approved rule changes, update the authoritative text first and then
revise the corresponding SVG and index entry. Keep diagrams focused on one
concern; do not make a visual shorthand the sole record of a business rule
or contract.
