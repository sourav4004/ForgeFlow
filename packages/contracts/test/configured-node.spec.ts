import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  ConfiguredApprovalNodeSchema,
  ConfiguredConditionNodeSchema,
  ConfiguredInputNodeSchema,
  ConfiguredLlmNodeSchema,
  ConfiguredMcpToolNodeSchema,
  ConfiguredOutputNodeSchema,
  ConfiguredTransformNodeSchema,
  ConfiguredWorkflowNodeSchema,
  WorkflowGraphSchema,
  WorkflowNodeSchema,
  WorkflowNodeTypeSchema,
  type ConfiguredApprovalNode,
  type ConfiguredConditionNode,
  type ConfiguredInputNode,
  type ConfiguredLlmNode,
  type ConfiguredMcpToolNode,
  type ConfiguredOutputNode,
  type ConfiguredTransformNode,
  type ConfiguredWorkflowNode,
  type WorkflowGraph,
  type WorkflowNode,
  type WorkflowNodeType,
} from '../src/index.js';

describe('ConfiguredWorkflowNode Composition and Discriminated Union', () => {
  // --- Canonical Valid Fixtures for All 7 Approved Node Types ---
  const validInputNode: ConfiguredInputNode = {
    id: 'node-input-1',
    type: 'INPUT',
    position: { x: 10, y: 20 },
    config: {
      fields: [
        {
          name: 'repoName',
          type: 'string',
          required: true,
          description: 'Target GitHub repository',
        },
        {
          name: 'prNumber',
          type: 'number',
          required: true,
          defaultValue: 42,
        },
      ],
    },
  };

  const validTransformNode: ConfiguredTransformNode = {
    id: 'node-transform-1',
    type: 'TRANSFORM',
    position: { x: 50, y: 100 },
    config: {
      rules: [
        {
          operation: 'json_set',
          targetKey: 'repoSlug',
          value: {
            type: 'reference',
            reference: {
              source: 'input',
              field: 'repoName',
              path: [],
            },
          },
        },
      ],
    },
  };

  const validConditionNode: ConfiguredConditionNode = {
    id: 'node-condition-1',
    type: 'CONDITION',
    position: { x: 100, y: 150 },
    config: {
      operator: 'greater_than',
      left: {
        type: 'reference',
        reference: {
          source: 'input',
          field: 'prNumber',
          path: [],
        },
      },
      right: {
        type: 'literal',
        value: 0,
      },
    },
  };

  const validLlmNode: ConfiguredLlmNode = {
    id: 'node-llm-1',
    type: 'LLM',
    position: { x: 150, y: 200 },
    config: {
      provider: 'anthropic',
      model: 'claude-3-7-sonnet',
      prompt: {
        type: 'literal',
        value: 'Analyze pull request diff for security vulnerabilities',
      },
      systemInstruction: 'You are an expert security engineer.',
      temperature: 0.2,
      maxTokens: 4096,
      responseFormat: 'json',
    },
  };

  const validMcpToolNode: ConfiguredMcpToolNode = {
    id: 'node-mcp-1',
    type: 'MCP_TOOL',
    position: { x: 200, y: 250 },
    config: {
      integrationRef: 'github-app-1',
      toolName: 'create_issue_comment',
      arguments: {
        body: {
          type: 'literal',
          value: 'LGTM!',
        },
      },
      timeoutMs: 15000,
    },
  };

  const validApprovalNode: ConfiguredApprovalNode = {
    id: 'node-approval-1',
    type: 'APPROVAL',
    position: { x: 250, y: 300 },
    config: {
      title: 'Authorize production release PR comment',
      description: 'Human approval is required before publishing PR review comments.',
      policy: {
        roles: ['OWNER', 'ADMIN'],
      },
      timeoutMinutes: 1440,
      timeoutAction: 'EXPIRE',
    },
  };

  const validOutputNode: ConfiguredOutputNode = {
    id: 'node-output-1',
    type: 'OUTPUT',
    position: { x: 300, y: 350 },
    config: {
      payloadMapping: {
        summary: {
          type: 'literal',
          value: 'Review completed successfully',
        },
      },
    },
  };

  const allValidNodes: ConfiguredWorkflowNode[] = [
    validInputNode,
    validTransformNode,
    validConditionNode,
    validLlmNode,
    validMcpToolNode,
    validApprovalNode,
    validOutputNode,
  ];

  // =========================================================================
  // TypeScript Type Inference Verification (Section 12)
  // =========================================================================
  describe('TypeScript Type Inference Verification', () => {
    it('infers ConfiguredWorkflowNode.type as exactly the 7 approved WorkflowNodeTypes', () => {
      expectTypeOf<ConfiguredWorkflowNode['type']>().toEqualTypeOf<WorkflowNodeType>();
      expectTypeOf<WorkflowNodeType>().toEqualTypeOf<
        'INPUT' | 'TRANSFORM' | 'CONDITION' | 'LLM' | 'MCP_TOOL' | 'APPROVAL' | 'OUTPUT'
      >();
    });

    it('narrows correctly on discriminant type for each variant', () => {
      const node = validLlmNode as ConfiguredWorkflowNode;
      if (node.type === 'LLM') {
        expectTypeOf(node).toEqualTypeOf<ConfiguredLlmNode>();
        expectTypeOf(node.config.provider).toBeString();
        expectTypeOf(node.config.model).toBeString();
        expectTypeOf(node.config.prompt).toBeObject();
      }

      const approvalNode = validApprovalNode as ConfiguredWorkflowNode;
      if (approvalNode.type === 'APPROVAL') {
        expectTypeOf(approvalNode).toEqualTypeOf<ConfiguredApprovalNode>();
        expectTypeOf(approvalNode.config.title).toBeString();
        expectTypeOf(approvalNode.config.policy.roles).toBeArray();
        expectTypeOf(approvalNode.config.timeoutMinutes).toBeNumber();
        expectTypeOf(approvalNode.config.timeoutAction).toEqualTypeOf<'REJECT' | 'EXPIRE'>();
      }

      const conditionNode = validConditionNode as ConfiguredWorkflowNode;
      if (conditionNode.type === 'CONDITION') {
        expectTypeOf(conditionNode).toEqualTypeOf<ConfiguredConditionNode>();
        expectTypeOf(conditionNode.config.left).toBeObject();
      }

      const transformNode = validTransformNode as ConfiguredWorkflowNode;
      if (transformNode.type === 'TRANSFORM') {
        expectTypeOf(transformNode).toEqualTypeOf<ConfiguredTransformNode>();
        expectTypeOf(transformNode.config.rules).toBeArray();
      }

      const inputNode = validInputNode as ConfiguredWorkflowNode;
      if (inputNode.type === 'INPUT') {
        expectTypeOf(inputNode).toEqualTypeOf<ConfiguredInputNode>();
        expectTypeOf(inputNode.config.fields).toBeArray();
      }

      const mcpNode = validMcpToolNode as ConfiguredWorkflowNode;
      if (mcpNode.type === 'MCP_TOOL') {
        expectTypeOf(mcpNode).toEqualTypeOf<ConfiguredMcpToolNode>();
        expectTypeOf(mcpNode.config.integrationRef).toBeString();
        expectTypeOf(mcpNode.config.toolName).toBeString();
      }

      const outputNode = validOutputNode as ConfiguredWorkflowNode;
      if (outputNode.type === 'OUTPUT') {
        expectTypeOf(outputNode).toEqualTypeOf<ConfiguredOutputNode>();
        expectTypeOf(outputNode.config.payloadMapping).toBeObject();
      }
    });

    it('statically rejects unsupported node types or mismatched configurations', () => {
      const invalidTypeObject = {
        id: 'node-1',
        type: 'AGENT' as const,
        position: { x: 0, y: 0 },
        config: {},
      };
      // @ts-expect-error - 'AGENT' is not an approved workflow node type
      const _invalidType: ConfiguredWorkflowNode = invalidTypeObject;

      const mismatchedConfigObject = {
        id: 'node-2',
        type: 'INPUT' as const,
        position: { x: 0, y: 0 },
        config: validApprovalNode.config,
      };
      // @ts-expect-error - INPUT node type paired with APPROVAL config
      const _mismatched: ConfiguredWorkflowNode = mismatchedConfigObject;

      const missingConfigObject = {
        id: 'node-3',
        type: 'LLM' as const,
        position: { x: 0, y: 0 },
      };
      // @ts-expect-error - missing required config property
      const _missingConfig: ConfiguredWorkflowNode = missingConfigObject;

      expect(_invalidType).toBeDefined();
      expect(_mismatched).toBeDefined();
      expect(_missingConfig).toBeDefined();
    });
  });

  // =========================================================================
  // Positive Validation Tests (Section 11: 1–15)
  // =========================================================================
  describe('Positive Validation Tests', () => {
    it('1. accepts a valid INPUT node configuration', () => {
      const result = ConfiguredWorkflowNodeSchema.safeParse(validInputNode);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('INPUT');
        expect(result.data.id).toBe('node-input-1');
      }
    });

    it('2. accepts a valid TRANSFORM node configuration', () => {
      const result = ConfiguredWorkflowNodeSchema.safeParse(validTransformNode);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('TRANSFORM');
        expect(result.data.id).toBe('node-transform-1');
      }
    });

    it('3. accepts a valid CONDITION node configuration', () => {
      const result = ConfiguredWorkflowNodeSchema.safeParse(validConditionNode);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('CONDITION');
        expect(result.data.id).toBe('node-condition-1');
      }
    });

    it('4. accepts a valid LLM node configuration', () => {
      const result = ConfiguredWorkflowNodeSchema.safeParse(validLlmNode);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('LLM');
        expect(result.data.id).toBe('node-llm-1');
      }
    });

    it('5. accepts a valid MCP_TOOL node configuration', () => {
      const result = ConfiguredWorkflowNodeSchema.safeParse(validMcpToolNode);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('MCP_TOOL');
        expect(result.data.id).toBe('node-mcp-1');
      }
    });

    it('6. accepts a valid APPROVAL node configuration', () => {
      const result = ConfiguredWorkflowNodeSchema.safeParse(validApprovalNode);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('APPROVAL');
        expect(result.data.id).toBe('node-approval-1');
      }
    });

    it('7. accepts a valid OUTPUT node configuration', () => {
      const result = ConfiguredWorkflowNodeSchema.safeParse(validOutputNode);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('OUTPUT');
        expect(result.data.id).toBe('node-output-1');
      }
    });

    it('8. selects the exact corresponding schema variant for each node type', () => {
      expect(ConfiguredInputNodeSchema.safeParse(validInputNode).success).toBe(true);
      expect(ConfiguredTransformNodeSchema.safeParse(validTransformNode).success).toBe(true);
      expect(ConfiguredConditionNodeSchema.safeParse(validConditionNode).success).toBe(true);
      expect(ConfiguredLlmNodeSchema.safeParse(validLlmNode).success).toBe(true);
      expect(ConfiguredMcpToolNodeSchema.safeParse(validMcpToolNode).success).toBe(true);
      expect(ConfiguredApprovalNodeSchema.safeParse(validApprovalNode).success).toBe(true);
      expect(ConfiguredOutputNodeSchema.safeParse(validOutputNode).success).toBe(true);

      // Verify that individual variant schemas reject other node types
      expect(ConfiguredInputNodeSchema.safeParse(validApprovalNode).success).toBe(false);
      expect(ConfiguredLlmNodeSchema.safeParse(validMcpToolNode).success).toBe(false);
    });

    it('9. preserves authored IDs, coordinates, and exact configuration values without mutation', () => {
      for (const node of allValidNodes) {
        const result = ConfiguredWorkflowNodeSchema.safeParse(node);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.id).toBe(node.id);
          expect(result.data.position).toEqual(node.position);
          expect(result.data.config).toEqual(node.config);
        }
      }
    });

    it('10. verifies every configured variant remains valid under generic WorkflowNodeSchema (cross-contract invariant)', () => {
      for (const node of allValidNodes) {
        const genericResult = WorkflowNodeSchema.safeParse(node);
        expect(genericResult.success).toBe(true);
        if (genericResult.success) {
          expect(genericResult.data.id).toBe(node.id);
          expect(genericResult.data.type).toBe(node.type);
          expect(genericResult.data.position).toEqual(node.position);
          expect(genericResult.data.config).toEqual(node.config);
        }
      }
    });

    it('11. succeeds on JSON round-trip serialization for all valid configured nodes', () => {
      for (const node of allValidNodes) {
        const serialized = JSON.stringify(node);
        const parsedJson = JSON.parse(serialized);
        const result = ConfiguredWorkflowNodeSchema.safeParse(parsedJson);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual(node);
        }
      }
    });

    it('12. condition nodes validate without requiring edge definitions', () => {
      // Branch targets reside strictly on WorkflowEdge, not on the node
      const result = ConfiguredWorkflowNodeSchema.safeParse(validConditionNode);
      expect(result.success).toBe(true);
      expect('trueTarget' in (validConditionNode.config as Record<string, unknown>)).toBe(false);
      expect('falseTarget' in (validConditionNode.config as Record<string, unknown>)).toBe(false);
    });

    it('13. LLM prompt references remain structurally valid without live providers or network connectivity', () => {
      const result = ConfiguredWorkflowNodeSchema.safeParse(validLlmNode);
      expect(result.success).toBe(true);
      if (result.success && result.data.type === 'LLM') {
        expect(result.data.config.provider).toBe('anthropic');
        expect(result.data.config.model).toBe('claude-3-7-sonnet');
      }
    });

    it('14. MCP_TOOL nodes validate without live integration connectivity or verified credentials', () => {
      const result = ConfiguredWorkflowNodeSchema.safeParse(validMcpToolNode);
      expect(result.success).toBe(true);
      if (result.success && result.data.type === 'MCP_TOOL') {
        expect(result.data.config.integrationRef).toBe('github-app-1');
        expect(result.data.config.toolName).toBe('create_issue_comment');
      }
    });

    it('15. approval configs validate without authentication services, user sessions, or database lookups', () => {
      const result = ConfiguredWorkflowNodeSchema.safeParse(validApprovalNode);
      expect(result.success).toBe(true);
      if (result.success && result.data.type === 'APPROVAL') {
        expect(result.data.config.policy.roles).toEqual(['OWNER', 'ADMIN']);
      }
    });
  });

  // =========================================================================
  // Negative Validation Tests (Section 11: 16–33)
  // =========================================================================
  describe('Negative Validation Tests', () => {
    it('16. rejects an unknown node type', () => {
      const invalid = {
        id: 'node-unknown-1',
        type: 'CUSTOM_NODE',
        position: { x: 0, y: 0 },
        config: {},
      };
      const result = ConfiguredWorkflowNodeSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes('type'))).toBe(true);
      }
    });

    it('17. rejects missing node type', () => {
      const invalid = {
        id: 'node-notype-1',
        position: { x: 0, y: 0 },
        config: {},
      };
      const result = ConfiguredWorkflowNodeSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes('type'))).toBe(true);
      }
    });

    it('18. rejects missing or invalid node IDs (empty, whitespace, too long)', () => {
      // Empty string
      expect(ConfiguredWorkflowNodeSchema.safeParse({ ...validInputNode, id: '' }).success).toBe(
        false,
      );

      // Whitespace-only
      expect(ConfiguredWorkflowNodeSchema.safeParse({ ...validInputNode, id: '   ' }).success).toBe(
        false,
      );

      // Too long (>128 chars)
      expect(
        ConfiguredWorkflowNodeSchema.safeParse({ ...validInputNode, id: 'x'.repeat(129) }).success,
      ).toBe(false);

      // Non-string
      expect(ConfiguredWorkflowNodeSchema.safeParse({ ...validInputNode, id: 12345 }).success).toBe(
        false,
      );
    });

    it('19. rejects missing or malformed position coordinates (missing, NaN, Infinity, non-finite)', () => {
      // Missing x
      expect(
        ConfiguredWorkflowNodeSchema.safeParse({
          ...validInputNode,
          position: { y: 10 },
        }).success,
      ).toBe(false);

      // NaN
      expect(
        ConfiguredWorkflowNodeSchema.safeParse({
          ...validInputNode,
          position: { x: NaN, y: 10 },
        }).success,
      ).toBe(false);

      // Infinity
      expect(
        ConfiguredWorkflowNodeSchema.safeParse({
          ...validInputNode,
          position: { x: 10, y: Infinity },
        }).success,
      ).toBe(false);

      // String coordinates
      expect(
        ConfiguredWorkflowNodeSchema.safeParse({
          ...validInputNode,
          position: { x: '10', y: '20' },
        }).success,
      ).toBe(false);
    });

    it('20. rejects missing configuration object', () => {
      const invalid = {
        id: 'node-noconfig-1',
        type: 'INPUT',
        position: { x: 0, y: 0 },
      };
      const result = ConfiguredWorkflowNodeSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('21. rejects INPUT node with APPROVAL configuration (type-config mismatch)', () => {
      const invalid = {
        id: 'node-mismatch-1',
        type: 'INPUT',
        position: { x: 0, y: 0 },
        config: validApprovalNode.config,
      };
      const result = ConfiguredWorkflowNodeSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('22. rejects LLM node with MCP_TOOL configuration (type-config mismatch)', () => {
      const invalid = {
        id: 'node-mismatch-2',
        type: 'LLM',
        position: { x: 0, y: 0 },
        config: validMcpToolNode.config,
      };
      const result = ConfiguredWorkflowNodeSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('23. rejects invalid INPUT configuration (duplicate field names)', () => {
      const invalid = {
        ...validInputNode,
        config: {
          fields: [
            { name: 'duplicateName', type: 'string', required: true },
            { name: 'duplicateName', type: 'number', required: false },
          ],
        },
      };
      const result = ConfiguredWorkflowNodeSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((i) => i.message.includes('Duplicate input field name')),
        ).toBe(true);
      }
    });

    it('24. rejects invalid TRANSFORM configuration (empty rules, duplicate targetKey)', () => {
      // Empty rules array
      expect(
        ConfiguredWorkflowNodeSchema.safeParse({
          ...validTransformNode,
          config: { rules: [] },
        }).success,
      ).toBe(false);

      // Duplicate targetKey
      expect(
        ConfiguredWorkflowNodeSchema.safeParse({
          ...validTransformNode,
          config: {
            rules: [
              {
                operation: 'json_set',
                targetKey: 'keyA',
                value: { type: 'literal', value: 'v1' },
              },
              {
                operation: 'json_set',
                targetKey: 'keyA',
                value: { type: 'literal', value: 'v2' },
              },
            ],
          },
        }).success,
      ).toBe(false);
    });

    it('25. rejects invalid CONDITION configuration (binary operator missing right operand)', () => {
      const invalid = {
        ...validConditionNode,
        config: {
          operator: 'equals',
          left: { type: 'literal', value: 10 },
          // right operand missing
        },
      };
      const result = ConfiguredWorkflowNodeSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('26. rejects invalid LLM configuration (temperature out of range, missing model)', () => {
      // Temperature > 2.0
      expect(
        ConfiguredWorkflowNodeSchema.safeParse({
          ...validLlmNode,
          config: {
            ...validLlmNode.config,
            temperature: 2.5,
          },
        }).success,
      ).toBe(false);

      // Missing model
      const { model: _, ...noModelConfig } = validLlmNode.config;
      expect(
        ConfiguredWorkflowNodeSchema.safeParse({
          ...validLlmNode,
          config: noModelConfig,
        }).success,
      ).toBe(false);
    });

    it('27. rejects invalid MCP_TOOL configuration (empty toolName, timeoutMs too large)', () => {
      // Empty toolName
      expect(
        ConfiguredWorkflowNodeSchema.safeParse({
          ...validMcpToolNode,
          config: {
            ...validMcpToolNode.config,
            toolName: '',
          },
        }).success,
      ).toBe(false);

      // timeoutMs > 300,000 ms
      expect(
        ConfiguredWorkflowNodeSchema.safeParse({
          ...validMcpToolNode,
          config: {
            ...validMcpToolNode.config,
            timeoutMs: 300001,
          },
        }).success,
      ).toBe(false);
    });

    it('28. rejects invalid APPROVAL configuration (empty title, zero roles in policy)', () => {
      // Empty title
      expect(
        ConfiguredWorkflowNodeSchema.safeParse({
          ...validApprovalNode,
          config: {
            ...validApprovalNode.config,
            title: '',
          },
        }).success,
      ).toBe(false);

      // Zero roles in policy
      expect(
        ConfiguredWorkflowNodeSchema.safeParse({
          ...validApprovalNode,
          config: {
            ...validApprovalNode.config,
            policy: { roles: [] as unknown as ['OWNER'] },
          },
        }).success,
      ).toBe(false);
    });

    it('29. rejects invalid OUTPUT configuration (empty payloadMapping)', () => {
      const invalid = {
        ...validOutputNode,
        config: {
          payloadMapping: {},
        },
      };
      const result = ConfiguredWorkflowNodeSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('30. rejects unexpected outer node properties via strict validation', () => {
      const invalid = {
        ...validInputNode,
        extraNodeProp: 'disallowed',
      };
      const result = ConfiguredWorkflowNodeSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.message.includes('extraNodeProp'))).toBe(true);
      }
    });

    it('31. rejects unexpected nested configuration fields via strict validation', () => {
      const invalid = {
        ...validApprovalNode,
        config: {
          ...validApprovalNode.config,
          autoApprove: true, // Forbidden bypass property
        },
      };
      const result = ConfiguredWorkflowNodeSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.message.includes('autoApprove'))).toBe(true);
      }
    });

    it('32. rejects explicit undefined values in optional fields (cross-contract serializability)', () => {
      // INPUT field with description: undefined
      const invalidInput = {
        ...validInputNode,
        config: {
          fields: [
            {
              name: 'fieldA',
              type: 'string',
              required: true,
              description: undefined,
            },
          ],
        },
      };
      expect(ConfiguredWorkflowNodeSchema.safeParse(invalidInput).success).toBe(false);

      // APPROVAL with description: undefined
      const invalidApproval = {
        ...validApprovalNode,
        config: {
          ...validApprovalNode.config,
          description: undefined,
        },
      };
      expect(ConfiguredWorkflowNodeSchema.safeParse(invalidApproval).success).toBe(false);

      // LLM with systemInstruction: undefined
      const invalidLlm = {
        ...validLlmNode,
        config: {
          ...validLlmNode.config,
          systemInstruction: undefined,
        },
      };
      expect(ConfiguredWorkflowNodeSchema.safeParse(invalidLlm).success).toBe(false);
    });

    it('33. rejects unsupported AGENT node type', () => {
      const agentNode = {
        id: 'node-agent-1',
        type: 'AGENT',
        position: { x: 0, y: 0 },
        config: {},
      };
      const result = ConfiguredWorkflowNodeSchema.safeParse(agentNode);
      expect(result.success).toBe(false);
    });
  });

  // =========================================================================
  // Boundary & Draft Compatibility Tests (Section 11: 34–40)
  // =========================================================================
  describe('Boundary & Draft Compatibility Tests', () => {
    it('34. confirms generic WorkflowNodeSchema still accepts incomplete drafts with config: {}', () => {
      const draftLlmNode: WorkflowNode = {
        id: 'draft-llm-1',
        type: 'LLM',
        position: { x: 10, y: 20 },
        config: {},
      };
      const result = WorkflowNodeSchema.safeParse(draftLlmNode);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.config).toEqual({});
      }

      const draftApprovalNode: WorkflowNode = {
        id: 'draft-approval-1',
        type: 'APPROVAL',
        position: { x: 30, y: 40 },
        config: {},
      };
      expect(WorkflowNodeSchema.safeParse(draftApprovalNode).success).toBe(true);
    });

    it('35. confirms ConfiguredWorkflowNodeSchema strictly rejects incomplete drafts with config: {}', () => {
      const draftLlmNode = {
        id: 'draft-llm-1',
        type: 'LLM',
        position: { x: 10, y: 20 },
        config: {},
      };
      const result = ConfiguredWorkflowNodeSchema.safeParse(draftLlmNode);
      expect(result.success).toBe(false);

      const draftApprovalNode = {
        id: 'draft-approval-1',
        type: 'APPROVAL',
        position: { x: 30, y: 40 },
        config: {},
      };
      expect(ConfiguredWorkflowNodeSchema.safeParse(draftApprovalNode).success).toBe(false);
    });

    it('36. confirms WorkflowGraphSchema remains unchanged and accepts valid graphs composed of draft or configured nodes', () => {
      const validDraftGraph: WorkflowGraph = {
        nodes: [
          {
            id: 'node-1',
            type: 'INPUT',
            position: { x: 0, y: 0 },
            config: {},
          },
          {
            id: 'node-2',
            type: 'OUTPUT',
            position: { x: 100, y: 100 },
            config: {},
          },
        ],
        edges: [
          {
            id: 'edge-1',
            source: 'node-1',
            target: 'node-2',
          },
        ],
      };
      expect(WorkflowGraphSchema.safeParse(validDraftGraph).success).toBe(true);

      const validConfiguredGraph = {
        nodes: [validInputNode, validOutputNode],
        edges: [
          {
            id: 'edge-1',
            source: validInputNode.id,
            target: validOutputNode.id,
          },
        ],
      };
      expect(WorkflowGraphSchema.safeParse(validConfiguredGraph).success).toBe(true);
    });

    it('37. verifies conditional edge branch completeness is NOT checked at the single-node level', () => {
      // Single condition node validates without any outgoing TRUE/FALSE edges
      const result = ConfiguredWorkflowNodeSchema.safeParse(validConditionNode);
      expect(result.success).toBe(true);
      // Graph topology validation is deferred to Milestone 2B
    });

    it('38. verifies upstream data references are NOT resolved at the schema level', () => {
      // Reference to non-existent upstream node and path validates purely syntactically
      const unresolvableTransformNode: ConfiguredTransformNode = {
        id: 'node-unresolvable-1',
        type: 'TRANSFORM',
        position: { x: 0, y: 0 },
        config: {
          rules: [
            {
              operation: 'json_pick',
              targetKey: 'extracted',
              source: {
                source: 'node_output',
                nodeId: 'non-existent-upstream-node-xyz',
                path: ['nested', 'deep', 'field'],
              },
            },
          ],
        },
      };
      expect(ConfiguredWorkflowNodeSchema.safeParse(unresolvableTransformNode).success).toBe(true);
    });

    it('39. verifies no remote tool access, provider availability, or credentials are checked', () => {
      // MCP_TOOL with completely dummy integration reference validates successfully
      const dummyMcpNode: ConfiguredMcpToolNode = {
        id: 'node-dummy-mcp',
        type: 'MCP_TOOL',
        position: { x: 0, y: 0 },
        config: {
          integrationRef: 'unregistered-integration-12345',
          toolName: 'any_arbitrary_tool_name',
        },
      };
      expect(ConfiguredWorkflowNodeSchema.safeParse(dummyMcpNode).success).toBe(true);
    });

    it('40. verifies all seven node types are enumerated by WorkflowNodeTypeSchema', () => {
      expect(WorkflowNodeTypeSchema.options).toEqual([
        'INPUT',
        'TRANSFORM',
        'CONDITION',
        'LLM',
        'MCP_TOOL',
        'APPROVAL',
        'OUTPUT',
      ]);
      expect(WorkflowNodeTypeSchema.options).toHaveLength(7);
    });
  });
});
