import type { WorkflowGraph, WorkflowNodeConfigValidationIssue } from '@flowforge/contracts';
import type { GraphIntegrityIssue } from './graph-analysis.js';
import type { WorkflowGraphSemanticIssue } from './graph-semantics.js';
import {
  validateWorkflowEntryExitTopology,
  type WorkflowEntryExitTopologyIssue,
} from './entry-exit-topology.js';
import {
  extractNodeOutputReferences,
  validateWorkflowNodeOutputReferences,
  type NodeOutputReferenceIssue,
} from './node-output-references.js';

/**
 * Diagnostic code for static branch-conditioned node-output path coverage findings.
 */
export type NodeOutputPathCoverageFindingCode = 'NODE_OUTPUT_REFERENCE_NOT_ON_ALL_INPUT_PATHS';

/**
 * Advisory finding emitted when a statically valid node-output reference targets an upstream
 * ancestor that does not lie on every directed path from workflow INPUT entrypoints to the consumer.
 *
 * Privacy & Security Model:
 * Authored identifiers and property paths legitimately appear in `path` and `message`.
 * Raw config values, prompts, credentials, and secrets are never copied into findings.
 */
export interface NodeOutputPathCoverageFinding {
  readonly code: NodeOutputPathCoverageFindingCode;
  readonly path: ReadonlyArray<string | number>;
  readonly message: string;
}

/**
 * Successful path-coverage outcome.
 * Indicates all prerequisite stages passed and advisory path coverage was analyzed.
 * Contains zero or more advisory findings (does not imply publishability or execution safety).
 */
export interface WorkflowNodeOutputPathCoverageSuccessResult {
  readonly success: true;
  readonly issues: readonly [];
  readonly findings: ReadonlyArray<NodeOutputPathCoverageFinding>;
}

/**
 * Failed analysis outcome originating from foundational graph integrity analysis (Stage 1).
 */
export interface WorkflowNodeOutputPathCoverageIntegrityFailureResult {
  readonly success: false;
  readonly stage: 'integrity';
  readonly issues: ReadonlyArray<GraphIntegrityIssue>;
}

/**
 * Failed analysis outcome originating from graph semantic rules (Stage 1).
 */
export interface WorkflowNodeOutputPathCoverageSemanticFailureResult {
  readonly success: false;
  readonly stage: 'semantics';
  readonly issues: ReadonlyArray<WorkflowGraphSemanticIssue>;
}

/**
 * Failed analysis outcome originating from entry/terminal topology rules (Stage 1).
 */
export interface WorkflowNodeOutputPathCoverageEntryExitFailureResult {
  readonly success: false;
  readonly stage: 'entry_exit';
  readonly issues: ReadonlyArray<WorkflowEntryExitTopologyIssue>;
}

/**
 * Failed analysis outcome originating from node configuration validation (Stage 2).
 */
export interface WorkflowNodeOutputPathCoverageConfigurationFailureResult {
  readonly success: false;
  readonly stage: 'configuration';
  readonly issues: ReadonlyArray<WorkflowNodeConfigValidationIssue>;
}

/**
 * Failed analysis outcome originating from node-output reference lineage checks (Stage 2).
 */
export interface WorkflowNodeOutputPathCoverageReferencesFailureResult {
  readonly success: false;
  readonly stage: 'references';
  readonly issues: ReadonlyArray<NodeOutputReferenceIssue>;
}

/**
 * Discriminated union outcome of branch-conditioned node-output path coverage analysis.
 */
export type WorkflowNodeOutputPathCoverageResult =
  | WorkflowNodeOutputPathCoverageSuccessResult
  | WorkflowNodeOutputPathCoverageIntegrityFailureResult
  | WorkflowNodeOutputPathCoverageSemanticFailureResult
  | WorkflowNodeOutputPathCoverageEntryExitFailureResult
  | WorkflowNodeOutputPathCoverageConfigurationFailureResult
  | WorkflowNodeOutputPathCoverageReferencesFailureResult;

/**
 * Traverses forward from all INPUT entrypoints excluding a given producer node P,
 * returning the set of all node IDs reachable without traversing through P.
 *
 * @param excludedProducerId Node ID to exclude from traversal.
 * @param inputNodeIds List of all INPUT entrypoint node IDs in the workflow.
 * @param forwardAdj Directed adjacency list (source -> targets).
 * @returns Set of node IDs reachable from any INPUT without visiting excludedProducerId.
 */
function computeReachableNodesWithout(
  excludedProducerId: string,
  inputNodeIds: readonly string[],
  forwardAdj: Map<string, string[]>,
): Set<string> {
  const reachable = new Set<string>();
  const queue: string[] = [];

  for (let i = 0; i < inputNodeIds.length; i += 1) {
    const inputId = inputNodeIds[i];
    if (inputId !== undefined && inputId !== excludedProducerId) {
      reachable.add(inputId);
      queue.push(inputId);
    }
  }

  let head = 0;
  while (head < queue.length) {
    const current = queue[head];
    head += 1;
    if (current === undefined) continue;

    const neighbors = forwardAdj.get(current);
    if (neighbors !== undefined) {
      for (let i = 0; i < neighbors.length; i += 1) {
        const neighbor = neighbors[i];
        if (neighbor !== undefined && neighbor !== excludedProducerId && !reachable.has(neighbor)) {
          reachable.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
  }

  return reachable;
}

/**
 * Pure, deterministic workflow branch-conditioned node-output path coverage analyzer.
 *
 * Evaluates whether statically valid `source: 'node_output'` references target producer nodes
 * that lie on EVERY directed path from workflow INPUT entrypoints to the consuming node.
 *
 * FUNDAMENTAL DISTINCTION & ADVISORY NATURE:
 * - Milestone 2B-C1 verified strict DAG ancestry (existence of at least one directed path from P to C).
 * - This analyzer detects whether alternate directed paths from an INPUT to C bypass P (e.g. conditional branches).
 * - Findings are ADVISORY static-control-flow findings, NOT hard graph errors or publication blockers.
 * - Absence of findings does NOT guarantee runtime data availability (which depends on runtime branch
 *   execution, successful completion, and payload shapes).
 *
 * STAGED EXECUTION:
 * - Stage 1 (Integrity, Semantics, Entry/Exit Topology):
 *   Reuses `validateWorkflowEntryExitTopology(graph)`. If any integrity, semantic, or boundary
 *   defect exists, immediately returns failure with preserved stage and diagnostic issues.
 * - Stage 2 (Configuration Validity & Reference Lineage):
 *   Reuses `validateWorkflowNodeOutputReferences(graph)`. If any configuration error, missing target,
 *   self-reference, or non-upstream reference exists, immediately returns failure with preserved stage and issues.
 * - Stage 3 (Path Coverage Findings):
 *   Groups referenced producers and performs forward reachability traversal excluding each producer.
 *   Emits an advisory finding for each reference occurrence whose consumer remains reachable without the producer.
 *
 * @param graph Structurally valid workflow graph definition.
 * @returns Discriminated result indicating success with advisory findings or stage-specific prerequisite failures.
 */
export function analyzeWorkflowNodeOutputPathCoverage(
  graph: WorkflowGraph,
): WorkflowNodeOutputPathCoverageResult {
  // Stage 1: Integrity, semantics, and entry/terminal topology prerequisites
  const entryExitResult = validateWorkflowEntryExitTopology(graph);
  if (!entryExitResult.success) {
    if (entryExitResult.stage === 'integrity') {
      return {
        success: false,
        stage: 'integrity',
        issues: entryExitResult.issues,
      };
    }
    if (entryExitResult.stage === 'semantics') {
      return {
        success: false,
        stage: 'semantics',
        issues: entryExitResult.issues,
      };
    }
    return {
      success: false,
      stage: 'entry_exit',
      issues: entryExitResult.issues,
    };
  }

  // Stage 2: Configuration and static reference lineage prerequisites
  const referencesResult = validateWorkflowNodeOutputReferences(graph);
  if (!referencesResult.success) {
    if (referencesResult.stage === 'integrity') {
      return {
        success: false,
        stage: 'integrity',
        issues: referencesResult.issues,
      };
    }
    if (referencesResult.stage === 'configuration') {
      return {
        success: false,
        stage: 'configuration',
        issues: referencesResult.issues,
      };
    }
    return {
      success: false,
      stage: 'references',
      issues: referencesResult.issues,
    };
  }

  // Stage 3: Branch-conditioned path coverage analysis
  const extractedReferences = extractNodeOutputReferences(graph);
  if (extractedReferences.length === 0) {
    return {
      success: true,
      issues: [],
      findings: [],
    };
  }

  // Collect all INPUT entrypoint node IDs
  const inputNodeIds: string[] = [];
  for (let i = 0; i < graph.nodes.length; i += 1) {
    const node = graph.nodes[i];
    if (node !== undefined && node.type === 'INPUT') {
      inputNodeIds.push(node.id);
    }
  }

  // Build forward adjacency list (source -> targets)
  const forwardAdj = new Map<string, string[]>();
  for (let i = 0; i < graph.edges.length; i += 1) {
    const edge = graph.edges[i];
    if (edge === undefined) continue;

    let targets = forwardAdj.get(edge.source);
    if (targets === undefined) {
      targets = [];
      forwardAdj.set(edge.source, targets);
    }
    targets.push(edge.target);
  }

  // Intra-call cache for reachability sets without producer P
  const reachabilityWithoutProducerCache = new Map<string, Set<string>>();

  const findings: NodeOutputPathCoverageFinding[] = [];

  for (let refIndex = 0; refIndex < extractedReferences.length; refIndex += 1) {
    const ref = extractedReferences[refIndex];
    if (ref === undefined) continue;

    const producerId = ref.targetNodeId;
    let reachableWithoutProducer = reachabilityWithoutProducerCache.get(producerId);

    if (reachableWithoutProducer === undefined) {
      reachableWithoutProducer = computeReachableNodesWithout(producerId, inputNodeIds, forwardAdj);
      reachabilityWithoutProducerCache.set(producerId, reachableWithoutProducer);
    }

    // If consumer node remains reachable from an INPUT without visiting producerId,
    // then producerId does NOT dominate the consumer on all entry paths.
    if (reachableWithoutProducer.has(ref.consumerId)) {
      findings.push({
        code: 'NODE_OUTPUT_REFERENCE_NOT_ON_ALL_INPUT_PATHS',
        path: ref.path,
        message: `Referenced node '${producerId}' is not present on every INPUT-to-consumer path; runtime output availability may depend on branch or join behavior.`,
      });
    }
  }

  return {
    success: true,
    issues: [],
    findings,
  };
}
