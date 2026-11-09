import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  ConditionOutcomeSchema,
  WorkflowEdgeSchema,
  WorkflowGraphSchema,
  type ConditionOutcome,
  type WorkflowEdge,
  type WorkflowGraph,
} from '../src/index.js';

describe('Condition Edge Metadata Schema', () => {
  describe('TypeScript Type Inference Verification', () => {
    it('infers exact types matching ConditionOutcome and WorkflowEdge declarations', () => {
      expectTypeOf<ConditionOutcome>().toEqualTypeOf<'TRUE' | 'FALSE'>();

      expectTypeOf<WorkflowEdge>().toEqualTypeOf<{
        id: string;
        source: string;
        target: string;
        conditionOutcome?: 'TRUE' | 'FALSE' | undefined;
      }>();
    });
  });

  describe('Positive Validation Tests', () => {
    it('1. successfully parses a standard 3-field edge without conditionOutcome', () => {
      const edge = {
        id: 'edge-standard-1',
        source: 'node-input-1',
        target: 'node-transform-1',
      };
      const result = WorkflowEdgeSchema.safeParse(edge);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(edge);
        expect(result.data.conditionOutcome).toBeUndefined();
      }
    });

    it('2. successfully parses an edge with conditionOutcome set to TRUE', () => {
      const edge: WorkflowEdge = {
        id: 'edge-cond-true',
        source: 'node-cond-1',
        target: 'node-pass-1',
        conditionOutcome: 'TRUE',
      };
      const result = WorkflowEdgeSchema.safeParse(edge);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(edge);
        expect(result.data.conditionOutcome).toBe('TRUE');
      }
    });

    it('3. successfully parses an edge with conditionOutcome set to FALSE', () => {
      const edge: WorkflowEdge = {
        id: 'edge-cond-false',
        source: 'node-cond-1',
        target: 'node-fail-1',
        conditionOutcome: 'FALSE',
      };
      const result = WorkflowEdgeSchema.safeParse(edge);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(edge);
        expect(result.data.conditionOutcome).toBe('FALSE');
      }
    });

    it('4. preserves edge identifiers without trimming or modification', () => {
      const edge = {
        id: 'edge_custom.identifier-123',
        source: 'source_node.identifier-abc',
        target: 'target_node.identifier-xyz',
        conditionOutcome: 'TRUE' as const,
      };
      const result = WorkflowEdgeSchema.safeParse(edge);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe(edge.id);
        expect(result.data.source).toBe(edge.source);
        expect(result.data.target).toBe(edge.target);
      }
    });
  });

  describe('Negative Validation Tests', () => {
    it('5. rejects invalid conditionOutcome values', () => {
      const invalidOutcomes = ['true', 'false', 'True', 'False', 'MAYBE', 'UNKNOWN', 1, 0, null];

      for (const outcome of invalidOutcomes) {
        const edge = {
          id: 'edge-invalid-outcome',
          source: 'node-1',
          target: 'node-2',
          conditionOutcome: outcome,
        };
        const result = WorkflowEdgeSchema.safeParse(edge);
        expect(result.success).toBe(false);
      }
    });

    it('6. rejects explicit undefined for conditionOutcome', () => {
      const edgeWithExplicitUndefined = {
        id: 'edge-explicit-undef',
        source: 'node-1',
        target: 'node-2',
        conditionOutcome: undefined,
      };
      const result = WorkflowEdgeSchema.safeParse(edgeWithExplicitUndefined);
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find(
          (i) => i.path[0] === 'conditionOutcome' && i.message.includes('explicitly undefined'),
        );
        expect(issue).toBeDefined();
      }
    });

    it('7. rejects unexpected extra properties due to strict mode', () => {
      const edgeWithExtra = {
        id: 'edge-extra',
        source: 'node-1',
        target: 'node-2',
        conditionOutcome: 'TRUE',
        label: 'speculative-label',
      };
      expect(WorkflowEdgeSchema.safeParse(edgeWithExtra).success).toBe(false);

      const edgeWithHandle = {
        id: 'edge-handle',
        source: 'node-1',
        target: 'node-2',
        conditionOutcome: 'TRUE',
        sourceHandle: 'TRUE',
      };
      expect(WorkflowEdgeSchema.safeParse(edgeWithHandle).success).toBe(false);
    });

    it('8. rejects missing or empty mandatory identifier fields', () => {
      expect(
        WorkflowEdgeSchema.safeParse({
          id: '',
          source: 'src',
          target: 'tgt',
          conditionOutcome: 'TRUE',
        }).success,
      ).toBe(false);

      expect(
        WorkflowEdgeSchema.safeParse({
          id: 'e1',
          source: '   ',
          target: 'tgt',
          conditionOutcome: 'TRUE',
        }).success,
      ).toBe(false);

      expect(
        WorkflowEdgeSchema.safeParse({
          id: 'e1',
          source: 'src',
          target: '',
          conditionOutcome: 'TRUE',
        }).success,
      ).toBe(false);

      expect(
        WorkflowEdgeSchema.safeParse({
          source: 'src',
          target: 'tgt',
          conditionOutcome: 'TRUE',
        }).success,
      ).toBe(false);
    });
  });

  describe('Integration with WorkflowGraphSchema', () => {
    it('9. parses a workflow graph containing only standard edges without conditionOutcome', () => {
      const graph: WorkflowGraph = {
        nodes: [
          {
            id: 'n1',
            type: 'INPUT',
            position: { x: 0, y: 0 },
            config: {},
          },
          {
            id: 'n2',
            type: 'OUTPUT',
            position: { x: 100, y: 0 },
            config: {},
          },
        ],
        edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
      };
      const result = WorkflowGraphSchema.safeParse(graph);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(graph);
      }
    });

    it('10. parses a workflow graph containing conditional branch edges', () => {
      const graph: WorkflowGraph = {
        nodes: [
          {
            id: 'node-in',
            type: 'INPUT',
            position: { x: 0, y: 0 },
            config: {},
          },
          {
            id: 'node-cond',
            type: 'CONDITION',
            position: { x: 200, y: 0 },
            config: {},
          },
          {
            id: 'node-true-branch',
            type: 'OUTPUT',
            position: { x: 400, y: -50 },
            config: {},
          },
          {
            id: 'node-false-branch',
            type: 'OUTPUT',
            position: { x: 400, y: 50 },
            config: {},
          },
        ],
        edges: [
          { id: 'edge-to-cond', source: 'node-in', target: 'node-cond' },
          {
            id: 'edge-true',
            source: 'node-cond',
            target: 'node-true-branch',
            conditionOutcome: 'TRUE',
          },
          {
            id: 'edge-false',
            source: 'node-cond',
            target: 'node-false-branch',
            conditionOutcome: 'FALSE',
          },
        ],
      };
      const result = WorkflowGraphSchema.safeParse(graph);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(graph);
      }
    });
  });

  describe('Schema Boundaries (Milestone 2A Schema vs Milestone 2B Graph Validation)', () => {
    it('11. schema allows CONDITION node with zero branch edges at structural level', () => {
      const graphWithNoBranches: WorkflowGraph = {
        nodes: [
          {
            id: 'cond-node',
            type: 'CONDITION',
            position: { x: 0, y: 0 },
            config: {},
          },
        ],
        edges: [],
      };
      // Structural schema does not check graph topology completeness
      expect(WorkflowGraphSchema.safeParse(graphWithNoBranches).success).toBe(true);
    });

    it('12. schema allows duplicate condition outcomes or non-CONDITION source at structural level', () => {
      const graphWithDuplicateTrue: WorkflowGraph = {
        nodes: [
          { id: 'n1', type: 'CONDITION', position: { x: 0, y: 0 }, config: {} },
          { id: 'n2', type: 'OUTPUT', position: { x: 100, y: 0 }, config: {} },
          { id: 'n3', type: 'OUTPUT', position: { x: 100, y: 100 }, config: {} },
        ],
        edges: [
          { id: 'e1', source: 'n1', target: 'n2', conditionOutcome: 'TRUE' },
          { id: 'e2', source: 'n1', target: 'n3', conditionOutcome: 'TRUE' },
        ],
      };
      // Deferred to Milestone 2B graph analysis algorithms
      expect(WorkflowGraphSchema.safeParse(graphWithDuplicateTrue).success).toBe(true);
    });

    it('13. direct ConditionOutcomeSchema validation', () => {
      expect(ConditionOutcomeSchema.safeParse('TRUE').success).toBe(true);
      expect(ConditionOutcomeSchema.safeParse('FALSE').success).toBe(true);
      expect(ConditionOutcomeSchema.safeParse('OTHER').success).toBe(false);
    });
  });
});
