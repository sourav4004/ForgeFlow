# ADR-0003: DAG Workflows and Immutable Versions

## Status

ACCEPTED

## Context

Workflow orchestration platforms face two major architectural hazards:

1. **Unconstrained Execution Graphs**: Allowing users to construct arbitrary graphs with unmonitored cycles or backward loops frequently leads to infinite execution loops, runaway LLM inference costs, and deadlocked worker threads.
2. **Mutable Workflow Execution**: If executions bind directly to an editable workflow draft, modifying the canvas while an execution is running corrupts active node evaluations. Furthermore, historical execution records become impossible to audit or visually reconstruct once a user edits or deletes nodes in the draft.

## Decision

We have decided to enforce **Strict Directed Acyclic Graph (DAG) Validation** and **Immutable Workflow Versioning**:

### 1. Directed Acyclic Graph (DAG) Constraint

- V1 workflows must be strict DAGs with a single logical entrypoint (`INPUT` node) and deterministic downstream paths terminating in `OUTPUT` nodes.
- Graph validation occurs at design time using Kahn's topological sorting algorithm. Graphs containing cycles, self-referential edges, or orphan (unreachable) nodes are rejected with actionable compiler-style diagnostics.
- _Conditional Traversal_: Topological sorting establishes valid dependency order, but does not dictate unconditional execution of every node. `CONDITION` nodes dynamically evaluate branch criteria; unselected branches transition to `SKIPPED`. Downstream nodes that depend exclusively on skipped nodes are skipped accordingly.
- _Converging Branch Joins_: When multiple branches converge, the engine will support join semantics (open design decision: evaluating `AND` joins vs. `ANY` active joins).

### 2. Immutable Workflow Versioning

- Users author and modify workflows within a mutable `DRAFT` state.
- Upon passing graph validation, publishing freezes the DAG into an immutable `WorkflowVersion` entity with an incremental version tag (`v1`, `v2`).
- Once published, a `WorkflowVersion` row is read-only and cannot be altered or overwritten.
- All executions strictly bind to a specific `WorkflowVersion` ID, ensuring that the exact graph structure that ran is permanently preserved.

### 3. Reproducibility Boundaries

- **What Is Guaranteed**: Structural reproducibility of the workflow definition (the exact nodes, edge topology, prompt templates, tool arguments, and schemas at execution time).
- **What Is NOT Guaranteed**: Immutable graph definitions do not guarantee identical LLM generation text (due to stochastic temperature and upstream provider updates), identical external API responses, or identical third-party side effects.

## Alternatives Considered

- **Mutable Executable Workflows**: Executing directly against the active draft record in PostgreSQL. Rejected because concurrent edits corrupt in-flight worker executions, and inspecting past execution history against a modified canvas displays incorrect, orphaned, or missing nodes.
- **Arbitrary Cyclic Workflows in V1**: Allowing unrestricted backward edges and while-loops. Rejected for V1 because unconstrained agent cycles risk infinite loops, massive token bills, and complex deadlock states. Where multi-turn reasoning is required, it will be encapsulated inside a dedicated, bounded `AGENT` node powered by LangGraph in Phase 4.
- **Hard-Coded Code Pipelines**: Defining workflows as rigid TypeScript code scripts. Rejected because it eliminates the visual canvas, requires code redeployments for prompt tweaks, and prevents non-developer stakeholders from inspecting workflow logic.

## Consequences

### Positive

- **Guaranteed Termination**: Acyclic graphs with finite node retry limits guarantee that workflows eventually terminate in a terminal state (`COMPLETED`, `FAILED`, `CANCELLED`).
- **Audit & Compliance**: Historical runs can always be rendered on the visual canvas exactly as they were configured when triggered.
- **Safe Iteration**: Developers can experiment with drafts and test validations without breaking active production automations running on published versions.

### Trade-offs & Costs

- Requires building a dedicated graph validation service (cycle detection, port type checking, orphan detection).
- Additional database storage for version snapshots and node configurations.
- Complex state tracking required for conditional branch skipping and converging join nodes.

## Implementation Status

- **Architecture Approved**: Graph validation rules, node types, and data entities are defined in `PRD.md` and `ARCHITECTURE.md`.
- **Implementation Planned**: Graph validation algorithms and immutable versioning tables are scheduled for Phase 2 (`packages/workflow-core` and `packages/database`).

## Related Documents

- [Product Requirements Document (PRD.md)](../../PRD.md)
- [System Architecture Document (ARCHITECTURE.md)](../../ARCHITECTURE.md)
- [ADR-0002: Asynchronous API and Worker Separation](./0002-asynchronous-api-worker-separation.md)
- [ADR-0004: At-Least-Once Processing and Reliability](./0004-at-least-once-processing-and-reliability.md)
