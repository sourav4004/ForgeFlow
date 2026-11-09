import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  formatValidationPath,
  validateNodeConfig,
  validateWorkflowNodeConfigs,
  WorkflowGraphSchema,
  WorkflowNodeSchema,
  WorkflowNodeTypeSchema,
  type NodeConfigValidationIssue,
  type NodeConfigValidationResult,
  type WorkflowGraph,
  type WorkflowNode,
  type WorkflowNodeConfigValidationIssue,
  type WorkflowNodeConfigValidationResult,
  type WorkflowNodeType,
} from '../src/index.js';

describe('Workflow-Level Node Configuration Validation and Diagnostics', () => {
  // Canonical valid configuration fixtures for each of the 7 approved node types
  const validInputConfig = {
    fields: [
      { name: 'repoName', type: 'string', required: true, description: 'Target GitHub repo' },
      { name: 'prNumber', type: 'number', required: true, defaultValue: 101 },
    ],
  };

  const validTransformConfig = {
    rules: [
      {
        operation: 'json_set' as const,
        targetKey: 'repoSlug',
        value: {
          type: 'reference' as const,
          reference: { source: 'input' as const, field: 'repoName', path: [] },
        },
      },
    ],
  };

  const validConditionConfig = {
    operator: 'greater_than' as const,
    left: {
      type: 'reference' as const,
      reference: { source: 'input' as const, field: 'prNumber', path: [] },
    },
    right: {
      type: 'literal' as const,
      value: 0,
    },
  };

  const validLlmConfig = {
    provider: 'anthropic',
    model: 'claude-3-7-sonnet',
    prompt: {
      type: 'literal' as const,
      value: 'Review this PR diff',
    },
    temperature: 0.2,
    maxTokens: 2048,
  };

  const validMcpToolConfig = {
    integrationRef: 'github-app',
    toolName: 'create_issue_comment',
    arguments: {
      body: {
        type: 'literal' as const,
        value: 'LGTM',
      },
    },
    timeoutMs: 15000,
  };

  const validApprovalConfig = {
    title: 'Authorize PR comment',
    policy: {
      roles: ['OWNER' as const, 'ADMIN' as const],
    },
    timeoutMinutes: 1440,
    timeoutAction: 'EXPIRE' as const,
  };

  const validOutputConfig = {
    payloadMapping: {
      result: {
        type: 'literal' as const,
        value: 'success',
      },
    },
  };

  const canonicalConfigs: Record<WorkflowNodeType, unknown> = {
    INPUT: validInputConfig,
    TRANSFORM: validTransformConfig,
    CONDITION: validConditionConfig,
    LLM: validLlmConfig,
    MCP_TOOL: validMcpToolConfig,
    APPROVAL: validApprovalConfig,
    OUTPUT: validOutputConfig,
  };

  // =========================================================================
  // TypeScript Type Inference Verification (Section 14)
  // =========================================================================
  describe('TypeScript Type Inference Verification', () => {
    it('narrows NodeConfigValidationResult on success discriminant', () => {
      const result = validateNodeConfig('LLM', validLlmConfig);
      expectTypeOf(result).toEqualTypeOf<NodeConfigValidationResult>();
      if (result.success) {
        expectTypeOf(result.issues).toEqualTypeOf<readonly []>();
      } else {
        expectTypeOf(result.issues).toEqualTypeOf<ReadonlyArray<NodeConfigValidationIssue>>();
      }
    });

    it('narrows WorkflowNodeConfigValidationResult on success discriminant', () => {
      const graph: WorkflowGraph = { nodes: [], edges: [] };
      const result = validateWorkflowNodeConfigs(graph);
      expectTypeOf(result).toEqualTypeOf<WorkflowNodeConfigValidationResult>();
      if (result.success) {
        expectTypeOf(result.issues).toEqualTypeOf<readonly []>();
      } else {
        expectTypeOf(result.issues).toEqualTypeOf<
          ReadonlyArray<WorkflowNodeConfigValidationIssue>
        >();
      }
    });

    it('verifies WorkflowNodeConfigValidationIssue shape and types', () => {
      expectTypeOf<WorkflowNodeConfigValidationIssue['nodeIndex']>().toEqualTypeOf<number>();
      expectTypeOf<WorkflowNodeConfigValidationIssue['nodeId']>().toEqualTypeOf<string>();
      expectTypeOf<
        WorkflowNodeConfigValidationIssue['nodeType']
      >().toEqualTypeOf<WorkflowNodeType>();
      expectTypeOf<WorkflowNodeConfigValidationIssue['path']>().toEqualTypeOf<
        ReadonlyArray<string | number>
      >();
      expectTypeOf<WorkflowNodeConfigValidationIssue['message']>().toEqualTypeOf<string>();
      expectTypeOf<WorkflowNodeConfigValidationIssue['code']>().toEqualTypeOf<string>();
      expectTypeOf<WorkflowNodeConfigValidationIssue['displayPath']>().toEqualTypeOf<
        string | undefined
      >();
    });

    it('accepts valid types and rejects invalid ones at compile time', () => {
      const _validType: WorkflowNodeType = 'LLM';
      validateNodeConfig(_validType, {});

      // @ts-expect-error - 'AGENT' is not an approved WorkflowNodeType
      validateNodeConfig('AGENT', {});

      const validGraph: WorkflowGraph = { nodes: [], edges: [] };
      validateWorkflowNodeConfigs(validGraph);
    });
  });

  // =========================================================================
  // Helper: formatValidationPath Tests
  // =========================================================================
  describe('formatValidationPath helper', () => {
    it('formats standard paths with dot notation and array brackets', () => {
      expect(formatValidationPath(['nodes', 3, 'config', 'prompt'])).toBe('nodes[3].config.prompt');
      expect(formatValidationPath(['nodes', 2, 'config', 'rules', 1, 'right', 'value'])).toBe(
        'nodes[2].config.rules[1].right.value',
      );
      expect(formatValidationPath(['nodes', 4, 'config', 'policy', 'roles', 1])).toBe(
        'nodes[4].config.policy.roles[1]',
      );
    });

    it('formats keys containing dots or spaces with quoted bracket notation', () => {
      expect(formatValidationPath(['nodes', 0, 'config', 'payloadMapping', 'result.summary'])).toBe(
        'nodes[0].config.payloadMapping["result.summary"]',
      );
      expect(
        formatValidationPath(['nodes', 0, 'config', 'payloadMapping', 'field with spaces']),
      ).toBe('nodes[0].config.payloadMapping["field with spaces"]');
    });

    it('formats keys containing double quotes with escaped quotes', () => {
      const formatted = formatValidationPath([
        'nodes',
        0,
        'config',
        'payloadMapping',
        'field"quote',
      ]);
      expect(formatted).toBe('nodes[0].config.payloadMapping["field\\"quote"]');
      expect(formatted).not.toContain('field"quote');
    });

    it('formats keys containing backslashes with escaped backslashes', () => {
      const formatted = formatValidationPath(['nodes', 0, 'config', 'payloadMapping', 'path\\sep']);
      expect(formatted).toBe('nodes[0].config.payloadMapping["path\\\\sep"]');
    });

    it('formats keys containing newlines and control characters without raw control characters in output', () => {
      const withNewline = formatValidationPath(['nodes', 0, 'config', 'line1\nline2']);
      expect(withNewline).toBe('nodes[0].config["line1\\nline2"]');
      expect(withNewline).not.toContain('\n');

      const withTab = formatValidationPath(['nodes', 0, 'config', 'tab\there']);
      expect(withTab).toBe('nodes[0].config["tab\\there"]');
      expect(withTab).not.toContain('\t');

      const withCR = formatValidationPath(['nodes', 0, 'config', 'cr\rhere']);
      expect(withCR).toBe('nodes[0].config["cr\\rhere"]');
      expect(withCR).not.toContain('\r');

      const withNull = formatValidationPath(['nodes', 0, 'config', 'null\0here']);
      expect(withNull).toBe('nodes[0].config["null\\u0000here"]');
      expect(withNull).not.toContain('\0');
    });

    it('formats keys containing Unicode text safely', () => {
      const formatted = formatValidationPath(['nodes', 0, 'config', 'field_🚀']);
      expect(formatted).toBe('nodes[0].config["field_🚀"]');
    });

    it('formats keys containing punctuation or brackets with quoted bracket notation', () => {
      expect(formatValidationPath(['nodes', 0, 'config', 'field[0]'])).toBe(
        'nodes[0].config["field[0]"]',
      );
      expect(formatValidationPath(['nodes', 0, 'config', 'hyphen-key'])).toBe(
        'nodes[0].config["hyphen-key"]',
      );
    });

    it('distinguishes numeric indices from string digit keys', () => {
      expect(formatValidationPath(['nodes', 5])).toBe('nodes[5]');
      expect(formatValidationPath(['nodes', '5'])).toBe('nodes["5"]');
    });

    it('handles leading non-standard segments or numbers correctly', () => {
      expect(formatValidationPath(['custom.root', 'sub'])).toBe('["custom.root"].sub');
      expect(formatValidationPath([0, 'sub'])).toBe('[0].sub');
      expect(formatValidationPath(['custom.root', 1])).toBe('["custom.root"][1]');
    });

    it('returns empty string for empty path', () => {
      expect(formatValidationPath([])).toBe('');
    });
  });

  // =========================================================================
  // Positive Validation Tests (Section 13: 1–12)
  // =========================================================================
  describe('Positive Validation Tests', () => {
    it('1. validateNodeConfig accepts valid INPUT config', () => {
      const result = validateNodeConfig('INPUT', validInputConfig);
      expect(result.success).toBe(true);
      expect(result.issues).toEqual([]);
    });

    it('2. validateNodeConfig accepts valid TRANSFORM config', () => {
      const result = validateNodeConfig('TRANSFORM', validTransformConfig);
      expect(result.success).toBe(true);
      expect(result.issues).toEqual([]);
    });

    it('3. validateNodeConfig accepts valid CONDITION config', () => {
      const result = validateNodeConfig('CONDITION', validConditionConfig);
      expect(result.success).toBe(true);
      expect(result.issues).toEqual([]);
    });

    it('4. validateNodeConfig accepts valid LLM config', () => {
      const result = validateNodeConfig('LLM', validLlmConfig);
      expect(result.success).toBe(true);
      expect(result.issues).toEqual([]);
    });

    it('5. validateNodeConfig accepts valid MCP_TOOL config', () => {
      const result = validateNodeConfig('MCP_TOOL', validMcpToolConfig);
      expect(result.success).toBe(true);
      expect(result.issues).toEqual([]);
    });

    it('6. validateNodeConfig accepts valid APPROVAL config', () => {
      const result = validateNodeConfig('APPROVAL', validApprovalConfig);
      expect(result.success).toBe(true);
      expect(result.issues).toEqual([]);
    });

    it('7. validateNodeConfig accepts valid OUTPUT config', () => {
      const result = validateNodeConfig('OUTPUT', validOutputConfig);
      expect(result.success).toBe(true);
      expect(result.issues).toEqual([]);
    });

    it('8. validateWorkflowNodeConfigs accepts a graph with all seven valid node configurations', () => {
      const types = WorkflowNodeTypeSchema.options;
      const graph = {
        nodes: types.map((type, idx) => ({
          id: `node-${type.toLowerCase()}-${idx}`,
          type,
          position: { x: idx * 100, y: 0 },
          config: canonicalConfigs[type] as Record<string, unknown>,
        })),
        edges: [],
      };

      const result = validateWorkflowNodeConfigs(graph as unknown as WorkflowGraph);
      expect(result.success).toBe(true);
      expect(result.issues).toEqual([]);
    });

    it('9. validateWorkflowNodeConfigs accepts an empty graph at configuration level', () => {
      const emptyGraph: WorkflowGraph = { nodes: [], edges: [] };
      const result = validateWorkflowNodeConfigs(emptyGraph);
      expect(result.success).toBe(true);
      expect(result.issues).toEqual([]);
    });

    it('10. valid node configs with unresolved upstream references still pass configuration validation', () => {
      const graph: WorkflowGraph = {
        nodes: [
          {
            id: 'node-transform-1',
            type: 'TRANSFORM',
            position: { x: 0, y: 0 },
            config: {
              rules: [
                {
                  operation: 'json_pick',
                  targetKey: 'extracted',
                  source: {
                    source: 'node_output',
                    nodeId: 'nonexistent-ancestor-node-xyz',
                    path: ['some', 'path'],
                  },
                },
              ],
            },
          },
        ],
        edges: [],
      };

      const result = validateWorkflowNodeConfigs(graph);
      expect(result.success).toBe(true);
      expect(result.issues).toEqual([]);
    });

    it('11. repeated validation returns equivalent results (pure and deterministic)', () => {
      const graph: WorkflowGraph = {
        nodes: [
          {
            id: 'node-llm-1',
            type: 'LLM',
            position: { x: 0, y: 0 },
            config: validLlmConfig,
          },
        ],
        edges: [],
      };

      const result1 = validateWorkflowNodeConfigs(graph);
      const result2 = validateWorkflowNodeConfigs(graph);
      expect(result1).toEqual(result2);
    });

    it('12. validation does not mutate the input graph or its node configurations', () => {
      const originalGraph: WorkflowGraph = {
        nodes: [
          {
            id: 'node-input-1',
            type: 'INPUT',
            position: { x: 10, y: 20 },
            config: { fields: [] },
          },
        ],
        edges: [],
      };

      const snapshotBefore = JSON.parse(JSON.stringify(originalGraph));
      validateWorkflowNodeConfigs(originalGraph);
      expect(originalGraph).toEqual(snapshotBefore);
    });
  });

  // =========================================================================
  // Negative and Diagnostic Aggregation Tests (Section 13: 13–30)
  // =========================================================================
  describe('Negative and Diagnostic Aggregation Tests', () => {
    it('13. missing required INPUT config fields produce issues', () => {
      const result = validateNodeConfig('INPUT', {});
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.issues.length).toBeGreaterThan(0);
        expect(result.issues.some((i) => i.path.includes('fields'))).toBe(true);
      }
    });

    it('14. invalid TRANSFORM rules produce issues', () => {
      const result = validateNodeConfig('TRANSFORM', { rules: [] });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.issues.some((i) => i.path.includes('rules'))).toBe(true);
      }
    });

    it('15. invalid CONDITION operands produce issues', () => {
      const result = validateNodeConfig('CONDITION', {
        operator: 'greater_than',
        left: { type: 'literal', value: 10 },
        // right operand missing
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.issues.length).toBeGreaterThan(0);
      }
    });

    it('16. invalid LLM prompt produces issues', () => {
      const result = validateNodeConfig('LLM', {
        ...validLlmConfig,
        prompt: { type: 'literal', value: '' }, // empty prompt rejected
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.issues.some((i) => i.path.includes('prompt'))).toBe(true);
      }
    });

    it('17. invalid MCP_TOOL integration/tool fields produce issues', () => {
      const result = validateNodeConfig('MCP_TOOL', {
        ...validMcpToolConfig,
        toolName: '', // empty toolName rejected
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.issues.some((i) => i.path.includes('toolName'))).toBe(true);
      }
    });

    it('18. invalid APPROVAL policy produces issues', () => {
      const result = validateNodeConfig('APPROVAL', {
        ...validApprovalConfig,
        policy: { roles: [] }, // empty roles rejected
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.issues.some((i) => i.path.includes('roles'))).toBe(true);
      }
    });

    it('19. invalid OUTPUT mapping produces issues', () => {
      const result = validateNodeConfig('OUTPUT', {
        payloadMapping: {}, // empty payloadMapping rejected
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.issues.some((i) => i.path.includes('payloadMapping'))).toBe(true);
      }
    });

    it('20. multiple invalid nodes in a graph produce aggregated diagnostics without short-circuiting', () => {
      const graph: WorkflowGraph = {
        nodes: [
          {
            id: 'node-llm-1',
            type: 'LLM',
            position: { x: 0, y: 0 },
            config: {}, // invalid LLM config
          },
          {
            id: 'node-approval-1',
            type: 'APPROVAL',
            position: { x: 100, y: 0 },
            config: {}, // invalid APPROVAL config
          },
        ],
        edges: [],
      };

      const result = validateWorkflowNodeConfigs(graph);
      expect(result.success).toBe(false);
      if (!result.success) {
        const nodeIds = new Set(result.issues.map((i) => i.nodeId));
        expect(nodeIds.has('node-llm-1')).toBe(true);
        expect(nodeIds.has('node-approval-1')).toBe(true);
        expect(result.issues.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('21. multiple independent errors from one node are all preserved', () => {
      const graph: WorkflowGraph = {
        nodes: [
          {
            id: 'node-approval-1',
            type: 'APPROVAL',
            position: { x: 0, y: 0 },
            config: {
              title: '', // empty title (error 1)
              policy: { roles: [] }, // empty roles (error 2)
              timeoutMinutes: 0, // below minimum 1 (error 3)
              timeoutAction: 'INVALID_ACTION', // invalid enum (error 4)
            },
          },
        ],
        edges: [],
      };

      const result = validateWorkflowNodeConfigs(graph);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.issues.length).toBeGreaterThanOrEqual(3);
        const paths = result.issues.map((i) => i.displayPath);
        expect(paths.some((p) => p?.includes('title'))).toBe(true);
        expect(paths.some((p) => p?.includes('timeoutMinutes'))).toBe(true);
      }
    });

    it('22. errors retain the correct original nodeIndex', () => {
      const graph: WorkflowGraph = {
        nodes: [
          {
            id: 'valid-node-0',
            type: 'INPUT',
            position: { x: 0, y: 0 },
            config: validInputConfig,
          },
          {
            id: 'invalid-node-1',
            type: 'LLM',
            position: { x: 100, y: 0 },
            config: {},
          },
          {
            id: 'valid-node-2',
            type: 'OUTPUT',
            position: { x: 200, y: 0 },
            config: validOutputConfig,
          },
          {
            id: 'invalid-node-3',
            type: 'APPROVAL',
            position: { x: 300, y: 0 },
            config: {},
          },
        ],
        edges: [],
      };

      const result = validateWorkflowNodeConfigs(graph);
      expect(result.success).toBe(false);
      if (!result.success) {
        const node1Issues = result.issues.filter((i) => i.nodeId === 'invalid-node-1');
        const node3Issues = result.issues.filter((i) => i.nodeId === 'invalid-node-3');

        expect(node1Issues.length).toBeGreaterThan(0);
        expect(node3Issues.length).toBeGreaterThan(0);

        for (const issue of node1Issues) {
          expect(issue.nodeIndex).toBe(1);
          expect(issue.path[0]).toBe('nodes');
          expect(issue.path[1]).toBe(1);
        }

        for (const issue of node3Issues) {
          expect(issue.nodeIndex).toBe(3);
          expect(issue.path[0]).toBe('nodes');
          expect(issue.path[1]).toBe(3);
        }
      }
    });

    it('23. errors retain the correct nodeId', () => {
      const graph: WorkflowGraph = {
        nodes: [
          {
            id: 'specific-node-id-xyz',
            type: 'OUTPUT',
            position: { x: 0, y: 0 },
            config: { payloadMapping: {} },
          },
        ],
        edges: [],
      };

      const result = validateWorkflowNodeConfigs(graph);
      expect(result.success).toBe(false);
      if (!result.success) {
        for (const issue of result.issues) {
          expect(issue.nodeId).toBe('specific-node-id-xyz');
        }
      }
    });

    it('24. errors retain the correct nodeType', () => {
      const graph: WorkflowGraph = {
        nodes: [
          {
            id: 'node-mcp-1',
            type: 'MCP_TOOL',
            position: { x: 0, y: 0 },
            config: {},
          },
        ],
        edges: [],
      };

      const result = validateWorkflowNodeConfigs(graph);
      expect(result.success).toBe(false);
      if (!result.success) {
        for (const issue of result.issues) {
          expect(issue.nodeType).toBe('MCP_TOOL');
        }
      }
    });

    it('25. deeply nested issue paths retain numeric indices', () => {
      const graph: WorkflowGraph = {
        nodes: [
          {
            id: 'transform-node-1',
            type: 'TRANSFORM',
            position: { x: 0, y: 0 },
            config: {
              rules: [
                {
                  operation: 'math_op',
                  targetKey: 'sum',
                  operator: 'divide',
                  left: { type: 'literal', value: 10 },
                  right: { type: 'literal', value: 0 }, // Division by zero error
                },
              ],
            },
          },
        ],
        edges: [],
      };

      const result = validateWorkflowNodeConfigs(graph);
      expect(result.success).toBe(false);
      if (!result.success) {
        const divByZeroIssue = result.issues.find((i) => i.message.includes('division by zero'));
        expect(divByZeroIssue).toBeDefined();
        // Path should be ['nodes', 0, 'config', 'rules', 0, 'right', 'value']
        expect(divByZeroIssue?.path).toEqual(['nodes', 0, 'config', 'rules', 0, 'right', 'value']);
        expect(typeof divByZeroIssue?.path[1]).toBe('number');
        expect(typeof divByZeroIssue?.path[4]).toBe('number');
        expect(divByZeroIssue?.displayPath).toBe('nodes[0].config.rules[0].right.value');
      }
    });

    it('26. node IDs containing dots or hyphens are not split or normalized in diagnostics', () => {
      const graph: WorkflowGraph = {
        nodes: [
          {
            id: 'workflow.service.node-1',
            type: 'LLM',
            position: { x: 0, y: 0 },
            config: {},
          },
        ],
        edges: [],
      };

      const result = validateWorkflowNodeConfigs(graph);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.issues[0]?.nodeId).toBe('workflow.service.node-1');
      }
    });

    it('27. mapping keys containing dots or spaces are preserved in paths without splitting', () => {
      const graph = {
        nodes: [
          {
            id: 'node-out-1',
            type: 'OUTPUT' as const,
            position: { x: 0, y: 0 },
            config: {
              payloadMapping: {
                'field.with.dots': {
                  type: 'literal',
                  value: undefined, // Non-JSON value triggering issue
                },
              },
            },
          },
        ],
        edges: [],
      };

      const result = validateWorkflowNodeConfigs(graph as unknown as WorkflowGraph);
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.issues[0];
        expect(issue?.path).toContain('field.with.dots');
        expect(issue?.displayPath).toContain('["field.with.dots"]');
      }
    });

    it('28. no raw input values, configuration payloads, or secrets are leaked into issue objects', () => {
      const sensitiveSecretText = 'SUPER_SECRET_VALUE_DO_NOT_LEAK';
      const graph: WorkflowGraph = {
        nodes: [
          {
            id: 'node-llm-1',
            type: 'LLM',
            position: { x: 0, y: 0 },
            config: {
              provider: 'openai',
              model: 'gpt-4o',
              prompt: { type: 'literal', value: sensitiveSecretText },
              apiKey: sensitiveSecretText, // Unexpected property
            },
          },
        ],
        edges: [],
      };

      const result = validateWorkflowNodeConfigs(graph);
      expect(result.success).toBe(false);
      if (!result.success) {
        const serialized = JSON.stringify(result.issues);
        expect(serialized.includes(sensitiveSecretText)).toBe(false);
        for (const issue of result.issues) {
          expect('input' in issue).toBe(false);
          expect('stack' in issue).toBe(false);
        }
      }
    });

    it('28b. verifies authored identifiers and unexpected keys legitimately appear in path and message, establishing the documented privacy boundary', () => {
      const graph: WorkflowGraph = {
        nodes: [
          {
            id: 'node-auth-1',
            type: 'INPUT',
            position: { x: 0, y: 0 },
            config: {
              fields: [
                { name: 'duplicate_key_ident', type: 'string', required: true },
                { name: 'duplicate_key_ident', type: 'number', required: false },
              ],
              unexpected_auth_property: 'some_value',
            },
          },
        ],
        edges: [],
      };

      const result = validateWorkflowNodeConfigs(graph);
      expect(result.success).toBe(false);
      if (!result.success) {
        // Authored identifiers legitimately appear in duplicate error messages and paths
        const duplicateIssue = result.issues.find((i) => i.message.includes('duplicate_key_ident'));
        expect(duplicateIssue).toBeDefined();

        // Unexpected property names legitimately appear in strict object issue messages
        const unexpectedKeyIssue = result.issues.find((i) =>
          i.message.includes('unexpected_auth_property'),
        );
        expect(unexpectedKeyIssue).toBeDefined();
        expect(unexpectedKeyIssue?.path).toEqual(['nodes', 0, 'config']);
        expect(unexpectedKeyIssue?.displayPath).toBe('nodes[0].config');

        // But the value 'some_value' is NOT copied into issues
        const serialized = JSON.stringify(result.issues);
        expect(serialized.includes('some_value')).toBe(false);

        // Issues strictly match public interface fields only
        for (const issue of result.issues) {
          const keys = Object.keys(issue).sort();
          expect(keys).toEqual([
            'code',
            'displayPath',
            'message',
            'nodeId',
            'nodeIndex',
            'nodeType',
            'path',
          ]);
        }
      }
    });

    it('29. all validation result objects are cleanly JSON-serializable', () => {
      const graph: WorkflowGraph = {
        nodes: [
          {
            id: 'node-1',
            type: 'LLM',
            position: { x: 0, y: 0 },
            config: {},
          },
        ],
        edges: [],
      };

      const result = validateWorkflowNodeConfigs(graph);
      const serialized = JSON.stringify(result);
      const parsed = JSON.parse(serialized);
      expect(parsed).toEqual(result);
    });

    it('30. configuration-invalid nodes remain structurally valid drafts under WorkflowNodeSchema', () => {
      const draftNode: WorkflowNode = {
        id: 'draft-node-1',
        type: 'LLM',
        position: { x: 0, y: 0 },
        config: {}, // Incomplete configuration
      };

      // Structurally valid as a canvas draft
      expect(WorkflowNodeSchema.safeParse(draftNode).success).toBe(true);

      // But configuration validator reports exact diagnostic issues
      const nodeValidation = validateNodeConfig(draftNode.type, draftNode.config);
      expect(nodeValidation.success).toBe(false);
      expect(nodeValidation.issues.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // Boundary and Decoupling Tests (Section 13: 31–40)
  // =========================================================================
  describe('Boundary and Decoupling Tests', () => {
    it('31. duplicate node IDs are NOT checked or rejected by node-config validation', () => {
      // Configuration validation only checks node configs; graph-level uniqueness belongs to Milestone 2B
      const graphWithDuplicateIds: WorkflowGraph = {
        nodes: [
          {
            id: 'duplicate-id',
            type: 'INPUT',
            position: { x: 0, y: 0 },
            config: validInputConfig,
          },
          {
            id: 'duplicate-id',
            type: 'OUTPUT',
            position: { x: 100, y: 0 },
            config: validOutputConfig,
          },
        ],
        edges: [],
      };

      const result = validateWorkflowNodeConfigs(graphWithDuplicateIds);
      expect(result.success).toBe(true);
      expect(result.issues).toEqual([]);
    });

    it('32. dangling edges targeting non-existent nodes are NOT rejected by config validation', () => {
      const graphWithDanglingEdge: WorkflowGraph = {
        nodes: [
          {
            id: 'node-1',
            type: 'INPUT',
            position: { x: 0, y: 0 },
            config: validInputConfig,
          },
        ],
        edges: [
          {
            id: 'edge-dangling',
            source: 'node-1',
            target: 'non-existent-target-id',
          },
        ],
      };

      const result = validateWorkflowNodeConfigs(graphWithDanglingEdge);
      expect(result.success).toBe(true);
    });

    it('33. directed cycles are NOT detected or rejected by config validation', () => {
      // Cyclic edges are graph topology concerns, deferred to Milestone 2B Kahn's algorithm
      const cyclicGraph: WorkflowGraph = {
        nodes: [
          {
            id: 'node-a',
            type: 'INPUT',
            position: { x: 0, y: 0 },
            config: validInputConfig,
          },
          {
            id: 'node-b',
            type: 'OUTPUT',
            position: { x: 100, y: 0 },
            config: validOutputConfig,
          },
        ],
        edges: [
          { id: 'edge-1', source: 'node-a', target: 'node-b' },
          { id: 'edge-2', source: 'node-b', target: 'node-a' },
        ],
      };

      const result = validateWorkflowNodeConfigs(cyclicGraph);
      expect(result.success).toBe(true);
    });

    it('34. missing CONDITION branch outcomes are NOT graph-checked at this layer', () => {
      // Condition node configuration is valid even without TRUE/FALSE edges present
      const conditionGraph: WorkflowGraph = {
        nodes: [
          {
            id: 'node-cond',
            type: 'CONDITION',
            position: { x: 0, y: 0 },
            config: validConditionConfig,
          },
        ],
        edges: [], // Zero edges
      };

      const result = validateWorkflowNodeConfigs(conditionGraph);
      expect(result.success).toBe(true);
    });

    it('35. missing OUTPUT nodes are NOT required by node-config validation', () => {
      const graphWithoutOutput: WorkflowGraph = {
        nodes: [
          {
            id: 'node-input-only',
            type: 'INPUT',
            position: { x: 0, y: 0 },
            config: validInputConfig,
          },
        ],
        edges: [],
      };

      const result = validateWorkflowNodeConfigs(graphWithoutOutput);
      expect(result.success).toBe(true);
    });

    it('36. no live integration connectivity checks occur during validation', () => {
      const result = validateNodeConfig('MCP_TOOL', {
        integrationRef: 'completely-unregistered-integration',
        toolName: 'any_arbitrary_unregistered_tool',
      });
      expect(result.success).toBe(true);
    });

    it('37. no live LLM provider or model availability checks occur during validation', () => {
      const result = validateNodeConfig('LLM', {
        provider: 'custom-unsupported-future-provider',
        model: 'some-future-model-v999',
        prompt: { type: 'literal', value: 'Hello' },
      });
      expect(result.success).toBe(true);
    });

    it('38. no live approval authorization or user session lookups occur during validation', () => {
      const result = validateNodeConfig('APPROVAL', {
        title: 'Gate',
        policy: { roles: ['OWNER'] },
        timeoutMinutes: 60,
        timeoutAction: 'REJECT',
      });
      expect(result.success).toBe(true);
    });

    it('39. existing WorkflowGraphSchema and WorkflowNodeSchema remain completely unchanged', () => {
      // Structural draft graph parses successfully
      const draftGraph: WorkflowGraph = {
        nodes: [
          {
            id: 'draft-1',
            type: 'LLM',
            position: { x: 0, y: 0 },
            config: {},
          },
        ],
        edges: [],
      };
      expect(WorkflowGraphSchema.safeParse(draftGraph).success).toBe(true);
    });

    it('40. handles unexpected or unknown node types passed at runtime gracefully', () => {
      // @ts-expect-error - testing untrusted JS runtime caller
      const result = validateNodeConfig('UNKNOWN_TYPE', {});
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.issues[0]?.message).toContain(
          "Unsupported or unknown node type 'UNKNOWN_TYPE'",
        );
      }

      // Graph containing an unrecognized node type
      const graphWithUnknown = {
        nodes: [
          {
            id: 'node-unknown',
            type: 'AGENT' as WorkflowNodeType,
            position: { x: 0, y: 0 },
            config: {},
          },
        ],
        edges: [],
      };
      const graphResult = validateWorkflowNodeConfigs(graphWithUnknown as WorkflowGraph);
      expect(graphResult.success).toBe(false);
      if (!graphResult.success) {
        expect(graphResult.issues[0]?.message).toContain(
          "Unsupported or unknown node type 'AGENT'",
        );
        expect(graphResult.issues[0]?.path).toEqual(['nodes', 0, 'type']);
      }
    });
  });
});
