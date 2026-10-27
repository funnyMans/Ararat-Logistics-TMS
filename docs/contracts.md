# TMS service contracts

The TMS domain owners include Counterparty Registry, Fleet Readiness, Load,
Dispatch Planning, Capacity Commitment (CC), Execution, Notification,
Identity, and the read-only Operations View. Their contracts represent
business decisions and facts, not a shared database schema. Validate every
request at the receiving service; a TypeScript type does not validate
runtime data.

Each API-owning service's OpenAPI 3.1 document is the source of truth for its
HTTP contract. Validate requests against that contract at runtime, generate
types and clients where practical, and check compatibility in CI.
Breaking HTTP changes introduce a new major URL version. Retain the prior
version while clients migrate; remove it only through a separately verified
deprecation and cleanup.
Each service-owned AsyncAPI 3.0 document is the source of truth for its
durable message channels and versioned payload schemas. Validate messages at
runtime and check compatibility in CI.
The current machine-readable artifacts and their coverage status are
catalogued in the [API specification index](./api/README.md). A listed
partial specification is authoritative only for the operations and messages
it defines; unresolved inventories remain in the decision register.

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
  Versioned event-specific templates carry a concise safe summary, an opaque
  resource deep link, and any required action/deadline, but not sensitive
  business payloads. The owning service rechecks authorization on access.
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
- TMS HTTP APIs use OpenAPI 3.1 as their canonical machine-readable
  contract. This guide owns shared transport rules; domain documentation
  owns business meaning and policy.
- Store one named OpenAPI document per API-owning service under `docs/api/`;
  do not combine routes from multiple owners into a workflow-owned
  specification.
- Specify durable cross-service commands and facts in service-owned
  AsyncAPI 3.0 documents with versioned message and payload schemas.
- The receiving domain service owns each accepted command schema; the
  publishing domain service owns each fact schema.

## Contract evolution

- API, command, and event contract changes within a version must be
  backward-compatible and additive.
- A breaking change requires a new contract version and a migration window
  for affected consumers. The window has no fixed duration; retire the prior
  version only after all affected consumers have migrated and the contract
  owner approves retirement.
- HTTP request schemas reject properties not defined by the operation's
  contract version. API consumers must tolerate unrecognized response
  properties so additive response evolution remains compatible.

## Cross-service guarantees

The target uses independently deployable services, each owning its PostgreSQL
cluster and business data. Shared platform clusters provide RabbitMQ,
Temporal, NATS, and observability. No service may read or write another
service's tables; communicate through owned commands and facts.
Each service owns ordered, forward-only database migrations. Use the
expand/contract pattern for compatible rollout; correct an applied schema
change with a new migration rather than rolling the database backward. Run
migrations in one lock-protected deployment job before promoting the new
service version; application instances do not migrate on startup. A failed
migration blocks promotion and retains failure details. Keep the current
application version running if it remains compatible with the resulting
schema, then repair forward with a new migration; do not automatically roll
the schema backward. Run additive expansion before promoting the new
application version. Run destructive contract cleanup as a separate
lock-protected migration only after all old application instances have been
drained.

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
all independently detectable row/field issues, but creates no Load records.
Sort issues by `rowNumber` ascending, then `fieldPath` lexicographically
ascending, with `code` lexicographically ascending as a tie-breaker. Avoid
duplicate or cascading issues when an invalid value prevents a dependent
check. A corrected attempt is a new,
linked submission. An accepted result is returned only after Load atomically
commits the submission outcome, Loads, initial revisions, and planning outbox
records. The result includes `loadReferences` and `followUpItems`; a
follow-up may block planning while never rejecting an otherwise valid
booking. It does not claim that capacity is reserved or an Assignment is
active. Rejected submissions have no Load references or follow-up items. An
accepted result contains exactly one Load reference per submitted row,
ordered by one-based `rowNumber`; each reference identifies its source row.
An unknown property
anywhere in a row or its nested objects is a booking-rule rejection with code
`UNKNOWN_FIELD` and its row and RFC 6901 field path; it rejects the full batch
and creates no Loads, but the rejected submission itself is persisted.

Each row may contain at most 50 stops and 500 freight lines. Exceeding either
per-Load limit is a booking-rule rejection persisted in the submission; it is
not an HTTP `413`. The overall request remains limited to 100 rows and 5 MB,
with excess rejected as `413` before a submission is created.
In booking and amendment request bodies, an explicit `null` for an optional
field that is not defined as nullable is treated as omission. Required fields
remain subject to their normal validation, and fields explicitly defined as
nullable retain their stated meaning. Canonical Load revisions and emitted
facts continue to omit fields with no value unless their contract defines a
meaningful `null`.

### Booking request field inventory

`POST /api/v1/booking-submissions` accepts an object with required `rows`
(1–100 Load rows) and optional `correctionOfSubmissionId` (UUIDv7 or `null`).
`correctionOfSubmissionId`, when present, must identify a durably rejected
submission. Each row describes exactly one Load. In an accepted result,
`loadReferences` contains one `{rowNumber, loadId, loadReference}` object per
source row, sorted by `rowNumber`. The following table defines
the valid value shape; booking-critical, conditional, optional, and
stage-gated validation behavior is specified below and in the field rules
that follow.

| Object       | Property                      | Required at booking | Valid value shape / rule                                                                                                                                               |
| ------------ | ----------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Request      | `rows`                        | Yes                 | Array of 1–100 Load row objects.                                                                                                                                       |
| Request      | `correctionOfSubmissionId`    | No                  | UUIDv7 or `null`; must refer to a rejected attempt.                                                                                                                    |
| Load row     | `customerId`                  | Yes                 | UUIDv7 Customer profile identifier.                                                                                                                                    |
| Load row     | `customerReference`           | No                  | String; trimmed to at most 100 Unicode code points; not unique.                                                                                                        |
| Load row     | `customerRate`                | Yes                 | Object `{amount, currency}`; amount is a positive USD decimal string, currency is an ISO 4217 code (USD only initially).                                               |
| Load row     | `equipmentProfile`            | No                  | `DRY_VAN`, `REEFER`, `FLATBED`, recognized-but-unsupported `STEP_DECK` or `TANKER`; required before planning.                                                          |
| Load row     | `specialHandlingCodes`        | No                  | Array containing `OVERSIZE` and/or `HAZMAT`; known unsupported capabilities block planning.                                                                            |
| Load row     | `totalGrossWeight`            | No                  | Object `{value, unit}`; positive decimal string and `LB` or `KG`; required before planning.                                                                            |
| Load row     | `temperatureRange`            | No                  | Reefer object `{minimum, maximum, unit}`; required before reefer planning.                                                                                             |
| Load row     | `reeferMode`                  | No                  | `CONTINUOUS` or `START_STOP`; reefer-only.                                                                                                                             |
| Load row     | `tarpRequired`                | No                  | Boolean; required before flatbed planning.                                                                                                                             |
| Load row     | `stops`                       | Yes                 | Ordered array of 2–50 stop objects; at least one pickup and one delivery, pickup first and delivery last.                                                              |
| Load row     | `freightLines`                | Yes                 | Array of 1–500 freight-line objects.                                                                                                                                   |
| Stop         | `type`                        | Yes                 | `PICKUP` or `DELIVERY`.                                                                                                                                                |
| Stop         | `address`                     | Yes                 | Object with required `addressLine1`, `city`, `stateCode`, and `postalCode`; optional `addressLine2`, `countryCode`, and `coordinates`. `countryCode` defaults to `US`. |
| Stop         | `appointmentWindow`           | Yes                 | Object `{startAt, endAt, timeZone}`; RFC 3339 timestamps with offsets matching the IANA zone, and start before end.                                                    |
| Stop         | `facilityName`, `contactName` | No                  | Optional strings, each at most 120 Unicode code points after trimming.                                                                                                 |
| Stop         | `contactPhone`                | No                  | Optional string, at most 32 Unicode code points after trimming; common phone syntax defined below.                                                                     |
| Stop         | `accessInstructions`          | No                  | Optional string, at most 1,000 Unicode code points after trimming.                                                                                                     |
| Address      | `addressLine1`                | Yes                 | Non-empty string, at most 200 Unicode code points after trimming.                                                                                                      |
| Address      | `addressLine2`                | No                  | Optional string, at most 200 Unicode code points; omitted when empty after trimming.                                                                                   |
| Address      | `city`                        | Yes                 | Non-empty string, at most 120 Unicode code points after trimming.                                                                                                      |
| Address      | `stateCode`                   | Yes                 | USPS abbreviation for one of the 50 states or DC; canonical uppercase.                                                                                                 |
| Address      | `postalCode`                  | Yes                 | String containing five digits or hyphenated ZIP+4.                                                                                                                     |
| Address      | `countryCode`                 | No                  | `US`; canonical uppercase.                                                                                                                                             |
| Address      | `coordinates`                 | No                  | Optional WGS 84 object `{latitude, longitude}` using JSON numbers, bounded to ±90/±180 and at most six fractional digits.                                              |
| Freight line | `description`                 | Yes                 | Non-empty string, at most 500 Unicode code points after trimming.                                                                                                      |
| Freight line | `quantity`                    | Yes                 | Positive integer string counting handling units identified by `handlingUnitCode`; maximum 999,999,999,999.                                                             |
| Freight line | `handlingUnitCode`            | Yes                 | Controlled handling-unit code listed below.                                                                                                                            |
| Freight line | `handlingUnitDescription`     | Conditional         | Required for `OTHER`; optional field is not applicable to other codes.                                                                                                 |
| Freight line | `stackable`                   | Yes                 | Boolean applying to every handling unit counted on this homogeneous freight line.                                                                                      |
| Freight line | `dimensions`                  | Conditional         | Dimensions `{length, width, height, unit}` of one handling unit; required when stackable before planning and for all freight lines before flatbed planning.            |

The valid shapes in this inventory describe canonical values, not a blanket
schema-level rejection rule. Load performs authoritative business
validation. Invalid booking-critical or conditionally required values reject
the entire batch and create no Loads. Invalid optional or later-stage values
are omitted from the canonical Load revision and returned as accepted
follow-up items; they block only a stage that requires the fact. This
includes values of the wrong JSON type for known non-critical fields.
`null` for an optional field is omission. Unknown properties remain a
durable `UNKNOWN_FIELD` business rejection. The service-owned OpenAPI
specification must preserve this salvage behavior rather than rejecting a
non-critical value before Load can create the correction task.

`customerReference` is optional; trim surrounding whitespace and preserve
internal spacing and case. The normalized value may contain at most 100
Unicode code points. If trimming produces an empty value, treat it as absent
and omit it from the canonical revision. A longer non-empty value is omitted
and produces the non-blocking `CUSTOMER_REFERENCE_TOO_LONG` follow-up; it
does not reject booking. This field is not unique; any duplicate indication
is advisory. A supplied value of the wrong JSON type is omitted and produces
the non-blocking `CUSTOMER_REFERENCE_INVALID` follow-up.

Optional stop fields `facilityName` and `contactName` are trimmed and limited
to 120 Unicode code points each. `contactPhone` is trimmed and limited to 32
code points without changing its formatting; `accessInstructions` is
trimmed and limited to 1,000 code points. A value that becomes empty after
trimming is absent and omitted from the canonical stop snapshot. A supplied
value exceeding its limit is omitted and produces the non-blocking
`STOP_OPTIONAL_FIELD_TOO_LONG` follow-up at its field path; it does not reject
booking. A value of the wrong JSON type is omitted and produces the
non-blocking `STOP_OPTIONAL_FIELD_INVALID` follow-up at its field path.
`contactPhone` syntax permits 7–15 main digits, an optional leading `+`,
digits separated by spaces, parentheses, hyphens, or periods, and an
optional extension introduced by `x`, `ext`, `ext.`, or `#` with 1–6 digits.
Preserve the trimmed formatting. A phone value that fails this syntax but
does not exceed the length limit is omitted from the canonical stop snapshot
and produces non-blocking `STOP_CONTACT_PHONE_INVALID` at its field path;
the Load is accepted.

The request body is a normalized array of Load rows. The example shows a
standard dry-van row; equipment-specific fields are required at the planning
gate described in the
[technical workflow](./trucking/TECHNICAL_WORKFLOW.md). Each row's
`customerRate` is a positive USD amount represented as a decimal string with
at most two fractional digits, persisted as `NUMERIC(12,2)` up to
`9999999999.99`; currency conversion is not performed. Trim surrounding
whitespace from the amount and accept digits with an optional decimal point
followed by one or two digits. Do not accept signs, grouping separators, or
exponent notation. A missing or empty amount, or a malformed, non-positive,
over-precision, or out-of-range amount, rejects the submission with
`CUSTOMER_RATE_AMOUNT_INVALID`. Serialize
the accepted canonical revision value with exactly two fractional digits
and no redundant leading zeroes (for example, `0001250.5` becomes
`1250.50`). Trim `customerRate.currency`, normalize it to uppercase, then
validate it as ISO 4217. A valid non-USD code rejects with
`CUSTOMER_CURRENCY_UNSUPPORTED`; an invalid or empty code rejects with
`CUSTOMER_CURRENCY_INVALID`.

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
          "quantity": "12",
          "handlingUnitCode": "PALLET",
          "stackable": true,
          "dimensions": {
            "length": "48.00",
            "width": "40.00",
            "height": "36.00",
            "unit": "IN"
          }
        }
      ]
    }
  ]
}
```

`equipmentProfile` may be absent at booking but is required before planning.
Each row requires a `customerId` issued by Counterparty Registry as a
syntactically valid UUIDv7. Reject a missing ID with `CUSTOMER_ID_REQUIRED`
and a malformed or non-UUIDv7 ID with `CUSTOMER_ID_INVALID` before
performing Customer-status lookup.
Initial profiles are `DRY_VAN`, `REEFER`, and `FLATBED`; `STEP_DECK` and
`TANKER` are recognized but not yet supported. When supplied, trim
`equipmentProfile`, accept recognized values regardless of letter casing,
and store the accepted value in uppercase. Any other supplied value is
omitted and produces the planning-blocking `EQUIPMENT_PROFILE_INVALID`
follow-up at `/equipmentProfile`; it does not reject the booking.
`specialHandlingCodes` may contain only `OVERSIZE` and `HAZMAT`; trim each
value and accept either code regardless of casing, then normalize it to
uppercase before deduplication. An empty or unrecognized value is omitted
and produces the planning-blocking `SPECIAL_HANDLING_CODE_INVALID` follow-up
at its indexed field path; it does not reject booking. The field is
optional; if omitted or supplied as an empty array, omit it from the
canonical Load revision rather than storing `[]` or `null`.
The known but unsupported requirements may be booked but remain held from
planning and Assignment. Repeated known codes are accepted but deduplicated
in the canonical revision, preserving their first-occurrence order.
`HAZMAT` is a flag only in the initial schema; hazardous-goods details are
deferred until a dedicated workflow is defined, and no HAZMAT Load can
proceed to planning or Assignment meanwhile.
`customerRate.amount` is a decimal string, not a JSON floating-point value.
Each freight-line `quantity` is a positive integer string counting handling
units of the line's `handlingUnitCode`; it does not represent the number of
contained items within a handling unit. Each row requires an ordered list of
at least one pickup and one delivery; the sequence may interleave both types
between endpoints. The first stop must be a pickup and the final
stop a delivery; otherwise reject the full submission with
`STOP_SEQUENCE_INVALID` at the stop-list field path. Dispatch Planning
evaluates route feasibility after booking.
`totalGrossWeight`, temperature requirements, line dimensions, and tarp
requirements are stage-gated rather than booking-critical.
Trim each stop `type`, accept `PICKUP` or `DELIVERY` regardless of casing,
and store the accepted value in uppercase. An empty or unrecognized value
rejects the full submission with `STOP_TYPE_INVALID` at the exact field path.
`totalGrossWeight`, when present, is an object with positive decimal-string
`value` and `unit` (`LB` or `KG`). Trim the value; accept digits with an
optional decimal point followed by one to three digits only, without signs,
grouping separators, or exponent notation. The value must be positive and
within the `NUMERIC(12,3)` range. Trim the unit, accept either value
regardless of casing, and store it in uppercase. Persist the weight value as
`NUMERIC(12,3)` and serialize accepted canonical values with exactly three
fractional digits and no redundant leading zeroes.
The object is required before planning and omitted when absent. If supplied
at booking but malformed, non-positive, outside the `NUMERIC(12,3)` range, or
uses an unsupported or empty unit, omit it from the canonical Load revision
and return the planning-blocking `TOTAL_GROSS_WEIGHT_INVALID` follow-up.
Create the Load and preserve the booking; do not treat the invalid
measurement as authoritative.
When provided, a reefer Load's `temperatureRange` is an object with decimal-
string `minimum` and `maximum` values (at most two fractional digits) and
one shared `unit` (`F` or `C`). Trim the unit and normalize recognized
values to uppercase; an empty or unsupported unit makes the range invalid.
Trim each endpoint and accept signed plain decimal notation with an optional
leading minus sign and an optional decimal point followed by one or two
digits; reject plus signs, grouping separators, exponent notation, and values
outside signed `NUMERIC(5,2)`. Serialize accepted canonical endpoints with
exactly two fractional digits;
`minimum` must not exceed `maximum`. The range is required before planning a
reefer Load and omitted when absent. If an optional range is malformed or
internally invalid, accept an otherwise valid booking, omit the invalid
range from the canonical Load revision, and return a planning-blocking
`REEFER_TEMPERATURE_RANGE_INVALID` follow-up at `/temperatureRange`.
Use `REEFER_TEMPERATURE_REQUIRED` when the range is omitted; an invalid
supplied range produces the invalid-range follow-up instead.
For reefer Loads, `reeferMode` accepts `CONTINUOUS` or `START_STOP`. If
`equipmentProfile` is `REEFER` and `reeferMode` is omitted, store
`CONTINUOUS` in the canonical revision and return the non-blocking
informational follow-up `REEFER_MODE_DEFAULTED` at `/reeferMode`; the
default does not block planning. Trim supplied values and normalize
recognized modes to uppercase. If `equipmentProfile` is absent, defer the
default and follow-up until the profile is selected.
For a known reefer, an invalid supplied `reeferMode` is omitted, defaults to
`CONTINUOUS`, and returns the non-blocking follow-up `REEFER_MODE_INVALID`
at `/reeferMode` instead of `REEFER_MODE_DEFAULTED`. If the profile is
absent, omit an invalid supplied mode but defer its default and follow-up
until profile selection; a non-reefer profile does not need a reefer-mode
follow-up.
If an explicit non-`REEFER` `equipmentProfile` is supplied together with
`temperatureRange` or `reeferMode`, reject the booking with
`REEFER_REQUIREMENT_NOT_APPLICABLE` at the supplied reefer-only field. When
`equipmentProfile` is absent, retain structurally valid reefer fields and
defer applicability validation until the profile is selected. An amendment
may not set a non-`REEFER` profile while retaining these fields.
Every freight line represents one homogeneous commodity and handling-unit
group. Its `quantity` counts those handling units (for example, `"12"`
`PALLET` units), not products contained within each handling unit. It is a
positive integer string from `"1"` through `"999999999999"` with no sign,
fractional part, grouping separator, or exponent notation. Trim surrounding
whitespace and remove redundant leading zeroes in the canonical revision.
Persist it as PostgreSQL `NUMERIC(12,0)` and serialize it as an integer
decimal string. Zero, fractional, malformed, or out-of-range quantities
reject the whole batch with `FREIGHT_QUANTITY_INVALID`; a missing, `null`, or
empty-after-trimming count uses `FREIGHT_QUANTITY_REQUIRED`. A
contained-product quantity and unit are not part of this contract and must
not be overloaded into this field.

Every freight line requires a boolean `stackable` at booking. It applies to
every handling unit counted on that homogeneous line: `true` means the units
may be stacked on one another according to the supplied freight information;
`false` means they may not. Missing or non-boolean values reject the booking
row with `FREIGHT_STACKABILITY_REQUIRED` or
`FREIGHT_STACKABILITY_INVALID`, respectively. A present value of the wrong
type, including `null`, is invalid. Different stackability or dimensions
require separate freight lines. This binary flag is an input
constraint, not proof that a particular stack arrangement is safe or
feasible.

When `stackable` is `true`, provide the dimensions of one handling unit in
the optional-at-booking `dimensions` object. Its positive decimal-string
`length`, `width`, and `height` values have at most two fractional digits and
share one `unit` (`IN` or `CM`). Persist the measurements as `NUMERIC(10,2)`.
Trim the unit and normalize recognized values to uppercase; an empty or
unsupported unit invalidates the dimensions. Trim each measurement and
accept positive plain decimal notation with an optional decimal point
followed by one or two digits, without signs, grouping separators, or
exponent notation. Values must fit `NUMERIC(10,2)` and serialize with exactly
two fractional digits.

Complete dimensions are required before planning whenever `stackable` is
`true`, regardless of equipment profile. Flatbed Loads additionally require
complete dimensions for every freight line, whether or not it is stackable.
When required dimensions are absent, produce the planning-blocking
`FREIGHT_LINE_DIMENSIONS_REQUIRED` follow-up. When required dimensions are
partial or invalid, omit them from the canonical revision and produce the
planning-blocking `FREIGHT_LINE_DIMENSIONS_INVALID` follow-up. If supplied
dimensions are invalid while not currently required for planning, omit them
and produce the non-blocking `FREIGHT_LINE_DIMENSIONS_INVALID_OPTIONAL`
follow-up. Absent dimensions do not create a follow-up when they are not
required. Apply only one dimension follow-up per freight line when both
stackability and flatbed rules require the same dimensions.
Represent the tarp decision as boolean
`tarpRequired`; it is required before flatbed planning, and absent does not
mean false. If supplied with a non-boolean type, omit it from the canonical
revision and return the planning-blocking `FLATBED_TARP_REQUIREMENT_INVALID`
follow-up; use `FLATBED_TARP_REQUIREMENT_REQUIRED` when it is absent.

Each freight line requires a `description`. Trim surrounding whitespace,
preserve internal spacing, and require 1–500 Unicode code points after
trimming. An empty description rejects the full submission with
`FREIGHT_DESCRIPTION_REQUIRED`; a longer description rejects it with
`FREIGHT_DESCRIPTION_TOO_LONG`. Include the row number and exact field path
in either issue, and persist the trimmed description in the canonical Load
revision. The integer quantity and stackability rules above define the
physical handling-unit count and stacking constraint. Supported
`handlingUnitCode` values are
`PALLET`, `SKID`, `CASE`, `CARTON`, `BOX`, `PIECE`, `CRATE`, `DRUM`, `BAG`,
`ROLL`, `CONTAINER`, and `OTHER`. Trim each code, accept recognized values
regardless of casing, and normalize to uppercase before applying the `OTHER`
description rule. An empty or unrecognized code rejects the submission with
`HANDLING_UNIT_INVALID` at the code field path. When the value is `OTHER`,
`handlingUnitDescription` is required; trim surrounding whitespace, preserve
internal spacing, and require 1–120 Unicode code points after trimming. A
missing or empty value rejects the submission with
`OTHER_HANDLING_UNIT_DESCRIPTION_REQUIRED`; an overlength value rejects it
with `OTHER_HANDLING_UNIT_DESCRIPTION_TOO_LONG`. Include the row number and
exact field path in either issue, and persist the trimmed description in the
canonical Load revision. If `handlingUnitDescription` is supplied for any
other handling-unit code, omit the inapplicable value and return the
non-blocking `HANDLING_UNIT_DESCRIPTION_NOT_APPLICABLE` follow-up at that
field path.

Each `appointmentWindow.startAt` and `endAt` in a booking request is an
RFC 3339 timestamp with an explicit UTC offset. Load validates that each
offset matches the supplied IANA `timeZone` at that instant. A mismatch
rejects the whole submission with `STOP_TIME_ZONE_OFFSET_MISMATCH` at the
affected `startAt` or `endAt` field. In the canonical immutable Load revision,
normalize both instants to UTC strings ending in `Z` and retain the IANA
`timeZone`; do not retain the input offset as a separate revision field.

For each stop, trim surrounding whitespace from `addressLine1` and
`addressLine2` while preserving internal spacing. `addressLine1` is required
and must contain 1–200 Unicode code points after trimming; a missing or
empty value rejects the submission with `STOP_ADDRESS_FIELD_REQUIRED`.
`addressLine2` is optional and omitted when empty after trimming. Either
line exceeding 200 code points rejects the submission with
`STOP_ADDRESS_FIELD_TOO_LONG`. Both issues include the row number and exact
field path. `stateCode` is required; a missing or whitespace-only value
rejects with `STOP_ADDRESS_FIELD_REQUIRED`. Otherwise trim it and accept a
two-letter USPS abbreviation for one of the 50 states or the District of
Columbia regardless of input casing; normalize accepted values to uppercase
in the canonical revision. Territories and other USPS region codes are
outside the initial scope and reject with `STOP_STATE_CODE_INVALID` at the
exact field path.
`countryCode` is optional on input; when omitted, default it to `US` in the
canonical revision. When supplied, trim surrounding whitespace, accept `US`
regardless of letter casing, and store uppercase `US`. An empty value after
trimming or another country rejects the submission with
`STOP_COUNTRY_UNSUPPORTED` at the exact field path.
`address.coordinates` is optional and uses WGS 84 JSON numbers:
`latitude` in −90..90 and `longitude` in −180..180, each with at most six
fractional digits. If supplied coordinates are partial, malformed,
over-precision, or out of range, accept the otherwise valid booking, omit
the coordinates from the canonical address snapshot, and return the
non-blocking follow-up `STOP_COORDINATES_INVALID` at the exact
`address.coordinates` field path.
Trim surrounding whitespace from required `city`, preserve internal spacing
and capitalization, and require 1–120 Unicode code points after trimming.
A missing or empty value rejects the submission with
`STOP_ADDRESS_FIELD_REQUIRED`; an overlength value rejects it with
`STOP_CITY_TOO_LONG`. Include the row number and exact field path in either
issue.
Treat required `postalCode` as a string to preserve leading zeroes. A
missing or whitespace-only value rejects with `STOP_ADDRESS_FIELD_REQUIRED`.
Otherwise trim surrounding whitespace; accept five digits or ZIP+4 in
`12345-6789` format and preserve the accepted trimmed value. Reject other
formats with `STOP_POSTAL_CODE_INVALID` at the exact field path.

The result representation is shared by POST and GET:

```json
{
  "submissionId": "uuid",
  "outcome": "accepted",
  "createdAt": "2026-10-15T12:00:00Z",
  "correctionOfSubmissionId": null,
  "loadReferences": [
    {
      "rowNumber": 1,
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
`issues` is empty for `accepted`; `loadReferences` and `followUpItems` are
empty for `rejected`. Sort issues by `rowNumber`, `fieldPath`, then `code`.
`followUpItems` identifies correction work on an accepted Load that is not
booking-critical. Each item contains `loadId`, one-based `rowNumber`,
request-relative `fieldPath` (RFC 6901 JSON Pointer), stable cause-specific
`code`, safe `message`, actionable `correctiveAction`, `requiredStage`, and
`blocksStage`.
`requiredStage` is `PLANNING`, `EXECUTION_START`, or `DELIVERY_CLOSEOUT` for
a stage-gated fact, and `null` for informational follow-ups.
`blocksStage` is true only when the fact prevents the named stage; for an
informational follow-up, `requiredStage` is `null` and `blocksStage` is
`false`. Sort follow-ups by `rowNumber`, `fieldPath`, then `code`. Do not
echo submitted field values in `message` or `correctiveAction`. The
zero-based row index in `/rows/{index}` must equal `rowNumber - 1`; emit no
duplicate follow-ups for the same row, field path, and code.
The response contract does not turn a business rejection into an HTTP
transport error.

```json
{
  "loadId": "uuid",
  "rowNumber": 1,
  "fieldPath": "/rows/0/totalGrossWeight",
  "code": "TOTAL_GROSS_WEIGHT_REQUIRED",
  "message": "Total gross weight is required before planning.",
  "correctiveAction": "Provide a positive total gross weight and select LB or KG.",
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

| Code                                       | Meaning                                                                                                     |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `CUSTOMER_ID_REQUIRED`                     | The row does not identify a Customer profile.                                                               |
| `CUSTOMER_ID_INVALID`                      | The Customer identifier is not a syntactically valid UUIDv7.                                                |
| `CUSTOMER_NOT_FOUND`                       | The Customer profile does not exist.                                                                        |
| `CUSTOMER_NOT_ACTIVE`                      | The Customer profile is not active.                                                                         |
| `CUSTOMER_RATE_REQUIRED`                   | The row does not include a `customerRate` object.                                                           |
| `CUSTOMER_RATE_AMOUNT_INVALID`             | The amount is missing/empty, malformed, non-positive, over-precision, or outside the `NUMERIC(12,2)` range. |
| `CUSTOMER_CURRENCY_INVALID`                | The trimmed, uppercased currency is not a valid ISO 4217 code or is empty.                                  |
| `CUSTOMER_CURRENCY_UNSUPPORTED`            | The currency is valid but is not USD in the initial scope.                                                  |
| `REEFER_REQUIREMENT_NOT_APPLICABLE`        | Reefer-only fields were supplied with an explicit non-reefer equipment profile.                             |
| `UNKNOWN_FIELD`                            | The row or a nested object contains a property not defined by the request schema.                           |
| `PICKUP_STOP_REQUIRED`                     | The row has no pickup stop.                                                                                 |
| `DELIVERY_STOP_REQUIRED`                   | The row has no delivery stop.                                                                               |
| `STOP_SEQUENCE_INVALID`                    | The first stop is not a pickup or the final stop is not a delivery.                                         |
| `STOP_LIMIT_EXCEEDED`                      | The row contains more than 50 stops.                                                                        |
| `STOP_TYPE_INVALID`                        | A trimmed stop type is not `PICKUP` or `DELIVERY`.                                                          |
| `STOP_ADDRESS_FIELD_REQUIRED`              | A required domestic address field is missing.                                                               |
| `STOP_ADDRESS_FIELD_TOO_LONG`              | A stop address line exceeds 200 Unicode code points after trimming.                                         |
| `STOP_CITY_TOO_LONG`                       | A stop city exceeds 120 Unicode code points after trimming.                                                 |
| `STOP_STATE_CODE_INVALID`                  | A supplied non-empty code does not identify one of the 50 states or DC.                                     |
| `STOP_POSTAL_CODE_INVALID`                 | The postal code is not a five-digit ZIP or hyphenated ZIP+4 value.                                          |
| `STOP_COUNTRY_UNSUPPORTED`                 | A stop is outside the initial US-only address scope.                                                        |
| `STOP_WINDOW_INVALID`                      | The appointment window is incomplete/invalid or the start is not before the end.                            |
| `STOP_TIME_ZONE_INVALID`                   | The stop's time zone is not a valid IANA time-zone identifier.                                              |
| `STOP_TIME_ZONE_OFFSET_MISMATCH`           | A supplied timestamp offset does not match the stop's IANA time zone at that instant.                       |
| `FREIGHT_LINE_REQUIRED`                    | The Load has no freight lines.                                                                              |
| `FREIGHT_LINE_LIMIT_EXCEEDED`              | The row contains more than 500 freight lines.                                                               |
| `FREIGHT_DESCRIPTION_REQUIRED`             | A freight-line description is absent or empty after trimming.                                               |
| `FREIGHT_DESCRIPTION_TOO_LONG`             | A normalized freight-line description exceeds 500 Unicode code points.                                      |
| `FREIGHT_QUANTITY_REQUIRED`                | A freight line omits its required handling-unit count.                                                      |
| `FREIGHT_QUANTITY_INVALID`                 | A handling-unit count is non-integer, non-positive, malformed, or greater than 999,999,999,999.             |
| `FREIGHT_STACKABILITY_REQUIRED`            | A freight line omits the required `stackable` boolean.                                                      |
| `FREIGHT_STACKABILITY_INVALID`             | A freight line's `stackable` value is not a boolean.                                                        |
| `HANDLING_UNIT_INVALID`                    | A handling-unit code is not in the supported list.                                                          |
| `OTHER_HANDLING_UNIT_DESCRIPTION_REQUIRED` | `OTHER` is selected without a non-empty description after trimming.                                         |
| `OTHER_HANDLING_UNIT_DESCRIPTION_INVALID`  | `OTHER` is selected with a description of the wrong JSON type.                                              |
| `OTHER_HANDLING_UNIT_DESCRIPTION_TOO_LONG` | An `OTHER` handling-unit description exceeds 120 Unicode code points after trimming.                        |

The initial accepted-booking follow-up catalog is:

| Code                                       | Required stage | Blocks stage | Meaning                                                                                                  |
| ------------------------------------------ | -------------- | ------------ | -------------------------------------------------------------------------------------------------------- |
| `CUSTOMER_REFERENCE_INVALID`               | `null`         | `false`      | A reference of the wrong JSON type was omitted.                                                          |
| `CUSTOMER_REFERENCE_TOO_LONG`              | `null`         | `false`      | The normalized Customer reference exceeds 100 Unicode code points.                                       |
| `CUSTOMER_REFERENCE_POSSIBLE_DUPLICATE`    | `null`         | `false`      | A similar Customer reference exists; review it without auto-merging.                                     |
| `STOP_COORDINATES_INVALID`                 | `null`         | `false`      | Supplied coordinates were invalid and omitted from the canonical address snapshot.                       |
| `STOP_OPTIONAL_FIELD_INVALID`              | `null`         | `false`      | An optional stop field had the wrong JSON type and was omitted.                                          |
| `STOP_OPTIONAL_FIELD_TOO_LONG`             | `null`         | `false`      | An optional stop field exceeded its limit and was omitted.                                               |
| `EQUIPMENT_PROFILE_REQUIRED`               | `PLANNING`     | `true`       | Equipment profile is missing.                                                                            |
| `EQUIPMENT_PROFILE_INVALID`                | `PLANNING`     | `true`       | An unrecognized or malformed profile was omitted.                                                        |
| `EQUIPMENT_PROFILE_UNSUPPORTED`            | `PLANNING`     | `true`       | The profile is not yet supported for automated planning.                                                 |
| `TOTAL_GROSS_WEIGHT_REQUIRED`              | `PLANNING`     | `true`       | Total gross weight is missing.                                                                           |
| `TOTAL_GROSS_WEIGHT_INVALID`               | `PLANNING`     | `true`       | A supplied gross-weight value was invalid and omitted.                                                   |
| `REEFER_TEMPERATURE_REQUIRED`              | `PLANNING`     | `true`       | Reefer minimum/maximum temperature or unit is missing.                                                   |
| `REEFER_TEMPERATURE_RANGE_INVALID`         | `PLANNING`     | `true`       | The supplied reefer range is malformed or its minimum exceeds its maximum.                               |
| `REEFER_MODE_DEFAULTED`                    | `null`         | `false`      | `CONTINUOUS` was defaulted; broker should confirm or correct it.                                         |
| `REEFER_MODE_INVALID`                      | `null`         | `false`      | An invalid supplied mode was omitted and defaulted to `CONTINUOUS`; broker should correct or confirm it. |
| `HANDLING_UNIT_DESCRIPTION_NOT_APPLICABLE` | `null`         | `false`      | An `OTHER` description for another handling-unit code was omitted.                                       |
| `FREIGHT_LINE_DIMENSIONS_INVALID_OPTIONAL` | `null`         | `false`      | Supplied but currently optional dimensions were invalid and omitted.                                     |
| `FREIGHT_LINE_DIMENSIONS_REQUIRED`         | `PLANNING`     | `true`       | Dimensions are absent but required for a stackable line or a flatbed Load.                               |
| `FREIGHT_LINE_DIMENSIONS_INVALID`          | `PLANNING`     | `true`       | Required freight-line dimensions were supplied but incomplete or invalid.                                |
| `FLATBED_TARP_REQUIREMENT_REQUIRED`        | `PLANNING`     | `true`       | The explicit tarp-required value is missing.                                                             |
| `FLATBED_TARP_REQUIREMENT_INVALID`         | `PLANNING`     | `true`       | The supplied tarp-required value is not a boolean.                                                       |
| `SPECIAL_HANDLING_CODE_INVALID`            | `PLANNING`     | `true`       | An invalid special-handling code was omitted.                                                            |
| `SPECIAL_HANDLING_UNSUPPORTED`             | `PLANNING`     | `true`       | A special-handling capability is not yet supported for automated work.                                   |
| `STOP_CONTACT_PHONE_INVALID`               | `null`         | `false`      | The optional phone value is malformed and was omitted from the stop snapshot.                            |

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
contracts, topology, and engineering-slice selection remain to be specified.

## Event envelope

Use a versioned, validated message envelope for durable commands and facts
with:

`messageId`, `messageType`, `schemaVersion`, `sourceService`, optional
`targetService`, `issuedAt` or `occurredAt`, `correlationId`, optional
`causationId`, an owner-record revision for facts, and a typed `payload`.
`ownerRevision` and reservation-specific revisions are positive JSON
safe integers starting at 1, no greater than
`Number.MAX_SAFE_INTEGER` (`9,007,199,254,740,991`), stored within that
bounded range as PostgreSQL `BIGINT`; zero, negative, and fractional
revisions are invalid.
`schemaVersion` is a semantic version string: compatible additive changes
increment `MINOR`, non-shape/non-meaning corrections increment `PATCH`, and
breaking changes increment `MAJOR`.
For a breaking change, deploy consumer support before producers emit the new
version. Retain old-version support until old producers and queued messages
are drained; remove it only through a separate verified cleanup.

Events state facts that happened; commands request an owner to perform work.
Commands additionally carry a stable `commandId`, `idempotencyKey`, and the
expected owner revision when the operation depends on a particular revision.
`sourceService` identifies the immediate publisher. User-originated commands
include `initiatingPrincipalId`, which is preserved through causally linked
commands and outcomes; autonomous work without a user initiator omits it. The
owning service authorizes the principal and resource access when it accepts
the command. Once durably accepted,
asynchronous processing may complete despite later permission changes;
domain state and concurrency rules still apply. Command outcomes distinguish
business acceptance/rejection from technical delivery failure. Assume
duplicate and delayed delivery. Consumers must validate, be idempotent,
expose failures, and define ordering and replay behavior. Within a supported
version, ignore unrecognized optional additive fields. Reject and quarantine
messages with unsupported contract versions rather than attempting
best-effort processing. Owner revisions let consumers identify stale and
missing updates without relying on timestamps as an ordering guarantee.
The owning service defines freshness and validity by fact type; include
observation and validity/expiry metadata where applicable rather than
applying a universal time-to-live. Consumers treat missing or expired
hard-gate facts as unknown/ineligible, never as approval.
Consumers apply only revisions newer than the highest applied revision for
each resource and ignore duplicate or stale facts. On a revision gap, they
fetch the current authoritative snapshot from the owner by resource ID,
update their projection to the snapshot's revision, and ignore later-
delivered facts at or below it. Owner services publish the specific versioned
business fact that occurred rather than a full resource snapshot on every
event; consumers obtain the current owner snapshot when reconciliation is
required using RabbitMQ request/reply. Event-fed projections target
owner-fact application lag at p95 of no more than
five seconds and are marked stale when a required owner update remains
unapplied for 30 seconds. A stale projection must not authorize a hard-gate
decision; block it until the update or reconciliation is applied. These are
projection-lag targets, not TTLs for owner facts. Do not query another
service's database or use synchronous service-to-service HTTP for this
recovery. The
owner returns the authoritative record and `ownerRevision` through
owner/resource-specific typed messages, not a polymorphic generic snapshot
response. The typed request identifies the resource, consumer's
`lastAppliedOwnerRevision`, and incoming `observedOwnerRevision`; the reply
contains the resource ID, current `ownerRevision`, and complete current
owner snapshot. Use owner/resource-specific `*.snapshot.get` and
`*.snapshot.result` message types with matching `.v1` routes (for example,
`load.snapshot.get.v1` and `load.snapshot.result.v1`). If the owner is unavailable, retain the last projection, mark it
stale, retry reconciliation, and do not apply later revisions for that
resource until the gap is repaired. Permanently invalid or unsupported-
version messages are quarantined unchanged with a failure reason and alert
the `tms_operations_administrator` and owning service. Replay is audited and
allowed only after the consumer or contract is repaired; business-state
changes still require owning-domain approval.
If the owner responds `NOT_FOUND`, keep the projection stale, park
reconciliation visibly, and do not apply later facts for that resource until
the mismatch is repaired.
If the snapshot `ownerRevision` is below the request's
`observedOwnerRevision`, treat it as an owner consistency failure; retain
stale status and retry with the shared bounded backoff. Do not advance or
apply later facts until a snapshot is returned at least as new as the
observed fact. Park visibly when retries are exhausted.
Persist reconciliation evidence per consumer/resource: last-applied and
observed revisions, request/message IDs, attempt count, timestamps, returned
snapshot revision or `NOT_FOUND`, and final `REPAIRED`/`PARKED` status.
Keep the repaired projection, not a duplicate full snapshot. Assign a
UUIDv7 `reconciliationId` per consumer/resource gap as the
`correlationId`; snapshot replies point to the request `messageId` as
`causationId`, and delivery retries reuse the same request identity.
Retain cross-service business-message outbox/inbox metadata and consumer
deduplication records until the related workflow is terminal and for one year
afterward. This excludes Notification provider delivery-attempt logs, which
follow the Notification-specific policy. After that period, do not replay the
expired message; a new command requires owning-domain authorization.

Asynchronous command outcomes distinguish accepted and rejected business
results from transient technical delivery failures. Business rejection is a
workflow outcome, not a retryable transport error. The receiver publishes a
typed, versioned command-outcome message correlated by `commandId`. A
business rejection carries a stable, domain-owned `reasonCode`, a safe
message, and optional structured details; its versioned schema publishes the
code catalogue. Never echo secrets or raw submitted values. Inability to
deliver or durably accept a command remains a technical delivery failure,
not a business outcome. `ACCEPTED` confirms durable recording for processing,
not completion of the requested workflow; subsequent completion is reported
as domain facts. `REJECTED` is a final business refusal.

Receivers deduplicate commands by issuing service and `commandId`, storing
the normalized content hash and outcome in the local inbox. Matching
redelivery returns the stored outcome. Reuse with changed content is
quarantined as an ID-reuse contract violation and applies no business effect.

## Load booking fact

After the accepted booking transaction commits, Load publishes one
`load.booked` fact for every created Load using routing key
`load.booked.v1` and schema version `1.0.0`. Each fact represents one Load,
not the whole submission batch. The payload identifies the Load, its
human-readable reference, the originating `bookingSubmissionId` and
1-based `sourceRowNumber`, and contains its complete immutable initial
`loadRevision` snapshot and explicit `lifecycleStatus: "BOOKED"`. The fact is
committed to the Load outbox with the booking transaction. It is the planning
input; consumers do not synchronously read Load to start planning. Later
amendments publish separate revision facts.

The payload shape is:

```json
{
  "loadId": "uuid",
  "loadReference": "LD-100001",
  "bookingSubmissionId": "uuid",
  "sourceRowNumber": 1,
  "lifecycleStatus": "BOOKED",
  "loadRevision": {
    "revisionId": "uuid",
    "revisionNumber": 1,
    "createdAt": "2026-10-18T00:30:00Z",
    "customerId": "uuid",
    "customerNameSnapshot": "Example Customer",
    "customerReference": "CUSTOMER-PO-4821",
    "customerRate": {
      "amount": "1250.00",
      "currency": "USD"
    },
    "equipmentProfile": "DRY_VAN",
    "stops": [
      {
        "stopId": "uuid",
        "sequenceNumber": 1,
        "type": "PICKUP",
        "address": {
          "addressLine1": "100 Example Street",
          "city": "Los Angeles",
          "stateCode": "CA",
          "postalCode": "90001",
          "countryCode": "US"
        },
        "appointmentWindow": {
          "startAt": "2026-10-20T15:00:00Z",
          "endAt": "2026-10-20T17:00:00Z",
          "timeZone": "America/Los_Angeles"
        }
      }
    ],
    "freightLines": [
      {
        "freightLineId": "uuid",
        "sequenceNumber": 1,
        "description": "Boxed machine parts",
        "quantity": "12",
        "handlingUnitCode": "PALLET",
        "stackable": true,
        "dimensions": {
          "length": "48.00",
          "width": "40.00",
          "height": "36.00",
          "unit": "IN"
        }
      }
    ]
  }
}
```

`loadRevision` uses the canonical immutable revision representation:
revision metadata plus the complete normalized Load fields and server-
generated row IDs. It is not a copy of the HTTP request: each stop has a
Load-generated UUIDv7 `stopId` and each freight line has a Load-generated
UUIDv7 `freightLineId`; both use contiguous 1-based `sequenceNumber` values.
Generate new stop and freight-line identifiers for every new revision,
including unchanged rows; never carry row IDs forward from an earlier
revision.
`customerNameSnapshot` is the Customer's legal name resolved by Counterparty
Registry when the revision is created; do not substitute the optional
display name. Later Customer name changes do not rewrite this revision.
Omit optional fields with no value; use `null` only where the contract
explicitly defines a meaningful nullable value. Apply this serialization
rule consistently to `load.booked`, `load.revision.created`, and Load
snapshot responses.
The complete required/optional revision field inventory is represented in
the [Load OpenAPI specification](./api/load.openapi.yaml); this guide
remains the semantic source for salvage behavior and business outcomes.

The envelope fields are: UUIDv7 `messageId`; `messageType: "load.booked"`;
`schemaVersion: "1.0.0"`; `sourceService: "load"`; UTC `occurredAt` equal to
the commit time; `correlationId` equal to `bookingSubmissionId`; and
`ownerRevision: 1` for the first fact about this Load. Omit `targetService`
because the fact may have multiple consumers, and omit `causationId` because
an HTTP request is not a durable message. Include `initiatingPrincipalId`
when the booking was user-originated. The envelope's `ownerRevision` is a
monotonically increasing per-Load fact sequence, independent of
`loadRevision.revisionNumber`; each later published Load fact advances it.
Consumers use it for ordering and gap detection.

For example, the envelope and payload are carried together in the durable
message body:

```json
{
  "messageId": "0199f4e8-2c10-7abc-8def-1234567890ab",
  "messageType": "load.booked",
  "schemaVersion": "1.0.0",
  "sourceService": "load",
  "occurredAt": "2026-10-18T00:30:00Z",
  "correlationId": "0199f4e8-2c10-7abc-8def-1234567890ac",
  "ownerRevision": 1,
  "initiatingPrincipalId": "0199f4e8-2c10-7abc-8def-1234567890ad",
  "payload": {
    "loadId": "0199f4e8-2c10-7abc-8def-1234567890ae",
    "loadReference": "LD-100001",
    "bookingSubmissionId": "0199f4e8-2c10-7abc-8def-1234567890ac",
    "sourceRowNumber": 1,
    "lifecycleStatus": "BOOKED",
    "loadRevision": {
      "revisionId": "0199f4e8-2c10-7abc-8def-1234567890af",
      "revisionNumber": 1,
      "createdAt": "2026-10-18T00:30:00Z"
    }
  }
}
```

The abbreviated example above omits revision business fields only for
brevity; a published `load.booked` fact always contains the complete required
`loadRevision` snapshot.

## Initial Load planning command

A Temporal activity hosted by Load publishes the initial planning request
only after Load reports the exact current revision as `READY`. The per-Load
workflow starts from `load.booked` and waits on Load-owned readiness facts.
For every committed revision, Load publishes a separate
`load.planning.readiness.changed` fact with state `READY` or `HELD` and
field-addressed blocking issues for missing planning-stage information. An amendment also
publishes `load.revision.created` with its complete immutable revision
snapshot; the initial revision is carried by `load.booked`. The complete
readiness reason-code catalogue is defined in the planning-readiness contract
below.

After a `READY` fact, a Temporal activity hosted by Load publishes the
initial planning request. Use message type
`dispatch.load.plan`, routing key `dispatch.load.plan.v1`, and schema version
`1.0.0`. The command envelope sets `sourceService: "load"`,
`targetService: "dispatch-planning"`, `correlationId` to the booking
submission ID for the initial planning intent, and `causationId` to the
current `load.planning.readiness.changed` fact's `messageId`.
Preserve `initiatingPrincipalId` when present. The payload contains
`loadId`, `loadRevisionId`, `loadRevisionNumber`, and
`expectedLoadOwnerRevision`; it does not repeat the full snapshot.
Dispatch validates the command against its projection built from
`load.booked`. A projection that has not yet applied the referenced fact
must durably retain the command and defer planning until that exact revision
is available; do not fetch Load synchronously or plan from an older revision.
If the projection has advanced beyond `expectedLoadOwnerRevision`, return
final `REJECTED` with `STALE_LOAD_REVISION` and make no planning decision.
Temporal then issues a new command for the latest projected owner revision.

`commandId` identifies and correlates the durable command. Its
`idempotencyKey` is opaque and scoped to source service, message type, and
Load. Redelivery/retry of one planning intent reuses the same `commandId`
and key; a deliberate new planning intent gets new IDs and a new key, even
for the same Load revision.

The command outcome reports durable receipt only. `ACCEPTED` means Dispatch
has recorded the command for processing; a business refusal is a final
`REJECTED` outcome with a domain-owned reason code. Planning progress,
unassigned outcomes, and active Assignment decisions are reported through
separate versioned facts.

Publish the receipt as message type `dispatch.load.plan.outcome`, routing key
`dispatch.load.plan.outcome.v1`, schema version `1.0.0`, from
`sourceService: "dispatch-planning"` to `targetService: "load"`. Its
`causationId` is the plan command's `messageId`; preserve the command's
`correlationId` and `initiatingPrincipalId`. The payload contains
`commandId`, `loadId`, `expectedLoadOwnerRevision`, and `outcome`
(`ACCEPTED` or `REJECTED`). A rejection also contains a stable
domain-owned `reasonCode`, a safe `message`, and optional structured
`details`. `occurredAt` in the envelope is the outcome time.

## Load revision and planning-readiness facts

`load.revision.created` uses routing key `load.revision.created.v1` and
schema version `1.0.0`. Its payload contains `loadId`, `loadReference`, and
`loadRevision` using the same complete immutable revision representation as
`load.booked`. It is emitted for committed amendments, not for the initial
revision.

`load.planning.readiness.changed` uses routing key
`load.planning.readiness.changed.v1` and schema version `1.0.0`. Its payload
contains `loadId`, `loadRevisionId`, `loadRevisionNumber`, `state` (`READY`
or `HELD`), and `blockingIssues`. Each blocking issue contains a stable
`code`, RFC 6901 `fieldPath`, and optional safe `message`; the array is empty
for `READY`. It is emitted for every committed revision. Only `READY` for
the current revision permits planning. The event envelope's per-Load
`ownerRevision` advances for each fact; a planning command names the
readiness fact's `ownerRevision` as `expectedLoadOwnerRevision`.

Readiness uses a dedicated code catalogue, distinct from booking
`followUpItem` codes:

| Readiness code                               | Field path                         | Condition                                                                        |
| -------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------- |
| `READINESS_EQUIPMENT_PROFILE_MISSING`        | `/equipmentProfile`                | Profile absent.                                                                  |
| `READINESS_EQUIPMENT_PROFILE_UNSUPPORTED`    | `/equipmentProfile`                | Selected profile is unsupported for automated planning.                          |
| `READINESS_GROSS_WEIGHT_MISSING`             | `/totalGrossWeight`                | Gross weight absent.                                                             |
| `READINESS_REEFER_TEMPERATURE_RANGE_MISSING` | `/temperatureRange`                | Reefer Load has no range.                                                        |
| `READINESS_REEFER_TEMPERATURE_RANGE_INVALID` | `/temperatureRange`                | Supplied range was malformed or had minimum greater than maximum.                |
| `READINESS_FREIGHT_LINE_DIMENSIONS_MISSING`  | `/freightLines/{index}/dimensions` | Dimensions are required for a stackable line or flatbed Load but are absent.     |
| `READINESS_FREIGHT_LINE_DIMENSIONS_INVALID`  | `/freightLines/{index}/dimensions` | Required supplied dimensions were partial or invalid.                            |
| `READINESS_FLATBED_TARP_REQUIREMENT_MISSING` | `/tarpRequired`                    | Tarp decision absent.                                                            |
| `READINESS_FLATBED_TARP_REQUIREMENT_INVALID` | `/tarpRequired`                    | Supplied tarp decision was not boolean.                                          |
| `READINESS_SPECIAL_HANDLING_UNSUPPORTED`     | `/specialHandlingCodes/{index}`    | Code requires an unsupported capability.                                         |
| `READINESS_EQUIPMENT_PROFILE_INVALID`        | `/equipmentProfile`                | A supplied invalid profile was omitted; planning still requires a valid profile. |
| `READINESS_GROSS_WEIGHT_INVALID`             | `/totalGrossWeight`                | A supplied invalid weight was omitted; planning still requires a valid weight.   |
| `READINESS_SPECIAL_HANDLING_CODE_INVALID`    | `/specialHandlingCodes/{index}`    | An invalid special-handling entry was omitted; correct it before planning.       |

Emit one blocker per distinct code/path pair, ordered by `fieldPath` and then
`code`. Invalid optional planning facts are omitted from the canonical Load
revision and produce readiness blockers rather than booking rejection
issues. Use a `*_MISSING` code when a required fact was absent and a
`*_INVALID` code when supplied but invalid; never report both for one field
in the same revision.

## Initial Dispatch Planning policy

Load readiness is a prerequisite, not a capacity decision. Dispatch Planning
may evaluate only the exact current `READY` Load revision and current,
owner-validated facts. It evaluates each hard gate before ranking candidates;
no score, preference, manual override, or nomination can bypass a failed
hard gate.

### Hard feasibility gates

A candidate plan is feasible only when all of the following hold:

1. **Load and Carrier:** The Load is not canceled, is planning-ready at the
   exact current revision, and has no conflicting active Assignment. If the
   Load has a binding Carrier selection, consider only that Carrier; it must
   be `ACTIVE`, and every applicable Carrier eligibility fact required by
   policy must be present, current, valid, and verified. Any contracted
   capacity candidate must likewise have an active Carrier relationship and
   pass applicable Carrier eligibility gates.
2. **Equipment:** Every segment has one power unit and one compatible
   trailer. Both must be operationally eligible, available for the complete
   segment window, free of blocking maintenance status, and compatible with
   the Load's equipment profile, dimensions, weight, temperature, and known
   handling requirements. A missing or stale hard-gate fact is
   ineligible—not approval.
3. **Drivers:** Each segment has one qualified available driver, or two when
   an explicit applicable requirement calls for a team. Every driver must
   be eligible for the assigned equipment, Carrier relationship, and
   operating requirements over the whole segment. A legal or safety
   eligibility requirement whose authoritative rule, source, and verifier
   have not been approved is not considered satisfied: automated
   finalization for affected work remains disabled until qualified review
   defines its gate. The initial TMS does not calculate or certify
   regulatory hours-of-service compliance.
4. **Route and schedule:** The ordered Load stops are covered continuously
   by segments. A planned arrival must fall within each confirmed appointment
   window; route travel time, stop service time, and repositioning between
   segments must fit without overlapping the resource's existing confirmed
   work or availability boundaries. Use a provider-neutral route-estimation
   interface; do not make feasibility dependent on one vendor's proprietary
   API or data model. Each estimate records the covered legs, distance and
   travel duration, applicable vehicle/route constraints, calculation time,
   source/provider (or reviewed manual source reference), and model/policy
   version. Stop service-time assumptions are explicit, versioned policy
   inputs, not hidden constants. If required estimates or approved service-
   time policies are unavailable, defer for visible human review; do not
   call the Load unassigned because of an unknown estimate or automatically
   finalize using an unverified manual estimate.
5. **Capacity:** All resource windows in the complete plan must be reservable
   atomically by Capacity Commitment. A partial reservation is not a feasible
   plan. Dispatch Planning's lease and a nomination are not capacity claims.
6. **Load geometry:** Every stackable freight line must have complete
   per-handling-unit dimensions, and every flatbed freight line must have
   dimensions. The initial planner may compare declared dimensions and
   weight against known equipment limits, but it does not calculate a
   complete trailer arrangement, optimize partial-load floor area, infer
   orientation, or prove stack strength. Such packing claims require a later
   validated capability.

### Candidate ranking and preferences

Apply ranking only among candidates that pass every hard gate. Use this
lexicographic order; a lower-priority criterion cannot outweigh a
higher-priority one:

1. Maximize the minimum schedule buffer between estimated arrival and the
   relevant boundary of each confirmed appointment window.
2. Minimize total deadhead and repositioning time using the same pinned
   route-estimate versions used for feasibility.
3. Honor explicit, current driver/resource preferences where they do not
   weaken a hard gate or conflict with another assigned resource.
4. Minimize unnecessary resource changes and additional drivers or segments
   while preserving a feasible plan.
5. Resolve an otherwise exact tie by stable ascending resource UUIDs and
   then stable Trip Plan/segment identifiers.

A strong avoid-preference or explicit driver objection blocks automatic
finalization for that proposal and creates the bounded human-review hold
selected in D-08. It is neither silently ignored nor treated as an
unqualified legal veto. Preference facts must carry their owner, scope,
strength, observed time, and validity; missing or stale preferences do not
become implied consent. Record the policy version and evaluated
owner-revision set with every planning attempt so the ranking is
reproducible.

Open a review task for the responsible dispatcher and require acknowledgement
within 15 minutes. If unacknowledged at that deadline, escalate to the
transportation executive using the existing urgent-notification policy.
Acknowledgement records receipt only; it does not resolve the objection or
authorize an override. Keep the proposal on hold until an authorized,
reasoned disposition is recorded. Do not auto-assign or auto-reject when the
review timer expires.

### Planning horizon, profiles, and contention

Evaluate Loads only when pickup falls within 14 days of the planning time.
Each trio may have no more than five future Load reservations in its
sequential chain. A new slot opens only after the earliest reserved Load is
assigned and Execution records its actual pickup. Loads booked beyond the
rolling horizon, or Loads beyond a full five-Load chain, remain booked but
are not immediately ranked or reserved for that trio. The five-Load/14-day
policy is distinct from CC's temporary five-minute `HELD` state.

Dispatcher ranking of Loads is separate from D-499's automated ranking of
feasible resource candidates. A newly eligible booked Load within the
planning horizon creates ranking opportunities for dispatchers managing
feasible trios, and the responsible dispatchers are notified. A dispatcher
may rank eligible booked Loads for their
managed trio, but only the final Load in the reserved chain may be
re-ranked. With four future reservations, the fifth is the only next Load
position eligible for ranking; while five are reserved, do not rank or
reserve a sixth. First use currently unassigned feasible capacity to maximize
coverage of booked Loads. Then evaluate preference-driven reallocation against the
complete affected chain. Reallocate automatically only when the ranked
alternative is feasible and all other valid Load coverage and hard gates
remain intact. A material company-benefit alternative not ranked by the
dispatcher may be offered for explicit acceptance; decline or no response
preserves the current reservation.

Do not defer same-day Loads for rankings. For next-day Loads booked by 14:00
local time in `America/Los_Angeles`, collect rankings through 16:00 local
time and then plan. A Load booked after 14:00 may wait until the next normal
planning cycle only if that delay preserves feasibility; otherwise plan
immediately without waiting for ranking.

When a Load in a reserved chain is canceled or becomes infeasible, review
the affected suffix immediately and preserve the valid prefix. First try
replacing the affected Load with a booked, unreserved Load with matching
pickup and delivery areas within the approved deadhead allowance. If no
replacement preserves feasibility, release the affected future tail and
return the resulting trio capacity to planning. Never release completed or
in-progress work as part of this recovery. The numeric deadhead allowance
remains an explicit policy prerequisite; do not infer one from route
estimates.

When a Trip or per-Load Execution ends earlier than planned, use the
authoritative actual closeout location to immediately revalidate the
unstarted reservation suffix and replan the available trio from that
location, minimizing feasible deadhead. Preserve suffix Loads that remain
feasible; apply the replacement/release rule above to the first infeasible
Load and its affected tail. Do not wait for the next ranking cycle. Missing
or stale resource facts or remaining freight do not establish that the trio
is available; require current owner facts before assigning new work.
Customer pricing, responsibility, and commercial resolution remain with the
broker and are not inferred by Dispatch Planning.

Use the four composable policy profiles: outbound/return-home crossed with
short/long duration. Outbound planning accounts for concentrated home-area
capacity and competition, including fast decisions for short trips.
Return-home planning may collect and compare suitable Loads over the
available horizon before routing unsuitable work to a Contractor or outside
Carrier. Long-trip feasibility includes required rest-place capability;
short-trip feasibility accounts for the greater stop frequency. Profiles
never relax hard eligibility, safety, schedule, or capacity gates.

Multi-Load Trip Plan consolidation considers only current `READY` Loads
whose pickup windows overlap the evaluated plan's operational window and
whose full combined sequence passes the same hard gates. A later candidate
Load must not invalidate an already active Assignment except through the
bounded final-Load re-ranking and complete reservation-replacement
workflow above.

Compose Load requirements and Trip/segment operating profiles; do not infer
legal or contractual eligibility from a profile label. `OUTBOUND` and
`RETURN_HOME` are evaluated per assigned driver's recorded home-area policy.
`SHORT` and `LONG` are evaluated from estimated elapsed time between the
first planned pickup arrival and final planned delivery departure. Profile
`SHORT` means no more than 12 elapsed hours; `LONG` means more than 12 elapsed
hours. `RETURN_HOME` means the driver's final planned stop is within that
driver's configured home-area boundary; otherwise, when a home area is
configured, the profile is `OUTBOUND`. If the driver has no configured
home-area boundary, do not assign either direction profile. These initial
classification rules are versioned policy inputs and do not replace resource
eligibility, appointment feasibility, or any legal hours-of-service
determination. Record the applied profile and policy version in each
attempt. Do not infer a home area from company headquarters or an assigned
area.

Operational profile labels do not define the system's supported fleet size,
throughput, or service-availability target. Those measurable acceptance
profiles are defined with product-wide operational success criteria; do not
infer numeric scale limits from the sample organization or geography.

When simultaneous attempts contend for the same resources, Capacity
Commitment's atomic reservation result is authoritative. The successful
reservation wins; rejected attempts retain no partial claims and replan
from the current owner projections and capacity facts. Do not rely on
candidate ordering or an in-memory lock as a substitute for this outcome.
The attempt records its input revisions, policy version, feasibility result,
and stable reason codes. Recompute only after a relevant owner fact or
revision changes, an explicit durable timer fires, or an authorized human
requests a new attempt. Missing/stale projections trigger reconciliation
and defer the attempt; they must not produce `UNASSIGNED`.

## Unassigned planning result

When a completed planning attempt cannot find eligible capacity,
Dispatch Planning publishes one `load.planning.unassigned` fact for the
Load. It uses routing key `load.planning.unassigned.v1`, schema version
`1.0.0`, `sourceService: "dispatch-planning"`, and
`causationId` is the corresponding `dispatch.load.plan` command's
`messageId`; it preserves that command's `correlationId` and optional
`initiatingPrincipalId`. Omit `targetService` because the fact may be
consumed by Load, Operations View, and notification processing. Its
Dispatch-owned per-Load `ownerRevision` advances independently of the Load
revision.

There is no separate planning-started or phase-progress fact. The durable
`dispatch.load.plan.outcome` receipt confirms intake; business consumers
receive terminal results.

The payload contains `loadId`, `loadRevisionId`, `loadRevisionNumber`,
`basedOnLoadOwnerRevision`, `planningAttemptId`, and `reasons`. Each reason
has a stable `code` and safe `message`; include every applicable reason once
per attempt. Do not expose candidate identities or internal scoring.
`basedOnLoadOwnerRevision` identifies the exact Load fact revision used by
the attempt. The fact envelope's `ownerRevision` is Dispatch Planning's
monotonically increasing per-Load fact revision, not the Load revision.

Initial reason codes are:

- `NO_CAPACITY_IN_TIME_WINDOW`: no eligible resource capacity is available
  for a required segment's time window.
- `INCOMPATIBLE_EQUIPMENT`: available equipment does not meet the Load's
  equipment requirements.
- `NO_QUALIFIED_DRIVER_COVERAGE`: no available driver or driver team meets
  the required qualifications and coverage.
- `NO_FEASIBLE_SEGMENT_COVERAGE`: Dispatch cannot construct a complete,
  feasible assignment across the required segments.
- `INSUFFICIENT_REPOSITIONING_TIME`: a resource cannot reach a subsequent
  segment within the available repositioning window.

The result records a completed planning attempt, not a Load lifecycle
transition. The Load remains `BOOKED` and unassigned. Dispatch may start a
new attempt when the current Load revision becomes `READY`, an owner fact
can change resource eligibility or capacity, or an explicit durable
deadline fires. Each attempt has a new UUIDv7 `planningAttemptId`. Do not
continuously retry without a triggering fact or durable deadline. If
required owner projections are missing or stale, defer planning and
reconcile; do not publish `UNASSIGNED` as though stale data proved capacity
unavailable.

## Active Assignment fact

After Capacity Commitment confirms the reservation and Load finalization
succeeds, Dispatch Planning publishes the terminal
`dispatch.assignment.activated` fact using routing key
`dispatch.assignment.activated.v1` and schema version `1.0.0`. The fact
means the Assignment is operationally active, not merely created or pending.
Its envelope follows the shared fact rules: `sourceService` is
`dispatch-planning`, `causationId` identifies the CC reservation-
confirmation outcome, and its Dispatch-owned per-Load `ownerRevision`
advances independently of the Load revision. Preserve the planning
workflow's `correlationId` and optional `initiatingPrincipalId`. Omit
`targetService` when publishing to multiple consumers.

The payload is the immutable Assignment snapshot. It contains
`assignmentId`, `planningAttemptId`, `loadId` and its immutable revision,
`tripPlanId` and its immutable revision, ordered assigned segments, and the
`reservation` reference
`{reservationId, reservationRevision, state: "CONFIRMED"}`. Do not include a
temporary expiry. It does not duplicate the full Load snapshot. Execution
consumes this fact to create its planned Trip and per-Load Execution records
idempotently by `assignmentId`.

Assignment, planning-attempt, Load/revision, Trip Plan, stop, resource, and
reservation IDs are UUIDv7. `loadRevisionNumber`, `tripPlanRevision`,
`reservationRevision`, and resource `ownerRevision` are positive safe JSON
integers starting at 1, bounded to `Number.MAX_SAFE_INTEGER`, and stored
within the same bounded PostgreSQL `BIGINT` range.

The top-level payload fields are:

| Field                                                                         | Type and constraint                                                                                        |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `assignmentId`, `planningAttemptId`, `loadId`, `loadRevisionId`, `tripPlanId` | UUIDv7 identifiers.                                                                                        |
| `loadRevisionNumber`, `tripPlanRevision`                                      | Positive safe JSON integers starting at 1, bounded to `Number.MAX_SAFE_INTEGER`.                           |
| `segments`                                                                    | Ordered array of the segment shape below.                                                                  |
| `reservation`                                                                 | Object with UUIDv7 `reservationId`, positive safe-integer `reservationRevision`, and `state: "CONFIRMED"`. |

Each `segments[]` entry has this shape:

| Field                                    | Type and constraint                                                                                                                                                      |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `sequenceNumber`                         | Positive safe integer; one-based and contiguous within the Assignment.                                                                                                   |
| `startStopId`, `endStopId`               | UUIDv7 references to the planned segment's boundary stops.                                                                                                               |
| `timeWindow.startAt`, `timeWindow.endAt` | RFC 3339 UTC timestamps ending in `Z`; `startAt` precedes `endAt`.                                                                                                       |
| `powerUnitId`, `trailerId`               | UUIDv7 identifiers.                                                                                                                                                      |
| `driverIds`                              | Array of one or two distinct UUIDv7 identifiers.                                                                                                                         |
| `resourceReadinessRevisions`             | Exactly one entry per assigned resource; each has `resourceType` (`POWER_UNIT`, `TRAILER`, or `DRIVER`), UUIDv7 `resourceId`, and positive safe-integer `ownerRevision`. |

## Dispatch-owned Assignment activation

After CC confirms the reservation and Load finalization succeeds, the
Dispatch Planning workflow activates its pending Assignment in an
idempotent owner transaction. Validate the pending Assignment and planning
attempt, Load finalization guard and exact Load revision, Trip Plan revision,
and confirmed CC reservation ID/revision in that order. Commit the active
Assignment state and `dispatch.assignment.activated` outbox fact atomically.
There is no self-directed Assignment activation command or separate
`ACCEPTED` receipt.

A business refusal emits the durable
`dispatch.assignment.activation.rejected` fact, using routing key
`dispatch.assignment.activation.rejected.v1` and schema version `1.0.0`.
Its `causationId` references the CC reservation-confirmation outcome; it
preserves the workflow's `correlationId`. The payload contains
`assignmentId`, `planningAttemptId`, `loadId`, a stable reason code, and a
safe message, with optional structured details. Omit `targetService` if the
rejection is published to multiple consumers. Technical failures use the
shared retry and recovery policy. After a business refusal, reconcile
Dispatch, the Load finalization guard, and CC. If activation is invalid,
explicitly release the confirmed reservation and replan; if the intent
remains valid, require an audited, owner-approved recovery.
The payload contains one primary `reasonCode`; Dispatch defines and
documents its validation order: pending Assignment/attempt, Load
finalization guard and exact Load revision, Trip Plan revision, then
confirmed CC reservation ID/revision. The initial rejection-code catalog
is:

- Assignment gate, in order: `ASSIGNMENT_NOT_FOUND`,
  `ASSIGNMENT_NOT_PENDING`, `PLANNING_ATTEMPT_MISMATCH`.
- Load gate, in order: `LOAD_FINALIZATION_GUARD_INVALID`,
  `LOAD_REVISION_MISMATCH`.
- Trip Plan gate: `TRIP_PLAN_REVISION_MISMATCH`.
- CC reservation gate, in order: `RESERVATION_NOT_FOUND`,
  `RESERVATION_NOT_CONFIRMED`, `RESERVATION_REVISION_MISMATCH`.

Within each gate, check existence before state and version consistency.

## Capacity reservation command

After Dispatch Planning creates a feasible pending Assignment plan, it
publishes `capacity.reservation.reserve` to Capacity Commitment, using
routing key `capacity.reservation.reserve.v1` and schema version `1.0.0`.
The envelope uses `sourceService: "dispatch-planning"` and
`targetService: "capacity-commitment"`; its `causationId` references the
`dispatch.load.plan` command that started the planning intent. The command
identifies `planningAttemptId`, `tripPlanId`, `tripPlanRevision`, and the
complete ordered segment set. Each segment has a one-based contiguous
`sequenceNumber`, `startStopId`,
`endStopId`, `timeWindow: {startAt, endAt}` with both values as RFC 3339 UTC
timestamps ending in `Z`, one `powerUnitId`, one `trailerId`, one or two
`driverIds`, and `resourceReadinessRevisions`. Each entry in that array has
`resourceType` (`POWER_UNIT`, `TRAILER`, or `DRIVER`), `resourceId`, and the
Fleet Readiness `ownerRevision`; there is exactly one entry for every
assigned resource. The activated Assignment reuses this complete segment
set. CC reserves the full resource/time-window set atomically: it returns
one reservation identifier and expiry, or a business rejection with no
partial claims. CC publishes
`capacity.reservation.reserve.outcome`, routing key
`capacity.reservation.reserve.outcome.v1`, schema version `1.0.0`, with
`outcome: RESERVED` or `REJECTED`. The outcome envelope uses
`sourceService: "capacity-commitment"` and
`targetService: "dispatch-planning"`; its `causationId` is the reservation
command's `messageId`, and it preserves the command's `correlationId` and
`initiatingPrincipalId` when present. Both outcomes contain `commandId`,
`planningAttemptId`, `tripPlanId`, `tripPlanRevision`, and `outcome`.
`RESERVED` adds `reservationId`, `reservationRevision: 1`, `state: HELD`,
and `expiresAt`. `REJECTED` adds a stable `reasonCode`, safe `message`,
`affectedSegments[]`, and boolean `replanMayResolve`. Each affected-segment
entry contains its submitted `sequenceNumber` and, when a specific submitted
resource failed validation, its `resourceType` and `resourceId`. Do not
include alternative candidates or disclose other customers' or carriers'
reservation details. Idempotency is scoped to `sourceService`, message
type, and `planningAttemptId`. Redelivery/retry reuses the same `commandId`
and `idempotencyKey`; a new planning attempt uses new values.
Reservation states are `HELD`, `CONFIRMED`, `RELEASED`, `EXPIRED`, and
`SUPERSEDED`; only `HELD` and `CONFIRMED` claims block capacity. Each
reservation starts at revision 1 in `HELD` and increments its
`reservationRevision` once per committed state transition. A complete
replacement creates a new reservation ID at revision 1 and advances the
prior reservation to `SUPERSEDED`. Temporary holds expire after five
minutes. Initial rejection codes are `RESOURCE_UNAVAILABLE`,
`STALE_READINESS_REVISION`,
`SEGMENT_TIME_CONFLICT`, `INCOMPATIBLE_RESOURCE`, and
`TRIP_PLAN_REVISION_STALE`. Do not disclose other customers' or carriers'
reservation details.
Set `replanMayResolve: true` for `RESOURCE_UNAVAILABLE`,
`SEGMENT_TIME_CONFLICT`, and `INCOMPATIBLE_RESOURCE`. Set it to `false` for
`STALE_READINESS_REVISION` and `TRIP_PLAN_REVISION_STALE` until Dispatch
refreshes the readiness projection or creates a current Trip Plan revision.
After Load finalization guards pass, Dispatch asks CC to transition the hold
from `HELD` to `CONFIRMED` immediately before activating the Assignment. A
failed finalization releases the hold. An interrupted Assignment activation
preserves the confirmed reservation for recovery against the same plan.
`capacity.reservation.release` (`capacity.reservation.release.v1`) releases
the complete reservation. `capacity.reservation.replace`
(`capacity.reservation.replace.v1`) atomically replaces it with the complete
feasible remaining segment set. Both commands use schema version `1.0.0`;
individual segment claims are never released piecemeal. Both commands
contain `commandId`, `idempotencyKey`, current `reservationId` and
`reservationRevision`, and `tripPlanId` and `tripPlanRevision`. Full release
has no segment payload. Replacement includes the complete ordered remaining
segment set using the established reservation segment shape. Durable
outcomes use `capacity.reservation.release.outcome` and
`capacity.reservation.replace.outcome`, respectively, with matching `.v1`
routing keys and schema version `1.0.0`. Each command's idempotency is
scoped to `sourceService`, message type, and the old `reservationId`;
Dispatch Planning is the sole command producer, using
`sourceService: "dispatch-planning"` and
`targetService: "capacity-commitment"`. Retries reuse the same `commandId`
and key, while a later mutation uses the new reservation ID. Set
`causationId` to the immediate durable business result authorizing the
mutation and preserve the saga's `correlationId`. Each outcome uses
`sourceService: "capacity-commitment"`,
`targetService: "dispatch-planning"`, and `causationId` equal to its
command's `messageId`; preserve the command's `correlationId` and optional
`initiatingPrincipalId`.
A successful release outcome echoes `commandId`, `tripPlanId`,
`tripPlanRevision`, `outcome`, and the released `reservationId`,
incremented `reservationRevision`, and `state: RELEASED`. A successful
replacement outcome echoes the same command/Trip Plan references and
`outcome`, the old reservation ID and incremented revision with
`state: SUPERSEDED`, and the new `reservationId` at revision 1. The new
reservation preserves the old reservation's state: `HELD` replacement
includes a five-minute `expiresAt`; `CONFIRMED` replacement remains
`CONFIRMED` and has no temporary expiry.
A rejected outcome echoes `commandId` and Trip Plan references, one stable
`reasonCode`, a safe `message`, and current reservation ID, revision, and
state when known. Rejection means no partial release or replacement was
committed. Both commands may reject with `RESERVATION_NOT_FOUND`,
`RESERVATION_NOT_ACTIVE`, `RESERVATION_REVISION_MISMATCH`, or
`TRIP_PLAN_REVISION_MISMATCH`. Replacement may also reuse
`RESOURCE_UNAVAILABLE`, `STALE_READINESS_REVISION`,
`SEGMENT_TIME_CONFLICT`, or `INCOMPATIBLE_RESOURCE`. Check reservation
existence, active state (`HELD` or `CONFIRMED`), reservation revision, Trip
Plan identity/revision, and then replacement-segment feasibility, in that
order. For cancellation-driven replacement of a confirmed multi-Load plan,
a definitive feasibility rejection leaves the old reservation unchanged;
Dispatch then issues `capacity.reservation.release` for the complete old
reservation, with the replacement rejection as its `causationId`. Only
after CC confirms full release may Dispatch report cancellation release
completion. The remaining Loads have no active reservation and return to
event-driven planning. A stale revision or other guard rejection requires
reconciliation before this fallback is considered.
`STALE_READINESS_REVISION` requires readiness refresh and replacement
re-evaluation. Use this fallback only for a definitive
`RESOURCE_UNAVAILABLE`, `SEGMENT_TIME_CONFLICT`, or
`INCOMPATIBLE_RESOURCE` rejection after the current-state checks.
Load and cancellation workflows send durable cancellation intent to
Dispatch Planning; they do not mutate CC reservations directly. Dispatch
reconciles the Trip Plan before issuing release or replacement.
After Load commits a cancellation request, it publishes
`dispatch.load.cancel`, routing key `dispatch.load.cancel.v1`, schema
version `1.0.0`, with `sourceService: "load"` and
`targetService: "dispatch-planning"`. Its payload uses
`cancellationRequestId`, `loadId`, exact `loadRevisionId` and
`loadRevisionNumber`, and `expectedLoadOwnerRevision`. Dispatch validates
these against its event-built Load projection; the command does not carry
the cancellation reason, note, requesting principal, or full Load
snapshot. Load retains those request details.
Set `correlationId` to `cancellationRequestId`, omit `causationId` for this
root HTTP-originated request, and include the authenticated actor in
`initiatingPrincipalId`. Idempotency is scoped to `sourceService`, message
type, and `cancellationRequestId`; retries reuse the same `commandId` and
`idempotencyKey`. Dispatch Planning returns a durable
`dispatch.load.cancel.outcome`, routing key
`dispatch.load.cancel.outcome.v1`, schema version `1.0.0`, with
`ACCEPTED`/`REJECTED`; acceptance means the request was recorded for
processing, not that cancellation is complete. Its envelope uses
`sourceService: "dispatch-planning"`,
`targetService: "load"`, and `causationId` equal to the command's
`messageId`; it preserves the command's `correlationId` and optional
`initiatingPrincipalId`. Its payload always contains `commandId`,
`cancellationRequestId`, `loadId`, and `outcome`. `REJECTED` adds one stable
domain-owned `reasonCode` and safe `message`. Initial rejection codes are
`CANCELLATION_REQUEST_NOT_PENDING` and
`CANCELLATION_NOT_ALLOWED_EXECUTION_STARTED`, checked in that order; use
the latter only when the current Execution owner confirms actual execution
has begun. If execution starts after Load accepted the cancellation request,
keep it in `REQUIRES_RECONCILIATION`, do not mark it `CANCELLED` or discard
it, and route it to operational-exception/review handling.

After Dispatch Planning and CC release work completes, Dispatch publishes
the separate terminal release fact
`dispatch.load.cancellation.released`, routing key
`dispatch.load.cancellation.released.v1`, schema version `1.0.0`, confirms
that Dispatch Planning and CC have completed their applicable release work.
It does not declare the Load fully cancelled; Execution release and Load's
final `CANCELLED` transition remain separate owner confirmations. The
payload contains `cancellationRequestId`, `loadId`, `disposition`
(`FULL_RELEASE`, `REMOVED_WITH_PLAN_REPLACEMENT`, or
`NO_ACTIVE_DISPATCH_WORK`), and the affected `tripPlanId` and revision when
one exists. A replacement also identifies the old and new reservation IDs,
revisions, and states. The envelope uses
`sourceService: "dispatch-planning"`, preserves the cancellation `correlationId` and
optional `initiatingPrincipalId`, and advances Dispatch Planning's
per-Load `ownerRevision`. Set `correlationId` to
`cancellationRequestId`; use the final CC release/replacement outcome as
`causationId` when one occurred, or the accepted `dispatch.load.cancel`
command when no CC mutation was needed.
If Dispatch's Load projection is behind `expectedLoadOwnerRevision`, it
durably retains the command and waits for that exact revision; it does not
call Load synchronously.
If the projection is already newer, Dispatch reconciles using the current
Load snapshot and separately requests the exact cancellation-request
resource using `load.cancellation-request.snapshot.get`, routing key
`load.cancellation-request.snapshot.get.v1`, schema version `1.0.0`.
Dispatch identifies the request with `cancellationRequestId`; Load replies
through `load.cancellation-request.snapshot.result`, routing key
`load.cancellation-request.snapshot.result.v1`, schema version `1.0.0`, with
that ID, its `loadId`, current request-resource `ownerRevision`, and state,
or an explicit `NOT_FOUND` result. The reply omits the request reason, note,
and requesting-principal details. Both snapshots use the owner-specific
RabbitMQ request/reply recovery boundary and reconciliation correlation
rules described above. Dispatch proceeds only when the returned request
belongs to the command's Load, remains `PENDING_RELEASE`, and the current
Load is cancellable. If the request exists but is no longer pending or
belongs to a different Load, return the applicable stable business
rejection. An explicit `NOT_FOUND` is an integrity/reconciliation mismatch,
not a business rejection; keep the projection stale and park reconciliation
under the missing-resource rule above.
When a planned per-Load Execution exists, Load sends
`execution.load.cancel-planned`, routing key
`execution.load.cancel-planned.v1`, schema version `1.0.0`. Execution
validates that actual execution has not started and owns removal or voiding
of its record. The command contains `cancellationRequestId`, `loadId`,
`assignmentId`, `executionId`, and `expectedExecutionOwnerRevision`.
Execution validates all references against its authoritative record. Its
envelope uses `sourceService: "load"`, `targetService: "execution"`,
`correlationId: cancellationRequestId`, and the initiating principal when
present; omit `causationId` because this is directly triggered by the
root HTTP cancellation request. Execution responds with
`execution.load.cancel-planned.outcome`, routing key
`execution.load.cancel-planned.outcome.v1`, schema version `1.0.0`, and
`outcome: CANCELLED` or `REJECTED`. `CANCELLED` confirms the planned
Execution record was voided. The outcome always contains `commandId`,
`cancellationRequestId`, `loadId`, `assignmentId`, `executionId`, and
`outcome`. `CANCELLED` adds `executionState: VOIDED` and the resulting
Execution owner revision; `REJECTED` adds one stable `reasonCode` and safe
`message`. The outcome envelope uses `sourceService: "execution"`,
`targetService: "load"`, and `causationId` equal to the command's
`messageId`; it preserves the command's `correlationId` and optional
`initiatingPrincipalId`. Idempotency is scoped to `sourceService`, message
type, and `cancellationRequestId`; retries reuse the same `commandId` and
`idempotencyKey`. Validate record existence, Assignment match, owner
revision, actual-start state, then other non-`PLANNED` states. The initial
rejection codes in that order are `EXECUTION_NOT_FOUND`,
`ASSIGNMENT_MISMATCH`, `EXECUTION_OWNER_REVISION_MISMATCH`,
`CANCELLATION_NOT_ALLOWED_EXECUTION_STARTED` (`IN_PROGRESS`), and
`EXECUTION_NOT_PLANNED` (other non-`PLANNED` states). If execution has
started after Load accepted cancellation, keep the request in
`REQUIRES_RECONCILIATION` and route it to operational-exception/review
handling; do not mark the Load cancelled.
After Load commits `CANCELLATION_PENDING`, it requests Dispatch Planning/CC
release and planned Execution voiding in parallel when both work records
exist. Load commits `CANCELLED` only after every applicable owner
confirmation is durably recorded.
When Load commits the final `CANCELLED` transition after all applicable
release confirmations, it publishes `load.cancellation.completed`, routing
key `load.cancellation.completed.v1`, schema version `1.0.0`. The fact
contains `loadId`, `loadReference`, exact `loadRevisionId` and
`loadRevisionNumber`, `cancellationRequestId`, `state: CANCELLED`, and
`completedAt`. Individual downstream confirmations remain in Load's audit
record rather than being embedded in this fact. Set `sourceService: "load"`,
`correlationId: cancellationRequestId`, and preserve
`initiatingPrincipalId`. Use the last applicable durable Dispatch/CC or
Execution release confirmation as `causationId`; omit it only when no
downstream work existed and Load completed directly from the root HTTP
request. Advance Load's per-Load `ownerRevision`.

Dispatch requests hold confirmation using
`capacity.reservation.confirm`, routing key
`capacity.reservation.confirm.v1`, schema version `1.0.0`, with
`sourceService: "dispatch-planning"` and
`targetService: "capacity-commitment"`. CC responds with
`capacity.reservation.confirm.outcome`, routing key
`capacity.reservation.confirm.outcome.v1`, schema version `1.0.0`, and
`outcome: CONFIRMED` or `REJECTED`. Its envelope uses
`sourceService: "capacity-commitment"` and
`targetService: "dispatch-planning"`; its `causationId` references the
successful Load finalization-guard outcome. Preserve the command's
`correlationId` and optional `initiatingPrincipalId`. The outcome's
`causationId` references the confirm command's `messageId`; it preserves
the command's `correlationId` and optional `initiatingPrincipalId`. The
command's reservation ID and expected revision identify the existing hold.
The command contains `commandId`, `idempotencyKey`, `reservationId`,
expected `reservationRevision`, `tripPlanId`, and `tripPlanRevision`. The
outcome echoes `commandId`, reservation and Trip Plan references,
`outcome`, and the current `reservationRevision` when the reservation
exists. `CONFIRMED` adds `state: CONFIRMED`; `REJECTED` adds a stable
`reasonCode` and safe `message`. The command is conditional on the expected
reservation and Trip Plan revisions and does not repeat claim details.
Idempotency is scoped to `sourceService`, message type, and `reservationId`.
Redelivery/retry reuses the same `commandId` and `idempotencyKey`.
The initial rejection codes, checked in order, are `RESERVATION_NOT_FOUND`,
`RESERVATION_NOT_HELD`, `RESERVATION_REVISION_MISMATCH`, and
`TRIP_PLAN_REVISION_MISMATCH`. Validate reservation existence, state, and
revision in that order before checking the Trip Plan reference.

## Assignment-to-Execution handoff

Dispatch Planning publishes an immutable active Assignment only after CC
confirms the reservation and Load finalization guards pass. The Assignment
identifies `assignmentId`, `loadId` and its revision, `tripPlanId` and its
revision, assigned segment resources, and the reservation. Execution creates
the planned Trip and per-Load Execution records idempotently by
`assignmentId`. If the handoff fails, preserve the Assignment for visible
recovery; do not report active Execution until Execution confirms its records.
Execution may accept actual pickup/departure and transition a record from
`PLANNED` to `IN_PROGRESS` only when the Assignment remains active for the
exact current Load revision, its Capacity Commitment is confirmed, that Load
revision is `READY`, and required Fleet Readiness facts for assigned resources
are current and valid. No additional per-start dispatcher approval or driver
pre-trip attestation is required by the initial workflow. Assignment alone
does not assert movement.
Exact fact/command names and the Execution outcome payload remain open.

## Delivery reliability and errors

Use one durable RabbitMQ topic exchange per domain-owning service. Publish a
command to the exchange owned by its receiving service and route it to that
service's durable command queue. Publish a fact to the exchange owned by the
fact's authoritative service; each consumer owns its durable queue and binds
it to the fact routes it needs. A service never writes another service's
queue or database directly.
Use lower-case dot-separated domain/type/action routing keys with a MAJOR
schema-version suffix, such as `load.booking.accepted.v1`. MINOR and PATCH
versions remain in the envelope and share that route.
Do not set a default message TTL for durable business commands or facts.
Represent business deadlines in the command/workflow and let the owning
service validate them; retain delayed messages for recovery.
Give each service a unique TLS-authenticated broker identity. It may publish
facts only to its own exchange, publish commands only to explicitly approved
receiver exchanges, and consume only from its own queues. Runtime identities
cannot create or reconfigure topology; a separate deployment identity manages
exchanges, queues, and bindings. Version-control topology declarations with
service contracts and apply them through a dedicated deployment job before
service rollout; verify topology in CI/release checks.

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
Publish with RabbitMQ `mandatory` routing and publisher confirms. If a
confirmed publish is returned as unroutable because no durable queue is
bound, park it immediately with a topology error and alert the publisher
owner and `tms_operations_administrator`. After bindings are repaired,
requeue with an audit record of the operator, reason, and result, preserving
the original message ID.
Each consumer keeps a local inbox unique on `(consumer_service, message_id)`
with `RECEIVED`, `PROCESSED`, or `PARKED` status, attempt count, last error,
and timestamps. Duplicate delivery is a no-op. Commit a successful business
effect and the `PROCESSED` state atomically in the consumer's database.
Persist the received message and `RECEIVED` inbox row before acknowledging
RabbitMQ. A consumer worker schedules transient processing retries from the
inbox using the shared eight-attempt jittered schedule; after exhaustion,
park the record with its failure reason for authorized recovery. Do not use
broker redelivery as the processing retry scheduler.

HTTP transport errors use a consistent shape:

```json
{
  "error": {
    "code": "REQUEST_VALIDATION_FAILED",
    "message": "The request contains an unsupported field.",
    "retryable": false,
    "requestId": "uuid",
    "details": [
      {
        "code": "UNKNOWN_FIELD",
        "fieldPath": "/rows/0/unexpected",
        "message": "This field is not supported."
      }
    ]
  }
}
```

Each `details` entry contains a stable issue `code`, an RFC 6901
`fieldPath` when the issue is field-specific, and a safe `message`. Do not
include submitted field values in error details.

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
The latest applied Customer lifecycle-status fact remains valid until
superseded; it has no wall-clock TTL. If the projection is missing or known
stale because of a revision gap and Load cannot establish current status
because Counterparty Registry is unavailable, return retryable `503 Service
Unavailable` without committing a submission or Loads. The client may retry
the unchanged request with the same idempotency key after recovery. A known
inactive Customer is recorded as a durable business rejection with
`CUSTOMER_NOT_ACTIVE`.

The `503` uses the shared transport-error envelope with
`error.code: CUSTOMER_STATUS_UNAVAILABLE` and `retryable: true`; its safe
message states that current Customer status could not be verified. It does
not expose internal service details or create a submission.

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
When an applicable release or voiding step exhausts the shared automated
retry budget, keep Load in `CANCELLATION_PENDING`, set the request to
`REQUIRES_RECONCILIATION`, and retain the latest stable failure code and
time. Do not complete cancellation automatically while parked. After the
underlying issue is repaired and current owner state permits cancellation,
an authorized operator may resume the same workflow through an audited
action; the request returns to `PENDING_RELEASE` without creating a new
request or losing its history. A started Execution remains subject to
operational review and is not automatically resumed as a cancellation.
Retry exhaustion is not a terminal cancellation failure.
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
  revision field groups above; partial patches are not accepted. An omitted
  optional field is cleared in the new revision rather than inherited from
  the previous revision. The
  `customerId` must match the original booking and cannot be changed through
  amendment; reject a mismatch with `LOAD_CUSTOMER_IMMUTABLE` at
  `/customerId`. Require both `If-Match` with the current revision ETag and
  an `Idempotency-Key`.
- A valid amendment returns `201 Created`, a `Location` for the new revision,
  the new revision ETag, and a representation with `loadId`, `revisionId`,
  `revisionNumber`, `createdAt`, and `revalidationRequired`. When an active
  Assignment exists, revalidation is required before further automated
  progression. Freeze progression while revalidation occurs and retain the
  existing Assignment and confirmed Capacity Commitment until the replacement
  plan and capacity confirmation are durable. Then complete a coordinated,
  recoverable handoff to the Assignment and commitment for the amended
  revision before resuming progression; never resume the old plan against the
  amended revision. The old Assignment and commitment are retained for at most
  ten minutes from amendment commit, without deadline renewal. If replacement
  planning and capacity confirmation are not both durable by then, retire the
  revalidation attempt and begin coordinated release. Keep the Load blocked
  until both owners confirm release, then return it to normal planning; ignore
  late results from the expired attempt. The idempotency fingerprint includes both the normalized
  replacement snapshot and `If-Match` ETag. Resolve an existing idempotency
  result before re-evaluating the current ETag, so an identical retry replays
  its original result after the Load advances. An accepted same-key/same-
  fingerprint retry returns the same revision with `200 OK`; a rejected
  attempt replays its stored `422`. A same-key/different snapshot or ETag
  returns `409 Conflict`.
- Missing `If-Match` returns `428 Precondition Required`, durably retained
  against the request's idempotency fingerprint and replayed on identical
  retries; adding the ETag changes the fingerprint and requires a new key. A
  stale ETag returns `412 Precondition Failed`, durably retained and replayed
  on identical retries. Neither outcome creates a revision. A conflict with a
  Load finalization guard returns retryable `409 Conflict`. After actual
  execution starts,
  return `409 Conflict` with code
  `LOAD_AMENDMENT_NOT_ALLOWED_EXECUTION_STARTED`. A Load in
  `CANCELLATION_PENDING`, `CANCELLED`, or `COMPLETED` returns `409 Conflict`
  with code `LOAD_NOT_AMENDABLE`.
- An invalid full snapshot returns `422 Unprocessable Content` using the
  shared error envelope with `error.code: LOAD_AMENDMENT_INVALID` and
  `details` containing `fieldPath`, stable issue `code`, `message`, and
  `correctiveAction`, ordered by `fieldPath` and then `code`, both
  lexicographically. Durably retain the rejected attempt and its issues in
  the Load service's idempotency result, but create no revision and publish
  no revision fact. Identical retries replay the stored `422`; corrected
  content requires a new key. A Customer change requires a separate booking;
  handle the existing Load through its normal lifecycle controls.

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
  types are PDF, JPEG, and PNG; enforce at most 10 files per delivery stop
  and 25 MB (exactly 25,000,000 bytes) per file. `GET /api/v1/evidence-uploads/{uploadId}` returns
  `uploadId`, status, and expiry; statuses are `SCANNING`, `AVAILABLE`,
  `REJECTED`, or `EXPIRED`. Include `evidenceId` only for `AVAILABLE` and a
  stable `reasonCode` only for `REJECTED`; never return the object-storage
  URL from this endpoint. An unfinalized intent returns `409 Conflict` from
  this polling endpoint until it is finalized or expires; it becomes
  `EXPIRED` when its URL expires, and finalization then returns `410 Gone`.
  Create the
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

## Execution closeout and issue handoff

The per-Load Execution and Load become terminal when the transportation
attempt for that Load ends and its final stop outcomes are recorded. Trip
Execution completion remains independent. Each delivery stop requires clean,
`AVAILABLE` POD evidence when freight is unloaded. A stop with no delivery
requires a final actual outcome and linked issue, not a fabricated POD.
Receipt is sufficient for an own-fleet POD, while a contractor or
outer-Carrier POD requires dispatcher review. When POD upload is unavailable,
an authorized dispatcher may enter a delivery statement and reasoned
evidence-exception basis. Record this as an exception, not as a received or
verified POD.

Closeout records actual delivered and undelivered quantities and actual
delivery locations against the exact Load revision. Shortfalls, overages,
omitted stops, changed unload locations, and freight remaining after the last
delivery are factual outcomes that create a minimal Load-linked issue; none
blocks terminal closeout after the transportation attempt ends. A shared
trailer need not be physically empty: determine completion from the freight
for the specific Load. `COMPLETED` does not assert full delivery,
customer-satisfaction, or settlement.

Load owns the minimal issue record and delivery/handoff state. It hands the
issue record to the responsible out-of-scope service without sending the
detailed Load record or full Load snapshot. The receiving service owns
assignment, ongoing status, and resolution. Issue types, type-specific
minimum fields, recipient routing, and the durable message contract remain
open and must be specified before implementing those handoffs.

Driver-submitted stop milestones, stop outcomes, and incident reports require
an `Idempotency-Key` scoped to the Execution record and operation. An
identical normalized retry returns the stored fact; changed content under
the same key returns `409 Conflict`. Corrected facts are new append-only
records that identify the record being corrected and include a reason.
Delivered quantity is an integer count of handling units from the referenced
Load freight line, serialized as an integer decimal string and stored as
`NUMERIC(12,0)`. Zero is valid for a freight line with no delivery at a
particular stop. Preserve over-delivery in the reported fact; do not clamp it
to the committed quantity. Reconcile sums across delivery stops against the
exact Load revision at closeout and record delivered, undelivered, and
over-delivery quantities. A variance creates a minimal Load-linked issue for
handoff to its receiving service; it does not block terminal closeout or
require an internal TMS case resolution.

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
