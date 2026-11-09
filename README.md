# FlowForge AI

FlowForge AI is a visual, durable AI workflow orchestration platform designed to build, validate, version, and execute asynchronous directed acyclic graph (DAG) workflows with deterministic logic, AI reasoning nodes, and Model Context Protocol (MCP) integrations.

## Project Status

The repository has completed foundational setup, core application scaffolding, shared contracts, and automated testing infrastructure (Phase 1, Milestones 1A through 1E-C), and is actively executing Phase 2 Domain & Persistence Foundation:

- pnpm monorepo workspaces and Turborepo task pipeline.
- Shared strict TypeScript configuration (`tsconfig.base.json`).
- ESLint flat configuration (`eslint.config.mjs`) with TypeScript, Next.js, React Hooks, and Prettier integration.
- Unified code formatting via Prettier (`.prettierrc.json`, `.prettierignore`).
- Next.js frontend application (`@flowforge/web`) on port 3000.
- NestJS backend API application (`@flowforge/api`) on port 4000 with health endpoint (`GET /api/v1/health`).
- Standalone background worker application (`@flowforge/worker`) foundation for future asynchronous workflow processing (BullMQ and Redis integrations will be added in subsequent milestones).
- Shared contracts package (`@flowforge/contracts`) defining framework-independent DTOs, public API interfaces, and Zod 4 runtime schemas.
- Basic workflow graph contracts (`WorkflowNodeTypeSchema`, `WorkflowNodeSchema`, `WorkflowEdgeSchema`, `WorkflowGraphSchema`, `WorkflowIdentifierSchema`) with exact identifier preservation and structural validation.
- Node-specific configuration schemas for all 7 approved V1 node kinds (`INPUT`, `TRANSFORM`, `CONDITION`, `LLM`, `MCP_TOOL`, `APPROVAL`, `OUTPUT`).
- Typed workflow node composition and discriminated union (`ConfiguredWorkflowNodeSchema`, `ConfiguredWorkflowNode`) uniting all seven fully configured node variants with strict schema validation, type narrowing, JSON serializability consistency, and complete preservation of draft compatibility.
- Workflow-level node configuration validation and editor-ready diagnostics (`validateNodeConfig`, `validateWorkflowNodeConfigs`, `formatValidationPath`) collecting all configuration issues across draft graphs without short-circuiting, preserving exact node IDs, indices, and structured error paths.
- Automated testing infrastructure across API (Vitest + Supertest + SWC metadata), worker (compiled process smoke testing), and shared contracts (Vitest runtime schema suites + compile-time type constraints).

## Repository Structure

```text
flowforge-ai/
├── apps/
│   ├── api/            # NestJS backend application (@flowforge/api, port 4000)
│   ├── web/            # Next.js frontend application (@flowforge/web, port 3000)
│   └── worker/         # Background worker process foundation (@flowforge/worker)
├── packages/           # Shared libraries and domain packages
│   └── contracts/      # Shared contracts & DTOs (@flowforge/contracts)
├── docs/               # Architecture documents and ADRs
│   └── adr/            # Architecture Decision Records
├── tests/              # Multi-package test suites
│   ├── integration/    # Integration test suites
│   ├── e2e/            # End-to-end test suites
│   └── load/           # Load and performance test suites
├── infra/              # Infrastructure definitions and deployment configurations
├── .github/            # GitHub configurations and workflow automations
│   └── workflows/
├── eslint.config.mjs   # Root ESLint flat configuration
├── package.json        # Monorepo root configuration and workspace scripts
├── pnpm-lock.yaml      # Pinned dependency lockfile (pnpm v12)
├── pnpm-workspace.yaml # pnpm workspace definitions
├── tsconfig.base.json  # Base compiler options for future apps and packages
├── turbo.json          # Turborepo task pipeline configuration
├── .editorconfig       # Multi-editor code formatting standards
├── .gitignore          # Git exclusion rules
├── .nvmrc              # Node.js runtime version pin (26.x)
├── .prettierignore     # Prettier exclusion rules
└── .prettierrc.json    # Prettier formatting configuration
```

## Prerequisites

- **Node.js**: `26.x` LTS (see `.nvmrc`)
- **pnpm**: `12.16.1`
- **Git**: `2.x`

## Root Quality Scripts

- `pnpm run lint:root`: Runs ESLint across root configuration and repository files.
- `pnpm run format`: Formats repository files using Prettier.
- `pnpm run format:check`: Validates formatting without modifying files.
- `pnpm run build`: Executes Turborepo build pipeline across workspace packages.
- `pnpm run typecheck`: Executes Turborepo typecheck pipeline across workspace packages.
- `pnpm run lint`: Executes Turborepo lint pipeline across workspace packages.
- `pnpm run test`: Executes Turborepo test pipeline across workspace packages.

## Worker Application

The `@flowforge/worker` package provides the standalone background execution runtime:

- **Build**: `pnpm --filter @flowforge/worker build`
- **Development**: `pnpm --filter @flowforge/worker dev` (native watch mode on Node.js 26)
- **Test**: `pnpm --filter @flowforge/worker test` (builds and executes automated process smoke testing with Vitest)
- **Production Startup Smoke Check**: `pnpm --filter @flowforge/worker start` (executes compiled `dist/main.js` and exits with code 0)

_Note_: The worker is currently in its foundation scaffold. BullMQ queues, Redis connections, and workflow task processors will be introduced in subsequent milestones.

## Shared Contracts Package

The `@flowforge/contracts` package provides framework-agnostic TypeScript contracts, data transfer objects (DTOs), and Zod runtime schemas shared across applications and packages:

- **Health Probe Contracts**: Framework-independent DTOs (`HealthResponse`).
- **Workflow Graph Schemas**: Zod runtime schemas and inferred TypeScript types (`WorkflowNodeTypeSchema`, `WorkflowNodeSchema`, `WorkflowEdgeSchema`, `WorkflowGraphSchema`, `WorkflowIdentifierSchema`) supporting both Node.js and browser environments.
  - _Structural Boundary_: Contracts perform strict structural validation of node types, exact identifiers, finite coordinates, and JSON-serializable configs. Graph-semantic validation (cycle detection, duplicate IDs, reachability, publishability) is decoupled and enforced by the graph engine in Phase 2.
- **Value Binding Primitives**: Reusable, discriminated data contracts for literal JSON values and explicit runtime references:
  - `LiteralBindingSchema` & `LiteralBinding`: Wraps arbitrary JSON-compatible values with strict rejection of undefined, functions, symbols, and non-JSON data.
  - `InputValueReferenceSchema` & `NodeOutputValueReferenceSchema`: Structured references targeting workflow trigger input fields or upstream node outputs with explicit path segment arrays (up to 16 segments, max 128 chars/segment). Completely avoids ambiguous dotted string notation, cleanly supporting dots and spaces in identifiers.
  - `ValueBindingSchema` & `ValueBinding`: Discriminated union on `type` (`'literal' | 'reference'`) providing compile-time type narrowing.
- **Node-Specific Configuration Schemas**: Standalone, strictly validated configuration schemas for workflow nodes:
  - `InputFieldTypeSchema`, `InputFieldDefinitionSchema`, `InputNodeConfigSchema` (Milestone 2A-B1a): Strictly typed input field definitions (`string`, `number`, `boolean`, `json`) with cross-field default-value type validation, zero-field INPUT support for parameterless triggers, and strict draft compatibility (`WorkflowNodeSchema` allows empty `{ config: {} }` during canvas drafting, while `InputNodeConfigSchema` validates typed input declarations).
  - `OutputNodeConfigSchema` (Milestone 2A-B1b): Strict output payload mapping contract binding output field identifiers (`WorkflowIdentifierSchema`) to structured `ValueBinding` definitions (1 to 50 fields). Terminal node status is decoupled and enforced by graph topology.
  - `TransformNodeConfigSchema` (Milestone 2A-B1c): Declarative transformation contract with 4 approved V1 operations via a discriminated union (`json_pick`, `json_set`, `template_string`, `math_op`). Enforces unique target keys (1 to 50 rules), explicit structured references, bounded static template text segments (max 5000 chars total), finite numeric arithmetic safeguards, and configuration-time division-by-zero rejection with zero arbitrary code execution.
  - `ConditionNodeConfigSchema` & `ConditionOutcomeSchema` (Milestone 2A-B2a): Condition predicate schemas supporting binary operators (`equals`, `not_equals`, `greater_than`, `less_than`, `greater_than_or_equal`, `less_than_or_equal`, `contains`, `not_contains`) requiring `left` and `right` value bindings, and unary operators (`is_empty`, `is_not_empty`, `is_null`, `is_not_null`) requiring only `left`. Explicit branch routing metadata (`conditionOutcome?: 'TRUE' | 'FALSE'`) is decoupled from node configuration and hosted on `WorkflowEdgeSchema` (strictly rejecting explicit `undefined`).
  - `LlmNodeConfigSchema` & `LlmPromptBindingSchema` (Milestone 2A-B2b): Provider-agnostic LLM configuration contract with required provider (1–50 chars), model (1–100 chars), and prompt binding (`LlmPromptLiteralBindingSchema` requiring non-empty string up to 10,000 chars or structured `ReferenceBindingSchema`). Includes optional generation parameters: `systemInstruction` (up to 5,000 chars), `temperature` (bounded 0–2), `maxTokens` (integer 1–16,384), and `responseFormat` (`'text' | 'json'`). Strictly rejects unknown properties (e.g. `apiKey`) and explicit `undefined`.
  - `McpToolNodeConfigSchema` (Milestone 2A-B2c): Framework-independent MCP tool configuration contract binding an opaque workspace integration reference (`WorkflowIdentifierSchema`, 1–128 chars) and external tool name (1–128 chars) to optional argument bindings (`Record<string, ValueBinding>`, max 50 entries, preserving punctuation in parameter names) and an optional execution timeout (`timeoutMs`, integer 500–300,000 ms). Strictly rejects unknown properties (e.g. `apiKey`, `serverUrl`), self-authorization bypasses, and explicit `undefined`.
  - `ApprovalNodeConfigSchema` (Milestone 2A-B2d): Human approval gate configuration contract requiring title (1–120 chars), explicit role policy (`roles: ApproverRole[]`, 1–3 unique entries from `'OWNER' | 'ADMIN' | 'MEMBER'`), execution timeout (`timeoutMinutes`, integer 1–10,080 minutes / 7 days), and timeout action (`'REJECT' | 'EXPIRE'`), with optional description (up to 1,000 chars). Strictly rejects self-authorization bypasses, runtime state fields, and explicit `undefined`.
- **Build**: `pnpm --filter @flowforge/contracts build` (outputs compiled ESM modules and declaration `.d.ts` files to `dist/`)
- **Typecheck**: `pnpm --filter @flowforge/contracts typecheck`
- **Test**: `pnpm --filter @flowforge/contracts test` (compiles declarations, runs compile-time type tests, and executes Vitest runtime schema tests)
- **Lint**: `pnpm --filter @flowforge/contracts lint`

### Monorepo Boundaries

Applications and worker processes in the monorepo must not directly import internal source files or implementations across application boundaries. All shared data types and contract definitions must reside in shared packages such as `@flowforge/contracts`. Downstream packages consume contracts through workspace dependencies (`@flowforge/contracts: workspace:*`) with Turborepo ensuring upstream declaration compilation precedes downstream typechecking and builds (`dependsOn: ["^build"]`).

## Automated Testing

Automated testing is configured using [Vitest](https://vitest.dev):

- **Run API Tests**: `pnpm --filter @flowforge/api test` (runs Vitest in non-watch mode across unit and e2e specs)
- **Run API E2E Tests**: `pnpm --filter @flowforge/api test:e2e`
- **Run Worker Smoke Tests**: `pnpm --filter @flowforge/worker test` (builds and executes compiled process smoke testing)
- **Run Contracts Tests**: `pnpm --filter @flowforge/contracts test` (compiles declarations, executes compile-time type tests, and runs Vitest runtime schema tests)
- **Monorepo Test Pipeline**: `pnpm run test` (executes Turborepo test task across configured packages with dependencies built first)

### Testing Approaches

- **API Integration Tests**: Instantiate the application via `Test.createTestingModule()` using Supertest against the NestJS HTTP adapter directly without binding to external TCP ports. TypeScript decorator metadata is preserved under NodeNext ESM via SWC (`unplugin-swc`). Neither PostgreSQL nor Redis is required at this stage.
- **Worker Process Smoke Tests**: Launch the compiled worker entrypoint (`dist/main.js`) via `child_process.execFile` with `process.execPath` to verify that the Node.js ESM runtime initializes cleanly, prints the scaffold diagnostic, and exits with code 0 without hanging. The worker currently has no queue processing functionality, and Redis, BullMQ, retries, and workflow execution are not yet implemented.
- **Shared Contracts Dual Testing**:
  - _Compile-Time Type Tests_: Uses native `tsc --noEmit -p tsconfig.test.json` with `@ts-expect-error` directives to verify contract shape, property requirements, and readonly constraints directly against the public package entrypoint.
  - _Runtime Schema Tests_: Uses Vitest (`packages/contracts/test/workflow-schema.spec.ts`) to validate positive parsing, structural data preservation, and negative rejections (unknown node kinds, empty/whitespace IDs, non-finite positions, non-JSON configs, extra keys).

## Continuous Integration

Automated continuous integration is defined in [`.github/workflows/ci.yml`](./.github/workflows/ci.yml) and executes on Ubuntu runners (`ubuntu-latest`) using Node.js 26 and pnpm 12.

### CI Workflow Triggers

- `push` to `main`
- `pull_request` targeting `main`
- Manual trigger via `workflow_dispatch`

### Executed Verification Pipeline

The single `quality-and-tests` job validates the entire engineering foundation with read-only repository permissions (`contents: read`):

1. **Frozen Dependency Installation**: `pnpm install --frozen-lockfile`
2. **Code Formatting Check**: `pnpm run format:check`
3. **Root ESLint Check**: `pnpm run lint:root`
4. **Workspace ESLint Check**: `pnpm run lint`
5. **Workspace Package Build**: `pnpm run build`
6. **Workspace Production Typecheck**: `pnpm run typecheck`
7. **Test Configuration Typechecks**:
   - `pnpm --filter @flowforge/api typecheck:test`
   - `pnpm --filter @flowforge/worker typecheck:test`
   - `pnpm --filter @flowforge/contracts typecheck:test`
8. **Automated Test Suite**: `pnpm run test` (API unit/e2e tests, worker process smoke test, contracts compile-time tests)

Developers can execute these exact commands locally in sequence to reproduce CI validation.

## Continuous Integration

Automated continuous integration is defined in [`.github/workflows/ci.yml`](./.github/workflows/ci.yml) and executes on Ubuntu runners (`ubuntu-latest`) using Node.js 26 and pnpm 12.

### CI Workflow Triggers

- `push` to `main`
- `pull_request` targeting `main`
- Manual trigger via `workflow_dispatch`

### Executed Verification Pipeline

The single `quality-and-tests` job validates the entire engineering foundation with read-only repository permissions (`contents: read`):

1. **Frozen Dependency Installation**: `pnpm install --frozen-lockfile`
2. **Code Formatting Check**: `pnpm run format:check`
3. **Root ESLint Check**: `pnpm run lint:root`
4. **Workspace ESLint Check**: `pnpm run lint`
5. **Workspace Package Build**: `pnpm run build`
6. **Workspace Production Typecheck**: `pnpm run typecheck`
7. **Test Configuration Typechecks**:
   - `pnpm --filter @flowforge/api typecheck:test`
   - `pnpm --filter @flowforge/worker typecheck:test`
   - `pnpm --filter @flowforge/contracts typecheck:test`
8. **Automated Test Suite**: `pnpm run test` (API unit/e2e tests, worker process smoke test, contracts compile-time tests)

Developers can execute these exact commands locally in sequence to reproduce CI validation.

## Architecture and Documentation

Detailed product requirements, architecture specifications, engineering decisions, and operational guides are maintained in the root documents and `/docs`:

- [Product Requirements Document (PRD.md)](./PRD.md): Authoritative product scope, user personas, core user journeys, functional requirements, and node specifications.
- [System Architecture Document (ARCHITECTURE.md)](./ARCHITECTURE.md): Architecture principles, current implemented baseline, target distributed execution model, data architecture, reliability, and security boundaries.
- [Technical Decision Register (TECHNICAL_DECISIONS.md)](./TECHNICAL_DECISIONS.md): Governance record and index of all approved and proposed technology and architectural choices.
- [Implementation & Development Plan (DEVELOPMENT_PLAN.md)](./DEVELOPMENT_PLAN.md): Implementation roadmap, Phase 1–4 execution breakdown, dependency critical path, and acceptance criteria.
- [Engineering Progress Log (DEVELOPMENT_LOG.md)](./DEVELOPMENT_LOG.md): Evidence-backed historical journal of completed, in-progress, and planned development milestones.
- [Changelog (CHANGELOG.md)](./CHANGELOG.md): Chronicle of repository modifications and unreleased foundation changes.
- [Architecture Decision Records (ADRs)](./docs/adr):
  - [ADR-0001: Monorepo and Application Boundaries](./docs/adr/0001-monorepo-and-application-boundaries.md)
  - [ADR-0002: Asynchronous API and Worker Separation](./docs/adr/0002-asynchronous-api-worker-separation.md)
  - [ADR-0003: DAG Workflows and Immutable Versions](./docs/adr/0003-dag-workflows-and-immutable-versions.md)
  - [ADR-0004: At-Least-Once Processing and Reliability](./docs/adr/0004-at-least-once-processing-and-reliability.md)
