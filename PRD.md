# FlowForge AI — Product Requirements Document (PRD)

**Document Version**: 1.0.0  
**Status**: APPROVED BASELINE  
**Milestone**: 1F-A  
**Target Milestone Implementation**: Phase 2 through Phase 4

---

## 1. Product Summary

FlowForge AI is a visual, durable AI workflow orchestration platform built for technical developers and engineering teams. It allows users to design, validate, version, execute, and monitor complex asynchronous workflows structured as Directed Acyclic Graphs (DAGs).

### 1.1 Problem Statement

Modern AI applications increasingly rely on compound AI systems rather than single prompt-response interactions. Developers attempting to orchestrate multi-step LLM operations, data transformations, conditional branching, and external tool calls typically face several failure modes:

1. **Fragile Ad-Hoc Scripts**: Lack durability, error recovery, and consistent execution tracking.
2. **Black-Box Agent Frameworks**: Suffer from uncontrolled autonomous loops, unpredictable tool execution, non-deterministic branching, and high inference costs.
3. **Lack of Human Governance**: Automated agents performing external side-effect operations (e.g., commenting on GitHub, sending notifications, executing shell commands) lack permission gates and human-in-the-loop authorization.
4. **Poor Observability**: Lack granular node-level state tracking, structured execution logs, and replayability when intermediate steps fail.

### 1.2 Core Value Proposition

FlowForge AI solves these challenges by combining:

- **Visual DAG Modeling**: Explicit, deterministic node-and-edge workflow design.
- **Durable Asynchronous Execution**: Backed by persistent job queues and independent worker runtimes with at-least-once processing guarantees and retry semantics.
- **Model Context Protocol (MCP) Integration**: Standardized, secure tool execution through the official MCP TypeScript SDK.
- **Human-in-the-Loop Safeguards**: Pausable approval gates for sensitive actions before executing external side effects.
- **Immutable Workflow Versioning**: Published workflow graphs are snapshotted immutably so that the exact structural workflow definition (nodes, edges, prompt templates, schemas) can always be retrieved and audited, even as working drafts evolve. (Note: Immutable graph definitions do not guarantee identical LLM generation results or identical external API responses).

### 1.3 Target Audience

- **Primary Persona**: Technical developers and software engineers building AI-augmented automations (e.g., automated code reviews, triage pipelines, multi-model analysis).
- **Secondary Persona**: Small engineering teams seeking controlled, observable AI automations with explicit permission boundaries.

### 1.4 Flagship Use Case: GitHub Pull Request Review Automation

1. **Trigger / Input**: Developer inputs a GitHub pull request URL or trigger payload.
2. **Data Ingestion**: Worker retrieves pull request metadata, changed files, and git diffs via MCP tool or REST API.
3. **LLM Analysis**: LLM node inspects changed files for logic errors, security regressions, test coverage gaps, and adherence to repository guidelines.
4. **Conditional Evaluation**: Condition node evaluates whether critical issues or security flags were detected.
5. **Review Synthesis**: Transform node synthesizes findings into a structured markdown review summary.
6. **Human Approval Gate**: If sensitive write operations are enabled (e.g., submitting a formal GitHub review comment or PR status check), the execution pauses and alerts the human reviewer.
7. **Action Dispatch**: Upon human authorization, the review comment is published to GitHub via the MCP GitHub server.
8. **Audit & Log**: The complete execution trajectory, token metrics, and tool payloads are persisted.

---

## 2. Product Objectives

### 2.1 Product Usability Goals

- Provide an intuitive, low-latency visual workflow canvas (React Flow) supporting drag-and-drop node placement, edge connection, and real-time graph validation.
- Deliver real-time execution monitoring via Server-Sent Events (SSE), displaying live node status transitions (`PENDING` $\rightarrow$ `RUNNING` $\rightarrow$ `COMPLETED` / `FAILED` / `WAITING_FOR_APPROVAL`).
- Eliminate unexpected agent side effects through explicit, mandatory approval prompts.

### 2.2 Engineering & Reliability Goals

- Enforce strict Directed Acyclic Graph (DAG) validation at design time: reject cycles, orphan nodes, self-references, and invalid input/output schemas before publishing.
- Ensure durable execution: worker crashes or restarts must not corrupt workflow execution state; executions must support retry policies and deterministic resumption.
- Maintain framework-independent domain logic and contracts, ensuring zero coupling between workflow definitions and execution runtimes.

### 2.3 Portfolio & Placement Demonstration Goals

- Demonstrate enterprise-grade full-stack architecture: NestJS backend, Next.js frontend, standalone Node.js worker processes, pnpm monorepo, and Turborepo.
- Show deep understanding of distributed systems fundamentals: message queues (BullMQ/Redis), relational persistence (PostgreSQL/Prisma), idempotency boundaries, and event-driven architectures.
- Showcase modern AI systems engineering: Model Context Protocol (MCP) SDK v2 integration, LangGraph state graph mechanics, and prompt safety boundaries.

---

## 3. User Personas

### 3.1 Primary Persona: Technical Developer ("Alex")

- **Role**: Senior Software Engineer / AI Engineer.
- **Goal**: Automate repetitive developer tasks (PR reviews, issue triage, documentation sync) using LLMs and tools without writing custom orchestration plumbing from scratch.
- **Pain Points**: Frustrated by uncontrollable LangChain agent loops, script crashes, and lack of visual debugging when LLM outputs fail schema validation.

### 3.2 Secondary Persona: Engineering Lead ("Sarah")

- **Role**: Tech Lead / Engineering Manager.
- **Goal**: Adopt AI automations across the team while guaranteeing security, auditability, cost control, and preventing unauthorized external mutations.
- **Pain Points**: Fears unmonitored LLM agents committing code, deleting resources, or leaking secrets to third-party endpoints without human sign-off.

---

## 4. Core User Journeys

### Journey 1: Authentication & Workspace Setup

1. User navigates to the web application.
2. User authenticates via credentials or OAuth session.
3. User is directed to their active Workspace dashboard.

### Journey 2: Workflow Creation & Canvas Editing

1. User clicks "New Workflow" and enters a name and description.
2. The interactive React Flow canvas loads an initial `INPUT` node.
3. User drags nodes (`TRANSFORM`, `CONDITION`, `LLM`, `MCP_TOOL`, `APPROVAL`, `OUTPUT`) from the palette onto the canvas.
4. User connects node outputs to compatible node inputs via typed handles.
5. User configures node parameters (e.g., prompt template, model choice, tool parameters) in the node property drawer.

### Journey 3: Workflow Draft Saving & Graph Validation

1. User clicks "Save Draft"; the draft DAG is saved to PostgreSQL.
2. User clicks "Validate"; the API runs graph validation algorithms:
   - Cycle detection (Tarjan's / Kahn's topological sort).
   - Connectivity check (single entrypoint, all nodes reachable, terminal nodes terminate in `OUTPUT`).
   - Node schema compatibility (output type of source node matches input type of target node).
3. If errors exist, the UI highlights invalid nodes and edges with specific error banners.

### Journey 4: Workflow Publishing (Immutable Versioning)

1. Upon successful validation, user clicks "Publish".
2. The API creates an immutable `WorkflowVersion` snapshot with an incremented semantic version (e.g., `v1`, `v2`).
3. Future executions reference this immutable version ID; subsequent edits modify a new draft without affecting published versions.

### Journey 5: Workflow Execution & Real-Time Monitoring

1. User clicks "Execute" or triggers execution via webhook/API payload.
2. API validates execution parameters, creates an `Execution` record (`PENDING`), and enqueues a job to BullMQ.
3. Worker picks up the job, marks `RUNNING`, and begins topological node evaluation.
4. Frontend establishes an SSE connection (`GET /api/v1/executions/:id/events`) and highlights active nodes on the canvas in real-time.

### Journey 6: Human Approval Interaction

1. Execution encounters an `APPROVAL` node; the worker pauses the execution state and records an `ApprovalRequest`.
2. Execution state transitions to `WAITING_FOR_APPROVAL`.
3. User receives an in-app notification displaying the pending action, proposed tool payload, and diff summary.
4. User clicks "Approve" (or "Reject" with reason).
5. API records the decision and dispatches an event to the worker to resume (or cancel) execution.

### Journey 7: Execution History & Failure Inspection

1. User navigates to the "Executions" tab.
2. User selects a past execution (succeeded or failed).
3. The UI renders the execution graph with color-coded node states, intermediate inputs/outputs, execution durations, token counts, and detailed error stack traces.

---

## 5. Functional Requirements

### 5.1 Authentication & Workspace (FR-AUTH, FR-WS)

- **FR-AUTH-001**: System shall authenticate users via secure session/JWT credentials.
- **FR-AUTH-002**: System shall enforce workspace-scoped authorization; users cannot view or trigger workflows outside their authorized workspaces.
- **FR-WS-001**: System shall support workspaces owning workflows, integrations, credentials, and execution logs.

### 5.2 Workflow Definition & Graph Editing (FR-WF, FR-DAG)

- **FR-WF-001**: System shall allow CRUD operations on workflow metadata (name, description, tags).
- **FR-DAG-001**: System shall persist workflow graphs consisting of nodes, typed ports, configuration payloads, and directed edges.
- **FR-DAG-002**: System shall allow updating draft graphs without mutating published versions.

### 5.3 Graph Validation & Versioning (FR-VAL, FR-VER)

- **FR-VAL-001**: System shall validate that workflow graphs are strictly acyclic Directed Acyclic Graphs (DAGs) using Kahn's topological sorting algorithm.
- **FR-VAL-002**: System shall reject graphs containing orphan (unreachable) nodes or disconnected edges.
- **FR-VAL-003**: System shall validate that node input configurations satisfy the required schemas before publishing.
- **FR-VER-001**: System shall snapshot published workflows into immutable versions (`WorkflowVersion`) containing frozen node definitions, edges, and schemas.
- **FR-VER-002**: Executions must strictly bind to an immutable `WorkflowVersion` identifier.

### 5.4 Execution & Scheduling (FR-EXEC, FR-QUEUE)

- **FR-EXEC-001**: System shall support manual, API-triggered, and webhook-triggered workflow executions.
- **FR-EXEC-002**: System shall validate incoming execution inputs against the workflow's `INPUT` node schema prior to job enqueueing.
- **FR-QUEUE-001**: System shall enqueue execution jobs into Redis-backed BullMQ queues.
- **FR-EXEC-003**: Background worker processes shall consume queue jobs, traverse the DAG in topological order, and execute ready nodes concurrently where dependencies permit.
- **FR-EXEC-004**: System shall maintain persistent node-level execution states (`PENDING`, `RUNNING`, `COMPLETED`, `FAILED`, `SKIPPED`, `WAITING_FOR_APPROVAL`).
- **FR-EXEC-005**: Topological sort defines dependency order, but conditional nodes dynamically control branch execution: branches not selected by a condition node are marked `SKIPPED`, and downstream nodes with unresolved required inputs are skipped accordingly. Detailed join semantics for converging branches are defined in architecture specifications.

### 5.5 Fault Tolerance & Error Handling (FR-RETRY, FR-CANCEL)

- **FR-RETRY-001**: System shall support configurable retry policies per node (maximum attempts, exponential backoff, initial delay).
- **FR-RETRY-002**: System shall classify errors into retryable (network timeouts, rate limits) and non-retryable (schema validation failures, 401 unauthorized).
- **FR-CANCEL-001**: System shall allow users to cancel an active execution, terminating pending worker tasks and marking status as `CANCELLED`.

### 5.6 Real-Time Events & Observability (FR-EVENT, FR-SSE, FR-HIST)

- **FR-EVENT-001**: Worker shall emit granular execution events (`EXECUTION_STARTED`, `NODE_STARTED`, `NODE_COMPLETED`, `NODE_FAILED`, `APPROVAL_REQUIRED`, `EXECUTION_COMPLETED`).
- **FR-SSE-001**: API shall provide a Server-Sent Events (SSE) endpoint streaming execution events to connected clients.
- **FR-HIST-001**: System shall persist complete execution histories, including node inputs, outputs, timestamps, token counts, and error details.

### 5.7 Node Integrations & AI Tooling (FR-LLM, FR-MCP, FR-APPR)

- **FR-LLM-001**: LLM nodes shall support configurable providers, model names, temperature, system prompts, and structured output schemas via Zod.
- **FR-MCP-001**: System shall integrate with Model Context Protocol (MCP) servers using the official MCP TypeScript SDK.
- **FR-MCP-002**: System shall discover, validate, and invoke MCP tools through a secure gateway enforcing parameter schema validation.
- **FR-APPR-001**: When an `APPROVAL` node is reached, the worker shall suspend workflow progress and generate an `ApprovalRequest` record.
- **FR-APPR-002**: Resuming an execution after approval shall require authorized user credentials and validate that the request has not expired.

---

## 6. Workflow Node Types (V1 Specification)

| Node Type   | Responsibility                                                        | Inputs                          | Outputs                  | Execution Semantics                                  |
| ----------- | --------------------------------------------------------------------- | ------------------------------- | ------------------------ | ---------------------------------------------------- |
| `INPUT`     | Defines entrypoint schema and execution trigger parameters.           | None (External trigger payload) | Parameter object         | Deterministic, synchronous.                          |
| `TRANSFORM` | Executes deterministic data manipulation, JSON mapping, or filtering. | Input objects                   | Transformed object       | Deterministic, zero side-effects.                    |
| `CONDITION` | Evaluates boolean expressions or branch conditions.                   | Input values                    | Matched branch routing   | Routes execution to true/false branch.               |
| `LLM`       | Generates text or structured JSON using configured LLM providers.     | Prompt parameters, context      | Text / Structured JSON   | Asynchronous, retryable with backoff.                |
| `MCP_TOOL`  | Invokes an external tool via Model Context Protocol (MCP).            | Tool arguments                  | Tool result payload      | External side-effect; requires authorization.        |
| `APPROVAL`  | Pauses execution awaiting human sign-off for sensitive actions.       | Proposed action payload         | Approval decision        | Suspends execution; resumes on webhook/API approval. |
| `OUTPUT`    | Terminal node defining final workflow result payload.                 | Upstream node results           | Final execution response | Marks workflow as `COMPLETED`.                       |

_Note_: A bounded `AGENT` node (multi-turn reasoning loop with dynamic tool dispatch) is planned for Phase 4 and will not block initial deterministic DAG execution.

---

## 7. Non-Functional Requirements (NFR)

### 7.1 Security

- All sensitive integration credentials (e.g., GitHub tokens, LLM API keys) must be encrypted at rest (AES-256-GCM) and never logged in plain text.
- External tool execution via MCP must operate with least-privilege scoping.
- LLM outputs must be treated as untrusted data and strictly validated against Zod schemas before being passed to downstream nodes or external APIs.

### 7.2 Availability & Resilience

- Worker processes must operate statelessly. A sudden worker termination must result in job re-delivery via BullMQ visibility timeouts and state recovery from PostgreSQL.
- Database operations tracking execution progress must use atomic transactions or idempotent update semantics.

### 7.3 Data Integrity

- Workflow execution graphs and node execution records must be append-only / immutable once completed.
- Execution history must remain intact even if the parent workflow definition is subsequently modified or deleted (soft deletion).

### 7.4 Observability

- All services must output structured JSON logs with correlation IDs (`executionId`, `workspaceId`, `workflowId`).
- Failed node executions must capture complete error diagnostic contexts (HTTP status, error message, stack trace, attempted input payload).

### 7.5 Performance & Scale (V1 Target)

- Graph validation latency: $< 100\text{ms}$ for graphs up to 50 nodes.
- Event dispatch to SSE stream: $< 250\text{ms}$ under normal load.
- Quantitative throughput and worker concurrency targets remain **TBD** pending baseline load benchmarking in Milestone 3.

---

## 8. Out of Scope (V1 Exclusions)

The following capabilities are explicitly out of scope for the V1 release:

1. **Billing & Usage Monetization**: Stripe integration, credit deductions, and subscription tiers.
2. **Public Marketplace**: Community sharing, rating, or commercial distribution of workflow templates.
3. **Multi-Region Clustering**: Geo-distributed database replication or cross-region worker distribution.
4. **Kubernetes Orchestration**: Deployment targets Docker Compose and standalone container runtimes.
5. **Arbitrary Cyclic Workflows**: Workflows must be strict DAGs; arbitrary while-loops without bounding are prohibited.
6. **Enterprise SSO**: SAML 2.0 / Okta / Azure AD federation.
7. **Real-Time Collaborative Editing**: Multi-user Google Docs style canvas editing (WebSockets/CRDTs).
8. **Autonomous Agent Swarms**: Open-ended, autonomous agent loops without step limits or human oversight.
9. **Native Mobile Client**: Responsive web interface only.

---

## 9. V1 Acceptance Criteria

1. **Graph Validation**: A workflow containing a cycle, disconnected node, or invalid schema is rejected with actionable error diagnostics.
2. **Immutable Snapshotting**: Publishing a workflow creates an immutable version; editing the draft does not alter the published version.
3. **Asynchronous Execution**: Starting an execution returns immediately with HTTP 202 / execution ID; work executes on the background worker.
4. **Real-Time Monitoring**: Frontend canvas visualizes live execution state transitions driven by Server-Sent Events.
5. **Human Approval Enforcement**: An `APPROVAL` node halts execution progress; the worker will not execute downstream nodes until explicit approval is recorded.
6. **Failure Resilience**: Simulating a worker crash during node execution allows a revived worker to identify the uncompleted job and execute retry policies.
7. **End-to-End Flagship Verification**: The GitHub PR Review workflow successfully retrieves diffs, generates review summaries, requests human approval, and outputs review results.

---

## 10. Open Product Decisions

| Decision Area                     | Status   | Proposed Default                         | Impact / Resolution Strategy                                                                                              |
| --------------------------------- | -------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Maximum Node Count per DAG        | **OPEN** | 50 nodes                                 | Prevents excessive graph traversal complexity and UI render lag. Will benchmark in Milestone 3.                           |
| Approval Request Timeout          | **OPEN** | 48 hours                                 | If an approval request is not acted on within 48h, execution transitions to `EXPIRED`.                                    |
| Execution History Retention       | **OPEN** | 30 days                                  | Older executions archived or purged to conserve storage.                                                                  |
| Default LLM Token Limits          | **OPEN** | 4,000 tokens / call                      | Guardrail against runaway generation costs.                                                                               |
| Hosting Environment               | **OPEN** | Railway / AWS ECS                        | Evaluated based on deployment cost and simplicity during Milestone 4.                                                     |
| Conditional Branch Join Semantics | **OPEN** | Wait-all-active                          | Defines whether a converging join node requires all incoming edges to succeed or only active (non-skipped) inbound paths. |
| Database & Queue Engine Versions  | **OPEN** | PostgreSQL 16.x / Redis 7.x (Candidates) | Specific release tags and container images will be finalized during Phase 2 setup.                                        |

---

_End of Product Requirements Document._
