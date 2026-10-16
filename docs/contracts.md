# TMS service contracts

The TMS domain owners include Counterparty Registry, Fleet Readiness, Load,
Dispatch Planning, Capacity Commitment (CC), Execution, Notification,
Identity, and the read-only Operations View. Their contracts represent
business decisions and facts, not a shared database schema. Validate every
request at the receiving service; a TypeScript type does not validate
runtime data.

## Contract ownership

- Load defines booking submissions, stage completeness, requirements,
  ordered requested stops, and immutable revision history.
- Counterparty Registry owns distinct Customer and Carrier master records,
  status, external business references, and organization-level contacts. A
  legal organization may have both profile types with independent identifiers
  and lifecycles. Carrier capacity/qualification and Load commercial terms
  remain owned by their respective domains.
- Fleet Readiness owns operational driver/equipment records and
  availability/readiness facts. Dispatch Planning consumes those versioned
  facts; Capacity Commitment owns reservations. Fleet Readiness does not own
  HR, payroll, maintenance, or compliance case management.
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
- Operations View consumes owner facts into read-only operational
  projections, tracks projection freshness, and never owns a business
  decision or accepts authoritative writes.
- Identity owns principal accounts, authentication/session lifecycle, and
  issued identity context. Initial accounts cover staff and in-house and
  contracted drivers; customer and carrier office accounts are deferred,
  while the target model remains extensible to them. Identity stores
  authentication data and role grants, not employee, driver, customer, or
  carrier operational profiles.
- Identity issues OIDC tokens using Authorization Code with PKCE. Access
  tokens use `RS256`; receiving services reject `none` and unconfigured
  algorithms. Tokens carry principal/session facts and current role grants and
  scopes. Each business owner maps grants to actions and checks access to its
  own records and transitions. The gateway authenticates and routes but does
  not make domain authorization decisions.
- Accounts are invitation-only. Identity administrators are separate from
  transportation roles; privileged grant changes require two-person
  approval by distinct people, with the requested grant, decision, and
  effective time audited. Driver invitations bind to an existing Fleet
  Readiness driver profile and its verified contact; drivers cannot
  self-select or change that link. The selected account, MFA, recovery,
  password, and session
  policies are in the
  [decision register](./trucking/DECISIONS.md); detailed permission mapping,
  grant administration workflow, and identity retention remain open.
- Put transport schemas under explicit ownership. Do not introduce a shared
  package or move domain policy merely to avoid duplication before a real
  cross-boundary contract exists.

## Contract evolution

- API, command, and event contract changes within a version must be
  backward-compatible and additive.
- A breaking change requires a new contract version and a migration window
  for affected consumers. The window has no fixed duration; retire the prior
  version only after all affected consumers have migrated and the contract
  owner approves retirement.

## Cross-service guarantees

The target uses independently deployable services, each owning its PostgreSQL
cluster and business data. Shared platform clusters provide RabbitMQ,
Temporal, NATS, and observability. No service may read or write another
service's tables; communicate through owned commands and facts.

Before implementing a cross-service workflow, define:

- Stable load, assignment, capacity, and execution identifiers.
- The exact authorization and load-readiness checks.
- The response if Dispatch persists an assignment but Execution cannot
  create its execution record.
- Idempotency behavior for retried commands and duplicate delivery.
- How pending/failed work is inspected, retried, and reconciled.
- Which service owns each state transition and customer-safe projection.

For an HTTP operation that requires an `Idempotency-Key`, scope the key to
the authenticated principal, operation, and target resource when present.
The same key in a different scope is distinct. Within its scope, unchanged
normalized content resolves to the existing resource; changed content
returns `409 Conflict`.
Each service persists its own scoped idempotency record with the normalized
content hash and durable result reference in the same transaction as its
business write. Enforce a unique scope so concurrent identical requests
cannot create duplicate business records. Do not centralize this state in a
shared database or service. Retain each idempotency result for the lifetime
of the resource it protects; do not expire it on a shorter fixed timer.

## Booking submission HTTP contract

Both normalized form input and spreadsheet rows use the same public
submission resource:

- `POST /api/v1/booking-submissions` validates and records one immutable
  submission attempt.
- `GET /api/v1/booking-submissions/{submissionId}` returns its durable result.
- Each POST requires a client-generated `Idempotency-Key`, scoped as above.
  The server assigns
  a UUID `submissionId`. A corrected attempt uses a new key and may identify
  the earlier rejected attempt with `correctionOfSubmissionId`; that link may
  target only a rejected attempt. Changes to an accepted Load use its
  amendment workflow instead of creating another booking.

The first well-formed attempt returns `201 Created` whether its business
outcome is accepted or rejected, with `Location` identifying the submission
resource. Persist a versioned JSONB result snapshot containing the exact
accepted or rejected outcome, including rejection issues or accepted
follow-ups. An identical retry returns the same stored resource with
`200 OK`.
Reusing a key with different normalized content returns `409 Conflict`.
`GET` returns `200 OK` for a visible submission and `404 Not Found` when it
does not exist or is not visible to the caller.

Booking-critical validation is all-or-nothing across the submitted rows. A
business-rejected attempt is durably stored with its normalized input and
row/field issues, but creates no Load records. A corrected attempt is a new,
linked submission. An accepted result is returned only after Load atomically
commits the submission outcome, Loads, initial revisions, and planning outbox
records. The result includes `loadReferences` and non-blocking
`followUpItems`; it does not claim that capacity is reserved or an Assignment
is active. Rejected submissions have no Load references.

Each row may contain at most 50 stops and 500 freight lines. Exceeding either
per-Load limit is a booking-rule rejection persisted in the submission; it is
not an HTTP `413`. The overall request remains limited to 100 rows and 5 MB,
with excess rejected as `413` before a submission is created.

The request body is a normalized array of Load rows. The example shows a
standard dry-van row; equipment-specific fields are required at the planning
gate described in the
[technical workflow](./trucking/TECHNICAL_WORKFLOW.md). Each row's
`customerRate` is a positive USD amount represented as a decimal string with
at most two fractional digits; currency conversion is not performed.

```json
{
  "correctionOfSubmissionId": null,
  "rows": [
    {
      "customerId": "uuid",
      "customerReference": "CUSTOMER-PO-4821",
      "customerRate": {
        "amount": "1250.00",
        "currency": "USD"
      },
      "equipmentProfile": "DRY_VAN",
      "specialHandlingCodes": [],
      "stops": [
        {
          "type": "PICKUP",
          "address": {
            "addressLine1": "100 Example Street",
            "city": "Los Angeles",
            "stateCode": "CA",
            "postalCode": "90001",
            "countryCode": "US"
          },
          "appointmentWindow": {
            "startAt": "2026-10-20T08:00:00-07:00",
            "endAt": "2026-10-20T10:00:00-07:00",
            "timeZone": "America/Los_Angeles"
          }
        },
        {
          "type": "DELIVERY",
          "address": {
            "addressLine1": "200 Sample Avenue",
            "city": "Phoenix",
            "stateCode": "AZ",
            "postalCode": "85001",
            "countryCode": "US"
          },
          "appointmentWindow": {
            "startAt": "2026-10-21T08:00:00-07:00",
            "endAt": "2026-10-21T10:00:00-07:00",
            "timeZone": "America/Phoenix"
          }
        }
      ],
      "freightLines": [
        {
          "description": "Boxed machine parts",
          "quantity": "12.000",
          "handlingUnitCode": "PALLET"
        }
      ]
    }
  ]
}
```

`equipmentProfile` may be absent at booking but is required before planning.
Initial profiles are `DRY_VAN`, `REEFER`, and `FLATBED`; `STEP_DECK` and
`TANKER` are recognized but not yet supported. `specialHandlingCodes` may
contain `OVERSIZE` and `HAZMAT`, which are also not yet supported. Those
future requirements may be booked but remain held from planning and
Assignment. `customerRate.amount` and freight quantities are decimal strings,
not JSON floating-point values. Each row requires an ordered list of at
least one pickup and one delivery; the sequence may interleave both types.
`totalGrossWeight`, temperature requirements, line dimensions, and tarp
requirements are stage-gated rather than booking-critical.

The result representation is shared by POST and GET:

```json
{
  "submissionId": "uuid",
  "outcome": "accepted",
  "createdAt": "2026-10-15T12:00:00Z",
  "correctionOfSubmissionId": null,
  "loadReferences": [
    {
      "loadId": "uuid",
      "loadReference": "load-reference"
    }
  ],
  "issues": [],
  "followUpItems": []
}
```

`outcome` is `accepted` or `rejected`. Each issue identifies a one-based
input row, RFC 6901 JSON Pointer `fieldPath` using zero-based array indexes,
stable cause-specific uppercase `SNAKE_CASE` `code`, readable `message`, and
`correctiveAction`. Do not echo submitted field values in issue details.
`followUpItems` identifies work on an accepted Load that is not
booking-critical. Each item contains `loadId`, `fieldPath`, stable
cause-specific `code`, and `message`, plus `requiredStage` and `blocksStage`.
`requiredStage` is `PLANNING`, `EXECUTION_START`, or `DELIVERY_CLOSEOUT` for
a stage-gated fact, and `null` for informational follow-ups.
`blocksStage` is true only when the missing fact prevents the named stage.
The response contract does not turn a business rejection into an HTTP
transport error.

```json
{
  "loadId": "uuid",
  "fieldPath": "/rows/0/totalGrossWeight",
  "code": "TOTAL_GROSS_WEIGHT_REQUIRED",
  "message": "Total gross weight is required before planning.",
  "requiredStage": "PLANNING",
  "blocksStage": true
}
```

```json
{
  "rowNumber": 1,
  "fieldPath": "/rows/0/customerRate/amount",
  "code": "CUSTOMER_RATE_AMOUNT_INVALID",
  "message": "The customer rate amount must be a positive decimal string.",
  "correctiveAction": "Enter a positive amount using decimal notation."
}
```

The initial booking rejection code catalog is:

| Code                                       | Meaning                                                                          |
| ------------------------------------------ | -------------------------------------------------------------------------------- |
| `CUSTOMER_ID_REQUIRED`                     | The row does not identify a Customer profile.                                    |
| `CUSTOMER_NOT_FOUND`                       | The Customer profile does not exist.                                             |
| `CUSTOMER_NOT_ACTIVE`                      | The Customer profile is not active.                                              |
| `CUSTOMER_RATE_REQUIRED`                   | The row does not include a customer rate.                                        |
| `CUSTOMER_RATE_AMOUNT_INVALID`             | The amount is malformed, non-positive, or has more than two decimal places.      |
| `CUSTOMER_CURRENCY_INVALID`                | The currency is not a valid ISO 4217 code.                                       |
| `CUSTOMER_CURRENCY_UNSUPPORTED`            | The currency is valid but is not USD in the initial scope.                       |
| `PICKUP_STOP_REQUIRED`                     | The row has no pickup stop.                                                      |
| `DELIVERY_STOP_REQUIRED`                   | The row has no delivery stop.                                                    |
| `STOP_LIMIT_EXCEEDED`                      | The row contains more than 50 stops.                                             |
| `STOP_TYPE_INVALID`                        | A stop type is not `PICKUP` or `DELIVERY`.                                       |
| `STOP_ADDRESS_FIELD_REQUIRED`              | A required domestic address field is missing.                                    |
| `STOP_STATE_CODE_INVALID`                  | The state code is not a valid two-letter USPS code.                              |
| `STOP_COUNTRY_UNSUPPORTED`                 | A stop is outside the initial US-only address scope.                             |
| `STOP_WINDOW_INVALID`                      | The appointment window is incomplete/invalid or the start is not before the end. |
| `STOP_TIME_ZONE_INVALID`                   | The stop's time zone is not a valid IANA time-zone identifier.                   |
| `FREIGHT_LINE_REQUIRED`                    | The Load has no freight lines.                                                   |
| `FREIGHT_LINE_LIMIT_EXCEEDED`              | The row contains more than 500 freight lines.                                    |
| `FREIGHT_DESCRIPTION_REQUIRED`             | A freight line has no description.                                               |
| `FREIGHT_QUANTITY_INVALID`                 | A quantity is malformed, non-positive, or has more than three fractional digits. |
| `HANDLING_UNIT_INVALID`                    | A handling-unit code is not in the supported list.                               |
| `OTHER_HANDLING_UNIT_DESCRIPTION_REQUIRED` | `OTHER` is selected without its required short description.                      |

The initial accepted-booking follow-up catalog is:

| Code                                    | Required stage | Blocks stage | Meaning                                                                |
| --------------------------------------- | -------------- | ------------ | ---------------------------------------------------------------------- |
| `CUSTOMER_REFERENCE_POSSIBLE_DUPLICATE` | `null`         | `false`      | A similar Customer reference exists; review it without auto-merging.   |
| `EQUIPMENT_PROFILE_REQUIRED`            | `PLANNING`     | `true`       | Equipment profile is missing.                                          |
| `EQUIPMENT_PROFILE_UNSUPPORTED`         | `PLANNING`     | `true`       | The profile is not yet supported for automated planning.               |
| `TOTAL_GROSS_WEIGHT_REQUIRED`           | `PLANNING`     | `true`       | Total gross weight is missing.                                         |
| `REEFER_TEMPERATURE_REQUIRED`           | `PLANNING`     | `true`       | Reefer minimum/maximum temperature or unit is missing.                 |
| `REEFER_MODE_DEFAULTED`                 | `null`         | `false`      | `CONTINUOUS` was defaulted; broker should confirm or correct it.       |
| `FLATBED_DIMENSIONS_REQUIRED`           | `PLANNING`     | `true`       | A freight line is missing length, width, height, or dimension unit.    |
| `FLATBED_TARP_REQUIREMENT_REQUIRED`     | `PLANNING`     | `true`       | The explicit tarp-required value is missing.                           |
| `SPECIAL_HANDLING_UNSUPPORTED`          | `PLANNING`     | `true`       | A special-handling capability is not yet supported for automated work. |

Planning-stage facts and unsupported equipment profiles are not booking
rejection issues. Accepted Loads may instead receive
`followUpItems` that do not block booking but may block planning until the
required facts or capability are available.

Do not report a fully active assignment until the required capacity
reservation and Assignment finalization conditions hold. Do not use
distributed transactions or synchronous HTTP service-to-service chains to
coordinate business workflows. The selected transport, workflow, and
fan-out tools and their distinct responsibilities are recorded in the
[TMS system blueprint](./trucking/TMS_SYSTEM_BLUEPRINT.md). Exact message
contracts, topology, and first-slice adoption remain to be specified.

## Event envelope

Use a versioned, validated message envelope for durable commands and facts
with:

`messageId`, `messageType`, `schemaVersion`, `sourceService`, optional
`targetService`, `issuedAt` or `occurredAt`, `correlationId`, optional
`causationId`, an owner-record revision for facts, and a typed `payload`.

Events state facts that happened; commands request an owner to perform work.
Commands additionally carry a stable `commandId`, issuer identity,
`idempotencyKey`, and the expected owner revision when the operation depends
on a particular revision. A user-originated command preserves both the
initiating principal and the issuing service; a service-originated command
identifies its initiating service. The exact serialized issuer-context shape
remains to be specified. The owning service authorizes the principal and
resource access when it accepts the command. Once durably accepted,
asynchronous processing may complete despite later permission changes;
domain state and concurrency rules still apply. Command outcomes distinguish
business acceptance/rejection from technical delivery failure. Assume
duplicate and delayed delivery. Consumers must validate, be idempotent,
expose failures, and define ordering and replay behavior. Within a supported
version, ignore unrecognized optional additive fields. Reject and quarantine
messages with unsupported contract versions rather than attempting
best-effort processing. Owner revisions let consumers identify stale and
missing updates without relying on timestamps as an ordering guarantee.
Consumers apply only revisions newer than the highest applied revision for
each resource and ignore duplicate or stale facts. On a revision gap, they
fetch the current authoritative snapshot from the owner by resource ID,
update their projection to the snapshot's revision, and ignore later-
delivered facts at or below it. Owner services publish the specific versioned
business fact that occurred rather than a full resource snapshot on every
event; consumers obtain the current owner snapshot when reconciliation is
required. If the owner is unavailable, retain the last projection, mark it
stale, retry reconciliation, and do not apply later revisions for that
resource until the gap is repaired.

Asynchronous command outcomes distinguish accepted and rejected business
results from transient technical delivery failures. Business rejection is a
workflow outcome, not a retryable transport error.

## Capacity reservation command

The Dispatch Planning command to Capacity Commitment identifies
`tripPlanId`, `tripPlanRevision`, and the complete ordered segment set. Each
segment includes `startStopId`, `endStopId`, a UTC start/end time window,
one `powerUnitId`, one `trailerId`, one or two `driverIds`, and the expected
Fleet Readiness owner revision for each assigned resource. CC reserves the
full resource/time-window set atomically: it returns one reservation
identifier and expiry, or a business rejection with no partial claims.
Reservation states are `HELD`, `CONFIRMED`, `RELEASED`, `EXPIRED`, and
`SUPERSEDED`; only `HELD` and `CONFIRMED` claims block capacity. Temporary
holds expire after five minutes. The accepted result includes
`outcome: RESERVED`, `reservationId`, `tripPlanId`, `tripPlanRevision`, and
`expiresAt`. A rejected result includes `outcome: REJECTED`, a stable
`reasonCode`, affected segment/resource IDs, and `replanMayResolve`. Initial
rejection codes are `RESOURCE_UNAVAILABLE`, `STALE_READINESS_REVISION`,
`SEGMENT_TIME_CONFLICT`, `INCOMPATIBLE_RESOURCE`, and
`TRIP_PLAN_REVISION_STALE`. Do not disclose other customers' or carriers'
reservation details.
After Load finalization guards pass, Dispatch asks CC to transition the hold
from `HELD` to `CONFIRMED` immediately before activating the Assignment. A
failed finalization releases the hold. An interrupted Assignment activation
preserves the confirmed reservation for recovery against the same plan.
CC release commands identify the current `reservationId` and Trip Plan
revision. They either release the complete reservation or atomically replace
it with the complete feasible remaining segment set. Individual segment
claims are never released piecemeal.

## Assignment-to-Execution handoff

Dispatch Planning publishes an immutable active Assignment only after CC
confirms the reservation and Load finalization guards pass. The Assignment
identifies `assignmentId`, `loadId` and its revision, `tripPlanId` and its
revision, assigned segment resources, and the reservation. Execution creates
the planned Trip and per-Load Execution records idempotently by
`assignmentId`. If the handoff fails, preserve the Assignment for visible
recovery; do not report active Execution until Execution confirms its records.
Exact fact/command names and the Execution outcome payload remain open.

## Delivery reliability and errors

Services that publish durable facts commit them to a transactional outbox
with their business state. Consumers deduplicate through an idempotent inbox
or equivalent durable mechanism. Transient delivery failures use bounded
backoff; exhausted work remains inspectable for recovery. Permanently invalid
messages are quarantined with an explicit reason. Business rejections are
workflow outcomes and are not retried as if they were transport failures.
Make eight total attempts including the initial attempt; after a transient
failure, begin with a one-second delay, exponentially double with full
jitter, and cap the delay at five minutes. Park exhausted messages for
authorized recovery.
Each service's local outbox records a unique message ID, type/schema version,
source/target, correlation/causation IDs, payload, creation time, publish
attempt count, next-attempt time, and terminal or parked failure reason.
Commit the outbox row atomically with the owner's business state.
Each consumer keeps a local inbox unique on `(consumer_service, message_id)`
with `RECEIVED`, `PROCESSED`, or `PARKED` status, attempt count, last error,
and timestamps. Duplicate delivery is a no-op. Commit a successful business
effect and the `PROCESSED` state atomically in the consumer's database.

HTTP transport errors use a consistent shape:

```json
{
  "error": {
    "code": "IDEMPOTENCY_KEY_REUSED",
    "message": "The key was already used with different content.",
    "retryable": false,
    "requestId": "uuid",
    "details": []
  }
}
```

The endpoint accepts at most 100 rows and 5 MB of normalized JSON. Exceeding
either limit returns `413` before a submission is created. The gateway
deadline is 10 seconds; a timeout returns `504 Gateway Timeout` and the
client retries or retrieves with the same idempotency key because the
outcome may already have committed.

The endpoint uses `400` for malformed JSON or an uninterpretable request,
`401` for missing authentication, `403` for a forbidden action, `404` for a
missing or non-visible submission, `409` for an idempotency-key content
conflict, `413` for an oversized body or batch, `415` for unsupported media
type, `429` for rate limiting, `503` for transient unavailability, and `500`
for an unexpected server failure. These errors do not create a submission
when Load has not durably committed one. A well-formed request with
booking-rule issues instead creates a durable rejected submission and returns
`201` with `outcome: rejected`.

A `504` error body uses code `GATEWAY_TIMEOUT` and `retryable: true`; it does
not assert whether Load committed. Clients must reuse the same idempotency
key and must not submit changed content under that key.

## Load cancellation HTTP contract

- `POST /api/v1/loads/{loadId}/cancellation-requests` creates a cancellation
  request. It requires an `Idempotency-Key`, scoped to the authenticated
  principal, operation, and target Load.
- `GET /api/v1/cancellation-requests/{cancellationRequestId}` returns the
  current request resource.
- A new valid request returns `202 Accepted` with a `Location` header for
  the pollable resource. An identical retry with the same key and normalized
  content returns the same resource with `200 OK`. Reusing a key with changed
  content returns `409 Conflict`.
- A different key submitted while a cancellation is already pending returns
  `409 Conflict` with code `CANCELLATION_ALREADY_PENDING` and the existing
  `cancellationRequestId` in `details`. A Load already cancelled returns
  `409 Conflict` with code `LOAD_ALREADY_CANCELLED` and the existing request
  ID when available. If actual execution has started, return `409 Conflict`
  with code `CANCELLATION_NOT_ALLOWED_EXECUTION_STARTED`; create no request.
- The body requires `reasonCode`, one of `CUSTOMER_REQUEST`,
  `DUPLICATE_BOOKING`, `BOOKING_ERROR`, `LOAD_NO_LONGER_NEEDED`, or `OTHER`.
  `note` is optional and limited to 500 characters, except `OTHER` requires
  a note.

```json
{
  "reasonCode": "CUSTOMER_REQUEST",
  "note": "Customer requested cancellation before pickup."
}
```

The initial response identifies the durable request and its status resource.
`state` reflects the current value when the response is generated; it may
already be `CANCELLED` if no downstream work required release:

```json
{
  "cancellationRequestId": "uuid",
  "loadId": "uuid",
  "state": "PENDING_RELEASE",
  "reasonCode": "CUSTOMER_REQUEST",
  "createdAt": "2026-10-15T12:00:00Z",
  "statusUrl": "/api/v1/cancellation-requests/uuid"
}
```

The GET representation also includes optional `note`, `requestedByPrincipalId`,
`updatedAt`, nullable `completedAt`, `reconciliationRequired`, and a nullable
`failure` object containing the latest stable `code` and `occurredAt`. Its
lifecycle states are `PENDING_RELEASE`, `REQUIRES_RECONCILIATION`, and
`CANCELLED`. `reconciliationRequired` is true only in
`REQUIRES_RECONCILIATION`; `completedAt` is populated when cancelled.
Failure after the automated retry budget leaves the request pending for
authorized reconciliation; it is not a terminal cancellation failure.
`CANCELLED` is reported only after Load has the required Dispatch Planning
and CC release confirmations, plus Execution confirmation when a planned
execution record exists.

Malformed or invalid input returns `400` and creates no request. A GET returns
`200 OK` for a visible request or `404 Not Found` when it does not exist or
is not visible. The shared authentication, authorization, media-type,
rate-limit, service-unavailability, and unexpected-error status mappings
apply. A `504` may leave the result unknown; retry the POST with the same
`Idempotency-Key`. If the request ID is known, the client may also retrieve
its current status with GET.

## Load amendment HTTP contract

- `GET /api/v1/loads/{loadId}` returns the current Load and current revision
  with its ETag.
- `GET /api/v1/loads/{loadId}/revisions/{revisionId}` returns an immutable
  revision and its ETag.
- `POST /api/v1/loads/{loadId}/revisions` creates the next immutable
  revision. Its body is a complete replacement snapshot using the Load
  revision field groups above; partial patches are not accepted. Require
  both `If-Match` with the current revision ETag and an `Idempotency-Key`.
- A valid amendment returns `201 Created`, a `Location` for the new revision,
  the new revision ETag, and a representation with `loadId`, `revisionId`,
  `revisionNumber`, `createdAt`, and `revalidationRequired`. When an active
  Assignment exists, revalidation is required before further automated
  progression. A same-key/same-content retry returns the same revision with
  `200 OK`; a same-key/different-content retry returns `409 Conflict`.
- Missing `If-Match` returns `428 Precondition Required`; a stale ETag
  returns `412 Precondition Failed`. A conflict with a Load finalization
  guard returns retryable `409 Conflict`. After actual execution starts,
  return `409 Conflict` with code
  `LOAD_AMENDMENT_NOT_ALLOWED_EXECUTION_STARTED`. A Load in
  `CANCELLATION_PENDING`, `CANCELLED`, or `COMPLETED` returns `409 Conflict`
  with code `LOAD_NOT_AMENDABLE`.
- An invalid full snapshot returns `422 Unprocessable Content` using the
  shared error envelope with `error.code: LOAD_AMENDMENT_INVALID` and
  `details` containing `fieldPath`, stable issue `code`, `message`, and
  `correctiveAction`. It creates no revision or amendment-attempt resource.
  The idempotency result is retained: identical retries replay the `422`;
  corrected content requires a new key.

## Execution evidence upload HTTP contract

- `POST /api/v1/load-executions/{loadExecutionId}/stops/{stopId}/evidence-uploads`
  requires an `Idempotency-Key` and a body containing `fileName`,
  allow-listed `contentType`, exact `sizeBytes`, and the file's SHA-256
  checksum. Validate the stop, authorization, file count, type, and size
  before issuing a URL. A successful request returns `201 Created` with an
  `uploadId`, short-lived presigned URL, expiry time, and required upload
  headers. The URL expires 30 minutes after issuance and cannot be extended;
  after expiry, create a new upload intent. The object remains private.
  Authorized submitters are the assigned driver, the dispatcher responsible
  for that driver (`fleet_dispatcher` or `contract_capacity_dispatcher` as
  scoped to the assignment), and the Load's area supervisor or documented
  supervisory coverage. Upload authority does not grant exception-approval
  authority; brokers cannot submit delivery evidence.
- The client uploads the file directly to the object-storage URL, then calls
  `POST /api/v1/evidence-uploads/{uploadId}/finalization`. After verifying
  the stored file size, allowed type, and checksum, finalization returns
  `202 Accepted` and starts asynchronous malware scanning. Initial allowed
  types are PDF, JPEG, and PNG; enforce at most 10 files and 25 MB per
  delivery stop. `GET /api/v1/evidence-uploads/{uploadId}` returns
  `uploadId`, status, and expiry; statuses are `SCANNING`, `AVAILABLE`,
  `REJECTED`, or `EXPIRED`. Include `evidenceId` only for `AVAILABLE` and a
  stable `reasonCode` only for `REJECTED`; never return the object-storage
  URL from this endpoint. An unfinalized intent becomes `EXPIRED` when its
  URL expires; finalization then returns `410 Gone`. Create the
  evidence record and make the file usable only after a clean scan; a
  rejected or unscanned file cannot satisfy closeout. Infected objects
  remain quarantined for controlled investigation.
- Finalization is idempotent per `uploadId`; retries return the existing
  upload state and do not enqueue duplicate scans or create duplicate
  evidence. An upload that has not completed returns `409 Conflict`.
- Exact create-intent response headers, authorization mapping,
  verification-failure codes, and retention remain open. Idempotency-key
  reuse follows the cross-service guarantee above.
- Return `413 Content Too Large` when the declared file exceeds the size
  limit, `415 Unsupported Media Type` for an unsupported declared type,
  `422 Unprocessable Content` when stored-object verification detects a
  type or checksum mismatch, `410 Gone` for an expired upload intent,
  `409 Conflict` when stop lifecycle or file-count constraints prevent the
  operation, and `404 Not Found` when the target is missing or not visible
  to the caller.

## Execution fact idempotency

Driver-submitted stop milestones, stop outcomes, and incident reports require
an `Idempotency-Key` scoped to the Execution record and operation. An
identical normalized retry returns the stored fact; changed content under
the same key returns `409 Conflict`. Corrected facts are new append-only
records that identify the record being corrected and include a reason.

## Evolution

Additive, backward-compatible contract changes may retain a version only
when old receivers can safely accept them. Breaking changes require a new
version and compatibility tests. Runtime parsing belongs at each receiver,
even when producers and consumers share generated types.

The booking and cancellation routes, their accepted/rejected or pending
outcomes, idempotency semantics, response representations, and HTTP error
mapping are selected. Complete booking and amendment request fields, business
additional issue codes, command/event payloads, authorization context, and
compatibility tests remain implementation-readiness gates in the
[open-decision register](./trucking/OPEN_QUESTIONS.md).
