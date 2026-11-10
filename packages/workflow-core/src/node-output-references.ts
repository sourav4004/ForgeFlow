import type { WorkflowGraph, WorkflowNodeConfigValidationIssue } from '@flowforge/contracts';
import { ConfiguredWorkflowNodeSchema, validateWorkflowNodeConfigs } from '@flowforge/contracts';
import { analyzeWorkflowGraph, type GraphIntegrityIssue } from './graph-analysis.js';

/**
 * Diagnostic codes for static workflow node-output reference validation.
 */
export type NodeOutputReferenceIssueCode =
  | 'NODE_OUTPUT_REFERENCE_NOT_FOUND'
  | 'NODE_OUTPUT_REFERENCE_SELF'
  | 'NODE_OUTPUT_REFERENCE_NOT_UPSTREAM';

/**
 * Diagnostic issue emitted when a static node-output reference fails existence, self-reference,
 * or DAG strict ancestry constraints.
 */
export interface NodeOutputReferenceIssue {
  readonly code: NodeOutputReferenceIssueCode;
  readonly path: ReadonlyArray<string | number>;
  readonly message: string;
}

/**
 * Successful validation outcome indicating all static node-output references target
 * existing strict DAG ancestors.
 */
export interface WorkflowNodeOutputReferenceSuccessResult {
  readonly success: true;
  readonly issues: readonly [];
}

/**
 * Failed validation outcome originating from foundational graph integrity analysis (Stage 1).
 */
export interface WorkflowNodeOutputReferenceIntegrityFailureResult {
  readonly success: false;
  readonly stage: 'integrity';
  readonly issues: GraphIntegrityIssue[];
}

/**
 * Failed validation outcome originating from node configuration validation (Stage 2).
 */
export interface WorkflowNodeOutputReferenceConfigurationFailureResult {
  readonly success: false;
  readonly stage: 'configuration';
  readonly issues: ReadonlyArray<WorkflowNodeConfigValidationIssue>;
}

/**
 * Failed validation outcome originating from static node-output reference checks (Stage 3).
 */
export interface WorkflowNodeOutputReferenceFailureResult {
  readonly success: false;
  readonly stage: 'references';
  readonly issues: NodeOutputReferenceIssue[];
}

/**
 * Discriminated union outcome of static node-output reference validation.
 */
export type WorkflowNodeOutputReferenceValidationResult =
  | WorkflowNodeOutputReferenceSuccessResult
  | WorkflowNodeOutputReferenceIntegrityFailureResult
  | WorkflowNodeOutputReferenceConfigurationFailureResult
  | WorkflowNodeOutputReferenceFailureResult;

/**
 * Internal representation of an extracted node-output reference occurrence.
 */
export interface ExtractedNodeOutputRef {
  readonly consumerIndex: number;
  readonly consumerId: string;
  readonly targetNodeId: string;
  readonly path: ReadonlyArray<string | number>;
}

/**
 * Extracts node-output references from approved, typed positions of a validated node configuration.
 *
 * CRITICAL PRIVACY & SECURITY RULE:
 * Never scans literal JSON values or plain strings recursively.
 * Only inspects approved ValueBinding and ValueReference structural positions.
 * Input references ({ source: 'input' }) are recognized and ignored (deferred to Milestone 2B-C2).
 */
export function extractNodeOutputReferences(graph: WorkflowGraph): ExtractedNodeOutputRef[] {
  const references: ExtractedNodeOutputRef[] = [];

  for (let nodeIndex = 0; nodeIndex < graph.nodes.length; nodeIndex += 1) {
    const rawNode = graph.nodes[nodeIndex];
    if (rawNode === undefined) continue;

    // Node configuration is guaranteed valid by Stage 2 prerequisite
    const parsed = ConfiguredWorkflowNodeSchema.safeParse(rawNode);
    if (!parsed.success) {
      continue;
    }

    const node = parsed.data;
    const consumerId = node.id;

    switch (node.type) {
      case 'INPUT':
      case 'APPROVAL':
        // No node-output references in INPUT or APPROVAL node definitions
        break;

      case 'TRANSFORM': {
        const rules = node.config.rules;
        for (let ruleIndex = 0; ruleIndex < rules.length; ruleIndex += 1) {
          const rule = rules[ruleIndex];
          if (rule === undefined) continue;

          switch (rule.operation) {
            case 'json_pick': {
              if (rule.source.source === 'node_output') {
                references.push({
                  consumerIndex: nodeIndex,
                  consumerId,
                  targetNodeId: rule.source.nodeId,
                  path: ['nodes', nodeIndex, 'config', 'rules', ruleIndex, 'source', 'nodeId'],
                });
              }
              break;
            }

            case 'json_set': {
              if (
                rule.value.type === 'reference' &&
                rule.value.reference.source === 'node_output'
              ) {
                references.push({
                  consumerIndex: nodeIndex,
                  consumerId,
                  targetNodeId: rule.value.reference.nodeId,
                  path: [
                    'nodes',
                    nodeIndex,
                    'config',
                    'rules',
                    ruleIndex,
                    'value',
                    'reference',
                    'nodeId',
                  ],
                });
              }
              break;
            }

            case 'template_string': {
              const segments = rule.segments;
              for (let segIndex = 0; segIndex < segments.length; segIndex += 1) {
                const seg = segments[segIndex];
                if (
                  seg !== undefined &&
                  seg.type === 'reference' &&
                  seg.reference.source === 'node_output'
                ) {
                  references.push({
                    consumerIndex: nodeIndex,
                    consumerId,
                    targetNodeId: seg.reference.nodeId,
                    path: [
                      'nodes',
                      nodeIndex,
                      'config',
                      'rules',
                      ruleIndex,
                      'segments',
                      segIndex,
                      'reference',
                      'nodeId',
                    ],
                  });
                }
              }
              break;
            }

            case 'math_op': {
              if (rule.left.type === 'reference' && rule.left.reference.source === 'node_output') {
                references.push({
                  consumerIndex: nodeIndex,
                  consumerId,
                  targetNodeId: rule.left.reference.nodeId,
                  path: [
                    'nodes',
                    nodeIndex,
                    'config',
                    'rules',
                    ruleIndex,
                    'left',
                    'reference',
                    'nodeId',
                  ],
                });
              }
              if (
                rule.right.type === 'reference' &&
                rule.right.reference.source === 'node_output'
              ) {
                references.push({
                  consumerIndex: nodeIndex,
                  consumerId,
                  targetNodeId: rule.right.reference.nodeId,
                  path: [
                    'nodes',
                    nodeIndex,
                    'config',
                    'rules',
                    ruleIndex,
                    'right',
                    'reference',
                    'nodeId',
                  ],
                });
              }
              break;
            }
          }
        }
        break;
      }

      case 'CONDITION': {
        const config = node.config;
        if (config.left.type === 'reference' && config.left.reference.source === 'node_output') {
          references.push({
            consumerIndex: nodeIndex,
            consumerId,
            targetNodeId: config.left.reference.nodeId,
            path: ['nodes', nodeIndex, 'config', 'left', 'reference', 'nodeId'],
          });
        }
        if ('right' in config && config.right !== undefined) {
          if (
            config.right.type === 'reference' &&
            config.right.reference.source === 'node_output'
          ) {
            references.push({
              consumerIndex: nodeIndex,
              consumerId,
              targetNodeId: config.right.reference.nodeId,
              path: ['nodes', nodeIndex, 'config', 'right', 'reference', 'nodeId'],
            });
          }
        }
        break;
      }

      case 'LLM': {
        if (
          node.config.prompt.type === 'reference' &&
          node.config.prompt.reference.source === 'node_output'
        ) {
          references.push({
            consumerIndex: nodeIndex,
            consumerId,
            targetNodeId: node.config.prompt.reference.nodeId,
            path: ['nodes', nodeIndex, 'config', 'prompt', 'reference', 'nodeId'],
          });
        }
        break;
      }

      case 'MCP_TOOL': {
        const args = node.config.arguments;
        if (args !== undefined) {
          for (const [argKey, binding] of Object.entries(args)) {
            if (binding.type === 'reference' && binding.reference.source === 'node_output') {
              references.push({
                consumerIndex: nodeIndex,
                consumerId,
                targetNodeId: binding.reference.nodeId,
                path: ['nodes', nodeIndex, 'config', 'arguments', argKey, 'reference', 'nodeId'],
              });
            }
          }
        }
        break;
      }

      case 'OUTPUT': {
        for (const [mapKey, binding] of Object.entries(node.config.payloadMapping)) {
          if (binding.type === 'reference' && binding.reference.source === 'node_output') {
            references.push({
              consumerIndex: nodeIndex,
              consumerId,
              targetNodeId: binding.reference.nodeId,
              path: ['nodes', nodeIndex, 'config', 'payloadMapping', mapKey, 'reference', 'nodeId'],
            });
          }
        }
        break;
      }
    }
  }

  return references;
}

/**
 * Computes strict graph ancestors of a consumer node using reverse BFS traversal.
 * An ancestor of node v is any node u such that there exists a directed path from u to v of length >= 1.
 */
function computeStrictAncestors(
  consumerId: string,
  reverseAdj: Map<string, string[]>,
): Set<string> {
  const ancestors = new Set<string>();
  const queue: string[] = [];

  const directParents = reverseAdj.get(consumerId);
  if (directParents !== undefined) {
    for (const parent of directParents) {
      if (!ancestors.has(parent)) {
        ancestors.add(parent);
        queue.push(parent);
      }
    }
  }

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;

    const parents = reverseAdj.get(current);
    if (parents !== undefined) {
      for (const parent of parents) {
        if (!ancestors.has(parent)) {
          ancestors.add(parent);
          queue.push(parent);
        }
      }
    }
  }

  return ancestors;
}

/**
 * Pure, deterministic workflow node-output reference validator.
 *
 * Verifies that all statically inspectable node_output references target existing,
 * strictly upstream workflow nodes in the DAG.
 *
 * Validation is staged:
 * 1. Stage 1 (Integrity): Graph structural integrity via `analyzeWorkflowGraph(graph)`.
 *    Halts if duplicates, dangling edges, or cycles are present.
 * 2. Stage 2 (Configuration): Node configuration validity via `validateWorkflowNodeConfigs(graph)`.
 *    Halts if any node configuration is incomplete or invalid.
 * 3. Stage 3 (Reference Lineage): Statically verifies each node_output reference targets an
 *    existing node, is not self-referential, and has a directed path to the consuming node.
 *
 * ARCHITECTURAL BOUNDARY & CONDITIONAL BRANCH LIMITATION:
 * Static ancestry verifies DAG connectivity, but DOES NOT guarantee that a referenced node
 * will execute at runtime when conditional branching (CONDITION true/false branches) is involved.
 * Runtime branch evaluation, dominator analysis, and join barriers are deferred to runtime engines.
 * INPUT references ({ source: 'input' }) are recognized and deferred to Milestone 2B-C2.
 *
 * @param graph Structurally valid workflow graph definition.
 * @returns Discriminated result indicating success or stage-specific failure diagnostics.
 */
export function validateWorkflowNodeOutputReferences(
  graph: WorkflowGraph,
): WorkflowNodeOutputReferenceValidationResult {
  // Stage 1: Graph integrity prerequisite
  const integrityResult = analyzeWorkflowGraph(graph);
  if (!integrityResult.success) {
    return {
      success: false,
      stage: 'integrity',
      issues: integrityResult.issues,
    };
  }

  // Stage 2: Node configuration validity prerequisite
  const configResult = validateWorkflowNodeConfigs(graph);
  if (!configResult.success) {
    return {
      success: false,
      stage: 'configuration',
      issues: configResult.issues,
    };
  }

  // Stage 3: Node-output reference lineage checks
  const extractedReferences = extractNodeOutputReferences(graph);
  if (extractedReferences.length === 0) {
    return {
      success: true,
      issues: [],
    };
  }

  // Build node ID lookup set
  const allNodeIds = new Set<string>();
  for (let i = 0; i < graph.nodes.length; i += 1) {
    const node = graph.nodes[i];
    if (node !== undefined) {
      allNodeIds.add(node.id);
    }
  }

  // Build reverse adjacency list (target -> incoming sources)
  const reverseAdj = new Map<string, string[]>();
  for (let i = 0; i < graph.edges.length; i += 1) {
    const edge = graph.edges[i];
    if (edge === undefined) continue;

    let incoming = reverseAdj.get(edge.target);
    if (incoming === undefined) {
      incoming = [];
      reverseAdj.set(edge.target, incoming);
    }
    incoming.push(edge.source);
  }

  // Cache strict ancestors per consumer node to avoid redundant graph traversals
  const ancestorCache = new Map<string, Set<string>>();

  const referenceIssues: NodeOutputReferenceIssue[] = [];

  for (let refIndex = 0; refIndex < extractedReferences.length; refIndex += 1) {
    const ref = extractedReferences[refIndex];
    if (ref === undefined) continue;

    // Rule A: Target node existence
    if (!allNodeIds.has(ref.targetNodeId)) {
      referenceIssues.push({
        code: 'NODE_OUTPUT_REFERENCE_NOT_FOUND',
        path: ref.path,
        message: `Referenced node '${ref.targetNodeId}' does not exist in the workflow graph`,
      });
      continue;
    }

    // Rule B: Self-reference prohibition
    if (ref.targetNodeId === ref.consumerId) {
      referenceIssues.push({
        code: 'NODE_OUTPUT_REFERENCE_SELF',
        path: ref.path,
        message: `Node '${ref.consumerId}' cannot reference its own output`,
      });
      continue;
    }

    // Rule C: Strict DAG ancestry
    let ancestors = ancestorCache.get(ref.consumerId);
    if (ancestors === undefined) {
      ancestors = computeStrictAncestors(ref.consumerId, reverseAdj);
      ancestorCache.set(ref.consumerId, ancestors);
    }

    if (!ancestors.has(ref.targetNodeId)) {
      referenceIssues.push({
        code: 'NODE_OUTPUT_REFERENCE_NOT_UPSTREAM',
        path: ref.path,
        message: `Referenced node '${ref.targetNodeId}' is not an upstream ancestor of consuming node '${ref.consumerId}'`,
      });
    }
  }

  if (referenceIssues.length === 0) {
    return {
      success: true,
      issues: [],
    };
  }

  return {
    success: false,
    stage: 'references',
    issues: referenceIssues,
  };
}
