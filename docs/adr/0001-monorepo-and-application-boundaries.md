# ADR-0001: Monorepo and Application Boundaries

## Status

ACCEPTED

## Context

FlowForge AI comprises multiple distinct services and libraries:

1. A Next.js web application providing the visual canvas and user dashboard (`apps/web`).
2. A NestJS backend API service handling REST requests, graph validation, and execution scheduling (`apps/api`).
3. A standalone Node.js worker runtime processing long-running workflow executions (`apps/worker`).
4. Shared contract definitions and DTOs (`packages/contracts`), with planned domain packages (`packages/workflow-core`, `packages/database`).

We need a repository and project architecture that enables rapid full-stack iteration, strict shared typing, and unified code quality tooling, while preventing tight coupling, spaghetti dependencies, or accidental circular imports between distinct application boundaries.

## Decision

We have adopted a **TypeScript monorepo architecture** using **pnpm workspaces** and **Turborepo**:

1. **Unified Language & Base Configuration**: All applications and shared packages are authored in strict TypeScript 6 extending a single root `tsconfig.base.json`.
2. **Directory Separation**: User-facing or runnable services reside in `apps/`. Reusable, framework-agnostic libraries reside in `packages/`.
3. **Public Contract Boundaries**: All shared types, DTOs, and interface definitions reside in `packages/contracts`. Downstream applications consume contracts exclusively via `@flowforge/contracts` using the pnpm workspace protocol (`workspace:*`).
4. **Prohibition of Cross-App Private Imports**: Code within `apps/api` is strictly forbidden from importing source files from `apps/web` or `apps/worker` (and vice-versa).
5. **Deterministic Task Pipeline**: Turborepo manages the build, typecheck, lint, and test pipelines. Upstream declaration emission (`packages/contracts:build`) is guaranteed prior to consumer typechecking or testing via `"dependsOn": ["^build"]`.

## Alternatives Considered

- **Polyrepo (Separate Repositories)**: Maintaining separate Git repositories for web, api, worker, and contracts. Rejected due to severe synchronization overhead, redundant tooling configurations, multi-repository PR coordination, and the necessity of publishing private npm packages for shared contracts during early-stage development.
- **Monolithic Full-Stack Application (Next.js All-in-One)**: Hosting API routes, web pages, and background job processing within a single Next.js project. Rejected because long-running workflow jobs block serverless/Node HTTP request handlers, background workers cannot be scaled independently, and NestJS provides far superior enterprise dependency injection, modularity, and testability for backend services.
- **Monorepo with Ad-Hoc Relative Path Imports**: Allowing applications to import internal source files across packages using relative paths (e.g. `../../apps/api/src/...`). Rejected because it obliterates architectural boundaries, causes circular dependencies, and breaks independent Docker containerization.

## Consequences

### Positive

- Single atomic repository updates across contracts, API, and worker.
- Shared code quality standards (ESLint flat config, Prettier, strict TypeScript).
- Fast local and CI execution through Turborepo task caching and parallel execution.
- Guaranteed deployment isolation: each application under `apps/` can be containerized independently.

### Trade-offs & Costs

- Requires explicit export mappings in `package.json` (`"exports"` field) and pre-compiling TypeScript declarations (`dist/index.d.ts`) for workspace packages.
- Tooling complexity: ESM module resolution (`NodeNext`) requires explicit `.js` specifiers in imports and dedicated SWC plugins (`unplugin-swc`) for NestJS decorator metadata support in Vitest.

## Implementation Status

**IMPLEMENTED AND VERIFIED** (Milestones 1A through 1E-C).  
The monorepo structure, pnpm workspace linking, Turborepo pipeline, and contracts boundary between `@flowforge/contracts` and `@flowforge/api` are fully operational and covered by automated tests.

## Related Documents

- [Product Requirements Document (PRD.md)](../../PRD.md)
- [System Architecture Document (ARCHITECTURE.md)](../../ARCHITECTURE.md)
- [Technical Decision Register (TECHNICAL_DECISIONS.md)](../../TECHNICAL_DECISIONS.md)
