import type { WorkflowGraph, WorkflowNodeConfigValidationIssue } from '@flowforge/contracts';
import { validateWorkflowNodeConfigs, WorkflowGraphSchema } from '@flowforge/contracts';
import {
  validateWorkflowEntryExitTopology,
  type WorkflowEntryExitTopologyIssue,
} from './entry-exit-topology.js';
import type { GraphIntegrityIssue } from './graph-analysis.js';
import type { WorkflowGraphSemanticIssue } from './graph-semantics.js';
import { validateWorkflowInputReferences, type InputReferenceIssue } from './input-references.js';
import {
  analyzeWorkflowNodeOutputPathCoverage,
  type NodeOutputPathCoverageFinding,
} from './node-output-path-coverage.js';
import {
  validateWorkflowNodeOutputReferences,
  type NodeOutputReferenceIssue,
} from './node-output-references.js';

/**
 * Public assessment statuses for static workflow publish-readiness.
 *
 * - 'blocked': At least one enforced static rule (structure, topology, semantics, configuration, or reference) failed.
 * - 'checks_passed_with_advisories': All enforced static rules passed, but one or more node-output references
 *   do not lie on every directed path from workflow INPUT entrypoints to the consumer.
 * - 'checks_passed': All enforced static rules passed with zero advisory findings.
 */
export type WorkflowPublishReadinessStatus =
  'blocked' | 'checks_passed_with_advisories' | 'checks_passed';

/**
 * Diagnostic issue emitted when schema parsing fails on untrusted unknown input.
 */
export interface WorkflowStructuralIssue {
  readonly stage: 'structure';
  readonly code: string;
  readonly path: ReadonlyArray<string | number>;
  readonly message: string;
}

/**
 * Diagnostic issue emitted when graph structural integrity fails (Stage 2).
 */
export interface WorkflowIntegrityBlockingIssue extends GraphIntegrityIssue {
  readonly stage: 'integrity';
}

/**
 * Diagnostic issue emitted when graph branch semantics or reachability fails (Stage 2).
 */
export interface WorkflowSemanticBlockingIssue extends WorkflowGraphSemanticIssue {
  readonly stage: 'semantics';
}

/**
 * Diagnostic issue emitted when entry (INPUT) or terminal (OUTPUT) topology fails (Stage 2).
 */
export interface WorkflowEntryExitBlockingIssue extends WorkflowEntryExitTopologyIssue {
  readonly stage: 'entry_exit';
}

/**
 * Diagnostic issue emitted when a node configuration fails schema validation (Stage 3).
 */
export interface WorkflowConfigurationBlockingIssue extends WorkflowNodeConfigValidationIssue {
  readonly stage: 'configuration';
}

/**
 * Diagnostic issue emitted when a static node-output reference fails lineage/ancestry checks (Stage 4).
 */
export interface WorkflowNodeOutputReferenceBlockingIssue extends NodeOutputReferenceIssue {
  readonly stage: 'node_output_references';
}

/**
 * Diagnostic issue emitted when an input reference fails field declaration or scope checks (Stage 4).
 */
export interface WorkflowInputReferenceBlockingIssue extends InputReferenceIssue {
  readonly stage: 'input_references';
}

/**
 * Discriminated union of all blocking static workflow validation issues.
 * Each member is tagged with its origin `stage`.
 */
export type WorkflowPublishReadinessBlockingIssue =
  | WorkflowStructuralIssue
  | WorkflowIntegrityBlockingIssue
  | WorkflowSemanticBlockingIssue
  | WorkflowEntryExitBlockingIssue
  | WorkflowConfigurationBlockingIssue
  | WorkflowNodeOutputReferenceBlockingIssue
  | WorkflowInputReferenceBlockingIssue;

/**
 * Public advisory issue representing non-blocking control-flow findings (e.g. conditional branch merging).
 */
export type WorkflowPublishReadinessAdvisory = NodeOutputPathCoverageFinding;

/**
 * Assessment outcome indicating static validation checks failed.
 */
export interface WorkflowPublishReadinessBlockedResult {
  readonly status: 'blocked';
  readonly blockingIssues: ReadonlyArray<WorkflowPublishReadinessBlockingIssue>;
  readonly advisories: readonly [];
}

/**
 * Assessment outcome indicating all static checks passed, but advisory control-flow findings exist.
 */
export interface WorkflowPublishReadinessPassedWithAdvisoriesResult {
  readonly status: 'checks_passed_with_advisories';
  readonly blockingIssues: readonly [];
  readonly advisories: ReadonlyArray<WorkflowPublishReadinessAdvisory>;
  readonly topologicalNodeIds: ReadonlyArray<string>;
}

/**
 * Assessment outcome indicating all static checks passed with zero advisory findings.
 */
export interface WorkflowPublishReadinessPassedResult {
  readonly status: 'checks_passed';
  readonly blockingIssues: readonly [];
  readonly advisories: readonly [];
  readonly topologicalNodeIds: ReadonlyArray<string>;
}

/**
 * Discriminated union outcome of static workflow publish-readiness assessment.
 */
export type WorkflowPublishReadinessResult =
  | WorkflowPublishReadinessBlockedResult
  | WorkflowPublishReadinessPassedWithAdvisoriesResult
  | WorkflowPublishReadinessPassedResult;

// --- Internal Mapping Helpers (Pure, Non-Mutating) ---

function sanitizePath(path: ReadonlyArray<PropertyKey>): Array<string | number> {
  return path.map((seg) => (typeof seg === 'number' ? seg : String(seg)));
}

function toIntegrityIssue(issue: GraphIntegrityIssue): WorkflowIntegrityBlockingIssue {
  return {
    stage: 'integrity',
    code: issue.code,
    path: issue.path,
    message: issue.message,
  };
}

function toSemanticIssue(issue: WorkflowGraphSemanticIssue): WorkflowSemanticBlockingIssue {
  return {
    stage: 'semantics',
    code: issue.code,
    path: issue.path,
    message: issue.message,
  };
}

function toEntryExitIssue(issue: WorkflowEntryExitTopologyIssue): WorkflowEntryExitBlockingIssue {
  return {
    stage: 'entry_exit',
    code: issue.code,
    path: issue.path,
    message: issue.message,
  };
}

function toConfigurationIssue(
  issue: WorkflowNodeConfigValidationIssue,
): WorkflowConfigurationBlockingIssue {
  const result: WorkflowConfigurationBlockingIssue = {
    stage: 'configuration',
    nodeIndex: issue.nodeIndex,
    nodeId: issue.nodeId,
    nodeType: issue.nodeType,
    code: issue.code,
    path: issue.path,
    message: issue.message,
    ...(issue.displayPath !== undefined ? { displayPath: issue.displayPath } : {}),
  };
  return result;
}

function toNodeOutputReferenceIssue(
  issue: NodeOutputReferenceIssue,
): WorkflowNodeOutputReferenceBlockingIssue {
  return {
    stage: 'node_output_references',
    code: issue.code,
    path: issue.path,
    message: issue.message,
  };
}

function toInputReferenceIssue(issue: InputReferenceIssue): WorkflowInputReferenceBlockingIssue {
  return {
    stage: 'input_references',
    code: issue.code,
    path: issue.path,
    message: issue.message,
  };
}

/**
 * Evaluates the static publish-readiness of an untrusted workflow graph definition.
 *
 * COMPOSITION PIPELINE:
 * 1. Stage 1 (Structure): Parses input with `WorkflowGraphSchema.safeParse(input)`.
 *    If malformed, returns `status: 'blocked'` with `stage: 'structure'` issues.
 * 2. Stage 2 (Topology & Semantics): Runs `validateWorkflowEntryExitTopology(graph)`.
 *    Halts if structural integrity, reachability, branch semantics, or entry/terminal boundaries fail.
 * 3. Stage 3 (Configuration): Runs `validateWorkflowNodeConfigs(graph)`.
 *    Halts if any node configuration violates its typed schema.
 * 4. Stage 4 (Static References): Runs both `validateWorkflowNodeOutputReferences(graph)` and
 *    `validateWorkflowInputReferences(graph)` independently, collecting reference issues deterministically.
 * 5. Stage 5 (Path Coverage Advisories): Runs `analyzeWorkflowNodeOutputPathCoverage(graph)`.
 *    If advisory findings exist, returns `status: 'checks_passed_with_advisories'`.
 *    Otherwise returns `status: 'checks_passed'`.
 *
 * ARCHITECTURAL BOUNDARY & SCOPE:
 * - This function is a pure, domain-level STATIC readiness assessment.
 * - It does NOT write immutable workflow versions, verify workspace membership, check authorization,
 *   schedule execution jobs, or guarantee runtime success.
 * - Advisories represent static control-flow divergence (e.g. conditional branch merges), not hard errors.
 *
 * @param input Untrusted graph payload (typically JSON or unknown object).
 * @returns Discriminated result indicating 'blocked', 'checks_passed_with_advisories', or 'checks_passed'.
 */
export function validateWorkflowPublishReadiness(input: unknown): WorkflowPublishReadinessResult {
  // Stage 1: Structural validation on untrusted input
  const parseResult = WorkflowGraphSchema.safeParse(input);
  if (!parseResult.success) {
    const blockingIssues: WorkflowStructuralIssue[] = parseResult.error.issues.map((issue) => ({
      stage: 'structure',
      code: issue.code,
      path: sanitizePath(issue.path),
      message: issue.message,
    }));
    return {
      status: 'blocked',
      blockingIssues,
      advisories: [],
    };
  }

  const graph: WorkflowGraph = parseResult.data;

  // Stage 2: Graph integrity, semantics, and entry/terminal boundary topology
  const topologyResult = validateWorkflowEntryExitTopology(graph);
  if (!topologyResult.success) {
    let blockingIssues: WorkflowPublishReadinessBlockingIssue[];
    if (topologyResult.stage === 'integrity') {
      blockingIssues = topologyResult.issues.map(toIntegrityIssue);
    } else if (topologyResult.stage === 'semantics') {
      blockingIssues = topologyResult.issues.map(toSemanticIssue);
    } else {
      blockingIssues = topologyResult.issues.map(toEntryExitIssue);
    }
    return {
      status: 'blocked',
      blockingIssues,
      advisories: [],
    };
  }

  // Stage 3: Node-specific configuration validation
  const configResult = validateWorkflowNodeConfigs(graph);
  if (!configResult.success) {
    const blockingIssues: WorkflowConfigurationBlockingIssue[] =
      configResult.issues.map(toConfigurationIssue);
    return {
      status: 'blocked',
      blockingIssues,
      advisories: [],
    };
  }

  // Stage 4: Static reference validation (Node-Output and Input references)
  const nodeOutputResult = validateWorkflowNodeOutputReferences(graph);
  const inputRefResult = validateWorkflowInputReferences(graph);

  const referenceIssues: WorkflowPublishReadinessBlockingIssue[] = [];

  if (!nodeOutputResult.success) {
    if (nodeOutputResult.stage === 'integrity') {
      referenceIssues.push(...nodeOutputResult.issues.map(toIntegrityIssue));
    } else if (nodeOutputResult.stage === 'configuration') {
      referenceIssues.push(...nodeOutputResult.issues.map(toConfigurationIssue));
    } else {
      referenceIssues.push(...nodeOutputResult.issues.map(toNodeOutputReferenceIssue));
    }
  }

  if (!inputRefResult.success) {
    if (inputRefResult.stage === 'integrity') {
      referenceIssues.push(...inputRefResult.issues.map(toIntegrityIssue));
    } else if (inputRefResult.stage === 'configuration') {
      referenceIssues.push(...inputRefResult.issues.map(toConfigurationIssue));
    } else {
      referenceIssues.push(...inputRefResult.issues.map(toInputReferenceIssue));
    }
  }

  if (referenceIssues.length > 0) {
    return {
      status: 'blocked',
      blockingIssues: referenceIssues,
      advisories: [],
    };
  }

  // Stage 5: Branch path-coverage advisory analysis
  const coverageResult = analyzeWorkflowNodeOutputPathCoverage(graph);
  if (!coverageResult.success) {
    let blockingIssues: WorkflowPublishReadinessBlockingIssue[];
    if (coverageResult.stage === 'integrity') {
      blockingIssues = coverageResult.issues.map(toIntegrityIssue);
    } else if (coverageResult.stage === 'semantics') {
      blockingIssues = coverageResult.issues.map(toSemanticIssue);
    } else if (coverageResult.stage === 'entry_exit') {
      blockingIssues = coverageResult.issues.map(toEntryExitIssue);
    } else if (coverageResult.stage === 'configuration') {
      blockingIssues = coverageResult.issues.map(toConfigurationIssue);
    } else {
      blockingIssues = coverageResult.issues.map(toNodeOutputReferenceIssue);
    }
    return {
      status: 'blocked',
      blockingIssues,
      advisories: [],
    };
  }

  if (coverageResult.findings.length > 0) {
    return {
      status: 'checks_passed_with_advisories',
      blockingIssues: [],
      advisories: coverageResult.findings,
      topologicalNodeIds: topologyResult.topologicalNodeIds,
    };
  }

  return {
    status: 'checks_passed',
    blockingIssues: [],
    advisories: [],
    topologicalNodeIds: topologyResult.topologicalNodeIds,
  };
}
