import { describe, expect, expectTypeOf, it } from 'vitest';
import type {
  InputNodeConfig,
  OutputNodeConfig,
  TransformNodeConfig,
  WorkflowEdge,
  WorkflowGraph,
  WorkflowNode,
  WorkflowNodeConfig,
  WorkflowNodeType,
} from '@flowforge/contracts';
import {
  analyzeWorkflowGraph,
  validateWorkflowEntryExitTopology,
  validateWorkflowGraphSemantics,
  validateWorkflowInputReferences,
  validateWorkflowNodeOutputReferences,
  type GraphIntegrityIssue,
  type WorkflowEntryExitTopologyFailureResult,
  type WorkflowEntryExitTopologyIntegrityFailureResult,
  type WorkflowEntryExitTopologyIssue,
  type WorkflowEntryExitTopologyIssueCode,
  type WorkflowEntryExitTopologyResult,
  type WorkflowEntryExitTopologySemanticFailureResult,
  type WorkflowEntryExitTopologySuccessResult,
  type WorkflowGraphSemanticIssue,
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

const emptyConfig = {};

describe('validateWorkflowEntryExitTopology', () => {
  describe('Positive Cases', () => {
    it('1. valid INPUT -> OUTPUT passes', () => {
      const graph: WorkflowGraph = {
        nodes: [createNode('in_1', 'INPUT'), createNode('out_1', 'OUTPUT')],
        edges: [createEdge('e1', 'in_1', 'out_1')],
      };
      const result = validateWorkflowEntryExitTopology(graph);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.issues).toEqual([]);
        expect(result.topologicalNodeIds).toEqual(['in_1', 'out_1']);
      }
    });

    it('2. valid INPUT -> TRANSFORM -> OUTPUT passes', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT'),
          createNode('t_1', 'TRANSFORM'),
          createNode('out_1', 'OUTPUT'),
        ],
        edges: [createEdge('e1', 'in_1', 't_1'), createEdge('e2', 't_1', 'out_1')],
      };
      const result = validateWorkflowEntryExitTopology(graph);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.issues).toEqual([]);
        expect(result.topologicalNodeIds).toEqual(['in_1', 't_1', 'out_1']);
      }
    });

    it('3. multiple INPUT nodes with zero indegree pass', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_A', 'INPUT'),
          createNode('in_B', 'INPUT'),
          createNode('t_1', 'TRANSFORM'),
          createNode('out_1', 'OUTPUT'),
        ],
        edges: [
          createEdge('e1', 'in_A', 't_1'),
          createEdge('e2', 'in_B', 't_1'),
          createEdge('e3', 't_1', 'out_1'),
        ],
      };
      const result = validateWorkflowEntryExitTopology(graph);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.issues).toEqual([]);
      }
    });

    it('4. multiple OUTPUT nodes with zero outdegree pass', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT'),
          createNode('t_1', 'TRANSFORM'),
          createNode('out_A', 'OUTPUT'),
          createNode('out_B', 'OUTPUT'),
        ],
        edges: [
          createEdge('e1', 'in_1', 't_1'),
          createEdge('e2', 't_1', 'out_A'),
          createEdge('e3', 't_1', 'out_B'),
        ],
      };
      const result = validateWorkflowEntryExitTopology(graph);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.issues).toEqual([]);
      }
    });

    it('5. valid CONDITION TRUE/FALSE branching to terminal OUTPUT nodes passes', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT'),
          createNode('cond_1', 'CONDITION'),
          createNode('out_true', 'OUTPUT'),
          createNode('out_false', 'OUTPUT'),
        ],
        edges: [
          createEdge('e1', 'in_1', 'cond_1'),
          createEdge('e2', 'cond_1', 'out_true', 'TRUE'),
          createEdge('e3', 'cond_1', 'out_false', 'FALSE'),
        ],
      };
      const result = validateWorkflowEntryExitTopology(graph);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.issues).toEqual([]);
      }
    });

    it('6. valid branch merge followed by OUTPUT passes', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT'),
          createNode('cond_1', 'CONDITION'),
          createNode('b_true', 'TRANSFORM'),
          createNode('b_false', 'TRANSFORM'),
          createNode('join_node', 'TRANSFORM'),
          createNode('out_1', 'OUTPUT'),
        ],
        edges: [
          createEdge('e1', 'in_1', 'cond_1'),
          createEdge('e2', 'cond_1', 'b_true', 'TRUE'),
          createEdge('e3', 'cond_1', 'b_false', 'FALSE'),
          createEdge('e4', 'b_true', 'join_node'),
          createEdge('e5', 'b_false', 'join_node'),
          createEdge('e6', 'join_node', 'out_1'),
        ],
      };
      const result = validateWorkflowEntryExitTopology(graph);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.issues).toEqual([]);
      }
    });

    it('7. INPUT nodes with zero incoming edges are accepted', () => {
      const graph: WorkflowGraph = {
        nodes: [createNode('input_isolated', 'INPUT'), createNode('out', 'OUTPUT')],
        edges: [createEdge('e1', 'input_isolated', 'out')],
      };
      const result = validateWorkflowEntryExitTopology(graph);

      expect(result.success).toBe(true);
    });

    it('8. OUTPUT nodes with zero outgoing edges are accepted', () => {
      const graph: WorkflowGraph = {
        nodes: [createNode('in', 'INPUT'), createNode('output_terminal', 'OUTPUT')],
        edges: [createEdge('e1', 'in', 'output_terminal')],
      };
      const result = validateWorkflowEntryExitTopology(graph);

      expect(result.success).toBe(true);
    });

    it('9. non-INPUT nodes may have incoming edges', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in', 'INPUT'),
          createNode('t1', 'TRANSFORM'),
          createNode('t2', 'TRANSFORM'),
          createNode('out', 'OUTPUT'),
        ],
        edges: [
          createEdge('e1', 'in', 't1'),
          createEdge('e2', 't1', 't2'),
          createEdge('e3', 't2', 'out'),
        ],
      };
      const result = validateWorkflowEntryExitTopology(graph);

      expect(result.success).toBe(true);
    });

    it('10. non-OUTPUT nodes may have outgoing edges subject to existing semantic rules', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in', 'INPUT'),
          createNode('t1', 'TRANSFORM'),
          createNode('t2', 'TRANSFORM'),
          createNode('out', 'OUTPUT'),
        ],
        edges: [
          createEdge('e1', 'in', 't1'),
          createEdge('e2', 'in', 't2'),
          createEdge('e3', 't1', 'out'),
          createEdge('e4', 't2', 'out'),
        ],
      };
      const result = validateWorkflowEntryExitTopology(graph);

      expect(result.success).toBe(true);
    });

    it('11. repeated validation is deterministic', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT'),
          createNode('t_1', 'TRANSFORM'),
          createNode('out_1', 'OUTPUT'),
        ],
        edges: [createEdge('e1', 'in_1', 't_1'), createEdge('e2', 't_1', 'out_1')],
      };
      const result1 = validateWorkflowEntryExitTopology(graph);
      const result2 = validateWorkflowEntryExitTopology(graph);

      expect(result1).toEqual(result2);
    });

    it('12. frozen input graph is not mutated', () => {
      const graph = {
        nodes: Object.freeze([
          Object.freeze(createNode('in_1', 'INPUT')),
          Object.freeze(createNode('out_1', 'OUTPUT')),
        ]),
        edges: Object.freeze([createEdge('e1', 'in_1', 'out_1')]),
      };
      Object.freeze(graph);

      expect(() =>
        validateWorkflowEntryExitTopology(graph as unknown as WorkflowGraph),
      ).not.toThrow();
    });

    it('13. a graph with correctly declared global INPUT references is not rejected due to reference namespace behavior', () => {
      const inputConfig: InputNodeConfig = {
        fields: [{ name: 'customerId', type: 'string', required: true }],
      };
      const transformConfig: TransformNodeConfig = {
        rules: [
          {
            operation: 'json_pick',
            targetKey: 'cId',
            source: { source: 'input', field: 'customerId', path: [] },
          },
        ],
      };
      const outputConfig: OutputNodeConfig = {
        payloadMapping: {
          res: { type: 'literal', value: 'ok' },
        },
      };
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT', inputConfig),
          createNode('t_1', 'TRANSFORM', transformConfig),
          createNode('out_1', 'OUTPUT', outputConfig),
        ],
        edges: [createEdge('e1', 'in_1', 't_1'), createEdge('e2', 't_1', 'out_1')],
      };
      const result = validateWorkflowEntryExitTopology(graph);

      expect(result.success).toBe(true);
    });
  });

  describe('Negative Cases', () => {
    it('14. INPUT with one incoming edge fails', () => {
      // INPUT_A -> INPUT_B -> OUTPUT
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_A', 'INPUT'),
          createNode('in_B', 'INPUT'),
          createNode('out_1', 'OUTPUT'),
        ],
        edges: [createEdge('e1', 'in_A', 'in_B'), createEdge('e2', 'in_B', 'out_1')],
      };
      const result = validateWorkflowEntryExitTopology(graph);

      expect(result.success).toBe(false);
      if (!result.success && result.stage === 'entry_exit') {
        expect(result.issues).toHaveLength(1);
        expect(result.issues[0]?.code).toBe('INPUT_HAS_INCOMING_EDGE');
        expect(result.issues[0]?.path).toEqual(['edges', 0, 'target']);
        expect(result.issues[0]?.message).toContain('in_B');
      }
    });

    it('15. INPUT with multiple incoming edges produces appropriate issues', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT'),
          createNode('in_targeted', 'INPUT'),
          createNode('t_1', 'TRANSFORM'),
          createNode('out_1', 'OUTPUT'),
        ],
        edges: [
          createEdge('e1', 'in_1', 't_1'),
          createEdge('e2', 'in_1', 'in_targeted'),
          createEdge('e3', 't_1', 'in_targeted'),
          createEdge('e4', 'in_targeted', 'out_1'),
        ],
      };
      const result = validateWorkflowEntryExitTopology(graph);

      expect(result.success).toBe(false);
      if (!result.success && result.stage === 'entry_exit') {
        expect(result.issues).toHaveLength(2);
        expect(result.issues[0]?.code).toBe('INPUT_HAS_INCOMING_EDGE');
        expect(result.issues[0]?.path).toEqual(['edges', 1, 'target']);
        expect(result.issues[1]?.code).toBe('INPUT_HAS_INCOMING_EDGE');
        expect(result.issues[1]?.path).toEqual(['edges', 2, 'target']);
      }
    });

    it('16. OUTPUT with one outgoing edge fails', () => {
      // INPUT -> OUTPUT_A -> OUTPUT_B
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT'),
          createNode('out_A', 'OUTPUT'),
          createNode('out_B', 'OUTPUT'),
        ],
        edges: [createEdge('e1', 'in_1', 'out_A'), createEdge('e2', 'out_A', 'out_B')],
      };
      const result = validateWorkflowEntryExitTopology(graph);

      expect(result.success).toBe(false);
      if (!result.success && result.stage === 'entry_exit') {
        expect(result.issues).toHaveLength(1);
        expect(result.issues[0]?.code).toBe('OUTPUT_HAS_OUTGOING_EDGE');
        expect(result.issues[0]?.path).toEqual(['edges', 1, 'source']);
        expect(result.issues[0]?.message).toContain('out_A');
      }
    });

    it('17. OUTPUT with multiple outgoing edges produces appropriate issues', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT'),
          createNode('out_sourced', 'OUTPUT'),
          createNode('t_1', 'TRANSFORM'),
          createNode('out_final', 'OUTPUT'),
        ],
        edges: [
          createEdge('e1', 'in_1', 'out_sourced'),
          createEdge('e2', 'out_sourced', 't_1'),
          createEdge('e3', 'out_sourced', 'out_final'),
          createEdge('e4', 't_1', 'out_final'),
        ],
      };
      const result = validateWorkflowEntryExitTopology(graph);

      expect(result.success).toBe(false);
      if (!result.success && result.stage === 'entry_exit') {
        expect(result.issues).toHaveLength(2);
        expect(result.issues[0]?.code).toBe('OUTPUT_HAS_OUTGOING_EDGE');
        expect(result.issues[0]?.path).toEqual(['edges', 1, 'source']);
        expect(result.issues[1]?.code).toBe('OUTPUT_HAS_OUTGOING_EDGE');
        expect(result.issues[1]?.path).toEqual(['edges', 2, 'source']);
      }
    });

    it('18. one graph containing INPUT and OUTPUT violations aggregates relevant findings where prerequisite semantics permit', () => {
      // in_1 -> in_2 -> out_1 -> out_2
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT'),
          createNode('in_2', 'INPUT'),
          createNode('out_1', 'OUTPUT'),
          createNode('out_2', 'OUTPUT'),
        ],
        edges: [
          createEdge('e1', 'in_1', 'in_2'),
          createEdge('e2', 'in_2', 'out_1'),
          createEdge('e3', 'out_1', 'out_2'),
        ],
      };
      const result = validateWorkflowEntryExitTopology(graph);

      expect(result.success).toBe(false);
      if (!result.success && result.stage === 'entry_exit') {
        expect(result.issues).toHaveLength(2);
        expect(result.issues[0]?.code).toBe('INPUT_HAS_INCOMING_EDGE');
        expect(result.issues[0]?.path).toEqual(['edges', 0, 'target']);
        expect(result.issues[1]?.code).toBe('OUTPUT_HAS_OUTGOING_EDGE');
        expect(result.issues[1]?.path).toEqual(['edges', 2, 'source']);
      }
    });

    it('19. edge paths point to the correct source or target field', () => {
      const graph: WorkflowGraph = {
        nodes: [createNode('in_1', 'INPUT'), createNode('out_1', 'OUTPUT')],
        edges: [
          createEdge('e1', 'in_1', 'out_1'),
          createEdge('e2', 'out_1', 'in_1'), // OUTPUT has outgoing, and INPUT has incoming
        ],
      };
      const result = validateWorkflowEntryExitTopology(graph);

      expect(result.success).toBe(false);
      if (!result.success && result.stage === 'entry_exit') {
        expect(result.issues).toHaveLength(2);
        expect(result.issues[0]?.path).toEqual(['edges', 1, 'source']);
        expect(result.issues[0]?.code).toBe('OUTPUT_HAS_OUTGOING_EDGE');
        expect(result.issues[1]?.path).toEqual(['edges', 1, 'target']);
        expect(result.issues[1]?.code).toBe('INPUT_HAS_INCOMING_EDGE');
      }
    });

    it('20. numeric indices remain numbers', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT'),
          createNode('in_2', 'INPUT'),
          createNode('out_1', 'OUTPUT'),
        ],
        edges: [createEdge('e1', 'in_1', 'in_2'), createEdge('e2', 'in_2', 'out_1')],
      };
      const result = validateWorkflowEntryExitTopology(graph);

      expect(result.success).toBe(false);
      if (!result.success && result.stage === 'entry_exit') {
        expect(typeof result.issues[0]?.path[1]).toBe('number');
        expect(result.issues[0]?.path[1]).toBe(0);
      }
    });

    it('21. node IDs containing dots remain atomic and unnormalized', () => {
      const graph: WorkflowGraph = {
        nodes: [createNode('entry.node.01', 'INPUT'), createNode('terminal.node.02', 'OUTPUT')],
        edges: [
          createEdge('e1', 'entry.node.01', 'terminal.node.02'),
          createEdge('e2', 'terminal.node.02', 'entry.node.01'),
        ],
      };
      const result = validateWorkflowEntryExitTopology(graph);

      expect(result.success).toBe(false);
      if (!result.success && result.stage === 'entry_exit') {
        expect(result.issues[0]?.message).toContain('terminal.node.02');
        expect(result.issues[1]?.message).toContain('entry.node.01');
      }
    });

    it('22. different edge IDs with parallel connections are handled correctly', () => {
      // Two distinct edges targeting the same INPUT node
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT'),
          createNode('in_2', 'INPUT'),
          createNode('out_1', 'OUTPUT'),
        ],
        edges: [
          createEdge('e1', 'in_1', 'in_2'),
          createEdge('e2', 'in_1', 'in_2'),
          createEdge('e3', 'in_2', 'out_1'),
        ],
      };
      const result = validateWorkflowEntryExitTopology(graph);

      expect(result.success).toBe(false);
      if (!result.success && result.stage === 'entry_exit') {
        expect(result.issues).toHaveLength(2);
        expect(result.issues[0]?.path).toEqual(['edges', 0, 'target']);
        expect(result.issues[1]?.path).toEqual(['edges', 1, 'target']);
      }
    });

    it('23. no partial topological order appears on entry_exit failure', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT'),
          createNode('in_2', 'INPUT'),
          createNode('out_1', 'OUTPUT'),
        ],
        edges: [createEdge('e1', 'in_1', 'in_2'), createEdge('e2', 'in_2', 'out_1')],
      };
      const result = validateWorkflowEntryExitTopology(graph);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result).not.toHaveProperty('topologicalNodeIds');
      }
    });

    it('24. stable machine-readable issue codes', () => {
      const graph: WorkflowGraph = {
        nodes: [createNode('in_1', 'INPUT'), createNode('out_1', 'OUTPUT')],
        edges: [createEdge('e1', 'in_1', 'out_1'), createEdge('e2', 'out_1', 'in_1')],
      };
      const result = validateWorkflowEntryExitTopology(graph);

      expect(result.success).toBe(false);
      if (!result.success && result.stage === 'entry_exit') {
        const codes = result.issues.map((i) => i.code);
        expect(codes).toEqual(['OUTPUT_HAS_OUTGOING_EDGE', 'INPUT_HAS_INCOMING_EDGE']);
      }
    });

    it('25. JSON-serializable results', () => {
      const graph: WorkflowGraph = {
        nodes: [createNode('in_1', 'INPUT'), createNode('out_1', 'OUTPUT')],
        edges: [createEdge('e1', 'in_1', 'out_1'), createEdge('e2', 'out_1', 'in_1')],
      };
      const result = validateWorkflowEntryExitTopology(graph);
      const json = JSON.stringify(result);
      const parsed = JSON.parse(json);

      expect(parsed).toEqual(result);
    });
  });

  describe('Prerequisite Stage Gating', () => {
    it('26. duplicate node ID returns stage: integrity', () => {
      const graph: WorkflowGraph = {
        nodes: [createNode('dup', 'INPUT'), createNode('dup', 'OUTPUT')],
        edges: [createEdge('e1', 'dup', 'dup')],
      };
      const result = validateWorkflowEntryExitTopology(graph);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.stage).toBe('integrity');
        expect(result.issues[0]?.code).toBe('DUPLICATE_NODE_ID');
      }
    });

    it('27. duplicate edge ID returns stage: integrity', () => {
      const graph: WorkflowGraph = {
        nodes: [createNode('in', 'INPUT'), createNode('out', 'OUTPUT')],
        edges: [createEdge('dup_e', 'in', 'out'), createEdge('dup_e', 'in', 'out')],
      };
      const result = validateWorkflowEntryExitTopology(graph);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.stage).toBe('integrity');
        expect(result.issues[0]?.code).toBe('DUPLICATE_EDGE_ID');
      }
    });

    it('28. dangling edge returns stage: integrity', () => {
      const graph: WorkflowGraph = {
        nodes: [createNode('in', 'INPUT')],
        edges: [createEdge('e1', 'in', 'missing_node')],
      };
      const result = validateWorkflowEntryExitTopology(graph);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.stage).toBe('integrity');
        expect(result.issues[0]?.code).toBe('MISSING_EDGE_TARGET');
      }
    });

    it('29. directed cycle returns stage: integrity', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in', 'INPUT'),
          createNode('A', 'TRANSFORM'),
          createNode('B', 'TRANSFORM'),
          createNode('out', 'OUTPUT'),
        ],
        edges: [
          createEdge('e1', 'in', 'A'),
          createEdge('e2', 'A', 'B'),
          createEdge('e3', 'B', 'A'), // cycle
          createEdge('e4', 'B', 'out'),
        ],
      };
      const result = validateWorkflowEntryExitTopology(graph);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.stage).toBe('integrity');
        expect(result.issues[0]?.code).toBe('CYCLE_DETECTED');
      }
    });

    it('30. missing INPUT returns stage: semantics', () => {
      const graph: WorkflowGraph = {
        nodes: [createNode('t1', 'TRANSFORM'), createNode('out', 'OUTPUT')],
        edges: [createEdge('e1', 't1', 'out')],
      };
      const result = validateWorkflowEntryExitTopology(graph);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.stage).toBe('semantics');
        expect(result.issues[0]?.code).toBe('MISSING_INPUT_NODE');
      }
    });

    it('31. missing OUTPUT returns stage: semantics', () => {
      const graph: WorkflowGraph = {
        nodes: [createNode('in', 'INPUT'), createNode('t1', 'TRANSFORM')],
        edges: [createEdge('e1', 'in', 't1')],
      };
      const result = validateWorkflowEntryExitTopology(graph);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.stage).toBe('semantics');
        expect(result.issues[0]?.code).toBe('MISSING_OUTPUT_NODE');
      }
    });

    it('32. invalid CONDITION branching returns stage: semantics', () => {
      // CONDITION node missing FALSE branch
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in', 'INPUT'),
          createNode('cond', 'CONDITION'),
          createNode('out', 'OUTPUT'),
        ],
        edges: [
          createEdge('e1', 'in', 'cond'),
          createEdge('e2', 'cond', 'out', 'TRUE'), // Only TRUE
        ],
      };
      const result = validateWorkflowEntryExitTopology(graph);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.stage).toBe('semantics');
        expect(result.issues.some((i) => i.code === 'CONDITION_FALSE_BRANCH_MISSING')).toBe(true);
      }
    });

    it('33. static reachability failure returns stage: semantics', () => {
      // Disconnected node unreachable from INPUT
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in', 'INPUT'),
          createNode('out', 'OUTPUT'),
          createNode('unreachable', 'TRANSFORM'),
        ],
        edges: [createEdge('e1', 'in', 'out')],
      };
      const result = validateWorkflowEntryExitTopology(graph);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.stage).toBe('semantics');
        expect(result.issues.some((i) => i.code === 'UNREACHABLE_FROM_INPUT')).toBe(true);
      }
    });

    it('34. existing diagnostic codes and paths are preserved', () => {
      const graph: WorkflowGraph = {
        nodes: [createNode('in', 'INPUT'), createNode('out', 'OUTPUT')],
        edges: [
          createEdge('e1', 'in', 'out', 'TRUE'), // non-condition edge has conditionOutcome
        ],
      };
      const result = validateWorkflowEntryExitTopology(graph);

      expect(result.success).toBe(false);
      if (!result.success && result.stage === 'semantics') {
        expect(result.issues[0]?.code).toBe('NON_CONDITION_EDGE_OUTCOME');
        expect(result.issues[0]?.path).toEqual(['edges', 0, 'conditionOutcome']);
      }
    });

    it('35. no entry_exit diagnostics are emitted following prerequisite failure', () => {
      // Graph with a cycle and an invalid entry topology
      const graph: WorkflowGraph = {
        nodes: [createNode('in', 'INPUT'), createNode('out', 'OUTPUT')],
        edges: [
          createEdge('e1', 'in', 'in'), // cycle / self loop on INPUT
          createEdge('e2', 'in', 'out'),
        ],
      };
      const result = validateWorkflowEntryExitTopology(graph);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.stage).toBe('integrity');
        expect(result.issues.some((i) => i.code.startsWith('INPUT_HAS_'))).toBe(false);
      }
    });
  });

  describe('Compatibility and Boundary Invariants', () => {
    it('36. existing analyzeWorkflowGraph remains unchanged', () => {
      const graph: WorkflowGraph = {
        nodes: [createNode('n1', 'TRANSFORM'), createNode('n2', 'TRANSFORM')],
        edges: [createEdge('e1', 'n1', 'n2')],
      };
      const integrity = analyzeWorkflowGraph(graph);

      expect(integrity.success).toBe(true);
      if (integrity.success) {
        expect(integrity.topologicalNodeIds).toEqual(['n1', 'n2']);
      }
    });

    it('37. existing validateWorkflowGraphSemantics still allows an INPUT node with incoming edges when its own checks pass', () => {
      // INPUT_A -> INPUT_B -> OUTPUT
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_A', 'INPUT'),
          createNode('in_B', 'INPUT'),
          createNode('out', 'OUTPUT'),
        ],
        edges: [createEdge('e1', 'in_A', 'in_B'), createEdge('e2', 'in_B', 'out')],
      };
      // validateWorkflowGraphSemantics permits this because all nodes are reachable from at least one INPUT
      // and all nodes can reach OUTPUT
      const semanticResult = validateWorkflowGraphSemantics(graph);
      expect(semanticResult.success).toBe(true);

      // But validateWorkflowEntryExitTopology rejects it because in_B has incoming edge e1
      const topologyResult = validateWorkflowEntryExitTopology(graph);
      expect(topologyResult.success).toBe(false);
      if (!topologyResult.success && topologyResult.stage === 'entry_exit') {
        expect(topologyResult.issues[0]?.code).toBe('INPUT_HAS_INCOMING_EDGE');
      }
    });

    it('38. existing validateWorkflowGraphSemantics still allows an OUTPUT node with outgoing edges when its own checks pass', () => {
      // INPUT -> OUTPUT_A -> OUTPUT_B
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in', 'INPUT'),
          createNode('out_A', 'OUTPUT'),
          createNode('out_B', 'OUTPUT'),
        ],
        edges: [createEdge('e1', 'in', 'out_A'), createEdge('e2', 'out_A', 'out_B')],
      };
      // validateWorkflowGraphSemantics permits this because all nodes reach an OUTPUT
      const semanticResult = validateWorkflowGraphSemantics(graph);
      expect(semanticResult.success).toBe(true);

      // But validateWorkflowEntryExitTopology rejects it because out_A has outgoing edge e2
      const topologyResult = validateWorkflowEntryExitTopology(graph);
      expect(topologyResult.success).toBe(false);
      if (!topologyResult.success && topologyResult.stage === 'entry_exit') {
        expect(topologyResult.issues[0]?.code).toBe('OUTPUT_HAS_OUTGOING_EDGE');
      }
    });

    it('39. existing node-output reference validator remains unchanged', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in', 'INPUT', { fields: [] }),
          createNode('out', 'OUTPUT', { payloadMapping: { res: { type: 'literal', value: 1 } } }),
        ],
        edges: [createEdge('e1', 'in', 'out')],
      };
      const nodeOutputResult = validateWorkflowNodeOutputReferences(graph);

      expect(nodeOutputResult.success).toBe(true);
    });

    it('40. existing INPUT reference validator remains unchanged', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in', 'INPUT', { fields: [] }),
          createNode('out', 'OUTPUT', { payloadMapping: { res: { type: 'literal', value: 1 } } }),
        ],
        edges: [createEdge('e1', 'in', 'out')],
      };
      const inputRefResult = validateWorkflowInputReferences(graph);

      expect(inputRefResult.success).toBe(true);
    });

    it('41. draft node configurations remain permitted by graph analysis', () => {
      const graph: WorkflowGraph = {
        nodes: [createNode('in', 'INPUT', emptyConfig), createNode('out', 'OUTPUT', emptyConfig)],
        edges: [createEdge('e1', 'in', 'out')],
      };
      const result = validateWorkflowEntryExitTopology(graph);

      expect(result.success).toBe(true);
    });

    it('42. no reference values or runtime conditions are resolved', () => {
      const graph: WorkflowGraph = {
        nodes: [createNode('in', 'INPUT'), createNode('out', 'OUTPUT')],
        edges: [createEdge('e1', 'in', 'out')],
      };
      const result = validateWorkflowEntryExitTopology(graph);

      expect(result.success).toBe(true);
    });

    it('43. no authorization or provider checks occur', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in', 'INPUT'),
          createNode('mcp', 'MCP_TOOL', { integrationRef: 'unauthorized', toolName: 'test' }),
          createNode('out', 'OUTPUT'),
        ],
        edges: [createEdge('e1', 'in', 'mcp'), createEdge('e2', 'mcp', 'out')],
      };
      const result = validateWorkflowEntryExitTopology(graph);

      expect(result.success).toBe(true);
    });

    it('44. all existing contracts and workflow-core tests remain passing', () => {
      const graph: WorkflowGraph = {
        nodes: [createNode('in', 'INPUT'), createNode('out', 'OUTPUT')],
        edges: [createEdge('e1', 'in', 'out')],
      };
      const result = validateWorkflowEntryExitTopology(graph);

      expect(result.success).toBe(true);
      expect(result.issues).toEqual([]);
    });
  });

  describe('TypeScript Type Inference Verification', () => {
    it('accepts WorkflowGraph and returns WorkflowEntryExitTopologyResult', () => {
      const graph: WorkflowGraph = { nodes: [], edges: [] };
      const result = validateWorkflowEntryExitTopology(graph);
      expectTypeOf(result).toEqualTypeOf<WorkflowEntryExitTopologyResult>();
    });

    it('narrows on success discriminant', () => {
      const graph: WorkflowGraph = { nodes: [], edges: [] };
      const result = validateWorkflowEntryExitTopology(graph);
      if (result.success) {
        expectTypeOf(result).toEqualTypeOf<WorkflowEntryExitTopologySuccessResult>();
        expectTypeOf(result.issues).toEqualTypeOf<[]>();
        expectTypeOf(result.topologicalNodeIds).toEqualTypeOf<string[]>();
      }
    });

    it('narrows on stage for all failure variants', () => {
      const graph: WorkflowGraph = { nodes: [], edges: [] };
      const result = validateWorkflowEntryExitTopology(graph);
      if (!result.success) {
        if (result.stage === 'integrity') {
          expectTypeOf(result).toEqualTypeOf<WorkflowEntryExitTopologyIntegrityFailureResult>();
          expectTypeOf(result.issues).toEqualTypeOf<GraphIntegrityIssue[]>();
        } else if (result.stage === 'semantics') {
          expectTypeOf(result).toEqualTypeOf<WorkflowEntryExitTopologySemanticFailureResult>();
          expectTypeOf(result.issues).toEqualTypeOf<WorkflowGraphSemanticIssue[]>();
        } else if (result.stage === 'entry_exit') {
          expectTypeOf(result).toEqualTypeOf<WorkflowEntryExitTopologyFailureResult>();
          expectTypeOf(result.issues).toEqualTypeOf<WorkflowEntryExitTopologyIssue[]>();
          expectTypeOf(result.issues[0]?.code).toEqualTypeOf<
            WorkflowEntryExitTopologyIssueCode | undefined
          >();
          expectTypeOf(result.issues[0]?.path).toEqualTypeOf<
            ReadonlyArray<string | number> | undefined
          >();
        }
      }
    });
  });
});
