import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  MCP_TOOL_ARGUMENT_NAME_MAX_LENGTH,
  MCP_TOOL_MAX_ARGUMENTS,
  MCP_TOOL_NAME_MAX_LENGTH,
  MCP_TOOL_TIMEOUT_MAX_MS,
  MCP_TOOL_TIMEOUT_MIN_MS,
  McpToolArgumentNameSchema,
  McpToolNameSchema,
  McpToolNodeConfigSchema,
  WORKFLOW_IDENTIFIER_MAX_LENGTH,
  WorkflowGraphSchema,
  WorkflowNodeSchema,
  type McpToolArgumentName,
  type McpToolName,
  type McpToolNodeConfig,
  type ValueBinding,
  type WorkflowGraph,
  type WorkflowNode,
} from '../src/index.js';

describe('MCP_TOOL Node Configuration Schema', () => {
  describe('TypeScript Type Inference Verification', () => {
    it('infers exact types matching schema declarations', () => {
      expectTypeOf<McpToolName>().toEqualTypeOf<string>();
      expectTypeOf<McpToolArgumentName>().toEqualTypeOf<string>();

      expectTypeOf<McpToolNodeConfig>().toMatchTypeOf<{
        integrationRef: string;
        toolName: string;
        arguments?: Record<string, ValueBinding> | undefined;
        timeoutMs?: number | undefined;
      }>();
    });

    it('preserves ValueBinding discriminated union in argument values', () => {
      const checkArgNarrowing = (arg: ValueBinding) => {
        if (arg.type === 'literal') {
          expectTypeOf(arg.type).toEqualTypeOf<'literal'>();
          expectTypeOf(arg).toMatchTypeOf<{ type: 'literal'; value: unknown }>();
        } else {
          expectTypeOf(arg.type).toEqualTypeOf<'reference'>();
        }
      };

      checkArgNarrowing({
        type: 'literal',
        value: 'PR Review Complete',
      });
    });
  });

  describe('Positive Validation Tests', () => {
    it('1. accepts valid minimal config with integrationRef and toolName', () => {
      const config: McpToolNodeConfig = {
        integrationRef: 'github-workspace-app',
        toolName: 'get_pull_request_diff',
      };

      const result = McpToolNodeConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(config);
      }
    });

    it('2. accepts valid config with no arguments property', () => {
      const config = {
        integrationRef: 'linear-mcp',
        toolName: 'list_teams',
      };

      const result = McpToolNodeConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(config);
        expect('arguments' in result.data).toBe(false);
      }
    });

    it('3. accepts valid config with empty arguments object: {}', () => {
      const config: McpToolNodeConfig = {
        integrationRef: 'slack-mcp',
        toolName: 'auth_test',
        arguments: {},
      };

      const result = McpToolNodeConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(config);
        expect(result.data.arguments).toEqual({});
      }
    });

    it('4. accepts valid literal string argument', () => {
      const config: McpToolNodeConfig = {
        integrationRef: 'github-integration',
        toolName: 'create_issue',
        arguments: {
          title: {
            type: 'literal',
            value: 'Bug in authentication flow',
          },
        },
      };

      const result = McpToolNodeConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(config);
      }
    });

    it('5. accepts valid numeric, boolean, null, and nested JSON literal arguments', () => {
      const config: McpToolNodeConfig = {
        integrationRef: 'database-mcp',
        toolName: 'query_records',
        arguments: {
          limit: { type: 'literal', value: 100 },
          includeArchived: { type: 'literal', value: false },
          filterTag: { type: 'literal', value: null },
          nestedFilter: {
            type: 'literal',
            value: {
              field: 'status',
              values: ['OPEN', 'IN_PROGRESS'],
            },
          },
        },
      };

      const result = McpToolNodeConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(config);
      }
    });

    it('6. accepts valid input-reference argument', () => {
      const config: McpToolNodeConfig = {
        integrationRef: 'github-integration',
        toolName: 'get_pull_request',
        arguments: {
          pullNumber: {
            type: 'reference',
            reference: {
              source: 'input',
              field: 'pullRequestNumber',
              path: [],
            },
          },
        },
      };

      const result = McpToolNodeConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(config);
      }
    });

    it('7. accepts valid node-output-reference argument with nested path', () => {
      const config: McpToolNodeConfig = {
        integrationRef: 'jira-integration',
        toolName: 'add_comment',
        arguments: {
          issueKey: {
            type: 'reference',
            reference: {
              source: 'node_output',
              nodeId: 'step.fetch.jira.id',
              path: ['ticket', 'key'],
            },
          },
        },
      };

      const result = McpToolNodeConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(config);
      }
    });

    it('8. accepts valid mixed literal and reference arguments', () => {
      const config: McpToolNodeConfig = {
        integrationRef: 'github-integration',
        toolName: 'create_issue_comment',
        arguments: {
          owner: { type: 'literal', value: 'flowforge' },
          repo: { type: 'literal', value: 'flowforge-ai' },
          pullNumber: {
            type: 'reference',
            reference: {
              source: 'input',
              field: 'prNumber',
              path: [],
            },
          },
          body: {
            type: 'reference',
            reference: {
              source: 'node_output',
              nodeId: 'node-llm-review',
              path: ['summary'],
            },
          },
        },
      };

      const result = McpToolNodeConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(config);
      }
    });

    it('9. accepts boundary timeout at 500 ms (MCP_TOOL_TIMEOUT_MIN_MS)', () => {
      const config: McpToolNodeConfig = {
        integrationRef: 'fast-service-mcp',
        toolName: 'ping',
        timeoutMs: MCP_TOOL_TIMEOUT_MIN_MS,
      };

      const result = McpToolNodeConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.timeoutMs).toBe(500);
      }
    });

    it('10. accepts boundary timeout at 300,000 ms (MCP_TOOL_TIMEOUT_MAX_MS)', () => {
      const config: McpToolNodeConfig = {
        integrationRef: 'heavy-computation-mcp',
        toolName: 'run_simulation',
        timeoutMs: MCP_TOOL_TIMEOUT_MAX_MS,
      };

      const result = McpToolNodeConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.timeoutMs).toBe(300000);
      }
    });

    it('11. accepts valid config with ordinary punctuation in toolName', () => {
      const toolNames = [
        'get_pull_request_diff',
        'github/search_issues',
        'slack.send-message@v1',
        'tools:execute_query',
        'ns.sub_ns/action-item.v2',
      ];

      for (const toolName of toolNames) {
        const config = {
          integrationRef: 'workspace-mcp',
          toolName,
        };
        const result = McpToolNodeConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.toolName).toBe(toolName);
        }
      }
    });

    it('12. preserves argument names containing dots, hyphens, and spaces', () => {
      const config: McpToolNodeConfig = {
        integrationRef: 'custom-mcp',
        toolName: 'complex_action',
        arguments: {
          'pull-number': { type: 'literal', value: 42 },
          'filter.status': { type: 'literal', value: 'active' },
          'target branch': { type: 'literal', value: 'main' },
          _privateKey: { type: 'literal', value: 'ok' },
        },
      };

      const result = McpToolNodeConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success && result.data.arguments) {
        expect(result.data.arguments['pull-number']?.type).toBe('literal');
        expect(result.data.arguments['filter.status']?.type).toBe('literal');
        expect(result.data.arguments['target branch']?.type).toBe('literal');
        expect(result.data.arguments['_privateKey']?.type).toBe('literal');
      }
    });

    it('13. preserves integration reference authored value exactly without alteration', () => {
      const refs = [
        'github-workspace-app',
        'mcp_server_prod_1',
        'ext.integration.v2-prod',
        'a'.repeat(WORKFLOW_IDENTIFIER_MAX_LENGTH),
      ];

      for (const integrationRef of refs) {
        const config = {
          integrationRef,
          toolName: 'run_check',
        };
        const result = McpToolNodeConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.integrationRef).toBe(integrationRef);
        }
      }
    });

    it('14. preserves omitted optional properties without default insertion', () => {
      const minimal = {
        integrationRef: 'mcp-app',
        toolName: 'status',
      };

      const result = McpToolNodeConfigSchema.safeParse(minimal);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(minimal);
        expect('arguments' in result.data).toBe(false);
        expect('timeoutMs' in result.data).toBe(false);
      }
    });

    it('15. preserves fully specified configuration with arguments and timeoutMs', () => {
      const fullConfig: McpToolNodeConfig = {
        integrationRef: 'github-mcp-integration',
        toolName: 'create_issue_comment',
        arguments: {
          owner: { type: 'literal', value: 'flowforge' },
          repo: { type: 'literal', value: 'flowforge-ai' },
          pullNumber: {
            type: 'reference',
            reference: {
              source: 'input',
              field: 'prNumber',
              path: [],
            },
          },
        },
        timeoutMs: 15000,
      };

      const result = McpToolNodeConfigSchema.safeParse(fullConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(fullConfig);
      }
    });
  });

  describe('Negative Validation Tests', () => {
    const validBase = {
      integrationRef: 'github-mcp',
      toolName: 'get_pull_request',
    };

    it('16. rejects missing integrationRef', () => {
      const { integrationRef: _, ...missing } = validBase;
      expect(McpToolNodeConfigSchema.safeParse(missing).success).toBe(false);
    });

    it('17. rejects empty integrationRef', () => {
      expect(McpToolNodeConfigSchema.safeParse({ ...validBase, integrationRef: '' }).success).toBe(
        false,
      );
    });

    it('18. rejects whitespace-only integrationRef', () => {
      expect(
        McpToolNodeConfigSchema.safeParse({ ...validBase, integrationRef: '   ' }).success,
      ).toBe(false);
      expect(
        McpToolNodeConfigSchema.safeParse({ ...validBase, integrationRef: '\t\n' }).success,
      ).toBe(false);
    });

    it('19. rejects integrationRef exceeding maximum length', () => {
      const oversized = 'i'.repeat(WORKFLOW_IDENTIFIER_MAX_LENGTH + 1);
      expect(
        McpToolNodeConfigSchema.safeParse({ ...validBase, integrationRef: oversized }).success,
      ).toBe(false);
    });

    it('20. rejects missing toolName', () => {
      const { toolName: _, ...missing } = validBase;
      expect(McpToolNodeConfigSchema.safeParse(missing).success).toBe(false);
    });

    it('21. rejects empty or whitespace-only toolName', () => {
      expect(McpToolNodeConfigSchema.safeParse({ ...validBase, toolName: '' }).success).toBe(false);
      expect(McpToolNodeConfigSchema.safeParse({ ...validBase, toolName: '   ' }).success).toBe(
        false,
      );
      expect(McpToolNodeConfigSchema.safeParse({ ...validBase, toolName: '\n\t' }).success).toBe(
        false,
      );
    });

    it('22. rejects toolName exceeding maximum length', () => {
      const oversized = 't'.repeat(MCP_TOOL_NAME_MAX_LENGTH + 1);
      expect(McpToolNodeConfigSchema.safeParse({ ...validBase, toolName: oversized }).success).toBe(
        false,
      );
      expect(McpToolNameSchema.safeParse(oversized).success).toBe(false);
    });

    it('23. rejects invalid arguments container (string, array, number, null)', () => {
      expect(
        McpToolNodeConfigSchema.safeParse({ ...validBase, arguments: 'invalid' }).success,
      ).toBe(false);
      expect(
        McpToolNodeConfigSchema.safeParse({ ...validBase, arguments: [1, 2, 3] }).success,
      ).toBe(false);
      expect(McpToolNodeConfigSchema.safeParse({ ...validBase, arguments: 12345 }).success).toBe(
        false,
      );
      expect(McpToolNodeConfigSchema.safeParse({ ...validBase, arguments: null }).success).toBe(
        false,
      );
    });

    it('24. rejects more than 50 arguments (MCP_TOOL_MAX_ARGUMENTS limit)', () => {
      const tooManyArguments: Record<string, ValueBinding> = {};
      for (let i = 0; i <= MCP_TOOL_MAX_ARGUMENTS; i++) {
        tooManyArguments[`arg_${i}`] = { type: 'literal', value: i };
      }

      const result = McpToolNodeConfigSchema.safeParse({
        ...validBase,
        arguments: tooManyArguments,
      });
      expect(result.success).toBe(false);
    });

    it('25. rejects empty or whitespace-only argument names', () => {
      const emptyKey = {
        ...validBase,
        arguments: {
          '': { type: 'literal' as const, value: 'test' },
        },
      };
      expect(McpToolNodeConfigSchema.safeParse(emptyKey).success).toBe(false);

      const whitespaceKey = {
        ...validBase,
        arguments: {
          '   ': { type: 'literal' as const, value: 'test' },
        },
      };
      expect(McpToolNodeConfigSchema.safeParse(whitespaceKey).success).toBe(false);
      expect(McpToolArgumentNameSchema.safeParse('   ').success).toBe(false);
    });

    it('26. rejects argument names exceeding maximum length', () => {
      const oversizedKey = 'k'.repeat(MCP_TOOL_ARGUMENT_NAME_MAX_LENGTH + 1);
      const config = {
        ...validBase,
        arguments: {
          [oversizedKey]: { type: 'literal' as const, value: 'val' },
        },
      };
      expect(McpToolNodeConfigSchema.safeParse(config).success).toBe(false);
      expect(McpToolArgumentNameSchema.safeParse(oversizedKey).success).toBe(false);
    });

    it('27. rejects invalid value-binding discriminator', () => {
      const invalidBinding = {
        ...validBase,
        arguments: {
          param1: { type: 'unsupported_type', value: 'val' },
        },
      };
      expect(McpToolNodeConfigSchema.safeParse(invalidBinding).success).toBe(false);
    });

    it('28. rejects malformed structured references', () => {
      const malformedRef = {
        ...validBase,
        arguments: {
          param1: {
            type: 'reference',
            reference: {
              source: 'unknown_source',
              field: 'f1',
              path: [],
            },
          },
        },
      };
      expect(McpToolNodeConfigSchema.safeParse(malformedRef).success).toBe(false);
    });

    it('29. rejects legacy dotted reference strings', () => {
      const legacyRef = {
        ...validBase,
        arguments: {
          param1: {
            type: 'reference',
            reference: {
              source: 'node_output',
              nodeId: 'node-1',
              path: 'output.id', // String instead of string[]
            },
          },
        },
      };
      expect(McpToolNodeConfigSchema.safeParse(legacyRef).success).toBe(false);
    });

    it('30. rejects non-JSON literal content such as functions, undefined, or BigInt', () => {
      const withFunction = {
        ...validBase,
        arguments: {
          fnParam: { type: 'literal', value: () => 'malformed' },
        },
      };
      expect(McpToolNodeConfigSchema.safeParse(withFunction).success).toBe(false);

      const withUndefined = {
        ...validBase,
        arguments: {
          undefParam: { type: 'literal', value: undefined },
        },
      };
      expect(McpToolNodeConfigSchema.safeParse(withUndefined).success).toBe(false);
    });

    it('31. rejects explicitly undefined arguments property', () => {
      const config = {
        ...validBase,
        arguments: undefined,
      };
      const result = McpToolNodeConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path[0] === 'arguments');
        expect(issue).toBeDefined();
        expect(issue?.message).toContain('explicitly undefined');
      }
    });

    it('32. rejects explicitly undefined timeoutMs property', () => {
      const config = {
        ...validBase,
        timeoutMs: undefined,
      };
      const result = McpToolNodeConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path[0] === 'timeoutMs');
        expect(issue).toBeDefined();
        expect(issue?.message).toContain('explicitly undefined');
      }
    });

    it('33. rejects fractional non-integer timeout', () => {
      expect(McpToolNodeConfigSchema.safeParse({ ...validBase, timeoutMs: 500.5 }).success).toBe(
        false,
      );
      expect(McpToolNodeConfigSchema.safeParse({ ...validBase, timeoutMs: 1000.01 }).success).toBe(
        false,
      );
    });

    it('34. rejects timeout below 500 ms (MCP_TOOL_TIMEOUT_MIN_MS)', () => {
      expect(
        McpToolNodeConfigSchema.safeParse({
          ...validBase,
          timeoutMs: MCP_TOOL_TIMEOUT_MIN_MS - 1,
        }).success,
      ).toBe(false);
      expect(McpToolNodeConfigSchema.safeParse({ ...validBase, timeoutMs: 0 }).success).toBe(false);
      expect(McpToolNodeConfigSchema.safeParse({ ...validBase, timeoutMs: -100 }).success).toBe(
        false,
      );
    });

    it('35. rejects timeout above 300,000 ms (MCP_TOOL_TIMEOUT_MAX_MS)', () => {
      expect(
        McpToolNodeConfigSchema.safeParse({
          ...validBase,
          timeoutMs: MCP_TOOL_TIMEOUT_MAX_MS + 1,
        }).success,
      ).toBe(false);
    });

    it('36. rejects NaN, Infinity, and string-valued timeouts', () => {
      expect(McpToolNodeConfigSchema.safeParse({ ...validBase, timeoutMs: NaN }).success).toBe(
        false,
      );
      expect(
        McpToolNodeConfigSchema.safeParse({
          ...validBase,
          timeoutMs: Number.POSITIVE_INFINITY,
        }).success,
      ).toBe(false);
      expect(
        McpToolNodeConfigSchema.safeParse({
          ...validBase,
          timeoutMs: Number.NEGATIVE_INFINITY,
        }).success,
      ).toBe(false);
      expect(McpToolNodeConfigSchema.safeParse({ ...validBase, timeoutMs: '5000' }).success).toBe(
        false,
      );
    });

    it('37. rejects unexpected credential fields via strict mode', () => {
      const credentials = [
        { apiKey: 'sk-mcp-1234' },
        { accessToken: 'ghp_secret' },
        { bearerToken: 'token' },
        { clientSecret: 'secret' },
        { password: 'pass' },
      ];

      for (const cred of credentials) {
        expect(McpToolNodeConfigSchema.safeParse({ ...validBase, ...cred }).success).toBe(false);
      }
    });

    it('38. rejects unexpected server transport/configuration fields via strict mode', () => {
      const transportFields = [
        { serverUrl: 'http://localhost:3000' },
        { baseUrl: 'https://mcp.internal' },
        { headers: { Authorization: 'Bearer x' } },
        { transport: 'stdio' },
        { command: 'npx' },
        { env: { PATH: '/usr/bin' } },
      ];

      for (const tf of transportFields) {
        expect(McpToolNodeConfigSchema.safeParse({ ...validBase, ...tf }).success).toBe(false);
      }
    });

    it('39. rejects untrusted self-authorization bypass fields via strict mode', () => {
      const authBypass = [
        { safeToRun: true },
        { bypassApproval: true },
        { authorized: true },
        { requiresApproval: false },
        { workspaceRole: 'admin' },
      ];

      for (const bypass of authBypass) {
        expect(McpToolNodeConfigSchema.safeParse({ ...validBase, ...bypass }).success).toBe(false);
      }
    });

    it('40. rejects unknown top-level configuration properties via strict mode', () => {
      const unexpected = [
        { extraField: 'not-allowed' },
        { prompt: 'should be on LLM node' },
        { payloadMapping: {} },
        { retries: 3 },
      ];

      for (const extra of unexpected) {
        expect(McpToolNodeConfigSchema.safeParse({ ...validBase, ...extra }).success).toBe(false);
      }
    });
  });

  describe('Boundary and Structural Integration Tests', () => {
    it('41. WorkflowNodeSchema accepts a draft MCP_TOOL node with config: {}', () => {
      const draftNode: WorkflowNode = {
        id: 'node-mcp-draft',
        type: 'MCP_TOOL',
        position: { x: 300, y: 150 },
        config: {},
      };

      const result = WorkflowNodeSchema.safeParse(draftNode);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(draftNode);
      }
    });

    it('42. McpToolNodeConfigSchema strictly rejects an incomplete empty object {}', () => {
      const result = McpToolNodeConfigSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('43. validates configuration structure without requiring a real integration connection', () => {
      // Integration ID 'unregistered-integration-id' passes schema validation
      const config: McpToolNodeConfig = {
        integrationRef: 'unregistered-integration-id',
        toolName: 'any_tool_name',
      };
      expect(McpToolNodeConfigSchema.safeParse(config).success).toBe(true);
    });

    it('44. validates configuration structure without requiring a remote MCP tool to exist', () => {
      // Tool name 'non_existent_tool_xyz' passes schema validation
      const config: McpToolNodeConfig = {
        integrationRef: 'github-integration',
        toolName: 'non_existent_tool_xyz',
      };
      expect(McpToolNodeConfigSchema.safeParse(config).success).toBe(true);
    });

    it('45. confirms structural argument mapping is independent of remote tool inputSchema', () => {
      // Configuration defines argument 'speculativeParam' which passes domain contract validation
      const config: McpToolNodeConfig = {
        integrationRef: 'github-integration',
        toolName: 'get_pull_request',
        arguments: {
          speculativeParam: { type: 'literal', value: 'arbitrary-value' },
        },
      };

      const result = McpToolNodeConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      // Validating against the actual tool inputSchema is deferred to execution
    });

    it('46. WorkflowGraphSchema successfully parses a full workflow containing an MCP_TOOL node', () => {
      const fullGraph: WorkflowGraph = {
        nodes: [
          {
            id: 'node-in',
            type: 'INPUT',
            position: { x: 0, y: 0 },
            config: {
              fields: [{ name: 'prNumber', type: 'number', required: true }],
            },
          },
          {
            id: 'node-mcp-diff',
            type: 'MCP_TOOL',
            position: { x: 250, y: 0 },
            config: {
              integrationRef: 'github-integration-app',
              toolName: 'get_pull_request_diff',
              arguments: {
                pullNumber: {
                  type: 'reference',
                  reference: {
                    source: 'input',
                    field: 'prNumber',
                    path: [],
                  },
                },
              },
              timeoutMs: 10000,
            },
          },
          {
            id: 'node-out',
            type: 'OUTPUT',
            position: { x: 500, y: 0 },
            config: {
              payloadMapping: {
                diff: {
                  type: 'reference',
                  reference: {
                    source: 'node_output',
                    nodeId: 'node-mcp-diff',
                    path: ['rawDiff'],
                  },
                },
              },
            },
          },
        ],
        edges: [
          { id: 'edge-1', source: 'node-in', target: 'node-mcp-diff' },
          { id: 'edge-2', source: 'node-mcp-diff', target: 'node-out' },
        ],
      };

      const result = WorkflowGraphSchema.safeParse(fullGraph);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(fullGraph);
      }
    });

    it('47. McpToolNodeConfig is independent of graph edges existing', () => {
      const isolatedNode: WorkflowNode = {
        id: 'node-mcp-isolated',
        type: 'MCP_TOOL',
        position: { x: 0, y: 0 },
        config: {
          integrationRef: 'linear-integration',
          toolName: 'list_issues',
        },
      };

      const isolatedGraph: WorkflowGraph = {
        nodes: [isolatedNode],
        edges: [],
      };

      expect(WorkflowGraphSchema.safeParse(isolatedGraph).success).toBe(true);
    });
  });

  describe('Direct Schemas Verification', () => {
    it('verifies McpToolNameSchema directly', () => {
      expect(McpToolNameSchema.safeParse('valid_tool_name').success).toBe(true);
      expect(McpToolNameSchema.safeParse('').success).toBe(false);
      expect(McpToolNameSchema.safeParse('   ').success).toBe(false);
      expect(McpToolNameSchema.safeParse(123).success).toBe(false);
    });

    it('verifies McpToolArgumentNameSchema directly', () => {
      expect(McpToolArgumentNameSchema.safeParse('valid-arg.name 1').success).toBe(true);
      expect(McpToolArgumentNameSchema.safeParse('').success).toBe(false);
      expect(McpToolArgumentNameSchema.safeParse('   ').success).toBe(false);
      expect(McpToolArgumentNameSchema.safeParse(123).success).toBe(false);
    });
  });
});
