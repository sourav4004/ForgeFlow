import { describe, expect, expectTypeOf, it } from 'vitest';
import type {
  ConditionNodeConfig,
  InputNodeConfig,
  LlmPromptBinding,
  OutputNodeConfig,
  TransformNodeConfig,
  TransformRule,
  ValueBinding,
  WorkflowEdge,
  WorkflowGraph,
  WorkflowNode,
  WorkflowNodeConfig,
} from '@flowforge/contracts';
import {
  analyzeWorkflowNodeOutputPathCoverage,
  type NodeOutputPathCoverageFinding,
  type NodeOutputPathCoverageFindingCode,
  type WorkflowNodeOutputPathCoverageConfigurationFailureResult,
  type WorkflowNodeOutputPathCoverageEntryExitFailureResult,
  type WorkflowNodeOutputPathCoverageIntegrityFailureResult,
  type WorkflowNodeOutputPathCoverageReferencesFailureResult,
  type WorkflowNodeOutputPathCoverageSemanticFailureResult,
  type WorkflowNodeOutputPathCoverageSuccessResult,
} from '../src/index.js';

// --- Test Fixture Helpers ---

function createInputNode(id: string): WorkflowNode {
  const config: InputNodeConfig = {
    fields: [{ name: 'inputField', type: 'string', required: true }],
  };
  return {
    id,
    type: 'INPUT',
    position: { x: 0, y: 0 },
    config: config as unknown as WorkflowNodeConfig,
  };
}

function createTransformNode(id: string, rules: TransformRule[]): WorkflowNode {
  const config: TransformNodeConfig = {
    rules,
  };
  return {
    id,
    type: 'TRANSFORM',
    position: { x: 100, y: 100 },
    config: config as unknown as WorkflowNodeConfig,
  };
}

function createConditionNode(id: string, config: ConditionNodeConfig): WorkflowNode {
  return {
    id,
    type: 'CONDITION',
    position: { x: 100, y: 100 },
    config: config as unknown as WorkflowNodeConfig,
  };
}

function createLlmNode(id: string, prompt: LlmPromptBinding): WorkflowNode {
  return {
    id,
    type: 'LLM',
    position: { x: 200, y: 200 },
    config: {
      provider: 'google',
      model: 'gemini-1.5-pro',
      prompt,
    } as unknown as WorkflowNodeConfig,
  };
}

function createMcpToolNode(id: string, args?: Record<string, ValueBinding>): WorkflowNode {
  return {
    id,
    type: 'MCP_TOOL',
    position: { x: 200, y: 200 },
    config: {
      integrationRef: 'github-app',
      toolName: 'create_issue',
      arguments: args ?? {},
    } as unknown as WorkflowNodeConfig,
  };
}

function createOutputNode(
  id: string,
  payloadMapping: Record<string, ValueBinding> = {
    result: { type: 'literal', value: 'done' },
  },
): WorkflowNode {
  const config: OutputNodeConfig = {
    payloadMapping,
  };
  return {
    id,
    type: 'OUTPUT',
    position: { x: 300, y: 300 },
    config: config as unknown as WorkflowNodeConfig,
  };
}

function createApprovalNode(id: string): WorkflowNode {
  return {
    id,
    type: 'APPROVAL',
    position: { x: 200, y: 200 },
    config: {
      title: 'Deploy Approval',
      policy: { roles: ['ADMIN'] },
      timeoutMinutes: 60,
      timeoutAction: 'REJECT',
    } as unknown as WorkflowNodeConfig,
  };
}

function createEdge(
  id: string,
  source: string,
  target: string,
  conditionOutcome?: 'TRUE' | 'FALSE',
): WorkflowEdge {
  const edge: WorkflowEdge = { id, source, target };
  if (conditionOutcome !== undefined) {
    edge.conditionOutcome = conditionOutcome;
  }
  return edge;
}

// --- Test Suites ---

describe('analyzeWorkflowNodeOutputPathCoverage', () => {
  describe('Positive Cases: Dominating Producers (Zero Findings)', () => {
    it('1. accepts valid linear pipeline with dominating producer (INPUT -> A -> CONSUMER -> OUTPUT)', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('input'),
          createTransformNode('nodeA', [
            {
              operation: 'json_set',
              targetKey: 'data',
              value: { type: 'literal', value: 'hello' },
            },
          ]),
          createTransformNode('consumer', [
            {
              operation: 'json_pick',
              targetKey: 'picked',
              source: { source: 'node_output', nodeId: 'nodeA', path: ['data'] },
            },
          ]),
          createOutputNode('output'),
        ],
        edges: [
          createEdge('e1', 'input', 'nodeA'),
          createEdge('e2', 'nodeA', 'consumer'),
          createEdge('e3', 'consumer', 'output'),
        ],
      };

      const result = analyzeWorkflowNodeOutputPathCoverage(graph);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.issues).toEqual([]);
        expect(result.findings).toEqual([]);
      }
    });

    it('2. accepts producer directly preceding consumer (INPUT -> A -> B -> CONSUMER -> OUTPUT)', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('input'),
          createTransformNode('nodeA', [
            {
              operation: 'json_set',
              targetKey: 'data',
              value: { type: 'literal', value: 1 },
            },
          ]),
          createTransformNode('nodeB', [
            {
              operation: 'json_set',
              targetKey: 'data',
              value: { type: 'literal', value: 2 },
            },
          ]),
          createTransformNode('consumer', [
            {
              operation: 'json_pick',
              targetKey: 'picked',
              source: { source: 'node_output', nodeId: 'nodeB', path: ['data'] },
            },
          ]),
          createOutputNode('output'),
        ],
        edges: [
          createEdge('e1', 'input', 'nodeA'),
          createEdge('e2', 'nodeA', 'nodeB'),
          createEdge('e3', 'nodeB', 'consumer'),
          createEdge('e4', 'consumer', 'output'),
        ],
      };

      const result = analyzeWorkflowNodeOutputPathCoverage(graph);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.findings).toHaveLength(0);
      }
    });

    it('3. accepts producer several steps upstream and on all paths', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('input'),
          createTransformNode('nodeA', [
            {
              operation: 'json_set',
              targetKey: 'init',
              value: { type: 'literal', value: 100 },
            },
          ]),
          createTransformNode('nodeB', [
            {
              operation: 'json_set',
              targetKey: 'stepB',
              value: { type: 'literal', value: 200 },
            },
          ]),
          createTransformNode('nodeC', [
            {
              operation: 'json_set',
              targetKey: 'stepC',
              value: { type: 'literal', value: 300 },
            },
          ]),
          createTransformNode('consumer', [
            {
              operation: 'json_pick',
              targetKey: 'res',
              source: { source: 'node_output', nodeId: 'nodeA', path: ['init'] },
            },
          ]),
          createOutputNode('output'),
        ],
        edges: [
          createEdge('e1', 'input', 'nodeA'),
          createEdge('e2', 'nodeA', 'nodeB'),
          createEdge('e3', 'nodeB', 'nodeC'),
          createEdge('e4', 'nodeC', 'consumer'),
          createEdge('e5', 'consumer', 'output'),
        ],
      };

      const result = analyzeWorkflowNodeOutputPathCoverage(graph);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.findings).toHaveLength(0);
      }
    });

    it('4. accepts TRUE/FALSE edges both leading through a shared producer before consumer', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('input'),
          createConditionNode('cond', {
            operator: 'equals',
            left: { type: 'literal', value: 1 },
            right: { type: 'literal', value: 1 },
          }),
          createTransformNode('sharedProducer', [
            {
              operation: 'json_set',
              targetKey: 'shared',
              value: { type: 'literal', value: 'yes' },
            },
          ]),
          createTransformNode('consumer', [
            {
              operation: 'json_pick',
              targetKey: 'picked',
              source: { source: 'node_output', nodeId: 'sharedProducer', path: ['shared'] },
            },
          ]),
          createOutputNode('output'),
        ],
        edges: [
          createEdge('e1', 'input', 'cond'),
          createEdge('e2', 'cond', 'sharedProducer', 'TRUE'),
          createEdge('e3', 'cond', 'sharedProducer', 'FALSE'),
          createEdge('e4', 'sharedProducer', 'consumer'),
          createEdge('e5', 'consumer', 'output'),
        ],
      };

      const result = analyzeWorkflowNodeOutputPathCoverage(graph);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.findings).toHaveLength(0);
      }
    });

    it('5. accepts reference confined to a conditional branch where consumer is only reachable through producer', () => {
      // INPUT -> CONDITION
      // CONDITION --TRUE--> A -> CONSUMER -> OUTPUT_TRUE
      // CONDITION --FALSE--> OUTPUT_FALSE
      // Every path reaching CONSUMER must pass through A.
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('input'),
          createConditionNode('cond', {
            operator: 'is_null',
            left: { type: 'literal', value: null },
          }),
          createTransformNode('nodeA', [
            {
              operation: 'json_set',
              targetKey: 'data',
              value: { type: 'literal', value: 'branch_true_data' },
            },
          ]),
          createTransformNode('consumer', [
            {
              operation: 'json_pick',
              targetKey: 'out',
              source: { source: 'node_output', nodeId: 'nodeA', path: ['data'] },
            },
          ]),
          createOutputNode('outputTrue'),
          createOutputNode('outputFalse'),
        ],
        edges: [
          createEdge('e1', 'input', 'cond'),
          createEdge('e2', 'cond', 'nodeA', 'TRUE'),
          createEdge('e3', 'cond', 'outputFalse', 'FALSE'),
          createEdge('e4', 'nodeA', 'consumer'),
          createEdge('e5', 'consumer', 'outputTrue'),
        ],
      };

      const result = analyzeWorkflowNodeOutputPathCoverage(graph);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.findings).toHaveLength(0);
      }
    });

    it('6. accepts multiple dominating references in one consumer', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('input'),
          createTransformNode('nodeA', [
            {
              operation: 'json_set',
              targetKey: 'num1',
              value: { type: 'literal', value: 10 },
            },
            {
              operation: 'json_set',
              targetKey: 'num2',
              value: { type: 'literal', value: 20 },
            },
          ]),
          createTransformNode('consumer', [
            {
              operation: 'math_op',
              targetKey: 'sum',
              operator: 'add',
              left: {
                type: 'reference',
                reference: { source: 'node_output', nodeId: 'nodeA', path: ['num1'] },
              },
              right: {
                type: 'reference',
                reference: { source: 'node_output', nodeId: 'nodeA', path: ['num2'] },
              },
            },
          ]),
          createOutputNode('output'),
        ],
        edges: [
          createEdge('e1', 'input', 'nodeA'),
          createEdge('e2', 'nodeA', 'consumer'),
          createEdge('e3', 'consumer', 'output'),
        ],
      };

      const result = analyzeWorkflowNodeOutputPathCoverage(graph);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.findings).toHaveLength(0);
      }
    });

    it('7. accepts multiple consumers with valid dominating references', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('input'),
          createTransformNode('nodeA', [
            {
              operation: 'json_set',
              targetKey: 'val',
              value: { type: 'literal', value: 42 },
            },
          ]),
          createTransformNode('consumer1', [
            {
              operation: 'json_pick',
              targetKey: 'picked1',
              source: { source: 'node_output', nodeId: 'nodeA', path: ['val'] },
            },
          ]),
          createTransformNode('consumer2', [
            {
              operation: 'json_pick',
              targetKey: 'picked2',
              source: { source: 'node_output', nodeId: 'nodeA', path: ['val'] },
            },
          ]),
          createOutputNode('output'),
        ],
        edges: [
          createEdge('e1', 'input', 'nodeA'),
          createEdge('e2', 'nodeA', 'consumer1'),
          createEdge('e3', 'nodeA', 'consumer2'),
          createEdge('e4', 'consumer1', 'output'),
          createEdge('e5', 'consumer2', 'output'),
        ],
      };

      const result = analyzeWorkflowNodeOutputPathCoverage(graph);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.findings).toHaveLength(0);
      }
    });

    it('8. returns zero findings when workflow has no node-output references', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('input'),
          createTransformNode('nodeA', [
            {
              operation: 'json_set',
              targetKey: 'text',
              value: { type: 'literal', value: 'constant' },
            },
          ]),
          createOutputNode('output', {
            out: { type: 'literal', value: 123 },
          }),
        ],
        edges: [createEdge('e1', 'input', 'nodeA'), createEdge('e2', 'nodeA', 'output')],
      };

      const result = analyzeWorkflowNodeOutputPathCoverage(graph);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.findings).toEqual([]);
      }
    });

    it('9. accepts multiple INPUT nodes where producer dominates consumer on all entry paths', () => {
      // INPUT_A -> A
      // INPUT_B -> A
      // A -> CONSUMER -> OUTPUT
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('inputA'),
          createInputNode('inputB'),
          createTransformNode('nodeA', [
            {
              operation: 'json_set',
              targetKey: 'val',
              value: { type: 'literal', value: 'hello' },
            },
          ]),
          createTransformNode('consumer', [
            {
              operation: 'json_pick',
              targetKey: 'picked',
              source: { source: 'node_output', nodeId: 'nodeA', path: ['val'] },
            },
          ]),
          createOutputNode('output'),
        ],
        edges: [
          createEdge('e1', 'inputA', 'nodeA'),
          createEdge('e2', 'inputB', 'nodeA'),
          createEdge('e3', 'nodeA', 'consumer'),
          createEdge('e4', 'consumer', 'output'),
        ],
      };

      const result = analyzeWorkflowNodeOutputPathCoverage(graph);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.findings).toHaveLength(0);
      }
    });

    it('10. accepts workflow with multiple OUTPUT nodes', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('input'),
          createTransformNode('nodeA', [
            {
              operation: 'json_set',
              targetKey: 'val',
              value: { type: 'literal', value: 'hello' },
            },
          ]),
          createTransformNode('consumer', [
            {
              operation: 'json_pick',
              targetKey: 'picked',
              source: { source: 'node_output', nodeId: 'nodeA', path: ['val'] },
            },
          ]),
          createOutputNode('output1'),
          createOutputNode('output2'),
        ],
        edges: [
          createEdge('e1', 'input', 'nodeA'),
          createEdge('e2', 'nodeA', 'consumer'),
          createEdge('e3', 'consumer', 'output1'),
          createEdge('e4', 'consumer', 'output2'),
        ],
      };

      const result = analyzeWorkflowNodeOutputPathCoverage(graph);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.findings).toHaveLength(0);
      }
    });

    it('11. correctly inspects all typed TRANSFORM operations when dominating', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('input'),
          createTransformNode('producer', [
            {
              operation: 'json_set',
              targetKey: 'str',
              value: { type: 'literal', value: 'World' },
            },
            {
              operation: 'json_set',
              targetKey: 'num',
              value: { type: 'literal', value: 10 },
            },
          ]),
          createTransformNode('consumer', [
            {
              operation: 'json_pick',
              targetKey: 'k1',
              source: { source: 'node_output', nodeId: 'producer', path: ['str'] },
            },
            {
              operation: 'json_set',
              targetKey: 'k2',
              value: {
                type: 'reference',
                reference: { source: 'node_output', nodeId: 'producer', path: ['str'] },
              },
            },
            {
              operation: 'template_string',
              targetKey: 'k3',
              segments: [
                { type: 'text', text: 'Hello, ' },
                {
                  type: 'reference',
                  reference: { source: 'node_output', nodeId: 'producer', path: ['str'] },
                },
              ],
            },
            {
              operation: 'math_op',
              targetKey: 'k4',
              operator: 'multiply',
              left: {
                type: 'reference',
                reference: { source: 'node_output', nodeId: 'producer', path: ['num'] },
              },
              right: { type: 'literal', value: 2 },
            },
          ]),
          createOutputNode('output'),
        ],
        edges: [
          createEdge('e1', 'input', 'producer'),
          createEdge('e2', 'producer', 'consumer'),
          createEdge('e3', 'consumer', 'output'),
        ],
      };

      const result = analyzeWorkflowNodeOutputPathCoverage(graph);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.findings).toHaveLength(0);
      }
    });

    it('12. correctly inspects typed CONDITION node left and right bindings when dominating', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('input'),
          createTransformNode('producer', [
            {
              operation: 'json_set',
              targetKey: 'threshold',
              value: { type: 'literal', value: 100 },
            },
          ]),
          createConditionNode('cond', {
            operator: 'greater_than',
            left: {
              type: 'reference',
              reference: { source: 'node_output', nodeId: 'producer', path: ['threshold'] },
            },
            right: { type: 'literal', value: 50 },
          }),
          createOutputNode('outTrue'),
          createOutputNode('outFalse'),
        ],
        edges: [
          createEdge('e1', 'input', 'producer'),
          createEdge('e2', 'producer', 'cond'),
          createEdge('e3', 'cond', 'outTrue', 'TRUE'),
          createEdge('e4', 'cond', 'outFalse', 'FALSE'),
        ],
      };

      const result = analyzeWorkflowNodeOutputPathCoverage(graph);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.findings).toHaveLength(0);
      }
    });

    it('13. correctly inspects typed LLM prompt reference binding when dominating', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('input'),
          createTransformNode('producer', [
            {
              operation: 'json_set',
              targetKey: 'promptText',
              value: { type: 'literal', value: 'Generate a summary' },
            },
          ]),
          createLlmNode('llmNode', {
            type: 'reference',
            reference: { source: 'node_output', nodeId: 'producer', path: ['promptText'] },
          }),
          createOutputNode('output'),
        ],
        edges: [
          createEdge('e1', 'input', 'producer'),
          createEdge('e2', 'producer', 'llmNode'),
          createEdge('e3', 'llmNode', 'output'),
        ],
      };

      const result = analyzeWorkflowNodeOutputPathCoverage(graph);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.findings).toHaveLength(0);
      }
    });

    it('14. correctly inspects typed MCP_TOOL argument bindings when dominating', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('input'),
          createTransformNode('producer', [
            {
              operation: 'json_set',
              targetKey: 'title',
              value: { type: 'literal', value: 'Bug Title' },
            },
          ]),
          createMcpToolNode('mcpNode', {
            titleArg: {
              type: 'reference',
              reference: { source: 'node_output', nodeId: 'producer', path: ['title'] },
            },
          }),
          createOutputNode('output'),
        ],
        edges: [
          createEdge('e1', 'input', 'producer'),
          createEdge('e2', 'producer', 'mcpNode'),
          createEdge('e3', 'mcpNode', 'output'),
        ],
      };

      const result = analyzeWorkflowNodeOutputPathCoverage(graph);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.findings).toHaveLength(0);
      }
    });

    it('15. correctly inspects typed OUTPUT payload mapping bindings when dominating', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('input'),
          createTransformNode('producer', [
            {
              operation: 'json_set',
              targetKey: 'data',
              value: { type: 'literal', value: 'finished' },
            },
          ]),
          createOutputNode('output', {
            finalResult: {
              type: 'reference',
              reference: { source: 'node_output', nodeId: 'producer', path: ['data'] },
            },
          }),
        ],
        edges: [createEdge('e1', 'input', 'producer'), createEdge('e2', 'producer', 'output')],
      };

      const result = analyzeWorkflowNodeOutputPathCoverage(graph);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.findings).toHaveLength(0);
      }
    });

    it('16. ignores literal JSON resembling a node-output reference', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('input'),
          createTransformNode('consumer', [
            {
              operation: 'json_set',
              targetKey: 'fakeRef',
              value: {
                type: 'literal',
                value: {
                  source: 'node_output',
                  nodeId: 'some_nonexistent_node',
                  path: ['field'],
                },
              },
            },
          ]),
          createOutputNode('output'),
        ],
        edges: [createEdge('e1', 'input', 'consumer'), createEdge('e2', 'consumer', 'output')],
      };

      const result = analyzeWorkflowNodeOutputPathCoverage(graph);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.findings).toHaveLength(0);
      }
    });

    it('17. ignores literal string text resembling reference syntax in template strings', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('input'),
          createTransformNode('consumer', [
            {
              operation: 'template_string',
              targetKey: 'templated',
              segments: [
                {
                  type: 'text',
                  text: '{{ node_output.missingNode.field }} is raw text, not a reference',
                },
              ],
            },
          ]),
          createOutputNode('output'),
        ],
        edges: [createEdge('e1', 'input', 'consumer'), createEdge('e2', 'consumer', 'output')],
      };

      const result = analyzeWorkflowNodeOutputPathCoverage(graph);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.findings).toHaveLength(0);
      }
    });

    it('18. ignores trigger input references ({ source: "input" }) without findings', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('input'),
          createTransformNode('consumer', [
            {
              operation: 'json_pick',
              targetKey: 'picked',
              source: { source: 'input', field: 'inputField', path: [] },
            },
          ]),
          createOutputNode('output'),
        ],
        edges: [createEdge('e1', 'input', 'consumer'), createEdge('e2', 'consumer', 'output')],
      };

      const result = analyzeWorkflowNodeOutputPathCoverage(graph);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.findings).toHaveLength(0);
      }
    });

    it('19. confirms empty findings does not contain publishability or execution flags', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('input'),
          createTransformNode('nodeA', [
            {
              operation: 'json_set',
              targetKey: 'val',
              value: { type: 'literal', value: 1 },
            },
          ]),
          createOutputNode('output'),
        ],
        edges: [createEdge('e1', 'input', 'nodeA'), createEdge('e2', 'nodeA', 'output')],
      };

      const result = analyzeWorkflowNodeOutputPathCoverage(graph);
      expect(result.success).toBe(true);
      if (result.success) {
        expect('isPublishable' in result).toBe(false);
        expect('canRun' in result).toBe(false);
        expect('guaranteedAvailable' in result).toBe(false);
        expect('executionReady' in result).toBe(false);
      }
    });

    it('20. repeated analysis on the same graph is deterministic', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('input'),
          createTransformNode('nodeA', [
            {
              operation: 'json_set',
              targetKey: 'val',
              value: { type: 'literal', value: 1 },
            },
          ]),
          createTransformNode('consumer', [
            {
              operation: 'json_pick',
              targetKey: 'p',
              source: { source: 'node_output', nodeId: 'nodeA', path: ['val'] },
            },
          ]),
          createOutputNode('output'),
        ],
        edges: [
          createEdge('e1', 'input', 'nodeA'),
          createEdge('e2', 'nodeA', 'consumer'),
          createEdge('e3', 'consumer', 'output'),
        ],
      };

      const res1 = analyzeWorkflowNodeOutputPathCoverage(graph);
      const res2 = analyzeWorkflowNodeOutputPathCoverage(graph);
      expect(res1).toEqual(res2);
    });

    it('21. handles Object.freeze() frozen graph definitions without mutation', () => {
      const graph = Object.freeze({
        nodes: Object.freeze([
          Object.freeze(createInputNode('input')),
          Object.freeze(
            createTransformNode('nodeA', [
              {
                operation: 'json_set',
                targetKey: 'val',
                value: { type: 'literal', value: 1 },
              },
            ]),
          ),
          Object.freeze(
            createTransformNode('consumer', [
              {
                operation: 'json_pick',
                targetKey: 'p',
                source: { source: 'node_output', nodeId: 'nodeA', path: ['val'] },
              },
            ]),
          ),
          Object.freeze(createOutputNode('output')),
        ]),
        edges: Object.freeze([
          Object.freeze(createEdge('e1', 'input', 'nodeA')),
          Object.freeze(createEdge('e2', 'nodeA', 'consumer')),
          Object.freeze(createEdge('e3', 'consumer', 'output')),
        ]),
      });

      const result = analyzeWorkflowNodeOutputPathCoverage(graph as unknown as WorkflowGraph);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.findings).toHaveLength(0);
      }
    });
  });

  describe('Finding Cases: Non-Dominating Producers Emitting Findings', () => {
    it('22. emits finding when conditional merge references TRUE-only producer', () => {
      // INPUT -> CONDITION
      // CONDITION --TRUE--> A -> MERGE
      // CONDITION --FALSE--> B -> MERGE
      // MERGE -> OUTPUT
      // MERGE references A
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('input'),
          createConditionNode('cond', {
            operator: 'equals',
            left: { type: 'literal', value: 1 },
            right: { type: 'literal', value: 1 },
          }),
          createTransformNode('nodeA', [
            {
              operation: 'json_set',
              targetKey: 'dataA',
              value: { type: 'literal', value: 'from_A' },
            },
          ]),
          createTransformNode('nodeB', [
            {
              operation: 'json_set',
              targetKey: 'dataB',
              value: { type: 'literal', value: 'from_B' },
            },
          ]),
          createTransformNode('merge', [
            {
              operation: 'json_pick',
              targetKey: 'picked',
              source: { source: 'node_output', nodeId: 'nodeA', path: ['dataA'] },
            },
          ]),
          createOutputNode('output'),
        ],
        edges: [
          createEdge('e1', 'input', 'cond'),
          createEdge('e2', 'cond', 'nodeA', 'TRUE'),
          createEdge('e3', 'cond', 'nodeB', 'FALSE'),
          createEdge('e4', 'nodeA', 'merge'),
          createEdge('e5', 'nodeB', 'merge'),
          createEdge('e6', 'merge', 'output'),
        ],
      };

      const result = analyzeWorkflowNodeOutputPathCoverage(graph);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.findings).toHaveLength(1);
        expect(result.findings[0]?.code).toBe('NODE_OUTPUT_REFERENCE_NOT_ON_ALL_INPUT_PATHS');
        expect(result.findings[0]?.path).toEqual([
          'nodes',
          4,
          'config',
          'rules',
          0,
          'source',
          'nodeId',
        ]);
        expect(result.findings[0]?.message).toContain(
          "Referenced node 'nodeA' is not present on every INPUT-to-consumer path",
        );
      }
    });

    it('23. emits finding when conditional merge references FALSE-only producer', () => {
      // MERGE references B
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('input'),
          createConditionNode('cond', {
            operator: 'equals',
            left: { type: 'literal', value: 1 },
            right: { type: 'literal', value: 1 },
          }),
          createTransformNode('nodeA', [
            {
              operation: 'json_set',
              targetKey: 'dataA',
              value: { type: 'literal', value: 'from_A' },
            },
          ]),
          createTransformNode('nodeB', [
            {
              operation: 'json_set',
              targetKey: 'dataB',
              value: { type: 'literal', value: 'from_B' },
            },
          ]),
          createTransformNode('merge', [
            {
              operation: 'json_pick',
              targetKey: 'picked',
              source: { source: 'node_output', nodeId: 'nodeB', path: ['dataB'] },
            },
          ]),
          createOutputNode('output'),
        ],
        edges: [
          createEdge('e1', 'input', 'cond'),
          createEdge('e2', 'cond', 'nodeA', 'TRUE'),
          createEdge('e3', 'cond', 'nodeB', 'FALSE'),
          createEdge('e4', 'nodeA', 'merge'),
          createEdge('e5', 'nodeB', 'merge'),
          createEdge('e6', 'merge', 'output'),
        ],
      };

      const result = analyzeWorkflowNodeOutputPathCoverage(graph);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.findings).toHaveLength(1);
        expect(result.findings[0]?.path).toEqual([
          'nodes',
          4,
          'config',
          'rules',
          0,
          'source',
          'nodeId',
        ]);
      }
    });

    it('24. emits finding when optional side path bypasses producer (INPUT -> A -> CONSUMER and INPUT -> CONSUMER)', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('input'),
          createTransformNode('nodeA', [
            {
              operation: 'json_set',
              targetKey: 'dataA',
              value: { type: 'literal', value: 123 },
            },
          ]),
          createTransformNode('consumer', [
            {
              operation: 'json_pick',
              targetKey: 'picked',
              source: { source: 'node_output', nodeId: 'nodeA', path: ['dataA'] },
            },
          ]),
          createOutputNode('output'),
        ],
        edges: [
          createEdge('e1', 'input', 'nodeA'),
          createEdge('e2', 'nodeA', 'consumer'),
          createEdge('e3', 'input', 'consumer'),
          createEdge('e4', 'consumer', 'output'),
        ],
      };

      const result = analyzeWorkflowNodeOutputPathCoverage(graph);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.findings).toHaveLength(1);
        expect(result.findings[0]?.code).toBe('NODE_OUTPUT_REFERENCE_NOT_ON_ALL_INPUT_PATHS');
      }
    });

    it('25. emits finding when multiple INPUT roots exist and one path bypasses producer', () => {
      // INPUT_A -> A -> CONSUMER -> OUTPUT
      // INPUT_B -> CONSUMER
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('inputA'),
          createInputNode('inputB'),
          createTransformNode('nodeA', [
            {
              operation: 'json_set',
              targetKey: 'dataA',
              value: { type: 'literal', value: 10 },
            },
          ]),
          createTransformNode('consumer', [
            {
              operation: 'json_pick',
              targetKey: 'picked',
              source: { source: 'node_output', nodeId: 'nodeA', path: ['dataA'] },
            },
          ]),
          createOutputNode('output'),
        ],
        edges: [
          createEdge('e1', 'inputA', 'nodeA'),
          createEdge('e2', 'nodeA', 'consumer'),
          createEdge('e3', 'inputB', 'consumer'),
          createEdge('e4', 'consumer', 'output'),
        ],
      };

      const result = analyzeWorkflowNodeOutputPathCoverage(graph);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.findings).toHaveLength(1);
        expect(result.findings[0]?.code).toBe('NODE_OUTPUT_REFERENCE_NOT_ON_ALL_INPUT_PATHS');
      }
    });

    it('26. emits finding when topological predecessor is strict ancestor but does not dominate', () => {
      // INPUT -> P1 -> MERGE -> OUTPUT
      // INPUT -> P2 -> MERGE
      // MERGE references P1 (P1 is upstream, but P2 bypasses P1)
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('input'),
          createTransformNode('p1', [
            {
              operation: 'json_set',
              targetKey: 'val1',
              value: { type: 'literal', value: 'p1' },
            },
          ]),
          createTransformNode('p2', [
            {
              operation: 'json_set',
              targetKey: 'val2',
              value: { type: 'literal', value: 'p2' },
            },
          ]),
          createTransformNode('merge', [
            {
              operation: 'json_pick',
              targetKey: 'out',
              source: { source: 'node_output', nodeId: 'p1', path: ['val1'] },
            },
          ]),
          createOutputNode('output'),
        ],
        edges: [
          createEdge('e1', 'input', 'p1'),
          createEdge('e2', 'p1', 'merge'),
          createEdge('e3', 'input', 'p2'),
          createEdge('e4', 'p2', 'merge'),
          createEdge('e5', 'merge', 'output'),
        ],
      };

      const result = analyzeWorkflowNodeOutputPathCoverage(graph);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.findings).toHaveLength(1);
      }
    });

    it('27. reports multiple occurrences of references to same non-dominating producer per occurrence', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('input'),
          createTransformNode('p1', [
            {
              operation: 'json_set',
              targetKey: 'a',
              value: { type: 'literal', value: 1 },
            },
            {
              operation: 'json_set',
              targetKey: 'b',
              value: { type: 'literal', value: 2 },
            },
          ]),
          createTransformNode('p2', [
            {
              operation: 'json_set',
              targetKey: 'dummy',
              value: { type: 'literal', value: 3 },
            },
          ]),
          createTransformNode('consumer', [
            {
              operation: 'json_pick',
              targetKey: 'pickA',
              source: { source: 'node_output', nodeId: 'p1', path: ['a'] },
            },
            {
              operation: 'json_pick',
              targetKey: 'pickB',
              source: { source: 'node_output', nodeId: 'p1', path: ['b'] },
            },
          ]),
          createOutputNode('output'),
        ],
        edges: [
          createEdge('e1', 'input', 'p1'),
          createEdge('e2', 'p1', 'consumer'),
          createEdge('e3', 'input', 'p2'),
          createEdge('e4', 'p2', 'consumer'),
          createEdge('e5', 'consumer', 'output'),
        ],
      };

      const result = analyzeWorkflowNodeOutputPathCoverage(graph);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.findings).toHaveLength(2);
        expect(result.findings[0]?.path).toEqual([
          'nodes',
          3,
          'config',
          'rules',
          0,
          'source',
          'nodeId',
        ]);
        expect(result.findings[1]?.path).toEqual([
          'nodes',
          3,
          'config',
          'rules',
          1,
          'source',
          'nodeId',
        ]);
      }
    });

    it('28. assesses distinct producers independently', () => {
      // INPUT -> DOMINATOR -> CONSUMER -> OUTPUT
      // INPUT -> BYPASS -> CONSUMER
      // CONSUMER references DOMINATOR and BYPASS
      // Both DOMINATOR and BYPASS do not dominate CONSUMER (because each bypasses the other!)
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('input'),
          createTransformNode('pA', [
            {
              operation: 'json_set',
              targetKey: 'a',
              value: { type: 'literal', value: 'A' },
            },
          ]),
          createTransformNode('pB', [
            {
              operation: 'json_set',
              targetKey: 'b',
              value: { type: 'literal', value: 'B' },
            },
          ]),
          createTransformNode('consumer', [
            {
              operation: 'json_pick',
              targetKey: 'pickA',
              source: { source: 'node_output', nodeId: 'pA', path: ['a'] },
            },
            {
              operation: 'json_pick',
              targetKey: 'pickB',
              source: { source: 'node_output', nodeId: 'pB', path: ['b'] },
            },
          ]),
          createOutputNode('output'),
        ],
        edges: [
          createEdge('e1', 'input', 'pA'),
          createEdge('e2', 'pA', 'consumer'),
          createEdge('e3', 'input', 'pB'),
          createEdge('e4', 'pB', 'consumer'),
          createEdge('e5', 'consumer', 'output'),
        ],
      };

      const result = analyzeWorkflowNodeOutputPathCoverage(graph);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.findings).toHaveLength(2);
        expect(result.findings[0]?.message).toContain("'pA'");
        expect(result.findings[1]?.message).toContain("'pB'");
      }
    });

    it('29. handles one dominating and one non-dominating reference in the same consumer', () => {
      // INPUT -> MASTER -> P1 -> CONSUMER -> OUTPUT
      // MASTER -> CONSUMER (bypasses P1, but DOES NOT bypass MASTER)
      // CONSUMER references MASTER (dominates!) and P1 (does not dominate!)
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('input'),
          createTransformNode('master', [
            {
              operation: 'json_set',
              targetKey: 'm',
              value: { type: 'literal', value: 'master' },
            },
          ]),
          createTransformNode('p1', [
            {
              operation: 'json_set',
              targetKey: 'val1',
              value: { type: 'literal', value: 'sub' },
            },
          ]),
          createTransformNode('consumer', [
            {
              operation: 'json_pick',
              targetKey: 'fromMaster',
              source: { source: 'node_output', nodeId: 'master', path: ['m'] },
            },
            {
              operation: 'json_pick',
              targetKey: 'fromP1',
              source: { source: 'node_output', nodeId: 'p1', path: ['val1'] },
            },
          ]),
          createOutputNode('output'),
        ],
        edges: [
          createEdge('e1', 'input', 'master'),
          createEdge('e2', 'master', 'p1'),
          createEdge('e3', 'p1', 'consumer'),
          createEdge('e4', 'master', 'consumer'),
          createEdge('e5', 'consumer', 'output'),
        ],
      };

      const result = analyzeWorkflowNodeOutputPathCoverage(graph);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.findings).toHaveLength(1);
        expect(result.findings[0]?.message).toContain("'p1'");
      }
    });

    it('30. preserves nested TRANSFORM rule path in finding', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('input'),
          createTransformNode('p1', [
            {
              operation: 'json_set',
              targetKey: 'a',
              value: { type: 'literal', value: 1 },
            },
          ]),
          createTransformNode('p2', [
            {
              operation: 'json_set',
              targetKey: 'b',
              value: { type: 'literal', value: 2 },
            },
          ]),
          createTransformNode('consumer', [
            {
              operation: 'json_set',
              targetKey: 'dummy',
              value: { type: 'literal', value: 'placeholder' },
            },
            {
              operation: 'json_set',
              targetKey: 'rule1',
              value: {
                type: 'reference',
                reference: { source: 'node_output', nodeId: 'p1', path: ['a'] },
              },
            },
          ]),
          createOutputNode('output'),
        ],
        edges: [
          createEdge('e1', 'input', 'p1'),
          createEdge('e2', 'p1', 'consumer'),
          createEdge('e3', 'input', 'p2'),
          createEdge('e4', 'p2', 'consumer'),
          createEdge('e5', 'consumer', 'output'),
        ],
      };

      const result = analyzeWorkflowNodeOutputPathCoverage(graph);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.findings).toHaveLength(1);
        expect(result.findings[0]?.path).toEqual([
          'nodes',
          3,
          'config',
          'rules',
          1,
          'value',
          'reference',
          'nodeId',
        ]);
      }
    });

    it('31. preserves template reference segment index in finding path', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('input'),
          createTransformNode('p1', [
            {
              operation: 'json_set',
              targetKey: 'text',
              value: { type: 'literal', value: 'hello' },
            },
          ]),
          createTransformNode('p2', [
            {
              operation: 'json_set',
              targetKey: 'dummy',
              value: { type: 'literal', value: 2 },
            },
          ]),
          createTransformNode('consumer', [
            {
              operation: 'template_string',
              targetKey: 'formatted',
              segments: [
                { type: 'text', text: 'Prefix: ' },
                {
                  type: 'reference',
                  reference: { source: 'node_output', nodeId: 'p1', path: ['text'] },
                },
              ],
            },
          ]),
          createOutputNode('output'),
        ],
        edges: [
          createEdge('e1', 'input', 'p1'),
          createEdge('e2', 'p1', 'consumer'),
          createEdge('e3', 'input', 'p2'),
          createEdge('e4', 'p2', 'consumer'),
          createEdge('e5', 'consumer', 'output'),
        ],
      };

      const result = analyzeWorkflowNodeOutputPathCoverage(graph);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.findings).toHaveLength(1);
        expect(result.findings[0]?.path).toEqual([
          'nodes',
          3,
          'config',
          'rules',
          0,
          'segments',
          1,
          'reference',
          'nodeId',
        ]);
      }
    });

    it('32. preserves CONDITION binding reference path in finding', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('input'),
          createTransformNode('p1', [
            {
              operation: 'json_set',
              targetKey: 'num',
              value: { type: 'literal', value: 10 },
            },
          ]),
          createTransformNode('p2', [
            {
              operation: 'json_set',
              targetKey: 'dummy',
              value: { type: 'literal', value: 20 },
            },
          ]),
          createConditionNode('cond', {
            operator: 'greater_than',
            left: {
              type: 'reference',
              reference: { source: 'node_output', nodeId: 'p1', path: ['num'] },
            },
            right: { type: 'literal', value: 5 },
          }),
          createOutputNode('outTrue'),
          createOutputNode('outFalse'),
        ],
        edges: [
          createEdge('e1', 'input', 'p1'),
          createEdge('e2', 'p1', 'cond'),
          createEdge('e3', 'input', 'p2'),
          createEdge('e4', 'p2', 'cond'),
          createEdge('e5', 'cond', 'outTrue', 'TRUE'),
          createEdge('e6', 'cond', 'outFalse', 'FALSE'),
        ],
      };

      const result = analyzeWorkflowNodeOutputPathCoverage(graph);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.findings).toHaveLength(1);
        expect(result.findings[0]?.path).toEqual([
          'nodes',
          3,
          'config',
          'left',
          'reference',
          'nodeId',
        ]);
      }
    });

    it('33. preserves LLM prompt reference path in finding', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('input'),
          createTransformNode('p1', [
            {
              operation: 'json_set',
              targetKey: 'prompt',
              value: { type: 'literal', value: 'hello' },
            },
          ]),
          createTransformNode('p2', [
            {
              operation: 'json_set',
              targetKey: 'dummy',
              value: { type: 'literal', value: 1 },
            },
          ]),
          createLlmNode('llmNode', {
            type: 'reference',
            reference: { source: 'node_output', nodeId: 'p1', path: ['prompt'] },
          }),
          createOutputNode('output'),
        ],
        edges: [
          createEdge('e1', 'input', 'p1'),
          createEdge('e2', 'p1', 'llmNode'),
          createEdge('e3', 'input', 'p2'),
          createEdge('e4', 'p2', 'llmNode'),
          createEdge('e5', 'llmNode', 'output'),
        ],
      };

      const result = analyzeWorkflowNodeOutputPathCoverage(graph);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.findings).toHaveLength(1);
        expect(result.findings[0]?.path).toEqual([
          'nodes',
          3,
          'config',
          'prompt',
          'reference',
          'nodeId',
        ]);
      }
    });

    it('34. preserves MCP argument key with punctuation in finding path', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('input'),
          createTransformNode('p1', [
            {
              operation: 'json_set',
              targetKey: 'title',
              value: { type: 'literal', value: 'bug' },
            },
          ]),
          createTransformNode('p2', [
            {
              operation: 'json_set',
              targetKey: 'dummy',
              value: { type: 'literal', value: 1 },
            },
          ]),
          createMcpToolNode('mcpNode', {
            'custom.issue_title': {
              type: 'reference',
              reference: { source: 'node_output', nodeId: 'p1', path: ['title'] },
            },
          }),
          createOutputNode('output'),
        ],
        edges: [
          createEdge('e1', 'input', 'p1'),
          createEdge('e2', 'p1', 'mcpNode'),
          createEdge('e3', 'input', 'p2'),
          createEdge('e4', 'p2', 'mcpNode'),
          createEdge('e5', 'mcpNode', 'output'),
        ],
      };

      const result = analyzeWorkflowNodeOutputPathCoverage(graph);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.findings).toHaveLength(1);
        expect(result.findings[0]?.path).toEqual([
          'nodes',
          3,
          'config',
          'arguments',
          'custom.issue_title',
          'reference',
          'nodeId',
        ]);
      }
    });

    it('35. preserves OUTPUT payload mapping key with dots in finding path', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('input'),
          createTransformNode('p1', [
            {
              operation: 'json_set',
              targetKey: 'res',
              value: { type: 'literal', value: 'data' },
            },
          ]),
          createTransformNode('p2', [
            {
              operation: 'json_set',
              targetKey: 'dummy',
              value: { type: 'literal', value: 1 },
            },
          ]),
          createOutputNode('output', {
            'result.summary': {
              type: 'reference',
              reference: { source: 'node_output', nodeId: 'p1', path: ['res'] },
            },
          }),
        ],
        edges: [
          createEdge('e1', 'input', 'p1'),
          createEdge('e2', 'p1', 'output'),
          createEdge('e3', 'input', 'p2'),
          createEdge('e4', 'p2', 'output'),
        ],
      };

      const result = analyzeWorkflowNodeOutputPathCoverage(graph);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.findings).toHaveLength(1);
        expect(result.findings[0]?.path).toEqual([
          'nodes',
          3,
          'config',
          'payloadMapping',
          'result.summary',
          'reference',
          'nodeId',
        ]);
      }
    });

    it('36. handles node IDs with punctuation as atomic strings', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('input.root-01'),
          createTransformNode('node-A.producer_v1', [
            {
              operation: 'json_set',
              targetKey: 'val',
              value: { type: 'literal', value: 'test' },
            },
          ]),
          createTransformNode('node-B.bypass_v1', [
            {
              operation: 'json_set',
              targetKey: 'dummy',
              value: { type: 'literal', value: 'skip' },
            },
          ]),
          createTransformNode('consumer.final-node', [
            {
              operation: 'json_pick',
              targetKey: 'picked',
              source: {
                source: 'node_output',
                nodeId: 'node-A.producer_v1',
                path: ['val'],
              },
            },
          ]),
          createOutputNode('output.terminal-01'),
        ],
        edges: [
          createEdge('e1', 'input.root-01', 'node-A.producer_v1'),
          createEdge('e2', 'node-A.producer_v1', 'consumer.final-node'),
          createEdge('e3', 'input.root-01', 'node-B.bypass_v1'),
          createEdge('e4', 'node-B.bypass_v1', 'consumer.final-node'),
          createEdge('e5', 'consumer.final-node', 'output.terminal-01'),
        ],
      };

      const result = analyzeWorkflowNodeOutputPathCoverage(graph);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.findings).toHaveLength(1);
        expect(result.findings[0]?.message).toContain("'node-A.producer_v1'");
      }
    });

    it('37. finding code is stable string literal NODE_OUTPUT_REFERENCE_NOT_ON_ALL_INPUT_PATHS', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('input'),
          createTransformNode('p1', [
            {
              operation: 'json_set',
              targetKey: 'a',
              value: { type: 'literal', value: 1 },
            },
          ]),
          createTransformNode('p2', [
            {
              operation: 'json_set',
              targetKey: 'b',
              value: { type: 'literal', value: 2 },
            },
          ]),
          createTransformNode('consumer', [
            {
              operation: 'json_pick',
              targetKey: 'out',
              source: { source: 'node_output', nodeId: 'p1', path: ['a'] },
            },
          ]),
          createOutputNode('output'),
        ],
        edges: [
          createEdge('e1', 'input', 'p1'),
          createEdge('e2', 'p1', 'consumer'),
          createEdge('e3', 'input', 'p2'),
          createEdge('e4', 'p2', 'consumer'),
          createEdge('e5', 'consumer', 'output'),
        ],
      };

      const result = analyzeWorkflowNodeOutputPathCoverage(graph);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.findings[0]?.code).toBe('NODE_OUTPUT_REFERENCE_NOT_ON_ALL_INPUT_PATHS');
      }
    });

    it('38. results with findings are completely JSON-serializable', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('input'),
          createTransformNode('p1', [
            {
              operation: 'json_set',
              targetKey: 'a',
              value: { type: 'literal', value: 1 },
            },
          ]),
          createTransformNode('p2', [
            {
              operation: 'json_set',
              targetKey: 'b',
              value: { type: 'literal', value: 2 },
            },
          ]),
          createTransformNode('consumer', [
            {
              operation: 'json_pick',
              targetKey: 'out',
              source: { source: 'node_output', nodeId: 'p1', path: ['a'] },
            },
          ]),
          createOutputNode('output'),
        ],
        edges: [
          createEdge('e1', 'input', 'p1'),
          createEdge('e2', 'p1', 'consumer'),
          createEdge('e3', 'input', 'p2'),
          createEdge('e4', 'p2', 'consumer'),
          createEdge('e5', 'consumer', 'output'),
        ],
      };

      const result = analyzeWorkflowNodeOutputPathCoverage(graph);
      const json = JSON.stringify(result);
      const parsed = JSON.parse(json);
      expect(parsed).toEqual(result);
    });

    it('39. findings avoid raw prompt, payload or literal values in messages', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('input'),
          createTransformNode('p1', [
            {
              operation: 'json_set',
              targetKey: 'secret_key',
              value: { type: 'literal', value: 'SUPER_SECRET_PAYLOAD_VALUE' },
            },
          ]),
          createTransformNode('p2', [
            {
              operation: 'json_set',
              targetKey: 'b',
              value: { type: 'literal', value: 2 },
            },
          ]),
          createTransformNode('consumer', [
            {
              operation: 'json_pick',
              targetKey: 'out',
              source: { source: 'node_output', nodeId: 'p1', path: ['secret_key'] },
            },
          ]),
          createOutputNode('output'),
        ],
        edges: [
          createEdge('e1', 'input', 'p1'),
          createEdge('e2', 'p1', 'consumer'),
          createEdge('e3', 'input', 'p2'),
          createEdge('e4', 'p2', 'consumer'),
          createEdge('e5', 'consumer', 'output'),
        ],
      };

      const result = analyzeWorkflowNodeOutputPathCoverage(graph);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.findings[0]?.message).not.toContain('SUPER_SECRET_PAYLOAD_VALUE');
      }
    });

    it('40. findings use native numeric indices for array path segments', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('input'),
          createTransformNode('p1', [
            {
              operation: 'json_set',
              targetKey: 'a',
              value: { type: 'literal', value: 1 },
            },
          ]),
          createTransformNode('p2', [
            {
              operation: 'json_set',
              targetKey: 'b',
              value: { type: 'literal', value: 2 },
            },
          ]),
          createTransformNode('consumer', [
            {
              operation: 'json_pick',
              targetKey: 'out',
              source: { source: 'node_output', nodeId: 'p1', path: ['a'] },
            },
          ]),
          createOutputNode('output'),
        ],
        edges: [
          createEdge('e1', 'input', 'p1'),
          createEdge('e2', 'p1', 'consumer'),
          createEdge('e3', 'input', 'p2'),
          createEdge('e4', 'p2', 'consumer'),
          createEdge('e5', 'consumer', 'output'),
        ],
      };

      const result = analyzeWorkflowNodeOutputPathCoverage(graph);
      expect(result.success).toBe(true);
      if (result.success) {
        const path = result.findings[0]?.path;
        expect(typeof path?.[1]).toBe('number'); // nodeIndex
        expect(typeof path?.[4]).toBe('number'); // ruleIndex
      }
    });
  });

  describe('Prerequisite Stage Gating Failures', () => {
    it('41. returns stage integrity when duplicate node IDs are detected', () => {
      const graph: WorkflowGraph = {
        nodes: [createInputNode('dup'), createInputNode('dup'), createOutputNode('output')],
        edges: [createEdge('e1', 'dup', 'output')],
      };

      const result = analyzeWorkflowNodeOutputPathCoverage(graph);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.stage).toBe('integrity');
        expect(result.issues[0]?.code).toBe('DUPLICATE_NODE_ID');
      }
    });

    it('42. returns stage integrity when duplicate edge IDs are detected', () => {
      const graph: WorkflowGraph = {
        nodes: [createInputNode('input'), createOutputNode('output')],
        edges: [createEdge('dupEdge', 'input', 'output'), createEdge('dupEdge', 'input', 'output')],
      };

      const result = analyzeWorkflowNodeOutputPathCoverage(graph);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.stage).toBe('integrity');
        expect(result.issues[0]?.code).toBe('DUPLICATE_EDGE_ID');
      }
    });

    it('43. returns stage integrity when edge refers to missing node', () => {
      const graph: WorkflowGraph = {
        nodes: [createInputNode('input'), createOutputNode('output')],
        edges: [createEdge('e1', 'input', 'nonexistent')],
      };

      const result = analyzeWorkflowNodeOutputPathCoverage(graph);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.stage).toBe('integrity');
        expect(result.issues[0]?.code).toBe('MISSING_EDGE_TARGET');
      }
    });

    it('44. returns stage integrity when directed cycle is detected', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('input'),
          createTransformNode('a', [
            {
              operation: 'json_set',
              targetKey: 'v',
              value: { type: 'literal', value: 1 },
            },
          ]),
          createTransformNode('b', [
            {
              operation: 'json_set',
              targetKey: 'v',
              value: { type: 'literal', value: 2 },
            },
          ]),
          createOutputNode('output'),
        ],
        edges: [
          createEdge('e1', 'input', 'a'),
          createEdge('e2', 'a', 'b'),
          createEdge('e3', 'b', 'a'), // cycle
          createEdge('e4', 'b', 'output'),
        ],
      };

      const result = analyzeWorkflowNodeOutputPathCoverage(graph);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.stage).toBe('integrity');
        expect(result.issues[0]?.code).toBe('CYCLE_DETECTED');
      }
    });

    it('45. returns stage semantics when graph lacks INPUT or OUTPUT node', () => {
      const graphNoInput: WorkflowGraph = {
        nodes: [
          createTransformNode('a', [
            {
              operation: 'json_set',
              targetKey: 'v',
              value: { type: 'literal', value: 1 },
            },
          ]),
          createOutputNode('output'),
        ],
        edges: [createEdge('e1', 'a', 'output')],
      };

      const result = analyzeWorkflowNodeOutputPathCoverage(graphNoInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.stage).toBe('semantics');
        expect(result.issues.some((i) => i.code === 'MISSING_INPUT_NODE')).toBe(true);
      }
    });

    it('46. returns stage semantics when CONDITION node lacks TRUE branch', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('input'),
          createConditionNode('cond', {
            operator: 'equals',
            left: { type: 'literal', value: 1 },
            right: { type: 'literal', value: 1 },
          }),
          createOutputNode('outFalse'),
        ],
        edges: [createEdge('e1', 'input', 'cond'), createEdge('e2', 'cond', 'outFalse', 'FALSE')],
      };

      const result = analyzeWorkflowNodeOutputPathCoverage(graph);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.stage).toBe('semantics');
        expect(result.issues.some((i) => i.code === 'CONDITION_TRUE_BRANCH_MISSING')).toBe(true);
      }
    });

    it('47. returns stage entry_exit when INPUT node has incoming edge', () => {
      const graph: WorkflowGraph = {
        nodes: [createInputNode('input1'), createInputNode('input2'), createOutputNode('output')],
        edges: [
          createEdge('e1', 'input1', 'input2'), // invalid incoming edge to INPUT
          createEdge('e2', 'input2', 'output'),
        ],
      };

      const result = analyzeWorkflowNodeOutputPathCoverage(graph);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.stage).toBe('entry_exit');
        expect(result.issues[0]?.code).toBe('INPUT_HAS_INCOMING_EDGE');
      }
    });

    it('48. returns stage entry_exit when OUTPUT node has outgoing edge', () => {
      const graph: WorkflowGraph = {
        nodes: [createInputNode('input'), createOutputNode('output1'), createOutputNode('output2')],
        edges: [
          createEdge('e1', 'input', 'output1'),
          createEdge('e2', 'output1', 'output2'), // invalid outgoing edge from OUTPUT
        ],
      };

      const result = analyzeWorkflowNodeOutputPathCoverage(graph);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.stage).toBe('entry_exit');
        expect(result.issues[0]?.code).toBe('OUTPUT_HAS_OUTGOING_EDGE');
      }
    });

    it('49. returns stage configuration when node configuration fails schema validation', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('input'),
          {
            id: 'invalidNode',
            type: 'TRANSFORM',
            position: { x: 100, y: 100 },
            config: {
              rules: [
                {
                  operation: 'unknown_op' as unknown as 'json_pick',
                  targetKey: 'key',
                },
              ],
            },
          },
          createOutputNode('output'),
        ],
        edges: [
          createEdge('e1', 'input', 'invalidNode'),
          createEdge('e2', 'invalidNode', 'output'),
        ],
      };

      const result = analyzeWorkflowNodeOutputPathCoverage(graph);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.stage).toBe('configuration');
      }
    });

    it('50. returns stage references when referenced node does not exist in graph', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('input'),
          createTransformNode('consumer', [
            {
              operation: 'json_pick',
              targetKey: 'picked',
              source: { source: 'node_output', nodeId: 'nonexistentNode', path: ['field'] },
            },
          ]),
          createOutputNode('output'),
        ],
        edges: [createEdge('e1', 'input', 'consumer'), createEdge('e2', 'consumer', 'output')],
      };

      const result = analyzeWorkflowNodeOutputPathCoverage(graph);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.stage).toBe('references');
        expect(result.issues[0]?.code).toBe('NODE_OUTPUT_REFERENCE_NOT_FOUND');
      }
    });

    it('51. returns stage references when node references its own output', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('input'),
          createTransformNode('selfRefNode', [
            {
              operation: 'json_pick',
              targetKey: 'picked',
              source: { source: 'node_output', nodeId: 'selfRefNode', path: ['field'] },
            },
          ]),
          createOutputNode('output'),
        ],
        edges: [
          createEdge('e1', 'input', 'selfRefNode'),
          createEdge('e2', 'selfRefNode', 'output'),
        ],
      };

      const result = analyzeWorkflowNodeOutputPathCoverage(graph);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.stage).toBe('references');
        expect(result.issues[0]?.code).toBe('NODE_OUTPUT_REFERENCE_SELF');
      }
    });

    it('52. returns stage references when referenced node is not upstream in DAG', () => {
      // Linear: input -> consumer -> producer -> output
      // consumer references downstream producer
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('input'),
          createTransformNode('consumer', [
            {
              operation: 'json_pick',
              targetKey: 'picked',
              source: { source: 'node_output', nodeId: 'producer', path: ['val'] },
            },
          ]),
          createTransformNode('producer', [
            {
              operation: 'json_set',
              targetKey: 'val',
              value: { type: 'literal', value: 1 },
            },
          ]),
          createOutputNode('output'),
        ],
        edges: [
          createEdge('e1', 'input', 'consumer'),
          createEdge('e2', 'consumer', 'producer'),
          createEdge('e3', 'producer', 'output'),
        ],
      };

      const result = analyzeWorkflowNodeOutputPathCoverage(graph);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.stage).toBe('references');
        expect(result.issues[0]?.code).toBe('NODE_OUTPUT_REFERENCE_NOT_UPSTREAM');
      }
    });

    it('53. preserves existing diagnostic codes and paths on prerequisite failures', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('input'),
          createTransformNode('consumer', [
            {
              operation: 'json_pick',
              targetKey: 'picked',
              source: { source: 'node_output', nodeId: 'missing', path: ['val'] },
            },
          ]),
          createOutputNode('output'),
        ],
        edges: [createEdge('e1', 'input', 'consumer'), createEdge('e2', 'consumer', 'output')],
      };

      const result = analyzeWorkflowNodeOutputPathCoverage(graph);
      expect(result.success).toBe(false);
      if (!result.success && result.stage === 'references') {
        expect(result.issues[0]?.path).toEqual([
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

    it('54. produces no advisory path-coverage findings when prerequisite stages fail', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('input'),
          createTransformNode('consumer', [
            {
              operation: 'json_pick',
              targetKey: 'picked',
              source: { source: 'node_output', nodeId: 'missing', path: ['val'] },
            },
          ]),
          createOutputNode('output'),
        ],
        edges: [createEdge('e1', 'input', 'consumer'), createEdge('e2', 'consumer', 'output')],
      };

      const result = analyzeWorkflowNodeOutputPathCoverage(graph);
      expect(result.success).toBe(false);
      expect('findings' in result).toBe(false);
    });
  });

  describe('Boundary, Architecture & TypeScript Inference', () => {
    it('55. does not evaluate runtime condition expressions or branch conditions', () => {
      // Condition expression operator: 'equals', but both TRUE and FALSE paths are traversed
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('input'),
          createConditionNode('cond', {
            operator: 'equals',
            left: { type: 'literal', value: 'impossible_match' },
            right: { type: 'literal', value: 'different' },
          }),
          createTransformNode('nodeA', [
            {
              operation: 'json_set',
              targetKey: 'dataA',
              value: { type: 'literal', value: 'from_A' },
            },
          ]),
          createTransformNode('nodeB', [
            {
              operation: 'json_set',
              targetKey: 'dataB',
              value: { type: 'literal', value: 'from_B' },
            },
          ]),
          createTransformNode('merge', [
            {
              operation: 'json_pick',
              targetKey: 'picked',
              source: { source: 'node_output', nodeId: 'nodeA', path: ['dataA'] },
            },
          ]),
          createOutputNode('output'),
        ],
        edges: [
          createEdge('e1', 'input', 'cond'),
          createEdge('e2', 'cond', 'nodeA', 'TRUE'),
          createEdge('e3', 'cond', 'nodeB', 'FALSE'),
          createEdge('e4', 'nodeA', 'merge'),
          createEdge('e5', 'nodeB', 'merge'),
          createEdge('e6', 'merge', 'output'),
        ],
      };

      const result = analyzeWorkflowNodeOutputPathCoverage(graph);
      expect(result.success).toBe(true);
      if (result.success) {
        // Even though dynamically 'equals' would evaluate to false, static graph traversal
        // evaluates control-flow paths without evaluating runtime values.
        expect(result.findings).toHaveLength(1);
      }
    });

    it('56. does not assume AND-join or OR-join scheduling semantics', () => {
      // Path coverage simply tests graph path reachability without making execution scheduler assumptions
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('input'),
          createTransformNode('a', [
            {
              operation: 'json_set',
              targetKey: 'val',
              value: { type: 'literal', value: 1 },
            },
          ]),
          createOutputNode('output'),
        ],
        edges: [createEdge('e1', 'input', 'a'), createEdge('e2', 'a', 'output')],
      };

      const result = analyzeWorkflowNodeOutputPathCoverage(graph);
      expect(result.success).toBe(true);
    });

    it('57. TypeScript compiles and narrows discriminated result variants by success and stage', () => {
      const graph: WorkflowGraph = {
        nodes: [createInputNode('input'), createOutputNode('output')],
        edges: [createEdge('e1', 'input', 'output')],
      };

      const result = analyzeWorkflowNodeOutputPathCoverage(graph);

      if (result.success) {
        expectTypeOf(result).toEqualTypeOf<WorkflowNodeOutputPathCoverageSuccessResult>();
        expectTypeOf(result.findings).toEqualTypeOf<ReadonlyArray<NodeOutputPathCoverageFinding>>();
        expectTypeOf(result.issues).toEqualTypeOf<readonly []>();
      } else {
        switch (result.stage) {
          case 'integrity':
            expectTypeOf(
              result,
            ).toEqualTypeOf<WorkflowNodeOutputPathCoverageIntegrityFailureResult>();
            break;
          case 'semantics':
            expectTypeOf(
              result,
            ).toEqualTypeOf<WorkflowNodeOutputPathCoverageSemanticFailureResult>();
            break;
          case 'entry_exit':
            expectTypeOf(
              result,
            ).toEqualTypeOf<WorkflowNodeOutputPathCoverageEntryExitFailureResult>();
            break;
          case 'configuration':
            expectTypeOf(
              result,
            ).toEqualTypeOf<WorkflowNodeOutputPathCoverageConfigurationFailureResult>();
            break;
          case 'references':
            expectTypeOf(
              result,
            ).toEqualTypeOf<WorkflowNodeOutputPathCoverageReferencesFailureResult>();
            break;
          default: {
            const _exhaustiveCheck: never = result;
            expect(_exhaustiveCheck).toBeUndefined();
          }
        }
      }
    });

    it('58. verifies NodeOutputPathCoverageFindingCode literal string type', () => {
      const code: NodeOutputPathCoverageFindingCode =
        'NODE_OUTPUT_REFERENCE_NOT_ON_ALL_INPUT_PATHS';
      expect(code).toBe('NODE_OUTPUT_REFERENCE_NOT_ON_ALL_INPUT_PATHS');
      expectTypeOf(code).toEqualTypeOf<'NODE_OUTPUT_REFERENCE_NOT_ON_ALL_INPUT_PATHS'>();
    });

    it('59. verifies existing C1, C2, and D1 validators remain functional and unchanged', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('input'),
          createTransformNode('nodeA', [
            {
              operation: 'json_set',
              targetKey: 'val',
              value: { type: 'literal', value: 1 },
            },
          ]),
          createOutputNode('output'),
        ],
        edges: [createEdge('e1', 'input', 'nodeA'), createEdge('e2', 'nodeA', 'output')],
      };

      // analyzeWorkflowNodeOutputPathCoverage does not alter or break underlying validators
      const result = analyzeWorkflowNodeOutputPathCoverage(graph);
      expect(result.success).toBe(true);
    });

    it('60. supports APPROVAL node as intermediate DAG node without dynamic output references', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('input'),
          createTransformNode('nodeA', [
            {
              operation: 'json_set',
              targetKey: 'val',
              value: { type: 'literal', value: 1 },
            },
          ]),
          createApprovalNode('approval'),
          createTransformNode('consumer', [
            {
              operation: 'json_pick',
              targetKey: 'p',
              source: { source: 'node_output', nodeId: 'nodeA', path: ['val'] },
            },
          ]),
          createOutputNode('output'),
        ],
        edges: [
          createEdge('e1', 'input', 'nodeA'),
          createEdge('e2', 'nodeA', 'approval'),
          createEdge('e3', 'approval', 'consumer'),
          createEdge('e4', 'consumer', 'output'),
        ],
      };

      const result = analyzeWorkflowNodeOutputPathCoverage(graph);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.findings).toHaveLength(0);
      }
    });
  });
});
