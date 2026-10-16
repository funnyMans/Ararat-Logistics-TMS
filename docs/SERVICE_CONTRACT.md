# TMS HTTP service baseline

This document defines a minimal HTTP baseline for services that are
implemented. It does not claim that the target Identity or TMS business
services exist. For transport ownership and message semantics, see the
[service-contract guide](contracts.md).

## Health and readiness

| Endpoint       | Contract                                                                                                                                               |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /health`  | Report service identity, observed dependency health, and timestamp. Return HTTP 200 when the health document itself can be produced.                   |
| `GET /ready`   | Return HTTP 200 `{ "ready": true }` only when the service can accept its supported work; otherwise HTTP 503 with `{ "ready": false, "details": ... }`. |
| `GET /metrics` | Expose process and bounded-cardinality service metrics.                                                                                                |

Health reports observed process/dependency conditions. Readiness is the
service's decision to accept work. A dependency used only for a later
asynchronous effect need not prevent durable request acceptance. Document
and test service-specific readiness decisions.

## Request context and observability

Use `x-request-id` for a service-local request, `x-correlation-id` as a
business/workflow join key, and W3C Trace Context for distributed tracing.
Validate inbound values, propagate them deliberately, and avoid persisting
unneeded tracing baggage.

Logs, metrics, and traces are complementary. Do not put credentials,
personal information, customer-sensitive commercial details, or unbounded
identifiers in metric labels.

## API boundaries

- Authenticate and authorize requests according to the approved Identity
  design before exposing business operations. Identity is not implemented
  and its authentication and authorization contracts remain open.
- Validate body, path, query, and downstream response data at runtime.
- Give network calls finite deadlines and bounded, operation-safe retries.
- Return explicit authorization, validation, conflict, dependency, and
  internal errors. Do not turn unexpected failures into success or
  not-found responses.
- Keep customer-safe projections separate from internal operational data.
- Document and test state transitions, idempotency keys, and partial failure
  at cross-service boundaries.

## Current implementation

The API gateway currently exposes health, readiness, and metrics only.
Identity and TMS business routes are not implemented. Do not describe the
gateway as an authenticated product API until the Identity boundary and
request authorization are designed and implemented.
