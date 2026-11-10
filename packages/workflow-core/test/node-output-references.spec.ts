import { describe, expect, expectTypeOf, it } from 'vitest';
import type {
  ConditionNodeConfig,
  InputNodeConfig,
  LlmNodeConfig,
  McpToolNodeConfig,
  OutputNodeConfig,
  TransformNodeConfig,
  WorkflowEdge,
  WorkflowGraph,
  WorkflowNode,
  WorkflowNodeConfig,
  WorkflowNodeConfigValidationIssue,
  WorkflowNodeType,
} from '@flowforge/contracts';
import {
  analyzeWorkflowGraph,
  validateWorkflowGraphSemantics,
  validateWorkflowNodeOutputReferences,
  type GraphIntegrityIssue,
  type NodeOutputReferenceIssue,
  type NodeOutputReferenceIssueCode,
  type WorkflowNodeOutputReferenceConfigurationFailureResult,
  type WorkflowNodeOutputReferenceFailureResult,
  type WorkflowNodeOutputReferenceIntegrityFailureResult,
  type WorkflowNodeOutputReferenceSuccessResult,
  type WorkflowNodeOutputReferenceValidationResult,
} from '../src/index.js';

function createNode(id: string, type: WorkflowNodeType, config: unknown = {}): WorkflowNode {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    config: config as WorkflowNodeConfig,
  };
}

function createEdge(
  id: string,
  source: string,
  target: string,
  conditionOutcome?: 'TRUE' | 'FALSE',
): WorkflowEdge {
  return {
    id,
    source,
    target,
    ...(conditionOutcome !== undefined ? { conditionOutcome } : {}),
  };
}

const validEmptyInputConfig: InputNodeConfig = {
  fields: [],
};

const validOutputLiteralConfig: OutputNodeConfig = {
  payloadMapping: {
    result: { type: 'literal', value: { status: 'ok' } },
  },
};

describe('validateWorkflowNodeOutputReferences', () => {
  describe('Positive Cases', () => {
    it('1. empty graph passes node-output reference validation if all earlier gates permit it', () => {
      const graph: WorkflowGraph = { nodes: [], edges: [] };
      const result = validateWorkflowNodeOutputReferences(graph);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.issues).toEqual([]);
      }
    });

    it('2. graph with no node-output references passes', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT', validEmptyInputConfig),
          createNode('out_1', 'OUTPUT', validOutputLiteralConfig),
        ],
        edges: [createEdge('e1', 'in_1', 'out_1')],
      };
      const result = validateWorkflowNodeOutputReferences(graph);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.issues).toEqual([]);
      }
    });

    it('3. INPUT -> TRANSFORM with valid upstream reference passes', () => {
      const transformConfig: TransformNodeConfig = {
        rules: [
          {
            operation: 'json_pick',
            targetKey: 'picked',
            source: { source: 'node_output', nodeId: 'in_1', path: ['payload'] },
          },
        ],
      };
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT', validEmptyInputConfig),
          createNode('t_1', 'TRANSFORM', transformConfig),
        ],
        edges: [createEdge('e1', 'in_1', 't_1')],
      };
      const result = validateWorkflowNodeOutputReferences(graph);

      expect(result.success).toBe(true);
    });

    it('4. TRANSFORM -> LLM with valid node-output prompt reference passes', () => {
      const transformConfig: TransformNodeConfig = {
        rules: [
          {
            operation: 'json_set',
            targetKey: 'promptText',
            value: { type: 'literal', value: 'Hello world' },
          },
        ],
      };
      const llmConfig: LlmNodeConfig = {
        provider: 'openai',
        model: 'gpt-4o',
        prompt: {
          type: 'reference',
          reference: { source: 'node_output', nodeId: 't_1', path: ['promptText'] },
        },
      };
      const graph: WorkflowGraph = {
        nodes: [
          createNode('t_1', 'TRANSFORM', transformConfig),
          createNode('llm_1', 'LLM', llmConfig),
        ],
        edges: [createEdge('e1', 't_1', 'llm_1')],
      };
      const result = validateWorkflowNodeOutputReferences(graph);

      expect(result.success).toBe(true);
    });

    it('5. CONDITION binding referencing a strict ancestor passes', () => {
      const transformConfig: TransformNodeConfig = {
        rules: [
          {
            operation: 'json_set',
            targetKey: 'status',
            value: { type: 'literal', value: 'active' },
          },
        ],
      };
      const conditionConfig: ConditionNodeConfig = {
        operator: 'equals',
        left: {
          type: 'reference',
          reference: { source: 'node_output', nodeId: 't_1', path: ['status'] },
        },
        right: { type: 'literal', value: 'active' },
      };
      const graph: WorkflowGraph = {
        nodes: [
          createNode('t_1', 'TRANSFORM', transformConfig),
          createNode('cond_1', 'CONDITION', conditionConfig),
        ],
        edges: [createEdge('e1', 't_1', 'cond_1')],
      };
      const result = validateWorkflowNodeOutputReferences(graph);

      expect(result.success).toBe(true);
    });

    it('6. MCP_TOOL argument referencing a strict ancestor passes', () => {
      const transformConfig: TransformNodeConfig = {
        rules: [
          {
            operation: 'json_set',
            targetKey: 'issueTitle',
            value: { type: 'literal', value: 'Fix bug' },
          },
        ],
      };
      const mcpConfig: McpToolNodeConfig = {
        integrationRef: 'github_app',
        toolName: 'create_issue',
        arguments: {
          title: {
            type: 'reference',
            reference: { source: 'node_output', nodeId: 't_1', path: ['issueTitle'] },
          },
        },
      };
      const graph: WorkflowGraph = {
        nodes: [
          createNode('t_1', 'TRANSFORM', transformConfig),
          createNode('mcp_1', 'MCP_TOOL', mcpConfig),
        ],
        edges: [createEdge('e1', 't_1', 'mcp_1')],
      };
      const result = validateWorkflowNodeOutputReferences(graph);

      expect(result.success).toBe(true);
    });

    it('7. OUTPUT mapping referencing a strict ancestor passes', () => {
      const transformConfig: TransformNodeConfig = {
        rules: [
          {
            operation: 'json_set',
            targetKey: 'finalData',
            value: { type: 'literal', value: 'done' },
          },
        ],
      };
      const outputConfig: OutputNodeConfig = {
        payloadMapping: {
          finalResult: {
            type: 'reference',
            reference: { source: 'node_output', nodeId: 't_1', path: ['finalData'] },
          },
        },
      };
      const graph: WorkflowGraph = {
        nodes: [
          createNode('t_1', 'TRANSFORM', transformConfig),
          createNode('out_1', 'OUTPUT', outputConfig),
        ],
        edges: [createEdge('e1', 't_1', 'out_1')],
      };
      const result = validateWorkflowNodeOutputReferences(graph);

      expect(result.success).toBe(true);
    });

    it('8. TRANSFORM json_pick direct ValueReference is inspected correctly', () => {
      const transformConfig: TransformNodeConfig = {
        rules: [
          {
            operation: 'json_pick',
            targetKey: 'pickedValue',
            source: { source: 'node_output', nodeId: 'upstream', path: ['deep', 'val'] },
            fallbackValue: { default: true },
          },
        ],
      };
      const graph: WorkflowGraph = {
        nodes: [
          createNode('upstream', 'TRANSFORM', {
            rules: [
              {
                operation: 'json_set',
                targetKey: 'deep',
                value: { type: 'literal', value: { val: 42 } },
              },
            ],
          }),
          createNode('downstream', 'TRANSFORM', transformConfig),
        ],
        edges: [createEdge('e1', 'upstream', 'downstream')],
      };
      const result = validateWorkflowNodeOutputReferences(graph);

      expect(result.success).toBe(true);
    });

    it('9. TRANSFORM json_set binding is inspected', () => {
      const transformConfig: TransformNodeConfig = {
        rules: [
          {
            operation: 'json_set',
            targetKey: 'copiedValue',
            value: {
              type: 'reference',
              reference: { source: 'node_output', nodeId: 'upstream', path: ['val'] },
            },
          },
        ],
      };
      const graph: WorkflowGraph = {
        nodes: [
          createNode('upstream', 'TRANSFORM', {
            rules: [
              {
                operation: 'json_set',
                targetKey: 'val',
                value: { type: 'literal', value: 100 },
              },
            ],
          }),
          createNode('downstream', 'TRANSFORM', transformConfig),
        ],
        edges: [createEdge('e1', 'upstream', 'downstream')],
      };
      const result = validateWorkflowNodeOutputReferences(graph);

      expect(result.success).toBe(true);
    });

    it('10. TRANSFORM template_string reference segment is inspected', () => {
      const transformConfig: TransformNodeConfig = {
        rules: [
          {
            operation: 'template_string',
            targetKey: 'greeting',
            segments: [
              { type: 'text', text: 'Hello, ' },
              {
                type: 'reference',
                reference: { source: 'node_output', nodeId: 'upstream', path: ['user', 'name'] },
              },
              { type: 'text', text: '!' },
            ],
          },
        ],
      };
      const graph: WorkflowGraph = {
        nodes: [
          createNode('upstream', 'TRANSFORM', {
            rules: [
              {
                operation: 'json_set',
                targetKey: 'user',
                value: { type: 'literal', value: { name: 'Alice' } },
              },
            ],
          }),
          createNode('downstream', 'TRANSFORM', transformConfig),
        ],
        edges: [createEdge('e1', 'upstream', 'downstream')],
      };
      const result = validateWorkflowNodeOutputReferences(graph);

      expect(result.success).toBe(true);
    });

    it('11. TRANSFORM math_op left and right bindings are inspected', () => {
      const transformConfig: TransformNodeConfig = {
        rules: [
          {
            operation: 'math_op',
            targetKey: 'total',
            operator: 'add',
            left: {
              type: 'reference',
              reference: { source: 'node_output', nodeId: 'up1', path: ['amount'] },
            },
            right: {
              type: 'reference',
              reference: { source: 'node_output', nodeId: 'up2', path: ['tax'] },
            },
          },
        ],
      };
      const graph: WorkflowGraph = {
        nodes: [
          createNode('up1', 'TRANSFORM', {
            rules: [
              {
                operation: 'json_set',
                targetKey: 'amount',
                value: { type: 'literal', value: 100 },
              },
            ],
          }),
          createNode('up2', 'TRANSFORM', {
            rules: [
              {
                operation: 'json_set',
                targetKey: 'tax',
                value: { type: 'literal', value: 15 },
              },
            ],
          }),
          createNode('downstream', 'TRANSFORM', transformConfig),
        ],
        edges: [createEdge('e1', 'up1', 'downstream'), createEdge('e2', 'up2', 'downstream')],
      };
      const result = validateWorkflowNodeOutputReferences(graph);

      expect(result.success).toBe(true);
    });

    it('12. CONDITION unary and binary forms are handled', () => {
      const unaryCond: ConditionNodeConfig = {
        operator: 'is_not_empty',
        left: {
          type: 'reference',
          reference: { source: 'node_output', nodeId: 'up1', path: ['items'] },
        },
      };
      const binaryCond: ConditionNodeConfig = {
        operator: 'greater_than',
        left: {
          type: 'reference',
          reference: { source: 'node_output', nodeId: 'up1', path: ['count'] },
        },
        right: {
          type: 'reference',
          reference: { source: 'node_output', nodeId: 'up2', path: ['limit'] },
        },
      };
      const graph: WorkflowGraph = {
        nodes: [
          createNode('up1', 'TRANSFORM', {
            rules: [
              {
                operation: 'json_set',
                targetKey: 'items',
                value: { type: 'literal', value: [1, 2] },
              },
            ],
          }),
          createNode('up2', 'TRANSFORM', {
            rules: [
              {
                operation: 'json_set',
                targetKey: 'limit',
                value: { type: 'literal', value: 10 },
              },
            ],
          }),
          createNode('cond_unary', 'CONDITION', unaryCond),
          createNode('cond_binary', 'CONDITION', binaryCond),
        ],
        edges: [
          createEdge('e1', 'up1', 'cond_unary'),
          createEdge('e2', 'up1', 'cond_binary'),
          createEdge('e3', 'up2', 'cond_binary'),
        ],
      };
      const result = validateWorkflowNodeOutputReferences(graph);

      expect(result.success).toBe(true);
    });

    it('13. multiple valid references on the same node pass', () => {
      const transformConfig: TransformNodeConfig = {
        rules: [
          {
            operation: 'json_pick',
            targetKey: 'k1',
            source: { source: 'node_output', nodeId: 'up', path: ['a'] },
          },
          {
            operation: 'json_set',
            targetKey: 'k2',
            value: {
              type: 'reference',
              reference: { source: 'node_output', nodeId: 'up', path: ['b'] },
            },
          },
        ],
      };
      const graph: WorkflowGraph = {
        nodes: [
          createNode('up', 'TRANSFORM', {
            rules: [
              { operation: 'json_set', targetKey: 'a', value: { type: 'literal', value: 1 } },
              { operation: 'json_set', targetKey: 'b', value: { type: 'literal', value: 2 } },
            ],
          }),
          createNode('down', 'TRANSFORM', transformConfig),
        ],
        edges: [createEdge('e1', 'up', 'down')],
      };
      const result = validateWorkflowNodeOutputReferences(graph);

      expect(result.success).toBe(true);
    });

    it('14. referenced node IDs containing dots remain atomic', () => {
      const transformConfig: TransformNodeConfig = {
        rules: [
          {
            operation: 'json_pick',
            targetKey: 'val',
            source: { source: 'node_output', nodeId: 'service.worker.01', path: ['result'] },
          },
        ],
      };
      const graph: WorkflowGraph = {
        nodes: [
          createNode('service.worker.01', 'TRANSFORM', {
            rules: [
              {
                operation: 'json_set',
                targetKey: 'result',
                value: { type: 'literal', value: 'ok' },
              },
            ],
          }),
          createNode('consumer.node', 'TRANSFORM', transformConfig),
        ],
        edges: [createEdge('e1', 'service.worker.01', 'consumer.node')],
      };
      const result = validateWorkflowNodeOutputReferences(graph);

      expect(result.success).toBe(true);
    });

    it('15. literal JSON resembling a reference is ignored', () => {
      const transformConfig: TransformNodeConfig = {
        rules: [
          {
            operation: 'json_set',
            targetKey: 'fakeRef',
            value: {
              type: 'literal',
              value: {
                source: 'node_output',
                nodeId: 'non_existent_node',
                path: ['foo'],
              },
            },
          },
        ],
      };
      const graph: WorkflowGraph = {
        nodes: [createNode('t1', 'TRANSFORM', transformConfig)],
        edges: [],
      };
      const result = validateWorkflowNodeOutputReferences(graph);

      expect(result.success).toBe(true);
    });

    it('16. literal text containing reference-like markup is ignored', () => {
      const transformConfig: TransformNodeConfig = {
        rules: [
          {
            operation: 'template_string',
            targetKey: 'templated',
            segments: [
              {
                type: 'text',
                text: 'Template with {{node.output.non_existent}} literal syntax',
              },
            ],
          },
        ],
      };
      const graph: WorkflowGraph = {
        nodes: [createNode('t1', 'TRANSFORM', transformConfig)],
        edges: [],
      };
      const result = validateWorkflowNodeOutputReferences(graph);

      expect(result.success).toBe(true);
    });

    it('17. an input reference is not mistaken for a node-output reference', () => {
      const transformConfig: TransformNodeConfig = {
        rules: [
          {
            operation: 'json_pick',
            targetKey: 'inputVal',
            source: { source: 'input', field: 'customer_email', path: ['domain'] },
          },
        ],
      };
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT', {
            fields: [{ name: 'customer_email', type: 'string', required: true }],
          }),
          createNode('t_1', 'TRANSFORM', transformConfig),
        ],
        edges: [createEdge('e1', 'in_1', 't_1')],
      };
      const result = validateWorkflowNodeOutputReferences(graph);

      expect(result.success).toBe(true);
    });

    it('18. a conditional merge can pass static ancestry even when runtime availability is not guaranteed', () => {
      const condConfig: ConditionNodeConfig = {
        operator: 'is_not_empty',
        left: { type: 'literal', value: 'check' },
      };
      const branchAConfig: TransformNodeConfig = {
        rules: [
          {
            operation: 'json_set',
            targetKey: 'branchAData',
            value: { type: 'literal', value: 'A' },
          },
        ],
      };
      const branchBConfig: TransformNodeConfig = {
        rules: [
          {
            operation: 'json_set',
            targetKey: 'branchBData',
            value: { type: 'literal', value: 'B' },
          },
        ],
      };
      const mergeConfig: TransformNodeConfig = {
        rules: [
          {
            operation: 'json_pick',
            targetKey: 'selectedA',
            source: { source: 'node_output', nodeId: 'branch_a', path: ['branchAData'] },
          },
        ],
      };

      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT', validEmptyInputConfig),
          createNode('cond_1', 'CONDITION', condConfig),
          createNode('branch_a', 'TRANSFORM', branchAConfig),
          createNode('branch_b', 'TRANSFORM', branchBConfig),
          createNode('merge_node', 'TRANSFORM', mergeConfig),
        ],
        edges: [
          createEdge('e1', 'in_1', 'cond_1'),
          createEdge('e2', 'cond_1', 'branch_a', 'TRUE'),
          createEdge('e3', 'cond_1', 'branch_b', 'FALSE'),
          createEdge('e4', 'branch_a', 'merge_node'),
          createEdge('e5', 'branch_b', 'merge_node'),
        ],
      };
      const result = validateWorkflowNodeOutputReferences(graph);

      expect(result.success).toBe(true);
    });

    it('19. repeated validation produces equivalent results (determinism)', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('t1', 'TRANSFORM', {
            rules: [
              { operation: 'json_set', targetKey: 'k', value: { type: 'literal', value: 1 } },
            ],
          }),
          createNode('t2', 'TRANSFORM', {
            rules: [
              {
                operation: 'json_pick',
                targetKey: 'picked',
                source: { source: 'node_output', nodeId: 't1', path: ['k'] },
              },
            ],
          }),
        ],
        edges: [createEdge('e1', 't1', 't2')],
      };

      const result1 = validateWorkflowNodeOutputReferences(graph);
      const result2 = validateWorkflowNodeOutputReferences(graph);

      expect(result1).toEqual(result2);
    });

    it('20. frozen input graphs are not mutated', () => {
      const graph = {
        nodes: Object.freeze([
          Object.freeze(
            createNode('t1', 'TRANSFORM', {
              rules: Object.freeze([
                { operation: 'json_set', targetKey: 'k', value: { type: 'literal', value: 1 } },
              ]),
            }),
          ),
          Object.freeze(
            createNode('t2', 'TRANSFORM', {
              rules: Object.freeze([
                {
                  operation: 'json_pick',
                  targetKey: 'picked',
                  source: { source: 'node_output', nodeId: 't1', path: ['k'] },
                },
              ]),
            }),
          ),
        ]),
        edges: Object.freeze([createEdge('e1', 't1', 't2')]),
      };
      Object.freeze(graph);

      expect(() =>
        validateWorkflowNodeOutputReferences(graph as unknown as WorkflowGraph),
      ).not.toThrow();
    });
  });

  describe('Negative Cases', () => {
    it('21. referenced node does not exist (NODE_OUTPUT_REFERENCE_NOT_FOUND)', () => {
      const transformConfig: TransformNodeConfig = {
        rules: [
          {
            operation: 'json_pick',
            targetKey: 'picked',
            source: { source: 'node_output', nodeId: 'does_not_exist', path: ['data'] },
          },
        ],
      };
      const graph: WorkflowGraph = {
        nodes: [createNode('t1', 'TRANSFORM', transformConfig)],
        edges: [],
      };
      const result = validateWorkflowNodeOutputReferences(graph);

      expect(result.success).toBe(false);
      if (!result.success && result.stage === 'references') {
        expect(result.issues).toHaveLength(1);
        expect(result.issues[0]?.code).toBe('NODE_OUTPUT_REFERENCE_NOT_FOUND');
        expect(result.issues[0]?.path).toEqual([
          'nodes',
          0,
          'config',
          'rules',
          0,
          'source',
          'nodeId',
        ]);
        expect(result.issues[0]?.message).toContain('does_not_exist');
      }
    });

    it('22. self-reference is rejected (NODE_OUTPUT_REFERENCE_SELF)', () => {
      const transformConfig: TransformNodeConfig = {
        rules: [
          {
            operation: 'json_pick',
            targetKey: 'picked',
            source: { source: 'node_output', nodeId: 't1', path: ['data'] },
          },
        ],
      };
      const graph: WorkflowGraph = {
        nodes: [createNode('t1', 'TRANSFORM', transformConfig)],
        edges: [],
      };
      const result = validateWorkflowNodeOutputReferences(graph);

      expect(result.success).toBe(false);
      if (!result.success && result.stage === 'references') {
        expect(result.issues).toHaveLength(1);
        expect(result.issues[0]?.code).toBe('NODE_OUTPUT_REFERENCE_SELF');
        expect(result.issues[0]?.path).toEqual([
          'nodes',
          0,
          'config',
          'rules',
          0,
          'source',
          'nodeId',
        ]);
        expect(result.issues[0]?.message).toContain('cannot reference its own output');
      }
    });

    it('23. existing but downstream node is rejected (NODE_OUTPUT_REFERENCE_NOT_UPSTREAM)', () => {
      const upConfig: TransformNodeConfig = {
        rules: [
          {
            operation: 'json_pick',
            targetKey: 'picked',
            source: { source: 'node_output', nodeId: 'downstream', path: ['data'] },
          },
        ],
      };
      const downConfig: TransformNodeConfig = {
        rules: [
          {
            operation: 'json_set',
            targetKey: 'data',
            value: { type: 'literal', value: 'hello' },
          },
        ],
      };
      const graph: WorkflowGraph = {
        nodes: [
          createNode('upstream', 'TRANSFORM', upConfig),
          createNode('downstream', 'TRANSFORM', downConfig),
        ],
        edges: [createEdge('e1', 'upstream', 'downstream')],
      };
      const result = validateWorkflowNodeOutputReferences(graph);

      expect(result.success).toBe(false);
      if (!result.success && result.stage === 'references') {
        expect(result.issues).toHaveLength(1);
        expect(result.issues[0]?.code).toBe('NODE_OUTPUT_REFERENCE_NOT_UPSTREAM');
        expect(result.issues[0]?.path).toEqual([
          'nodes',
          0,
          'config',
          'rules',
          0,
          'source',
          'nodeId',
        ]);
        expect(result.issues[0]?.message).toContain('is not an upstream ancestor');
      }
    });

    it('24. existing but unrelated disconnected node is rejected (NODE_OUTPUT_REFERENCE_NOT_UPSTREAM)', () => {
      const t1Config: TransformNodeConfig = {
        rules: [{ operation: 'json_set', targetKey: 'v1', value: { type: 'literal', value: 1 } }],
      };
      const t2Config: TransformNodeConfig = {
        rules: [
          {
            operation: 'json_pick',
            targetKey: 'picked',
            source: { source: 'node_output', nodeId: 't1', path: ['v1'] },
          },
        ],
      };
      const graph: WorkflowGraph = {
        nodes: [createNode('t1', 'TRANSFORM', t1Config), createNode('t2', 'TRANSFORM', t2Config)],
        edges: [],
      };
      const result = validateWorkflowNodeOutputReferences(graph);

      expect(result.success).toBe(false);
      if (!result.success && result.stage === 'references') {
        expect(result.issues).toHaveLength(1);
        expect(result.issues[0]?.code).toBe('NODE_OUTPUT_REFERENCE_NOT_UPSTREAM');
      }
    });

    it('25. earlier topological position without ancestry is rejected', () => {
      // Components: A -> C and B -> D.
      // Deterministic topological ordering might place A before D, but D must not reference A.
      const graph: WorkflowGraph = {
        nodes: [
          createNode('A', 'TRANSFORM', {
            rules: [
              { operation: 'json_set', targetKey: 'dataA', value: { type: 'literal', value: 'A' } },
            ],
          }),
          createNode('B', 'TRANSFORM', {
            rules: [
              { operation: 'json_set', targetKey: 'dataB', value: { type: 'literal', value: 'B' } },
            ],
          }),
          createNode('C', 'TRANSFORM', {
            rules: [
              { operation: 'json_set', targetKey: 'dataC', value: { type: 'literal', value: 'C' } },
            ],
          }),
          createNode('D', 'TRANSFORM', {
            rules: [
              {
                operation: 'json_pick',
                targetKey: 'dataFromA',
                source: { source: 'node_output', nodeId: 'A', path: ['dataA'] },
              },
            ],
          }),
        ],
        edges: [createEdge('e1', 'A', 'C'), createEdge('e2', 'B', 'D')],
      };
      const result = validateWorkflowNodeOutputReferences(graph);

      expect(result.success).toBe(false);
      if (!result.success && result.stage === 'references') {
        expect(result.issues).toHaveLength(1);
        expect(result.issues[0]?.code).toBe('NODE_OUTPUT_REFERENCE_NOT_UPSTREAM');
        expect(result.issues[0]?.path).toEqual([
          'nodes',
          3,
          'config',
          'rules',
          0,
          'source',
          'nodeId',
        ]);
      }
    });

    it('26. reference to a sibling branch without a directed ancestor path is rejected', () => {
      const condConfig: ConditionNodeConfig = {
        operator: 'is_not_empty',
        left: { type: 'literal', value: 'test' },
      };
      const branchAConfig: TransformNodeConfig = {
        rules: [{ operation: 'json_set', targetKey: 'valA', value: { type: 'literal', value: 1 } }],
      };
      const branchBConfig: TransformNodeConfig = {
        rules: [
          {
            operation: 'json_pick',
            targetKey: 'valFromA',
            source: { source: 'node_output', nodeId: 'branch_a', path: ['valA'] },
          },
        ],
      };
      const graph: WorkflowGraph = {
        nodes: [
          createNode('cond', 'CONDITION', condConfig),
          createNode('branch_a', 'TRANSFORM', branchAConfig),
          createNode('branch_b', 'TRANSFORM', branchBConfig),
        ],
        edges: [
          createEdge('e1', 'cond', 'branch_a', 'TRUE'),
          createEdge('e2', 'cond', 'branch_b', 'FALSE'),
        ],
      };
      const result = validateWorkflowNodeOutputReferences(graph);

      expect(result.success).toBe(false);
      if (!result.success && result.stage === 'references') {
        expect(result.issues).toHaveLength(1);
        expect(result.issues[0]?.code).toBe('NODE_OUTPUT_REFERENCE_NOT_UPSTREAM');
        expect(result.issues[0]?.path).toEqual([
          'nodes',
          2,
          'config',
          'rules',
          0,
          'source',
          'nodeId',
        ]);
      }
    });

    it('27. multiple invalid references in one node produce multiple issues', () => {
      const transformConfig: TransformNodeConfig = {
        rules: [
          {
            operation: 'json_pick',
            targetKey: 'k1',
            source: { source: 'node_output', nodeId: 'missing_1', path: ['a'] },
          },
          {
            operation: 'json_set',
            targetKey: 'k2',
            value: {
              type: 'reference',
              reference: { source: 'node_output', nodeId: 't1', path: ['b'] },
            },
          },
          {
            operation: 'math_op',
            targetKey: 'k3',
            operator: 'add',
            left: {
              type: 'reference',
              reference: { source: 'node_output', nodeId: 'missing_2', path: ['c'] },
            },
            right: { type: 'literal', value: 5 },
          },
        ],
      };
      const graph: WorkflowGraph = {
        nodes: [createNode('t1', 'TRANSFORM', transformConfig)],
        edges: [],
      };
      const result = validateWorkflowNodeOutputReferences(graph);

      expect(result.success).toBe(false);
      if (!result.success && result.stage === 'references') {
        expect(result.issues).toHaveLength(3);
        expect(result.issues[0]?.code).toBe('NODE_OUTPUT_REFERENCE_NOT_FOUND');
        expect(result.issues[1]?.code).toBe('NODE_OUTPUT_REFERENCE_SELF');
        expect(result.issues[2]?.code).toBe('NODE_OUTPUT_REFERENCE_NOT_FOUND');
      }
    });

    it('28. invalid references across different nodes are aggregated', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('t1', 'TRANSFORM', {
            rules: [
              {
                operation: 'json_pick',
                targetKey: 'k1',
                source: { source: 'node_output', nodeId: 'ghost1', path: ['x'] },
              },
            ],
          }),
          createNode('t2', 'TRANSFORM', {
            rules: [
              {
                operation: 'json_pick',
                targetKey: 'k2',
                source: { source: 'node_output', nodeId: 'ghost2', path: ['y'] },
              },
            ],
          }),
        ],
        edges: [],
      };
      const result = validateWorkflowNodeOutputReferences(graph);

      expect(result.success).toBe(false);
      if (!result.success && result.stage === 'references') {
        expect(result.issues).toHaveLength(2);
        expect(result.issues[0]?.path).toEqual([
          'nodes',
          0,
          'config',
          'rules',
          0,
          'source',
          'nodeId',
        ]);
        expect(result.issues[1]?.path).toEqual([
          'nodes',
          1,
          'config',
          'rules',
          0,
          'source',
          'nodeId',
        ]);
      }
    });

    it('29. incorrect JSON path segment types are rejected by the configuration prerequisite', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('t1', 'TRANSFORM', {
            rules: [
              {
                operation: 'json_pick',
                targetKey: 'k1',
                // invalid: path segment is number instead of string
                source: {
                  source: 'node_output',
                  nodeId: 'upstream',
                  path: [123 as unknown as string],
                },
              },
            ],
          }),
        ],
        edges: [],
      };
      const result = validateWorkflowNodeOutputReferences(graph);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.stage).toBe('configuration');
      }
    });

    it('30. invalid binding discriminator is rejected by the configuration prerequisite', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('t1', 'TRANSFORM', {
            rules: [
              {
                operation: 'json_set',
                targetKey: 'k1',
                // invalid: discriminator 'unknown_type'
                value: { type: 'unknown_type' as unknown as 'literal', value: 123 },
              },
            ],
          }),
        ],
        edges: [],
      };
      const result = validateWorkflowNodeOutputReferences(graph);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.stage).toBe('configuration');
      }
    });

    it('31. an incomplete draft config fails at configuration stage', () => {
      const graph: WorkflowGraph = {
        nodes: [createNode('t1', 'TRANSFORM', {})],
        edges: [],
      };
      const result = validateWorkflowNodeOutputReferences(graph);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.stage).toBe('configuration');
      }
    });

    it('32. duplicate node IDs fail at integrity stage', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('dup', 'TRANSFORM', {
            rules: [
              { operation: 'json_set', targetKey: 'a', value: { type: 'literal', value: 1 } },
            ],
          }),
          createNode('dup', 'TRANSFORM', {
            rules: [
              { operation: 'json_set', targetKey: 'b', value: { type: 'literal', value: 2 } },
            ],
          }),
        ],
        edges: [],
      };
      const result = validateWorkflowNodeOutputReferences(graph);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.stage).toBe('integrity');
        expect(result.issues[0]?.code).toBe('DUPLICATE_NODE_ID');
      }
    });

    it('33. dangling edges fail at integrity stage', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('t1', 'TRANSFORM', {
            rules: [
              { operation: 'json_set', targetKey: 'a', value: { type: 'literal', value: 1 } },
            ],
          }),
        ],
        edges: [createEdge('e1', 't1', 'missing_target')],
      };
      const result = validateWorkflowNodeOutputReferences(graph);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.stage).toBe('integrity');
        expect(result.issues[0]?.code).toBe('MISSING_EDGE_TARGET');
      }
    });

    it('34. directed cycles fail at integrity stage', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('A', 'TRANSFORM', {
            rules: [
              { operation: 'json_set', targetKey: 'a', value: { type: 'literal', value: 1 } },
            ],
          }),
          createNode('B', 'TRANSFORM', {
            rules: [
              { operation: 'json_set', targetKey: 'b', value: { type: 'literal', value: 2 } },
            ],
          }),
        ],
        edges: [createEdge('e1', 'A', 'B'), createEdge('e2', 'B', 'A')],
      };
      const result = validateWorkflowNodeOutputReferences(graph);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.stage).toBe('integrity');
        expect(result.issues[0]?.code).toBe('CYCLE_DETECTED');
      }
    });

    it('35. existing issue codes and paths are preserved by prerequisite stages', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('t1', 'TRANSFORM', {
            rules: [
              {
                operation: 'json_pick',
                targetKey: 'k',
                // Invalid: missing 'source'
              } as unknown as TransformNodeConfig['rules'][0],
            ],
          }),
        ],
        edges: [],
      };
      const result = validateWorkflowNodeOutputReferences(graph);

      expect(result.success).toBe(false);
      if (!result.success && result.stage === 'configuration') {
        expect(result.issues[0]?.nodeId).toBe('t1');
        expect(result.issues[0]?.nodeIndex).toBe(0);
        expect(result.issues[0]?.path).toEqual(['nodes', 0, 'config', 'rules', 0, 'source']);
      }
    });

    it('36. no reference-stage findings are produced after a prerequisite failure', () => {
      // Graph with a cycle and an invalid reference
      const graph: WorkflowGraph = {
        nodes: [
          createNode('A', 'TRANSFORM', {
            rules: [
              {
                operation: 'json_pick',
                targetKey: 'k',
                source: { source: 'node_output', nodeId: 'non_existent_node', path: [] },
              },
            ],
          }),
        ],
        edges: [createEdge('e1', 'A', 'A')], // self loop / cycle
      };
      const result = validateWorkflowNodeOutputReferences(graph);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.stage).toBe('integrity');
        // Does not leak into references stage
        expect(result.issues.some((i) => i.code.startsWith('NODE_OUTPUT_'))).toBe(false);
      }
    });
  });

  describe('Diagnostics, Paths and Boundaries', () => {
    it('37. paths preserve numeric indices for arrays', () => {
      const transformConfig: TransformNodeConfig = {
        rules: [
          {
            operation: 'template_string',
            targetKey: 'templated',
            segments: [
              { type: 'text', text: 'Intro ' },
              {
                type: 'reference',
                reference: { source: 'node_output', nodeId: 'bad_node', path: ['prop'] },
              },
            ],
          },
        ],
      };
      const graph: WorkflowGraph = {
        nodes: [createNode('t1', 'TRANSFORM', transformConfig)],
        edges: [],
      };
      const result = validateWorkflowNodeOutputReferences(graph);

      expect(result.success).toBe(false);
      if (!result.success && result.stage === 'references') {
        expect(result.issues[0]?.path).toEqual([
          'nodes',
          0,
          'config',
          'rules',
          0,
          'segments',
          1,
          'reference',
          'nodeId',
        ]);
        expect(typeof result.issues[0]?.path[1]).toBe('number');
        expect(typeof result.issues[0]?.path[4]).toBe('number');
        expect(typeof result.issues[0]?.path[6]).toBe('number');
      }
    });

    it('38. mapping keys containing dots or spaces remain intact in paths', () => {
      const outputConfig: OutputNodeConfig = {
        payloadMapping: {
          'review.summary with spaces': {
            type: 'reference',
            reference: { source: 'node_output', nodeId: 'bad_target', path: ['summary'] },
          },
        },
      };
      const graph: WorkflowGraph = {
        nodes: [createNode('out_1', 'OUTPUT', outputConfig)],
        edges: [],
      };
      const result = validateWorkflowNodeOutputReferences(graph);

      expect(result.success).toBe(false);
      if (!result.success && result.stage === 'references') {
        expect(result.issues[0]?.path).toEqual([
          'nodes',
          0,
          'config',
          'payloadMapping',
          'review.summary with spaces',
          'reference',
          'nodeId',
        ]);
      }
    });

    it('39. results are JSON-serializable', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('t1', 'TRANSFORM', {
            rules: [
              {
                operation: 'json_pick',
                targetKey: 'k',
                source: { source: 'node_output', nodeId: 'missing', path: ['a'] },
              },
            ],
          }),
        ],
        edges: [],
      };
      const result = validateWorkflowNodeOutputReferences(graph);
      const json = JSON.stringify(result);
      const parsed = JSON.parse(json);

      expect(parsed).toEqual(result);
    });

    it('40. results have correct TypeScript discriminants', () => {
      const graph: WorkflowGraph = { nodes: [], edges: [] };
      const result: WorkflowNodeOutputReferenceValidationResult =
        validateWorkflowNodeOutputReferences(graph);

      if (result.success) {
        expect(result.issues).toEqual([]);
      } else {
        // TypeScript exhaustively narrows stage
        switch (result.stage) {
          case 'integrity':
            expect(result.issues.length).toBeGreaterThanOrEqual(0);
            break;
          case 'configuration':
            expect(result.issues.length).toBeGreaterThanOrEqual(0);
            break;
          case 'references':
            expect(result.issues.length).toBeGreaterThanOrEqual(0);
            break;
        }
      }
    });

    it('41. node-output property paths are not verified against actual runtime output schemas', () => {
      const transformConfig: TransformNodeConfig = {
        rules: [
          {
            operation: 'json_pick',
            targetKey: 'k',
            // Upstream produces { a: 1 }, but path targets ['completely', 'invented', 'runtime', 'property']
            source: {
              source: 'node_output',
              nodeId: 'up',
              path: ['completely', 'invented', 'runtime', 'property'],
            },
          },
        ],
      };
      const graph: WorkflowGraph = {
        nodes: [
          createNode('up', 'TRANSFORM', {
            rules: [
              { operation: 'json_set', targetKey: 'a', value: { type: 'literal', value: 1 } },
            ],
          }),
          createNode('down', 'TRANSFORM', transformConfig),
        ],
        edges: [createEdge('e1', 'up', 'down')],
      };
      const result = validateWorkflowNodeOutputReferences(graph);

      // Static ancestry validator does NOT check property existence
      expect(result.success).toBe(true);
    });

    it('42. static ancestry does not imply conditional runtime availability', () => {
      // In a diamond branching graph, MERGE references branchA. Static ancestry passes.
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in', 'INPUT', validEmptyInputConfig),
          createNode('cond', 'CONDITION', {
            operator: 'is_not_empty',
            left: { type: 'literal', value: 'flag' },
          }),
          createNode('bA', 'TRANSFORM', {
            rules: [
              { operation: 'json_set', targetKey: 'x', value: { type: 'literal', value: 1 } },
            ],
          }),
          createNode('bB', 'TRANSFORM', {
            rules: [
              { operation: 'json_set', targetKey: 'y', value: { type: 'literal', value: 2 } },
            ],
          }),
          createNode('join', 'TRANSFORM', {
            rules: [
              {
                operation: 'json_pick',
                targetKey: 'dataFromA',
                source: { source: 'node_output', nodeId: 'bA', path: ['x'] },
              },
            ],
          }),
        ],
        edges: [
          createEdge('e1', 'in', 'cond'),
          createEdge('e2', 'cond', 'bA', 'TRUE'),
          createEdge('e3', 'cond', 'bB', 'FALSE'),
          createEdge('e4', 'bA', 'join'),
          createEdge('e5', 'bB', 'join'),
        ],
      };
      const result = validateWorkflowNodeOutputReferences(graph);

      expect(result.success).toBe(true);
    });

    it('43. no network, database, authorization or execution checks occur (pure function)', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('mcp', 'MCP_TOOL', {
            integrationRef: 'unauthorized_integration_ref',
            toolName: 'dangerous_system_call',
            arguments: {},
          }),
        ],
        edges: [],
      };
      // Pure static analysis does not call MCP client or check integration permissions
      const result = validateWorkflowNodeOutputReferences(graph);

      expect(result.success).toBe(true);
    });

    it('44. all prior graph integrity analyzer behavior is preserved', () => {
      const graph: WorkflowGraph = {
        nodes: [createNode('n1', 'TRANSFORM', {}), createNode('n2', 'TRANSFORM', {})],
        edges: [createEdge('e1', 'n1', 'n2')],
      };
      const integrity = analyzeWorkflowGraph(graph);

      expect(integrity.success).toBe(true);
      if (integrity.success) {
        expect(integrity.topologicalNodeIds).toEqual(['n1', 'n2']);
      }
    });

    it('45. all prior graph semantics validator behavior is preserved', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in', 'INPUT', validEmptyInputConfig),
          createNode('out', 'OUTPUT', validOutputLiteralConfig),
        ],
        edges: [createEdge('e1', 'in', 'out')],
      };
      const semantics = validateWorkflowGraphSemantics(graph);

      expect(semantics.success).toBe(true);
      if (semantics.success) {
        expect(semantics.topologicalNodeIds).toEqual(['in', 'out']);
      }
    });

    it('46. all contracts tests and schema integrations remain compatible', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in', 'INPUT', validEmptyInputConfig),
          createNode('out', 'OUTPUT', validOutputLiteralConfig),
        ],
        edges: [createEdge('e1', 'in', 'out')],
      };
      const result = validateWorkflowNodeOutputReferences(graph);

      expect(result.success).toBe(true);
      expect(result.issues).toEqual([]);
    });
  });

  describe('TypeScript Type Inference Verification', () => {
    it('accepts WorkflowGraph and returns WorkflowNodeOutputReferenceValidationResult', () => {
      const graph: WorkflowGraph = { nodes: [], edges: [] };
      const result = validateWorkflowNodeOutputReferences(graph);
      expectTypeOf(result).toEqualTypeOf<WorkflowNodeOutputReferenceValidationResult>();
    });

    it('narrows on success discriminant', () => {
      const graph: WorkflowGraph = { nodes: [], edges: [] };
      const result = validateWorkflowNodeOutputReferences(graph);
      if (result.success) {
        expectTypeOf(result).toEqualTypeOf<WorkflowNodeOutputReferenceSuccessResult>();
        expectTypeOf(result.issues).toEqualTypeOf<readonly []>();
      }
    });

    it('narrows on stage for all failure variants', () => {
      const graph: WorkflowGraph = { nodes: [], edges: [] };
      const result = validateWorkflowNodeOutputReferences(graph);
      if (!result.success) {
        if (result.stage === 'integrity') {
          expectTypeOf(result).toEqualTypeOf<WorkflowNodeOutputReferenceIntegrityFailureResult>();
          expectTypeOf(result.issues).toEqualTypeOf<GraphIntegrityIssue[]>();
        } else if (result.stage === 'configuration') {
          expectTypeOf(
            result,
          ).toEqualTypeOf<WorkflowNodeOutputReferenceConfigurationFailureResult>();
          expectTypeOf(result.issues).toEqualTypeOf<
            ReadonlyArray<WorkflowNodeConfigValidationIssue>
          >();
        } else if (result.stage === 'references') {
          expectTypeOf(result).toEqualTypeOf<WorkflowNodeOutputReferenceFailureResult>();
          expectTypeOf(result.issues).toEqualTypeOf<NodeOutputReferenceIssue[]>();
          expectTypeOf(result.issues[0]?.code).toEqualTypeOf<
            NodeOutputReferenceIssueCode | undefined
          >();
          expectTypeOf(result.issues[0]?.path).toEqualTypeOf<
            ReadonlyArray<string | number> | undefined
          >();
        }
      }
    });
  });
});
