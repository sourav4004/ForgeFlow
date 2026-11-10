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
  type GraphAnalysisFailureResult,
  type GraphAnalysisResult,
  type GraphAnalysisSuccessResult,
  type GraphIntegrityIssue,
  type GraphIntegrityIssueCode,
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

describe('analyzeWorkflowGraph', () => {
  describe('Positive Cases', () => {
    it('1. empty graph succeeds with empty order', () => {
      const graph: WorkflowGraph = { nodes: [], edges: [] };
      const result = analyzeWorkflowGraph(graph);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.issues).toEqual([]);
        expect(result.topologicalNodeIds).toEqual([]);
      }
    });

    it('2. single isolated node succeeds', () => {
      const graph: WorkflowGraph = {
        nodes: [createNode('node_single')],
        edges: [],
      };
      const result = analyzeWorkflowGraph(graph);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.topologicalNodeIds).toEqual(['node_single']);
      }
    });

    it('3. simple A -> B graph succeeds', () => {
      const graph: WorkflowGraph = {
        nodes: [createNode('node_b'), createNode('node_a')],
        edges: [createEdge('edge_1', 'node_a', 'node_b')],
      };
      const result = analyzeWorkflowGraph(graph);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.topologicalNodeIds).toEqual(['node_a', 'node_b']);
      }
    });

    it('4. linear A -> B -> C succeeds', () => {
      const graph: WorkflowGraph = {
        nodes: [createNode('C'), createNode('A'), createNode('B')],
        edges: [createEdge('e1', 'A', 'B'), createEdge('e2', 'B', 'C')],
      };
      const result = analyzeWorkflowGraph(graph);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.topologicalNodeIds).toEqual(['A', 'B', 'C']);
      }
    });

    it('5. branching DAG succeeds', () => {
      // A -> B, A -> C
      const graph: WorkflowGraph = {
        nodes: [createNode('C'), createNode('B'), createNode('A')],
        edges: [createEdge('e1', 'A', 'B'), createEdge('e2', 'A', 'C')],
      };
      const result = analyzeWorkflowGraph(graph);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.topologicalNodeIds).toEqual(['A', 'B', 'C']);
      }
    });

    it('6. diamond DAG succeeds', () => {
      // A -> B -> D, A -> C -> D
      const graph: WorkflowGraph = {
        nodes: [createNode('D'), createNode('C'), createNode('B'), createNode('A')],
        edges: [
          createEdge('e1', 'A', 'B'),
          createEdge('e2', 'A', 'C'),
          createEdge('e3', 'B', 'D'),
          createEdge('e4', 'C', 'D'),
        ],
      };
      const result = analyzeWorkflowGraph(graph);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.topologicalNodeIds).toEqual(['A', 'B', 'C', 'D']);
      }
    });

    it('7. disconnected acyclic components succeed', () => {
      // Component 1: X -> Y
      // Component 2: A -> B
      const graph: WorkflowGraph = {
        nodes: [createNode('Y'), createNode('X'), createNode('B'), createNode('A')],
        edges: [createEdge('e1', 'X', 'Y'), createEdge('e2', 'A', 'B')],
      };
      const result = analyzeWorkflowGraph(graph);

      expect(result.success).toBe(true);
      if (result.success) {
        // Initial zero-indegree: A and X. Smallest is A.
        // A emits -> B becomes zero-indegree.
        // Zero-indegree in heap: B and X. Smallest is B.
        // B emits.
        // Zero-indegree in heap: X.
        // X emits -> Y becomes zero-indegree.
        // Y emits.
        expect(result.topologicalNodeIds).toEqual(['A', 'B', 'X', 'Y']);
      }
    });

    it('8. deterministic ordering across reordered node arrays', () => {
      const nodes1 = [createNode('C'), createNode('A'), createNode('B')];
      const nodes2 = [createNode('A'), createNode('B'), createNode('C')];
      const edges = [createEdge('e1', 'A', 'B'), createEdge('e2', 'B', 'C')];

      const res1 = analyzeWorkflowGraph({ nodes: nodes1, edges });
      const res2 = analyzeWorkflowGraph({ nodes: nodes2, edges });

      expect(res1.success).toBe(true);
      expect(res2.success).toBe(true);
      if (res1.success && res2.success) {
        expect(res1.topologicalNodeIds).toEqual(res2.topologicalNodeIds);
        expect(res1.topologicalNodeIds).toEqual(['A', 'B', 'C']);
      }
    });

    it('9. deterministic ordering across reordered edge arrays', () => {
      const nodes = [createNode('A'), createNode('B'), createNode('C')];
      const edges1 = [createEdge('e1', 'A', 'B'), createEdge('e2', 'A', 'C')];
      const edges2 = [createEdge('e2', 'A', 'C'), createEdge('e1', 'A', 'B')];

      const res1 = analyzeWorkflowGraph({ nodes, edges: edges1 });
      const res2 = analyzeWorkflowGraph({ nodes, edges: edges2 });

      expect(res1.success).toBe(true);
      expect(res2.success).toBe(true);
      if (res1.success && res2.success) {
        expect(res1.topologicalNodeIds).toEqual(res2.topologicalNodeIds);
        expect(res1.topologicalNodeIds).toEqual(['A', 'B', 'C']);
      }
    });

    it('10. tie-breaking always chooses smallest available node ID', () => {
      // Four independent nodes: Z, M, A, K
      const graph: WorkflowGraph = {
        nodes: [createNode('Z'), createNode('M'), createNode('A'), createNode('K')],
        edges: [],
      };
      const result = analyzeWorkflowGraph(graph);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.topologicalNodeIds).toEqual(['A', 'K', 'M', 'Z']);
      }
    });

    it('11. topological order respects every directed edge', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('task_5'),
          createNode('task_1'),
          createNode('task_3'),
          createNode('task_2'),
          createNode('task_4'),
        ],
        edges: [
          createEdge('e1', 'task_1', 'task_3'),
          createEdge('e2', 'task_3', 'task_5'),
          createEdge('e3', 'task_2', 'task_4'),
          createEdge('e4', 'task_4', 'task_5'),
        ],
      };
      const result = analyzeWorkflowGraph(graph);

      expect(result.success).toBe(true);
      if (result.success) {
        const order = result.topologicalNodeIds;
        const pos = new Map(order.map((id, idx) => [id, idx]));

        expect(pos.get('task_1')!).toBeLessThan(pos.get('task_3')!);
        expect(pos.get('task_3')!).toBeLessThan(pos.get('task_5')!);
        expect(pos.get('task_2')!).toBeLessThan(pos.get('task_4')!);
        expect(pos.get('task_4')!).toBeLessThan(pos.get('task_5')!);
      }
    });

    it('12. node IDs containing dots are treated as atomic IDs', () => {
      const graph: WorkflowGraph = {
        nodes: [createNode('system.node.alpha'), createNode('system.node.beta')],
        edges: [createEdge('e1', 'system.node.alpha', 'system.node.beta')],
      };
      const result = analyzeWorkflowGraph(graph);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.topologicalNodeIds).toEqual(['system.node.alpha', 'system.node.beta']);
      }
    });

    it('13. node IDs containing spaces or punctuation are preserved', () => {
      const graph: WorkflowGraph = {
        nodes: [createNode('Node (1) [start]'), createNode('Node (2) [finish]')],
        edges: [createEdge('e1', 'Node (1) [start]', 'Node (2) [finish]')],
      };
      const result = analyzeWorkflowGraph(graph);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.topologicalNodeIds).toEqual(['Node (1) [start]', 'Node (2) [finish]']);
      }
    });

    it('14. conditional edge metadata does not break topology analysis', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('cond_1', 'CONDITION'),
          createNode('true_branch'),
          createNode('false_branch'),
        ],
        edges: [
          createEdge('e1', 'cond_1', 'true_branch', 'TRUE'),
          createEdge('e2', 'cond_1', 'false_branch', 'FALSE'),
        ],
      };
      const result = analyzeWorkflowGraph(graph);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.topologicalNodeIds).toEqual(['cond_1', 'false_branch', 'true_branch']);
      }
    });

    it('15. different edge IDs with identical endpoints are accepted (parallel edges)', () => {
      const graph: WorkflowGraph = {
        nodes: [createNode('node_a'), createNode('node_b')],
        edges: [
          createEdge('edge_primary', 'node_a', 'node_b'),
          createEdge('edge_secondary', 'node_a', 'node_b'),
        ],
      };
      const result = analyzeWorkflowGraph(graph);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.topologicalNodeIds).toEqual(['node_a', 'node_b']);
      }
    });

    it('16. repeated analysis yields identical results', () => {
      const graph: WorkflowGraph = {
        nodes: [createNode('D'), createNode('B'), createNode('A'), createNode('C')],
        edges: [createEdge('e1', 'A', 'B'), createEdge('e2', 'B', 'D'), createEdge('e3', 'A', 'C')],
      };

      const res1 = analyzeWorkflowGraph(graph);
      const res2 = analyzeWorkflowGraph(graph);
      const res3 = analyzeWorkflowGraph(graph);

      expect(res1).toEqual(res2);
      expect(res2).toEqual(res3);
    });

    it('17. frozen input graph is accepted without mutation', () => {
      const graph: WorkflowGraph = Object.freeze({
        nodes: Object.freeze([
          Object.freeze(createNode('A')),
          Object.freeze(createNode('B')),
        ]) as unknown as WorkflowNode[],
        edges: Object.freeze([
          Object.freeze(createEdge('e1', 'A', 'B')),
        ]) as unknown as WorkflowEdge[],
      });

      expect(() => analyzeWorkflowGraph(graph)).not.toThrow();
      const result = analyzeWorkflowGraph(graph);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.topologicalNodeIds).toEqual(['A', 'B']);
      }
    });

    it('18. draft nodes with config: {} are accepted', () => {
      const graph: WorkflowGraph = {
        nodes: [createNode('draft_1', 'INPUT', {}), createNode('draft_2', 'OUTPUT', {})],
        edges: [createEdge('e1', 'draft_1', 'draft_2')],
      };
      const result = analyzeWorkflowGraph(graph);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.topologicalNodeIds).toEqual(['draft_1', 'draft_2']);
      }
    });
  });

  describe('Negative Cases', () => {
    it('19. duplicate node IDs rejected', () => {
      const graph: WorkflowGraph = {
        nodes: [createNode('A'), createNode('B'), createNode('A')],
        edges: [],
      };
      const result = analyzeWorkflowGraph(graph);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.issues).toHaveLength(1);
        expect(result.issues[0]).toEqual({
          code: 'DUPLICATE_NODE_ID',
          path: ['nodes', 2, 'id'],
          message: 'Duplicate node ID "A" at index 2',
        });
      }
    });

    it('20. duplicate edge IDs rejected', () => {
      const graph: WorkflowGraph = {
        nodes: [createNode('A'), createNode('B'), createNode('C')],
        edges: [createEdge('edge_dup', 'A', 'B'), createEdge('edge_dup', 'B', 'C')],
      };
      const result = analyzeWorkflowGraph(graph);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.issues).toHaveLength(1);
        expect(result.issues[0]).toEqual({
          code: 'DUPLICATE_EDGE_ID',
          path: ['edges', 1, 'id'],
          message: 'Duplicate edge ID "edge_dup" at index 1',
        });
      }
    });

    it('21. duplicate node IDs use exact string equality (case sensitivity)', () => {
      // 'node-A' vs 'node-a' are distinct and must NOT be rejected
      const graph: WorkflowGraph = {
        nodes: [createNode('node-A'), createNode('node-a')],
        edges: [],
      };
      const result = analyzeWorkflowGraph(graph);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.topologicalNodeIds).toEqual(['node-A', 'node-a']);
      }
    });

    it('22. duplicate edge IDs use exact string equality (case sensitivity)', () => {
      // 'edge-A' vs 'edge-a' are distinct and must NOT be rejected
      const graph: WorkflowGraph = {
        nodes: [createNode('node_1'), createNode('node_2')],
        edges: [createEdge('edge-A', 'node_1', 'node_2'), createEdge('edge-a', 'node_1', 'node_2')],
      };
      const result = analyzeWorkflowGraph(graph);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.topologicalNodeIds).toEqual(['node_1', 'node_2']);
      }
    });

    it('23. missing edge source rejected', () => {
      const graph: WorkflowGraph = {
        nodes: [createNode('valid_target')],
        edges: [createEdge('e1', 'ghost_source', 'valid_target')],
      };
      const result = analyzeWorkflowGraph(graph);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.issues).toHaveLength(1);
        expect(result.issues[0]).toEqual({
          code: 'MISSING_EDGE_SOURCE',
          path: ['edges', 0, 'source'],
          message: 'Edge "e1" at index 0 references non-existent source node "ghost_source"',
        });
      }
    });

    it('24. missing edge target rejected', () => {
      const graph: WorkflowGraph = {
        nodes: [createNode('valid_source')],
        edges: [createEdge('e1', 'valid_source', 'ghost_target')],
      };
      const result = analyzeWorkflowGraph(graph);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.issues).toHaveLength(1);
        expect(result.issues[0]).toEqual({
          code: 'MISSING_EDGE_TARGET',
          path: ['edges', 0, 'target'],
          message: 'Edge "e1" at index 0 references non-existent target node "ghost_target"',
        });
      }
    });

    it('25. both missing source and target produce diagnostics', () => {
      const graph: WorkflowGraph = {
        nodes: [createNode('standalone_node')],
        edges: [createEdge('e_dangling', 'ghost_src', 'ghost_tgt')],
      };
      const result = analyzeWorkflowGraph(graph);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.issues).toHaveLength(2);
        expect(result.issues[0]).toEqual({
          code: 'MISSING_EDGE_SOURCE',
          path: ['edges', 0, 'source'],
          message: 'Edge "e_dangling" at index 0 references non-existent source node "ghost_src"',
        });
        expect(result.issues[1]).toEqual({
          code: 'MISSING_EDGE_TARGET',
          path: ['edges', 0, 'target'],
          message: 'Edge "e_dangling" at index 0 references non-existent target node "ghost_tgt"',
        });
      }
    });

    it('26. multiple duplicate IDs produce multiple diagnostics', () => {
      const graph: WorkflowGraph = {
        nodes: [createNode('A'), createNode('B'), createNode('A'), createNode('B')],
        edges: [],
      };
      const result = analyzeWorkflowGraph(graph);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.issues).toHaveLength(2);
        expect(result.issues[0]?.code).toBe('DUPLICATE_NODE_ID');
        expect(result.issues[0]?.path).toEqual(['nodes', 2, 'id']);
        expect(result.issues[1]?.code).toBe('DUPLICATE_NODE_ID');
        expect(result.issues[1]?.path).toEqual(['nodes', 3, 'id']);
      }
    });

    it('27. multiple dangling edges produce multiple diagnostics', () => {
      const graph: WorkflowGraph = {
        nodes: [createNode('A')],
        edges: [createEdge('e1', 'A', 'missing_1'), createEdge('e2', 'missing_2', 'A')],
      };
      const result = analyzeWorkflowGraph(graph);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.issues).toHaveLength(2);
        expect(result.issues[0]?.code).toBe('MISSING_EDGE_TARGET');
        expect(result.issues[0]?.path).toEqual(['edges', 0, 'target']);
        expect(result.issues[1]?.code).toBe('MISSING_EDGE_SOURCE');
        expect(result.issues[1]?.path).toEqual(['edges', 1, 'source']);
      }
    });

    it('28. node duplicate issues retain correct node indices', () => {
      const graph: WorkflowGraph = {
        nodes: [createNode('n0'), createNode('n1'), createNode('n2'), createNode('n1')],
        edges: [],
      };
      const result = analyzeWorkflowGraph(graph);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.issues[0]?.path).toEqual(['nodes', 3, 'id']);
      }
    });

    it('29. edge duplicate issues retain correct edge indices', () => {
      const graph: WorkflowGraph = {
        nodes: [createNode('n1'), createNode('n2'), createNode('n3')],
        edges: [
          createEdge('edge_common', 'n1', 'n2'),
          createEdge('edge_other', 'n2', 'n3'),
          createEdge('edge_common', 'n1', 'n3'),
        ],
      };
      const result = analyzeWorkflowGraph(graph);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.issues[0]?.path).toEqual(['edges', 2, 'id']);
      }
    });

    it('30. referential errors retain correct edge indices', () => {
      const graph: WorkflowGraph = {
        nodes: [createNode('n1'), createNode('n2')],
        edges: [
          createEdge('e0', 'n1', 'n2'),
          createEdge('e1', 'n1', 'n2'),
          createEdge('e2', 'n1', 'n_missing'),
        ],
      };
      const result = analyzeWorkflowGraph(graph);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.issues[0]?.path).toEqual(['edges', 2, 'target']);
      }
    });

    it('31. self-loop causes cycle detection failure', () => {
      const graph: WorkflowGraph = {
        nodes: [createNode('node_self')],
        edges: [createEdge('e_self', 'node_self', 'node_self')],
      };
      const result = analyzeWorkflowGraph(graph);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.issues).toHaveLength(1);
        expect(result.issues[0]).toEqual({
          code: 'CYCLE_DETECTED',
          path: ['edges'],
          message: 'Workflow graph contains one or more directed cycles',
        });
      }
    });

    it('32. two-node cycle detected', () => {
      const graph: WorkflowGraph = {
        nodes: [createNode('A'), createNode('B')],
        edges: [createEdge('e1', 'A', 'B'), createEdge('e2', 'B', 'A')],
      };
      const result = analyzeWorkflowGraph(graph);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.issues).toEqual([
          {
            code: 'CYCLE_DETECTED',
            path: ['edges'],
            message: 'Workflow graph contains one or more directed cycles',
          },
        ]);
      }
    });

    it('33. three-or-more-node cycle detected', () => {
      const graph: WorkflowGraph = {
        nodes: [createNode('A'), createNode('B'), createNode('C')],
        edges: [createEdge('e1', 'A', 'B'), createEdge('e2', 'B', 'C'), createEdge('e3', 'C', 'A')],
      };
      const result = analyzeWorkflowGraph(graph);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.issues[0]?.code).toBe('CYCLE_DETECTED');
      }
    });

    it('34. cycle in disconnected component detected', () => {
      // Component 1 (Acyclic): A -> B
      // Component 2 (Cyclic): C -> D -> C
      const graph: WorkflowGraph = {
        nodes: [createNode('A'), createNode('B'), createNode('C'), createNode('D')],
        edges: [createEdge('e1', 'A', 'B'), createEdge('e2', 'C', 'D'), createEdge('e3', 'D', 'C')],
      };
      const result = analyzeWorkflowGraph(graph);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.issues).toEqual([
          {
            code: 'CYCLE_DETECTED',
            path: ['edges'],
            message: 'Workflow graph contains one or more directed cycles',
          },
        ]);
      }
    });

    it('35. nodes downstream of a cycle do not cause misleading cycle-membership claims', () => {
      // Cycle: A -> B -> A. Downstream: B -> C -> D.
      // C and D are not in the cycle, but cannot be processed by Kahn because indegree of B never resolves.
      // The issue must be a generic graph-level CYCLE_DETECTED at ['edges'], not accusing C or D.
      const graph: WorkflowGraph = {
        nodes: [createNode('A'), createNode('B'), createNode('C'), createNode('D')],
        edges: [
          createEdge('e1', 'A', 'B'),
          createEdge('e2', 'B', 'A'),
          createEdge('e3', 'B', 'C'),
          createEdge('e4', 'C', 'D'),
        ],
      };
      const result = analyzeWorkflowGraph(graph);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.issues).toEqual([
          {
            code: 'CYCLE_DETECTED',
            path: ['edges'],
            message: 'Workflow graph contains one or more directed cycles',
          },
        ]);
      }
    });

    it('36. no partial topological order is returned for cyclic graphs', () => {
      const graph: WorkflowGraph = {
        nodes: [createNode('A'), createNode('B')],
        edges: [createEdge('e1', 'A', 'B'), createEdge('e2', 'B', 'A')],
      };
      const result = analyzeWorkflowGraph(graph);

      expect(result.success).toBe(false);
      expect('topologicalNodeIds' in result).toBe(false);
    });

    it('37. no topological ordering is returned when duplicate identifiers exist', () => {
      const graph: WorkflowGraph = {
        nodes: [createNode('A'), createNode('A')],
        edges: [],
      };
      const result = analyzeWorkflowGraph(graph);

      expect(result.success).toBe(false);
      expect('topologicalNodeIds' in result).toBe(false);
      if (!result.success) {
        // Must NOT falsely report cycle
        expect(result.issues.some((i) => i.code === 'CYCLE_DETECTED')).toBe(false);
        expect(result.issues[0]?.code).toBe('DUPLICATE_NODE_ID');
      }
    });

    it('38. no topological ordering is returned for dangling edge references', () => {
      const graph: WorkflowGraph = {
        nodes: [createNode('A')],
        edges: [createEdge('e1', 'A', 'non_existent')],
      };
      const result = analyzeWorkflowGraph(graph);

      expect(result.success).toBe(false);
      expect('topologicalNodeIds' in result).toBe(false);
      if (!result.success) {
        // Must NOT falsely report cycle
        expect(result.issues.some((i) => i.code === 'CYCLE_DETECTED')).toBe(false);
        expect(result.issues[0]?.code).toBe('MISSING_EDGE_TARGET');
      }
    });
  });

  describe('Boundary and Compatibility Cases', () => {
    it('39. analysis results are JSON-serializable', () => {
      const successGraph: WorkflowGraph = {
        nodes: [createNode('A'), createNode('B')],
        edges: [createEdge('e1', 'A', 'B')],
      };
      const successRes = analyzeWorkflowGraph(successGraph);
      const serializedSuccess = JSON.parse(JSON.stringify(successRes));
      expect(serializedSuccess).toEqual(successRes);

      const failGraph: WorkflowGraph = {
        nodes: [createNode('A')],
        edges: [createEdge('e1', 'A', 'B')],
      };
      const failRes = analyzeWorkflowGraph(failGraph);
      const serializedFail = JSON.parse(JSON.stringify(failRes));
      expect(serializedFail).toEqual(failRes);
    });

    it('40. success/failure results have correct discriminants', () => {
      const successResult: GraphAnalysisResult = analyzeWorkflowGraph({
        nodes: [createNode('A')],
        edges: [],
      });
      if (successResult.success) {
        const ids: string[] = successResult.topologicalNodeIds;
        expect(ids).toEqual(['A']);
      } else {
        expect.unreachable('Should have succeeded');
      }

      const failResult: GraphAnalysisResult = analyzeWorkflowGraph({
        nodes: [createNode('A')],
        edges: [createEdge('e1', 'A', 'missing')],
      });
      if (!failResult.success) {
        const issues: GraphIntegrityIssue[] = failResult.issues;
        expect(issues.length).toBeGreaterThan(0);
      } else {
        expect.unreachable('Should have failed');
      }
    });

    it('41. invalid graph issues have stable machine-readable codes', () => {
      const graph: WorkflowGraph = {
        nodes: [createNode('A'), createNode('A')],
        edges: [createEdge('e1', 'A', 'missing'), createEdge('e1', 'missing', 'A')],
      };
      const result = analyzeWorkflowGraph(graph);

      expect(result.success).toBe(false);
      if (!result.success) {
        const codes = result.issues.map((i) => i.code);
        expect(codes).toContain('DUPLICATE_NODE_ID');
        expect(codes).toContain('DUPLICATE_EDGE_ID');
        expect(codes).toContain('MISSING_EDGE_TARGET');
        expect(codes).toContain('MISSING_EDGE_SOURCE');
      }
    });

    it('42. empty graph success does not imply publication readiness', () => {
      const graph: WorkflowGraph = { nodes: [], edges: [] };
      const result = analyzeWorkflowGraph(graph);

      // Graph is mathematically acyclic, but lacks INPUT and OUTPUT nodes required for publishing
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.topologicalNodeIds).toEqual([]);
      }
    });

    it('43. missing OUTPUT nodes are not rejected here', () => {
      const graph: WorkflowGraph = {
        nodes: [createNode('input_1', 'INPUT'), createNode('transform_1', 'TRANSFORM')],
        edges: [createEdge('e1', 'input_1', 'transform_1')],
      };
      const result = analyzeWorkflowGraph(graph);

      expect(result.success).toBe(true);
    });

    it('44. incomplete CONDITION branches are not rejected here', () => {
      // Only a TRUE branch, missing FALSE branch
      const graph: WorkflowGraph = {
        nodes: [createNode('cond_1', 'CONDITION'), createNode('branch_t', 'TRANSFORM')],
        edges: [createEdge('e1', 'cond_1', 'branch_t', 'TRUE')],
      };
      const result = analyzeWorkflowGraph(graph);

      expect(result.success).toBe(true);
    });

    it('45. unreachable nodes are not rejected here', () => {
      // Node A -> B, and orphaned isolated node C
      const graph: WorkflowGraph = {
        nodes: [createNode('A'), createNode('B'), createNode('C_orphan')],
        edges: [createEdge('e1', 'A', 'B')],
      };
      const result = analyzeWorkflowGraph(graph);

      expect(result.success).toBe(true);
      if (result.success) {
        // Zero-indegree: A and C_orphan. A < C_orphan.
        // A emits -> B becomes zero-indegree.
        // Zero-indegree in heap: B and C_orphan. B < C_orphan.
        // B emits.
        // C_orphan emits.
        expect(result.topologicalNodeIds).toEqual(['A', 'B', 'C_orphan']);
      }
    });

    it('46. nonexistent data references inside node configs are not rejected here', () => {
      const graph: WorkflowGraph = {
        nodes: [
          createNode('node_1', 'TRANSFORM', {
            targetKey: 'output',
            operation: 'json_pick',
            reference: {
              type: 'reference',
              target: 'node_output',
              nodeId: 'completely_nonexistent_upstream_node',
              path: ['prop'],
            },
          }),
        ],
        edges: [],
      };
      const result = analyzeWorkflowGraph(graph);

      expect(result.success).toBe(true);
    });

    it('47. the analyzer does not modify node or edge objects', () => {
      const originalNode: WorkflowNode = createNode('A', 'TRANSFORM', { custom: 'value' });
      const originalEdge: WorkflowEdge = createEdge('e1', 'A', 'B');
      const clonedNode = JSON.parse(JSON.stringify(originalNode));
      const clonedEdge = JSON.parse(JSON.stringify(originalEdge));

      const graph: WorkflowGraph = {
        nodes: [originalNode, createNode('B')],
        edges: [originalEdge],
      };

      analyzeWorkflowGraph(graph);

      expect(originalNode).toEqual(clonedNode);
      expect(originalEdge).toEqual(clonedEdge);
    });

    it('48. parallel edges correctly decrement target in-degree during traversal', () => {
      // Node A has two parallel edges to B, and B connects to C
      const graph: WorkflowGraph = {
        nodes: [createNode('A'), createNode('B'), createNode('C')],
        edges: [createEdge('e1', 'A', 'B'), createEdge('e2', 'A', 'B'), createEdge('e3', 'B', 'C')],
      };
      const result = analyzeWorkflowGraph(graph);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.topologicalNodeIds).toEqual(['A', 'B', 'C']);
      }
    });

    it('49. priority queue handles complex multi-way tie-breaking', () => {
      // 5 independent chains:
      // E1 -> E2
      // D1 -> D2
      // C1 -> C2
      // B1 -> B2
      // A1 -> A2
      const graph: WorkflowGraph = {
        nodes: [
          createNode('E2'),
          createNode('E1'),
          createNode('D2'),
          createNode('D1'),
          createNode('C2'),
          createNode('C1'),
          createNode('B2'),
          createNode('B1'),
          createNode('A2'),
          createNode('A1'),
        ],
        edges: [
          createEdge('eE', 'E1', 'E2'),
          createEdge('eD', 'D1', 'D2'),
          createEdge('eC', 'C1', 'C2'),
          createEdge('eB', 'B1', 'B2'),
          createEdge('eA', 'A1', 'A2'),
        ],
      };
      const result = analyzeWorkflowGraph(graph);

      expect(result.success).toBe(true);
      if (result.success) {
        // Available initially: A1, B1, C1, D1, E1
        // Pop A1 -> A2 enqueued
        // Available: A2, B1, C1, D1, E1 -> Pop A2
        // Available: B1, C1, D1, E1 -> Pop B1 -> B2 enqueued
        // Available: B2, C1, D1, E1 -> Pop B2
        // ...
        expect(result.topologicalNodeIds).toEqual([
          'A1',
          'A2',
          'B1',
          'B2',
          'C1',
          'C2',
          'D1',
          'D2',
          'E1',
          'E2',
        ]);
      }
    });
  });

  describe('TypeScript Inference & Contracts Boundary', () => {
    it('50. compile-time type verification', () => {
      const graph: WorkflowGraph = { nodes: [], edges: [] };
      const result: GraphAnalysisResult = analyzeWorkflowGraph(graph);

      if (result.success) {
        const successRes: GraphAnalysisSuccessResult = result;
        const _ids: string[] = successRes.topologicalNodeIds;
        const _issues: [] = successRes.issues;
        expect(_ids).toBeDefined();
        expect(_issues).toBeDefined();
      } else {
        const failureRes: GraphAnalysisFailureResult = result;
        const _issues: GraphIntegrityIssue[] = failureRes.issues;
        const _code: GraphIntegrityIssueCode = _issues[0]?.code ?? 'CYCLE_DETECTED';
        expect(_code).toBeDefined();
      }
    });
  });
});
