# FlowForge AI

FlowForge AI is a visual, durable AI workflow orchestration platform designed to build, validate, version, and execute asynchronous directed acyclic graph (DAG) workflows with deterministic logic, AI reasoning nodes, and Model Context Protocol (MCP) integrations.

## Project Status

The project is currently in early foundation setup (Milestone 1A). Monorepo workspace configurations, root tooling, and base repository conventions are being established. Application scaffolding and runtime features have not yet been implemented.

## Repository Structure

```text
flowforge-ai/
├── apps/               # Future deployable applications (web, api, worker, etc.)
├── packages/           # Future shared libraries (contracts, workflow-core, etc.)
├── docs/               # Architecture documents and ADRs
│   └── adr/            # Architecture Decision Records
├── tests/              # Multi-package test suites
│   ├── integration/    # Integration test suites
│   ├── e2e/            # End-to-end test suites
│   └── load/           # Load and performance test suites
├── infra/              # Infrastructure definitions and deployment configurations
├── .github/            # GitHub configurations and workflow automations
│   └── workflows/
├── package.json        # Monorepo root configuration and workspace scripts
├── pnpm-workspace.yaml # pnpm workspace definitions
├── turbo.json          # Turborepo task pipeline configuration
├── .gitignore          # Git exclusion rules
├── .editorconfig       # Multi-editor code formatting standards
└── .nvmrc              # Node.js runtime version pin
```

## Prerequisites

- **Node.js**: `26.x` LTS (see `.nvmrc`)
- **pnpm**: `11.x`
- **Git**: `2.x`

## Architecture and Documentation

Detailed architecture specifications, engineering decisions, and operational guides will be maintained in the `/docs` directory (including `/docs/adr` for Architecture Decision Records) as well as the root engineering governance documents (`ARCHITECTURE.md`, `TECHNICAL_DECISIONS.md`, and `DEVELOPMENT_PLAN.md`).

