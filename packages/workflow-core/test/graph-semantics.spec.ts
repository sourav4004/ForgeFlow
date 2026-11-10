import { describe, expect, it } from 'vitest';
import type {
  WorkflowEdge,
  WorkflowGraph,
  WorkflowNode,
  WorkflowNodeConfig,
  WorkflowNodeType,
} from '@flowforge/contracts';
import {
  analyzeWorkflowGraph,
  validateWorkflowGraphSemantics,
  type GraphIntegrityIssue,
  type WorkflowGraphSemanticIssue,
  type WorkflowGraphSemanticIssueCode,
  type WorkflowGraphSemanticsIntegrityFailureResult,
  type WorkflowGraphSemanticsResult,
  type WorkflowGraphSemanticsSemanticFailureResult,
  type WorkflowGraphSemanticsSuccessResult,
} from '../src/index.js';

function createNode(
  id: string,
  type: WorkflowNodeType = 'TRANSFORM',
  config: WorkflowNodeConfig = {},
): WorkflowNode {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    config,
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
    ...(conditionOutcome ? { conditionOutcome } : {}),
  };
}

describe('validateWorkflowGraphSemantics', () => {
  describe('Positive Cases', () => {
    it('1. valid simple INPUT -> OUTPUT graph succeeds', () => {
      const graph: WorkflowGraph = {
        nodes: [createNode('in_1', 'INPUT'), createNode('out_1', 'OUTPUT')],
        edges: [createEdge('e1', 'in_1', 'out_1')],
      };
      const result = validateWorkflowGraphSemantics(graph);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.issues).toEqual([]);
        expect(result.topologicalNodeIds).toEqual(['in_1', 'out_1']);
      }
    });

    it('2. valid CONDITION with exactly one TRUE and one FALSE outgoing edge succeeds', () => {
      // INPUT -> CONDITION -> (TRUE) -> TRANSFORM -> OUTPUT
      //                     -> (FALSE) -> OUTPUT
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT'),
          createNode('cond_1', 'CONDITION'),
          createNode('tr_1', 'TRANSFORM'),
          createNode('out_1', 'OUTPUT'),
        ],
        edges: [
          createEdge('e1', 'in_1', 'cond_1'),
          createEdge('e2', 'cond_1', 'tr_1', 'TRUE'),
          createEdge('e3', 'cond_1', 'out_1', 'FALSE'),
          createEdge('e4', 'tr_1', 'out_1'),
        ],
      };
      const result = validateWorkflowGraphSemantics(graph);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.topologicalNodeIds).toEqual(['in_1', 'cond_1', 'tr_1', 'out_1']);
      }
    });

    it('3. TRUE and FALSE branches reaching different OUTPUT nodes succeed', () => {
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
      const result = validateWorkflowGraphSemantics(graph);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.topologicalNodeIds).toEqual(['in_1', 'cond_1', 'out_false', 'out_true']);
      }
    });

    it('4. TRUE/FALSE branches converging to a shared node succeed', () => {
      // INPUT -> CONDITION -> (TRUE) -> LLM_1 -> MERGE -> OUTPUT
      //                     -> (FALSE) -> LLM_2 -> MERGE
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT'),
          createNode('cond_1', 'CONDITION'),
          createNode('llm_1', 'LLM'),
          createNode('llm_2', 'LLM'),
          createNode('merge', 'TRANSFORM'),
          createNode('out_1', 'OUTPUT'),
        ],
        edges: [
          createEdge('e1', 'in_1', 'cond_1'),
          createEdge('e2', 'cond_1', 'llm_1', 'TRUE'),
          createEdge('e3', 'cond_1', 'llm_2', 'FALSE'),
          createEdge('e4', 'llm_1', 'merge'),
          createEdge('e5', 'llm_2', 'merge'),
          createEdge('e6', 'merge', 'out_1'),
        ],
      };
      const result = validateWorkflowGraphSemantics(graph);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.topologicalNodeIds).toContain('merge');
        expect(result.topologicalNodeIds).toContain('out_1');
      }
    });

    it('5. distinct branch edges targeting the same successor do not fail solely due to shared target', () => {
      // CONDITION routes both TRUE and FALSE directly to the same node
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT'),
          createNode('cond_1', 'CONDITION'),
          createNode('out_1', 'OUTPUT'),
        ],
        edges: [
          createEdge('e1', 'in_1', 'cond_1'),
          createEdge('e_true', 'cond_1', 'out_1', 'TRUE'),
          createEdge('e_false', 'cond_1', 'out_1', 'FALSE'),
        ],
      };
      const result = validateWorkflowGraphSemantics(graph);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.topologicalNodeIds).toEqual(['in_1', 'cond_1', 'out_1']);
      }
    });

    it('6. multiple INPUT nodes are accepted under the at-least-one policy', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_manual', 'INPUT'),
          createNode('in_webhook', 'INPUT'),
          createNode('merge', 'TRANSFORM'),
          createNode('out_1', 'OUTPUT'),
        ],
        edges: [
          createEdge('e1', 'in_manual', 'merge'),
          createEdge('e2', 'in_webhook', 'merge'),
          createEdge('e3', 'merge', 'out_1'),
        ],
      };
      const result = validateWorkflowGraphSemantics(graph);

      expect(result.success).toBe(true);
    });

    it('7. multiple OUTPUT nodes are accepted', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT'),
          createNode('split', 'TRANSFORM'),
          createNode('out_a', 'OUTPUT'),
          createNode('out_b', 'OUTPUT'),
        ],
        edges: [
          createEdge('e1', 'in_1', 'split'),
          createEdge('e2', 'split', 'out_a'),
          createEdge('e3', 'split', 'out_b'),
        ],
      };
      const result = validateWorkflowGraphSemantics(graph);

      expect(result.success).toBe(true);
    });

    it('8. multiple disconnected components each containing an INPUT-to-OUTPUT path succeed if all nodes satisfy reachability', () => {
      // Component 1: IN_1 -> OUT_1
      // Component 2: IN_2 -> OUT_2
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT'),
          createNode('out_1', 'OUTPUT'),
          createNode('in_2', 'INPUT'),
          createNode('out_2', 'OUTPUT'),
        ],
        edges: [createEdge('e1', 'in_1', 'out_1'), createEdge('e2', 'in_2', 'out_2')],
      };
      const result = validateWorkflowGraphSemantics(graph);

      expect(result.success).toBe(true);
    });

    it('9. reachability traverses all directed edges correctly', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT'),
          createNode('step_1', 'TRANSFORM'),
          createNode('step_2', 'TRANSFORM'),
          createNode('step_3', 'TRANSFORM'),
          createNode('out_1', 'OUTPUT'),
        ],
        edges: [
          createEdge('e1', 'in_1', 'step_1'),
          createEdge('e2', 'step_1', 'step_2'),
          createEdge('e3', 'step_2', 'step_3'),
          createEdge('e4', 'step_3', 'out_1'),
        ],
      };
      const result = validateWorkflowGraphSemantics(graph);

      expect(result.success).toBe(true);
    });

    it('10. reference-like text inside config does not affect static reachability', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT'),
          createNode('step_1', 'TRANSFORM', {
            text: 'references node_non_existent.output in string literal',
          }),
          createNode('out_1', 'OUTPUT'),
        ],
        edges: [createEdge('e1', 'in_1', 'step_1'), createEdge('e2', 'step_1', 'out_1')],
      };
      const result = validateWorkflowGraphSemantics(graph);

      expect(result.success).toBe(true);
    });

    it('11. draft configs remain accepted for graph semantics', () => {
      const graph: WorkflowGraph = {
        nodes: [createNode('in_1', 'INPUT', {}), createNode('out_1', 'OUTPUT', {})],
        edges: [createEdge('e1', 'in_1', 'out_1')],
      };
      const result = validateWorkflowGraphSemantics(graph);

      expect(result.success).toBe(true);
    });

    it('12. repeat analysis is deterministic', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT'),
          createNode('cond_1', 'CONDITION'),
          createNode('tr_t', 'TRANSFORM'),
          createNode('out_1', 'OUTPUT'),
        ],
        edges: [
          createEdge('e1', 'in_1', 'cond_1'),
          createEdge('e2', 'cond_1', 'tr_t', 'TRUE'),
          createEdge('e3', 'cond_1', 'out_1', 'FALSE'),
          createEdge('e4', 'tr_t', 'out_1'),
        ],
      };

      const res1 = validateWorkflowGraphSemantics(graph);
      const res2 = validateWorkflowGraphSemantics(graph);
      expect(res1).toEqual(res2);
    });

    it('13. frozen input graph is not mutated', () => {
      const graph: WorkflowGraph = Object.freeze({
        nodes: Object.freeze([
          Object.freeze(createNode('in_1', 'INPUT')),
          Object.freeze(createNode('out_1', 'OUTPUT')),
        ]) as unknown as WorkflowNode[],
        edges: Object.freeze([
          Object.freeze(createEdge('e1', 'in_1', 'out_1')),
        ]) as unknown as WorkflowEdge[],
      });

      expect(() => validateWorkflowGraphSemantics(graph)).not.toThrow();
      const res = validateWorkflowGraphSemantics(graph);
      expect(res.success).toBe(true);
    });

    it('14. existing analyzeWorkflowGraph still accepts an empty graph', () => {
      const emptyGraph: WorkflowGraph = { nodes: [], edges: [] };
      const integrityRes = analyzeWorkflowGraph(emptyGraph);

      expect(integrityRes.success).toBe(true);
    });

    it('15. existing analyzeWorkflowGraph still accepts incomplete CONDITION branching', () => {
      const incompleteGraph: WorkflowGraph = {
        nodes: [createNode('c1', 'CONDITION')],
        edges: [],
      };
      const integrityRes = analyzeWorkflowGraph(incompleteGraph);

      expect(integrityRes.success).toBe(true);
    });

    it('16. public result types narrow correctly', () => {
      const graph: WorkflowGraph = {
        nodes: [createNode('in_1', 'INPUT'), createNode('out_1', 'OUTPUT')],
        edges: [createEdge('e1', 'in_1', 'out_1')],
      };
      const result: WorkflowGraphSemanticsResult = validateWorkflowGraphSemantics(graph);

      if (result.success) {
        const _success: WorkflowGraphSemanticsSuccessResult = result;
        const _ids: string[] = _success.topologicalNodeIds;
        expect(_ids).toBeDefined();
      } else {
        expect.unreachable('Should have succeeded');
      }
    });
  });

  describe('Negative Cases', () => {
    it('17. no INPUT node -> MISSING_INPUT_NODE', () => {
      const graph: WorkflowGraph = {
        nodes: [createNode('tr_1', 'TRANSFORM'), createNode('out_1', 'OUTPUT')],
        edges: [createEdge('e1', 'tr_1', 'out_1')],
      };
      const result = validateWorkflowGraphSemantics(graph);

      expect(result.success).toBe(false);
      if (!result.success && result.stage === 'semantics') {
        expect(result.issues).toEqual([
          {
            code: 'MISSING_INPUT_NODE',
            path: ['nodes'],
            message: 'Workflow graph must contain at least one INPUT node',
          },
        ]);
      } else {
        expect.unreachable('Expected semantics failure');
      }
    });

    it('18. no OUTPUT node -> MISSING_OUTPUT_NODE', () => {
      const graph: WorkflowGraph = {
        nodes: [createNode('in_1', 'INPUT'), createNode('tr_1', 'TRANSFORM')],
        edges: [createEdge('e1', 'in_1', 'tr_1')],
      };
      const result = validateWorkflowGraphSemantics(graph);

      expect(result.success).toBe(false);
      if (!result.success && result.stage === 'semantics') {
        expect(result.issues).toEqual([
          {
            code: 'MISSING_OUTPUT_NODE',
            path: ['nodes'],
            message: 'Workflow graph must contain at least one OUTPUT node',
          },
        ]);
      } else {
        expect.unreachable('Expected semantics failure');
      }
    });

    it('19. empty graph -> both missing node-type diagnostics', () => {
      const graph: WorkflowGraph = { nodes: [], edges: [] };
      const result = validateWorkflowGraphSemantics(graph);

      expect(result.success).toBe(false);
      if (!result.success && result.stage === 'semantics') {
        expect(result.issues).toHaveLength(2);
        expect(result.issues[0]?.code).toBe('MISSING_INPUT_NODE');
        expect(result.issues[1]?.code).toBe('MISSING_OUTPUT_NODE');
      } else {
        expect.unreachable('Expected semantics failure');
      }
    });

    it('20. CONDITION with no edges -> missing TRUE and FALSE', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT'),
          createNode('cond_1', 'CONDITION'),
          createNode('out_1', 'OUTPUT'),
        ],
        edges: [createEdge('e1', 'in_1', 'cond_1')],
      };
      const result = validateWorkflowGraphSemantics(graph);

      expect(result.success).toBe(false);
      if (!result.success && result.stage === 'semantics') {
        const codes = result.issues.map((i) => i.code);
        expect(codes).toContain('CONDITION_TRUE_BRANCH_MISSING');
        expect(codes).toContain('CONDITION_FALSE_BRANCH_MISSING');
        const trueIssue = result.issues.find((i) => i.code === 'CONDITION_TRUE_BRANCH_MISSING');
        expect(trueIssue?.path).toEqual(['nodes', 1, 'id']);
        const falseIssue = result.issues.find((i) => i.code === 'CONDITION_FALSE_BRANCH_MISSING');
        expect(falseIssue?.path).toEqual(['nodes', 1, 'id']);
      } else {
        expect.unreachable('Expected semantics failure');
      }
    });

    it('21. CONDITION with only TRUE -> missing FALSE', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT'),
          createNode('cond_1', 'CONDITION'),
          createNode('out_1', 'OUTPUT'),
        ],
        edges: [createEdge('e1', 'in_1', 'cond_1'), createEdge('e2', 'cond_1', 'out_1', 'TRUE')],
      };
      const result = validateWorkflowGraphSemantics(graph);

      expect(result.success).toBe(false);
      if (!result.success && result.stage === 'semantics') {
        const codes = result.issues.map((i) => i.code);
        expect(codes).toContain('CONDITION_FALSE_BRANCH_MISSING');
        expect(codes).not.toContain('CONDITION_TRUE_BRANCH_MISSING');
      } else {
        expect.unreachable('Expected semantics failure');
      }
    });

    it('22. CONDITION with only FALSE -> missing TRUE', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT'),
          createNode('cond_1', 'CONDITION'),
          createNode('out_1', 'OUTPUT'),
        ],
        edges: [createEdge('e1', 'in_1', 'cond_1'), createEdge('e2', 'cond_1', 'out_1', 'FALSE')],
      };
      const result = validateWorkflowGraphSemantics(graph);

      expect(result.success).toBe(false);
      if (!result.success && result.stage === 'semantics') {
        const codes = result.issues.map((i) => i.code);
        expect(codes).toContain('CONDITION_TRUE_BRANCH_MISSING');
        expect(codes).not.toContain('CONDITION_FALSE_BRANCH_MISSING');
      } else {
        expect.unreachable('Expected semantics failure');
      }
    });

    it('23. CONDITION with two TRUE edges -> duplicate TRUE and missing FALSE', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT'),
          createNode('cond_1', 'CONDITION'),
          createNode('out_1', 'OUTPUT'),
          createNode('out_2', 'OUTPUT'),
        ],
        edges: [
          createEdge('e1', 'in_1', 'cond_1'),
          createEdge('e2', 'cond_1', 'out_1', 'TRUE'),
          createEdge('e3', 'cond_1', 'out_2', 'TRUE'),
        ],
      };
      const result = validateWorkflowGraphSemantics(graph);

      expect(result.success).toBe(false);
      if (!result.success && result.stage === 'semantics') {
        const codes = result.issues.map((i) => i.code);
        expect(codes).toContain('CONDITION_OUTCOME_DUPLICATE');
        expect(codes).toContain('CONDITION_FALSE_BRANCH_MISSING');
        const dup = result.issues.find((i) => i.code === 'CONDITION_OUTCOME_DUPLICATE');
        expect(dup?.path).toEqual(['edges', 2, 'conditionOutcome']);
      } else {
        expect.unreachable('Expected semantics failure');
      }
    });

    it('24. CONDITION with two FALSE edges -> duplicate FALSE and missing TRUE', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT'),
          createNode('cond_1', 'CONDITION'),
          createNode('out_1', 'OUTPUT'),
          createNode('out_2', 'OUTPUT'),
        ],
        edges: [
          createEdge('e1', 'in_1', 'cond_1'),
          createEdge('e2', 'cond_1', 'out_1', 'FALSE'),
          createEdge('e3', 'cond_1', 'out_2', 'FALSE'),
        ],
      };
      const result = validateWorkflowGraphSemantics(graph);

      expect(result.success).toBe(false);
      if (!result.success && result.stage === 'semantics') {
        const codes = result.issues.map((i) => i.code);
        expect(codes).toContain('CONDITION_OUTCOME_DUPLICATE');
        expect(codes).toContain('CONDITION_TRUE_BRANCH_MISSING');
        const dup = result.issues.find((i) => i.code === 'CONDITION_OUTCOME_DUPLICATE');
        expect(dup?.path).toEqual(['edges', 2, 'conditionOutcome']);
      } else {
        expect.unreachable('Expected semantics failure');
      }
    });

    it('25. CONDITION with unlabeled outgoing edge -> missing outcome diagnostic', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT'),
          createNode('cond_1', 'CONDITION'),
          createNode('out_1', 'OUTPUT'),
        ],
        edges: [
          createEdge('e1', 'in_1', 'cond_1'),
          createEdge('e2', 'cond_1', 'out_1'), // unlabeled
        ],
      };
      const result = validateWorkflowGraphSemantics(graph);

      expect(result.success).toBe(false);
      if (!result.success && result.stage === 'semantics') {
        const codes = result.issues.map((i) => i.code);
        expect(codes).toContain('CONDITION_EDGE_OUTCOME_MISSING');
        const issue = result.issues.find((i) => i.code === 'CONDITION_EDGE_OUTCOME_MISSING');
        expect(issue?.path).toEqual(['edges', 1, 'conditionOutcome']);
      } else {
        expect.unreachable('Expected semantics failure');
      }
    });

    it('26. CONDITION with three outgoing edges -> extra edge diagnostic', () => {
      // 3 edges: TRUE, FALSE, and another labeled edge
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT'),
          createNode('cond_1', 'CONDITION'),
          createNode('out_1', 'OUTPUT'),
          createNode('out_2', 'OUTPUT'),
          createNode('out_3', 'OUTPUT'),
        ],
        edges: [
          createEdge('e1', 'in_1', 'cond_1'),
          createEdge('e2', 'cond_1', 'out_1', 'TRUE'),
          createEdge('e3', 'cond_1', 'out_2', 'FALSE'),
          createEdge('e4', 'cond_1', 'out_3', 'TRUE'),
        ],
      };
      const result = validateWorkflowGraphSemantics(graph);

      expect(result.success).toBe(false);
      if (!result.success && result.stage === 'semantics') {
        const codes = result.issues.map((i) => i.code);
        expect(codes).toContain('CONDITION_EXTRA_OUTGOING_EDGE');
        const extra = result.issues.find((i) => i.code === 'CONDITION_EXTRA_OUTGOING_EDGE');
        expect(extra?.path).toEqual(['edges', 3, 'id']);
      } else {
        expect.unreachable('Expected semantics failure');
      }
    });

    it('27. CONDITION with two valid outcomes and an extra unlabeled edge -> appropriate combined diagnostics', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT'),
          createNode('cond_1', 'CONDITION'),
          createNode('out_1', 'OUTPUT'),
          createNode('out_2', 'OUTPUT'),
          createNode('out_3', 'OUTPUT'),
        ],
        edges: [
          createEdge('e1', 'in_1', 'cond_1'),
          createEdge('e2', 'cond_1', 'out_1', 'TRUE'),
          createEdge('e3', 'cond_1', 'out_2', 'FALSE'),
          createEdge('e4', 'cond_1', 'out_3'), // unlabeled extra edge
        ],
      };
      const result = validateWorkflowGraphSemantics(graph);

      expect(result.success).toBe(false);
      if (!result.success && result.stage === 'semantics') {
        const codes = result.issues.map((i) => i.code);
        expect(codes).toContain('CONDITION_EDGE_OUTCOME_MISSING');
        expect(codes).toContain('CONDITION_EXTRA_OUTGOING_EDGE');
        expect(codes).not.toContain('CONDITION_TRUE_BRANCH_MISSING');
        expect(codes).not.toContain('CONDITION_FALSE_BRANCH_MISSING');
      } else {
        expect.unreachable('Expected semantics failure');
      }
    });

    it('28. INPUT edge with TRUE outcome rejected', () => {
      const graph: WorkflowGraph = {
        nodes: [createNode('in_1', 'INPUT'), createNode('out_1', 'OUTPUT')],
        edges: [createEdge('e1', 'in_1', 'out_1', 'TRUE')],
      };
      const result = validateWorkflowGraphSemantics(graph);

      expect(result.success).toBe(false);
      if (!result.success && result.stage === 'semantics') {
        expect(result.issues).toEqual([
          {
            code: 'NON_CONDITION_EDGE_OUTCOME',
            path: ['edges', 0, 'conditionOutcome'],
            message:
              'Edge "e1" at index 0 from non-condition node "in_1" cannot have conditionOutcome',
          },
        ]);
      } else {
        expect.unreachable('Expected semantics failure');
      }
    });

    it('29. TRANSFORM edge with FALSE outcome rejected', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT'),
          createNode('tr_1', 'TRANSFORM'),
          createNode('out_1', 'OUTPUT'),
        ],
        edges: [createEdge('e1', 'in_1', 'tr_1'), createEdge('e2', 'tr_1', 'out_1', 'FALSE')],
      };
      const result = validateWorkflowGraphSemantics(graph);

      expect(result.success).toBe(false);
      if (!result.success && result.stage === 'semantics') {
        expect(result.issues).toEqual([
          {
            code: 'NON_CONDITION_EDGE_OUTCOME',
            path: ['edges', 1, 'conditionOutcome'],
            message:
              'Edge "e2" at index 1 from non-condition node "tr_1" cannot have conditionOutcome',
          },
        ]);
      } else {
        expect.unreachable('Expected semantics failure');
      }
    });

    it('30. APPROVAL edge with outcome rejected', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT'),
          createNode('app_1', 'APPROVAL'),
          createNode('out_1', 'OUTPUT'),
        ],
        edges: [createEdge('e1', 'in_1', 'app_1'), createEdge('e2', 'app_1', 'out_1', 'TRUE')],
      };
      const result = validateWorkflowGraphSemantics(graph);

      expect(result.success).toBe(false);
      if (!result.success && result.stage === 'semantics') {
        expect(result.issues).toEqual([
          {
            code: 'NON_CONDITION_EDGE_OUTCOME',
            path: ['edges', 1, 'conditionOutcome'],
            message:
              'Edge "e2" at index 1 from non-condition node "app_1" cannot have conditionOutcome',
          },
        ]);
      } else {
        expect.unreachable('Expected semantics failure');
      }
    });

    it('31. disconnected orphan node -> UNREACHABLE_FROM_INPUT', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT'),
          createNode('orphan_1', 'TRANSFORM'),
          createNode('out_1', 'OUTPUT'),
        ],
        edges: [
          createEdge('e1', 'in_1', 'out_1'),
          createEdge('e2', 'orphan_1', 'out_1'), // orphan_1 reaches output but is not reachable from input
        ],
      };
      const result = validateWorkflowGraphSemantics(graph);

      expect(result.success).toBe(false);
      if (!result.success && result.stage === 'semantics') {
        expect(result.issues).toEqual([
          {
            code: 'UNREACHABLE_FROM_INPUT',
            path: ['nodes', 1, 'id'],
            message: 'Node "orphan_1" at index 1 is not reachable from any INPUT node',
          },
        ]);
      } else {
        expect.unreachable('Expected semantics failure');
      }
    });

    it('32. reachable dead-end node -> CANNOT_REACH_OUTPUT', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT'),
          createNode('out_1', 'OUTPUT'),
          createNode('dead_end', 'TRANSFORM'),
        ],
        edges: [
          createEdge('e1', 'in_1', 'out_1'),
          createEdge('e2', 'in_1', 'dead_end'), // dead_end is reachable from in_1 but cannot reach out_1
        ],
      };
      const result = validateWorkflowGraphSemantics(graph);

      expect(result.success).toBe(false);
      if (!result.success && result.stage === 'semantics') {
        expect(result.issues).toEqual([
          {
            code: 'CANNOT_REACH_OUTPUT',
            path: ['nodes', 2, 'id'],
            message: 'Node "dead_end" at index 2 cannot reach any OUTPUT node',
          },
        ]);
      } else {
        expect.unreachable('Expected semantics failure');
      }
    });

    it('33. one valid branch and one dead-end branch -> dead-end detected', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT'),
          createNode('cond_1', 'CONDITION'),
          createNode('out_1', 'OUTPUT'),
          createNode('dead_branch', 'TRANSFORM'),
        ],
        edges: [
          createEdge('e1', 'in_1', 'cond_1'),
          createEdge('e2', 'cond_1', 'out_1', 'TRUE'),
          createEdge('e3', 'cond_1', 'dead_branch', 'FALSE'),
        ],
      };
      const result = validateWorkflowGraphSemantics(graph);

      expect(result.success).toBe(false);
      if (!result.success && result.stage === 'semantics') {
        expect(result.issues).toEqual([
          {
            code: 'CANNOT_REACH_OUTPUT',
            path: ['nodes', 3, 'id'],
            message: 'Node "dead_branch" at index 3 cannot reach any OUTPUT node',
          },
        ]);
      } else {
        expect.unreachable('Expected semantics failure');
      }
    });

    it('34. a node that is neither reachable from INPUT nor able to reach OUTPUT receives both relevant diagnostics when entry and output nodes exist', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT'),
          createNode('out_1', 'OUTPUT'),
          createNode('completely_isolated', 'TRANSFORM'),
        ],
        edges: [createEdge('e1', 'in_1', 'out_1')],
      };
      const result = validateWorkflowGraphSemantics(graph);

      expect(result.success).toBe(false);
      if (!result.success && result.stage === 'semantics') {
        const codes = result.issues.map((i) => i.code);
        expect(codes).toContain('UNREACHABLE_FROM_INPUT');
        expect(codes).toContain('CANNOT_REACH_OUTPUT');
        const unreachable = result.issues.find((i) => i.code === 'UNREACHABLE_FROM_INPUT');
        expect(unreachable?.path).toEqual(['nodes', 2, 'id']);
        const cannotReach = result.issues.find((i) => i.code === 'CANNOT_REACH_OUTPUT');
        expect(cannotReach?.path).toEqual(['nodes', 2, 'id']);
      } else {
        expect.unreachable('Expected semantics failure');
      }
    });

    it('35. missing entrypoint does not produce noisy per-node forward-reachability errors', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('step_1', 'TRANSFORM'),
          createNode('step_2', 'TRANSFORM'),
          createNode('out_1', 'OUTPUT'),
        ],
        edges: [createEdge('e1', 'step_1', 'step_2'), createEdge('e2', 'step_2', 'out_1')],
      };
      const result = validateWorkflowGraphSemantics(graph);

      expect(result.success).toBe(false);
      if (!result.success && result.stage === 'semantics') {
        expect(result.issues).toEqual([
          {
            code: 'MISSING_INPUT_NODE',
            path: ['nodes'],
            message: 'Workflow graph must contain at least one INPUT node',
          },
        ]);
      } else {
        expect.unreachable('Expected semantics failure');
      }
    });

    it('36. missing terminal does not produce noisy per-node reverse-reachability errors', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT'),
          createNode('step_1', 'TRANSFORM'),
          createNode('step_2', 'TRANSFORM'),
        ],
        edges: [createEdge('e1', 'in_1', 'step_1'), createEdge('e2', 'step_1', 'step_2')],
      };
      const result = validateWorkflowGraphSemantics(graph);

      expect(result.success).toBe(false);
      if (!result.success && result.stage === 'semantics') {
        expect(result.issues).toEqual([
          {
            code: 'MISSING_OUTPUT_NODE',
            path: ['nodes'],
            message: 'Workflow graph must contain at least one OUTPUT node',
          },
        ]);
      } else {
        expect.unreachable('Expected semantics failure');
      }
    });

    it('37. diagnostic paths preserve numeric indices', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT'),
          createNode('valid_tr', 'TRANSFORM'),
          createNode('bad_tr', 'TRANSFORM'),
          createNode('out_1', 'OUTPUT'),
        ],
        edges: [
          createEdge('e0', 'in_1', 'valid_tr'),
          createEdge('e1', 'valid_tr', 'out_1'),
          createEdge('e2', 'bad_tr', 'out_1', 'TRUE'), // invalid outcome on non-condition edge index 2
        ],
      };
      const result = validateWorkflowGraphSemantics(graph);

      expect(result.success).toBe(false);
      if (!result.success && result.stage === 'semantics') {
        const edgeIssue = result.issues.find((i) => i.code === 'NON_CONDITION_EDGE_OUTCOME');
        expect(edgeIssue?.path).toEqual(['edges', 2, 'conditionOutcome']);
        expect(typeof edgeIssue?.path[1]).toBe('number');
      } else {
        expect.unreachable('Expected semantics failure');
      }
    });

    it('38. node IDs containing dots are not split or normalized', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('system.input.v1', 'INPUT'),
          createNode('system.orphan.v1', 'TRANSFORM'),
          createNode('system.output.v1', 'OUTPUT'),
        ],
        edges: [createEdge('e1', 'system.input.v1', 'system.output.v1')],
      };
      const result = validateWorkflowGraphSemantics(graph);

      expect(result.success).toBe(false);
      if (!result.success && result.stage === 'semantics') {
        const orphanIssue = result.issues.find((i) => i.code === 'UNREACHABLE_FROM_INPUT');
        expect(orphanIssue?.path).toEqual(['nodes', 1, 'id']);
        expect(orphanIssue?.message).toContain('system.orphan.v1');
      } else {
        expect.unreachable('Expected semantics failure');
      }
    });

    it('39. results remain JSON-serializable', () => {
      const validGraph: WorkflowGraph = {
        nodes: [createNode('in_1', 'INPUT'), createNode('out_1', 'OUTPUT')],
        edges: [createEdge('e1', 'in_1', 'out_1')],
      };
      const res = validateWorkflowGraphSemantics(validGraph);
      const json = JSON.parse(JSON.stringify(res));
      expect(json).toEqual(res);
    });

    it('40. original arrays are not reordered or mutated', () => {
      const nodes = [createNode('out_1', 'OUTPUT'), createNode('in_1', 'INPUT')];
      const edges = [createEdge('e1', 'in_1', 'out_1')];
      const clonedNodes = JSON.parse(JSON.stringify(nodes));
      const clonedEdges = JSON.parse(JSON.stringify(edges));

      validateWorkflowGraphSemantics({ nodes, edges });

      expect(nodes).toEqual(clonedNodes);
      expect(edges).toEqual(clonedEdges);
    });
  });

  describe('Integrity Gating', () => {
    it('41. duplicate node ID returns stage: integrity', () => {
      const graph: WorkflowGraph = {
        nodes: [createNode('dup_id', 'INPUT'), createNode('dup_id', 'OUTPUT')],
        edges: [],
      };
      const result = validateWorkflowGraphSemantics(graph);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.stage).toBe('integrity');
        expect(result.issues[0]?.code).toBe('DUPLICATE_NODE_ID');
      }
    });

    it('42. duplicate edge ID returns stage: integrity', () => {
      const graph: WorkflowGraph = {
        nodes: [createNode('in_1', 'INPUT'), createNode('out_1', 'OUTPUT')],
        edges: [createEdge('dup_e', 'in_1', 'out_1'), createEdge('dup_e', 'in_1', 'out_1')],
      };
      const result = validateWorkflowGraphSemantics(graph);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.stage).toBe('integrity');
        expect(result.issues[0]?.code).toBe('DUPLICATE_EDGE_ID');
      }
    });

    it('43. dangling edge returns stage: integrity', () => {
      const graph: WorkflowGraph = {
        nodes: [createNode('in_1', 'INPUT')],
        edges: [createEdge('e1', 'in_1', 'ghost_target')],
      };
      const result = validateWorkflowGraphSemantics(graph);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.stage).toBe('integrity');
        expect(result.issues[0]?.code).toBe('MISSING_EDGE_TARGET');
      }
    });

    it('44. cycle returns stage: integrity', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT'),
          createNode('node_a', 'TRANSFORM'),
          createNode('node_b', 'TRANSFORM'),
          createNode('out_1', 'OUTPUT'),
        ],
        edges: [
          createEdge('e1', 'in_1', 'node_a'),
          createEdge('e2', 'node_a', 'node_b'),
          createEdge('e3', 'node_b', 'node_a'), // cycle between a and b
          createEdge('e4', 'node_b', 'out_1'),
        ],
      };
      const result = validateWorkflowGraphSemantics(graph);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.stage).toBe('integrity');
        expect(result.issues[0]?.code).toBe('CYCLE_DETECTED');
      }
    });

    it('45. integrity issues preserve original codes and paths', () => {
      const graph: WorkflowGraph = {
        nodes: [createNode('in_1', 'INPUT'), createNode('out_1', 'OUTPUT')],
        edges: [createEdge('e1', 'non_existent_src', 'out_1')],
      };
      const result = validateWorkflowGraphSemantics(graph);

      expect(result.success).toBe(false);
      if (!result.success && result.stage === 'integrity') {
        expect(result.issues[0]).toEqual({
          code: 'MISSING_EDGE_SOURCE',
          path: ['edges', 0, 'source'],
          message: 'Edge "e1" at index 0 references non-existent source node "non_existent_src"',
        });
      }
    });

    it('46. no semantic diagnostics are emitted after integrity failure', () => {
      // Graph has dangling edge AND missing OUTPUT node
      const graph: WorkflowGraph = {
        nodes: [createNode('in_1', 'INPUT')],
        edges: [createEdge('e1', 'in_1', 'missing_node')],
      };
      const result = validateWorkflowGraphSemantics(graph);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.stage).toBe('integrity');
        // Must NOT contain MISSING_OUTPUT_NODE
        expect(result.issues.some((i) => (i.code as string) === 'MISSING_OUTPUT_NODE')).toBe(false);
      }
    });
  });

  describe('Boundary & Non-Execution Checks', () => {
    it('47. no condition expressions are evaluated', () => {
      // Condition config is completely empty; static graph validator does not inspect predicates
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT'),
          createNode('cond_1', 'CONDITION', {}),
          createNode('out_1', 'OUTPUT'),
        ],
        edges: [
          createEdge('e1', 'in_1', 'cond_1'),
          createEdge('e2', 'cond_1', 'out_1', 'TRUE'),
          createEdge('e3', 'cond_1', 'out_1', 'FALSE'),
        ],
      };
      const result = validateWorkflowGraphSemantics(graph);

      expect(result.success).toBe(true);
    });

    it('48. no INPUT/OUTPUT count exactness beyond the approved minimums', () => {
      // 3 INPUTs, 3 OUTPUTs
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT'),
          createNode('in_2', 'INPUT'),
          createNode('in_3', 'INPUT'),
          createNode('hub', 'TRANSFORM'),
          createNode('out_1', 'OUTPUT'),
          createNode('out_2', 'OUTPUT'),
          createNode('out_3', 'OUTPUT'),
        ],
        edges: [
          createEdge('e1', 'in_1', 'hub'),
          createEdge('e2', 'in_2', 'hub'),
          createEdge('e3', 'in_3', 'hub'),
          createEdge('e4', 'hub', 'out_1'),
          createEdge('e5', 'hub', 'out_2'),
          createEdge('e6', 'hub', 'out_3'),
        ],
      };
      const result = validateWorkflowGraphSemantics(graph);

      expect(result.success).toBe(true);
    });

    it('49. no OUTPUT outdegree rule is imposed in this milestone', () => {
      // OUTPUT node with an outgoing edge to another OUTPUT node
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT'),
          createNode('out_1', 'OUTPUT'),
          createNode('out_2', 'OUTPUT'),
        ],
        edges: [createEdge('e1', 'in_1', 'out_1'), createEdge('e2', 'out_1', 'out_2')],
      };
      const result = validateWorkflowGraphSemantics(graph);

      expect(result.success).toBe(true);
    });

    it('50. no INPUT indegree rule is imposed in this milestone', () => {
      // INPUT node with an incoming edge from another INPUT node
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT'),
          createNode('in_2', 'INPUT'),
          createNode('out_1', 'OUTPUT'),
        ],
        edges: [createEdge('e1', 'in_1', 'in_2'), createEdge('e2', 'in_2', 'out_1')],
      };
      const result = validateWorkflowGraphSemantics(graph);

      expect(result.success).toBe(true);
    });

    it('51. no data reference lineage checks occur in this milestone', () => {
      // Node config has reference to unreached node; static validator does not inspect reference lineage
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT'),
          createNode('tr_1', 'TRANSFORM', {
            targetKey: 'data',
            reference: {
              type: 'reference',
              target: 'node_output',
              nodeId: 'future_node',
              path: [],
            },
          }),
          createNode('out_1', 'OUTPUT'),
        ],
        edges: [createEdge('e1', 'in_1', 'tr_1'), createEdge('e2', 'tr_1', 'out_1')],
      };
      const result = validateWorkflowGraphSemantics(graph);

      expect(result.success).toBe(true);
    });

    it('52. no runtime branch scheduling occurs', () => {
      // Graph is valid statically regardless of runtime data
      const graph: WorkflowGraph = {
        nodes: [
          createNode('in_1', 'INPUT'),
          createNode('cond_1', 'CONDITION'),
          createNode('out_1', 'OUTPUT'),
        ],
        edges: [
          createEdge('e1', 'in_1', 'cond_1'),
          createEdge('e2', 'cond_1', 'out_1', 'TRUE'),
          createEdge('e3', 'cond_1', 'out_1', 'FALSE'),
        ],
      };
      const result = validateWorkflowGraphSemantics(graph);

      expect(result.success).toBe(true);
      expect('executionPlan' in result).toBe(false);
      expect('canExecute' in result).toBe(false);
      expect('isPublishable' in result).toBe(false);
    });
  });

  describe('TypeScript Verification', () => {
    it('53. verify discriminated union types and stage properties', () => {
      const graph: WorkflowGraph = { nodes: [], edges: [] };
      const result: WorkflowGraphSemanticsResult = validateWorkflowGraphSemantics(graph);

      if (result.success) {
        const successRes: WorkflowGraphSemanticsSuccessResult = result;
        const _ids: string[] = successRes.topologicalNodeIds;
        expect(_ids).toBeDefined();
      } else if (result.stage === 'integrity') {
        const intRes: WorkflowGraphSemanticsIntegrityFailureResult = result;
        const _issues: GraphIntegrityIssue[] = intRes.issues;
        expect(_issues).toBeDefined();
      } else if (result.stage === 'semantics') {
        const semRes: WorkflowGraphSemanticsSemanticFailureResult = result;
        const _issues: WorkflowGraphSemanticIssue[] = semRes.issues;
        const _code: WorkflowGraphSemanticIssueCode = _issues[0]?.code ?? 'MISSING_INPUT_NODE';
        expect(_code).toBeDefined();
      }
    });
  });
});
