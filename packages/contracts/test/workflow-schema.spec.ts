import { describe, expect, it } from 'vitest';
import {
  WORKFLOW_IDENTIFIER_MAX_LENGTH,
  WorkflowEdgeSchema,
  WorkflowGraphSchema,
  WorkflowIdentifierSchema,
  WorkflowNodeSchema,
  WorkflowNodeTypeSchema,
  type WorkflowGraph,
  type WorkflowNode,
  type WorkflowNodeType,
} from '../src/index.js';

describe('Workflow Contracts & Schemas', () => {
  describe('WorkflowNodeTypeSchema', () => {
    const validNodeTypes: WorkflowNodeType[] = [
      'INPUT',
      'TRANSFORM',
      'CONDITION',
      'LLM',
      'MCP_TOOL',
      'APPROVAL',
      'OUTPUT',
    ];

    it.each(validNodeTypes)('accepts approved V1 node type: %s', (nodeType) => {
      const result = WorkflowNodeTypeSchema.safeParse(nodeType);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(nodeType);
      }
    });

    it('rejects unapproved or deferred node types such as AGENT', () => {
      expect(WorkflowNodeTypeSchema.safeParse('AGENT').success).toBe(false);
      expect(WorkflowNodeTypeSchema.safeParse('CUSTOM').success).toBe(false);
      expect(WorkflowNodeTypeSchema.safeParse('UNKNOWN').success).toBe(false);
      expect(WorkflowNodeTypeSchema.safeParse('').success).toBe(false);
      expect(WorkflowNodeTypeSchema.safeParse(123).success).toBe(false);
    });
  });

  describe('WorkflowIdentifierSchema', () => {
    it('accepts standard valid identifiers without mutating them', () => {
      const validIds = [
        'input-1',
        'node_abc_123',
        '550e8400-e29b-41d4-a716-446655440000',
        'a',
        'a'.repeat(WORKFLOW_IDENTIFIER_MAX_LENGTH),
      ];

      for (const id of validIds) {
        const result = WorkflowIdentifierSchema.safeParse(id);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe(id); // Confirms identity preservation (no trimming/mutations)
        }
      }
    });

    it('rejects empty and whitespace-only identifiers', () => {
      expect(WorkflowIdentifierSchema.safeParse('').success).toBe(false);
      expect(WorkflowIdentifierSchema.safeParse(' ').success).toBe(false);
      expect(WorkflowIdentifierSchema.safeParse('   ').success).toBe(false);
      expect(WorkflowIdentifierSchema.safeParse('\t').success).toBe(false);
      expect(WorkflowIdentifierSchema.safeParse('\n').success).toBe(false);
    });

    it('rejects identifiers exceeding maximum length limit', () => {
      const oversized = 'a'.repeat(WORKFLOW_IDENTIFIER_MAX_LENGTH + 1);
      const result = WorkflowIdentifierSchema.safeParse(oversized);
      expect(result.success).toBe(false);
    });

    it('rejects non-string values', () => {
      expect(WorkflowIdentifierSchema.safeParse(123).success).toBe(false);
      expect(WorkflowIdentifierSchema.safeParse(null).success).toBe(false);
      expect(WorkflowIdentifierSchema.safeParse(undefined).success).toBe(false);
      expect(WorkflowIdentifierSchema.safeParse({}).success).toBe(false);
    });
  });

  describe('WorkflowNodeSchema', () => {
    const validNode: WorkflowNode = {
      id: 'node-input-1',
      type: 'INPUT',
      position: { x: 100, y: 250.5 },
      config: {
        promptTemplate: 'Summarize PR #{{pr_number}}',
        maxTokens: 2048,
        enabled: true,
        metadata: {
          tags: ['github', 'automation'],
          author: null,
        },
      },
    };

    it('successfully parses a structurally valid node and preserves its data', () => {
      const result = WorkflowNodeSchema.safeParse(validNode);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validNode);
      }
    });

    it('accepts an empty config object', () => {
      const nodeWithEmptyConfig = {
        ...validNode,
        config: {},
      };
      const result = WorkflowNodeSchema.safeParse(nodeWithEmptyConfig);
      expect(result.success).toBe(true);
    });

    it('rejects missing required fields', () => {
      const withoutId = { type: 'INPUT', position: { x: 0, y: 0 }, config: {} };
      const withoutType = { id: 'n1', position: { x: 0, y: 0 }, config: {} };
      const withoutPosition = { id: 'n1', type: 'INPUT', config: {} };
      const withoutConfig = { id: 'n1', type: 'INPUT', position: { x: 0, y: 0 } };

      expect(WorkflowNodeSchema.safeParse(withoutId).success).toBe(false);
      expect(WorkflowNodeSchema.safeParse(withoutType).success).toBe(false);
      expect(WorkflowNodeSchema.safeParse(withoutPosition).success).toBe(false);
      expect(WorkflowNodeSchema.safeParse(withoutConfig).success).toBe(false);
    });

    it('rejects non-finite position coordinates', () => {
      const withNanX = { ...validNode, position: { x: Number.NaN, y: 0 } };
      const withInfY = { ...validNode, position: { x: 0, y: Number.POSITIVE_INFINITY } };
      const withNegInfX = { ...validNode, position: { x: Number.NEGATIVE_INFINITY, y: 0 } };
      const withStringCoord = { ...validNode, position: { x: '100' as unknown as number, y: 0 } };

      expect(WorkflowNodeSchema.safeParse(withNanX).success).toBe(false);
      expect(WorkflowNodeSchema.safeParse(withInfY).success).toBe(false);
      expect(WorkflowNodeSchema.safeParse(withNegInfX).success).toBe(false);
      expect(WorkflowNodeSchema.safeParse(withStringCoord).success).toBe(false);
    });

    it('rejects scalar or non-object configs', () => {
      expect(WorkflowNodeSchema.safeParse({ ...validNode, config: 'string' }).success).toBe(false);
      expect(WorkflowNodeSchema.safeParse({ ...validNode, config: 123 }).success).toBe(false);
      expect(WorkflowNodeSchema.safeParse({ ...validNode, config: null }).success).toBe(false);
      expect(WorkflowNodeSchema.safeParse({ ...validNode, config: [1, 2, 3] }).success).toBe(false);
    });

    it('rejects non-JSON-serializable config values', () => {
      const withFunction = {
        ...validNode,
        config: { fn: () => 'malformed' },
      };
      const withUndefined = {
        ...validNode,
        config: { undef: undefined },
      };

      expect(WorkflowNodeSchema.safeParse(withFunction).success).toBe(false);
      expect(WorkflowNodeSchema.safeParse(withUndefined).success).toBe(false);
    });

    it('rejects extra unexpected top-level structural properties due to strict mode', () => {
      const withExtraProperty = {
        ...validNode,
        unexpectedProperty: 'not-allowed',
      };
      expect(WorkflowNodeSchema.safeParse(withExtraProperty).success).toBe(false);
    });
  });

  describe('WorkflowEdgeSchema', () => {
    it('successfully parses a valid edge and preserves its data', () => {
      const edge = {
        id: 'edge-input-to-llm',
        source: 'node-input-1',
        target: 'node-llm-1',
      };
      const result = WorkflowEdgeSchema.safeParse(edge);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(edge);
      }
    });

    it('rejects missing or empty edge fields', () => {
      expect(WorkflowEdgeSchema.safeParse({ id: '', source: 'src', target: 'tgt' }).success).toBe(
        false,
      );
      expect(WorkflowEdgeSchema.safeParse({ id: 'e1', source: '   ', target: 'tgt' }).success).toBe(
        false,
      );
      expect(WorkflowEdgeSchema.safeParse({ id: 'e1', source: 'src', target: '' }).success).toBe(
        false,
      );
      expect(WorkflowEdgeSchema.safeParse({ source: 'src', target: 'tgt' }).success).toBe(false);
    });

    it('rejects extra unexpected edge properties due to strict mode', () => {
      const edgeWithExtra = {
        id: 'edge-1',
        source: 'src-1',
        target: 'tgt-1',
        label: 'speculative-label',
      };
      expect(WorkflowEdgeSchema.safeParse(edgeWithExtra).success).toBe(false);
    });
  });

  describe('WorkflowGraphSchema', () => {
    it('successfully parses a valid multi-node workflow graph', () => {
      const graph: WorkflowGraph = {
        nodes: [
          {
            id: 'node-in',
            type: 'INPUT',
            position: { x: 0, y: 0 },
            config: { event: 'pull_request.opened' },
          },
          {
            id: 'node-llm',
            type: 'LLM',
            position: { x: 250, y: 0 },
            config: { model: 'gemini-2.5-pro' },
          },
          {
            id: 'node-out',
            type: 'OUTPUT',
            position: { x: 500, y: 0 },
            config: { destination: 'github_comment' },
          },
        ],
        edges: [
          { id: 'edge-1', source: 'node-in', target: 'node-llm' },
          { id: 'edge-2', source: 'node-llm', target: 'node-out' },
        ],
      };

      const result = WorkflowGraphSchema.safeParse(graph);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(graph);
      }
    });

    it('accepts an empty graph as a structurally valid draft', () => {
      const emptyDraftGraph = {
        nodes: [],
        edges: [],
      };
      const result = WorkflowGraphSchema.safeParse(emptyDraftGraph);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(emptyDraftGraph);
      }
    });

    it('rejects malformed graph containers', () => {
      expect(WorkflowGraphSchema.safeParse({ nodes: 'not-array', edges: [] }).success).toBe(false);
      expect(WorkflowGraphSchema.safeParse({ nodes: [], edges: null }).success).toBe(false);
      expect(WorkflowGraphSchema.safeParse(null).success).toBe(false);
      expect(WorkflowGraphSchema.safeParse([]).success).toBe(false);
    });

    it('rejects unexpected top-level graph properties', () => {
      const graphWithExtra = {
        nodes: [],
        edges: [],
        userId: 'user-123', // Persistence fields forbidden at structural contract layer
      };
      expect(WorkflowGraphSchema.safeParse(graphWithExtra).success).toBe(false);
    });

    describe('Structural vs. Graph-Semantic Boundary Verification', () => {
      it('permits duplicate node IDs structurally (semantic uniqueness is deferred to graph engine)', () => {
        const graphWithDuplicateNodes = {
          nodes: [
            { id: 'duplicate-id', type: 'INPUT', position: { x: 0, y: 0 }, config: {} },
            { id: 'duplicate-id', type: 'OUTPUT', position: { x: 100, y: 100 }, config: {} },
          ],
          edges: [],
        };
        const result = WorkflowGraphSchema.safeParse(graphWithDuplicateNodes);
        // At the schema layer, arrays of valid nodes are structurally valid.
        // Semantic validation (duplicate ID rejection) is explicitly deferred to Milestone 2A-B.
        expect(result.success).toBe(true);
      });

      it('permits dangling edges structurally (node reference integrity is deferred to graph engine)', () => {
        const graphWithDanglingEdge = {
          nodes: [{ id: 'node-1', type: 'INPUT', position: { x: 0, y: 0 }, config: {} }],
          edges: [{ id: 'edge-1', source: 'node-1', target: 'non-existent-node' }],
        };
        const result = WorkflowGraphSchema.safeParse(graphWithDanglingEdge);
        expect(result.success).toBe(true);
      });

      it('permits cyclical edges structurally (DAG cycle detection is deferred to graph engine)', () => {
        const graphWithCycle = {
          nodes: [
            { id: 'node-a', type: 'INPUT', position: { x: 0, y: 0 }, config: {} },
            { id: 'node-b', type: 'TRANSFORM', position: { x: 100, y: 0 }, config: {} },
          ],
          edges: [
            { id: 'edge-ab', source: 'node-a', target: 'node-b' },
            { id: 'edge-ba', source: 'node-b', target: 'node-a' },
          ],
        };
        const result = WorkflowGraphSchema.safeParse(graphWithCycle);
        expect(result.success).toBe(true);
      });
    });
  });
});
