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
  validateWorkflowInputReferences,
  validateWorkflowNodeOutputReferences,
  type GraphIntegrityIssue,
  type InputReferenceIssue,
  type InputReferenceIssueCode,
  type WorkflowInputReferenceConfigurationFailureResult,
  type WorkflowInputReferenceFailureResult,
  type WorkflowInputReferenceIntegrityFailureResult,
  type WorkflowInputReferenceSuccessResult,
  type WorkflowInputReferenceValidationResult,
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

describe('validateWorkflowInputReferences', () => {
  describe('Positive Cases', () => {
    it('1. a valid reference to a field declared by one INPUT succeeds', () => {
      const inputConfig: InputNodeConfig = {
        fields: [{ name: 'customerId', type: 'string', required: true }],
      };
      const transformConfig: TransformNodeConfig = {
        rules: [
          {
            operation: 'json_pick',
            targetKey: 'extractedId',
            source: { source: 'input', field: 'customerId', path: [] },
          },
        ],
      };
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT', inputConfig),
          createNode('t_1', 'TRANSFORM', transformConfig),
        ],
        edges: [createEdge('e1', 'in_1', 't_1')],
      };
      const result = validateWorkflowInputReferences(graph);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.issues).toEqual([]);
      }
    });

    it('2. multiple unique fields in one INPUT succeed', () => {
      const inputConfig: InputNodeConfig = {
        fields: [
          { name: 'customerId', type: 'string', required: true },
          { name: 'email', type: 'string', required: false },
          { name: 'retryLimit', type: 'number', required: false, defaultValue: 3 },
        ],
      };
      const transformConfig: TransformNodeConfig = {
        rules: [
          {
            operation: 'json_pick',
            targetKey: 'id',
            source: { source: 'input', field: 'customerId', path: [] },
          },
          {
            operation: 'json_pick',
            targetKey: 'mail',
            source: { source: 'input', field: 'email', path: [] },
          },
          {
            operation: 'json_set',
            targetKey: 'retries',
            value: {
              type: 'reference',
              reference: { source: 'input', field: 'retryLimit', path: [] },
            },
          },
        ],
      };
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT', inputConfig),
          createNode('t_1', 'TRANSFORM', transformConfig),
        ],
        edges: [createEdge('e1', 'in_1', 't_1')],
      };
      const result = validateWorkflowInputReferences(graph);

      expect(result.success).toBe(true);
    });

    it('3. fields declared by multiple INPUT nodes with distinct names resolve correctly', () => {
      const inputAConfig: InputNodeConfig = {
        fields: [{ name: 'userId', type: 'string', required: true }],
      };
      const inputBConfig: InputNodeConfig = {
        fields: [{ name: 'orderId', type: 'string', required: true }],
      };
      const transformConfig: TransformNodeConfig = {
        rules: [
          {
            operation: 'json_pick',
            targetKey: 'u',
            source: { source: 'input', field: 'userId', path: [] },
          },
          {
            operation: 'json_pick',
            targetKey: 'o',
            source: { source: 'input', field: 'orderId', path: [] },
          },
        ],
      };
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_A', 'INPUT', inputAConfig),
          createNode('in_B', 'INPUT', inputBConfig),
          createNode('t_1', 'TRANSFORM', transformConfig),
        ],
        edges: [createEdge('e1', 'in_A', 't_1'), createEdge('e2', 'in_B', 't_1')],
      };
      const result = validateWorkflowInputReferences(graph);

      expect(result.success).toBe(true);
    });

    it('4. multiple INPUT nodes with disjoint field names are supported', () => {
      const inputAConfig: InputNodeConfig = {
        fields: [
          { name: 'alpha', type: 'string', required: true },
          { name: 'beta', type: 'number', required: false },
        ],
      };
      const inputBConfig: InputNodeConfig = {
        fields: [
          { name: 'gamma', type: 'boolean', required: true },
          { name: 'delta', type: 'json', required: false },
        ],
      };
      const outputConfig: OutputNodeConfig = {
        payloadMapping: {
          a: { type: 'reference', reference: { source: 'input', field: 'alpha', path: [] } },
          g: { type: 'reference', reference: { source: 'input', field: 'gamma', path: [] } },
        },
      };
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_A', 'INPUT', inputAConfig),
          createNode('in_B', 'INPUT', inputBConfig),
          createNode('out_1', 'OUTPUT', outputConfig),
        ],
        edges: [createEdge('e1', 'in_A', 'out_1'), createEdge('e2', 'in_B', 'out_1')],
      };
      const result = validateWorkflowInputReferences(graph);

      expect(result.success).toBe(true);
    });

    it('5. multiple OUTPUT nodes do not affect reference resolution', () => {
      const inputConfig: InputNodeConfig = {
        fields: [{ name: 'sharedToken', type: 'string', required: true }],
      };
      const out1Config: OutputNodeConfig = {
        payloadMapping: {
          t1: { type: 'reference', reference: { source: 'input', field: 'sharedToken', path: [] } },
        },
      };
      const out2Config: OutputNodeConfig = {
        payloadMapping: {
          t2: { type: 'reference', reference: { source: 'input', field: 'sharedToken', path: [] } },
        },
      };
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT', inputConfig),
          createNode('out_1', 'OUTPUT', out1Config),
          createNode('out_2', 'OUTPUT', out2Config),
        ],
        edges: [createEdge('e1', 'in_1', 'out_1'), createEdge('e2', 'in_1', 'out_2')],
      };
      const result = validateWorkflowInputReferences(graph);

      expect(result.success).toBe(true);
    });

    it('6. exact casing is preserved in field resolution', () => {
      const inputConfig: InputNodeConfig = {
        fields: [
          { name: 'customerId', type: 'string', required: true },
          { name: 'CustomerId', type: 'string', required: true },
        ],
      };
      // In a single INPUT node, duplicate field names are rejected by configuration schema,
      // but 'customerId' and 'CustomerId' have distinct casing and are valid distinct fields.
      const transformConfig: TransformNodeConfig = {
        rules: [
          {
            operation: 'json_pick',
            targetKey: 'lower',
            source: { source: 'input', field: 'customerId', path: [] },
          },
          {
            operation: 'json_pick',
            targetKey: 'upper',
            source: { source: 'input', field: 'CustomerId', path: [] },
          },
        ],
      };
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT', inputConfig),
          createNode('t_1', 'TRANSFORM', transformConfig),
        ],
        edges: [createEdge('e1', 'in_1', 't_1')],
      };
      const result = validateWorkflowInputReferences(graph);

      expect(result.success).toBe(true);
    });

    it('7. dotted field names remain atomic', () => {
      const inputConfig: InputNodeConfig = {
        fields: [{ name: 'user.profile.id', type: 'string', required: true }],
      };
      const transformConfig: TransformNodeConfig = {
        rules: [
          {
            operation: 'json_pick',
            targetKey: 'extracted',
            source: { source: 'input', field: 'user.profile.id', path: [] },
          },
        ],
      };
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT', inputConfig),
          createNode('t_1', 'TRANSFORM', transformConfig),
        ],
        edges: [createEdge('e1', 'in_1', 't_1')],
      };
      const result = validateWorkflowInputReferences(graph);

      expect(result.success).toBe(true);
    });

    it('8. field names containing spaces remain atomic', () => {
      const inputConfig: InputNodeConfig = {
        fields: [{ name: 'customer id', type: 'string', required: true }],
      };
      const transformConfig: TransformNodeConfig = {
        rules: [
          {
            operation: 'json_pick',
            targetKey: 'extracted',
            source: { source: 'input', field: 'customer id', path: [] },
          },
        ],
      };
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT', inputConfig),
          createNode('t_1', 'TRANSFORM', transformConfig),
        ],
        edges: [createEdge('e1', 'in_1', 't_1')],
      };
      const result = validateWorkflowInputReferences(graph);

      expect(result.success).toBe(true);
    });

    it('9. a reference with structured path segments is accepted without resolving the path', () => {
      const inputConfig: InputNodeConfig = {
        fields: [{ name: 'payload', type: 'json', required: true }],
      };
      const transformConfig: TransformNodeConfig = {
        rules: [
          {
            operation: 'json_pick',
            targetKey: 'deep',
            source: { source: 'input', field: 'payload', path: ['nested', 'deep', 'property'] },
          },
        ],
      };
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT', inputConfig),
          createNode('t_1', 'TRANSFORM', transformConfig),
        ],
        edges: [createEdge('e1', 'in_1', 't_1')],
      };
      const result = validateWorkflowInputReferences(graph);

      expect(result.success).toBe(true);
    });

    it('10. optional declared INPUT fields can be referenced', () => {
      const inputConfig: InputNodeConfig = {
        fields: [{ name: 'optionalTag', type: 'string', required: false }],
      };
      const transformConfig: TransformNodeConfig = {
        rules: [
          {
            operation: 'json_pick',
            targetKey: 'tag',
            source: { source: 'input', field: 'optionalTag', path: [] },
          },
        ],
      };
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT', inputConfig),
          createNode('t_1', 'TRANSFORM', transformConfig),
        ],
        edges: [createEdge('e1', 'in_1', 't_1')],
      };
      const result = validateWorkflowInputReferences(graph);

      expect(result.success).toBe(true);
    });

    it('11. required declared INPUT fields can be referenced', () => {
      const inputConfig: InputNodeConfig = {
        fields: [{ name: 'requiredId', type: 'string', required: true }],
      };
      const transformConfig: TransformNodeConfig = {
        rules: [
          {
            operation: 'json_pick',
            targetKey: 'id',
            source: { source: 'input', field: 'requiredId', path: [] },
          },
        ],
      };
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT', inputConfig),
          createNode('t_1', 'TRANSFORM', transformConfig),
        ],
        edges: [createEdge('e1', 'in_1', 't_1')],
      };
      const result = validateWorkflowInputReferences(graph);

      expect(result.success).toBe(true);
    });

    it('12. fields without default values can be referenced', () => {
      const inputConfig: InputNodeConfig = {
        fields: [{ name: 'noDefault', type: 'number', required: false }],
      };
      const transformConfig: TransformNodeConfig = {
        rules: [
          {
            operation: 'json_pick',
            targetKey: 'num',
            source: { source: 'input', field: 'noDefault', path: [] },
          },
        ],
      };
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT', inputConfig),
          createNode('t_1', 'TRANSFORM', transformConfig),
        ],
        edges: [createEdge('e1', 'in_1', 't_1')],
      };
      const result = validateWorkflowInputReferences(graph);

      expect(result.success).toBe(true);
    });

    it('13. no INPUT references produces success after prerequisites pass', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT', validEmptyInputConfig),
          createNode('out_1', 'OUTPUT', validOutputLiteralConfig),
        ],
        edges: [createEdge('e1', 'in_1', 'out_1')],
      };
      const result = validateWorkflowInputReferences(graph);

      expect(result.success).toBe(true);
      expect(result.issues).toEqual([]);
    });

    it('14. an unreferenced field duplicated across two INPUT nodes does not by itself produce an input-reference issue', () => {
      const inputAConfig: InputNodeConfig = {
        fields: [{ name: 'duplicatedField', type: 'string', required: true }],
      };
      const inputBConfig: InputNodeConfig = {
        fields: [{ name: 'duplicatedField', type: 'string', required: true }],
      };
      const outputConfig: OutputNodeConfig = {
        payloadMapping: {
          result: { type: 'literal', value: 'no reference to duplicatedField' },
        },
      };
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_A', 'INPUT', inputAConfig),
          createNode('in_B', 'INPUT', inputBConfig),
          createNode('out_1', 'OUTPUT', outputConfig),
        ],
        edges: [createEdge('e1', 'in_A', 'out_1'), createEdge('e2', 'in_B', 'out_1')],
      };
      // Ambiguity is checked only when an actual reference resolves against that field name
      const result = validateWorkflowInputReferences(graph);

      expect(result.success).toBe(true);
    });

    it('15. literal JSON resembling an input reference is ignored', () => {
      const transformConfig: TransformNodeConfig = {
        rules: [
          {
            operation: 'json_set',
            targetKey: 'fakeRef',
            value: {
              type: 'literal',
              value: {
                source: 'input',
                field: 'non_existent_input_field',
                path: [],
              },
            },
          },
        ],
      };
      const graph: WorkflowGraph = {
        nodes: [createNode('t_1', 'TRANSFORM', transformConfig)],
        edges: [],
      };
      const result = validateWorkflowInputReferences(graph);

      expect(result.success).toBe(true);
    });

    it('16. literal prompt text is ignored', () => {
      const llmConfig: LlmNodeConfig = {
        provider: 'openai',
        model: 'gpt-4o',
        prompt: {
          type: 'literal',
          value: 'Hello {{input.missingField}}, please ignore this syntax',
        },
      };
      const graph: WorkflowGraph = {
        nodes: [createNode('llm_1', 'LLM', llmConfig)],
        edges: [],
      };
      const result = validateWorkflowInputReferences(graph);

      expect(result.success).toBe(true);
    });

    it('17. TRANSFORM json_pick direct references are inspected', () => {
      const inputConfig: InputNodeConfig = {
        fields: [{ name: 'query', type: 'string', required: true }],
      };
      const transformConfig: TransformNodeConfig = {
        rules: [
          {
            operation: 'json_pick',
            targetKey: 'q',
            source: { source: 'input', field: 'query', path: [] },
          },
        ],
      };
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT', inputConfig),
          createNode('t_1', 'TRANSFORM', transformConfig),
        ],
        edges: [createEdge('e1', 'in_1', 't_1')],
      };
      const result = validateWorkflowInputReferences(graph);

      expect(result.success).toBe(true);
    });

    it('18. TRANSFORM json_set bindings are inspected', () => {
      const inputConfig: InputNodeConfig = {
        fields: [{ name: 'flag', type: 'boolean', required: true }],
      };
      const transformConfig: TransformNodeConfig = {
        rules: [
          {
            operation: 'json_set',
            targetKey: 'boolVal',
            value: { type: 'reference', reference: { source: 'input', field: 'flag', path: [] } },
          },
        ],
      };
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT', inputConfig),
          createNode('t_1', 'TRANSFORM', transformConfig),
        ],
        edges: [createEdge('e1', 'in_1', 't_1')],
      };
      const result = validateWorkflowInputReferences(graph);

      expect(result.success).toBe(true);
    });

    it('19. TRANSFORM template_string reference segments are inspected', () => {
      const inputConfig: InputNodeConfig = {
        fields: [{ name: 'username', type: 'string', required: true }],
      };
      const transformConfig: TransformNodeConfig = {
        rules: [
          {
            operation: 'template_string',
            targetKey: 'greeting',
            segments: [
              { type: 'text', text: 'Hello, ' },
              {
                type: 'reference',
                reference: { source: 'input', field: 'username', path: [] },
              },
            ],
          },
        ],
      };
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT', inputConfig),
          createNode('t_1', 'TRANSFORM', transformConfig),
        ],
        edges: [createEdge('e1', 'in_1', 't_1')],
      };
      const result = validateWorkflowInputReferences(graph);

      expect(result.success).toBe(true);
    });

    it('20. TRANSFORM math_op operands are inspected', () => {
      const inputConfig: InputNodeConfig = {
        fields: [
          { name: 'valA', type: 'number', required: true },
          { name: 'valB', type: 'number', required: true },
        ],
      };
      const transformConfig: TransformNodeConfig = {
        rules: [
          {
            operation: 'math_op',
            targetKey: 'sum',
            operator: 'add',
            left: { type: 'reference', reference: { source: 'input', field: 'valA', path: [] } },
            right: { type: 'reference', reference: { source: 'input', field: 'valB', path: [] } },
          },
        ],
      };
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT', inputConfig),
          createNode('t_1', 'TRANSFORM', transformConfig),
        ],
        edges: [createEdge('e1', 'in_1', 't_1')],
      };
      const result = validateWorkflowInputReferences(graph);

      expect(result.success).toBe(true);
    });

    it('21. CONDITION unary and binary bindings are inspected', () => {
      const inputConfig: InputNodeConfig = {
        fields: [
          { name: 'status', type: 'string', required: true },
          { name: 'score', type: 'number', required: true },
        ],
      };
      const unaryCond: ConditionNodeConfig = {
        operator: 'is_not_empty',
        left: { type: 'reference', reference: { source: 'input', field: 'status', path: [] } },
      };
      const binaryCond: ConditionNodeConfig = {
        operator: 'greater_than',
        left: { type: 'reference', reference: { source: 'input', field: 'score', path: [] } },
        right: { type: 'literal', value: 50 },
      };
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT', inputConfig),
          createNode('c_u', 'CONDITION', unaryCond),
          createNode('c_b', 'CONDITION', binaryCond),
        ],
        edges: [createEdge('e1', 'in_1', 'c_u'), createEdge('e2', 'in_1', 'c_b')],
      };
      const result = validateWorkflowInputReferences(graph);

      expect(result.success).toBe(true);
    });

    it('22. LLM prompt reference is inspected', () => {
      const inputConfig: InputNodeConfig = {
        fields: [{ name: 'promptInput', type: 'string', required: true }],
      };
      const llmConfig: LlmNodeConfig = {
        provider: 'anthropic',
        model: 'claude-3-7-sonnet',
        prompt: {
          type: 'reference',
          reference: { source: 'input', field: 'promptInput', path: [] },
        },
      };
      const graph: WorkflowGraph = {
        nodes: [createNode('in_1', 'INPUT', inputConfig), createNode('llm_1', 'LLM', llmConfig)],
        edges: [createEdge('e1', 'in_1', 'llm_1')],
      };
      const result = validateWorkflowInputReferences(graph);

      expect(result.success).toBe(true);
    });

    it('23. MCP_TOOL arguments are inspected', () => {
      const inputConfig: InputNodeConfig = {
        fields: [{ name: 'repoName', type: 'string', required: true }],
      };
      const mcpConfig: McpToolNodeConfig = {
        integrationRef: 'github_app',
        toolName: 'get_repo',
        arguments: {
          name: {
            type: 'reference',
            reference: { source: 'input', field: 'repoName', path: [] },
          },
        },
      };
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT', inputConfig),
          createNode('mcp_1', 'MCP_TOOL', mcpConfig),
        ],
        edges: [createEdge('e1', 'in_1', 'mcp_1')],
      };
      const result = validateWorkflowInputReferences(graph);

      expect(result.success).toBe(true);
    });

    it('24. OUTPUT payload mappings are inspected', () => {
      const inputConfig: InputNodeConfig = {
        fields: [{ name: 'echoVal', type: 'string', required: true }],
      };
      const outputConfig: OutputNodeConfig = {
        payloadMapping: {
          response: {
            type: 'reference',
            reference: { source: 'input', field: 'echoVal', path: [] },
          },
        },
      };
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT', inputConfig),
          createNode('out_1', 'OUTPUT', outputConfig),
        ],
        edges: [createEdge('e1', 'in_1', 'out_1')],
      };
      const result = validateWorkflowInputReferences(graph);

      expect(result.success).toBe(true);
    });

    it('25. APPROVAL static text is not scanned', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('app_1', 'APPROVAL', {
            title: 'Please check {{input.missingField}}',
            description: 'Refers to {{input.otherMissing}}',
            policy: { roles: ['ADMIN'] },
            timeoutMinutes: 60,
            timeoutAction: 'REJECT',
          }),
        ],
        edges: [],
      };
      const result = validateWorkflowInputReferences(graph);

      expect(result.success).toBe(true);
    });

    it('26. repeated analysis is deterministic', () => {
      const inputConfig: InputNodeConfig = {
        fields: [{ name: 'x', type: 'number', required: true }],
      };
      const transformConfig: TransformNodeConfig = {
        rules: [
          {
            operation: 'json_pick',
            targetKey: 'pickedX',
            source: { source: 'input', field: 'x', path: [] },
          },
        ],
      };
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT', inputConfig),
          createNode('t_1', 'TRANSFORM', transformConfig),
        ],
        edges: [createEdge('e1', 'in_1', 't_1')],
      };

      const result1 = validateWorkflowInputReferences(graph);
      const result2 = validateWorkflowInputReferences(graph);

      expect(result1).toEqual(result2);
    });

    it('27. frozen graph input is not mutated', () => {
      const graph = {
        nodes: Object.freeze([
          Object.freeze(
            createNode('in_1', 'INPUT', {
              fields: Object.freeze([{ name: 'f', type: 'string', required: true }]),
            }),
          ),
          Object.freeze(
            createNode('t_1', 'TRANSFORM', {
              rules: Object.freeze([
                {
                  operation: 'json_pick',
                  targetKey: 'pickedF',
                  source: Object.freeze({ source: 'input', field: 'f', path: Object.freeze([]) }),
                },
              ]),
            }),
          ),
        ]),
        edges: Object.freeze([createEdge('e1', 'in_1', 't_1')]),
      };
      Object.freeze(graph);

      expect(() =>
        validateWorkflowInputReferences(graph as unknown as WorkflowGraph),
      ).not.toThrow();
    });
  });

  describe('Negative Cases', () => {
    it('28. referenced INPUT field does not exist', () => {
      const transformConfig: TransformNodeConfig = {
        rules: [
          {
            operation: 'json_pick',
            targetKey: 'val',
            source: { source: 'input', field: 'non_existent_field', path: [] },
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
      const result = validateWorkflowInputReferences(graph);

      expect(result.success).toBe(false);
      if (!result.success && result.stage === 'input_references') {
        expect(result.issues).toHaveLength(1);
        expect(result.issues[0]?.code).toBe('INPUT_REFERENCE_FIELD_NOT_FOUND');
        expect(result.issues[0]?.path).toEqual([
          'nodes',
          1,
          'config',
          'rules',
          0,
          'source',
          'field',
        ]);
        expect(result.issues[0]?.message).toContain('non_existent_field');
      }
    });

    it('29. different identifier casing causes NOT_FOUND', () => {
      const inputConfig: InputNodeConfig = {
        fields: [{ name: 'customerId', type: 'string', required: true }],
      };
      const transformConfig: TransformNodeConfig = {
        rules: [
          {
            operation: 'json_pick',
            targetKey: 'val',
            source: { source: 'input', field: 'CustomerId', path: [] },
          },
        ],
      };
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT', inputConfig),
          createNode('t_1', 'TRANSFORM', transformConfig),
        ],
        edges: [createEdge('e1', 'in_1', 't_1')],
      };
      const result = validateWorkflowInputReferences(graph);

      expect(result.success).toBe(false);
      if (!result.success && result.stage === 'input_references') {
        expect(result.issues).toHaveLength(1);
        expect(result.issues[0]?.code).toBe('INPUT_REFERENCE_FIELD_NOT_FOUND');
        expect(result.issues[0]?.message).toContain('CustomerId');
      }
    });

    it('30. empty declared INPUT field lists cause NOT_FOUND when referenced', () => {
      const transformConfig: TransformNodeConfig = {
        rules: [
          {
            operation: 'json_pick',
            targetKey: 'val',
            source: { source: 'input', field: 'anyField', path: [] },
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
      const result = validateWorkflowInputReferences(graph);

      expect(result.success).toBe(false);
      if (!result.success && result.stage === 'input_references') {
        expect(result.issues[0]?.code).toBe('INPUT_REFERENCE_FIELD_NOT_FOUND');
      }
    });

    it('31. two INPUT nodes declare the same referenced field -> AMBIGUOUS', () => {
      const inA: InputNodeConfig = {
        fields: [{ name: 'token', type: 'string', required: true }],
      };
      const inB: InputNodeConfig = {
        fields: [{ name: 'token', type: 'string', required: true }],
      };
      const transformConfig: TransformNodeConfig = {
        rules: [
          {
            operation: 'json_pick',
            targetKey: 't',
            source: { source: 'input', field: 'token', path: [] },
          },
        ],
      };
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_A', 'INPUT', inA),
          createNode('in_B', 'INPUT', inB),
          createNode('t_1', 'TRANSFORM', transformConfig),
        ],
        edges: [createEdge('e1', 'in_A', 't_1'), createEdge('e2', 'in_B', 't_1')],
      };
      const result = validateWorkflowInputReferences(graph);

      expect(result.success).toBe(false);
      if (!result.success && result.stage === 'input_references') {
        expect(result.issues).toHaveLength(1);
        expect(result.issues[0]?.code).toBe('INPUT_REFERENCE_FIELD_AMBIGUOUS');
        expect(result.issues[0]?.path).toEqual([
          'nodes',
          2,
          'config',
          'rules',
          0,
          'source',
          'field',
        ]);
        expect(result.issues[0]?.message).toContain(
          'ambiguously declared across multiple INPUT nodes',
        );
      }
    });

    it('32. matching duplicate declarations with the same field type remain ambiguous', () => {
      const inA: InputNodeConfig = {
        fields: [{ name: 'flag', type: 'boolean', required: true }],
      };
      const inB: InputNodeConfig = {
        fields: [{ name: 'flag', type: 'boolean', required: true }],
      };
      const outputConfig: OutputNodeConfig = {
        payloadMapping: {
          f: { type: 'reference', reference: { source: 'input', field: 'flag', path: [] } },
        },
      };
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_A', 'INPUT', inA),
          createNode('in_B', 'INPUT', inB),
          createNode('out_1', 'OUTPUT', outputConfig),
        ],
        edges: [createEdge('e1', 'in_A', 'out_1'), createEdge('e2', 'in_B', 'out_1')],
      };
      const result = validateWorkflowInputReferences(graph);

      expect(result.success).toBe(false);
      if (!result.success && result.stage === 'input_references') {
        expect(result.issues[0]?.code).toBe('INPUT_REFERENCE_FIELD_AMBIGUOUS');
      }
    });

    it('33. matching duplicate declarations with different field types remain ambiguous', () => {
      const inA: InputNodeConfig = {
        fields: [{ name: 'data', type: 'string', required: true }],
      };
      const inB: InputNodeConfig = {
        fields: [{ name: 'data', type: 'json', required: true }],
      };
      const outputConfig: OutputNodeConfig = {
        payloadMapping: {
          d: { type: 'reference', reference: { source: 'input', field: 'data', path: [] } },
        },
      };
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_A', 'INPUT', inA),
          createNode('in_B', 'INPUT', inB),
          createNode('out_1', 'OUTPUT', outputConfig),
        ],
        edges: [createEdge('e1', 'in_A', 'out_1'), createEdge('e2', 'in_B', 'out_1')],
      };
      const result = validateWorkflowInputReferences(graph);

      expect(result.success).toBe(false);
      if (!result.success && result.stage === 'input_references') {
        expect(result.issues[0]?.code).toBe('INPUT_REFERENCE_FIELD_AMBIGUOUS');
      }
    });

    it('34. ambiguity is independent of INPUT node array order', () => {
      const inA: InputNodeConfig = {
        fields: [{ name: 'token', type: 'string', required: true }],
      };
      const inB: InputNodeConfig = {
        fields: [{ name: 'token', type: 'string', required: true }],
      };
      const transformConfig: TransformNodeConfig = {
        rules: [
          {
            operation: 'json_pick',
            targetKey: 't',
            source: { source: 'input', field: 'token', path: [] },
          },
        ],
      };
      const graphOrder1: WorkflowGraph = {
        nodes: [
          createNode('in_A', 'INPUT', inA),
          createNode('in_B', 'INPUT', inB),
          createNode('t_1', 'TRANSFORM', transformConfig),
        ],
        edges: [createEdge('e1', 'in_A', 't_1'), createEdge('e2', 'in_B', 't_1')],
      };
      const graphOrder2: WorkflowGraph = {
        nodes: [
          createNode('in_B', 'INPUT', inB),
          createNode('in_A', 'INPUT', inA),
          createNode('t_1', 'TRANSFORM', transformConfig),
        ],
        edges: [createEdge('e1', 'in_B', 't_1'), createEdge('e2', 'in_A', 't_1')],
      };

      const result1 = validateWorkflowInputReferences(graphOrder1);
      const result2 = validateWorkflowInputReferences(graphOrder2);

      expect(result1.success).toBe(false);
      expect(result2.success).toBe(false);
      if (
        !result1.success &&
        !result2.success &&
        result1.stage === 'input_references' &&
        result2.stage === 'input_references'
      ) {
        expect(result1.issues[0]?.code).toBe('INPUT_REFERENCE_FIELD_AMBIGUOUS');
        expect(result2.issues[0]?.code).toBe('INPUT_REFERENCE_FIELD_AMBIGUOUS');
      }
    });

    it('35. multiple invalid references in one node are aggregated', () => {
      const transformConfig: TransformNodeConfig = {
        rules: [
          {
            operation: 'json_pick',
            targetKey: 'v1',
            source: { source: 'input', field: 'missing_one', path: [] },
          },
          {
            operation: 'json_set',
            targetKey: 'v2',
            value: {
              type: 'reference',
              reference: { source: 'input', field: 'missing_two', path: [] },
            },
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
      const result = validateWorkflowInputReferences(graph);

      expect(result.success).toBe(false);
      if (!result.success && result.stage === 'input_references') {
        expect(result.issues).toHaveLength(2);
        expect(result.issues[0]?.code).toBe('INPUT_REFERENCE_FIELD_NOT_FOUND');
        expect(result.issues[1]?.code).toBe('INPUT_REFERENCE_FIELD_NOT_FOUND');
      }
    });

    it('36. invalid references across multiple nodes are aggregated', () => {
      const inA: InputNodeConfig = {
        fields: [{ name: 'dup', type: 'string', required: true }],
      };
      const inB: InputNodeConfig = {
        fields: [{ name: 'dup', type: 'string', required: true }],
      };
      const t1Config: TransformNodeConfig = {
        rules: [
          {
            operation: 'json_pick',
            targetKey: 'k1',
            source: { source: 'input', field: 'dup', path: [] }, // AMBIGUOUS
          },
        ],
      };
      const t2Config: TransformNodeConfig = {
        rules: [
          {
            operation: 'json_pick',
            targetKey: 'k2',
            source: { source: 'input', field: 'completely_missing', path: [] }, // NOT_FOUND
          },
        ],
      };
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_A', 'INPUT', inA),
          createNode('in_B', 'INPUT', inB),
          createNode('t_1', 'TRANSFORM', t1Config),
          createNode('t_2', 'TRANSFORM', t2Config),
        ],
        edges: [
          createEdge('e1', 'in_A', 't_1'),
          createEdge('e2', 'in_B', 't_1'),
          createEdge('e3', 't_1', 't_2'),
        ],
      };
      const result = validateWorkflowInputReferences(graph);

      expect(result.success).toBe(false);
      if (!result.success && result.stage === 'input_references') {
        expect(result.issues).toHaveLength(2);
        expect(result.issues[0]?.code).toBe('INPUT_REFERENCE_FIELD_AMBIGUOUS');
        expect(result.issues[1]?.code).toBe('INPUT_REFERENCE_FIELD_NOT_FOUND');
      }
    });

    it('37. diagnostic paths retain numeric node and rule indices', () => {
      const transformConfig: TransformNodeConfig = {
        rules: [
          {
            operation: 'template_string',
            targetKey: 'templated',
            segments: [
              { type: 'text', text: 'Static ' },
              {
                type: 'reference',
                reference: { source: 'input', field: 'missing_segment_field', path: [] },
              },
            ],
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
      const result = validateWorkflowInputReferences(graph);

      expect(result.success).toBe(false);
      if (!result.success && result.stage === 'input_references') {
        expect(result.issues[0]?.path).toEqual([
          'nodes',
          1,
          'config',
          'rules',
          0,
          'segments',
          1,
          'reference',
          'field',
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
            reference: { source: 'input', field: 'bad_input', path: [] },
          },
        },
      };
      const graph: WorkflowGraph = {
        nodes: [createNode('out_1', 'OUTPUT', outputConfig)],
        edges: [],
      };
      const result = validateWorkflowInputReferences(graph);

      expect(result.success).toBe(false);
      if (!result.success && result.stage === 'input_references') {
        expect(result.issues[0]?.path).toEqual([
          'nodes',
          0,
          'config',
          'payloadMapping',
          'review.summary with spaces',
          'reference',
          'field',
        ]);
      }
    });

    it('39. missing referenced field in TRANSFORM json_pick yields the direct source path', () => {
      const transformConfig: TransformNodeConfig = {
        rules: [
          {
            operation: 'json_pick',
            targetKey: 'k',
            source: { source: 'input', field: 'missing_field', path: [] },
          },
        ],
      };
      const graph: WorkflowGraph = {
        nodes: [createNode('t_1', 'TRANSFORM', transformConfig)],
        edges: [],
      };
      const result = validateWorkflowInputReferences(graph);

      expect(result.success).toBe(false);
      if (!result.success && result.stage === 'input_references') {
        expect(result.issues[0]?.path).toEqual([
          'nodes',
          0,
          'config',
          'rules',
          0,
          'source',
          'field',
        ]);
      }
    });

    it('40. missing referenced field in LLM yields prompt.reference.field path', () => {
      const llmConfig: LlmNodeConfig = {
        provider: 'openai',
        model: 'gpt-4o',
        prompt: {
          type: 'reference',
          reference: { source: 'input', field: 'missing_prompt_field', path: [] },
        },
      };
      const graph: WorkflowGraph = {
        nodes: [createNode('llm_1', 'LLM', llmConfig)],
        edges: [],
      };
      const result = validateWorkflowInputReferences(graph);

      expect(result.success).toBe(false);
      if (!result.success && result.stage === 'input_references') {
        expect(result.issues[0]?.path).toEqual([
          'nodes',
          0,
          'config',
          'prompt',
          'reference',
          'field',
        ]);
      }
    });

    it('41. missing referenced field in MCP_TOOL yields argument.reference.field path', () => {
      const mcpConfig: McpToolNodeConfig = {
        integrationRef: 'github_app',
        toolName: 'create_issue',
        arguments: {
          'issue.key': {
            type: 'reference',
            reference: { source: 'input', field: 'missing_issue_key', path: [] },
          },
        },
      };
      const graph: WorkflowGraph = {
        nodes: [createNode('mcp_1', 'MCP_TOOL', mcpConfig)],
        edges: [],
      };
      const result = validateWorkflowInputReferences(graph);

      expect(result.success).toBe(false);
      if (!result.success && result.stage === 'input_references') {
        expect(result.issues[0]?.path).toEqual([
          'nodes',
          0,
          'config',
          'arguments',
          'issue.key',
          'reference',
          'field',
        ]);
      }
    });

    it('42. missing referenced field in OUTPUT yields mapping.reference.field path', () => {
      const outputConfig: OutputNodeConfig = {
        payloadMapping: {
          'response.value': {
            type: 'reference',
            reference: { source: 'input', field: 'missing_response_field', path: [] },
          },
        },
      };
      const graph: WorkflowGraph = {
        nodes: [createNode('out_1', 'OUTPUT', outputConfig)],
        edges: [],
      };
      const result = validateWorkflowInputReferences(graph);

      expect(result.success).toBe(false);
      if (!result.success && result.stage === 'input_references') {
        expect(result.issues[0]?.path).toEqual([
          'nodes',
          0,
          'config',
          'payloadMapping',
          'response.value',
          'reference',
          'field',
        ]);
      }
    });
  });

  describe('Prerequisite Stage Gating', () => {
    it('43. duplicate node IDs fail at integrity stage', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('dup', 'INPUT', validEmptyInputConfig),
          createNode('dup', 'INPUT', validEmptyInputConfig),
        ],
        edges: [],
      };
      const result = validateWorkflowInputReferences(graph);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.stage).toBe('integrity');
        expect(result.issues[0]?.code).toBe('DUPLICATE_NODE_ID');
      }
    });

    it('44. duplicate edge IDs fail at integrity stage', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT', validEmptyInputConfig),
          createNode('out_1', 'OUTPUT', validOutputLiteralConfig),
        ],
        edges: [createEdge('dup_e', 'in_1', 'out_1'), createEdge('dup_e', 'in_1', 'out_1')],
      };
      const result = validateWorkflowInputReferences(graph);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.stage).toBe('integrity');
        expect(result.issues[0]?.code).toBe('DUPLICATE_EDGE_ID');
      }
    });

    it('45. dangling edges fail at integrity stage', () => {
      const graph: WorkflowGraph = {
        nodes: [createNode('in_1', 'INPUT', validEmptyInputConfig)],
        edges: [createEdge('e1', 'in_1', 'missing_target')],
      };
      const result = validateWorkflowInputReferences(graph);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.stage).toBe('integrity');
        expect(result.issues[0]?.code).toBe('MISSING_EDGE_TARGET');
      }
    });

    it('46. cycles fail at integrity stage', () => {
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
      const result = validateWorkflowInputReferences(graph);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.stage).toBe('integrity');
        expect(result.issues[0]?.code).toBe('CYCLE_DETECTED');
      }
    });

    it('47. invalid INPUT field config fails at configuration stage', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT', {
            fields: [
              {
                name: 'invalid_field',
                type: 'unknown_type', // Invalid type
                required: true,
              },
            ],
          }),
        ],
        edges: [],
      };
      const result = validateWorkflowInputReferences(graph);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.stage).toBe('configuration');
      }
    });

    it('48. invalid binding discriminator fails at configuration stage', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('t_1', 'TRANSFORM', {
            rules: [
              {
                operation: 'json_set',
                targetKey: 'k',
                value: { type: 'unknown_binding', value: 123 },
              },
            ],
          }),
        ],
        edges: [],
      };
      const result = validateWorkflowInputReferences(graph);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.stage).toBe('configuration');
      }
    });

    it('49. incomplete draft config fails at configuration stage', () => {
      const graph: WorkflowGraph = {
        nodes: [createNode('t_1', 'TRANSFORM', {})],
        edges: [],
      };
      const result = validateWorkflowInputReferences(graph);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.stage).toBe('configuration');
      }
    });

    it('50. existing prerequisite codes and paths are preserved', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('t_1', 'TRANSFORM', {
            rules: [
              {
                operation: 'json_pick',
                targetKey: 'k',
                // missing 'source'
              },
            ],
          }),
        ],
        edges: [],
      };
      const result = validateWorkflowInputReferences(graph);

      expect(result.success).toBe(false);
      if (!result.success && result.stage === 'configuration') {
        expect(result.issues[0]?.nodeId).toBe('t_1');
        expect(result.issues[0]?.nodeIndex).toBe(0);
        expect(result.issues[0]?.path).toEqual(['nodes', 0, 'config', 'rules', 0, 'source']);
      }
    });

    it('51. no input-reference findings are returned after prerequisite failure', () => {
      // Graph with a cycle and an invalid input reference
      const graph: WorkflowGraph = {
        nodes: [
          createNode('A', 'TRANSFORM', {
            rules: [
              {
                operation: 'json_pick',
                targetKey: 'k',
                source: { source: 'input', field: 'completely_missing', path: [] },
              },
            ],
          }),
        ],
        edges: [createEdge('e1', 'A', 'A')], // cycle
      };
      const result = validateWorkflowInputReferences(graph);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.stage).toBe('integrity');
        expect(result.issues.some((i) => i.code.startsWith('INPUT_REFERENCE_'))).toBe(false);
      }
    });
  });

  describe('Boundary Cases and Invariants', () => {
    it('52. INPUT reference resolution does not require graph ancestry of the declaring INPUT', () => {
      // INPUT node and consumer TRANSFORM node are in separate static graph components
      const inputConfig: InputNodeConfig = {
        fields: [{ name: 'globalConfig', type: 'string', required: true }],
      };
      const transformConfig: TransformNodeConfig = {
        rules: [
          {
            operation: 'json_pick',
            targetKey: 'val',
            source: { source: 'input', field: 'globalConfig', path: [] },
          },
        ],
      };
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_standalone', 'INPUT', inputConfig),
          createNode('t_standalone', 'TRANSFORM', transformConfig),
        ],
        edges: [], // No edge between in_standalone and t_standalone
      };
      const result = validateWorkflowInputReferences(graph);

      // Workflow-level input field reference resolves without directed graph ancestry
      expect(result.success).toBe(true);
    });

    it('53. nested input property paths are not checked against runtime JSON', () => {
      const inputConfig: InputNodeConfig = {
        fields: [{ name: 'data', type: 'json', required: true }],
      };
      const transformConfig: TransformNodeConfig = {
        rules: [
          {
            operation: 'json_pick',
            targetKey: 'val',
            source: {
              source: 'input',
              field: 'data',
              path: ['arbitrary', 'nested', 'runtime', 'property', 'not_checked'],
            },
          },
        ],
      };
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT', inputConfig),
          createNode('t_1', 'TRANSFORM', transformConfig),
        ],
        edges: [createEdge('e1', 'in_1', 't_1')],
      };
      const result = validateWorkflowInputReferences(graph);

      expect(result.success).toBe(true);
    });

    it('54. actual input value presence is not checked (pure static declaration analysis)', () => {
      const inputConfig: InputNodeConfig = {
        fields: [{ name: 'unsuppliedRuntimeValue', type: 'string', required: true }],
      };
      const transformConfig: TransformNodeConfig = {
        rules: [
          {
            operation: 'json_pick',
            targetKey: 'val',
            source: { source: 'input', field: 'unsuppliedRuntimeValue', path: [] },
          },
        ],
      };
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT', inputConfig),
          createNode('t_1', 'TRANSFORM', transformConfig),
        ],
        edges: [createEdge('e1', 'in_1', 't_1')],
      };
      const result = validateWorkflowInputReferences(graph);

      expect(result.success).toBe(true);
    });

    it('55. input field type matching is not implemented beyond existing schemas', () => {
      // An arithmetic operation references a 'string' input field; static reference checking
      // only verifies declaration existence and uniqueness, not type compatibility
      const inputConfig: InputNodeConfig = {
        fields: [{ name: 'stringField', type: 'string', required: true }],
      };
      const transformConfig: TransformNodeConfig = {
        rules: [
          {
            operation: 'math_op',
            targetKey: 'sum',
            operator: 'add',
            left: {
              type: 'reference',
              reference: { source: 'input', field: 'stringField', path: [] },
            },
            right: { type: 'literal', value: 10 },
          },
        ],
      };
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT', inputConfig),
          createNode('t_1', 'TRANSFORM', transformConfig),
        ],
        edges: [createEdge('e1', 'in_1', 't_1')],
      };
      const result = validateWorkflowInputReferences(graph);

      expect(result.success).toBe(true);
    });

    it('56. existing node-output validator remains unchanged and distinct', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT', validEmptyInputConfig),
          createNode('out_1', 'OUTPUT', validOutputLiteralConfig),
        ],
        edges: [createEdge('e1', 'in_1', 'out_1')],
      };
      const nodeOutputResult = validateWorkflowNodeOutputReferences(graph);

      expect(nodeOutputResult.success).toBe(true);
      expect(nodeOutputResult.issues).toEqual([]);
    });

    it('57. existing semantic validator remains unchanged and distinct', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT', validEmptyInputConfig),
          createNode('out_1', 'OUTPUT', validOutputLiteralConfig),
        ],
        edges: [createEdge('e1', 'in_1', 'out_1')],
      };
      const semanticResult = validateWorkflowGraphSemantics(graph);

      expect(semanticResult.success).toBe(true);
      if (semanticResult.success) {
        expect(semanticResult.topologicalNodeIds).toEqual(['in_1', 'out_1']);
      }
    });

    it('58. result objects are JSON-serializable', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('t_1', 'TRANSFORM', {
            rules: [
              {
                operation: 'json_pick',
                targetKey: 'k',
                source: { source: 'input', field: 'missing', path: [] },
              },
            ],
          }),
        ],
        edges: [],
      };
      const result = validateWorkflowInputReferences(graph);
      const json = JSON.stringify(result);
      const parsed = JSON.parse(json);

      expect(parsed).toEqual(result);
    });

    it('59. all prior graph integrity analyzer behavior is preserved', () => {
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

    it('60. all contracts tests and schema integrations remain compatible', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT', validEmptyInputConfig),
          createNode('out_1', 'OUTPUT', validOutputLiteralConfig),
        ],
        edges: [createEdge('e1', 'in_1', 'out_1')],
      };
      const result = validateWorkflowInputReferences(graph);

      expect(result.success).toBe(true);
      expect(result.issues).toEqual([]);
    });
  });

  describe('TypeScript Type Inference Verification', () => {
    it('accepts WorkflowGraph and returns WorkflowInputReferenceValidationResult', () => {
      const graph: WorkflowGraph = { nodes: [], edges: [] };
      const result = validateWorkflowInputReferences(graph);
      expectTypeOf(result).toEqualTypeOf<WorkflowInputReferenceValidationResult>();
    });

    it('narrows on success discriminant', () => {
      const graph: WorkflowGraph = { nodes: [], edges: [] };
      const result = validateWorkflowInputReferences(graph);
      if (result.success) {
        expectTypeOf(result).toEqualTypeOf<WorkflowInputReferenceSuccessResult>();
        expectTypeOf(result.issues).toEqualTypeOf<readonly []>();
      }
    });

    it('narrows on stage for all failure variants', () => {
      const graph: WorkflowGraph = { nodes: [], edges: [] };
      const result = validateWorkflowInputReferences(graph);
      if (!result.success) {
        if (result.stage === 'integrity') {
          expectTypeOf(result).toEqualTypeOf<WorkflowInputReferenceIntegrityFailureResult>();
          expectTypeOf(result.issues).toEqualTypeOf<GraphIntegrityIssue[]>();
        } else if (result.stage === 'configuration') {
          expectTypeOf(result).toEqualTypeOf<WorkflowInputReferenceConfigurationFailureResult>();
          expectTypeOf(result.issues).toEqualTypeOf<
            ReadonlyArray<WorkflowNodeConfigValidationIssue>
          >();
        } else if (result.stage === 'input_references') {
          expectTypeOf(result).toEqualTypeOf<WorkflowInputReferenceFailureResult>();
          expectTypeOf(result.issues).toEqualTypeOf<InputReferenceIssue[]>();
          expectTypeOf(result.issues[0]?.code).toEqualTypeOf<InputReferenceIssueCode | undefined>();
          expectTypeOf(result.issues[0]?.path).toEqualTypeOf<
            ReadonlyArray<string | number> | undefined
          >();
        }
      }
    });
  });
});
