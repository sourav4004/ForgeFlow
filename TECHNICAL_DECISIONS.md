# FlowForge AI — Technical Decision Register

**Document Version**: 1.0.0  
**Status**: APPROVED BASELINE  
**Milestone**: 1F-B1

---

## 1. Purpose

The Technical Decision Register serves as the central index and governance record for architectural and engineering choices made across the FlowForge AI platform.

Its primary objectives are:

1. **Clarity**: Document what technologies, architectures, and design patterns were selected and why.
2. **Context**: Explain the engineering trade-offs and alternatives evaluated.
3. **Traceability**: Clearly distinguish between choices that are **implemented and verified** versus choices that are **approved for future milestones**.
4. **Governance**: Provide a structured change-control process for modifying accepted technical decisions as the codebase evolves.

---

## 2. Decision Status Definitions

Every architectural and technology decision is classified under one of four statuses:

- **ACCEPTED**: The technical decision or architecture strategy is formally approved for the platform. _(Note: An ACCEPTED status indicates architectural consensus; it does not imply that the feature or infrastructure is already implemented in code)._
- **PROPOSED**: A candidate design or technology choice currently under evaluation, awaiting benchmarking or formal sign-off.
- **DEFERRED**: A technical choice intentionally postponed until a subsequent project milestone (e.g., exact cloud hosting provider, production performance thresholds).
- **SUPERSEDED**: A previously accepted decision that has been formally replaced by a newer Architecture Decision Record (ADR).

---

## 3. Technology Decision Register

The following register details the technology choices approved for FlowForge AI, their scope, architectural role, and actual implementation status in the codebase:

| Technology                       | Category            | Role in FlowForge AI                                                                   | Verified Status / Version                                          | Architecture Status                   |
| -------------------------------- | ------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------- |
| **TypeScript**                   | Language            | Unified strict language across all frontend, backend, worker, and contract packages.   | Installed: `6.0.3` (Monorepo root, extending `tsconfig.base.json`) | **ACCEPTED** (Implemented)            |
| **Node.js LTS**                  | Runtime             | Server execution environment for API, worker, and build tooling.                       | Runtime: `v26.12.1` LTS (pinned via `.nvmrc` and `engines`)        | **ACCEPTED** (Implemented)            |
| **pnpm**                         | Package Manager     | Fast, deterministic workspace dependency management with strict isolation.             | Installed: `12.16.1` (pinned via `packageManager` and lockfile)    | **ACCEPTED** (Implemented)            |
| **Turborepo**                    | Monorepo Tooling    | High-performance task orchestration, caching, and upstream build dependency pipeline.  | Installed: `2.11.10` (`turbo.json`)                                | **ACCEPTED** (Implemented)            |
| **Next.js**                      | Frontend Framework  | React App Router frontend delivering the workflow editor canvas and dashboard.         | Installed: `16.4.5` (`apps/web`)                                   | **ACCEPTED** (Foundation Implemented) |
| **React**                        | UI Library          | Component hierarchy and interactive canvas rendering.                                  | Installed: `19.3.1` (`apps/web`)                                   | **ACCEPTED** (Foundation Implemented) |
| **React Flow**                   | UI Canvas           | Node-based visual graph builder for workflow authoring.                                | Planned for Phase 3 (`@xyflow/react`)                              | **ACCEPTED** (Planned)                |
| **NestJS**                       | Backend Framework   | Structured, modular API gateway enforcing validation, route prefixes, and DI.          | Installed: `12.3.2` (`apps/api`)                                   | **ACCEPTED** (Foundation Implemented) |
| **PostgreSQL**                   | Relational Database | System of record for users, workspaces, workflows, immutable versions, and executions. | Candidate: `16.x` (Prisma ORM target in Phase 2)                   | **ACCEPTED** (Planned)                |
| **Prisma**                       | ORM                 | Type-safe database client, schema definitions, and automated SQL migrations.           | Planned for Phase 2                                                | **ACCEPTED** (Planned)                |
| **Redis**                        | In-Memory Store     | Backing store for BullMQ distributed job queues and ephemeral SSE Pub/Sub.             | Candidate: `7.x` (Target in Phase 2)                               | **ACCEPTED** (Planned)                |
| **BullMQ**                       | Distributed Queue   | Persistent, at-least-once asynchronous task queue for worker dispatch and retries.     | Planned for Phase 2                                                | **ACCEPTED** (Planned)                |
| **LangGraph**                    | AI Orchestration    | Stateful multi-turn agent coordination where cyclic reasoning loops are required.      | Planned for Phase 4                                                | **ACCEPTED** (Planned)                |
| **Model Context Protocol (MCP)** | Tool Integration    | Official TypeScript SDK v2 for standard, sandboxed external tool execution.            | Planned for Phase 3 (`@modelcontextprotocol/sdk`)                  | **ACCEPTED** (Planned)                |
| **Zod**                          | Validation          | Runtime schema validation for API payloads, LLM structured outputs, and tool schemas.  | Planned for Phase 2                                                | **ACCEPTED** (Planned)                |
| **REST**                         | API Protocol        | Stateless HTTP interface for CRUD, validation, and workflow execution dispatch.        | Implemented: `GET /api/v1/health` in `apps/api`                    | **ACCEPTED** (Foundation Implemented) |
| **Server-Sent Events (SSE)**     | Live Streaming      | Unidirectional real-time event streaming from NestJS API to frontend canvas.           | Planned for Phase 2                                                | **ACCEPTED** (Planned)                |
| **Vitest**                       | Testing Framework   | High-performance ESM test runner for unit, integration, and process smoke testing.     | Installed: `5.1.0` (`apps/api`, `apps/worker`)                     | **ACCEPTED** (Implemented)            |
| **Docker**                       | Containerization    | Multi-stage container images for local Docker Compose and production deployment.       | Planned for Phase 4                                                | **ACCEPTED** (Planned)                |
| **GitHub Actions**               | CI/CD               | Automated lint, format, typecheck, and test validation on pull requests.               | Planned for Phase 4                                                | **ACCEPTED** (Planned)                |

---

## 4. Architecture Decision Index

The platform maintains standalone Architecture Decision Records under [`docs/adr/`](file:///c:/Users/100ra/OneDrive/Desktop/FlowForge/docs/adr) to capture the context, trade-offs, and consequences of critical engineering designs:

| ADR ID       | Title                                    | Status       | Brief Rationale                                                                                                                                          | Link                                                                    | Implementation State                        |
| ------------ | ---------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------- |
| **ADR-0001** | Monorepo and Application Boundaries      | **ACCEPTED** | Enforces TypeScript monorepo with pnpm workspaces, Turborepo upstream pipeline, and strict public package boundaries (`@flowforge/contracts`).           | [ADR-0001](./docs/adr/0001-monorepo-and-application-boundaries.md)      | **Implemented & Verified**                  |
| **ADR-0002** | Asynchronous API and Worker Separation   | **ACCEPTED** | Decouples HTTP request handling from long-running execution; API enqueues to Redis/BullMQ, independent worker processes execute tasks.                   | [ADR-0002](./docs/adr/0002-asynchronous-api-worker-separation.md)       | **Foundation Implemented** (Queue Planned)  |
| **ADR-0003** | DAG Workflows and Immutable Versions     | **ACCEPTED** | Models workflows as acyclic graphs (DAGs) rejected at design time if cyclic; published workflows snapshot into immutable versions for auditability.      | [ADR-0003](./docs/adr/0003-dag-workflows-and-immutable-versions.md)     | **Approved Architecture** (Planned Phase 2) |
| **ADR-0004** | At-Least-Once Processing and Reliability | **ACCEPTED** | Designs for at-least-once queue delivery, idempotent node retries, and transactional outbox. Rejects false claims of exactly-once external side effects. | [ADR-0004](./docs/adr/0004-at-least-once-processing-and-reliability.md) | **Approved Architecture** (Planned Phase 2) |

---

## 5. Open Technical Decisions

The following architectural choices are explicitly marked as **OPEN** and await benchmarking, experimental spikes, or infrastructure selection during subsequent phases:

1. **Exact PostgreSQL & Redis Release Versions**:
   - _Status_: **OPEN PROPOSAL** (PostgreSQL 16.x / Redis 7.x proposed as baseline candidates).
   - _Resolution Strategy_: Specific minor release tags and container base images will be validated during Phase 2 setup.
2. **Conditional DAG Branch Join Semantics**:
   - _Status_: **OPEN DECISION** (Wait-all-active proposed default).
   - _Resolution Strategy_: Determine whether a converging node requires all incoming edges to complete (`AND` join) or triggers on the first active edge (`ANY` join). To be prototyped in `packages/workflow-core`.
3. **External Side-Effect Deduplication & Reconciliation**:
   - _Status_: **OPEN DECISION**.
   - _Resolution Strategy_: Because third-party APIs (e.g. GitHub comments) may lack native idempotency keys, evaluate capturing and persisting external response IDs to detect duplicate dispatches during worker retries.
4. **Credential Encryption Key Management**:
   - _Status_: **OPEN PROPOSAL** (AES-256-GCM with environment master key proposed for V1).
   - _Resolution Strategy_: Evaluate transition path to KMS (AWS KMS or HashiCorp Vault) for production deployments.
5. **Production Cloud Hosting Provider**:
   - _Status_: **DEFERRED** (Railway vs. AWS ECS vs. DigitalOcean App Platform).
   - _Resolution Strategy_: Multi-stage container builds will ensure vendor neutrality. Hosting provider selection will be finalized based on operational cost during Milestone 4.
6. **Execution History Purge & Retention Policy**:
   - _Status_: **OPEN PROPOSAL** (30-day default retention).
   - _Resolution Strategy_: Define whether older executions are soft-deleted, exported to cold S3 storage, or permanently pruned via scheduled background cron jobs.

---

## 6. Change-Control Process

To preserve architecture integrity, technical decisions recorded in this register or in `docs/adr/` must follow a disciplined, lightweight change process:

```text
1. Problem Identification
   └── Identify the concrete technical limitation, scalability bottleneck, or requirement gap.

2. Alternative Comparison
   └── Formulate at least two alternative approaches, evaluating engineering complexity,
       performance impact, and compatibility with the monorepo boundary model.

3. Developer Consensus
   └── Obtain explicit approval from the lead developer before committing to new dependencies
       or structural changes.

4. ADR & Documentation Update
   └── Create a new ADR (or mark an existing ADR as SUPERSEDED) and update
       TECHNICAL_DECISIONS.md, PRD.md, and ARCHITECTURE.md accordingly.
```

---

_End of Technical Decision Register._
