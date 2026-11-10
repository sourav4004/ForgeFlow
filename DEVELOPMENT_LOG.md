# FlowForge AI — Engineering Progress Log

**Document Version**: 1.7.0\
**Current Milestone**: Phase 2B Complete (Awaiting Git Checkpoint) / Phase 2C (Upcoming)\
**Status**: ACTIVE LOG\
**Last Updated**: 2026-11-09

---

## 1. Purpose and Reporting Conventions

This engineering progress log serves as the authoritative, evidence-backed historical journal for FlowForge AI. Unlike forward-looking roadmaps ([`DEVELOPMENT_PLAN.md`](./DEVELOPMENT_PLAN.md)) or architectural designs ([`ARCHITECTURE.md`](./ARCHITECTURE.md)), this document records exclusively what has actually been implemented, verified, and discovered during development.

### Milestone Status Definitions

- **`COMPLETED`**: Deliverable implemented, validated against acceptance criteria with passing tests, and reviewed.
- **`IN PROGRESS`**: Active development or documentation underway; exit criteria not yet fully met.
- **`BLOCKED`**: Progress halted due to external dependency, technical impediment, or required architectural decision.
- **`DEFERRED`**: Milestone deliberately postponed to a later phase or cycle.
- **`NOT STARTED`**: Planned work pending completion of prerequisite milestones.

### Verification Evidence Hierarchy

To maintain technical integrity and prevent false assumptions, verification evidence is categorized explicitly. These categories are **never** treated as interchangeable:

1. **`[AGENT-LOCAL]`**: Automated tests, linting, typechecks, or builds executed locally by the AI agent within the active development shell.
2. **`[DEV-LOCAL]`**: Independent commands, builds, or scripts manually executed by the human developer on their host machine.
3. **`[REMOTE-CI]`**: Automated workflows executed on remote GitHub Actions runners triggered by git events. _(Note: Pending first repository push)._
4. **`[MANUAL-BROWSER]`**: Visual UI checks, interactive network inspection, or manual walkthrough in a local browser runtime.

---

## 2. Completed Milestone History

### Milestone 1A — Repository and Monorepo Foundation

- **Status**: `COMPLETED`
- **Scope**: Initialize repository structure, workspace orchestration, and runtime version pin.
- **Files / Packages**:
  - `package.json` (root pnpm workspace config, private: true)
  - `pnpm-workspace.yaml` (defining `apps/*` and `packages/*`)
  - `turbo.json` (Turborepo 2.11.10 pipeline orchestration)
  - `.nvmrc` (pinned to Node.js 26)
  - `.gitignore`, `.editorconfig`
- **Verification**: `[AGENT-LOCAL]`
  - Verified Node.js `v26.12.1` and pnpm `12.16.1`.
  - Workspace resolution confirmed across `apps` and `packages`.
- **Known Limitations**: Baseline repository scaffolding only; no applications, packages, or CI configured.
- **Commit Status**: Preserved in git repository state (developer-controlled commits).

---

### Milestone 1B — Shared TypeScript, ESLint, and Prettier Tooling

- **Status**: `COMPLETED`
- **Scope**: Establish strict monorepo-wide code quality, formatting, and compiler settings.
- **Files / Packages**:
  - `tsconfig.base.json` (TypeScript 6.0.3 base with `strict: true`, modern ES target, node module resolution)
  - `eslint.config.mjs` (flat ESLint 10.14.0 configuration with `@eslint/js`, `typescript-eslint`, React/Next rules)
  - `.prettierrc.json`, `.prettierignore` (consistent formatting across Markdown, JSON, TS, and CSS)
- **Verification**: `[AGENT-LOCAL]`
  - `pnpm run lint:root` passed with 0 errors.
  - `pnpm run format:check` validated all configuration files.
- **Known Limitations**: Tooling configured at repository root; per-application extension configs created during respective scaffolding milestones.
- **Commit Status**: Preserved in git repository state.

---

### Milestone 1C-A — Next.js Frontend Application Scaffold

- **Status**: `COMPLETED`
- **Scope**: Scaffold modern web application for future visual DAG workflow editor.
- **Files / Packages**:
  - `apps/web/package.json` (`@flowforge/web`, Next.js 16.4.5, React 19.3.1)
  - `apps/web/src/app/*` (App Router layout, placeholder landing page, global CSS)
  - `apps/web/tsconfig.json` (extends `tsconfig.base.json` with Next.js plugin)
  - `apps/web/eslint.config.mjs` (extends root ESLint rules with Next-specific configs)
- **Verification**: `[AGENT-LOCAL]`
  - `pnpm --filter @flowforge/web build` passed with standalone output.
  - `pnpm --filter @flowforge/web lint` passed with 0 warnings.
  - `pnpm --filter @flowforge/web typecheck` completed with zero TypeScript errors.
- **Known Limitations**: Static landing page placeholder only; React Flow visual canvas and execution controls deferred to Phase 4.
- **Commit Status**: Preserved in git repository state.

---

### Milestone 1C-B — NestJS API Application Scaffold

- **Status**: `COMPLETED`
- **Scope**: Scaffold backend HTTP API service and initial health probe endpoint.
- **Files / Packages**:
  - `apps/api/package.json` (`@flowforge/api`, NestJS 12.3.2, `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`, `reflect-metadata`)
  - `apps/api/src/main.ts` (API entrypoint listening on port 4000, global `/api/v1` prefix)
  - `apps/api/src/app.module.ts` (root application module)
  - `apps/api/src/modules/health/*` (`HealthController`, `HealthService` returning system status)
  - `apps/api/tsconfig.json`, `apps/api/tsconfig.build.json`, `apps/api/nest-cli.json`
- **Verification**: `[AGENT-LOCAL]`
  - `pnpm --filter @flowforge/api build` passed via standard NestJS CLI compiler (@nestjs/cli).
  - `pnpm --filter @flowforge/api lint` passed with 0 errors.
  - `pnpm --filter @flowforge/api typecheck` passed cleanly.
- **Known Limitations**: Health check returns in-memory synthetic payload; PostgreSQL database connections and Redis queue connections not yet implemented.
- **Commit Status**: Changes staged in git index by developer.

---

### Milestone 1C-C — Standalone Background Worker Foundation

- **Status**: `COMPLETED`
- **Scope**: Scaffold independent Node.js background process isolated from API process.
- **Files / Packages**:
  - `apps/worker/package.json` (`@flowforge/worker`, standalone Node.js process)
  - `apps/worker/src/main.ts` (Process entrypoint logging startup diagnostic and exiting cleanly with code 0)
  - `apps/worker/tsconfig.json`, `apps/worker/tsconfig.build.json`
- **Verification**: `[AGENT-LOCAL]`
  - `pnpm --filter @flowforge/worker build` built Node.js execution target cleanly.
  - `pnpm --filter @flowforge/worker lint` passed with 0 errors.
  - `pnpm --filter @flowforge/worker typecheck` passed with 0 errors.
- **Known Limitations**: Worker executes a minimal scaffold diagnostic rather than an active queue consumer; BullMQ integration, job consumption, and signal-driven graceful shutdown deferred to Phase 3.
- **Commit Status**: Preserved in git repository state.

---

### Milestone 1D — Shared Contracts Package Boundaries

- **Status**: `COMPLETED`
- **Scope**: Establish `@flowforge/contracts` workspace package to eliminate direct coupling between API, worker, and web frontend.
- **Files / Packages**:
  - `packages/contracts/package.json` (`@flowforge/contracts`, pure ESM package with NodeNext module resolution and declaration maps)
  - `packages/contracts/src/health/*` (`HealthResponse`, `HealthStatus`, `ServiceHealth` type contracts)
  - `packages/contracts/src/index.ts` (clean public barrel exports)
  - `apps/api`, `apps/worker`, `apps/web` updated to reference `@flowforge/contracts: workspace:*`
- **Verification**: `[AGENT-LOCAL]`
  - `pnpm --filter @flowforge/contracts build` generated `.d.ts` and ESM dist outputs.
  - `apps/api` successfully imports and returns typed `HealthResponse` from `@flowforge/contracts`.
  - Turborepo task graph correctly enforced `^build` compilation order.
- **Known Limitations**: Contracts package currently defines only health contracts; workflow definitions, DAG schemas, and execution event contracts deferred to Phase 2.
- **Commit Status**: Preserved in git repository state.

---

### Milestone 1E-A — NestJS API Automated Testing Infrastructure

- **Status**: `COMPLETED`
- **Scope**: Establish automated integration and dependency injection testing for NestJS API.
- **Files / Packages**:
  - `apps/api/package.json` (integrated Vitest, Supertest, `@swc/core`)
  - `apps/api/vitest.config.ts` (SWC plugin via `unplugin-swc` enabling decorator metadata reflection in Vitest tests)
  - `apps/api/test/health.e2e-spec.ts` (Supertest end-to-end integration test against `/api/v1/health`)
  - `apps/api/test/dependency-injection.spec.ts` (NestJS DI container reflection test)
  - `pnpm-workspace.yaml` (approved `@swc/core` native package build in pnpm 12)
- **Verification**: `[AGENT-LOCAL]`
  - `pnpm --filter @flowforge/api test` executed 2 test files, 4 tests passed in ~3.5s.
- **Known Limitations**: Tests exercise in-memory modules; real database integration tests pending Phase 2.
- **Commit Status**: Preserved in git repository state.

---

### Milestone 1E-B1 — Standalone Worker Process Testing

- **Status**: `COMPLETED`
- **Scope**: Implement automated process lifecycle and signal handling tests for background worker.
- **Files / Packages**:
  - `apps/worker/vitest.config.ts` (Vitest test configuration)
  - `apps/worker/test/worker-process.spec.ts` (Spawns worker child process via `child_process.execFile`, verifies startup diagnostic message in stdout, and asserts clean exit code 0)
- **Verification**: `[AGENT-LOCAL]`
  - `pnpm --filter @flowforge/worker test` executed 1 test file, 1 test passed in ~780ms.
- **Known Limitations**: Verifies process execution and clean exit code 0 only; does not test BullMQ queue polling, distributed lock acquisition, or graceful signal handling.
- **Commit Status**: Preserved in git repository state.

---

### Milestone 1E-B2 — Shared Contracts Compile-Time Verification

- **Status**: `COMPLETED`
- **Scope**: Implement compile-time type verification for shared contract types.
- **Files / Packages**:
  - `packages/contracts/tsconfig.test.json` (test TypeScript configuration with `noEmit: true`)
  - `packages/contracts/test/health-response.type-test.ts` (validates type assignability and rejects invalid enum/structural shapes via `@ts-expect-error`)
  - `packages/contracts/package.json` (added `typecheck:test` and `test` scripts)
- **Verification**: `[AGENT-LOCAL]`
  - `pnpm --filter @flowforge/contracts test` (`pnpm run build && pnpm run typecheck:test`) succeeded with 0 errors.
- **Known Limitations**: Compile-time verification only; runtime payload validation (Zod schemas) deferred to Phase 2.
- **Commit Status**: Preserved in git repository state.

---

### Milestone 1E-C — Monorepo Testing Infrastructure Audit

- **Status**: `COMPLETED`
- **Scope**: Perform comprehensive repository-wide audit of all testing configurations, scripts, and Turborepo pipeline caching.
- **Files / Packages**:
  - Monorepo root `package.json`, `turbo.json`, package vitest configs
  - `packages/contracts/tsconfig.test.json` (Prettier whitespace normalized)
- **Verification**: `[AGENT-LOCAL]`
  - Executed full test pipeline across 4 workspace packages:
    - `pnpm run lint:root` -> passed
    - `pnpm run lint` -> 4 successful tasks
    - `pnpm run typecheck` -> 5 successful tasks
    - `pnpm run build` -> 5 successful tasks
    - `pnpm run test` -> 4 successful tasks (API: 4 tests passed, Worker: 1 test passed, Contracts: typecheck passed)
- **Known Limitations**: Verification completed in local environment; remote CI execution pending repository push to GitHub.
- **Commit Status**: Preserved in git repository state.

---

### Milestone 1F-A — Product Requirements & System Architecture Documentation

- **Status**: `COMPLETED`
- **Scope**: Author comprehensive product requirements and architectural blueprints.
- **Files / Packages**:
  - `PRD.md` (Product vision, user personas, MVP scope, flagship PR review workflow, functional/non-functional requirements)
  - `ARCHITECTURE.md` (System topology, execution state machine, transactional outbox pattern, failure domains)
  - `README.md` (updated with documentation navigation links)
- **Verification**: `[AGENT-LOCAL]`
  - Verified Markdown links across all documents.
  - Formatted with Prettier (`pnpm run format:check`).
  - Ran monorepo lint and typecheck regression checks with zero errors.
- **Known Limitations**: Documentation represents architectural blueprint; application feature implementation remains for subsequent phases.
- **Commit Status**: Preserved in git repository state.

---

### Milestone 1F-B1 — Technical Decision Register & Architecture Decision Records

- **Status**: `COMPLETED`
- **Scope**: Author centralized technical decision register and 4 foundational Architecture Decision Records (ADRs).
- **Files / Packages**:
  - `TECHNICAL_DECISIONS.md` (Centralized decision register with 16 tracked technology and architectural decisions)
  - `docs/adr/0001-monorepo-and-application-boundaries.md` (ADR-0001: Monorepo boundaries)
  - `docs/adr/0002-asynchronous-api-worker-separation.md` (ADR-0002: Async API/worker separation)
  - `docs/adr/0003-dag-workflows-and-immutable-versions.md` (ADR-0003: Immutable DAG workflows)
  - `docs/adr/0004-at-least-once-processing-and-reliability.md` (ADR-0004: At-least-once processing & reliability)
  - `PRD.md`, `ARCHITECTURE.md` (refined for transactional outbox vs Redis Pub/Sub, conditional DAG execution, candidate infra versions, workflow reproducibility boundaries)
  - `README.md` (updated to index decision register and ADRs)
- **Verification**: `[AGENT-LOCAL]`
  - Verified internal Markdown links and ADR references.
  - Prettier formatting validated.
  - Full regression checks passed (`lint:root`, `lint`, `typecheck`, `build`, `test`).
- **Known Limitations**: Documents record architectural decisions as `ACCEPTED`; implementation of persistence, queues, and workflows remains pending.
- **Commit Status**: Preserved in git repository state.

---

---

### Milestone 1F-B2 & 1F-B2-FIX — Development Plan, Engineering Progress Log, Changelog, and Accuracy Remediation

- **Status**: `COMPLETED`
- **Scope**: Author comprehensive implementation plan, evidence-based development log, repository changelog, governance index, and execute Milestone 1F-B2-FIX documentation accuracy corrections.
- **Accuracy Corrections**:
  - Corrected tooling versions to match actual manifests: TypeScript 6.0.3, ESLint 10.14.0, Next.js 16.4.5, React 19.3.1, NestJS 12.3.2, Vitest 5.1.0.
  - Clarified NestJS build compiler as `@nestjs/cli` (`tsc`) while identifying SWC (`unplugin-swc`) strictly as the Vitest test transformer for decorator metadata reflection.
  - Corrected background worker description: documented actual behavior as a standalone diagnostic entrypoint exiting cleanly with code 0; removed premature graceful-shutdown and heartbeat claims (deferred to Phase 3 BullMQ milestone).
  - Corrected contracts package description: confirmed pure ESM package (`NodeNext`) with generated TypeScript declaration files; removed inaccurate dual ESM/CJS claims.
- **Files Created / Modified**:
  - `DEVELOPMENT_PLAN.md` (Created: Roadmap, Phase 1-4 breakdown, acceptance criteria, critical path, risks)
  - `DEVELOPMENT_LOG.md` (Created / Corrected: Verification evidence hierarchy, historical milestone log, progress template)
  - `CHANGELOG.md` (Created / Corrected: Keep a Changelog format tracking unreleased foundation additions, changes, and fixes)
  - `README.md` (Modified: Linked new governance and planning documents)
- **Verification**: `[AGENT-LOCAL]`
  - Markdown link resolution: 100% of relative links verified on disk with zero errors.
  - Prettier formatting: `pnpm exec prettier --write` executed; `pnpm run format:check` confirmed 100% compliance.
  - Git whitespace diff: `git diff --check` exited with code 0 (no whitespace errors).
  - Monorepo regression suite:
    - `pnpm run lint:root` -> passed with exit code 0
    - `pnpm run lint` -> 4 successful tasks (exit code 0)
    - `pnpm run typecheck` -> 5 successful tasks (exit code 0)
    - `pnpm run build` -> 4 successful tasks (exit code 0)
    - `pnpm run test` -> 4 successful tasks (exit code 0; 4 API tests, 1 worker test, contracts type tests)
- **Known Limitations**: Verified locally in agent environment; remote CI pipeline configuration pending Milestone 1G.
- **Commit Status**: Preserved in working tree (developer-controlled commits).

---

### Milestone 1G — GitHub Actions Continuous Integration Foundation

- **Status**: `COMPLETED`
- **Scope**: Author `.github/workflows/ci.yml` defining deterministic automated quality and test pipeline on `ubuntu-latest` with Node.js 26 and pnpm 12.
- **Workflow Architecture**:
  - Triggers: `push` (to `main`), `pull_request` (targeting `main`), and manual `workflow_dispatch`.
  - Permissions: Strict least-privilege `contents: read` (no write permissions, zero secrets).
  - Actions: `actions/checkout@v7` (with `persist-credentials: false`), `pnpm/action-setup@v6` (version from `package.json`), `actions/setup-node@v7` (pinned via `.nvmrc` Node 26 with `cache: 'pnpm'`).
  - Single Job: `quality-and-tests` on `ubuntu-latest` with `timeout-minutes: 20`.
- **Verification**: `[AGENT-LOCAL]` / `[REMOTE-CI]`
  - Local verification executed all 10 pipeline steps cleanly.
  - Remote CI executed on GitHub Actions upon push and passed.
- **Commit Status**: Committed in `ab5ca64` and pushed to GitHub.

---

### Milestone 1H — Final Phase 1 Verification and Developer-Controlled Commit

- **Status**: `COMPLETED`
- **Scope**: Final read-only engineering foundation audit, formatting normalization, developer-controlled staging, commit creation, and push.
- **Commit Details**: Commit `ab5ca64 feat: complete phase 1 engineering foundation` on branch `main`.

---

## 3. Current Milestone

### Milestone 2A-A — Basic Workflow Graph Contracts and Zod Runtime Schemas

- **Status**: `COMPLETED`
- **Scope**: Extend `@flowforge/contracts` with framework-independent Zod 4 runtime schemas and inferred TypeScript types for basic workflow graphs.
- **Dependencies Added**:
  - `zod@4.6.7` (production dependency in `@flowforge/contracts`)
  - `vitest@5.1.0` (development dependency in `@flowforge/contracts`)
- **Deliverables**:
  - `WorkflowNodeTypeSchema` & `WorkflowNodeType`: Enum of 7 approved V1 node kinds (`INPUT`, `TRANSFORM`, `CONDITION`, `LLM`, `MCP_TOOL`, `APPROVAL`, `OUTPUT`).
  - `WorkflowIdentifierSchema` & `WorkflowIdentifier`: Strict 1–128 character identifier validating non-empty, non-whitespace strings while strictly preserving identity without silent trimming or mutation.
  - `WorkflowNodeSchema` & `WorkflowNode`: Validates `id`, `type`, `position` (finite `x`, `y` numbers), and `config` (`z.record(z.string(), z.json())`) with `.strict()`.
  - `WorkflowEdgeSchema` & `WorkflowEdge`: Validates `id`, `source`, `target` with `.strict()`.
  - `WorkflowGraphSchema` & `WorkflowGraph`: Validates `{ nodes, edges }` with `.strict()`, supporting empty graphs as draft canvases.
  - Public exports in `@flowforge/contracts/src/index.ts`.
- **Architectural Boundary**: Enforces strict structural schema validation only. Cycle detection, duplicate ID checking, reachability, and publishability are decoupled and deferred to Phase 2 graph core.
- **Verification**: `[AGENT-LOCAL]`
  - 29 Vitest runtime schema tests passed (positive parsing, data preservation, negative rejections, structural vs. semantic boundaries).
  - Existing compile-time type tests (`health-response.type-test.ts`) verified via `tsc --noEmit -p tsconfig.test.json`.
  - Clean-build verified: deleting `packages/contracts/dist` and executing `pnpm test` successfully rebuilds ESM declarations and passes all tests.
  - Negative test mutation verified: intentional test failure logged visible diff with nonzero exit code.
  - Monorepo regression passed cleanly across API, worker, web, and root.
- **Commit Status**: Preserved in working tree (developer-controlled commits).

### Milestone 2A-B1a — INPUT Node Configuration Schema and Validation Tests

- **Status**: `COMPLETED`
- **Scope**: Implement standalone, strict Zod runtime configuration schema and inferred TypeScript types for the `INPUT` workflow node in `@flowforge/contracts`.
- **Files Created**:
  - `packages/contracts/src/workflow/node-configs/input-config.ts`
  - `packages/contracts/test/input-config.spec.ts`
- **Files Modified**:
  - `packages/contracts/src/index.ts` (public barrel exports)
- **Deliverables**:
  - `InputFieldTypeSchema` & `InputFieldType`: Enum of 4 approved V1 field types (`string`, `number`, `boolean`, `json`).
  - `InputFieldDefinitionSchema` & `InputFieldDefinition`: Strict definition requiring `name` (`WorkflowIdentifierSchema`), `type` (`InputFieldTypeSchema`), `required` (`boolean`), optional `description` (max 500 chars), and optional `defaultValue` (`z.json()`).
  - Strict Default-Value Type Compatibility: Custom `.superRefine` validating that if `defaultValue` is present, it matches the declared field type (e.g., string for `string`, finite number for `number`, boolean for `boolean`, valid JSON for `json`), rejecting non-finite numbers (`NaN`, `Infinity`), non-JSON values, and explicit `undefined`.
  - `InputNodeConfigSchema` & `InputNodeConfig`: Strict object requiring `fields` array (0 to 50 items), with `.superRefine` enforcing exact unique field names without silent mutation or normalization. Zero-field configurations (`fields: []`) are supported for parameterless triggers.
  - Draft Compatibility: Preserved structural `WorkflowNodeSchema` allowing empty `{ config: {} }` during canvas drafting, while `InputNodeConfigSchema` strictly validates typed input configurations.
- **Verification**: `[AGENT-LOCAL]`
  - 29 Vitest runtime tests in `test/input-config.spec.ts` passing (8 positive, 16 negative, 4 boundary/draft compatibility, and compile-time type inference checks).
  - 29 existing Vitest tests in `test/workflow-schema.spec.ts` continue passing without modification (58 total tests in contracts).
  - TypeScript test typecheck (`typecheck:test`) and build clean.
  - Full monorepo verification: `format:check`, `lint:root`, `lint`, `typecheck`, `build`, and `test` (63 total tests across api, worker, and contracts) all passing with exit code 0.
- **Commit Status**: Preserved in working tree (developer-controlled commits).

### Milestone 2A-B1b — Value Bindings and OUTPUT Node Configuration

- **Status**: `COMPLETED`
- **Scope**: Extend `@flowforge/contracts` with reusable, explicit value binding schemas (`LiteralBindingSchema`, `InputValueReferenceSchema`, `NodeOutputValueReferenceSchema`, `ValueReferenceSchema`, `ReferenceBindingSchema`, `ValueBindingSchema`) and the strict `OutputNodeConfigSchema`.
- **Files Created**:
  - `packages/contracts/src/workflow/primitives/value-binding.ts`
  - `packages/contracts/src/workflow/node-configs/output-config.ts`
  - `packages/contracts/test/value-binding.spec.ts`
  - `packages/contracts/test/output-config.spec.ts`
- **Files Modified**:
  - `packages/contracts/src/index.ts` (public exports)
  - `README.md`
  - `DEVELOPMENT_PLAN.md`
  - `CHANGELOG.md`
- **Deliverables**:
  - `PropertyPathSegmentSchema`: Bounded string (1–128 chars) validating path segments while preserving exact text, dots, spaces, and punctuation.
  - `LiteralBindingSchema` & `LiteralBinding`: Strictly validates JSON values, rejecting undefined, functions, symbols, BigInt, and extra keys. Preserves literal string templates (e.g. `"{{input.value}}"`) without automatic interpolation.
  - `InputValueReferenceSchema` & `InputValueReference`: Explicit reference with `source: 'input'`, `field: WorkflowIdentifier`, and bounded `path: string[]` (max 16 segments). Empty array targets whole input field.
  - `NodeOutputValueReferenceSchema` & `NodeOutputValueReference`: Explicit reference with `source: 'node_output'`, `nodeId: WorkflowIdentifier`, and bounded `path: string[]` (max 16 segments). Avoids ambiguous dotted notation; node IDs containing dots remain intact without string splitting.
  - `ValueBindingSchema` & `ValueBinding`: Discriminated union on `type` (`'literal' | 'reference'`) with strict compile-time discriminator narrowing.
  - `OutputNodeConfigSchema` & `OutputNodeConfig`: Strict object requiring `payloadMapping: Record<WorkflowIdentifier, ValueBinding>` (1 to 50 fields). Terminal behavior decoupled from schema (enforced by graph topology).
  - Draft Compatibility: Preserved structural `WorkflowNodeSchema` allowing empty `{ config: {} }` during canvas drafting, while `OutputNodeConfigSchema` strictly validates typed output configurations.
- **Verification**: `[AGENT-LOCAL]`
  - 31 Vitest runtime tests in `test/value-binding.spec.ts` passing (positive literal/reference parsing, data preservation, negative rejections, compile-time narrowing).
  - 18 Vitest runtime tests in `test/output-config.spec.ts` passing (literal/reference/mixed mappings, key preservation, size limits, negative structural failures, boundary draft compatibility).
  - 58 existing Vitest tests (`test/workflow-schema.spec.ts` and `test/input-config.spec.ts`) continue passing without modification (107 total tests in contracts).
  - Clean-build verified: deleting `packages/contracts/dist` and executing `pnpm test` successfully rebuilds ESM declarations and passes all 107 tests.
  - Full monorepo verification: `format:check`, `lint:root`, `lint`, `typecheck`, `turbo run build --force`, and `turbo run test --force` (112 total tests across api, worker, and contracts) all passing with exit code 0.
- **Commit Status**: Preserved in working tree (developer-controlled commits).

### Milestone 2A-B1c — Declarative TRANSFORM Node Configuration Schemas

- **Status**: `COMPLETED`
- **Scope**: Extend `@flowforge/contracts` with standalone, strict declarative transformation schemas supporting 4 approved V1 operations (`json_pick`, `json_set`, `template_string`, `math_op`) via Zod discriminated unions.
- **Files Created**:
  - `packages/contracts/src/workflow/node-configs/transform-config.ts`
  - `packages/contracts/test/transform-config.spec.ts`
- **Files Modified**:
  - `packages/contracts/src/index.ts` (public exports)
  - `README.md`
  - `DEVELOPMENT_PLAN.md`
  - `CHANGELOG.md`
- **Deliverables**:
  - `JsonPickTransformRuleSchema` & `JsonPickTransformRule`: Extracts data from `ValueReference` into `targetKey`, with optional JSON `fallbackValue` (strictly rejecting explicit `undefined`).
  - `JsonSetTransformRuleSchema` & `JsonSetTransformRule`: Assigns explicit `ValueBinding` to `targetKey` without mutation of upstream data.
  - `TemplateTextSegmentSchema`, `TemplateReferenceSegmentSchema`, `TemplateSegmentSchema`: Declarative template segment building blocks (1 to 100 segments, max 5000 chars total static text) avoiding ambiguous dotted string splitting.
  - `TemplateStringTransformRuleSchema` & `TemplateStringTransformRule`: Ordered concatenation of text and reference segments with exact authored whitespace/casing preservation.
  - `MathOperatorSchema`, `MathOpTransformRuleSchema` & `MathOpTransformRule`: Bounded binary arithmetic (`add`, `subtract`, `multiply`, `divide`) enforcing finite numbers on literal operands and rejecting division by zero at configuration validation time.
  - `TransformRuleSchema`: Discriminated union on `operation` enabling precise compile-time TypeScript narrowing.
  - `TransformNodeConfigSchema` & `TransformNodeConfig`: Strict object requiring 1 to 50 transform rules with `.superRefine` enforcing unique `targetKey` names across rules (`rules[index].targetKey`).
  - Draft Compatibility: Preserved structural `WorkflowNodeSchema` allowing empty `{ config: {} }` during canvas drafting, while `TransformNodeConfigSchema` strictly validates typed transform configurations.
- **Verification**: `[AGENT-LOCAL]`
  - 43 Vitest runtime tests in `test/transform-config.spec.ts` passing (positive operation parsing, data preservation, negative rejections, compile-time narrowing, boundary draft compatibility).
  - 107 existing Vitest tests (`test/workflow-schema.spec.ts`, `test/input-config.spec.ts`, `test/value-binding.spec.ts`, `test/output-config.spec.ts`) continue passing without modification (150 total tests in contracts).
  - Clean-build verified: deleting `packages/contracts/dist` and executing `pnpm test` successfully rebuilds ESM declarations and passes all 150 tests.
  - Full monorepo verification: `format:check`, `lint:root`, `lint`, `typecheck`, `turbo run build --force`, and `turbo run test --force` (155 total tests across api, worker, and contracts) all passing with exit code 0.
- **Commit Status**: Preserved in working tree (developer-controlled commits).

---

### Milestone 2A-B2a — CONDITION Configuration and Explicit Branch Metadata

- **Date**: 2026-11-04
- **Status**: `COMPLETED`
- **Scope**: Extend `@flowforge/contracts` with standalone, strict configuration schemas for the `CONDITION` node and explicit branch routing metadata on `WorkflowEdgeSchema`.
- **Files Created**:
  - `packages/contracts/src/workflow/node-configs/condition-config.ts`
  - `packages/contracts/test/condition-config.spec.ts`
  - `packages/contracts/test/condition-edge.spec.ts`
- **Files Modified**:
  - `packages/contracts/src/workflow/workflow-edge.ts` (added `ConditionOutcomeSchema`, `conditionOutcome?: ConditionOutcomeSchema`, `.superRefine` rejecting explicit `undefined`)
  - `packages/contracts/src/index.ts` (public exports)
  - `README.md`
  - `DEVELOPMENT_PLAN.md`
  - `CHANGELOG.md`
- **Deliverables**:
  - `BinaryConditionOperatorSchema` & `BinaryConditionOperator`: 8 approved binary comparison operators (`equals`, `not_equals`, `greater_than`, `less_than`, `greater_than_or_equal`, `less_than_or_equal`, `contains`, `not_contains`).
  - `BinaryConditionConfigSchema` & `BinaryConditionConfig`: Binary predicate requiring both `left` and `right` operands as `ValueBindingSchema`.
  - `UnaryConditionOperatorSchema` & `UnaryConditionOperator`: 4 approved unary comparison operators (`is_empty`, `is_not_empty`, `is_null`, `is_not_null`).
  - `UnaryConditionConfigSchema` & `UnaryConditionConfig`: Unary predicate requiring `left` as `ValueBindingSchema` and strictly forbidding `right` via `.strict()`.
  - `ConditionNodeConfigSchema` & `ConditionNodeConfig`: Discriminated union of binary and unary configurations enabling exact compile-time TypeScript narrowing.
  - `ConditionOutcomeSchema` & `ConditionOutcome`: Explicit domain enum (`'TRUE' | 'FALSE'`).
  - `WorkflowEdgeSchema` Extension: Added optional `conditionOutcome?: ConditionOutcomeSchema` with `.superRefine` rejecting explicit `undefined`, strictly separating edge routing targets from condition node configuration.
  - Schema Boundaries & Draft Compatibility: `WorkflowNodeSchema` permits draft CONDITION nodes with `{ config: {} }`, while `ConditionNodeConfigSchema` enforces complete predicate definitions. Edge counts and dangling reference validations are decoupled and reserved for graph analysis algorithms.
- **Verification**: `[AGENT-LOCAL]`
  - 31 Vitest runtime tests in `test/condition-config.spec.ts` passing (positive operator tests, literal preservation, negative rejections, compile-time narrowing, boundary draft compatibility).
  - 14 Vitest runtime tests in `test/condition-edge.spec.ts` passing (standard edges, TRUE/FALSE edges, explicit undefined rejections, boundary graph integration).
  - 150 existing Vitest tests continue passing without modification (195 total tests in contracts).
  - Clean-build verified: deleting `packages/contracts/dist` and executing `pnpm test` successfully rebuilds ESM declarations and passes all 195 tests.
  - Full monorepo verification: `format:check`, `lint:root`, `lint`, `typecheck`, `turbo run build --force`, and `turbo run test --force` (200 total tests across api, worker, and contracts) all passing with exit code 0.
- **Commit Status**: Preserved in working tree (developer-controlled commits).

---

### Milestone 2A-B2b — LLM Node Configuration Schema and Validation Tests

- **Date**: 2026-11-04
- **Status**: `COMPLETED`
- **Scope**: Extend `@flowforge/contracts` with standalone, strict configuration schemas for the `LLM` workflow node, string-only prompt literal binding, prompt discriminated union, and optional generation parameters.
- **Files Created**:
  - `packages/contracts/src/workflow/node-configs/llm-config.ts`
  - `packages/contracts/test/llm-config.spec.ts`
- **Files Modified**:
  - `packages/contracts/src/index.ts` (public exports)
  - `README.md`
  - `DEVELOPMENT_PLAN.md`
  - `CHANGELOG.md`
- **Deliverables**:
  - `LlmPromptLiteralBindingSchema` & `LlmPromptLiteralBinding`: Requires string-only prompt literal (`type: 'literal'`, `value: string`, 1–10,000 characters, non-whitespace-only) strictly rejecting non-string JSON values, numbers, and nulls.
  - `LlmPromptBindingSchema` & `LlmPromptBinding`: Discriminated union of `LlmPromptLiteralBindingSchema` and existing `ReferenceBindingSchema`, enabling compile-time TypeScript narrowing.
  - `LlmResponseFormatSchema` & `LlmResponseFormat`: Approved V1 response format modes (`'text' | 'json'`).
  - `LlmNodeConfigSchema` & `LlmNodeConfig`: Strict object schema requiring provider (1–50 chars, reject whitespace-only), model (1–100 chars, reject whitespace-only, preserves punctuation), and prompt binding.
  - Optional Generation Parameters: `systemInstruction` (1–5,000 chars, reject whitespace-only), `temperature` (bounded finite number 0–2), `maxTokens` (integer 1–16,384), and `responseFormat`.
  - Strict Security & Serialization Boundaries: Rejects unknown properties (e.g. `apiKey`, `clientSecret`, `baseUrl`) and explicitly present `undefined` optional fields via `.superRefine`. Zero embedded credentials, zero hardcoded vendor enums, and zero assumptions about vendor APIs.
  - Draft Compatibility: Preserved structural `WorkflowNodeSchema` allowing `{ config: {} }` during canvas drafting, while `LlmNodeConfigSchema` strictly validates declared configurations for execution readiness.
- **Verification**: `[AGENT-LOCAL]`
  - 50 Vitest runtime tests in `test/llm-config.spec.ts` passing (positive configurations, multiline prompt preservation, punctuation retention, negative rejections, credential rejections, boundary draft compatibility, and compile-time narrowing).
  - 195 existing Vitest tests continue passing without modification (245 total tests in contracts).
  - Clean-build verified: deleting `packages/contracts/dist` and executing `pnpm test` successfully rebuilds ESM declarations and passes all 245 tests.
  - Full monorepo verification: `format:check`, `lint:root`, `lint`, `typecheck`, `turbo run build --force`, and `turbo run test --force` (250 total tests across api, worker, and contracts) all passing with exit code 0.
- **Commit Status**: Preserved in working tree (developer-controlled commits).

---

### Milestone 2A-B2c — MCP_TOOL Node Configuration Schema and Validation Tests

- **Date**: 2026-11-04
- **Status**: `COMPLETED`
- **Scope**: Extend `@flowforge/contracts` with standalone, strict configuration schemas for the `MCP_TOOL` workflow node, tool argument mappings, and execution timeout parameters.
- **Files Created**:
  - `packages/contracts/src/workflow/node-configs/mcp-tool-config.ts`
  - `packages/contracts/test/mcp-tool-config.spec.ts`
- **Files Modified**:
  - `packages/contracts/src/index.ts` (public exports)
  - `README.md`
  - `DEVELOPMENT_PLAN.md`
  - `CHANGELOG.md`
- **Deliverables**:
  - `McpToolNameSchema` & `McpToolName`: Validates external tool names (1–128 chars, non-whitespace-only) allowing standard tool punctuation (`_`, `-`, `/`, `.`, `@`).
  - `McpToolArgumentNameSchema` & `McpToolArgumentName`: Validates external tool parameter names (1–128 chars, non-whitespace-only) allowing dots, hyphens, and spaces to match external JSON Schema property conventions.
  - `McpToolNodeConfigSchema` & `McpToolNodeConfig`: Strict object schema requiring `integrationRef` (opaque workspace-scoped reference under `WorkflowIdentifierSchema`, 1–128 chars) and `toolName`. Supports optional `arguments` mapping (`Record<string, ValueBinding>`, max 50 entries) and optional `timeoutMs` (integer milliseconds, bounded 500–300,000 ms).
  - Strict Security & Authorization Boundaries: Rejects unknown properties (e.g. `apiKey`, `serverUrl`, `baseUrl`, `transport`, `command`, `env`), self-authorization bypass fields (`safeToRun`, `bypassApproval`), and explicitly present `undefined` optional fields via `.superRefine`. Zero embedded credentials, zero dynamic code/shell execution, and zero filesystem or network calls.
  - Draft Compatibility: Preserved structural `WorkflowNodeSchema` allowing `{ config: {} }` during canvas drafting, while `McpToolNodeConfigSchema` strictly validates declared configurations for execution readiness.
- **Verification**: `[AGENT-LOCAL]`
  - 51 Vitest runtime tests in `test/mcp-tool-config.spec.ts` passing (positive configurations, argument mappings, boundary timeouts, negative rejections, credential rejections, self-authorization rejections, draft compatibility, and compile-time narrowing).
  - 245 existing Vitest tests continue passing without modification (296 total tests in contracts).
  - Clean-build verified: deleting `packages/contracts/dist` and executing `pnpm test` successfully rebuilds ESM declarations and passes all 296 tests.
  - Full monorepo verification: `format:check`, `lint:root`, `lint`, `typecheck`, `turbo run build --force`, and `turbo run test --force` (301 total tests across api, worker, and contracts) all passing with exit code 0.
- **Commit Status**: Preserved in working tree (developer-controlled commits).

---

### Milestone 2A-B2d — Human APPROVAL Node Configuration Schema and Validation Tests

- **Date**: 2026-11-04
- **Status**: `COMPLETED`
- **Scope**: Extend `@flowforge/contracts` with standalone, strict configuration schemas for the human `APPROVAL` workflow node, approver role policy, and timeout handling parameters.
- **Files Created**:
  - `packages/contracts/src/workflow/node-configs/approval-config.ts`
  - `packages/contracts/test/approval-config.spec.ts`
- **Files Modified**:
  - `packages/contracts/src/index.ts` (public exports)
  - `README.md`
  - `DEVELOPMENT_PLAN.md`
  - `CHANGELOG.md`
- **Deliverables**:
  - `ApproverRoleSchema` & `ApproverRole`: 3 approved workspace membership roles (`OWNER`, `ADMIN`, `MEMBER`) as configuration identifiers.
  - `ApprovalPolicySchema` & `ApprovalPolicy`: Requires `roles: ApproverRole[]` (1–3 unique roles), rejecting duplicate roles via `.superRefine` reporting errors at `policy.roles[index]` while preserving authored order.
  - `ApprovalTimeoutActionSchema` & `ApprovalTimeoutAction`: Explicit timeout expiration actions (`'REJECT' | 'EXPIRE'`), strictly forbidding automatic approval.
  - `ApprovalNodeConfigSchema` & `ApprovalNodeConfig`: Strict object schema requiring `title` (1–120 characters, non-whitespace-only), `policy`, `timeoutMinutes` (integer 1–10,080 / 7 days), and `timeoutAction`, with optional `description` (up to 1,000 characters).
  - Strict Security Boundaries & Serialization: Rejects unknown properties, self-authorization bypass fields (`autoApprove`, `bypassApproval`, etc.), runtime decision state (`status`, `decision`, `approverUserId`), and explicitly present `undefined` optional fields via `.superRefine`.
  - Draft Compatibility: Preserved structural `WorkflowNodeSchema` allowing `{ config: {} }` during canvas drafting, while `ApprovalNodeConfigSchema` strictly validates complete declarations for publish/execution readiness.
- **Verification**: `[AGENT-LOCAL]`
  - 45 Vitest runtime tests in `test/approval-config.spec.ts` passing (positive configurations, role combinations, timeout boundaries, negative rejections, bypass rejections, draft compatibility, and compile-time narrowing).
  - 296 existing Vitest tests continue passing without modification (341 total tests in contracts).
  - Clean-build verified: deleting `packages/contracts/dist` and executing `pnpm test` successfully rebuilds ESM declarations and passes all 341 tests.
  - Full monorepo verification: `format:check`, `lint:root`, `lint`, `typecheck`, `turbo run build --force`, and `turbo run test --force` (346 total tests across api, worker, and contracts) all passing with exit code 0.
- **Commit Status**: Preserved in working tree (developer-controlled commits).

### Milestone 2A-B3a — Typed Workflow Node Composition and Discriminated Union

- **Date**: 2026-11-09
- **Status**: `COMPLETED`
- **Scope**: Extend `@flowforge/contracts` with a strictly validated Zod 4 discriminated union on property `type` (`ConfiguredWorkflowNodeSchema`, `ConfiguredWorkflowNode`) uniting all seven fully configured workflow node variants (`INPUT`, `TRANSFORM`, `CONDITION`, `LLM`, `MCP_TOOL`, `APPROVAL`, `OUTPUT`).
- **Files Created**:
  - `packages/contracts/src/workflow/configured-node.ts`
  - `packages/contracts/test/configured-node.spec.ts`
- **Files Modified**:
  - `packages/contracts/src/workflow/node-configs/input-config.ts` (narrow fix: explicit `undefined` check for `description` in `InputFieldDefinitionSchema` to maintain cross-contract JSON serializability invariant)
  - `packages/contracts/test/input-config.spec.ts` (regression test for `description: undefined`)
  - `packages/contracts/src/index.ts` (public exports)
  - `README.md`
  - `DEVELOPMENT_PLAN.md`
  - `DEVELOPMENT_LOG.md`
  - `CHANGELOG.md`
- **Deliverables**:
  - `ConfiguredWorkflowNodeSchema` & `ConfiguredWorkflowNode`: Zod 4 discriminated union on property `type` covering all seven approved V1 node variants (`ConfiguredInputNodeSchema`, `ConfiguredTransformNodeSchema`, `ConfiguredConditionNodeSchema`, `ConfiguredLlmNodeSchema`, `ConfiguredMcpToolNodeSchema`, `ConfiguredApprovalNodeSchema`, `ConfiguredOutputNodeSchema`).
  - Strict Object Validation & Structural Reuse: Reuses `WorkflowNodeSchema.shape.id` (`WorkflowIdentifierSchema`) and `WorkflowNodeSchema.shape.position` (`WorkflowNodePositionSchema`), enforcing `.strict()` on all variants to forbid unexpected top-level or config properties.
  - No AGENT or Fallback Types: Contains exactly 7 approved variants; no `AGENT` variant or catch-all fallback schema exists.
  - Cross-Contract Serializability & Narrow Fix: Discovered and corrected a cross-contract serializability inconsistency in `InputFieldDefinitionSchema` where `description: undefined` was accepted by `input-config.ts` but failed `WorkflowNodeSchema`'s `z.json()` validation. Added explicit `undefined` rejection to `InputFieldDefinitionSchema.superRefine`, aligning it with all other schemas and ensuring every configured node passes `WorkflowNodeSchema`.
  - Draft Compatibility Preservation: Generic `WorkflowNodeSchema` and `WorkflowGraphSchema` remain completely intact, continuing to accept incomplete draft nodes (`{ config: {} }`), while `ConfiguredWorkflowNodeSchema` strictly enforces complete type-specific configurations.
  - Non-Publication Boundary: Single-node configuration schema strictly decouples from graph topology, cycle detection, reachability, branch completeness, runtime credential authorization, or provider connectivity (deferred to Milestone 2B).
- **Verification**: `[AGENT-LOCAL]`
  - 43 Vitest runtime tests in `test/configured-node.spec.ts` passing (positive validation across all 7 node variants, schema variant selection, coordinate preservation, generic `WorkflowNodeSchema` compliance, JSON round-trip serialization, negative rejections, type-config mismatch rejections, unexpected property rejections, explicit `undefined` serializability rejections, draft compatibility, and compile-time TypeScript narrowing).
  - 1 regression test added in `test/input-config.spec.ts` passing (30 total tests in input-config).
  - 385 total Vitest tests in `@flowforge/contracts` across 11 test files passing.
  - Clean-build verified: deleting `packages/contracts/dist` and executing `pnpm test` successfully rebuilds ESM declarations and passes all 385 tests.
  - Full monorepo verification: `format:check`, `lint:root`, `lint`, `typecheck`, `turbo run build --force`, and `turbo run test --force` (390 total tests across api, worker, and contracts) all passing with exit code 0.
- **Commit Status**: Preserved in working tree (developer-controlled commits).

---

### Milestone 2A-B3b — Workflow-Level Node Configuration Validation and Diagnostics

- **Date**: 2026-11-09
- **Status**: `COMPLETED`
- **Scope**: Extend `@flowforge/contracts` with standalone and workflow-level node configuration validation functions (`validateNodeConfig`, `validateWorkflowNodeConfigs`, `formatValidationPath`) returning sanitized, structured, editor-ready diagnostics without short-circuiting.
- **Files Created**:
  - `packages/contracts/src/workflow/workflow-config-validation.ts`
  - `packages/contracts/test/workflow-config-validation.spec.ts`
- **Files Modified**:
  - `packages/contracts/src/index.ts` (public exports)
  - `README.md`
  - `DEVELOPMENT_PLAN.md`
  - `DEVELOPMENT_LOG.md`
  - `CHANGELOG.md`
- **Deliverables**:
  - `validateNodeConfig(type: WorkflowNodeType, config: unknown)`: Validates a single node's configuration object against the schema corresponding to its type. Exhaustive dispatch table via `Record<WorkflowNodeType, z.ZodTypeAny>` ensuring compile-time completeness. Pure, deterministic, and non-throwing.
  - `validateWorkflowNodeConfigs(graph: WorkflowGraph)`: Aggregates configuration issues across all nodes in a structurally valid draft graph without short-circuiting on the first error. Preserves exact node index, ID, and type.
  - `formatValidationPath(path)`: Formats structured path segments into human-readable dot and quoted bracket notation (`nodes[3].config.prompt`, `nodes[0].config.payloadMapping["result.summary"]`).
  - Diagnostic & Result Types: `NodeConfigValidationIssue`, `WorkflowNodeConfigValidationIssue`, `NodeConfigValidationResult`, `WorkflowNodeConfigValidationResult` with TypeScript discriminated union narrowing on `success`.
  - Non-Leaking Diagnostics: Issues contain only sanitized string/number paths, messages, codes, and displayPaths; raw configuration objects, user prompt text, secrets, and stack traces are excluded.
  - Draft Preservation: `WorkflowGraphSchema` and `WorkflowNodeSchema` continue to accept `{ config: {} }` for canvas drafts, while `validateWorkflowNodeConfigs` exposes structured validation diagnostics.
  - Non-Publication Boundary: Does not evaluate DAG cycles, reachability, branch completeness, or live integrations (deferred to Milestone 2B and Phase 3).
- **Verification**: `[AGENT-LOCAL]`
  - 47 Vitest runtime tests in `test/workflow-config-validation.spec.ts` passing (positive validation for all 7 node kinds, 7-node complete graph, empty graph, unresolvable upstream references, purity/determinism, non-mutation, negative rejections, multi-node error aggregation, multi-error intra-node retention, exact node index/ID/type preservation, nested numeric indices, punctuation in keys, raw value omission, JSON serializability, draft structural preservation, boundary decoupling, and compile-time narrowing).
  - 432 total Vitest tests in `@flowforge/contracts` across 12 test files passing.
  - Clean-build verified: deleting `packages/contracts/dist` and executing `pnpm test` successfully rebuilds ESM declarations and passes all 432 tests.
  - Full monorepo verification: `format:check`, `lint:root`, `lint`, `typecheck`, `turbo run build --force`, and `turbo run test --force` (437 total tests across api, worker, and contracts) all passing with exit code 0.
- **Commit Status**: Preserved in working tree (developer-controlled commits).

---

### Phase 2A Final Quality Gate — Diagnostic Safety, Path Escaping, and Checkpoint Readiness

- **Date**: 2026-11-09
- **Status**: `COMPLETED`
- **Scope**: Comprehensive security, privacy, escaping, and regression audit of Phase 2A contracts before manual checkpoint commit. Verified diagnostic message privacy model, path escaping robustness, and monorepo readiness.
- **Files Modified**:
  - `packages/contracts/src/workflow/workflow-config-validation.ts` (enhanced documentation of privacy boundaries and defensive string escaping)
  - `packages/contracts/test/workflow-config-validation.spec.ts` (added 8 comprehensive regression tests covering escaping of quotes, backslashes, newlines, control characters, unicode, brackets, punctuation, string vs numeric indices, and data non-exposure)
  - `DEVELOPMENT_LOG.md`
- **Audit Findings**:
  - **Diagnostic Privacy**: Raw configuration values (e.g. prompt text, payload literals, passwords in config values) are NOT copied into issues. However, authored property names and identifiers legitimately appear in Zod issue messages and paths (e.g. unrecognized key errors). Documentation was clarified so callers treat diagnostics as sensitive and render them as plain text.
  - **Path Formatter Escaping**: `formatValidationPath` leverages standard JSON stringification (`JSON.stringify(String(segment))`) for non-identifier string segments, safely handling double quotes (`\"`), backslashes (`\\`), newlines (`\n`), tabs (`\t`), carriage returns (`\r`), null bytes (`\u0000`), and non-ASCII Unicode (`field_🚀`).
  - **Draft Compatibility**: Structural schema allows incomplete drafts (`{ config: {} }`); configuration diagnostics remain strictly decoupled from graph topology (cycle detection, DAG reachability) and execution.
- **Verification**: `[AGENT-LOCAL]`
  - 55 Vitest runtime tests in `test/workflow-config-validation.spec.ts` passing (+8 new regression tests).
  - 440 total Vitest tests in `@flowforge/contracts` across 12 test files passing.
  - Full monorepo verification: `format:check`, `lint:root`, `lint`, `typecheck`, `turbo run build --force`, and `turbo run test --force` (445 total tests across api, worker, and contracts) all passing with exit code 0.
- **Commit Status**: Preserved in working tree (developer-controlled commits). Ready for manual checkpoint commit.

---

### Milestone 2B-A — Graph Integrity and Deterministic Topological Ordering

- **Date**: 2026-11-09
- **Status**: `COMPLETED`
- **Scope**: Create standalone framework-independent workspace package `@flowforge/workflow-core`. Implement pure, synchronous graph integrity validation and deterministic topological ordering using Kahn's algorithm with a zero-dependency binary min-heap for lexicographic tie-breaking.
- **Files Created**:
  - `packages/workflow-core/package.json`
  - `packages/workflow-core/tsconfig.json`
  - `packages/workflow-core/tsconfig.build.json`
  - `packages/workflow-core/tsconfig.test.json`
  - `packages/workflow-core/src/index.ts`
  - `packages/workflow-core/src/graph-analysis.ts`
  - `packages/workflow-core/test/graph-analysis.spec.ts`
- **Files Modified**:
  - `.github/workflows/ci.yml` (added workflow-core test typecheck step)
  - `pnpm-lock.yaml` (workspace dependency registration)
  - `README.md`
  - `DEVELOPMENT_PLAN.md`
  - `DEVELOPMENT_LOG.md`
  - `CHANGELOG.md`
- **Deliverables**:
  - `analyzeWorkflowGraph(graph: WorkflowGraph): GraphAnalysisResult`: Pure, synchronous function evaluating graph integrity and calculating deterministic topological ordering. Accepts valid `WorkflowGraph` contracts and preserves input immutability without mutation.
  - Staged Integrity-First Architecture:
    - _Stage A_: Validates node and edge ID uniqueness with exact string equality (preserving casing and punctuation).
    - _Stage B_: Validates edge referential integrity (sources and targets exist in graph). If Stage A or B detects errors, returns failure immediately and suppresses topological analysis to avoid false cycle diagnoses.
    - _Stage C_: Runs Kahn's topological sort with binary min-heap priority queue for deterministic $O((V + E) \log V)$ lexicographic tie-breaking. Detects directed cycles if processed node count is less than graph node count.
  - Diagnostic & Result Types: `GraphIntegrityIssueCode` (`'DUPLICATE_NODE_ID' | 'DUPLICATE_EDGE_ID' | 'MISSING_EDGE_SOURCE' | 'MISSING_EDGE_TARGET' | 'CYCLE_DETECTED'`), `GraphIntegrityIssue`, `GraphAnalysisSuccessResult`, `GraphAnalysisFailureResult`, `GraphAnalysisResult`. Discriminated on `success`.
  - Non-Leaking Diagnostics: Errors contain only structured paths (e.g. `['nodes', index, 'id']`, `['edges', index, 'source']`, `['edges']`), stable messages, and codes without sensitive configuration payloads.
  - Draft Compatibility: Transparently accepts draft nodes (`{ config: {} }`), empty graphs (`{ nodes: [], edges: [] }`), disconnected components, and parallel edges.
  - Excluded Semantic Boundaries: Does not evaluate single INPUT/OUTPUT counts, branch completeness, reachability, or publishability (deferred to Milestone 2B-B).
- **Verification**: `[AGENT-LOCAL]`
  - 50 Vitest runtime tests in `packages/workflow-core/test/graph-analysis.spec.ts` passing (covering empty graphs, single nodes, linear chains, branching DAGs, diamonds, disconnected components, reordering invariance, tie-breaking, parallel edges, duplicate IDs, dangling endpoints, self-loops, 2-node and multi-node cycles, immutability, draft compatibility, and compile-time type narrowing).
  - 440 Vitest tests in `@flowforge/contracts` across 12 files passing.
  - 4 Vitest tests in `@flowforge/api` across 2 files passing.
  - 1 Vitest smoke test in `@flowforge/worker` passing.
  - Total monorepo test baseline: 495 tests passing across 16 test files.
  - Full monorepo verification: `format:check`, `lint:root`, `lint`, `typecheck`, `turbo run build --force`, and `turbo run test --force` all passing with exit code 0.
- **Commit Status**: Preserved in working tree (developer-controlled commits).

---

### Milestone 2B-B — CONDITION Branch Integrity and Static Graph Reachability

- **Date**: 2026-11-09
- **Status**: `COMPLETED`
- **Scope**: Extend `@flowforge/workflow-core` with static workflow graph semantic validation (`validateWorkflowGraphSemantics`). Implemented staged integrity gating, entry/terminal presence rules, exact CONDITION branch routing checks, non-CONDITION edge outcome restrictions, and forward/reverse static reachability traversals with BFS in $\mathcal{O}(V + E)$.
- **Files Created**:
  - `packages/workflow-core/src/graph-semantics.ts`
  - `packages/workflow-core/test/graph-semantics.spec.ts`
- **Files Modified**:
  - `packages/workflow-core/src/index.ts`
  - `README.md`
  - `DEVELOPMENT_PLAN.md`
  - `DEVELOPMENT_LOG.md`
  - `CHANGELOG.md`
- **Deliverables**:
  - `validateWorkflowGraphSemantics(graph: WorkflowGraph): WorkflowGraphSemanticsResult`: Staged semantic analysis function.
    - Integrity Gating: Evaluates `analyzeWorkflowGraph(graph)` first. If structural or topological integrity issues exist, returns immediately with `stage: 'integrity'` and preserves the underlying `GraphIntegrityIssue` array.
    - Entry & Terminal Presence: Enforces at least one `INPUT` node (`MISSING_INPUT_NODE`) and at least one `OUTPUT` node (`MISSING_OUTPUT_NODE`). Suppresses secondary reachability errors when entry or terminal sets are empty.
    - CONDITION Branch Rules: Strictly requires exactly one `TRUE` branch and one `FALSE` branch on every `CONDITION` node. Emits `CONDITION_TRUE_BRANCH_MISSING`, `CONDITION_FALSE_BRANCH_MISSING`, `CONDITION_OUTCOME_DUPLICATE` (for repeated outcomes), `CONDITION_EDGE_OUTCOME_MISSING` (for unlabeled edges), and `CONDITION_EXTRA_OUTGOING_EDGE` (for more than 2 outgoing edges).
    - Non-Condition Outcomes: Forbids `conditionOutcome` metadata on edges originating from non-CONDITION nodes (`NON_CONDITION_EDGE_OUTCOME`).
    - Static Forward Reachability: Verifies every node is reachable from at least one `INPUT` node via forward BFS along directed edges (`UNREACHABLE_FROM_INPUT`).
    - Static Reverse Reachability: Verifies every node can reach at least one `OUTPUT` node via reverse BFS along directed edges (`CANNOT_REACH_OUTPUT`).
  - Diagnostic & Result Types: `WorkflowGraphSemanticIssueCode`, `WorkflowGraphSemanticIssue`, `WorkflowGraphSemanticsSuccessResult`, `WorkflowGraphSemanticsIntegrityFailureResult`, `WorkflowGraphSemanticsSemanticFailureResult`, `WorkflowGraphSemanticsResult`. Discriminated on `success` and `stage`.
  - Pure Function Boundary: Synchronous, deterministic, side-effect-free, preserves input immutability, and operates on draft nodes (`config: {}`). Static reachability is decoupled from runtime condition evaluation, join scheduling, and publication snapshotting.
- **Verification**: `[AGENT-LOCAL]`
  - 53 Vitest runtime tests in `packages/workflow-core/test/graph-semantics.spec.ts` passing (covering positive topologies, condition branch variations, entry/terminal presence, forward/reverse reachability, integrity gating, immutability, boundary checks, and compile-time type narrowing).
  - 103 total Vitest tests in `@flowforge/workflow-core` across 2 test files passing.
  - 440 Vitest tests in `@flowforge/contracts` across 12 files passing.
  - 4 Vitest tests in `@flowforge/api` across 2 files passing.
  - 1 Vitest smoke test in `@flowforge/worker` passing.
  - Total monorepo test baseline: 548 tests passing across 17 test files.
  - Full monorepo verification: `format:check`, `lint:root`, `lint`, `typecheck`, `turbo run build --force`, and `turbo run test --force` all passing with exit code 0.
- **Commit Status**: Preserved in working tree (developer-controlled commits).

---

### Milestone 2B-C1 — Static Node-Output Reference Integrity and DAG Ancestry

- **Date**: 2026-11-09
- **Status**: `COMPLETED`
- **Scope**: Extend `@flowforge/workflow-core` with static node-output reference validation (`validateWorkflowNodeOutputReferences`). Implemented staged prerequisite validation (graph integrity Stage 1, node configuration validity Stage 2), typed extraction of approved reference-bearing positions without recursive JSON scanning, and strict reverse DAG ancestry verification via reverse BFS.
- **Files Created**:
  - `packages/workflow-core/src/node-output-references.ts`
  - `packages/workflow-core/test/node-output-references.spec.ts`
- **Files Modified**:
  - `packages/workflow-core/src/index.ts`
  - `README.md`
  - `DEVELOPMENT_PLAN.md`
  - `DEVELOPMENT_LOG.md`
  - `CHANGELOG.md`
- **Deliverables**:
  - `validateWorkflowNodeOutputReferences(graph: WorkflowGraph): WorkflowNodeOutputReferenceValidationResult`: Staged static reference analysis function.
    - Stage 1 (Integrity Gating): Reuses `analyzeWorkflowGraph(graph)`. If structural or topological integrity issues exist, returns immediately with `stage: 'integrity'` and preserves underlying `GraphIntegrityIssue` array without emitting speculative lineage errors.
    - Stage 2 (Configuration Gating): Reuses `validateWorkflowNodeConfigs(graph)` from `@flowforge/contracts`. If any configuration is incomplete or malformed, returns immediately with `stage: 'configuration'` and preserves `WorkflowNodeConfigValidationIssue` array without scanning arbitrary draft JSON.
    - Stage 3 (Node-Output Reference Checks): Traverses approved typed binding positions (`TRANSFORM` json_pick source, json_set value, template_string reference segments, math_op left/right; `CONDITION` left and right; `LLM` prompt reference; `MCP_TOOL` arguments; `OUTPUT` payloadMapping). Literal JSON objects and strings are never parsed or scanned recursively.
    - Reference Lineage Invariants:
      - Rule A (Existence): Emits `NODE_OUTPUT_REFERENCE_NOT_FOUND` if target node does not exist in graph.
      - Rule B (Self-Reference): Emits `NODE_OUTPUT_REFERENCE_SELF` if target node matches consumer ID.
      - Rule C (Strict Ancestry): Emits `NODE_OUTPUT_REFERENCE_NOT_UPSTREAM` if target node is not reachable via reverse DAG traversal.
  - Architectural Boundaries & Limitations:
    - Static ancestry guarantees directed path connectivity in the DAG, but does not guarantee runtime value availability when conditional branches (`CONDITION` TRUE/FALSE) skip paths.
    - Trigger input references (`source: 'input'`) are recognized and deferred to Milestone 2B-C2.
    - Complexity: Reverse adjacency build is $O(V + E)$; ancestor traversal across $K$ referencing consumers bounded by $O(V + E + K(V + E) + R)$.
- **Verification**: `[AGENT-LOCAL]`
  - 49 Vitest runtime tests in `packages/workflow-core/test/node-output-references.spec.ts` passing (covering empty graphs, all node kinds, binding positions, atomic dot IDs, literal isolation, deferred input references, conditional merge branches, frozen graphs, missing targets, self references, downstream/sibling references, topological non-ancestors, prerequisite failures, and TypeScript narrowing).
  - 152 total Vitest tests in `@flowforge/workflow-core` across 3 test files passing.
  - 440 Vitest tests in `@flowforge/contracts` across 12 files passing.
  - 4 Vitest tests in `@flowforge/api` across 2 files passing.
  - 1 Vitest smoke test in `@flowforge/worker` passing.
  - Total monorepo test baseline: 597 tests passing across 18 test files.
- **Commit Status**: Preserved in working tree (developer-controlled commits).

---

### Milestone 2B-C2 — INPUT Field Reference Scope and Static Validation

- **Date**: 2026-11-09
- **Status**: `COMPLETED`
- **Scope**: Extend `@flowforge/workflow-core` with static trigger input reference validation (`validateWorkflowInputReferences`). Implemented staged prerequisite validation (graph integrity Stage 1, node configuration validity Stage 2), unified workflow-level INPUT field namespace indexing, exact case-sensitive field resolution, and missing/ambiguous field diagnostics.
- **Files Created**:
  - `packages/workflow-core/src/input-references.ts`
  - `packages/workflow-core/test/input-references.spec.ts`
- **Files Modified**:
  - `packages/workflow-core/src/index.ts`
  - `README.md`
  - `DEVELOPMENT_PLAN.md`
  - `DEVELOPMENT_LOG.md`
  - `CHANGELOG.md`
- **Deliverables**:
  - `validateWorkflowInputReferences(graph: WorkflowGraph): WorkflowInputReferenceValidationResult`: Staged static input reference analysis function.
    - Stage 1 (Integrity Gating): Reuses `analyzeWorkflowGraph(graph)` to verify identifier uniqueness, edge referential integrity, and acyclicity.
    - Stage 2 (Configuration Gating): Reuses `validateWorkflowNodeConfigs(graph)` from `@flowforge/contracts` to ensure all configurations conform to their schemas before inspecting references.
    - Stage 3 (Input Reference Scope): Resolves references against a workflow-wide input namespace built across all configured `INPUT` nodes:
      - Field Occurrence Index: Map of exact case-sensitive field names to declaration counts across all `INPUT` nodes.
      - Rule A (Missing Declaration): Emits `INPUT_REFERENCE_FIELD_NOT_FOUND` if a referenced field has 0 declarations across all `INPUT` nodes.
      - Rule B (Ambiguous Duplicate): Emits `INPUT_REFERENCE_FIELD_AMBIGUOUS` if a referenced field has $> 1$ declarations across multiple `INPUT` nodes.
      - Unreferenced duplicates do not trigger errors.
      - Static resolution does not require graph ancestry between the declaring `INPUT` node and the consumer node.
    - Approved reference-bearing positions traversed: `TRANSFORM` json_pick source, json_set value, template_string reference segments, math_op left/right; `CONDITION` left and right; `LLM` prompt reference; `MCP_TOOL` arguments; `OUTPUT` payloadMapping. Literal JSON, prompt text, and fallback values are never scanned.
  - Diagnostic & Result Types: `InputReferenceIssueCode`, `InputReferenceIssue`, `WorkflowInputReferenceSuccessResult`, `WorkflowInputReferenceIntegrityFailureResult`, `WorkflowInputReferenceConfigurationFailureResult`, `WorkflowInputReferenceFailureResult`, `WorkflowInputReferenceValidationResult`.
  - Algorithmic Complexity: Stage 3 runs in $\mathcal{O}(V + F + R)$ linear time with expected $\mathcal{O}(1)$ map lookups, where $F$ is declared fields and $R$ is total references.
- **Verification**: `[AGENT-LOCAL]`
  - 63 Vitest runtime tests in `packages/workflow-core/test/input-references.spec.ts` passing (covering positive references, missing fields, ambiguous multi-INPUT declarations, matching/different types, array order independence, literal isolation, prerequisite gating, frozen immutability, determinism, and TypeScript type narrowing).
  - 215 total Vitest tests in `@flowforge/workflow-core` across 4 test files passing.
  - 440 Vitest tests in `@flowforge/contracts` across 12 files passing.
  - 4 Vitest tests in `@flowforge/api` across 2 files passing.
  - 1 Vitest smoke test in `@flowforge/worker` passing.
  - Total monorepo test baseline: 660 tests passing across 19 test files.
- **Commit Status**: Preserved in working tree (developer-controlled commits).

---

### Milestone 2B-D1 — INPUT/OUTPUT Entry and Terminal Topology Validation

- **Date**: 2026-11-09
- **Status**: `COMPLETED`
- **Scope**: Extend `@flowforge/workflow-core` with entry/terminal boundary topology validation (`validateWorkflowEntryExitTopology`). Implemented staged prerequisite validation (reusing `validateWorkflowGraphSemantics` to handle integrity and semantics errors), zero-indegree validation for `INPUT` nodes (`INPUT_HAS_INCOMING_EDGE`), zero-outdegree validation for `OUTPUT` nodes (`OUTPUT_HAS_OUTGOING_EDGE`), multi-input and multi-output topology support, and compound violation handling.
- **Files Created**:
  - `packages/workflow-core/src/entry-exit-topology.ts`
  - `packages/workflow-core/test/entry-exit-topology.spec.ts`
- **Files Modified**:
  - `packages/workflow-core/src/index.ts`
  - `README.md`
  - `DEVELOPMENT_PLAN.md`
  - `DEVELOPMENT_LOG.md`
  - `CHANGELOG.md`
- **Deliverables**:
  - `validateWorkflowEntryExitTopology(graph: WorkflowGraph): WorkflowEntryExitTopologyResult`: Staged entry/terminal boundary analysis function.
    - Stage Gating (Integrity & Semantics): Reuses `validateWorkflowGraphSemantics(graph)` directly.
      - If graph integrity fails, returns `{ success: false, stage: 'integrity', issues: GraphIntegrityIssue[] }`.
      - If graph semantics fails, returns `{ success: false, stage: 'semantics', issues: WorkflowGraphSemanticIssue[] }`.
      - Avoids redundant topological sorting while guaranteeing structural acyclicity and basic semantic sanity.
    - Stage 3 Entry/Terminal Boundary Topology Rules:
      - Rule A (Zero-Indegree INPUT): Every node with `type: 'INPUT'` must have zero incoming edges ($\text{indegree} = 0$). Offending edges emit `INPUT_HAS_INCOMING_EDGE` targeting `['edges', edgeIndex, 'target']`.
      - Rule B (Zero-Outdegree OUTPUT): Every node with `type: 'OUTPUT'` must have zero outgoing edges ($\text{outdegree} = 0$). Offending edges emit `OUTPUT_HAS_OUTGOING_EDGE` targeting `['edges', edgeIndex, 'source']`.
      - Compound Violations: An edge directly linking `OUTPUT` to `INPUT` (`OUTPUT -> INPUT`) emits two distinct issues in deterministic order: `OUTPUT_HAS_OUTGOING_EDGE` at `['edges', edgeIndex, 'source']`, followed by `INPUT_HAS_INCOMING_EDGE` at `['edges', edgeIndex, 'target']`.
    - Multiple Nodes Support: Workflows with multiple entry `INPUT` nodes and multiple terminal `OUTPUT` nodes are supported cleanly.
    - Invariant & Compatibility Boundary: `validateWorkflowGraphSemantics` remains unchanged and permissive of non-terminal OUTPUTs or incoming INPUT edges when reachability holds. `validateWorkflowEntryExitTopology` provides the strict boundary contract required for execution.
    - Success Payload: On success, returns `{ success: true, issues: [], topologicalNodeIds: string[] }`, preserving the deterministic topological sort order from the semantic prerequisite analysis.
  - Diagnostic & Result Types: `WorkflowEntryExitTopologyIssueCode`, `WorkflowEntryExitTopologyIssue`, `WorkflowEntryExitTopologySuccessResult`, `WorkflowEntryExitTopologyIntegrityFailureResult`, `WorkflowEntryExitTopologySemanticFailureResult`, `WorkflowEntryExitTopologyFailureResult`, `WorkflowEntryExitTopologyResult`.
  - Algorithmic Complexity: $\mathcal{O}(V + E)$ linear time after semantic gating.
- **Verification**: `[AGENT-LOCAL]`
  - 47 Vitest runtime tests in `packages/workflow-core/test/entry-exit-topology.spec.ts` passing (covering valid single/multi-entry/exit graphs, incoming edges on INPUT, outgoing edges on OUTPUT, compound direct edges, prerequisite failure preservation, frozen immutability, determinism, and TypeScript type narrowing).
  - 262 total Vitest tests in `@flowforge/workflow-core` across 5 test files passing.
  - 440 Vitest tests in `@flowforge/contracts` across 12 files passing.
  - 4 Vitest tests in `@flowforge/api` across 2 files passing.
  - 1 Vitest smoke test in `@flowforge/worker` passing.
  - Total monorepo test baseline: 707 tests passing across 20 test files.
- **Commit Status**: Preserved in working tree (developer-controlled commits).

---

### Milestone 2B-D2 — Branch-Conditioned Node-Output Path Coverage Analysis

- **Date**: 2026-11-09
- **Status**: `COMPLETED`
- **Scope**: Extend `@flowforge/workflow-core` with branch-conditioned node-output path coverage analysis (`analyzeWorkflowNodeOutputPathCoverage`). Implemented staged prerequisite gating (Stage 1 reusing `validateWorkflowEntryExitTopology`, Stage 2 reusing `validateWorkflowNodeOutputReferences`), static graph path-dominance analysis relative to all workflow INPUT entrypoints, producer-exclusion forward BFS reachability ($O(V + E + R + P(V + E))$), occurrence-level advisory control-flow findings (`NODE_OUTPUT_REFERENCE_NOT_ON_ALL_INPUT_PATHS`), and multi-input root support.
- **Files Created**:
  - `packages/workflow-core/src/node-output-path-coverage.ts`
  - `packages/workflow-core/test/node-output-path-coverage.spec.ts`
- **Files Modified**:
  - `packages/workflow-core/src/index.ts`
  - `packages/workflow-core/src/node-output-references.ts`
  - `README.md`
  - `DEVELOPMENT_PLAN.md`
  - `DEVELOPMENT_LOG.md`
  - `CHANGELOG.md`
- **Deliverables**:
  - `analyzeWorkflowNodeOutputPathCoverage(graph: WorkflowGraph): WorkflowNodeOutputPathCoverageResult`: Staged branch-conditioned path coverage analyzer.
    - Stage 1 Prerequisite Gating: Reuses `validateWorkflowEntryExitTopology(graph)` directly. Preserves integrity (`stage: 'integrity'`), semantics (`stage: 'semantics'`), and boundary topology (`stage: 'entry_exit'`) failure diagnostics without speculative evaluation.
    - Stage 2 Prerequisite Gating: Reuses `validateWorkflowNodeOutputReferences(graph)`. Preserves node configuration (`stage: 'configuration'`) and reference lineage (`stage: 'references'`) diagnostics without speculative evaluation.
    - Stage 3 Path Dominance Analysis:
      - Path Dominance Definition: Producer node $P$ dominates consumer node $C$ relative to workflow INPUT entrypoints if every directed path beginning at ANY `INPUT` node and ending at $C$ contains $P$.
      - Producer-Exclusion Algorithm: For each distinct referenced producer $P$, performs forward BFS traversal starting from all `INPUT` nodes except $P$. If $C$ is reached without $P$, emits an advisory finding for that reference.
      - Intra-call Reachability Caching: Computes and caches reachability sets per distinct producer $P$ ($O(V + E)$ per producer, bounded by $P(V + E)$).
      - Occurrence-Level Diagnostic Preservation: Generates findings per reference occurrence without collapsing or sorting messages by text.
      - Advisory Nature: Findings represent control-flow branching risks, NOT hard structural errors or publication blockers. Returns `{ success: true, issues: [], findings: [...] }` without speculative readiness verdicts (`isPublishable`, `canRun`).
  - Diagnostic & Result Types: `NodeOutputPathCoverageFindingCode`, `NodeOutputPathCoverageFinding`, `WorkflowNodeOutputPathCoverageSuccessResult`, `WorkflowNodeOutputPathCoverageIntegrityFailureResult`, `WorkflowNodeOutputPathCoverageSemanticFailureResult`, `WorkflowNodeOutputPathCoverageEntryExitFailureResult`, `WorkflowNodeOutputPathCoverageConfigurationFailureResult`, `WorkflowNodeOutputPathCoverageReferencesFailureResult`, `WorkflowNodeOutputPathCoverageResult`.
  - Algorithmic Complexity: $\mathcal{O}(V + E + R + P(V + E))$ for the path coverage pass, with space complexity bounded by $\mathcal{O}(V + E + PV)$.
- **Verification**: `[AGENT-LOCAL]`
  - 60 Vitest runtime tests in `packages/workflow-core/test/node-output-path-coverage.spec.ts` passing (covering dominating linear pipelines, shared branch producers, branch-confined references, multiple inputs/outputs, conditional merges, optional side paths, distinct producers, occurrence preservation, prerequisite failures, determinism, frozen immutability, and TypeScript discriminated union narrowing).
  - 322 total Vitest tests in `@flowforge/workflow-core` across 6 test files passing.
  - 440 Vitest tests in `@flowforge/contracts` across 12 files passing.
  - 4 Vitest tests in `@flowforge/api` across 2 files passing.
  - 1 Vitest smoke test in `@flowforge/worker` passing.
  - Total monorepo test baseline: 767 tests passing across 21 test files.
- **Commit Status**: Preserved in working tree (developer-controlled commits).

---

### Milestone 2B-E — Unified Static Workflow Publish-Readiness Assessment

- **Date**: 2026-11-09
- **Status**: `COMPLETED`
- **Scope**: Extend `@flowforge/workflow-core` with unified static workflow publish-readiness assessment (`validateWorkflowPublishReadiness`). Implemented a 5-stage validation pipeline on untrusted unknown inputs: Stage 1 structural schema parsing via `WorkflowGraphSchema.safeParse(input)` (safely sanitizing paths to `string | number` without leaking raw input payloads or `ZodError` instances), Stage 2 graph integrity, semantics, and boundary topology via `validateWorkflowEntryExitTopology`, Stage 3 node configuration validation via `validateWorkflowNodeConfigs`, Stage 4 static reference validation combining `validateWorkflowNodeOutputReferences` and `validateWorkflowInputReferences` without early-halting, and Stage 5 static path coverage advisories via `analyzeWorkflowNodeOutputPathCoverage`. Emits discriminated public statuses (`blocked`, `checks_passed_with_advisories`, `checks_passed`), stage-tagged blocking issues, and non-blocking advisories. Decoupled from database persistence, authorization, publishing endpoints, and runtime execution. Phase 2B is feature-complete.
- **Files Created**:
  - `packages/workflow-core/src/publish-readiness.ts`
  - `packages/workflow-core/test/publish-readiness.spec.ts`
- **Files Modified**:
  - `packages/workflow-core/src/index.ts`
  - `README.md`
  - `DEVELOPMENT_PLAN.md`
  - `DEVELOPMENT_LOG.md`
  - `CHANGELOG.md`
- **Deliverables**:
  - `validateWorkflowPublishReadiness(input: unknown): WorkflowPublishReadinessResult`: Pure static readiness gateway orchestrating the 5-stage validation pipeline.
    - Stage 1 (Structure): Parses untrusted payload with `WorkflowGraphSchema.safeParse(input)`. If malformed, halts immediately returning `status: 'blocked'` with `stage: 'structure'` diagnostic issues.
    - Stage 2 (Topology & Semantics): Reuses `validateWorkflowEntryExitTopology(graph)` directly. Preserves structural integrity (`stage: 'integrity'`), branch semantics / reachability (`stage: 'semantics'`), and entry/terminal boundary (`stage: 'entry_exit'`) failure diagnostics without speculative evaluation.
    - Stage 3 (Configuration): Reuses `validateWorkflowNodeConfigs(graph)` from `@flowforge/contracts`. If any configured node violates its typed schema, halts immediately returning `status: 'blocked'` with `stage: 'configuration'` issues.
    - Stage 4 (Static References): Runs both `validateWorkflowNodeOutputReferences(graph)` and `validateWorkflowInputReferences(graph)` independently. If either or both fail, halts returning `status: 'blocked'` with aggregated issues in deterministic sequence (`stage: 'node_output_references'` followed by `stage: 'input_references'`).
    - Stage 5 (Path Coverage Advisories): Runs `analyzeWorkflowNodeOutputPathCoverage(graph)`. If advisory path-dominance findings exist, returns `status: 'checks_passed_with_advisories'` with populated `advisories` and `topologicalNodeIds` (`blockingIssues: []`). If zero findings exist, returns `status: 'checks_passed'` with empty `blockingIssues` and `advisories`.
  - Public Types: `WorkflowPublishReadinessStatus`, `WorkflowStructuralIssue`, `WorkflowIntegrityBlockingIssue`, `WorkflowSemanticBlockingIssue`, `WorkflowEntryExitBlockingIssue`, `WorkflowConfigurationBlockingIssue`, `WorkflowNodeOutputReferenceBlockingIssue`, `WorkflowInputReferenceBlockingIssue`, `WorkflowPublishReadinessBlockingIssue`, `WorkflowPublishReadinessAdvisory`, `WorkflowPublishReadinessBlockedResult`, `WorkflowPublishReadinessPassedWithAdvisoriesResult`, `WorkflowPublishReadinessPassedResult`, `WorkflowPublishReadinessResult`.
  - Pure Function Boundary: Accepts `unknown` input, performs no side effects, does not mutate inputs, and maintains complete decoupling from database persistence, publishing endpoints, worker dispatch, and runtime execution.
- **Verification**: `[AGENT-LOCAL]`
  - 67 Vitest runtime tests in `packages/workflow-core/test/publish-readiness.spec.ts` passing (covering Stage 1 structural failures, Stage 2 topology/semantic failures, Stage 3 configuration failures, Stage 4 reference failures, dual reference failure aggregation, Stage 5 advisory outcomes, pristine passed outcomes, untrusted payload types, determinism, frozen immutability, and TypeScript discriminated union narrowing).
  - 389 total Vitest tests in `@flowforge/workflow-core` across 7 test files passing.
  - 440 Vitest tests in `@flowforge/contracts` across 12 files passing.
  - 4 Vitest tests in `@flowforge/api` across 2 files passing.
  - 1 Vitest smoke test in `@flowforge/worker` passing.
  - Total monorepo test baseline: 834 tests passing across 22 test files.
- **Commit Status**: Preserved in working tree (developer-controlled commits).

---

## 4. Upcoming Work

### Phase 2C — Database & Persistence (`packages/database`)

- **Status**: `NOT STARTED`
- **Scope**: Configure PostgreSQL connection and initialize Prisma ORM in a dedicated `@flowforge/database` workspace package. Implement domain models (`User`, `Workspace`, `WorkspaceMember`, `Workflow`, `WorkflowVersion`, `Execution`, `NodeExecution`, `ExecutionEvent`, `ApprovalRequest`, `OutboxEvent`), reproducible Prisma migrations, seed scripts, and typed repository clients.

---

## 5. Progress Update Template

Future progress entries in this log must adhere to the following template:

```markdown
### Milestone [ID] — [Title]

- **Date**: YYYY-MM-DD
- **Status**: COMPLETED | IN PROGRESS | BLOCKED | DEFERRED
- **Summary**: Concise description of what was implemented or modified.
- **Paths Changed**:
  - `path/to/file1.ts`
  - `path/to/file2.ts`
- **Tests Executed**:
  - Command: `pnpm --filter <package> test`
  - Result: X test suites passed, Y tests passed, duration Zs
- **Verification Type**: [AGENT-LOCAL] | [DEV-LOCAL] | [REMOTE-CI] | [MANUAL-BROWSER]
- **Known Limitations / Open Issues**: Honest assessment of deferred capabilities or edge cases.
- **Next Step**: Immediate next milestone or remediation item.
```
