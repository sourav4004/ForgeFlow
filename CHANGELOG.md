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

### Changed

- **Transactional Outbox Clarification**: Explicitly distinguished durable PostgreSQL outbox persistence from ephemeral Redis Pub/Sub / SSE delivery in PRD and Architecture documents.
- **Conditional DAG Execution Semantics**: Documented conditional branching and branch skipping as open design specifications rather than assumed full-graph execution.
- **Infrastructure Version Labeling**: Designated PostgreSQL 16 and Redis 7 as candidate infrastructure baselines rather than permanently frozen versions.
- **Workflow Version Immutability Boundaries**: Clarified that immutable workflow versions guarantee retrieval of workflow definitions, not deterministic external LLM outputs or side effects.

### Fixed

- **pnpm Native Build Approval**: Approved `@swc/core` native package build in `pnpm-workspace.yaml` (`allowBuilds`) for pnpm 12 compatibility.
- **Contracts Test Config Formatting**: Corrected Prettier whitespace in `packages/contracts/tsconfig.test.json`.
- **Contracts Type Test Directives**: Positioned `@ts-expect-error` directly above failing property assignment in `packages/contracts/test/health-response.type-test.ts`.
