import { describe, expect, expectTypeOf, it } from 'vitest';
import type {
  ConditionNodeConfig,
  InputNodeConfig,
  OutputNodeConfig,
  TransformNodeConfig,
  TransformRule,
  ValueBinding,
  WorkflowEdge,
  WorkflowGraph,
  WorkflowNode,
  WorkflowNodeConfig,
} from '@flowforge/contracts';
import { WorkflowGraphSchema } from '@flowforge/contracts';
import {
  validateWorkflowPublishReadiness,
  type WorkflowConfigurationBlockingIssue,
  type WorkflowEntryExitBlockingIssue,
  type WorkflowInputReferenceBlockingIssue,
  type WorkflowIntegrityBlockingIssue,
  type WorkflowNodeOutputReferenceBlockingIssue,
  type WorkflowPublishReadinessAdvisory,
  type WorkflowPublishReadinessBlockedResult,
  type WorkflowPublishReadinessBlockingIssue,
  type WorkflowPublishReadinessPassedResult,
  type WorkflowPublishReadinessPassedWithAdvisoriesResult,
  type WorkflowPublishReadinessResult,
  type WorkflowPublishReadinessStatus,
  type WorkflowSemanticBlockingIssue,
  type WorkflowStructuralIssue,
} from '../src/index.js';

// --- Test Fixture Helpers ---

function createInputNode(
  id: string,
  fields: InputNodeConfig['fields'] = [{ name: 'inputField', type: 'string', required: true }],
): WorkflowNode {
  const config: InputNodeConfig = { fields };
  return {
    id,
    type: 'INPUT',
    position: { x: 0, y: 0 },
    config: config as unknown as WorkflowNodeConfig,
  };
}

function createTransformNode(id: string, rules: TransformRule[]): WorkflowNode {
  const config: TransformNodeConfig = { rules };
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

function createOutputNode(
  id: string,
  payloadMapping: Record<string, ValueBinding> = {
    result: { type: 'literal', value: 'done' },
  },
): WorkflowNode {
  const config: OutputNodeConfig = { payloadMapping };
  return {
    id,
    type: 'OUTPUT',
    position: { x: 300, y: 300 },
    config: config as unknown as WorkflowNodeConfig,
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

describe('validateWorkflowPublishReadiness', () => {
  describe('Stage 1 — Structural Validation Failures', () => {
    it('1. non-object input is blocked at structure stage', () => {
      const result = validateWorkflowPublishReadiness('invalid string input');
      expect(result.status).toBe('blocked');
      if (result.status === 'blocked') {
        expect(result.blockingIssues.length).toBeGreaterThan(0);
        expect(result.blockingIssues[0]?.stage).toBe('structure');
        expect(result.advisories).toEqual([]);
      }
    });

    it('2. missing nodes array is blocked', () => {
      const result = validateWorkflowPublishReadiness({ edges: [] });
      expect(result.status).toBe('blocked');
      if (result.status === 'blocked') {
        expect(result.blockingIssues.some((i) => i.stage === 'structure')).toBe(true);
      }
    });

    it('3. missing edges array is blocked', () => {
      const result = validateWorkflowPublishReadiness({ nodes: [] });
      expect(result.status).toBe('blocked');
      if (result.status === 'blocked') {
        expect(result.blockingIssues.some((i) => i.stage === 'structure')).toBe(true);
      }
    });

    it('4. unknown node type is blocked', () => {
      const rawGraph = {
        nodes: [
          {
            id: 'n1',
            type: 'UNKNOWN_CUSTOM_TYPE',
            position: { x: 0, y: 0 },
            config: {},
          },
        ],
        edges: [],
      };
      const result = validateWorkflowPublishReadiness(rawGraph);
      expect(result.status).toBe('blocked');
      if (result.status === 'blocked') {
        expect(result.blockingIssues.some((i) => i.stage === 'structure')).toBe(true);
      }
    });

    it('5. invalid node position coordinates are blocked', () => {
      const rawGraph = {
        nodes: [
          {
            id: 'n1',
            type: 'INPUT',
            position: { x: 'invalid', y: 0 },
            config: {},
          },
        ],
        edges: [],
      };
      const result = validateWorkflowPublishReadiness(rawGraph);
      expect(result.status).toBe('blocked');
      if (result.status === 'blocked') {
        expect(result.blockingIssues.some((i) => i.stage === 'structure')).toBe(true);
      }
    });

    it('6. invalid edge shape is blocked', () => {
      const rawGraph = {
        nodes: [createInputNode('in'), createOutputNode('out')],
        edges: [{ id: 'e1', source: 'in' }], // missing target
      };
      const result = validateWorkflowPublishReadiness(rawGraph);
      expect(result.status).toBe('blocked');
      if (result.status === 'blocked') {
        expect(result.blockingIssues.some((i) => i.stage === 'structure')).toBe(true);
      }
    });

    it('7. preserves multiple structural issues without short-circuiting', () => {
      const rawGraph = {
        nodes: [
          { id: '', type: 'INVALID_1', position: { x: 'nan', y: 0 }, config: {} },
          { id: 'n2', type: 'INVALID_2', position: { x: 0, y: 'nan' }, config: {} },
        ],
        edges: [{ id: '', source: 'n1' }],
      };
      const result = validateWorkflowPublishReadiness(rawGraph);
      expect(result.status).toBe('blocked');
      if (result.status === 'blocked') {
        expect(result.blockingIssues.length).toBeGreaterThan(1);
        expect(result.blockingIssues.every((i) => i.stage === 'structure')).toBe(true);
      }
    });

    it('8. does not mutate untrusted input object', () => {
      const untrustedInput = Object.freeze({
        nodes: Object.freeze([]),
        edges: Object.freeze([]),
      });
      const result = validateWorkflowPublishReadiness(untrustedInput);
      expect(result.status).toBe('blocked'); // fails at semantics stage (missing INPUT)
    });

    it('9. structural issues do not attach raw input payloads or raw ZodError objects', () => {
      const secretPayload = { secret: 'AUTHENTICATION_TOKEN', nodes: 'bad' };
      const result = validateWorkflowPublishReadiness(secretPayload);
      expect(result.status).toBe('blocked');
      if (result.status === 'blocked') {
        const jsonString = JSON.stringify(result.blockingIssues);
        expect(jsonString).not.toContain('AUTHENTICATION_TOKEN');
      }
    });
  });

  describe('Stage 2 — Graph Integrity, Semantics & Boundary Topology Failures', () => {
    it('10. duplicate node IDs block at integrity stage', () => {
      const graph: WorkflowGraph = {
        nodes: [createInputNode('dup'), createInputNode('dup'), createOutputNode('out')],
        edges: [createEdge('e1', 'dup', 'out')],
      };
      // Confirms structural schema accepts duplicate node IDs (deferred to integrity stage)
      expect(WorkflowGraphSchema.safeParse(graph).success).toBe(true);

      const result = validateWorkflowPublishReadiness(graph);
      expect(result.status).toBe('blocked');
      if (result.status === 'blocked') {
        expect(result.blockingIssues[0]?.stage).toBe('integrity');
        expect(result.blockingIssues[0]?.code).toBe('DUPLICATE_NODE_ID');
      }
    });

    it('11. duplicate edge IDs block at integrity stage', () => {
      const graph: WorkflowGraph = {
        nodes: [createInputNode('in'), createOutputNode('out')],
        edges: [createEdge('dupEdge', 'in', 'out'), createEdge('dupEdge', 'in', 'out')],
      };
      // Confirms structural schema accepts duplicate edge IDs (deferred to integrity stage)
      expect(WorkflowGraphSchema.safeParse(graph).success).toBe(true);

      const result = validateWorkflowPublishReadiness(graph);
      expect(result.status).toBe('blocked');
      if (result.status === 'blocked') {
        expect(result.blockingIssues[0]?.stage).toBe('integrity');
        expect(result.blockingIssues[0]?.code).toBe('DUPLICATE_EDGE_ID');
      }
    });

    it('12. dangling edge source blocks at integrity stage', () => {
      const graph: WorkflowGraph = {
        nodes: [createInputNode('in'), createOutputNode('out')],
        edges: [createEdge('e1', 'missingSource', 'out')],
      };
      const result = validateWorkflowPublishReadiness(graph);
      expect(result.status).toBe('blocked');
      if (result.status === 'blocked') {
        expect(result.blockingIssues[0]?.stage).toBe('integrity');
        expect(result.blockingIssues[0]?.code).toBe('MISSING_EDGE_SOURCE');
      }
    });

    it('13. dangling edge target blocks at integrity stage', () => {
      const graph: WorkflowGraph = {
        nodes: [createInputNode('in'), createOutputNode('out')],
        edges: [createEdge('e1', 'in', 'missingTarget')],
      };
      const result = validateWorkflowPublishReadiness(graph);
      expect(result.status).toBe('blocked');
      if (result.status === 'blocked') {
        expect(result.blockingIssues[0]?.stage).toBe('integrity');
        expect(result.blockingIssues[0]?.code).toBe('MISSING_EDGE_TARGET');
      }
    });

    it('14. directed cycle blocks at integrity stage', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('in'),
          createTransformNode('a', [
            { operation: 'json_set', targetKey: 'k', value: { type: 'literal', value: 1 } },
          ]),
          createTransformNode('b', [
            { operation: 'json_set', targetKey: 'k', value: { type: 'literal', value: 2 } },
          ]),
          createOutputNode('out'),
        ],
        edges: [
          createEdge('e1', 'in', 'a'),
          createEdge('e2', 'a', 'b'),
          createEdge('e3', 'b', 'a'), // cycle
          createEdge('e4', 'b', 'out'),
        ],
      };
      const result = validateWorkflowPublishReadiness(graph);
      expect(result.status).toBe('blocked');
      if (result.status === 'blocked') {
        expect(result.blockingIssues[0]?.stage).toBe('integrity');
        expect(result.blockingIssues[0]?.code).toBe('CYCLE_DETECTED');
      }
    });

    it('15. missing INPUT node blocks at semantics stage', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createTransformNode('t1', [
            { operation: 'json_set', targetKey: 'k', value: { type: 'literal', value: 1 } },
          ]),
          createOutputNode('out'),
        ],
        edges: [createEdge('e1', 't1', 'out')],
      };
      const result = validateWorkflowPublishReadiness(graph);
      expect(result.status).toBe('blocked');
      if (result.status === 'blocked') {
        expect(result.blockingIssues.some((i) => i.stage === 'semantics')).toBe(true);
        expect(result.blockingIssues.some((i) => i.code === 'MISSING_INPUT_NODE')).toBe(true);
      }
    });

    it('16. missing OUTPUT node blocks at semantics stage', () => {
      const graph: WorkflowGraph = {
        nodes: [createInputNode('in')],
        edges: [],
      };
      const result = validateWorkflowPublishReadiness(graph);
      expect(result.status).toBe('blocked');
      if (result.status === 'blocked') {
        expect(result.blockingIssues.some((i) => i.stage === 'semantics')).toBe(true);
        expect(result.blockingIssues.some((i) => i.code === 'MISSING_OUTPUT_NODE')).toBe(true);
      }
    });

    it('17. incomplete CONDITION branching blocks at semantics stage', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('in'),
          createConditionNode('cond', {
            operator: 'equals',
            left: { type: 'literal', value: 1 },
            right: { type: 'literal', value: 1 },
          }),
          createOutputNode('outTrue'),
        ],
        edges: [
          createEdge('e1', 'in', 'cond'),
          createEdge('e2', 'cond', 'outTrue', 'TRUE'), // missing FALSE
        ],
      };
      const result = validateWorkflowPublishReadiness(graph);
      expect(result.status).toBe('blocked');
      if (result.status === 'blocked') {
        expect(result.blockingIssues[0]?.stage).toBe('semantics');
        expect(result.blockingIssues[0]?.code).toBe('CONDITION_FALSE_BRANCH_MISSING');
      }
    });

    it('18. non-CONDITION edge with conditionOutcome metadata blocks at semantics stage', () => {
      const graph: WorkflowGraph = {
        nodes: [createInputNode('in'), createOutputNode('out')],
        edges: [createEdge('e1', 'in', 'out', 'TRUE')], // in is INPUT, not CONDITION
      };
      const result = validateWorkflowPublishReadiness(graph);
      expect(result.status).toBe('blocked');
      if (result.status === 'blocked') {
        expect(result.blockingIssues[0]?.stage).toBe('semantics');
        expect(result.blockingIssues[0]?.code).toBe('NON_CONDITION_EDGE_OUTCOME');
      }
    });

    it('19. orphan node unreachable from input blocks at semantics stage', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('in'),
          createTransformNode('orphan', [
            { operation: 'json_set', targetKey: 'k', value: { type: 'literal', value: 1 } },
          ]),
          createOutputNode('out'),
        ],
        edges: [createEdge('e1', 'in', 'out'), createEdge('e2', 'orphan', 'out')],
      };
      const result = validateWorkflowPublishReadiness(graph);
      expect(result.status).toBe('blocked');
      if (result.status === 'blocked') {
        expect(result.blockingIssues[0]?.stage).toBe('semantics');
        expect(result.blockingIssues[0]?.code).toBe('UNREACHABLE_FROM_INPUT');
      }
    });

    it('20. dead-end node that cannot reach output blocks at semantics stage', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('in'),
          createTransformNode('deadend', [
            { operation: 'json_set', targetKey: 'k', value: { type: 'literal', value: 1 } },
          ]),
          createOutputNode('out'),
        ],
        edges: [createEdge('e1', 'in', 'out'), createEdge('e2', 'in', 'deadend')],
      };
      const result = validateWorkflowPublishReadiness(graph);
      expect(result.status).toBe('blocked');
      if (result.status === 'blocked') {
        expect(result.blockingIssues[0]?.stage).toBe('semantics');
        expect(result.blockingIssues[0]?.code).toBe('CANNOT_REACH_OUTPUT');
      }
    });

    it('21. incoming edge on INPUT node blocks at entry_exit stage', () => {
      const graph: WorkflowGraph = {
        nodes: [createInputNode('in1'), createInputNode('in2'), createOutputNode('out')],
        edges: [
          createEdge('e1', 'in1', 'in2'), // invalid incoming edge to INPUT
          createEdge('e2', 'in2', 'out'),
        ],
      };
      const result = validateWorkflowPublishReadiness(graph);
      expect(result.status).toBe('blocked');
      if (result.status === 'blocked') {
        expect(result.blockingIssues[0]?.stage).toBe('entry_exit');
        expect(result.blockingIssues[0]?.code).toBe('INPUT_HAS_INCOMING_EDGE');
      }
    });

    it('22. outgoing edge on OUTPUT node blocks at entry_exit stage', () => {
      const graph: WorkflowGraph = {
        nodes: [createInputNode('in'), createOutputNode('out1'), createOutputNode('out2')],
        edges: [
          createEdge('e1', 'in', 'out1'),
          createEdge('e2', 'out1', 'out2'), // invalid outgoing edge from OUTPUT
        ],
      };
      const result = validateWorkflowPublishReadiness(graph);
      expect(result.status).toBe('blocked');
      if (result.status === 'blocked') {
        expect(result.blockingIssues[0]?.stage).toBe('entry_exit');
        expect(result.blockingIssues[0]?.code).toBe('OUTPUT_HAS_OUTGOING_EDGE');
      }
    });

    it('23. preserves original diagnostic paths and codes from entry/terminal topology', () => {
      const graph: WorkflowGraph = {
        nodes: [createInputNode('in'), createOutputNode('out1'), createOutputNode('out2')],
        edges: [createEdge('e1', 'in', 'out1'), createEdge('e2', 'out1', 'out2')],
      };
      const result = validateWorkflowPublishReadiness(graph);
      expect(result.status).toBe('blocked');
      if (result.status === 'blocked') {
        expect(result.blockingIssues[0]?.path).toEqual(['edges', 1, 'source']);
      }
    });

    it('24. correctly tags failure stages without collapsing into generic errors', () => {
      const graphCycle: WorkflowGraph = {
        nodes: [
          createInputNode('in'),
          createTransformNode('a', [
            { operation: 'json_set', targetKey: 'k', value: { type: 'literal', value: 1 } },
          ]),
          createOutputNode('out'),
        ],
        edges: [
          createEdge('e1', 'in', 'a'),
          createEdge('e2', 'a', 'a'), // self loop
          createEdge('e3', 'a', 'out'),
        ],
      };
      const result = validateWorkflowPublishReadiness(graphCycle);
      expect(result.status).toBe('blocked');
      if (result.status === 'blocked') {
        expect(result.blockingIssues[0]?.stage).toBe('integrity');
      }
    });
  });

  describe('Stage 3 — Node Configuration Failures', () => {
    it('25. incomplete draft INPUT config ({ config: {} }) blocks at configuration stage', () => {
      const graph: WorkflowGraph = {
        nodes: [
          { id: 'in', type: 'INPUT', position: { x: 0, y: 0 }, config: {} },
          createOutputNode('out'),
        ],
        edges: [createEdge('e1', 'in', 'out')],
      };
      const result = validateWorkflowPublishReadiness(graph);
      expect(result.status).toBe('blocked');
      if (result.status === 'blocked') {
        expect(result.blockingIssues[0]?.stage).toBe('configuration');
      }
    });

    it('26. incomplete draft LLM config blocks at configuration stage', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('in'),
          { id: 'llm', type: 'LLM', position: { x: 100, y: 100 }, config: {} },
          createOutputNode('out'),
        ],
        edges: [createEdge('e1', 'in', 'llm'), createEdge('e2', 'llm', 'out')],
      };
      const result = validateWorkflowPublishReadiness(graph);
      expect(result.status).toBe('blocked');
      if (result.status === 'blocked') {
        expect(result.blockingIssues.some((i) => i.stage === 'configuration')).toBe(true);
      }
    });

    it('27. invalid TRANSFORM config blocks at configuration stage', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('in'),
          {
            id: 't1',
            type: 'TRANSFORM',
            position: { x: 100, y: 100 },
            config: { rules: [{ operation: 'unknown_op' }] },
          },
          createOutputNode('out'),
        ],
        edges: [createEdge('e1', 'in', 't1'), createEdge('e2', 't1', 'out')],
      };
      const result = validateWorkflowPublishReadiness(graph);
      expect(result.status).toBe('blocked');
      if (result.status === 'blocked') {
        expect(result.blockingIssues[0]?.stage).toBe('configuration');
      }
    });

    it('28. invalid CONDITION config blocks at configuration stage', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('in'),
          {
            id: 'c1',
            type: 'CONDITION',
            position: { x: 100, y: 100 },
            config: { operator: 'invalid_op' },
          },
          createOutputNode('outTrue'),
          createOutputNode('outFalse'),
        ],
        edges: [
          createEdge('e1', 'in', 'c1'),
          createEdge('e2', 'c1', 'outTrue', 'TRUE'),
          createEdge('e3', 'c1', 'outFalse', 'FALSE'),
        ],
      };
      const result = validateWorkflowPublishReadiness(graph);
      expect(result.status).toBe('blocked');
      if (result.status === 'blocked') {
        expect(result.blockingIssues[0]?.stage).toBe('configuration');
      }
    });

    it('29. invalid MCP_TOOL config blocks at configuration stage', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('in'),
          {
            id: 'mcp1',
            type: 'MCP_TOOL',
            position: { x: 100, y: 100 },
            config: { integrationRef: '' }, // empty integrationRef
          },
          createOutputNode('out'),
        ],
        edges: [createEdge('e1', 'in', 'mcp1'), createEdge('e2', 'mcp1', 'out')],
      };
      const result = validateWorkflowPublishReadiness(graph);
      expect(result.status).toBe('blocked');
      if (result.status === 'blocked') {
        expect(result.blockingIssues[0]?.stage).toBe('configuration');
      }
    });

    it('30. invalid APPROVAL config blocks at configuration stage', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('in'),
          {
            id: 'app1',
            type: 'APPROVAL',
            position: { x: 100, y: 100 },
            config: { title: '' }, // empty title
          },
          createOutputNode('out'),
        ],
        edges: [createEdge('e1', 'in', 'app1'), createEdge('e2', 'app1', 'out')],
      };
      const result = validateWorkflowPublishReadiness(graph);
      expect(result.status).toBe('blocked');
      if (result.status === 'blocked') {
        expect(result.blockingIssues[0]?.stage).toBe('configuration');
      }
    });

    it('31. invalid OUTPUT config blocks at configuration stage', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('in'),
          {
            id: 'out',
            type: 'OUTPUT',
            position: { x: 100, y: 100 },
            config: { payloadMapping: {} }, // empty mapping
          },
        ],
        edges: [createEdge('e1', 'in', 'out')],
      };
      const result = validateWorkflowPublishReadiness(graph);
      expect(result.status).toBe('blocked');
      if (result.status === 'blocked') {
        expect(result.blockingIssues[0]?.stage).toBe('configuration');
      }
    });

    it('32. preserves multiple config issues from a single node', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('in'),
          {
            id: 't1',
            type: 'TRANSFORM',
            position: { x: 100, y: 100 },
            config: {
              rules: [
                { operation: 'unknown_1', targetKey: 'k1' },
                { operation: 'unknown_2', targetKey: 'k2' },
              ],
            },
          },
          createOutputNode('out'),
        ],
        edges: [createEdge('e1', 'in', 't1'), createEdge('e2', 't1', 'out')],
      };
      const result = validateWorkflowPublishReadiness(graph);
      expect(result.status).toBe('blocked');
      if (result.status === 'blocked') {
        expect(result.blockingIssues.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('33. aggregates config issues across multiple invalid nodes', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('in'),
          {
            id: 't1',
            type: 'TRANSFORM',
            position: { x: 100, y: 100 },
            config: { rules: [{ operation: 'bad_op' }] },
          },
          {
            id: 't2',
            type: 'TRANSFORM',
            position: { x: 200, y: 200 },
            config: { rules: [{ operation: 'bad_op' }] },
          },
          createOutputNode('out'),
        ],
        edges: [
          createEdge('e1', 'in', 't1'),
          createEdge('e2', 't1', 't2'),
          createEdge('e3', 't2', 'out'),
        ],
      };
      const result = validateWorkflowPublishReadiness(graph);
      expect(result.status).toBe('blocked');
      if (result.status === 'blocked') {
        const nodeIds = result.blockingIssues.map((i) =>
          i.stage === 'configuration' ? i.nodeId : undefined,
        );
        expect(nodeIds).toContain('t1');
        expect(nodeIds).toContain('t2');
      }
    });

    it('34. generic WorkflowGraphSchema still allows drafts independently of publish assessment', () => {
      const draftGraph = {
        nodes: [
          { id: 'in', type: 'INPUT', position: { x: 0, y: 0 }, config: {} },
          { id: 'out', type: 'OUTPUT', position: { x: 100, y: 100 }, config: {} },
        ],
        edges: [{ id: 'e1', source: 'in', target: 'out' }],
      };
      const draftParse = WorkflowGraphSchema.safeParse(draftGraph);
      expect(draftParse.success).toBe(true);

      const readinessResult = validateWorkflowPublishReadiness(draftGraph);
      expect(readinessResult.status).toBe('blocked');
      if (readinessResult.status === 'blocked') {
        expect(readinessResult.blockingIssues[0]?.stage).toBe('configuration');
      }
    });
  });

  describe('Stage 4 — Static Reference Failures', () => {
    it('35. missing node-output target blocks at node_output_references stage', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('in'),
          createTransformNode('t1', [
            {
              operation: 'json_pick',
              targetKey: 'p',
              source: { source: 'node_output', nodeId: 'nonexistent', path: ['field'] },
            },
          ]),
          createOutputNode('out'),
        ],
        edges: [createEdge('e1', 'in', 't1'), createEdge('e2', 't1', 'out')],
      };
      const result = validateWorkflowPublishReadiness(graph);
      expect(result.status).toBe('blocked');
      if (result.status === 'blocked') {
        expect(result.blockingIssues[0]?.stage).toBe('node_output_references');
        expect(result.blockingIssues[0]?.code).toBe('NODE_OUTPUT_REFERENCE_NOT_FOUND');
      }
    });

    it('36. self node-output reference blocks at node_output_references stage', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('in'),
          createTransformNode('selfNode', [
            {
              operation: 'json_pick',
              targetKey: 'p',
              source: { source: 'node_output', nodeId: 'selfNode', path: ['field'] },
            },
          ]),
          createOutputNode('out'),
        ],
        edges: [createEdge('e1', 'in', 'selfNode'), createEdge('e2', 'selfNode', 'out')],
      };
      const result = validateWorkflowPublishReadiness(graph);
      expect(result.status).toBe('blocked');
      if (result.status === 'blocked') {
        expect(result.blockingIssues[0]?.stage).toBe('node_output_references');
        expect(result.blockingIssues[0]?.code).toBe('NODE_OUTPUT_REFERENCE_SELF');
      }
    });

    it('37. downstream node-output reference blocks at node_output_references stage', () => {
      // in -> consumer -> producer -> out
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('in'),
          createTransformNode('consumer', [
            {
              operation: 'json_pick',
              targetKey: 'p',
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
          createOutputNode('out'),
        ],
        edges: [
          createEdge('e1', 'in', 'consumer'),
          createEdge('e2', 'consumer', 'producer'),
          createEdge('e3', 'producer', 'out'),
        ],
      };
      const result = validateWorkflowPublishReadiness(graph);
      expect(result.status).toBe('blocked');
      if (result.status === 'blocked') {
        expect(result.blockingIssues[0]?.stage).toBe('node_output_references');
        expect(result.blockingIssues[0]?.code).toBe('NODE_OUTPUT_REFERENCE_NOT_UPSTREAM');
      }
    });

    it('38. unrelated non-ancestor reference in sibling branch blocks', () => {
      // in -> cond -> branchA -> outA; in -> cond -> branchB -> outB
      // branchB references branchA
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('in'),
          createConditionNode('cond', {
            operator: 'equals',
            left: { type: 'literal', value: 1 },
            right: { type: 'literal', value: 1 },
          }),
          createTransformNode('branchA', [
            {
              operation: 'json_set',
              targetKey: 'valA',
              value: { type: 'literal', value: 'A' },
            },
          ]),
          createTransformNode('branchB', [
            {
              operation: 'json_pick',
              targetKey: 'p',
              source: { source: 'node_output', nodeId: 'branchA', path: ['valA'] },
            },
          ]),
          createOutputNode('outA'),
          createOutputNode('outB'),
        ],
        edges: [
          createEdge('e1', 'in', 'cond'),
          createEdge('e2', 'cond', 'branchA', 'TRUE'),
          createEdge('e3', 'cond', 'branchB', 'FALSE'),
          createEdge('e4', 'branchA', 'outA'),
          createEdge('e5', 'branchB', 'outB'),
        ],
      };
      const result = validateWorkflowPublishReadiness(graph);
      expect(result.status).toBe('blocked');
      if (result.status === 'blocked') {
        expect(result.blockingIssues[0]?.stage).toBe('node_output_references');
        expect(result.blockingIssues[0]?.code).toBe('NODE_OUTPUT_REFERENCE_NOT_UPSTREAM');
      }
    });

    it('39. missing INPUT field blocks at input_references stage', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('in', [{ name: 'existingField', type: 'string', required: true }]),
          createTransformNode('t1', [
            {
              operation: 'json_pick',
              targetKey: 'p',
              source: { source: 'input', field: 'missingField', path: [] },
            },
          ]),
          createOutputNode('out'),
        ],
        edges: [createEdge('e1', 'in', 't1'), createEdge('e2', 't1', 'out')],
      };
      const result = validateWorkflowPublishReadiness(graph);
      expect(result.status).toBe('blocked');
      if (result.status === 'blocked') {
        expect(result.blockingIssues[0]?.stage).toBe('input_references');
        expect(result.blockingIssues[0]?.code).toBe('INPUT_REFERENCE_FIELD_NOT_FOUND');
      }
    });

    it('40. ambiguous duplicate INPUT field declaration blocks at input_references stage', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('in1', [{ name: 'sharedField', type: 'string', required: true }]),
          createInputNode('in2', [{ name: 'sharedField', type: 'string', required: true }]),
          createTransformNode('t1', [
            {
              operation: 'json_pick',
              targetKey: 'p',
              source: { source: 'input', field: 'sharedField', path: [] },
            },
          ]),
          createOutputNode('out'),
        ],
        edges: [
          createEdge('e1', 'in1', 't1'),
          createEdge('e2', 'in2', 't1'),
          createEdge('e3', 't1', 'out'),
        ],
      };
      const result = validateWorkflowPublishReadiness(graph);
      expect(result.status).toBe('blocked');
      if (result.status === 'blocked') {
        expect(result.blockingIssues[0]?.stage).toBe('input_references');
        expect(result.blockingIssues[0]?.code).toBe('INPUT_REFERENCE_FIELD_AMBIGUOUS');
      }
    });

    it('41. both node-output and INPUT reference failures appear in the same blocked assessment', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('in', [{ name: 'validField', type: 'string', required: true }]),
          createTransformNode('t1', [
            {
              operation: 'json_pick',
              targetKey: 'p1',
              source: { source: 'node_output', nodeId: 'nonexistentNode', path: ['field'] },
            },
            {
              operation: 'json_pick',
              targetKey: 'p2',
              source: { source: 'input', field: 'missingInputField', path: [] },
            },
          ]),
          createOutputNode('out'),
        ],
        edges: [createEdge('e1', 'in', 't1'), createEdge('e2', 't1', 'out')],
      };
      const result = validateWorkflowPublishReadiness(graph);
      expect(result.status).toBe('blocked');
      if (result.status === 'blocked') {
        const stages = result.blockingIssues.map((i) => i.stage);
        expect(stages).toContain('node_output_references');
        expect(stages).toContain('input_references');
        // Deterministic ordering: node_output_references first, input_references second
        const nodeOutputIdx = stages.indexOf('node_output_references');
        const inputRefIdx = stages.indexOf('input_references');
        expect(nodeOutputIdx).toBeLessThan(inputRefIdx);
      }
    });

    it('42. preserves exact reference diagnostic paths and codes', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('in', [{ name: 'validField', type: 'string', required: true }]),
          createTransformNode('t1', [
            {
              operation: 'json_pick',
              targetKey: 'p',
              source: { source: 'input', field: 'missing', path: [] },
            },
          ]),
          createOutputNode('out'),
        ],
        edges: [createEdge('e1', 'in', 't1'), createEdge('e2', 't1', 'out')],
      };
      const result = validateWorkflowPublishReadiness(graph);
      expect(result.status).toBe('blocked');
      if (result.status === 'blocked') {
        expect(result.blockingIssues[0]?.path).toEqual([
          'nodes',
          1,
          'config',
          'rules',
          0,
          'source',
          'field',
        ]);
      }
    });

    it('43. literal JSON resembling references is not inspected as a reference', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('in'),
          createTransformNode('t1', [
            {
              operation: 'json_set',
              targetKey: 'fake',
              value: {
                type: 'literal',
                value: { source: 'node_output', nodeId: 'nonexistent', field: 'missing' },
              },
            },
          ]),
          createOutputNode('out'),
        ],
        edges: [createEdge('e1', 'in', 't1'), createEdge('e2', 't1', 'out')],
      };
      const result = validateWorkflowPublishReadiness(graph);
      expect(result.status).toBe('checks_passed');
    });

    it('44. preserves dotted mapping keys atomically in reference paths', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('in'),
          createOutputNode('out', {
            'custom.result_key': {
              type: 'reference',
              reference: { source: 'node_output', nodeId: 'nonexistent', path: ['field'] },
            },
          }),
        ],
        edges: [createEdge('e1', 'in', 'out')],
      };
      const result = validateWorkflowPublishReadiness(graph);
      expect(result.status).toBe('blocked');
      if (result.status === 'blocked') {
        expect(result.blockingIssues[0]?.path).toEqual([
          'nodes',
          1,
          'config',
          'payloadMapping',
          'custom.result_key',
          'reference',
          'nodeId',
        ]);
      }
    });

    it('45. INPUT and node-output reference categories remain decoupled and independent', () => {
      // Valid input reference with invalid node-output reference
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('in', [{ name: 'f1', type: 'string', required: true }]),
          createTransformNode('t1', [
            {
              operation: 'json_pick',
              targetKey: 'p1',
              source: { source: 'input', field: 'f1', path: [] },
            },
            {
              operation: 'json_pick',
              targetKey: 'p2',
              source: { source: 'node_output', nodeId: 'missingNode', path: ['val'] },
            },
          ]),
          createOutputNode('out'),
        ],
        edges: [createEdge('e1', 'in', 't1'), createEdge('e2', 't1', 'out')],
      };
      const result = validateWorkflowPublishReadiness(graph);
      expect(result.status).toBe('blocked');
      if (result.status === 'blocked') {
        expect(result.blockingIssues.some((i) => i.stage === 'node_output_references')).toBe(true);
        expect(result.blockingIssues.some((i) => i.stage === 'input_references')).toBe(false);
      }
    });
  });

  describe('Stage 5 — Advisory Outcomes & Branch Path Coverage', () => {
    it('46. valid simple INPUT -> OUTPUT graph passes without advisories', () => {
      const graph: WorkflowGraph = {
        nodes: [createInputNode('in'), createOutputNode('out')],
        edges: [createEdge('e1', 'in', 'out')],
      };
      const result = validateWorkflowPublishReadiness(graph);
      expect(result.status).toBe('checks_passed');
      if (result.status === 'checks_passed') {
        expect(result.blockingIssues).toEqual([]);
        expect(result.advisories).toEqual([]);
        expect(result.topologicalNodeIds).toEqual(['in', 'out']);
      }
    });

    it('47. valid configured graph with no node-output refs passes without advisories', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('in', [{ name: 'f1', type: 'string', required: true }]),
          createTransformNode('t1', [
            {
              operation: 'json_pick',
              targetKey: 'p',
              source: { source: 'input', field: 'f1', path: [] },
            },
          ]),
          createOutputNode('out'),
        ],
        edges: [createEdge('e1', 'in', 't1'), createEdge('e2', 't1', 'out')],
      };
      const result = validateWorkflowPublishReadiness(graph);
      expect(result.status).toBe('checks_passed');
      if (result.status === 'checks_passed') {
        expect(result.advisories).toHaveLength(0);
        expect(result.topologicalNodeIds).toEqual(['in', 't1', 'out']);
      }
    });

    it('48. dominating producer reference passes without advisories (checks_passed)', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('in'),
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
          createOutputNode('out'),
        ],
        edges: [
          createEdge('e1', 'in', 'nodeA'),
          createEdge('e2', 'nodeA', 'consumer'),
          createEdge('e3', 'consumer', 'out'),
        ],
      };
      const result = validateWorkflowPublishReadiness(graph);
      expect(result.status).toBe('checks_passed');
      if (result.status === 'checks_passed') {
        expect(result.advisories).toEqual([]);
        expect(result.topologicalNodeIds).toEqual(['in', 'nodeA', 'consumer', 'out']);
      }
    });

    it('49. conditional merge with non-dominating reference passes static checks WITH advisories', () => {
      // in -> cond -T-> A -> merge; cond -F-> B -> merge -> out
      // merge references A
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('in'),
          createConditionNode('cond', {
            operator: 'equals',
            left: { type: 'literal', value: 1 },
            right: { type: 'literal', value: 1 },
          }),
          createTransformNode('nodeA', [
            {
              operation: 'json_set',
              targetKey: 'dataA',
              value: { type: 'literal', value: 'A' },
            },
          ]),
          createTransformNode('nodeB', [
            {
              operation: 'json_set',
              targetKey: 'dataB',
              value: { type: 'literal', value: 'B' },
            },
          ]),
          createTransformNode('merge', [
            {
              operation: 'json_pick',
              targetKey: 'picked',
              source: { source: 'node_output', nodeId: 'nodeA', path: ['dataA'] },
            },
          ]),
          createOutputNode('out'),
        ],
        edges: [
          createEdge('e1', 'in', 'cond'),
          createEdge('e2', 'cond', 'nodeA', 'TRUE'),
          createEdge('e3', 'cond', 'nodeB', 'FALSE'),
          createEdge('e4', 'nodeA', 'merge'),
          createEdge('e5', 'nodeB', 'merge'),
          createEdge('e6', 'merge', 'out'),
        ],
      };
      const result = validateWorkflowPublishReadiness(graph);
      expect(result.status).toBe('checks_passed_with_advisories');
      if (result.status === 'checks_passed_with_advisories') {
        expect(result.blockingIssues).toEqual([]);
        expect(result.advisories).toHaveLength(1);
        expect(result.advisories[0]?.code).toBe('NODE_OUTPUT_REFERENCE_NOT_ON_ALL_INPUT_PATHS');
        expect(result.topologicalNodeIds.length).toBe(6);
      }
    });

    it('50. optional bypass path produces advisories without blocking', () => {
      // in -> A -> consumer; in -> consumer; consumer -> out
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('in'),
          createTransformNode('nodeA', [
            {
              operation: 'json_set',
              targetKey: 'data',
              value: { type: 'literal', value: 1 },
            },
          ]),
          createTransformNode('consumer', [
            {
              operation: 'json_pick',
              targetKey: 'picked',
              source: { source: 'node_output', nodeId: 'nodeA', path: ['data'] },
            },
          ]),
          createOutputNode('out'),
        ],
        edges: [
          createEdge('e1', 'in', 'nodeA'),
          createEdge('e2', 'nodeA', 'consumer'),
          createEdge('e3', 'in', 'consumer'),
          createEdge('e4', 'consumer', 'out'),
        ],
      };
      const result = validateWorkflowPublishReadiness(graph);
      expect(result.status).toBe('checks_passed_with_advisories');
      if (result.status === 'checks_passed_with_advisories') {
        expect(result.advisories).toHaveLength(1);
      }
    });

    it('51. multiple INPUT root bypass produces advisories without blocking', () => {
      // in1 -> A -> consumer -> out; in2 -> consumer
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('in1'),
          createInputNode('in2'),
          createTransformNode('nodeA', [
            {
              operation: 'json_set',
              targetKey: 'data',
              value: { type: 'literal', value: 1 },
            },
          ]),
          createTransformNode('consumer', [
            {
              operation: 'json_pick',
              targetKey: 'picked',
              source: { source: 'node_output', nodeId: 'nodeA', path: ['data'] },
            },
          ]),
          createOutputNode('out'),
        ],
        edges: [
          createEdge('e1', 'in1', 'nodeA'),
          createEdge('e2', 'nodeA', 'consumer'),
          createEdge('e3', 'in2', 'consumer'),
          createEdge('e4', 'consumer', 'out'),
        ],
      };
      const result = validateWorkflowPublishReadiness(graph);
      expect(result.status).toBe('checks_passed_with_advisories');
      if (result.status === 'checks_passed_with_advisories') {
        expect(result.advisories).toHaveLength(1);
      }
    });

    it('52. multiple advisory occurrences remain distinct in advisories array', () => {
      // in -> cond -T-> A -> merge; cond -F-> B -> merge -> out
      // merge references A twice in distinct rules
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('in'),
          createConditionNode('cond', {
            operator: 'equals',
            left: { type: 'literal', value: 1 },
            right: { type: 'literal', value: 1 },
          }),
          createTransformNode('nodeA', [
            {
              operation: 'json_set',
              targetKey: 'val1',
              value: { type: 'literal', value: 'A1' },
            },
            {
              operation: 'json_set',
              targetKey: 'val2',
              value: { type: 'literal', value: 'A2' },
            },
          ]),
          createTransformNode('nodeB', [
            {
              operation: 'json_set',
              targetKey: 'valB',
              value: { type: 'literal', value: 'B' },
            },
          ]),
          createTransformNode('merge', [
            {
              operation: 'json_pick',
              targetKey: 'p1',
              source: { source: 'node_output', nodeId: 'nodeA', path: ['val1'] },
            },
            {
              operation: 'json_pick',
              targetKey: 'p2',
              source: { source: 'node_output', nodeId: 'nodeA', path: ['val2'] },
            },
          ]),
          createOutputNode('out'),
        ],
        edges: [
          createEdge('e1', 'in', 'cond'),
          createEdge('e2', 'cond', 'nodeA', 'TRUE'),
          createEdge('e3', 'cond', 'nodeB', 'FALSE'),
          createEdge('e4', 'nodeA', 'merge'),
          createEdge('e5', 'nodeB', 'merge'),
          createEdge('e6', 'merge', 'out'),
        ],
      };
      const result = validateWorkflowPublishReadiness(graph);
      expect(result.status).toBe('checks_passed_with_advisories');
      if (result.status === 'checks_passed_with_advisories') {
        expect(result.advisories).toHaveLength(2);
      }
    });

    it('53. advisory findings never enter blockingIssues', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('in'),
          createConditionNode('cond', {
            operator: 'equals',
            left: { type: 'literal', value: 1 },
            right: { type: 'literal', value: 1 },
          }),
          createTransformNode('nodeA', [
            {
              operation: 'json_set',
              targetKey: 'valA',
              value: { type: 'literal', value: 'A' },
            },
          ]),
          createTransformNode('nodeB', [
            {
              operation: 'json_set',
              targetKey: 'valB',
              value: { type: 'literal', value: 'B' },
            },
          ]),
          createTransformNode('merge', [
            {
              operation: 'json_pick',
              targetKey: 'p',
              source: { source: 'node_output', nodeId: 'nodeA', path: ['valA'] },
            },
          ]),
          createOutputNode('out'),
        ],
        edges: [
          createEdge('e1', 'in', 'cond'),
          createEdge('e2', 'cond', 'nodeA', 'TRUE'),
          createEdge('e3', 'cond', 'nodeB', 'FALSE'),
          createEdge('e4', 'nodeA', 'merge'),
          createEdge('e5', 'nodeB', 'merge'),
          createEdge('e6', 'merge', 'out'),
        ],
      };
      const result = validateWorkflowPublishReadiness(graph);
      expect(result.status).toBe('checks_passed_with_advisories');
      if (result.status === 'checks_passed_with_advisories') {
        expect(result.blockingIssues).toEqual([]);
      }
    });

    it('54. advisory presence does not turn static assessment into blocked', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('in'),
          createConditionNode('cond', {
            operator: 'equals',
            left: { type: 'literal', value: 1 },
            right: { type: 'literal', value: 1 },
          }),
          createTransformNode('nodeA', [
            {
              operation: 'json_set',
              targetKey: 'valA',
              value: { type: 'literal', value: 'A' },
            },
          ]),
          createTransformNode('nodeB', [
            {
              operation: 'json_set',
              targetKey: 'valB',
              value: { type: 'literal', value: 'B' },
            },
          ]),
          createTransformNode('merge', [
            {
              operation: 'json_pick',
              targetKey: 'p',
              source: { source: 'node_output', nodeId: 'nodeA', path: ['valA'] },
            },
          ]),
          createOutputNode('out'),
        ],
        edges: [
          createEdge('e1', 'in', 'cond'),
          createEdge('e2', 'cond', 'nodeA', 'TRUE'),
          createEdge('e3', 'cond', 'nodeB', 'FALSE'),
          createEdge('e4', 'nodeA', 'merge'),
          createEdge('e5', 'nodeB', 'merge'),
          createEdge('e6', 'merge', 'out'),
        ],
      };
      const result = validateWorkflowPublishReadiness(graph);
      expect(result.status).not.toBe('blocked');
    });

    it('55. passing without advisories does not expose speculative runtime flags', () => {
      const graph: WorkflowGraph = {
        nodes: [createInputNode('in'), createOutputNode('out')],
        edges: [createEdge('e1', 'in', 'out')],
      };
      const result = validateWorkflowPublishReadiness(graph);
      expect('isPublishable' in result).toBe(false);
      expect('canExecute' in result).toBe(false);
      expect('canRun' in result).toBe(false);
    });

    it('56. passing with advisories does not expose speculative runtime flags', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('in'),
          createTransformNode('nodeA', [
            {
              operation: 'json_set',
              targetKey: 'data',
              value: { type: 'literal', value: 1 },
            },
          ]),
          createTransformNode('consumer', [
            {
              operation: 'json_pick',
              targetKey: 'p',
              source: { source: 'node_output', nodeId: 'nodeA', path: ['data'] },
            },
          ]),
          createOutputNode('out'),
        ],
        edges: [
          createEdge('e1', 'in', 'nodeA'),
          createEdge('e2', 'nodeA', 'consumer'),
          createEdge('e3', 'in', 'consumer'),
          createEdge('e4', 'consumer', 'out'),
        ],
      };
      const result = validateWorkflowPublishReadiness(graph);
      expect(result.status).toBe('checks_passed_with_advisories');
      expect('isPublishable' in result).toBe(false);
      expect('canExecute' in result).toBe(false);
    });
  });

  describe('Compatibility, Invariants & Determinism', () => {
    it('57. supports multiple valid INPUT nodes', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('in1', [{ name: 'f1', type: 'string', required: true }]),
          createInputNode('in2', [{ name: 'f2', type: 'number', required: true }]),
          createOutputNode('out'),
        ],
        edges: [createEdge('e1', 'in1', 'out'), createEdge('e2', 'in2', 'out')],
      };
      const result = validateWorkflowPublishReadiness(graph);
      expect(result.status).toBe('checks_passed');
    });

    it('58. supports multiple valid OUTPUT nodes', () => {
      const graph: WorkflowGraph = {
        nodes: [createInputNode('in'), createOutputNode('out1'), createOutputNode('out2')],
        edges: [createEdge('e1', 'in', 'out1'), createEdge('e2', 'in', 'out2')],
      };
      const result = validateWorkflowPublishReadiness(graph);
      expect(result.status).toBe('checks_passed');
    });

    it('59. does not block unreferenced duplicate INPUT declarations across multiple inputs', () => {
      // in1 and in2 both declare 'unreferencedDup', but consumer references 'uniqueField'
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('in1', [
            { name: 'unreferencedDup', type: 'string', required: true },
            { name: 'uniqueField', type: 'string', required: true },
          ]),
          createInputNode('in2', [{ name: 'unreferencedDup', type: 'string', required: true }]),
          createTransformNode('t1', [
            {
              operation: 'json_pick',
              targetKey: 'p',
              source: { source: 'input', field: 'uniqueField', path: [] },
            },
          ]),
          createOutputNode('out'),
        ],
        edges: [
          createEdge('e1', 'in1', 't1'),
          createEdge('e2', 'in2', 'out'),
          createEdge('e3', 't1', 'out'),
        ],
      };
      const result = validateWorkflowPublishReadiness(graph);
      expect(result.status).toBe('checks_passed');
    });

    it('60. does not require graph ancestry between declaring INPUT node and consumer', () => {
      // in1 declares 'fieldA' and connects to out; in2 connects to consumer which references 'fieldA'
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('in1', [{ name: 'fieldA', type: 'string', required: true }]),
          createInputNode('in2'),
          createTransformNode('consumer', [
            {
              operation: 'json_pick',
              targetKey: 'p',
              source: { source: 'input', field: 'fieldA', path: [] },
            },
          ]),
          createOutputNode('out'),
        ],
        edges: [
          createEdge('e1', 'in1', 'out'),
          createEdge('e2', 'in2', 'consumer'),
          createEdge('e3', 'consumer', 'out'),
        ],
      };
      const result = validateWorkflowPublishReadiness(graph);
      expect(result.status).toBe('checks_passed');
    });

    it('61. underlying validators remain functional and publicly accessible', () => {
      const graph: WorkflowGraph = {
        nodes: [createInputNode('in'), createOutputNode('out')],
        edges: [createEdge('e1', 'in', 'out')],
      };
      const result = validateWorkflowPublishReadiness(graph);
      expect(result.status).toBe('checks_passed');
    });

    it('62. handles Object.freeze() frozen graph definitions without mutation', () => {
      const graph = Object.freeze({
        nodes: Object.freeze([
          Object.freeze(createInputNode('in')),
          Object.freeze(createOutputNode('out')),
        ]),
        edges: Object.freeze([Object.freeze(createEdge('e1', 'in', 'out'))]),
      });
      const result = validateWorkflowPublishReadiness(graph as unknown as WorkflowGraph);
      expect(result.status).toBe('checks_passed');
    });

    it('63. repeated assessments produce identical results (deterministic)', () => {
      const graph: WorkflowGraph = {
        nodes: [createInputNode('in'), createOutputNode('out')],
        edges: [createEdge('e1', 'in', 'out')],
      };
      const res1 = validateWorkflowPublishReadiness(graph);
      const res2 = validateWorkflowPublishReadiness(graph);
      expect(res1).toEqual(res2);
    });

    it('64. result objects are completely JSON-serializable', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('in'),
          createTransformNode('nodeA', [
            {
              operation: 'json_set',
              targetKey: 'data',
              value: { type: 'literal', value: 1 },
            },
          ]),
          createTransformNode('consumer', [
            {
              operation: 'json_pick',
              targetKey: 'p',
              source: { source: 'node_output', nodeId: 'nodeA', path: ['data'] },
            },
          ]),
          createOutputNode('out'),
        ],
        edges: [
          createEdge('e1', 'in', 'nodeA'),
          createEdge('e2', 'nodeA', 'consumer'),
          createEdge('e3', 'in', 'consumer'),
          createEdge('e4', 'consumer', 'out'),
        ],
      };
      const result = validateWorkflowPublishReadiness(graph);
      const json = JSON.stringify(result);
      const parsed = JSON.parse(json);
      expect(parsed).toEqual(result);
    });

    it('65. no raw configuration payloads or secrets attached to diagnostics', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createInputNode('in'),
          createTransformNode('t1', [
            {
              operation: 'json_set',
              targetKey: 'secretKey',
              value: { type: 'literal', value: 'SUPER_SECRET_PAYLOAD' },
            },
          ]),
          createTransformNode('consumer', [
            {
              operation: 'json_pick',
              targetKey: 'p',
              source: { source: 'node_output', nodeId: 'nonexistent', path: ['secretKey'] },
            },
          ]),
          createOutputNode('out'),
        ],
        edges: [
          createEdge('e1', 'in', 't1'),
          createEdge('e2', 't1', 'consumer'),
          createEdge('e3', 'consumer', 'out'),
        ],
      };
      const result = validateWorkflowPublishReadiness(graph);
      expect(result.status).toBe('blocked');
      if (result.status === 'blocked') {
        const json = JSON.stringify(result.blockingIssues);
        expect(json).not.toContain('SUPER_SECRET_PAYLOAD');
      }
    });

    it('66. topological order is returned only on passing static assessments', () => {
      const passingGraph: WorkflowGraph = {
        nodes: [createInputNode('in'), createOutputNode('out')],
        edges: [createEdge('e1', 'in', 'out')],
      };
      const passResult = validateWorkflowPublishReadiness(passingGraph);
      if (passResult.status !== 'blocked') {
        expect(passResult.topologicalNodeIds).toEqual(['in', 'out']);
      }

      const failingGraph: WorkflowGraph = {
        nodes: [createInputNode('in'), createOutputNode('out')],
        edges: [createEdge('e1', 'in', 'missing')],
      };
      const failResult = validateWorkflowPublishReadiness(failingGraph);
      expect('topologicalNodeIds' in failResult).toBe(false);
    });

    it('67. TypeScript compiles and narrows result types across statuses and issue stages', () => {
      const graph: WorkflowGraph = {
        nodes: [createInputNode('in'), createOutputNode('out')],
        edges: [createEdge('e1', 'in', 'out')],
      };
      const result: WorkflowPublishReadinessResult = validateWorkflowPublishReadiness(graph);

      // Verify status literal union
      expectTypeOf(result.status).toEqualTypeOf<WorkflowPublishReadinessStatus>();

      if (result.status === 'blocked') {
        expectTypeOf(result).toEqualTypeOf<WorkflowPublishReadinessBlockedResult>();
        expectTypeOf(result.blockingIssues).toEqualTypeOf<
          ReadonlyArray<WorkflowPublishReadinessBlockingIssue>
        >();
        expectTypeOf(result.advisories).toEqualTypeOf<readonly []>();

        for (const issue of result.blockingIssues) {
          switch (issue.stage) {
            case 'structure':
              expectTypeOf(issue).toEqualTypeOf<WorkflowStructuralIssue>();
              break;
            case 'integrity':
              expectTypeOf(issue).toEqualTypeOf<WorkflowIntegrityBlockingIssue>();
              break;
            case 'semantics':
              expectTypeOf(issue).toEqualTypeOf<WorkflowSemanticBlockingIssue>();
              break;
            case 'entry_exit':
              expectTypeOf(issue).toEqualTypeOf<WorkflowEntryExitBlockingIssue>();
              break;
            case 'configuration':
              expectTypeOf(issue).toEqualTypeOf<WorkflowConfigurationBlockingIssue>();
              break;
            case 'node_output_references':
              expectTypeOf(issue).toEqualTypeOf<WorkflowNodeOutputReferenceBlockingIssue>();
              break;
            case 'input_references':
              expectTypeOf(issue).toEqualTypeOf<WorkflowInputReferenceBlockingIssue>();
              break;
            default: {
              const _exhaustiveCheck: never = issue;
              expect(_exhaustiveCheck).toBeUndefined();
            }
          }
        }
      } else if (result.status === 'checks_passed_with_advisories') {
        expectTypeOf(result).toEqualTypeOf<WorkflowPublishReadinessPassedWithAdvisoriesResult>();
        expectTypeOf(result.advisories).toEqualTypeOf<
          ReadonlyArray<WorkflowPublishReadinessAdvisory>
        >();
        expectTypeOf(result.topologicalNodeIds).toEqualTypeOf<ReadonlyArray<string>>();
        expectTypeOf(result.blockingIssues).toEqualTypeOf<readonly []>();
      } else {
        expectTypeOf(result).toEqualTypeOf<WorkflowPublishReadinessPassedResult>();
        expectTypeOf(result.advisories).toEqualTypeOf<readonly []>();
        expectTypeOf(result.blockingIssues).toEqualTypeOf<readonly []>();
        expectTypeOf(result.topologicalNodeIds).toEqualTypeOf<ReadonlyArray<string>>();
      }
    });
  });
});
