# Company departments and service ownership

**Status:** Proposed company-wide accountability map. Department names and
accountable owners require company approval. The service boundaries and
statuses referenced below remain governed by their owning specifications.

## Purpose and scope

This document proposes a practical set of departments and assigns business
accountability for the services and systems they rely on. It covers the
company's TMS and adjacent services, whether a service runs in this
repository, on another company server, or is provided externally. It does
not make every listed capability a TMS responsibility or require each
service to be implemented as a microservice.

The proposed complete service-boundary catalog, first-phase simulation
approach, adapter/connector distinction, platform-tool classification, and
relocation principles are defined in the [application-wide service catalog
and integration architecture](SERVICE_CATALOG_AND_INTEGRATION_ARCHITECTURE.md).
This page owns the proposed department-to-service accountability mapping;
the catalog owns service boundaries and scope.

The map adds departmental accountability without renaming, replacing,
merging, moving, or decommissioning existing services. Existing service
boundaries, data authority, contracts, and deployments remain in effect.
The [TMS system blueprint](trucking/TMS_SYSTEM_BLUEPRINT.md) and
[service interaction map](trucking/SERVICE_INTERACTION_MAP.md) remain
authoritative for TMS architecture and service-level responsibilities.

## Ownership principles

- A **department** is accountable for a business outcome and the meaning and
  quality of its authoritative business data.
- A **service owner** is accountable for a service's product behavior,
  lifecycle, and contracts. Technical operations may be provided by the
  Technology, Data & Security department or a vendor without transferring
  business-data authority.
- A **service boundary** is independent of its hosting location. A system
  does not become part of the TMS merely because it supports transportation
  work.
- Each service has one accountable business department. Other departments
  can be required stakeholders, source owners, or technical operators.
  Departments may combine responsibilities as the company grows; service
  data ownership must still remain explicit.
- A department may use a vendor product or shared platform instead of
  operating a separate service. Vendor examples in other specifications
  remain candidates unless explicitly approved.
- TMS services own only their documented facts and transitions. Adapters
  translate external formats; they do not take authority away from source
  systems or decide whether a fact is acceptable for a business process.

## Proposed department set

| Department                               | Accountable scope                                                                                                                                                                                                                                                                       |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Executive & Corporate Administration** | Company direction, governance, corporate records, workforce administration, and cross-department accountability. At this stage, People/HR, legal administration, and payroll coordination may sit here or with Finance by owner decision.                                               |
| **Commercial & Customer Operations**     | Customer relationships, commercial intake, booking decisions, Customer-facing follow-up, and Customer master-record stewardship.                                                                                                                                                        |
| **Transportation Operations & Planning** | Load planning and assignment, capacity protection, transportation execution, operational work visibility, and planning decision support.                                                                                                                                                |
| **Fleet & Carrier Operations**           | Driver and equipment operations, readiness and availability evidence, Carrier operational coordination, and fleet-source-system stewardship.                                                                                                                                            |
| **Finance & Accounting**                 | Posted financial actuals, accounting records, billing, receivables, payables, Carrier settlement, and approved cost aggregates.                                                                                                                                                         |
| **Safety, Risk & Compliance**            | Company safety and compliance policy, verified source records, insurance and risk administration, and post-delivery claims or service-recovery ownership.                                                                                                                               |
| **Technology, Data & Security**          | Technical operation of shared platforms, identity infrastructure, integration delivery, data-platform operations, cybersecurity controls, and service reliability. This department does not own business facts or business authorization decisions by virtue of operating the software. |

This is a functional accountability model, not a staffing plan. One person
may cover multiple departments in an early-stage company. The owner may
combine or rename departments, but should preserve the explicit service
owner, source owner, and technical operator distinctions.

## Department-to-service accountability

The department column names the proposed business-accountable owner.
“TMS” identifies a service or workflow within the TMS target; “adjacent”
identifies a separate business system or service that may be independently
operated. “Platform” identifies shared technical capability, not a business
domain. A planned or open item is not a claim that a service exists. The
complete proposed application-wide inventory is in the
[service catalog](SERVICE_CATALOG_AND_INTEGRATION_ARCHITECTURE.md).

| Proposed accountable department      | Service or system                                                               | Scope and ownership boundary                                                                                                                                                                                                                                        | Classification and status                                                                                                                                                                   |
| ------------------------------------ | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Commercial & Customer Operations     | **Counterparty Registry**                                                       | Authoritative Customer and Carrier organization identities, profiles, and statuses. Fleet & Carrier Operations supplies Carrier-domain input; Registry does not own Carrier eligibility or fleet readiness.                                                         | TMS domain service; partial implementation is documented in the [monorepo guide](monorepo.md).                                                                                              |
| Commercial & Customer Operations     | **Load**                                                                        | Customer commercial commitment, booking outcomes, requirements and revisions, plus the documented Load-owned records and follow-up. It does not own assignment, capacity reservations, invoicing, or settlement.                                                    | TMS domain service; implementation is partial. See the [service interaction map](trucking/SERVICE_INTERACTION_MAP.md) and [operating model](trucking/OPERATING_MODEL.md).                   |
| Commercial & Customer Operations     | Customer relationship, intake, and communication tools                          | Customer contacts, prospecting or CRM, and any separate intake or communication tooling. TMS-facing data and handoffs require an approved contract; a customer portal is not implied.                                                                               | Adjacent; select only if needed.                                                                                                                                                            |
| Transportation Operations & Planning | **Dispatch Planning**                                                           | Planning attempts, evaluation, Trip Plans, ranking, matching decisions, and canonical Assignment. It consumes Load, Registry, Fleet Readiness, Capacity Commitment, and Economics facts without taking their authority.                                             | TMS domain service; target boundary is documented, implementation readiness is tracked separately.                                                                                          |
| Transportation Operations & Planning | **Capacity Commitment (CC)**                                                    | Authoritative capacity-window reservations, claims, expiry, and reservation transitions. It does not select resources or own Assignment.                                                                                                                            | TMS domain service; implementation is partial/in progress.                                                                                                                                  |
| Transportation Operations & Planning | **Execution**                                                                   | Movement facts, progress, stop outcomes, evidence, exceptions, corrections, and closeout. It does not own the commercial Load or downstream claim resolution.                                                                                                       | TMS domain service; target capability.                                                                                                                                                      |
| Transportation Operations & Planning | **Notification**                                                                | Actionable-work delivery, recipients, acknowledgements, and delivery/recovery state. Acknowledgement is not resolution of the underlying work.                                                                                                                      | TMS domain service; target capability.                                                                                                                                                      |
| Transportation Operations & Planning | **Operations View**                                                             | Read-only cross-service operational projections and freshness reporting. It does not make decisions or write authoritative business facts.                                                                                                                          | TMS domain service; target capability.                                                                                                                                                      |
| Transportation Operations & Planning | **Operational Economics**                                                       | Independent, versioned Load and resource estimates with provenance for planning. Dispatch Planning owns Load/resource pairing, its combined matrix, and the resulting decision. It does not own accounting actuals or vendor integrations.                          | Supporting service for the TMS; provisional specification and implementation status are documented in the [Operational Economics specification](trucking/OPERATIONAL_ECONOMICS_SERVICE.md). |
| Transportation Operations & Planning | Manual tender workflow                                                          | Dispatchers coordinate offers and responses with approved Carriers using the existing external communication channel; the TMS records tender rounds and binding selection. The business workflow is in scope, but the owning TMS service/API boundary remains open. | TMS capability plus an existing external channel; do not assume a separate tender microservice or Carrier portal.                                                                           |
| Fleet & Carrier Operations           | **Fleet Readiness**                                                             | Driver and equipment operational records, readiness and availability, and verified planning-critical Carrier eligibility facts and evidence. It consumes source facts where repair, ELD, or other systems own the underlying records.                               | TMS domain service; target capability.                                                                                                                                                      |
| Fleet & Carrier Operations           | Fleet, maintenance, and repair source systems                                   | Authoritative fleet asset, maintenance work-order, repair, and maintenance-status source records, where such systems are used. Fleet Readiness may consume approved facts; it does not become a maintenance-management system.                                      | Adjacent; current products, owners, and integration choices are not established here.                                                                                                       |
| Fleet & Carrier Operations           | ELD, telematics, and driver/equipment availability sources                      | Source observations for location, utilization, hours-of-service, and availability as approved for a particular workflow. A source reading is not itself a company authorization or readiness decision.                                                              | Adjacent; specific products, source fields, freshness, and legal interpretation require approval.                                                                                           |
| Fleet & Carrier Operations           | Carrier sourcing and relationship operations                                    | Carrier contact, relationship, qualification workflow, and external tender communications. Registry owns the Carrier identity/profile; Fleet Readiness owns only the defined planning-critical eligibility facts.                                                   | Business capability; divide operational records among approved service owners before implementation.                                                                                        |
| Finance & Accounting                 | Financial/Accounting service or system                                          | Authoritative posted/settled revenue and expense actuals, accounting records, and normalized cost aggregates for approved periods and operating contexts. It may consume accounting, payroll, fuel, maintenance, and purchasing source data.                        | Adjacent to the TMS; planned ownership in the [Operational Economics specification](trucking/OPERATIONAL_ECONOMICS_SERVICE.md).                                                             |
| Finance & Accounting                 | Billing, receivables, payables, and Carrier settlement                          | Invoices, accounting ledgers, customer payment tracking, Carrier payment obligations, and settlement records. Internal Load charge/cost proposals do not create these records.                                                                                      | Separate financial systems; expressly outside current TMS scope.                                                                                                                            |
| Safety, Risk & Compliance            | Safety, compliance, insurance, and credential systems                           | Authoritative evidence and case management for applicable safety, insurance, regulatory, and contractual matters. Qualified owners validate requirements before the TMS treats any evidence as a hard gate.                                                         | Adjacent; only the explicitly approved operational facts/gates are reflected in the TMS.                                                                                                    |
| Safety, Risk & Compliance            | Claims and service-recovery case management                                     | Owns issue intake after the TMS's minimal Load-linked issue handoff, including assignment, status, investigation, resolution, and any insurance/legal process.                                                                                                      | Adjacent and outside the current TMS claims lifecycle.                                                                                                                                      |
| Executive & Corporate Administration | People and corporate administration systems                                     | Employee/contractor records, onboarding administration, policy records, legal contract records, and corporate document administration, as assigned by the company.                                                                                                  | Adjacent; detailed product and data ownership are open. Legal agreements remain authoritative outside the TMS.                                                                              |
| Technology, Data & Security          | **Identity**                                                                    | Principals, credentials, sessions, and role grants. Each business service independently enforces authorization for its own records and transitions.                                                                                                                 | Shared identity service; target boundary, not implemented as a service.                                                                                                                     |
| Technology, Data & Security          | **API Gateway**                                                                 | API edge routing and transport concerns. It does not own domain data or authorize domain-specific business transitions.                                                                                                                                             | Shared technical service; currently limited to health/readiness/observability and the documented gateway baseline.                                                                          |
| Technology, Data & Security          | Integration adapters and connectors                                             | Vendor/API/file protocol handling, credentials, schema translation, validation, and delivery of source facts to their business owners. The relevant business department approves meaning, source precedence, and use.                                               | Shared technical capability; deployment can be independent where warranted. No one-adapter-per-vendor rule.                                                                                 |
| Technology, Data & Security          | Messaging, workflow, databases, observability, deployment, backup, and recovery | Operates the shared technical environment and reliability controls. RabbitMQ, Temporal, and NATS are platform tools, not business microservices or business-data owners.                                                                                            | Platform tools; deployment status remains environment-specific.                                                                                                                             |

Service implementation status changes over time. Use the linked service
specifications, [repository guide](monorepo.md), and current code as the
source of truth for what is implemented; this ownership register is not an
implementation inventory.

## Data sources, contracts, and change control

Before a service or integration is relied on for a business workflow,
document at least:

1. The accountable business department, service owner, technical operator,
   and authoritative source for every business fact it publishes or
   consumes.
2. The purpose, data scope, identifier and revision rules, freshness,
   validity, units, currency, time-zone meaning, provenance, and correction
   behavior needed by its consumers.
3. The direction of each exchange, its consumers, and the expected format:
   canonical HTTP contracts in service-owned OpenAPI specifications;
   durable commands and facts in service-owned AsyncAPI specifications; and
   explicit schemas and versioning for other approved forms such as files.
4. Validation, authentication and authorization, failure and retry
   behavior, idempotency, reconciliation, retention, privacy, and recovery
   requirements appropriate to the exchange.
5. Whether the integration is required, optional, simulated for testing, or
   not yet approved. Missing or stale authoritative input must not be hidden
   by an unapproved substitute.

This catalog does not invent payload fields, message names, source precedence,
vendors, deployment topology, or new API ownership. The [service contract
guide](contracts.md), [API index](api/README.md), service-owned API
specifications, and each TMS service specification define those details.
Where a contract or owner remains open, record that uncertainty in its owning
specification or the [open-decision register](trucking/OPEN_QUESTIONS.md).

Update this catalog in the same change whenever a TMS or adjacent service is
added, removed, renamed, changes accountable department, changes authoritative
data ownership, gains or loses a consumer, or changes an integration boundary.
Update the service's owning business/technical specification and its
OpenAPI/AsyncAPI or other schema artifact at the same time when their
responsibilities or contracts change. Review downstream consumers and
source owners before merging a contract change. Do not copy detailed service
rules into this catalog; link to the document that owns them.

## Related documentation

- [TMS responsibility map](trucking/TMS_SCOPE.md) — included responsibilities,
  exclusions, and scope gaps.
- [TMS system blueprint](trucking/TMS_SYSTEM_BLUEPRINT.md) — approved TMS
  boundaries, data authority, and shared platform roles.
- [TMS service interaction map](trucking/SERVICE_INTERACTION_MAP.md) —
  service-level responsibilities and handoffs.
- [Application-wide service catalog](SERVICE_CATALOG_AND_INTEGRATION_ARCHITECTURE.md) —
  complete proposed service boundaries, integration patterns, simulation,
  platform tools, and relocation principles.
- [Company roles and authority](trucking/RESPONSIBILITIES.md) — current
  business role and authority model.
- [Service contracts](contracts.md) and [API index](api/README.md) —
  technical contract principles and canonical machine-readable contracts.
