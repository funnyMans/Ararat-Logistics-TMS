# Dispatch Planning (B4 scaffolding)

This package currently contains offline planning evidence and provider-request
scaffolding only. It has no service runtime, credentials, database, broker
topology, Dispatch API, matching allocator, or Assignment activation path.

## Trimble Route Reports sandbox capture

`createTrimbleRouteReportsRequest` builds a request for the documented
PC*Miler Route Reports POST endpoint. It requires an explicit lane reference,
data version, vehicle-profile reference, route options, and at least two
coordinates. Route options cannot override the stop list or requested reports.
The helper does not perform network requests and never accepts or stores API
credentials.

After an authorized sandbox call is performed separately, pass its HTTP
status, exact response body, request time, and response time to
`captureTrimbleRouteReportsResponse`. The capture rejects non-success
statuses, invalid JSON, oversized bodies, and impossible timestamps. It
returns the provider response and SHA-256 provenance for the exact request
body and response bytes. Treat route contents as potentially sensitive; do
not put credentials in the request body or logs.

The capture is not route validation: it does not interpret mileage or travel
time, compare estimates with actual outcomes, or prove that vehicle/load
options are complete. Provider output is not legal or safety authority.

## Candidate snapshots

`freezePlanningCandidateSnapshot` validates and freezes the exact candidate
evaluations and source revisions for a planning attempt. Only candidates
whose hard gates all pass can carry ranking values or appear in the frozen
feasible set. It does not allocate Loads to Trios, reserve capacity, or
activate Assignments.

Automated Dispatch remains disabled until owner-approved inputs, the full
Fleet Readiness catalogue, matching-policy acceptance, historical replay,
and recovery evidence pass the documented B4 gates.

Provider reference: [PC*Miler Route Reports POST](https://developer.trimblemaps.com/restful-apis/routing/route-reports/post-route-reports/).
