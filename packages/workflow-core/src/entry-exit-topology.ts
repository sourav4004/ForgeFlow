import type { WorkflowGraph } from '@flowforge/contracts';
import type { GraphIntegrityIssue } from './graph-analysis.js';
import {
  validateWorkflowGraphSemantics,
  type WorkflowGraphSemanticIssue,
} from './graph-semantics.js';

/**
 * Diagnostic codes for workflow entry and terminal topology validation.
 */
export type WorkflowEntryExitTopologyIssueCode =
  'INPUT_HAS_INCOMING_EDGE' | 'OUTPUT_HAS_OUTGOING_EDGE';

/**
 * Diagnostic issue emitted when an edge violates entry (INPUT indegree = 0)
 * or terminal (OUTPUT outdegree = 0) topology rules.
 */
export interface WorkflowEntryExitTopologyIssue {
  readonly code: WorkflowEntryExitTopologyIssueCode;
  readonly path: ReadonlyArray<string | number>;
  readonly message: string;
}

/**
 * Successful validation outcome indicating the graph satisfies structural integrity,
 * semantic branch/reachability rules, and strict entry/terminal boundary topology.
 */
export interface WorkflowEntryExitTopologySuccessResult {
  readonly success: true;
  readonly issues: [];
  readonly topologicalNodeIds: string[];
}

/**
 * Failed validation outcome originating from foundational graph integrity analysis (Stage 1).
 */
export interface WorkflowEntryExitTopologyIntegrityFailureResult {
  readonly success: false;
  readonly stage: 'integrity';
  readonly issues: GraphIntegrityIssue[];
}

/**
 * Failed validation outcome originating from graph semantic branch or reachability rules (Stage 2).
 */
export interface WorkflowEntryExitTopologySemanticFailureResult {
  readonly success: false;
  readonly stage: 'semantics';
  readonly issues: WorkflowGraphSemanticIssue[];
}

/**
 * Failed validation outcome originating from entry or terminal topology rules (Stage 3).
 */
export interface WorkflowEntryExitTopologyFailureResult {
  readonly success: false;
  readonly stage: 'entry_exit';
  readonly issues: WorkflowEntryExitTopologyIssue[];
}

/**
 * Discriminated union outcome of workflow entry and terminal topology validation.
 */
export type WorkflowEntryExitTopologyResult =
  | WorkflowEntryExitTopologySuccessResult
  | WorkflowEntryExitTopologyIntegrityFailureResult
  | WorkflowEntryExitTopologySemanticFailureResult
  | WorkflowEntryExitTopologyFailureResult;

/**
 * Pure, deterministic workflow entry and terminal topology validator.
 *
 * Enforces two foundational DAG boundary invariants on top of graph semantics:
 * 1. Entry Boundary: Nodes of type 'INPUT' must have indegree === 0 (no incoming edges).
 * 2. Terminal Boundary: Nodes of type 'OUTPUT' must have outdegree === 0 (no outgoing edges).
 *
 * Staged Execution:
 * - Stage 1 & 2: Reuses `validateWorkflowGraphSemantics(graph)`. If integrity or semantic
 *   rules fail, immediately returns failure with stage: 'integrity' or stage: 'semantics'
 *   and preserves the original issues without emitting speculative topology errors.
 * - Stage 3: Evaluates entry/terminal topology. If violations exist, returns failure with
 *   stage: 'entry_exit'. Otherwise returns success with the deterministic topological ordering.
 *
 * MULTIPLE INPUT & OUTPUT POLICY:
 * - Supports workflows with multiple INPUT nodes (all must have indegree === 0).
 * - Supports workflows with multiple OUTPUT nodes (all must have outdegree === 0).
 * - Does not require every OUTPUT to be reached by every dynamic branch execution.
 *
 * @param graph Structurally valid workflow graph definition.
 * @returns Discriminated result indicating success or stage-specific failure diagnostics.
 */
export function validateWorkflowEntryExitTopology(
  graph: WorkflowGraph,
): WorkflowEntryExitTopologyResult {
  // Stages 1 & 2: Graph integrity and semantics prerequisites
  const semanticResult = validateWorkflowGraphSemantics(graph);
  if (!semanticResult.success) {
    if (semanticResult.stage === 'integrity') {
      return {
        success: false,
        stage: 'integrity',
        issues: semanticResult.issues,
      };
    }
    return {
      success: false,
      stage: 'semantics',
      issues: semanticResult.issues,
    };
  }

  // Index node types for O(1) lookup
  const nodeTypeMap = new Map<string, string>();
  for (let i = 0; i < graph.nodes.length; i += 1) {
    const node = graph.nodes[i];
    if (node !== undefined) {
      nodeTypeMap.set(node.id, node.type);
    }
  }

  const topologyIssues: WorkflowEntryExitTopologyIssue[] = [];

  // Stage 3: Scan edges in original array order
  for (let edgeIndex = 0; edgeIndex < graph.edges.length; edgeIndex += 1) {
    const edge = graph.edges[edgeIndex];
    if (edge === undefined) continue;

    const sourceType = nodeTypeMap.get(edge.source);
    const targetType = nodeTypeMap.get(edge.target);

    // Rule A: OUTPUT nodes cannot have outgoing edges (outdegree === 0)
    if (sourceType === 'OUTPUT') {
      topologyIssues.push({
        code: 'OUTPUT_HAS_OUTGOING_EDGE',
        path: ['edges', edgeIndex, 'source'],
        message: `OUTPUT node '${edge.source}' cannot have outgoing edges`,
      });
    }

    // Rule B: INPUT nodes cannot have incoming edges (indegree === 0)
    if (targetType === 'INPUT') {
      topologyIssues.push({
        code: 'INPUT_HAS_INCOMING_EDGE',
        path: ['edges', edgeIndex, 'target'],
        message: `INPUT node '${edge.target}' cannot have incoming edges`,
      });
    }
  }

  if (topologyIssues.length > 0) {
    return {
      success: false,
      stage: 'entry_exit',
      issues: topologyIssues,
    };
  }

  return {
    success: true,
    issues: [],
    topologicalNodeIds: semanticResult.topologicalNodeIds,
  };
}
