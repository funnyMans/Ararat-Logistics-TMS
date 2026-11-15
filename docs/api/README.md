# TMS API and message specifications

This directory contains the canonical machine-readable specifications
required by D-508. Business meaning remains in the
[shared service-contract guide](../contracts.md); logical persistence
boundaries remain in the [technical workflow](../trucking/TECHNICAL_WORKFLOW.md).
The future-facing client-edge recommendation is documented separately in
[API edge options](./API_EDGE_OPTIONS.md); it does not add routes or approve
GraphQL/Federation implementation.

## Current specifications

| Service               | Specification                                     | Coverage                                                                                                                                                |
| --------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Load                  | [OpenAPI](./load.openapi.yaml)                    | Booking submissions, Load reads and revisions, and cancellation requests.                                                                               |
| Load                  | [AsyncAPI](./load.asyncapi.yaml)                  | Load-owned facts, Customer booking-fact/watermark consumption and reconciliation, and cancellation-request snapshot exchange.                           |
| Counterparty Registry | [AsyncAPI](./counterparty-registry.asyncapi.yaml) | Sequenced Customer booking facts, completeness watermarks, and snapshot reconciliation consumed by Load; other Registry contracts remain open.          |
| Execution             | [OpenAPI](./execution.openapi.yaml)               | Evidence-upload intent, finalization, and status operations.                                                                                            |
| Execution             | [AsyncAPI](./execution.asyncapi.yaml)             | Planned-Execution cancellation exchange; other Execution messages remain open.                                                                          |
| Capacity Commitment   | [AsyncAPI](./capacity-commitment.asyncapi.yaml)   | Reservation, confirmation, full release, and complete replacement messages; local PostgreSQL owner implementation is in `services/capacity-commitment`. |
| Dispatch Planning     | [AsyncAPI](./dispatch-planning.asyncapi.yaml)     | Planning/cancellation interactions, Assignment facts, and Capacity Commitment interactions currently specified in the shared guide.                     |
| Operational Economics | [OpenAPI](./operational-economics.openapi.yaml)   | Internal estimate-record persistence scaffold only; calculation models and production security are unresolved.                                          |
| Operational Economics | [AsyncAPI](./operational-economics.asyncapi.yaml) | Target-draft independent estimate updates and bounded read request/outcomes for Dispatch; not implemented.                                              |

Specifications explicitly mark incomplete inventory or operation details
with `x-contract-status` and `x-unresolved-contracts`. Do not interpret a
partial file as authorization to invent undocumented behavior.

## Validation and conventions

- The target contract format is OpenAPI 3.1 and AsyncAPI 3.0.
- Runtime request/message validation and CI compatibility checks are required
  by D-508.
- In OpenAPI request fields that must preserve durable domain rejections or
  accepted follow-up behavior, `x-tms-expected-shape` records the canonical
  valid value shape without forcing pre-domain rejection. The owning service
  must apply the behavior specified in the shared contract; ordinary
  structural validation must not erase those outcomes.
- `x-tms-authorization` records the operation-level role, resource, and
  concealment policy selected for the operation. For Load booking and reads,
  this is the D-513 contract, not implementation evidence.
- Each service-owned file documents only its owner boundary. Commands are
  defined by their receiving owner; facts are defined by their authoritative
  publisher. Cross-file schema references preserve that ownership.
- `counterparty-registry.asyncapi.yaml` specifies only the Registry-owned
  Customer status/legal-name fact required by Load booking, its completeness
  watermark, and snapshot reconciliation exchange; it is not a complete
  Registry API.
- The specifications are not implementation evidence. No service, runtime
  validator, topology, or CI compatibility check is claimed to exist merely
  because a contract file is present.

## Remaining contract work

The Operational Economics OpenAPI file documents an internal persistence
scaffold, not a production estimate-calculation API. Its AsyncAPI file is a
target draft: estimate-update events and batch reads are selected, but source
subscriptions, detailed payloads, and deployment topology are not implemented
or approved. Other HTTP owners beyond Load, Execution, and this internal
scaffold still have open route inventories; no HTTP surface should be
inferred from the logical service boundary alone. The shared register also
tracks remaining message inventories and payloads, general snapshot
reconciliation messages, and operation-specific behavior.
