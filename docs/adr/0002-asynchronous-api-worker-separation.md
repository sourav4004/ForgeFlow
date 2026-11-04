# ADR-0002: Asynchronous API and Worker Separation

## Status

ACCEPTED

## Context

FlowForge AI workflows execute complex, multi-stage Directed Acyclic Graphs that incorporate:

- Large Language Model (LLM) inference calls taking between 5 and 60 seconds.
- External tool calls (e.g. GitHub git diff retrieval, external REST APIs) subject to network latency and third-party rate limits.
- Human-in-the-loop approval gates that may remain suspended for hours or days awaiting developer sign-off.

Attempting to execute such workflows synchronously within HTTP request-response cycles causes immediate HTTP gateway timeouts (typically 30–60s), exhausts API web server thread/event pools, and causes total loss of in-flight executions whenever the API server restarts during deployments.

## Decision

We have decided to **strictly decouple HTTP request handling from workflow execution** by splitting the backend into two distinct runtimes communicating via a distributed queue:

1. **Stateless API Gateway (`apps/api`)**:
   - Built with NestJS.
   - Handles client authentication, workspace authorization, CRUD operations on workflows, and DAG validation.
   - Dispatches executions asynchronously: validates execution inputs, persists an `Execution` record (`status: PENDING`) in PostgreSQL, enqueues an execution job to BullMQ, and immediately returns `HTTP 202 Accepted` with the execution ID.
   - Provides Server-Sent Events (SSE) endpoints streaming live progress updates to connected clients.
2. **Distributed Queue Engine (Redis + BullMQ)**:
   - Redis provides low-latency, persistent queue storage.
   - BullMQ manages job distribution, worker concurrency, heartbeats/locks, exponential backoff retries, and dead-letter queueing.
3. **Dedicated Background Execution Worker (`apps/worker`)**:
   - Built as an independent, standalone Node.js process.
   - Pulls jobs from BullMQ, traverses DAG nodes in topological order, coordinates LangGraph and LLM invocations, dispatches MCP tool calls, records intermediate node outputs in PostgreSQL, and publishes execution events.

## Alternatives Considered

- **Synchronous In-Process Execution**: Executing the entire DAG synchronously inside the NestJS controller handling `POST /api/v1/workflows/:id/execute`. Rejected immediately: HTTP requests would time out, client connections would break, and long-running LLM calls would saturate event loop threads.
- **In-Memory Asynchronous Job Queue**: Using Node.js `EventEmitter` or in-memory arrays within `apps/api`. Rejected because in-memory queues are ephemeral: any deployment, pod restart, or unhandled crash permanently destroys all queued and executing workflows.
- **Heavyweight External Workflow Engines (Temporal, Camunda, Apache Airflow)**: Offloading orchestration to third-party distributed workflow platforms. Rejected for V1: introduces massive operational overhead (additional server clusters, non-TypeScript orchestrators, complex DSLs), exceeds our initial deployment constraints, and obscures the portfolio objective of demonstrating core distributed systems and queue management skills.

## Consequences

### Positive

- **High API Availability**: The API remains ultra-responsive, returning immediate acknowledgments for workflow triggers.
- **Independent Elastic Scaling**: API instances (I/O bound) and worker instances (CPU and network bound) can be scaled independently based on workload demand.
- **Resilience to Deployments**: Deploying a new API version does not disrupt active worker executions; workers continue processing jobs from the persistent queue.
- **Human Approval Tolerance**: Workflows can pause indefinitely at approval gates without holding open network sockets.

### Trade-offs & Costs

- Requires managing Redis infrastructure alongside PostgreSQL.
- Requires building an event-driven notification bridge (Redis Pub/Sub $\rightarrow$ SSE) so the frontend canvas can observe live execution progress without polling.
- Introduces distributed failure boundaries that require idempotent worker execution and retry recovery logic.

## Implementation Status

- **Foundation Implemented**: `@flowforge/api` (NestJS) and `@flowforge/worker` (standalone Node.js process) are scaffolded and verified with independent build, lint, and test suites (Milestones 1C through 1E-C).
- **Queue Integration Planned**: Redis setup, BullMQ queue definitions, worker consumers, and SSE event streaming are scheduled for implementation in Phase 2.

## Related Documents

- [Product Requirements Document (PRD.md)](../../PRD.md)
- [System Architecture Document (ARCHITECTURE.md)](../../ARCHITECTURE.md)
- [ADR-0001: Monorepo and Application Boundaries](./0001-monorepo-and-application-boundaries.md)
- [ADR-0004: At-Least-Once Processing and Reliability](./0004-at-least-once-processing-and-reliability.md)
