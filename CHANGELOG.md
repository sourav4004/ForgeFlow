# Changelog

All notable changes to FlowForge AI will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **Important Foundation Notice**: FlowForge AI is currently in active Phase 1 engineering foundation. Application features, workflow execution engine, database schemas, and visual editor are not yet implemented. No production release has been tagged.

---

## [Unreleased]

### Added

- **Repository and Monorepo Foundation**:
  - Initialized pnpm 12.16.1 workspace with Turborepo 2.11.10 build orchestration.
  - Pinned runtime environment to Node.js 26 via `.nvmrc`.
  - Configured repository hygiene with `.editorconfig` and `.gitignore`.
- **Shared Code-Quality and Compilation Tooling**:
  - Configured shared TypeScript 6 base (`tsconfig.base.json`) enforcing strict type checking, modern ES target, and standard module resolution.
  - Implemented flat ESLint 10 configuration (`eslint.config.mjs`) supporting TypeScript, React, Next.js, and Prettier integration.
  - Configured unified code formatting via Prettier (`.prettierrc.json`, `.prettierignore`).
- **Next.js Web Application (`apps/web`)**:
  - Scaffolded Next.js 16 application with React 19 and App Router.
  - Integrated Tailwind CSS and configured workspace package extension for TypeScript and ESLint.
- **NestJS API Application (`apps/api`)**:
  - Scaffolded NestJS 12 backend application using Express HTTP adapter.
  - Integrated Vitest with SWC (`unplugin-swc`) as the test transformer to preserve TypeScript decorator metadata reflection, while using the standard NestJS CLI compiler for production builds.
  - Implemented system health check endpoint (`GET /api/v1/health`) with structured payload.
- **Standalone Background Worker (`apps/worker`)**:
  - Scaffolded independent Node.js background-worker process completely decoupled from the HTTP API.
  - Implemented minimal worker entrypoint that outputs startup diagnostic and exits cleanly with code 0 (queue consumers and graceful shutdown handling are deferred to Phase 3 BullMQ milestone).
- **Shared Contracts Workspace Package (`packages/contracts`)**:
  - Established `@flowforge/contracts` workspace library as a pure ESM package (`NodeNext`) with generated TypeScript declaration files.
  - Defined framework-agnostic DTOs and type contracts (`HealthResponse`, `HealthStatus`, `ServiceHealth`).
  - Enforced strict monorepo boundary preventing direct inter-application imports.
- **Automated Testing Infrastructure**:
  - Configured Vitest test runner across API and worker applications.
  - Implemented Supertest end-to-end integration test for `/api/v1/health`.
  - Implemented NestJS dependency injection container verification test.
  - Implemented child process smoke test verifying background worker startup diagnostic and clean exit code 0.
  - Implemented compile-time type verification and negative tests (`@ts-expect-error`) for contracts.
  - Completed comprehensive monorepo-wide testing infrastructure audit.
- **System Documentation and Governance**:
  - Authored Product Requirements Document ([`PRD.md`](./PRD.md)) establishing product scope, user personas, and flagship PR review workflow.
  - Authored System Architecture Document ([`ARCHITECTURE.md`](./ARCHITECTURE.md)) defining system topology, execution state machine, transactional outbox, and security boundaries.
  - Established Technical Decision Register ([`TECHNICAL_DECISIONS.md`](./TECHNICAL_DECISIONS.md)) tracking 16 foundational technology choices and implementation statuses.
  - Published 4 foundational Architecture Decision Records ([`docs/adr/`](./docs/adr)):
    - [ADR-0001: Monorepo and Application Boundaries](./docs/adr/0001-monorepo-and-application-boundaries.md)
    - [ADR-0002: Asynchronous API and Worker Separation](./docs/adr/0002-asynchronous-api-worker-separation.md)
    - [ADR-0003: DAG Workflows and Immutable Versions](./docs/adr/0003-dag-workflows-and-immutable-versions.md)
    - [ADR-0004: At-Least-Once Processing and Reliability](./docs/adr/0004-at-least-once-processing-and-reliability.md)
  - Authored Implementation & Development Plan ([`DEVELOPMENT_PLAN.md`](./DEVELOPMENT_PLAN.md)) defining Phase 1–4 roadmap, milestone deliverables, dependency critical path, and acceptance criteria.
  - Authored Engineering Progress Log ([`DEVELOPMENT_LOG.md`](./DEVELOPMENT_LOG.md)) recording verified milestone history and verification evidence hierarchy.
- **Continuous Integration Pipeline**:
  - Configured GitHub Actions CI workflow ([`.github/workflows/ci.yml`](./.github/workflows/ci.yml)) to run automated formatting checks, root and workspace linting, production builds, workspace and test typechecking, and automated test suites on `ubuntu-latest` with Node.js 26 and pnpm 12.
- **Workflow Graph Runtime Schemas & Domain Contracts**:
  - Added framework-independent Zod 4 runtime schemas and inferred TypeScript types in `@flowforge/contracts` (`WorkflowNodeTypeSchema`, `WorkflowNodeSchema`, `WorkflowEdgeSchema`, `WorkflowGraphSchema`, `WorkflowIdentifierSchema`).
  - Implemented exact identifier validation (1–128 characters, non-empty, non-whitespace) strictly preserving input identity without silent mutation or trimming.
  - Configured Vitest runtime schema test suite (`packages/contracts/test/workflow-schema.spec.ts`) validating positive graph parsing, structural data preservation, and negative rejections.
- **INPUT Node Configuration Schema & Validation (`packages/contracts`)**:
  - Implemented standalone, strict Zod runtime configuration schema and inferred TypeScript types for the `INPUT` workflow node (`InputFieldTypeSchema`, `InputFieldDefinitionSchema`, `InputNodeConfigSchema`).
  - Supported four approved V1 field types: `string`, `number`, `boolean`, `json`.
  - Implemented strict default-value cross-field validation, verifying type compatibility (string for `string`, finite number for `number`, boolean for `boolean`, JSON for `json`), while rejecting non-finite numbers (`NaN`, `Infinity`), non-JSON values, and explicit `undefined`.
  - Supported zero-field configurations (`fields: []`) for parameterless workflow triggers up to a maximum of 50 fields.
  - Enforced exact field name uniqueness without silent lowercasing or normalization.
  - Maintained draft compatibility: draft nodes with `{ config: {} }` remain structurally valid in `WorkflowNodeSchema`, while `InputNodeConfigSchema` strictly enforces configuration requirements for typed execution and publish readiness.
  - Configured comprehensive Vitest test suite (`packages/contracts/test/input-config.spec.ts`) with 29 tests covering positive parsing, strict negative rejections, boundary draft compatibility, and compile-time TypeScript inference.
- **Value Bindings & OUTPUT Node Configuration (`packages/contracts`)**:
  - Implemented reusable, discriminated value binding schemas (`LiteralBindingSchema`, `InputValueReferenceSchema`, `NodeOutputValueReferenceSchema`, `ValueReferenceSchema`, `ReferenceBindingSchema`, `ValueBindingSchema`) in `@flowforge/contracts`.
  - Designed structured reference schemas with explicit path segment arrays (max depth 16, max segment length 128) avoiding ambiguous dotted string splitting and allowing dots and spaces in node IDs and property names.
  - Implemented strict `OutputNodeConfigSchema` requiring `payloadMapping` of `WorkflowIdentifierSchema` to `ValueBindingSchema` (1 to 50 fields), with terminal behavior decoupled and enforced by graph topology.
  - Configured comprehensive Vitest test suites (`packages/contracts/test/value-binding.spec.ts` with 31 tests and `packages/contracts/test/output-config.spec.ts` with 18 tests) covering positive parsing, data preservation, negative rejections, boundary draft compatibility, and compile-time TypeScript inference.
- **Declarative TRANSFORM Node Configuration Schemas (`packages/contracts`)**:
  - Implemented standalone, strict declarative transformation schemas supporting four approved V1 operations (`json_pick`, `json_set`, `template_string`, `math_op`) via Zod discriminated unions.
  - Configured `JsonPickTransformRuleSchema` with structured references and optional JSON `fallbackValue` (strictly rejecting explicit `undefined`).
  - Configured `JsonSetTransformRuleSchema` with literal or reference value bindings.
  - Configured `TemplateStringTransformRuleSchema` with ordered sequence of text and reference segments (1 to 100 segments, max 5000 chars total static text) preserving exact authored whitespace and characters.
  - Configured `MathOpTransformRuleSchema` supporting bounded binary arithmetic (`add`, `subtract`, `multiply`, `divide`), finite numeric literal verification, and configuration-time division-by-zero rejection with zero arbitrary code execution.
  - Implemented `TransformNodeConfigSchema` enforcing unique `targetKey` fields (1 to 50 rules), strict object validation, and draft backward compatibility.
  - Added comprehensive Vitest test suite (`packages/contracts/test/transform-config.spec.ts`) with 43 tests covering positive operation parsing, negative rejections, boundary draft compatibility, and compile-time TypeScript inference.
- **CONDITION Node Configuration & Explicit Branch Metadata (`packages/contracts`)**:
  - Implemented standalone, strict predicate configuration schemas for the `CONDITION` workflow node supporting binary and unary variants via Zod discriminated unions (`BinaryConditionConfigSchema`, `UnaryConditionConfigSchema`, `ConditionNodeConfigSchema`).
  - Supported 8 approved binary comparison operators (`equals`, `not_equals`, `greater_than`, `less_than`, `greater_than_or_equal`, `less_than_or_equal`, `contains`, `not_contains`) requiring `left` and `right` operands as `ValueBindingSchema`.
  - Supported 4 approved unary comparison operators (`is_empty`, `is_not_empty`, `is_null`, `is_not_null`) requiring `left` operand as `ValueBindingSchema` and strictly forbidding `right` via `.strict()`.
  - Decoupled branch routing metadata from node configuration into graph edges: defined `ConditionOutcomeSchema` (`'TRUE' | 'FALSE'`) and added optional `conditionOutcome?: ConditionOutcomeSchema` to `WorkflowEdgeSchema` with `.superRefine` strictly rejecting explicit `undefined`.
  - Preserved multi-tier validation boundary: `WorkflowNodeSchema` permits draft CONDITION nodes with `{ config: {} }`, while `ConditionNodeConfigSchema` strictly validates predicates for execution/publish readiness.
  - Added comprehensive Vitest test suites (`packages/contracts/test/condition-config.spec.ts` with 31 tests and `packages/contracts/test/condition-edge.spec.ts` with 14 tests) covering positive operator parsing, negative rejections, draft compatibility, and TypeScript compile-time type narrowing.
- **LLM Node Configuration & Prompt Binding Schemas (`packages/contracts`)**:
  - Implemented standalone, strict configuration schemas for the `LLM` workflow node (`LlmNodeConfigSchema`, `LlmPromptBindingSchema`, `LlmPromptLiteralBindingSchema`, `LlmResponseFormatSchema`).
  - Enforced string-only literal prompts (`LlmPromptLiteralBindingSchema` requiring non-empty string up to 10,000 characters), strictly rejecting non-string JSON values, numbers, and nulls.
  - Reused existing structured `ReferenceBindingSchema` for workflow input and upstream node-output prompt references.
  - Defined provider-agnostic validation for `provider` (1–50 characters, non-whitespace-only) and `model` (1–100 characters, non-whitespace-only) preserving exact authored characters and punctuation with zero hardcoded vendor enums.
  - Supported optional generation parameters: `systemInstruction` (1–5,000 characters), `temperature` (bounded finite number 0–2), `maxTokens` (integer 1–16,384), and `responseFormat` (`'text' | 'json'`).
  - Enforced strict object validation rejecting credential fields (`apiKey`, `clientSecret`, etc.) and `.superRefine` rejecting explicit `undefined` optional fields to guarantee clean JSON serialization.
  - Added comprehensive Vitest test suite (`packages/contracts/test/llm-config.spec.ts` with 50 tests) covering positive configurations, prompt bindings, raw template text retention, boundary parameters, negative rejections, and TypeScript compile-time type narrowing.
- **MCP_TOOL Node Configuration & Argument Binding Schemas (`packages/contracts`)**:
  - Implemented standalone, strict configuration schemas for the `MCP_TOOL` workflow node (`McpToolNodeConfigSchema`, `McpToolNameSchema`, `McpToolArgumentNameSchema`).
  - Defined opaque workspace integration reference (`integrationRef: WorkflowIdentifierSchema`, 1–128 characters, non-whitespace-only) and external tool identifier (`toolName: McpToolNameSchema`, 1–128 characters) preserving exact authored characters and punctuation.
  - Defined tool parameter argument mappings (`arguments?: Record<string, ValueBinding>`, max 50 entries) using `McpToolArgumentNameSchema` (1–128 characters, allowing dots, hyphens, and spaces to match JSON Schema properties) and reusing `ValueBindingSchema` for values.
  - Supported optional execution timeout (`timeoutMs`, integer milliseconds bounded between 500 and 300,000 ms).
  - Enforced strict object validation rejecting credential fields (`apiKey`, `clientSecret`), transport configurations (`serverUrl`, `command`, `env`), self-authorization bypasses (`safeToRun`, `bypassApproval`), and `.superRefine` rejecting explicit `undefined` optional fields.
  - Added comprehensive Vitest test suite (`packages/contracts/test/mcp-tool-config.spec.ts` with 51 tests) covering positive configurations, literal and reference arguments, timeout boundaries, negative rejections, draft compatibility, and compile-time TypeScript inference.
- **Human APPROVAL Node Configuration Schemas (`packages/contracts`)**:
  - Implemented standalone, strict configuration schemas for the human `APPROVAL` workflow node (`ApprovalNodeConfigSchema`, `ApprovalPolicySchema`, `ApproverRoleSchema`, `ApprovalTimeoutActionSchema`).
  - Defined explicit workspace membership role policy (`roles: ApproverRole[]`, 1–3 unique items from `'OWNER' | 'ADMIN' | 'MEMBER'`) with duplicate detection reporting issues at `policy.roles[index]`.
  - Defined execution timeout (`timeoutMinutes`, integer bounded 1–10,080 minutes / 7 days) and explicit timeout expiration actions (`'REJECT' | 'EXPIRE'`).
  - Enforced strict object validation rejecting self-authorization bypasses (`autoApprove`, `bypassApproval`), runtime decision state (`status`, `decision`, `approverUserId`), and `.superRefine` rejecting explicit `undefined` optional fields.
  - Added comprehensive Vitest test suite (`packages/contracts/test/approval-config.spec.ts` with 45 tests) covering positive configurations, multi-role policies, timeout boundaries, negative rejections, draft compatibility, and compile-time TypeScript inference.
- **Typed Workflow Node Composition & Discriminated Union (`packages/contracts`)**:
  - Implemented Zod 4 discriminated union on property `type` (`ConfiguredWorkflowNodeSchema`, `ConfiguredWorkflowNode`) uniting all seven fully configured workflow node variants (`INPUT`, `TRANSFORM`, `CONDITION`, `LLM`, `MCP_TOOL`, `APPROVAL`, `OUTPUT`).
  - Reused existing structural position and identifier schemas (`WorkflowNodeSchema.shape.id`, `WorkflowNodeSchema.shape.position`) while enforcing strict object validation on outer nodes and configuration payloads.
  - Strictly rejected unknown or unsupported node types (such as `AGENT`), missing configurations, and mismatched type-configuration pairings.
  - Maintained draft backward compatibility: generic `WorkflowNodeSchema` continues to accept incomplete drafts (`{ config: {} }`), while `ConfiguredWorkflowNodeSchema` strictly requires complete, type-specific configuration schemas.
  - Added comprehensive Vitest test suite (`packages/contracts/test/configured-node.spec.ts` with 43 tests) validating positive variant selection, coordinate preservation, generic draft schema compliance, JSON round-trip serialization, negative rejections, and compile-time TypeScript narrowing.
- **Workflow-Level Node Configuration Validation and Diagnostics (`packages/contracts`)**:
  - Implemented standalone and workflow-level node configuration validation helpers (`validateNodeConfig`, `validateWorkflowNodeConfigs`, `formatValidationPath`).
  - Implemented structured, non-leaking diagnostic issue and result types (`NodeConfigValidationIssue`, `WorkflowNodeConfigValidationIssue`, `NodeConfigValidationResult`, `WorkflowNodeConfigValidationResult`) with discriminated success narrowing.
  - Implemented multi-node diagnostic aggregation across draft graphs, collecting all issues across all nodes without short-circuiting on the first error, and preserving exact node index, ID, and type.
  - Implemented deterministic path formatting with dot notation and quoted bracket notation for keys containing dots, spaces, or special characters.
  - Added comprehensive Vitest test suite (`packages/contracts/test/workflow-config-validation.spec.ts` with 55 tests) validating positive configurations, diagnostic aggregation, index/ID/type preservation, nested numeric indices, boundary decoupling, non-mutation, and compile-time TypeScript inference.
- **Workflow Graph Analysis and Topological Ordering (`packages/workflow-core`)**:
  - Established `@flowforge/workflow-core` standalone workspace package as pure ESM with TypeScript declarations and strict compile-time types.
  - Implemented `analyzeWorkflowGraph(graph: WorkflowGraph): GraphAnalysisResult` executing staged integrity analysis:
    - Stage A validates exact node and edge identifier uniqueness (preserving exact string equality, casing, and punctuation).
    - Stage B validates edge referential integrity (verifying existence of sources and targets in the node set) with graceful immediate failure return to avoid false cycle diagnoses.
    - Stage C executes Kahn's topological sort with a zero-dependency binary min-heap for deterministic $O((V + E) \log V)$ lexicographic tie-breaking, selecting the smallest node ID when multiple zero-indegree vertices are ready.
  - Implemented structured, non-leaking diagnostic types (`GraphIntegrityIssueCode`, `GraphIntegrityIssue`, `GraphAnalysisSuccessResult`, `GraphAnalysisFailureResult`, `GraphAnalysisResult`) with discriminated success narrowing.
  - Maintained draft backward compatibility, permitting draft nodes (`config: {}`), empty graphs (`{ nodes: [], edges: [] }`), disconnected acyclic components, and parallel edges with distinct IDs.
  - Added comprehensive Vitest test suite (`packages/workflow-core/test/graph-analysis.spec.ts` with 50 tests) covering DAG traversal, determinism, reordering invariance, tie-breaking, parallel edge in-degree decrementing, self-loops, 2-node and multi-node cycles, immutability, and compile-time type narrowing.
- **Workflow Graph Semantics and Static Reachability (`packages/workflow-core`)**:
  - Implemented `validateWorkflowGraphSemantics(graph: WorkflowGraph): WorkflowGraphSemanticsResult` executing staged semantic validation:
    - Integrity gating reusing `analyzeWorkflowGraph(graph)` to prevent misleading semantic errors on cyclic or referentially invalid graphs (`stage: 'integrity'`).
    - At-least-one `INPUT` node and at-least-one `OUTPUT` node presence rules (`MISSING_INPUT_NODE`, `MISSING_OUTPUT_NODE`).
    - Strict `CONDITION` node branch rules requiring exactly one `TRUE` and one `FALSE` outgoing edge (`CONDITION_TRUE_BRANCH_MISSING`, `CONDITION_FALSE_BRANCH_MISSING`, `CONDITION_OUTCOME_DUPLICATE`, `CONDITION_EDGE_OUTCOME_MISSING`, `CONDITION_EXTRA_OUTGOING_EDGE`).
    - Non-CONDITION edge outcome prohibition strictly rejecting `conditionOutcome` metadata on edges originating from non-CONDITION nodes (`NON_CONDITION_EDGE_OUTCOME`).
    - Static forward reachability from `INPUT` nodes via BFS in $\mathcal{O}(V + E)$ (`UNREACHABLE_FROM_INPUT`).
    - Static reverse reachability to `OUTPUT` nodes via reverse BFS in $\mathcal{O}(V + E)$ (`CANNOT_REACH_OUTPUT`).
  - Added structured, non-leaking semantic diagnostic types (`WorkflowGraphSemanticIssueCode`, `WorkflowGraphSemanticIssue`, `WorkflowGraphSemanticsSuccessResult`, `WorkflowGraphSemanticsIntegrityFailureResult`, `WorkflowGraphSemanticsSemanticFailureResult`, `WorkflowGraphSemanticsResult`) with discriminated success and stage narrowing.
  - Added comprehensive Vitest test suite (`packages/workflow-core/test/graph-semantics.spec.ts` with 53 tests) validating branch integrity, reachability, integrity gating, and compile-time type narrowing.

- **Static Node-Output Reference Integrity and DAG Ancestry (`packages/workflow-core`)**:
  - Implemented `validateWorkflowNodeOutputReferences(graph: WorkflowGraph): WorkflowNodeOutputReferenceValidationResult` executing staged static reference lineage validation:
    - Stage 1 integrity gating via `analyzeWorkflowGraph(graph)`, halting if structural integrity issues, cycles, or duplicate IDs are detected (`stage: 'integrity'`).
    - Stage 2 configuration gating via `validateWorkflowNodeConfigs(graph)` from `@flowforge/contracts`, halting if any node configuration is incomplete or invalid (`stage: 'configuration'`).
    - Stage 3 static node-output reference inspection across approved typed positions (`TRANSFORM` rules, `CONDITION` left/right, `LLM` prompt reference, `MCP_TOOL` arguments, `OUTPUT` payloadMapping) without recursive scanning of literal JSON or prompt strings.
    - Strict reverse DAG ancestry validation via reverse BFS, verifying target node existence (`NODE_OUTPUT_REFERENCE_NOT_FOUND`), rejecting self-references (`NODE_OUTPUT_REFERENCE_SELF`), and checking strict directed ancestry (`NODE_OUTPUT_REFERENCE_NOT_UPSTREAM`).
  - Added structured diagnostic types (`NodeOutputReferenceIssueCode`, `NodeOutputReferenceIssue`, `WorkflowNodeOutputReferenceSuccessResult`, `WorkflowNodeOutputReferenceIntegrityFailureResult`, `WorkflowNodeOutputReferenceConfigurationFailureResult`, `WorkflowNodeOutputReferenceFailureResult`, `WorkflowNodeOutputReferenceValidationResult`) with discriminated success and stage narrowing.
  - Added comprehensive Vitest test suite (`packages/workflow-core/test/node-output-references.spec.ts` with 49 tests) validating positive references, negative ancestry violations, prerequisite stage gating, atomic dot IDs, literal isolation, and compile-time TypeScript inference.
- **INPUT Field Reference Scope and Static Validation (`packages/workflow-core`)**:
  - Implemented `validateWorkflowInputReferences(graph: WorkflowGraph): WorkflowInputReferenceValidationResult` executing staged static trigger input reference scope validation:
    - Stage 1 integrity gating via `analyzeWorkflowGraph(graph)` and Stage 2 configuration gating via `validateWorkflowNodeConfigs(graph)`.
    - Stage 3 unified workflow-level INPUT field namespace indexing and resolution:
      - Builds frequency index across all declared fields in configured `INPUT` nodes.
      - Enforces exact case-sensitive field identity.
      - Emits `INPUT_REFERENCE_FIELD_NOT_FOUND` if a referenced field has zero declarations across all `INPUT` nodes.
      - Emits `INPUT_REFERENCE_FIELD_AMBIGUOUS` if a referenced field has duplicate declarations across multiple `INPUT` nodes.
      - Decouples input field resolution from graph ancestry: declaring `INPUT` node need not be a directed ancestor of consumer node.
  - Added structured diagnostic types (`InputReferenceIssueCode`, `InputReferenceIssue`, `WorkflowInputReferenceSuccessResult`, `WorkflowInputReferenceIntegrityFailureResult`, `WorkflowInputReferenceConfigurationFailureResult`, `WorkflowInputReferenceFailureResult`, `WorkflowInputReferenceValidationResult`) with discriminated success and stage narrowing.
  - Added comprehensive Vitest test suite (`packages/workflow-core/test/input-references.spec.ts` with 63 tests) validating positive references, missing fields, ambiguous multi-INPUT declarations, matching/different types, array order independence, literal isolation, prerequisite gating, frozen immutability, determinism, and TypeScript type narrowing.
- **INPUT/OUTPUT Entry and Terminal Topology Validation (`packages/workflow-core`)**:
  - Implemented `validateWorkflowEntryExitTopology(graph: WorkflowGraph): WorkflowEntryExitTopologyResult` enforcing entry/terminal boundary topology on workflow DAGs.
  - Reused `validateWorkflowGraphSemantics(graph)` as a staged prerequisite, preserving integrity failures (`stage: 'integrity'`) and semantic failures (`stage: 'semantics'`) without redundant topological sorting.
  - Enforced zero incoming edges on `INPUT` nodes (`INPUT_HAS_INCOMING_EDGE` targeting `['edges', edgeIndex, 'target']`).
  - Enforced zero outgoing edges on `OUTPUT` nodes (`OUTPUT_HAS_OUTGOING_EDGE` targeting `['edges', edgeIndex, 'source']`).
  - Supported multiple entry `INPUT` nodes and multiple terminal `OUTPUT` nodes.
  - Handled compound boundary violations (e.g. `OUTPUT -> INPUT`) emitting both issues in deterministic edge order.
  - Preserved deterministic topological sort ordering (`topologicalNodeIds`) on success.
  - Added structured diagnostic types (`WorkflowEntryExitTopologyIssueCode`, `WorkflowEntryExitTopologyIssue`, `WorkflowEntryExitTopologySuccessResult`, `WorkflowEntryExitTopologyIntegrityFailureResult`, `WorkflowEntryExitTopologySemanticFailureResult`, `WorkflowEntryExitTopologyFailureResult`, `WorkflowEntryExitTopologyResult`) with discriminated success and stage narrowing.
  - Added comprehensive Vitest test suite (`packages/workflow-core/test/entry-exit-topology.spec.ts` with 47 tests) validating valid topologies, boundary violations, prerequisite failure preservation, frozen immutability, determinism, and TypeScript compile-time type narrowing.
- **Branch-Conditioned Node-Output Path Coverage Analysis (`packages/workflow-core`)**:
  - Implemented `analyzeWorkflowNodeOutputPathCoverage(graph: WorkflowGraph): WorkflowNodeOutputPathCoverageResult` performing static path-dominance analysis on workflow DAGs.
  - Reused `validateWorkflowEntryExitTopology` and `validateWorkflowNodeOutputReferences` as staged prerequisites, preserving integrity (`stage: 'integrity'`), semantic (`stage: 'semantics'`), entry/terminal boundary (`stage: 'entry_exit'`), configuration (`stage: 'configuration'`), and reference lineage (`stage: 'references'`) diagnostics without speculative evaluation.
  - Defined path dominance relative to all workflow INPUT entrypoints: producer node $P$ dominates consumer node $C$ if every directed path from ANY `INPUT` node to $C$ contains $P$.
  - Implemented producer-exclusion forward BFS reachability algorithm with intra-call caching per distinct referenced producer ($O(V + E + R + P(V + E))$).
  - Emitted occurrence-level advisory control-flow findings (`NODE_OUTPUT_REFERENCE_NOT_ON_ALL_INPUT_PATHS`) identifying non-dominating references (such as conditional branch merges or optional bypasses) without treating them as hard graph errors or publication blockers.
  - Added structured diagnostic and result types (`NodeOutputPathCoverageFindingCode`, `NodeOutputPathCoverageFinding`, `WorkflowNodeOutputPathCoverageSuccessResult`, `WorkflowNodeOutputPathCoverageIntegrityFailureResult`, `WorkflowNodeOutputPathCoverageSemanticFailureResult`, `WorkflowNodeOutputPathCoverageEntryExitFailureResult`, `WorkflowNodeOutputPathCoverageConfigurationFailureResult`, `WorkflowNodeOutputPathCoverageReferencesFailureResult`, `WorkflowNodeOutputPathCoverageResult`) with discriminated union stage narrowing.
  - Added comprehensive Vitest test suite (`packages/workflow-core/test/node-output-path-coverage.spec.ts` with 60 tests) validating dominating linear pipelines, shared branch producers, branch-confined references, multiple inputs/outputs, conditional merges, optional side paths, distinct producers, occurrence preservation, prerequisite failures, determinism, frozen immutability, and TypeScript type discrimination.

### Changed

- **Transactional Outbox Clarification**: Explicitly distinguished durable PostgreSQL outbox persistence from ephemeral Redis Pub/Sub / SSE delivery in PRD and Architecture documents.
- **Conditional DAG Execution Semantics**: Documented conditional branching and branch skipping as open design specifications rather than assumed full-graph execution.
- **Infrastructure Version Labeling**: Designated PostgreSQL 16 and Redis 7 as candidate infrastructure baselines rather than permanently frozen versions.
- **Workflow Version Immutability Boundaries**: Clarified that immutable workflow versions guarantee retrieval of workflow definitions, not deterministic external LLM outputs or side effects.

### Fixed

- **pnpm Native Build Approval**: Approved `@swc/core` native package build in `pnpm-workspace.yaml` (`allowBuilds`) for pnpm 12 compatibility.
- **Contracts Test Config Formatting**: Corrected Prettier whitespace in `packages/contracts/tsconfig.test.json`.
- **Contracts Type Test Directives**: Positioned `@ts-expect-error` directly above failing property assignment in `packages/contracts/test/health-response.type-test.ts`.
- **Cross-Contract JSON Serializability Invariant**: Added explicit `undefined` check for `description` in `InputFieldDefinitionSchema` (`input-config.ts`), preventing explicit `undefined` values from producing configured nodes that fail `WorkflowNodeSchema`'s `z.json()` validation, with regression testing in `test/input-config.spec.ts`.
