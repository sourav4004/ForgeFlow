import type { WorkflowGraph } from '@flowforge/contracts';
import { analyzeWorkflowGraph, type GraphIntegrityIssue } from './graph-analysis.js';

/**
 * Machine-readable semantic diagnostic codes for workflow graph branch and reachability analysis.
 */
export type WorkflowGraphSemanticIssueCode =
  | 'MISSING_INPUT_NODE'
  | 'MISSING_OUTPUT_NODE'
  | 'CONDITION_TRUE_BRANCH_MISSING'
  | 'CONDITION_FALSE_BRANCH_MISSING'
  | 'CONDITION_OUTCOME_DUPLICATE'
  | 'CONDITION_EDGE_OUTCOME_MISSING'
  | 'CONDITION_EXTRA_OUTGOING_EDGE'
  | 'NON_CONDITION_EDGE_OUTCOME'
  | 'UNREACHABLE_FROM_INPUT'
  | 'CANNOT_REACH_OUTPUT';

/**
 * Diagnostic issue describing a semantic branch or reachability defect within a workflow graph.
 */
export interface WorkflowGraphSemanticIssue {
  readonly code: WorkflowGraphSemanticIssueCode;
  readonly path: ReadonlyArray<string | number>;
  readonly message: string;
}

/**
 * Successful semantic analysis outcome containing deterministic topological node ordering.
 */
export interface WorkflowGraphSemanticsSuccessResult {
  readonly success: true;
  readonly issues: [];
  readonly topologicalNodeIds: string[];
}

/**
 * Failed graph analysis outcome originating from the foundational graph integrity stage.
 */
export interface WorkflowGraphSemanticsIntegrityFailureResult {
  readonly success: false;
  readonly stage: 'integrity';
  readonly issues: GraphIntegrityIssue[];
}

/**
 * Failed graph analysis outcome originating from semantic branch or reachability rules.
 */
export interface WorkflowGraphSemanticsSemanticFailureResult {
  readonly success: false;
  readonly stage: 'semantics';
  readonly issues: WorkflowGraphSemanticIssue[];
}

/**
 * Discriminated union outcome of workflow graph semantic validation.
 */
export type WorkflowGraphSemanticsResult =
  | WorkflowGraphSemanticsSuccessResult
  | WorkflowGraphSemanticsIntegrityFailureResult
  | WorkflowGraphSemanticsSemanticFailureResult;

/**
 * Pure, deterministic workflow graph semantic validation function.
 *
 * Staged execution:
 * 1. Integrity Stage: Reuses analyzeWorkflowGraph(graph) to verify identifier uniqueness,
 *    edge referential integrity, and acyclicity. If integrity fails, immediately returns
 *    failure with stage: 'integrity' and suppresses semantic checks.
 * 2. Semantic Stage:
 *    - Validates presence of at least one INPUT node and at least one OUTPUT node.
 *    - Validates CONDITION node branch rules: exactly one TRUE and one FALSE outgoing edge.
 *    - Validates non-CONDITION edges omit conditionOutcome metadata.
 *    - Validates static forward reachability from INPUT nodes (when at least one INPUT exists).
 *    - Validates static reverse reachability to OUTPUT nodes (when at least one OUTPUT exists).
 *
 * @param graph Structurally valid workflow graph definition.
 * @returns Discriminated result indicating success with topological ordering or failure with stage-specific diagnostics.
 */
export function validateWorkflowGraphSemantics(graph: WorkflowGraph): WorkflowGraphSemanticsResult {
  // 1. Integrity-first gating
  const integrityResult = analyzeWorkflowGraph(graph);
  if (!integrityResult.success) {
    return {
      success: false,
      stage: 'integrity',
      issues: integrityResult.issues,
    };
  }

  const semanticIssues: WorkflowGraphSemanticIssue[] = [];

  // Index nodes and collect entry/terminal nodes
  const nodeMap = new Map<string, { type: string; index: number }>();
  const inputNodeIds: string[] = [];
  const outputNodeIds: string[] = [];

  for (let index = 0; index < graph.nodes.length; index += 1) {
    const node = graph.nodes[index];
    if (node === undefined) continue;

    nodeMap.set(node.id, { type: node.type, index });
    if (node.type === 'INPUT') {
      inputNodeIds.push(node.id);
    } else if (node.type === 'OUTPUT') {
      outputNodeIds.push(node.id);
    }
  }

  // Check presence of at least one INPUT and at least one OUTPUT
  const hasInput = inputNodeIds.length > 0;
  const hasOutput = outputNodeIds.length > 0;

  if (!hasInput) {
    semanticIssues.push({
      code: 'MISSING_INPUT_NODE',
      path: ['nodes'],
      message: 'Workflow graph must contain at least one INPUT node',
    });
  }

  if (!hasOutput) {
    semanticIssues.push({
      code: 'MISSING_OUTPUT_NODE',
      path: ['nodes'],
      message: 'Workflow graph must contain at least one OUTPUT node',
    });
  }

  // Build forward and reverse adjacency lists, and group outgoing edges by source node
  const forwardAdj = new Map<string, string[]>();
  const reverseAdj = new Map<string, string[]>();
  const outgoingEdgesBySource = new Map<
    string,
    Array<{ edgeIndex: number; edgeId: string; outcome?: string | undefined }>
  >();

  for (const node of graph.nodes) {
    forwardAdj.set(node.id, []);
    reverseAdj.set(node.id, []);
    outgoingEdgesBySource.set(node.id, []);
  }

  for (let edgeIndex = 0; edgeIndex < graph.edges.length; edgeIndex += 1) {
    const edge = graph.edges[edgeIndex];
    if (edge === undefined) continue;

    forwardAdj.get(edge.source)?.push(edge.target);
    reverseAdj.get(edge.target)?.push(edge.source);
    outgoingEdgesBySource.get(edge.source)?.push({
      edgeIndex,
      edgeId: edge.id,
      outcome: edge.conditionOutcome,
    });
  }

  // Compute static forward reachability from all INPUT nodes via BFS
  const reachableFromInput = new Set<string>();
  if (hasInput) {
    const queue = [...inputNodeIds];
    for (const id of queue) {
      reachableFromInput.add(id);
    }

    while (queue.length > 0) {
      const current = queue.shift();
      if (current === undefined) break;

      const neighbors = forwardAdj.get(current);
      if (neighbors !== undefined) {
        for (const neighbor of neighbors) {
          if (!reachableFromInput.has(neighbor)) {
            reachableFromInput.add(neighbor);
            queue.push(neighbor);
          }
        }
      }
    }
  }

  // Compute static reverse reachability to any OUTPUT node via BFS
  const canReachOutput = new Set<string>();
  if (hasOutput) {
    const queue = [...outputNodeIds];
    for (const id of queue) {
      canReachOutput.add(id);
    }

    while (queue.length > 0) {
      const current = queue.shift();
      if (current === undefined) break;

      const predecessors = reverseAdj.get(current);
      if (predecessors !== undefined) {
        for (const pred of predecessors) {
          if (!canReachOutput.has(pred)) {
            canReachOutput.add(pred);
            queue.push(pred);
          }
        }
      }
    }
  }

  // Evaluate node-level rules in original node array order
  for (let nodeIndex = 0; nodeIndex < graph.nodes.length; nodeIndex += 1) {
    const node = graph.nodes[nodeIndex];
    if (node === undefined) continue;

    // CONDITION branch missing rules
    if (node.type === 'CONDITION') {
      const outgoing = outgoingEdgesBySource.get(node.id) ?? [];
      let hasTrue = false;
      let hasFalse = false;

      for (const out of outgoing) {
        if (out.outcome === 'TRUE') hasTrue = true;
        if (out.outcome === 'FALSE') hasFalse = true;
      }

      if (!hasTrue) {
        semanticIssues.push({
          code: 'CONDITION_TRUE_BRANCH_MISSING',
          path: ['nodes', nodeIndex, 'id'],
          message: `Condition node "${node.id}" at index ${nodeIndex} is missing an outgoing TRUE branch edge`,
        });
      }

      if (!hasFalse) {
        semanticIssues.push({
          code: 'CONDITION_FALSE_BRANCH_MISSING',
          path: ['nodes', nodeIndex, 'id'],
          message: `Condition node "${node.id}" at index ${nodeIndex} is missing an outgoing FALSE branch edge`,
        });
      }
    }

    // Forward reachability check (only when at least one INPUT exists)
    if (hasInput && !reachableFromInput.has(node.id)) {
      semanticIssues.push({
        code: 'UNREACHABLE_FROM_INPUT',
        path: ['nodes', nodeIndex, 'id'],
        message: `Node "${node.id}" at index ${nodeIndex} is not reachable from any INPUT node`,
      });
    }

    // Reverse reachability check (only when at least one OUTPUT exists)
    if (hasOutput && !canReachOutput.has(node.id)) {
      semanticIssues.push({
        code: 'CANNOT_REACH_OUTPUT',
        path: ['nodes', nodeIndex, 'id'],
        message: `Node "${node.id}" at index ${nodeIndex} cannot reach any OUTPUT node`,
      });
    }
  }

  // Track edge-level condition branch states
  const conditionSeenOutcomes = new Map<
    string,
    { seenTrue: boolean; seenFalse: boolean; outgoingCount: number }
  >();
  for (const node of graph.nodes) {
    if (node.type === 'CONDITION') {
      conditionSeenOutcomes.set(node.id, { seenTrue: false, seenFalse: false, outgoingCount: 0 });
    }
  }

  // Evaluate edge-level rules in original edge array order
  for (let edgeIndex = 0; edgeIndex < graph.edges.length; edgeIndex += 1) {
    const edge = graph.edges[edgeIndex];
    if (edge === undefined) continue;

    const sourceInfo = nodeMap.get(edge.source);
    const isConditionSource = sourceInfo?.type === 'CONDITION';

    if (!isConditionSource) {
      if (edge.conditionOutcome !== undefined) {
        semanticIssues.push({
          code: 'NON_CONDITION_EDGE_OUTCOME',
          path: ['edges', edgeIndex, 'conditionOutcome'],
          message: `Edge "${edge.id}" at index ${edgeIndex} from non-condition node "${edge.source}" cannot have conditionOutcome`,
        });
      }
    } else {
      const condState = conditionSeenOutcomes.get(edge.source);
      if (condState !== undefined) {
        condState.outgoingCount += 1;

        if (edge.conditionOutcome === undefined) {
          semanticIssues.push({
            code: 'CONDITION_EDGE_OUTCOME_MISSING',
            path: ['edges', edgeIndex, 'conditionOutcome'],
            message: `Outgoing edge "${edge.id}" at index ${edgeIndex} from condition node "${edge.source}" is missing conditionOutcome label`,
          });
        } else if (edge.conditionOutcome === 'TRUE') {
          if (condState.seenTrue) {
            semanticIssues.push({
              code: 'CONDITION_OUTCOME_DUPLICATE',
              path: ['edges', edgeIndex, 'conditionOutcome'],
              message: `Duplicate condition outcome "TRUE" on edge "${edge.id}" at index ${edgeIndex} from condition node "${edge.source}"`,
            });
          } else {
            condState.seenTrue = true;
          }
        } else if (edge.conditionOutcome === 'FALSE') {
          if (condState.seenFalse) {
            semanticIssues.push({
              code: 'CONDITION_OUTCOME_DUPLICATE',
              path: ['edges', edgeIndex, 'conditionOutcome'],
              message: `Duplicate condition outcome "FALSE" on edge "${edge.id}" at index ${edgeIndex} from condition node "${edge.source}"`,
            });
          } else {
            condState.seenFalse = true;
          }
        }

        if (condState.outgoingCount > 2) {
          semanticIssues.push({
            code: 'CONDITION_EXTRA_OUTGOING_EDGE',
            path: ['edges', edgeIndex, 'id'],
            message: `Edge "${edge.id}" at index ${edgeIndex} is an extra outgoing edge from condition node "${edge.source}" (condition nodes must have exactly two outgoing edges)`,
          });
        }
      }
    }
  }

  if (semanticIssues.length > 0) {
    return {
      success: false,
      stage: 'semantics',
      issues: semanticIssues,
    };
  }

  return {
    success: true,
    issues: [],
    topologicalNodeIds: integrityResult.topologicalNodeIds,
  };
}
