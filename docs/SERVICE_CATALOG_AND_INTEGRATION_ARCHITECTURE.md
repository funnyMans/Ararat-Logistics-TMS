# Application-wide service catalog and integration architecture

**Status:** Proposed complete service-boundary catalog for the initial
single-company trucking carrier and brokerage operating model. It is not an
approval to expand TMS product scope or to build every listed adjacent
system. The company owner must approve the catalog before it becomes an
implementation commitment.

## Purpose and scope

This catalog defines the proposed business-service boundaries needed to
describe the TMS and its adjacent company systems from the outset. The
services may live in the same application repository and development
environment, but that does not make them one TMS domain, one executable, or
one database. Each service may ultimately run on a different server or be
provided by an external application.

The list is complete for the currently identified operating model and
supporting departments, not an unlimited inventory of possible enterprise
software. TMS scope and approved responsibilities remain authoritative in
the [TMS responsibility map](trucking/TMS_SCOPE.md), [system
blueprint](trucking/TMS_SYSTEM_BLUEPRINT.md), and
[open-decision register](trucking/OPEN_QUESTIONS.md). Items explicitly
outside the TMS remain adjacent even when their simulator or integration
code is stored in this repository.

For the first phase, most adjacent systems and provider dependencies can be
represented by test-only fakers. Run the actual TMS service under test; do
not mistake a simulated adjacent system for a production capability.

## Business services, integration code, and platform tools

- A **business microservice** owns an identified business capability,
  authoritative records, and state transitions. It publishes contracts for
  other owners and does not share its write model or database with them.
- An **adapter** connects one internal service consumer to one external
  application. It isolates that provider's protocol, credentials, and data
  format for that consumer.
- A **connector** connects one external application or protocol to multiple
  approved internal service consumers. It may reuse authentication,
  transport, and translation work, but does not become an owner of their
  business facts or create a shared business model for them.
- An adapter or connector can be a library, worker, or independently
  deployed process. It is not a business microservice unless it owns a
  distinct business capability and authoritative business data.
- A **platform tool** provides technical execution, persistence, transport,
  or observability. It can run as a separate process, cluster, or managed
  product, but is not a business microservice and does not own company
  business records.

The word _service_ in deployment or vendor documentation can mean a running
software process. In this catalog, _business service_ means a data- and
responsibility-owning boundary. Running RabbitMQ or Temporal separately
does not add a RabbitMQ or Temporal business microservice to the company's
service inventory.

## Proposed complete service-boundary catalog

The owner column assigns proposed business accountability. “TMS” describes
the product boundary, not the repository or deployment location. “Adjacent”
services may be existing vendor applications, later company-operated
systems, or test-only simulations; they do not become TMS-owned by appearing
in this catalog.

| Proposed accountable department      | Service boundary                            | Authoritative responsibility                                                                                                                                                                                   | Initial realization                                                                                                                                      |
| ------------------------------------ | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Technology, Data & Security          | **Identity & Access**                       | Company principals, credentials, sessions, and role grants. Each business service still authorizes access to its own records and transitions.                                                                  | Shared company service required by the TMS target. Test identity fixtures may be used in isolated development; they are not production authentication.   |
| Commercial & Customer Operations     | **Counterparty Registry**                   | Customer and Carrier organization identities, profiles, statuses, and registry facts. It does not own Load terms, fleet readiness, or Carrier eligibility decisions.                                           | TMS domain service. Partial implementation is described in the [monorepo guide](monorepo.md).                                                            |
| Commercial & Customer Operations     | **Load / Commercial Operations**            | Booking outcomes, commercial Load commitment, immutable requirements and revisions, Load-owned follow-up, and Load-linked charge/cost proposals.                                                               | TMS domain service. Keep the existing Load boundary.                                                                                                     |
| Commercial & Customer Operations     | **Customer Relationship & Sales (CRM)**     | Customer contacts and relationship history, prospecting, and any sales pipeline beyond the booked Load. It is not the authority for a booked Load or Load requirements.                                        | Adjacent system. Use a provider or a contract-compatible simulator; standalone CRM/contact-center scope remains outside the TMS.                         |
| Fleet & Carrier Operations           | **Fleet Readiness**                         | Driver and equipment operational records, readiness and availability, plus verified planning-critical Carrier eligibility facts and evidence. It consumes repair/ELD facts from their source owners.           | TMS domain service. It does not become a maintenance, ELD, or safety case-management system.                                                             |
| Fleet & Carrier Operations           | **Fleet Maintenance & Repair**              | Fleet asset maintenance records, work orders, repair activity, and source maintenance-status evidence.                                                                                                         | Adjacent system and source of selected facts for Fleet Readiness. Simulate its contract before selecting or integrating a real provider.                 |
| Fleet & Carrier Operations           | **Telematics, ELD & HOS Provider Boundary** | Provider-originated location, equipment, driver, and hours-of-service observations. Provider data is evidence, not by itself a company readiness decision or legal interpretation.                             | External provider application behind an adapter or connector. Use a provider-shaped simulator until source, freshness, and field-use rules are approved. |
| Transportation Operations & Planning | **Dispatch Planning**                       | Planning attempts, evaluation, Trip Plans, ranking, matching decisions, and canonical Assignment. It consumes owner facts and does not own Load, readiness, or reservation records.                            | TMS domain service with its own data boundary.                                                                                                           |
| Transportation Operations & Planning | **Capacity Commitment**                     | Atomic resource-window reservations, claims, expiry, and reservation transitions. It does not choose resources or own Assignment.                                                                              | TMS domain service. The existing implementation status is documented in the [monorepo guide](monorepo.md).                                               |
| Transportation Operations & Planning | **Execution**                               | Movement facts, progress, stop outcomes, evidence, exceptions, corrections, and closeout. It does not own the commercial Load or downstream claim resolution.                                                  | TMS domain service.                                                                                                                                      |
| Transportation Operations & Planning | **Operational Economics**                   | Independent, versioned Load and resource estimates with provenance. It does not own financial actuals, provider integrations, or Dispatch's Load/resource pairing and decision.                                | TMS-supporting service. Its specification remains provisional; see the [Operational Economics specification](trucking/OPERATIONAL_ECONOMICS_SERVICE.md). |
| Transportation Operations & Planning | **Notification**                            | Actionable-work recipients, delivery attempts, acknowledgement, and delivery/recovery state. Notification does not own or resolve the underlying business work.                                                | TMS-supporting service; delivery-channel integrations are adapters or connectors.                                                                        |
| Transportation Operations & Planning | **Operations View**                         | Read-only cross-service operational projections, freshness, and rebuild state. It does not make decisions or write authoritative business facts.                                                               | TMS-supporting service; projections must be rebuildable from owner facts.                                                                                |
| Finance & Accounting                 | **Financial Accounting & Settlement**       | Posted financial actuals, accounting records, billing, receivables, payables, Carrier settlement, payroll actuals, and approved cost aggregates. Load rates and internal proposals are not financial postings. | Adjacent company system, not a TMS service. It can initially be represented by a contract-compatible simulator.                                          |
| Safety, Risk & Compliance            | **Safety & Compliance Records**             | Authoritative safety, compliance, insurance, and credential evidence and the related source-owned review records. Qualified owners establish requirements before the TMS treats evidence as a hard gate.       | Adjacent system. The TMS consumes only approved operational facts and does not infer regulatory policy.                                                  |
| Safety, Risk & Compliance            | **Claims & Service Recovery**               | Issue intake, assignment, investigation, status, resolution, and any claims or insurance workflow after the TMS handoff.                                                                                       | Adjacent system outside the current TMS claims lifecycle; a simulator can validate the handoff contract.                                                 |
| Executive & Corporate Administration | **People & Workforce Administration**       | Employee and contractor records, employment status, onboarding/offboarding, and workforce administration. Finance owns payroll postings and related actuals; Identity owns authentication and grants.          | Adjacent company system or provider. Do not copy its authoritative personnel record into TMS-owned data.                                                 |
| Executive & Corporate Administration | **Legal & Agreement Records**               | Authoritative legal contracts and signed company agreements. Operational services may retain scoped references or verified gate facts, not replace the legal record.                                           | Adjacent company system or provider; document/e-signature integration is not a new TMS domain by itself.                                                 |

This catalog deliberately does not create separate business microservices for
every department, vendor, source type, or record noun. In particular:

- **Manual tendering:** the proposed initial placement is Load-owned tender
  rounds and binding-Carrier selection, with external communication handled
  through an adapter or connector. Do not create a standalone Tendering
  microservice for the initial operating model. The exact tender API and
  payload ownership remain open in the existing TMS documentation; this
  proposal does not close that decision.
- **Carrier identity and eligibility:** Counterparty Registry owns the
  Carrier profile; Fleet Readiness owns only the defined planning-critical
  eligibility facts. They are not duplicates of a Carrier CRM.
- **Financial actuals and estimates:** Finance owns actuals and approved cost
  aggregates; Operational Economics owns planning estimates; Dispatch owns
  paired comparisons and planning decisions.
- **Documents:** Load and Execution retain their domain-specific document
  references and evidence. The catalog does not add a generic TMS document
  management service.
- **Routing and other specialist data:** route, fuel, repair, and similar
  sources are provider boundaries, not business owners. Their integration
  belongs behind adapters or connectors; their use must be approved by the
  relevant business owner.

The [company department and service ownership map](COMPANY_DEPARTMENTS_AND_SERVICES.md)
assigns proposed departmental accountability. The [TMS service interaction
map](trucking/SERVICE_INTERACTION_MAP.md) defines current TMS service
responsibilities and handoffs.

## First-phase simulators and fakers

Use test-only simulators to exercise external conditions without pretending
that adjacent company systems have been implemented. Simulators should use
the same versioned interface, protocol, and validation path intended for a
real provider. They should return deterministic, synthetic data and support
scenarios such as stale or missing facts, malformed responses, duplicate or
out-of-order messages, provider timeouts, outages, and corrections.

The preferred test arrangement is:

1. Run the real TMS service code whose behavior is under test.
2. Replace only external systems/providers with a simulator behind the
   corresponding adapter or connector.
3. Keep simulation mode, credentials, datasets, and network access isolated
   from production. Never silently substitute fake data for missing
   production facts.
4. Treat a fixture as test evidence only; it does not verify that a provider,
   source, or real-world policy is valid.

A small test-only **Scenario Simulator** may coordinate synthetic scenarios
across provider fakes. It is test tooling, not a production business
microservice or an authoritative data source. Avoid cloning the business
logic of the TMS in fake services: the simulator should produce source-shaped
inputs and observable failures, while the actual TMS service performs the
behavior being tested.

## Platform tools are not business microservices

The following tools support the target architecture. Their products may be
self-hosted in the same application environment, run on dedicated
infrastructure, or consumed as managed offerings. None owns business state.

| Platform tool or component | Technical role                                                                     | Business boundary                                                                                                         |
| -------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| PostgreSQL                 | Persistence engine; each selected domain service owns its database and migrations. | The database engine is not an owner; the service owning the data defines its meaning and access.                          |
| RabbitMQ                   | Durable transport for owner-published commands and facts.                          | It delivers messages but does not own, validate, or decide their business effect.                                         |
| Temporal                   | Durable coordination and progress for long-running cross-service workflows.        | It records workflow progress, not the authoritative business state or owner transition.                                   |
| NATS                       | Secondary realtime fan-out.                                                        | It does not replace durable owner facts, messaging recovery, or workflow state.                                           |
| Observability stack        | Logs, metrics, and traces for operating and diagnosing the application.            | It supports service operators; telemetry is not a business record or source of truth.                                     |
| API Gateway                | Client-facing routing and transport edge.                                          | It is an application infrastructure component, not a business-domain microservice or substitute for domain authorization. |

They are listed in deployment and technical architecture documentation
because they are runtime dependencies that must be provisioned, secured,
monitored, and recovered. This does not make them part of the business
microservice catalog or require one dedicated server per tool. See the
[system blueprint](trucking/TMS_SYSTEM_BLUEPRINT.md) for the selected target
roles and the [local development guide](../infra/README.md) for the current
environment.

## Adapter and connector architecture

Use an **adapter** when one internal service is the only client of a
particular external application. Keep that adapter close to its consuming
service initially; split its runtime only if credential isolation, scaling,
availability, or release cadence justifies it.

Use a **connector** when multiple internal clients consume the same external
application or protocol and can safely share its authentication and transport
integration. Keep client authorization, data scope, and owner-specific
mapping explicit. A connector may fan out validated provider observations,
but each business owner decides which facts it accepts and publishes its own
versioned contract. Do not use a connector to centralize unrelated business
logic or create a shared database.

```text
One consumer:
  External application <-> Adapter <-> Owning business service

Several consumers:
  External application <-> Connector <-> Owner-specific contracts
                                         |-> Service A owns its facts
                                         |-> Service B owns its facts

Development:
  Provider simulator <-> Same adapter/connector contract <-> Real TMS service
```

Adapters and connectors must validate data, protect credentials, apply
bounded deadlines and operation-safe retries, preserve source provenance,
and expose observable failure. They must not convert missing, stale, or
invalid provider data into success-shaped business facts. Do not route
service-to-service business traffic through an external-provider connector
when the owner-to-owner contract is the correct boundary.

## Independent deployment and server migration

Treat deployment location as independent from logical ownership. A service
can run on the same host or cluster as other services at first while
remaining independently buildable, configurable, deployable, and restartable.
Do not require a separate physical server solely to call a component a
microservice.

Keep the following properties from the initial implementation:

- Build a versioned artifact for each selected service; externalize
  environment configuration and secrets.
- Give each service a stable logical endpoint or service identity. Consumers
  use that identity rather than a machine address.
- Keep each service's database private to that service. Other services
  communicate through the owner's versioned HTTP or message contracts.
- Make accepted writes durable and retry-safe with owner outbox, consumer
  inbox/idempotency, bounded retries, and reconciliation. Maintain one
  authoritative writer for business state.
- Keep API and message contracts backward-compatible within a version and
  use expand/contract database changes. Test readiness, shutdown, restart,
  and dependency failure for each service.
- Apply finite network deadlines and isolate optional provider failures.
  Dependent work must remain explicitly pending, held, or stale when its
  required authority is unavailable; unrelated services should remain
  usable.

For a server move, first deploy the same artifact at the new location and
route it through the stable service identity. The service may continue using
its existing private database during this step. If its database also moves,
perform a separate tested backup/replication cutover, fence the former writer,
verify consistency and recovery, and keep a rollback path. Drain or recover
in-flight messages and workflows using their durable identifiers before
retiring the old runtime. Do not run two active writers or change message
ownership during a host migration.

These practices support controlled relocation; they do not by themselves
guarantee zero downtime. Availability targets, migration windows, and
recovery evidence must be defined and tested for each service.

## Contract and change ownership

For every real or simulated integration, record the business owner,
technical operator, source of each fact, consumers, data scope, identifiers
and revisions, freshness and validity, units and time-zone meaning,
provenance, failure/retry behavior, and expected format. Use service-owned
OpenAPI specifications for HTTP and AsyncAPI specifications for durable
commands and facts; version other approved formats such as files explicitly.

Update this catalog and all affected source-owner, consumer, and
service-contract documents in the same change when a service, adapter,
connector, source, consumer, ownership assignment, or integration boundary
changes. Open questions remain open until resolved in their owning
specification or decision record.
