import type { WorkflowGraph, WorkflowNodeConfigValidationIssue } from '@flowforge/contracts';
import { ConfiguredWorkflowNodeSchema, validateWorkflowNodeConfigs } from '@flowforge/contracts';
import { analyzeWorkflowGraph, type GraphIntegrityIssue } from './graph-analysis.js';

/**
 * Diagnostic codes for static workflow trigger input reference validation.
 */
export type InputReferenceIssueCode =
  'INPUT_REFERENCE_FIELD_NOT_FOUND' | 'INPUT_REFERENCE_FIELD_AMBIGUOUS';

/**
 * Diagnostic issue emitted when an input reference fails field existence
 * or encounters ambiguous duplicate declarations across multiple INPUT nodes.
 */
export interface InputReferenceIssue {
  readonly code: InputReferenceIssueCode;
  readonly path: ReadonlyArray<string | number>;
  readonly message: string;
}

/**
 * Successful validation outcome indicating all inspectable source: 'input' references
 * resolve to exactly one declared INPUT field under the V1 workflow-level namespace policy.
 */
export interface WorkflowInputReferenceSuccessResult {
  readonly success: true;
  readonly issues: readonly [];
}

/**
 * Failed validation outcome originating from foundational graph integrity analysis (Stage 1).
 */
export interface WorkflowInputReferenceIntegrityFailureResult {
  readonly success: false;
  readonly stage: 'integrity';
  readonly issues: GraphIntegrityIssue[];
}

/**
 * Failed validation outcome originating from node configuration validation (Stage 2).
 */
export interface WorkflowInputReferenceConfigurationFailureResult {
  readonly success: false;
  readonly stage: 'configuration';
  readonly issues: ReadonlyArray<WorkflowNodeConfigValidationIssue>;
}

/**
 * Failed validation outcome originating from static input reference checks (Stage 3).
 */
export interface WorkflowInputReferenceFailureResult {
  readonly success: false;
  readonly stage: 'input_references';
  readonly issues: InputReferenceIssue[];
}

/**
 * Discriminated union outcome of static trigger input reference validation.
 */
export type WorkflowInputReferenceValidationResult =
  | WorkflowInputReferenceSuccessResult
  | WorkflowInputReferenceIntegrityFailureResult
  | WorkflowInputReferenceConfigurationFailureResult
  | WorkflowInputReferenceFailureResult;

/**
 * Internal representation of an extracted source: 'input' reference occurrence.
 */
interface ExtractedInputRef {
  readonly consumerIndex: number;
  readonly consumerId: string;
  readonly fieldName: string;
  readonly path: ReadonlyArray<string | number>;
}

/**
 * Extracts trigger input references from approved, typed positions of a validated node configuration.
 *
 * PRIVACY & SECURITY RULE:
 * Never scans literal JSON values or plain strings recursively.
 * Only inspects approved ValueBinding and ValueReference structural positions.
 * Node output references ({ source: 'node_output' }) are ignored (handled in Milestone 2B-C1).
 */
function extractInputReferences(graph: WorkflowGraph): ExtractedInputRef[] {
  const references: ExtractedInputRef[] = [];

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
        // No input references in INPUT or APPROVAL node definitions
        break;

      case 'TRANSFORM': {
        const rules = node.config.rules;
        for (let ruleIndex = 0; ruleIndex < rules.length; ruleIndex += 1) {
          const rule = rules[ruleIndex];
          if (rule === undefined) continue;

          switch (rule.operation) {
            case 'json_pick': {
              if (rule.source.source === 'input') {
                references.push({
                  consumerIndex: nodeIndex,
                  consumerId,
                  fieldName: rule.source.field,
                  path: ['nodes', nodeIndex, 'config', 'rules', ruleIndex, 'source', 'field'],
                });
              }
              break;
            }

            case 'json_set': {
              if (rule.value.type === 'reference' && rule.value.reference.source === 'input') {
                references.push({
                  consumerIndex: nodeIndex,
                  consumerId,
                  fieldName: rule.value.reference.field,
                  path: [
                    'nodes',
                    nodeIndex,
                    'config',
                    'rules',
                    ruleIndex,
                    'value',
                    'reference',
                    'field',
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
                  seg.reference.source === 'input'
                ) {
                  references.push({
                    consumerIndex: nodeIndex,
                    consumerId,
                    fieldName: seg.reference.field,
                    path: [
                      'nodes',
                      nodeIndex,
                      'config',
                      'rules',
                      ruleIndex,
                      'segments',
                      segIndex,
                      'reference',
                      'field',
                    ],
                  });
                }
              }
              break;
            }

            case 'math_op': {
              if (rule.left.type === 'reference' && rule.left.reference.source === 'input') {
                references.push({
                  consumerIndex: nodeIndex,
                  consumerId,
                  fieldName: rule.left.reference.field,
                  path: [
                    'nodes',
                    nodeIndex,
                    'config',
                    'rules',
                    ruleIndex,
                    'left',
                    'reference',
                    'field',
                  ],
                });
              }
              if (rule.right.type === 'reference' && rule.right.reference.source === 'input') {
                references.push({
                  consumerIndex: nodeIndex,
                  consumerId,
                  fieldName: rule.right.reference.field,
                  path: [
                    'nodes',
                    nodeIndex,
                    'config',
                    'rules',
                    ruleIndex,
                    'right',
                    'reference',
                    'field',
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
        if (config.left.type === 'reference' && config.left.reference.source === 'input') {
          references.push({
            consumerIndex: nodeIndex,
            consumerId,
            fieldName: config.left.reference.field,
            path: ['nodes', nodeIndex, 'config', 'left', 'reference', 'field'],
          });
        }
        if ('right' in config && config.right !== undefined) {
          if (config.right.type === 'reference' && config.right.reference.source === 'input') {
            references.push({
              consumerIndex: nodeIndex,
              consumerId,
              fieldName: config.right.reference.field,
              path: ['nodes', nodeIndex, 'config', 'right', 'reference', 'field'],
            });
          }
        }
        break;
      }

      case 'LLM': {
        if (
          node.config.prompt.type === 'reference' &&
          node.config.prompt.reference.source === 'input'
        ) {
          references.push({
            consumerIndex: nodeIndex,
            consumerId,
            fieldName: node.config.prompt.reference.field,
            path: ['nodes', nodeIndex, 'config', 'prompt', 'reference', 'field'],
          });
        }
        break;
      }

      case 'MCP_TOOL': {
        const args = node.config.arguments;
        if (args !== undefined) {
          for (const [argKey, binding] of Object.entries(args)) {
            if (binding.type === 'reference' && binding.reference.source === 'input') {
              references.push({
                consumerIndex: nodeIndex,
                consumerId,
                fieldName: binding.reference.field,
                path: ['nodes', nodeIndex, 'config', 'arguments', argKey, 'reference', 'field'],
              });
            }
          }
        }
        break;
      }

      case 'OUTPUT': {
        for (const [mapKey, binding] of Object.entries(node.config.payloadMapping)) {
          if (binding.type === 'reference' && binding.reference.source === 'input') {
            references.push({
              consumerIndex: nodeIndex,
              consumerId,
              fieldName: binding.reference.field,
              path: ['nodes', nodeIndex, 'config', 'payloadMapping', mapKey, 'reference', 'field'],
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
 * Builds a frequency index mapping each declared INPUT field name to the number
 * of times it is declared across all configured INPUT nodes in the workflow.
 */
function buildInputFieldDeclarationIndex(graph: WorkflowGraph): Map<string, number> {
  const declarationCounts = new Map<string, number>();

  for (let i = 0; i < graph.nodes.length; i += 1) {
    const rawNode = graph.nodes[i];
    if (rawNode === undefined || rawNode.type !== 'INPUT') continue;

    const parsed = ConfiguredWorkflowNodeSchema.safeParse(rawNode);
    if (!parsed.success || parsed.data.type !== 'INPUT') continue;

    for (const field of parsed.data.config.fields) {
      const currentCount = declarationCounts.get(field.name) ?? 0;
      declarationCounts.set(field.name, currentCount + 1);
    }
  }

  return declarationCounts;
}

/**
 * Pure, deterministic workflow trigger input reference validator.
 *
 * Verifies that all statically inspectable source: 'input' references resolve to
 * exactly one declared INPUT field under the V1 workflow-level namespace policy.
 *
 * Validation is staged:
 * 1. Stage 1 (Integrity): Graph structural integrity via `analyzeWorkflowGraph(graph)`.
 *    Halts if duplicates, dangling edges, or cycles are present.
 * 2. Stage 2 (Configuration): Node configuration validity via `validateWorkflowNodeConfigs(graph)`.
 *    Halts if any node configuration is incomplete or invalid.
 * 3. Stage 3 (Input Reference Scope): Statically verifies each source: 'input' reference
 *    resolves to a declared INPUT field and is not ambiguously declared by multiple INPUT nodes.
 *
 * V1 INPUT FIELD NAMESPACE POLICY:
 * - All configured INPUT nodes contribute their field declarations to one workflow-level namespace.
 * - Exact case-sensitive identity is enforced (e.g. 'customerId' != 'CustomerId').
 * - If a referenced field has zero declarations across all INPUT nodes:
 *   emits `INPUT_REFERENCE_FIELD_NOT_FOUND`.
 * - If a referenced field has more than one declaration across INPUT nodes:
 *   emits `INPUT_REFERENCE_FIELD_AMBIGUOUS`.
 * - Unreferenced duplicate fields across INPUT nodes do NOT trigger an error.
 * - Static resolution does NOT require graph ancestry of the declaring INPUT node.
 * - Static resolution does NOT guarantee that actual runtime values will be supplied upon invocation.
 *
 * @param graph Structurally valid workflow graph definition.
 * @returns Discriminated result indicating success or stage-specific failure diagnostics.
 */
export function validateWorkflowInputReferences(
  graph: WorkflowGraph,
): WorkflowInputReferenceValidationResult {
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

  // Stage 3: Input reference scope checks
  const extractedReferences = extractInputReferences(graph);
  if (extractedReferences.length === 0) {
    return {
      success: true,
      issues: [],
    };
  }

  // Build field declaration frequency index across all INPUT nodes
  const fieldCounts = buildInputFieldDeclarationIndex(graph);

  const inputReferenceIssues: InputReferenceIssue[] = [];

  for (let refIndex = 0; refIndex < extractedReferences.length; refIndex += 1) {
    const ref = extractedReferences[refIndex];
    if (ref === undefined) continue;

    const count = fieldCounts.get(ref.fieldName) ?? 0;

    if (count === 0) {
      inputReferenceIssues.push({
        code: 'INPUT_REFERENCE_FIELD_NOT_FOUND',
        path: ref.path,
        message: `Referenced input field '${ref.fieldName}' is not declared by any INPUT node in the workflow`,
      });
    } else if (count > 1) {
      inputReferenceIssues.push({
        code: 'INPUT_REFERENCE_FIELD_AMBIGUOUS',
        path: ref.path,
        message: `Referenced input field '${ref.fieldName}' is ambiguously declared across multiple INPUT nodes (${count} declarations)`,
      });
    }
  }

  if (inputReferenceIssues.length === 0) {
    return {
      success: true,
      issues: [],
    };
  }

  return {
    success: false,
    stage: 'input_references',
    issues: inputReferenceIssues,
  };
}
