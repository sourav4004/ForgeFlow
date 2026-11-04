# ADR-0004: At-Least-Once Processing and Reliability

## Status

ACCEPTED

## Context

Distributed AI workflow execution faces continuous failure modes:

1. Worker instances can crash, reboot, or run out of memory during long-running tasks.
2. Network calls to LLM providers or external APIs can time out, drop packets, or return HTTP 429 rate limits.
3. Dual-write hazards: attempting to update a relational database and publish an event to a message broker in an uncoordinated manner leads to inconsistent system state when one operation succeeds and the other fails.
4. External mutations (e.g. creating a GitHub issue, posting a PR comment) execute outside the database boundary and cannot be rolled back via SQL `ROLLBACK`.

We must establish a realistic, robust reliability model that handles infrastructure crashes and network failures without corrupting execution states or making mathematically impossible claims.

## Decision

We have adopted an **At-Least-Once Queue Processing Model** coupled with **Idempotent State Checkpoints** and a **Transactional Outbox**:

### 1. At-Least-Once Delivery

- BullMQ on Redis provides at-least-once job delivery.
- If a worker crashes while processing a workflow, BullMQ's lock visibility timeout expires, and the job is automatically re-delivered to another active worker.

### 2. Idempotent Node Checkpoints

- The worker commits node execution results (`NodeExecution`) to PostgreSQL immediately upon completion of each node.
- Each node execution attempt is indexed by a deterministic idempotency key (`executionId:nodeId:attempt`).
- When a worker picks up a re-delivered execution job, it inspects existing `NodeExecution` rows in PostgreSQL, skips already-completed upstream nodes, and resumes execution from the first uncompleted or failed node.

### 3. Transactional Outbox for Event Publishing

- To eliminate dual-write inconsistencies between PostgreSQL and Redis:
  - State changes and an `OutboxEvent` record are committed within a single atomic PostgreSQL transaction.
  - A lightweight publisher process reads committed `OutboxEvent` records and dispatches them to Redis Pub/Sub for real-time SSE streaming.
  - Redis Pub/Sub acts as an ephemeral, fire-and-forget transport. Clients that disconnect can recover missed events directly from PostgreSQL via `GET /api/v1/executions/:id/events?since=<timestamp>`.

### 4. Retry Classification

- **Transient Failures** (HTTP 429, HTTP 503, connection resets): Retried automatically using exponential backoff with jitter up to the node's configured retry limit.
- **Terminal Failures** (Schema validation errors, HTTP 401/403, malformed JSON): Mark the node as `FAILED` immediately without retry.

### 5. Reality of External Side Effects (No False "Exactly-Once" Promises)

- **The Physical Reality**: Exactly-once execution across distributed systems with external third-party side effects is impossible without remote idempotency support (the Two Generals Problem).
- If a worker successfully posts a comment to an external API (e.g. GitHub) but crashes before writing the success record to PostgreSQL, the re-delivered job may re-execute the node and post a duplicate comment unless the external API natively supports request deduplication via idempotency keys.
- **Mitigations**:
  - We capture and persist external resource IDs immediately when returned.
  - Critical mutating operations must pass through human `APPROVAL` gates to ensure intentional execution.
  - Where third-party APIs lack idempotency keys, duplicate dispatches must be mitigated via external reconciliation or idempotent tool designs.

## Alternatives Considered

- **Claiming Exactly-Once Execution**: Promising guaranteed single execution of external actions. Rejected because network timeouts make it impossible to determine whether a non-responding external service executed the action before dropping the connection. Claiming exactly-once execution in the presence of external APIs is technically false.
- **No In-Flight Checkpoints (All-or-Nothing)**: Only writing execution state to the database when the entire workflow completes. Rejected because any failure in a 10-node workflow on node 9 would force the entire workflow to re-run from node 1, re-incurring all upstream LLM token costs and re-triggering upstream actions.
- **Dual-Write Direct to Database and Redis**: Directly writing to PostgreSQL and publishing to Redis in application code without an outbox. Rejected because network glitches between the database write and the Redis publish cause lost events that leave the UI out of sync with database state.

## Consequences

### Positive

- Resilient to worker crashes: in-flight workflows resume without re-running completed nodes.
- Consistent event delivery via the transactional outbox pattern.
- Clear operational separation between recoverable transient errors and terminal failures.
- Honest, defensible engineering architecture regarding external side-effect limitations.

### Trade-offs & Costs

- Requires database writes after every node completion, increasing PostgreSQL write I/O.
- Requires maintaining an outbox table and publisher process.
- Requires external tool developers to consider idempotency when designing MCP tools.

## Implementation Status

- **Architecture Approved**: Reliability semantics, retry policies, and outbox patterns are formalized in `PRD.md` and `ARCHITECTURE.md`.
- **Implementation Planned**: BullMQ queue worker, PostgreSQL checkpointing, and outbox publisher will be implemented in Phase 2 (`packages/database` and `apps/worker`).

## Related Documents

- [Product Requirements Document (PRD.md)](../../PRD.md)
- [System Architecture Document (ARCHITECTURE.md)](../../ARCHITECTURE.md)
- [ADR-0002: Asynchronous API and Worker Separation](./0002-asynchronous-api-worker-separation.md)
- [ADR-0003: DAG Workflows and Immutable Versions](./0003-dag-workflows-and-immutable-versions.md)
