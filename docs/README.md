# TMS documentation

Use this page to find the current project guidance. The documents distinguish
the target TMS model from software already present in this repository.

## Reading paths

- **New to the project:** [project overview](../README.md), then the
  [responsibility map](trucking/TMS_SCOPE.md) and
  [operating model](trucking/OPERATING_MODEL.md).
- **TMS business definition:** [responsibility map](trucking/TMS_SCOPE.md),
  [operating model](trucking/OPERATING_MODEL.md), and
  [roles and authority](trucking/RESPONSIBILITIES.md).
- **TMS technical design:** [system blueprint](trucking/TMS_SYSTEM_BLUEPRINT.md),
  [service interaction map](trucking/SERVICE_INTERACTION_MAP.md),
  [visual map catalog](maps/README.md),
  [technical workflow](trucking/TECHNICAL_WORKFLOW.md), and
  [service contracts](contracts.md), with the
  [canonical API/message specifications](api/README.md) as their machine-readable
  counterparts. The [API edge options](api/API_EDGE_OPTIONS.md) records the
  future GraphQL/Federation discussion without approving it. The
  [TMS ecosystem map](maps/scope/tms-ecosystem-boundary.svg) shows the
  currently defined system boundary and adjacent responsibilities.
- **Decision status:** [decision log](trucking/DECISIONS.md) and
  [open decisions](trucking/OPEN_QUESTIONS.md).
- **Implementation readiness:** [capability gate matrix](trucking/IMPLEMENTATION_READINESS.md)
  maps agreed prerequisites to the increments they govern; open decisions
  remain scoped to their dependent capabilities.
- **Implementation work:** [monorepo guide](monorepo.md),
  [HTTP service baseline](SERVICE_CONTRACT.md), and the
  [local development guide](../infra/README.md).
- **Planning:** [selected first business increment](trucking/FIRST_SLICE_CANDIDATE.md)
  (Load booking and outcome reads). The separately approved
  [platform-foundation phase](trucking/TMS_SYSTEM_BLUEPRINT.md#approved-platform-foundation-increment)
  may proceed without authorizing business workflows.

## TMS documentation sequence

These documents describe this TMS only. Do not add unrelated product
categories or assume integrations with other business systems. Add a focused
document only when it resolves a real TMS requirement.

1. **Product intent and TMS duty:** define the intended operating problem,
   product outcomes, and which responsibilities belong inside this TMS. The
   [responsibility map](trucking/TMS_SCOPE.md) is a gap inventory, not an
   approved exhaustive scope.
2. **Business and domain model:** settle the end-to-end TMS workflows,
   concepts, lifecycles, authoritative ownership, and relationships. The
   [operating model](trucking/OPERATING_MODEL.md) is an initial baseline;
   multiple lifecycle and relationship areas remain open.
3. **System and infrastructure architecture:** define TMS service
   boundaries, responsibility ownership, data authority, infrastructure
   shape, and how the boundaries relate before selecting detailed technical
   implementations.
4. **Internal contracts:** specify commands, facts, state transitions,
   failure handling, security context, and recovery across TMS boundaries.
   The [technical workflow](trucking/TECHNICAL_WORKFLOW.md) and
   [service-contract guide](contracts.md) establish principles, not complete
   contracts.
5. **Detailed responsibility and access design:** after business ownership,
   relationships, and contracts are stable, define role-specific procedures,
   authority, exception coverage, and resource-level permissions. The
   [role guide](trucking/RESPONSIBILITIES.md) is only a high-level baseline.
6. **Target operational scope and verification:** define the coherent
   intended TMS capability, measurable outcomes, explicit exclusions,
   acceptance scenarios, and operational requirements. This target is not a
   requirement to implement all capabilities in one delivery, nor a narrow
   showcase scope selected to impress customers. The term _MVP_ must not be
   used to imply either.
7. **Implementation readiness:** before starting a domain-owned business
   workflow, approve and reconcile the documentation required for that
   capability and its shared dependencies. The platform-foundation phase is
   separately approved and may proceed while business-specific gates remain
   open. Each later capability must meet the relevant scope, contract,
   authorization, schema, policy, and recovery gates listed in the
   open-decision register. Increments are selected by
   technical importance to the coherent system, including architectural risk
   and learning, dependency order, system integrity, and end-to-end
   verifiability. A vertical slice validates part of the target; it does not
   substitute for defining that target.

Do not implement TMS services, APIs, schemas, or infrastructure as a way to
decide product scope. Engineering guides describe the repository and current
implementation; they must not silently become TMS requirements.

## Documents still needed for an implementation-ready baseline

- **Remaining target acceptance:** the product-wide reliability and
  auditability baseline and platform-foundation acceptance criteria are
  approved. Maximum scope remains intentionally undefined; each business
  capability must close its own measurable acceptance gates as listed in the
  [readiness matrix](trucking/IMPLEMENTATION_READINESS.md).
- **Remaining domain model:** the end-to-end ownership baseline exists, but
  uncovered lifecycle, relationship, and handoff details remain in the
  [open-decision register](trucking/OPEN_QUESTIONS.md).
- **Canonical service contracts:** the shared guide contains substantial
  semantic contracts. Partial service-owned OpenAPI and AsyncAPI
  specifications are listed in the [API index](api/README.md); remaining
  route, message, and operation-specific gaps must be closed before
  implementing their respective business APIs and message flows.
- **Detailed identity and authorization:** principal and authentication
  baselines are recorded; resource-level permission matrices, delegation,
  coverage, and remaining operational controls gate the protected services
  that depend on them, not the platform-foundation phase.
- **Domain-specific acceptance and operations:** foundation acceptance is
  defined; workflow acceptance, recovery, security, and operational criteria
  remain capability-specific gates before implementing or productionizing
  those workflows.

The responsibility map and open-decision register identify gaps, but do not
replace these approved specifications.

## Keep business and technical documentation separate

- **Business documents** define why the TMS exists, what work it owns, the
  business concepts and their relationships, lifecycle meaning, and
  high-level accountability. They must not prescribe APIs, databases,
  message brokers, or deployment topology.
- **Technical documents** define how the approved TMS model is divided into
  system boundaries, how each boundary owns data and transitions, and how
  boundaries communicate, handle failures, protect access, and operate. They
  must not invent business policy to fit an implementation.
- **Role documents** may state high-level responsibility and authority as
  business rules. Detailed permission checks, service enforcement, and
  role-specific technical procedures belong in technical design only after
  the relevant business boundaries and contracts are settled.
- **Engineering guides** explain repository conventions and the current
  local environment. They do not define TMS product scope.

Give each decision one owning document. Link to it elsewhere rather than
copying it. Mark statements as agreed, proposed, open, implemented, or
verified so product intent cannot be mistaken for running software.

## Document ownership and authority

| Document                                                         | Owns                                                                                       |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| [TMS responsibility map](trucking/TMS_SCOPE.md)                  | TMS duties already represented and material coverage gaps                                  |
| [Operating model](trucking/OPERATING_MODEL.md)                   | Agreed business workflow and operating principles                                          |
| [Roles and authority](trucking/RESPONSIBILITIES.md)              | High-level business roles and responsibility boundaries                                    |
| [System blueprint](trucking/TMS_SYSTEM_BLUEPRINT.md)             | TMS system boundaries, technical principles, and implementation-readiness gate             |
| [Service interaction map](trucking/SERVICE_INTERACTION_MAP.md)   | What each service owns, how one Load crosses service boundaries, and dependency order      |
| [TMS map catalog](maps/README.md)                                | Standalone architecture, lifecycle, cancellation, and planning diagrams grouped by concern |
| [Technical workflow](trucking/TECHNICAL_WORKFLOW.md)             | Cross-boundary ownership and technical invariants                                          |
| [Implementation readiness](trucking/IMPLEMENTATION_READINESS.md) | Capability-specific prerequisites and their implementation scope                           |
| [Service contracts](contracts.md)                                | Internal TMS contract principles and unresolved contract requirements                      |
| [API specifications](api/README.md)                              | Canonical service-owned OpenAPI and AsyncAPI artifacts                                     |
| OpenAPI documents under `docs/api/`                              | Canonical HTTP schemas, one document per API-owning service                                |
| AsyncAPI documents under `docs/api/`                             | Canonical versioned command and fact schemas, owned per service                            |
| [Decision log](trucking/DECISIONS.md)                            | Accepted TMS product and architecture decisions                                            |
| [Open decisions](trucking/OPEN_QUESTIONS.md)                     | Unresolved TMS requirements and design choices                                             |
| [First business increment](trucking/FIRST_SLICE_CANDIDATE.md)    | Selected Load booking/read scope, acceptance, and remaining implementation gates           |
| Engineering guides                                               | Repository conventions and current local operation                                         |

The blueprint is authoritative for approved system architecture and target
scope. The decision log records the accepted baseline and why it was chosen;
the blueprint summarizes the current target. Each focused document owns the
subject in its row and must not introduce a conflicting decision. The
open-decision register is authoritative only for what remains unresolved; it
does not approve an answer. The root README is the entry point and current
implementation summary, not a second business specification.

## Status vocabulary

- **Agreed** — accepted as part of the owner-led product model or target
  architecture.
- **Proposed** — a candidate answer that has not been accepted.
- **Open** — no answer has been selected; do not implement an assumption.
- **Implemented** — present in the repository. This alone does not mean it
  matches the target.
- **Verified** — tested against a stated behavior; record the command and
  scope when that evidence matters.

Owner decisions define product direction. Record the evidence behind
operational, customer, regulatory, and legal claims; require authoritative
sources and qualified review before treating legal or regulatory claims as
executable policy.

## Editorial standard

Write project documentation in clear, formal, professional English. When
notes, discussion, or stakeholder input are informal or written by a
non-native speaker, edit the prose for grammar, precision, and consistent
terminology while preserving the author's intended meaning. Do not let
polishing change a proposal into an agreed decision, or remove uncertainty
that matters to the design.

## Keeping documentation current

- Put a decision in one owning document and link to it instead of repeating
  its full explanation elsewhere.
- Preserve accepted decisions and the rationale needed to understand them.
  Before shortening or removing detailed material, confirm that each
  significant accepted decision remains documented in its owning page or a
  decision record; do not infer that detail is obsolete merely because it is
  lengthy.
- Keep accepted-decision history separate from unresolved questions. Use a
  short architecture decision record when a decision needs its own context,
  alternatives, and consequences.
- Update the implementation summary when repository capabilities change.
  Avoid dated snapshots that quickly become stale.
- Keep proposals and unresolved work explicitly labeled in the decision
  register. Move an accepted decision to its owning page and remove it from
  the register.
- Link implementation conventions to their source guides; do not present a
  target boundary as an implemented service.
- Update affected documentation in the same change as the behavior or
  architecture it describes.
