import type { z } from 'zod';
import type { WorkflowNodeType } from './node-type.js';
import type { WorkflowGraph } from './workflow-graph.js';
import { InputNodeConfigSchema } from './node-configs/input-config.js';
import { TransformNodeConfigSchema } from './node-configs/transform-config.js';
import { ConditionNodeConfigSchema } from './node-configs/condition-config.js';
import { LlmNodeConfigSchema } from './node-configs/llm-config.js';
import { McpToolNodeConfigSchema } from './node-configs/mcp-tool-config.js';
import { ApprovalNodeConfigSchema } from './node-configs/approval-config.js';
import { OutputNodeConfigSchema } from './node-configs/output-config.js';

/**
 * Diagnostic issue produced during standalone node configuration validation.
 *
 * Privacy & Security Model:
 * - Sanitized and JSON-serializable.
 * - Does not copy raw configuration payload values, prompts, or stack traces into diagnostic metadata.
 * - However, authored property names, mapping keys, and identifiers legitimately appear in `path`
 *   and may be interpolated into Zod error `message` strings.
 * - Callers must treat diagnostics as potentially sensitive, avoid indiscriminate telemetry logging,
 *   and render displayPath and messages as plain text (never raw HTML).
 */
export interface NodeConfigValidationIssue {
  readonly path: ReadonlyArray<string | number>;
  readonly message: string;
  readonly code: string;
  readonly displayPath?: string;
}

/**
 * Diagnostic issue produced during workflow-level node configuration validation.
 * Extends NodeConfigValidationIssue with exact node positional and identity metadata.
 */
export interface WorkflowNodeConfigValidationIssue extends NodeConfigValidationIssue {
  readonly nodeIndex: number;
  readonly nodeId: string;
  readonly nodeType: WorkflowNodeType;
}

/**
 * Discriminated result for standalone node configuration validation.
 */
export type NodeConfigValidationResult =
  | {
      readonly success: true;
      readonly issues: readonly [];
    }
  | {
      readonly success: false;
      readonly issues: ReadonlyArray<NodeConfigValidationIssue>;
    };

/**
 * Discriminated result for workflow-level node configuration validation.
 */
export type WorkflowNodeConfigValidationResult =
  | {
      readonly success: true;
      readonly issues: readonly [];
    }
  | {
      readonly success: false;
      readonly issues: ReadonlyArray<WorkflowNodeConfigValidationIssue>;
    };

/**
 * Sanitizes a Zod PropertyKey[] path into JSON-compatible string/number segments.
 */
function sanitizePath(path: ReadonlyArray<PropertyKey>): Array<string | number> {
  return path.map((seg) => (typeof seg === 'number' ? seg : String(seg)));
}

/**
 * Standard JavaScript identifier pattern for dot-notation display paths.
 */
const IDENTIFIER_REGEX = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

/**
 * Formats a structured path array into a deterministic, human-readable display string.
 * Uses dot-notation for standard identifiers (`nodes[0].config.prompt`)
 * and quoted bracket notation for keys containing dots, spaces, quotes, control characters,
 * or Unicode (`nodes[0].config.payloadMapping["result.summary"]`).
 *
 * Uses JSON string escaping to prevent unescaped quotes, backslashes, or control characters.
 * The structured path array remains the authoritative programmatic representation.
 */
export function formatValidationPath(path: ReadonlyArray<string | number>): string {
  if (path.length === 0) {
    return '';
  }

  let result = '';
  for (let i = 0; i < path.length; i++) {
    const segment = path[i];
    if (segment === undefined) {
      continue;
    }

    if (typeof segment === 'number') {
      result += `[${segment}]`;
    } else if (typeof segment === 'string' && IDENTIFIER_REGEX.test(segment)) {
      result += i === 0 ? segment : `.${segment}`;
    } else {
      result += `[${JSON.stringify(String(segment))}]`;
    }
  }

  return result;
}

/**
 * Exhaustive dispatch mapping between approved WorkflowNodeType literals
 * and their corresponding configuration Zod schemas.
 */
const NODE_CONFIG_SCHEMAS = {
  INPUT: InputNodeConfigSchema,
  TRANSFORM: TransformNodeConfigSchema,
  CONDITION: ConditionNodeConfigSchema,
  LLM: LlmNodeConfigSchema,
  MCP_TOOL: McpToolNodeConfigSchema,
  APPROVAL: ApprovalNodeConfigSchema,
  OUTPUT: OutputNodeConfigSchema,
} as const satisfies Record<WorkflowNodeType, z.ZodTypeAny>;

/**
 * Validates a single node's configuration object against the schema corresponding to `type`.
 * Pure, deterministic, and non-mutating. Does not throw for ordinary invalid configuration inputs.
 *
 * @param type The approved WorkflowNodeType string.
 * @param config The raw configuration object to validate.
 * @returns Discriminated NodeConfigValidationResult.
 */
export function validateNodeConfig(
  type: WorkflowNodeType,
  config: unknown,
): NodeConfigValidationResult {
  const schema = NODE_CONFIG_SCHEMAS[type];
  if (!schema) {
    return {
      success: false,
      issues: [
        {
          path: [],
          message: `Unsupported or unknown node type '${String(type)}'`,
          code: 'custom',
          displayPath: '',
        },
      ],
    };
  }

  const parseResult = schema.safeParse(config);
  if (parseResult.success) {
    return {
      success: true,
      issues: [],
    };
  }

  const issues: NodeConfigValidationIssue[] = parseResult.error.issues.map((issue) => {
    const sanitizedPath = sanitizePath(issue.path);
    return {
      path: sanitizedPath,
      message: issue.message,
      code: issue.code,
      displayPath: formatValidationPath(sanitizedPath),
    };
  });

  return {
    success: false,
    issues,
  };
}

/**
 * Validates all node configurations within a structurally valid WorkflowGraph.
 * Iterates through all nodes, selecting the type-specific configuration schema for each,
 * and collects all validation issues across all nodes into an aggregate result.
 *
 * Does NOT short-circuit on the first error.
 * Does NOT perform graph-semantic validation (cycles, reachability, dangling edges, branch completeness),
 * which belongs to Milestone 2B.
 *
 * @param graph A structurally valid WorkflowGraph.
 * @returns Discriminated WorkflowNodeConfigValidationResult.
 */
export function validateWorkflowNodeConfigs(
  graph: WorkflowGraph,
): WorkflowNodeConfigValidationResult {
  const allIssues: WorkflowNodeConfigValidationIssue[] = [];

  for (let nodeIndex = 0; nodeIndex < graph.nodes.length; nodeIndex++) {
    const node = graph.nodes[nodeIndex];
    if (!node) {
      continue;
    }

    const schema = NODE_CONFIG_SCHEMAS[node.type];
    if (!schema) {
      const fullPath = ['nodes', nodeIndex, 'type'];
      allIssues.push({
        nodeIndex,
        nodeId: node.id,
        nodeType: node.type,
        path: fullPath,
        message: `Unsupported or unknown node type '${String(node.type)}'`,
        code: 'custom',
        displayPath: formatValidationPath(fullPath),
      });
      continue;
    }

    const parseResult = schema.safeParse(node.config);
    if (!parseResult.success) {
      for (const issue of parseResult.error.issues) {
        const fullPath: Array<string | number> = [
          'nodes',
          nodeIndex,
          'config',
          ...sanitizePath(issue.path),
        ];
        allIssues.push({
          nodeIndex,
          nodeId: node.id,
          nodeType: node.type,
          path: fullPath,
          message: issue.message,
          code: issue.code,
          displayPath: formatValidationPath(fullPath),
        });
      }
    }
  }

  if (allIssues.length === 0) {
    return {
      success: true,
      issues: [],
    };
  }

  return {
    success: false,
    issues: allIssues,
  };
}
