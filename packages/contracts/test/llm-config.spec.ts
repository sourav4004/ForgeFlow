import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  LLM_MAX_TOKENS_MAX,
  LLM_MAX_TOKENS_MIN,
  LLM_MODEL_MAX_LENGTH,
  LLM_PROMPT_LITERAL_MAX_LENGTH,
  LLM_PROVIDER_MAX_LENGTH,
  LLM_SYSTEM_INSTRUCTION_MAX_LENGTH,
  LLM_TEMPERATURE_MAX,
  LLM_TEMPERATURE_MIN,
  LlmNodeConfigSchema,
  LlmPromptBindingSchema,
  LlmPromptLiteralBindingSchema,
  LlmResponseFormatSchema,
  WorkflowGraphSchema,
  WorkflowNodeSchema,
  type LlmNodeConfig,
  type LlmPromptBinding,
  type LlmPromptLiteralBinding,
  type LlmResponseFormat,
  type ReferenceBinding,
  type WorkflowGraph,
  type WorkflowNode,
} from '../src/index.js';

describe('LLM Node Configuration Schema', () => {
  describe('TypeScript Type Inference Verification', () => {
    it('infers exact types matching schema declarations', () => {
      expectTypeOf<LlmPromptLiteralBinding>().toEqualTypeOf<{
        type: 'literal';
        value: string;
      }>();

      expectTypeOf<LlmPromptBinding>().toEqualTypeOf<LlmPromptLiteralBinding | ReferenceBinding>();

      expectTypeOf<LlmResponseFormat>().toEqualTypeOf<'text' | 'json'>();

      expectTypeOf<LlmNodeConfig>().toMatchTypeOf<{
        provider: string;
        model: string;
        prompt: LlmPromptBinding;
        systemInstruction?: string | undefined;
        temperature?: number | undefined;
        maxTokens?: number | undefined;
        responseFormat?: 'text' | 'json' | undefined;
      }>();
    });

    it('narrows prompt binding type based on discriminator', () => {
      const checkPromptNarrowing = (binding: LlmPromptBinding) => {
        if (binding.type === 'literal') {
          expectTypeOf(binding).toEqualTypeOf<LlmPromptLiteralBinding>();
          expectTypeOf(binding.value).toEqualTypeOf<string>();
        } else {
          expectTypeOf(binding).toEqualTypeOf<ReferenceBinding>();
        }
      };

      checkPromptNarrowing({
        type: 'literal',
        value: 'Summarize PR',
      });
    });
  });

  describe('Positive Validation Tests', () => {
    it('1. accepts valid LLM configuration with literal string prompt', () => {
      const config: LlmNodeConfig = {
        provider: 'google',
        model: 'gemini-2.5-pro',
        prompt: {
          type: 'literal',
          value: 'Summarize this pull request title and description.',
        },
      };
      const result = LlmNodeConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(config);
      }
    });

    it('2. accepts valid LLM configuration with input reference prompt', () => {
      const config: LlmNodeConfig = {
        provider: 'anthropic',
        model: 'claude-3-7-sonnet',
        prompt: {
          type: 'reference',
          reference: {
            source: 'input',
            field: 'userPrompt',
            path: [],
          },
        },
      };
      const result = LlmNodeConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(config);
      }
    });

    it('3. accepts valid LLM configuration with node-output reference prompt', () => {
      const config: LlmNodeConfig = {
        provider: 'openai',
        model: 'gpt-4o',
        prompt: {
          type: 'reference',
          reference: {
            source: 'node_output',
            nodeId: 'node-transform-prep',
            path: ['formattedPrompt'],
          },
        },
      };
      const result = LlmNodeConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(config);
      }
    });

    it('4. accepts arbitrary non-empty provider identifiers without hardcoded vendor enum', () => {
      const providers = [
        'openai',
        'google',
        'anthropic',
        'mistral',
        'meta-llama',
        'custom_internal_gateway',
        'aws-bedrock',
        'azure-openai',
        'ollama-local',
      ];

      for (const provider of providers) {
        const config = {
          provider,
          model: 'base-model-v1',
          prompt: { type: 'literal', value: 'Hello' },
        };
        const result = LlmNodeConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.provider).toBe(provider);
        }
      }
    });

    it('5. preserves model identifiers with ordinary punctuation without alteration', () => {
      const models = [
        'gpt-4o-mini',
        'gemini-2.5-pro',
        'claude-3-5-sonnet@20240620',
        'meta-llama/Llama-3.1-70B-Instruct',
        'text-embedding-3-small:latest',
        'deepseek-ai/DeepSeek-R1',
      ];

      for (const model of models) {
        const config = {
          provider: 'custom-provider',
          model,
          prompt: { type: 'literal', value: 'Hello' },
        };
        const result = LlmNodeConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.model).toBe(model);
        }
      }
    });

    it('6. preserves multiline literal prompt content exactly', () => {
      const multilinePrompt = [
        'You are an expert security engineer reviewing a pull request.',
        '',
        'Review Guidelines:',
        '  1. Identify potential SQL injections.',
        '  2. Check for secret leakage.',
        '  3. Assess authorization bypass vectors.',
        '',
        'Provide a concise finding summary in markdown.',
      ].join('\n');

      const config: LlmNodeConfig = {
        provider: 'google',
        model: 'gemini-2.5-flash',
        prompt: {
          type: 'literal',
          value: multilinePrompt,
        },
      };

      const result = LlmNodeConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.prompt.type).toBe('literal');
        if (result.data.prompt.type === 'literal') {
          expect(result.data.prompt.value).toBe(multilinePrompt);
        }
      }
    });

    it('7. treats literal string containing {{input.value}} as raw text without interpolation', () => {
      const rawTemplateSyntax =
        'Extract details for PR #{{input.pullRequestNumber}} from repository {{input.repo}}';
      const config: LlmNodeConfig = {
        provider: 'openai',
        model: 'gpt-4o',
        prompt: {
          type: 'literal',
          value: rawTemplateSyntax,
        },
      };

      const result = LlmNodeConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success && result.data.prompt.type === 'literal') {
        expect(result.data.prompt.value).toBe(rawTemplateSyntax);
      }
    });

    it('8. accepts valid optional systemInstruction', () => {
      const config: LlmNodeConfig = {
        provider: 'anthropic',
        model: 'claude-3-5-sonnet',
        prompt: { type: 'literal', value: 'Review code' },
        systemInstruction: 'You are an automated code review bot operating in CI.',
      };

      const result = LlmNodeConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.systemInstruction).toBe(
          'You are an automated code review bot operating in CI.',
        );
      }
    });

    it('9. accepts boundary temperature 0', () => {
      const config: LlmNodeConfig = {
        provider: 'google',
        model: 'gemini-2.5-flash',
        prompt: { type: 'literal', value: 'Classify sentiment' },
        temperature: LLM_TEMPERATURE_MIN,
      };

      const result = LlmNodeConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.temperature).toBe(LLM_TEMPERATURE_MIN);
      }
    });

    it('10. accepts boundary temperature 2', () => {
      const config: LlmNodeConfig = {
        provider: 'google',
        model: 'gemini-2.5-pro',
        prompt: { type: 'literal', value: 'Brainstorm creative names' },
        temperature: LLM_TEMPERATURE_MAX,
      };

      const result = LlmNodeConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.temperature).toBe(LLM_TEMPERATURE_MAX);
      }
    });

    it('11. accepts valid positive integer maxTokens across valid range', () => {
      const tokenValues = [LLM_MAX_TOKENS_MIN, 512, 2048, 4096, 8192, LLM_MAX_TOKENS_MAX];

      for (const maxTokens of tokenValues) {
        const config: LlmNodeConfig = {
          provider: 'openai',
          model: 'gpt-4o',
          prompt: { type: 'literal', value: 'Generate documentation' },
          maxTokens,
        };

        const result = LlmNodeConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.maxTokens).toBe(maxTokens);
        }
      }
    });

    it('12. accepts responseFormat text', () => {
      const config: LlmNodeConfig = {
        provider: 'google',
        model: 'gemini-2.5-flash',
        prompt: { type: 'literal', value: 'Explain quantum computing' },
        responseFormat: 'text',
      };

      const result = LlmNodeConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.responseFormat).toBe('text');
      }
    });

    it('13. accepts responseFormat json', () => {
      const config: LlmNodeConfig = {
        provider: 'google',
        model: 'gemini-2.5-pro',
        prompt: { type: 'literal', value: 'Output structured PR review findings' },
        responseFormat: 'json',
      };

      const result = LlmNodeConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.responseFormat).toBe('json');
      }
    });

    it('14. preserves omitted optional settings without injecting default values', () => {
      const minimalConfig = {
        provider: 'google',
        model: 'gemini-2.5-pro',
        prompt: { type: 'literal' as const, value: 'Translate to French' },
      };

      const result = LlmNodeConfigSchema.safeParse(minimalConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(minimalConfig);
        expect('systemInstruction' in result.data).toBe(false);
        expect('temperature' in result.data).toBe(false);
        expect('maxTokens' in result.data).toBe(false);
        expect('responseFormat' in result.data).toBe(false);
      }
    });

    it('15. accepts referenced prompt with dotted node ID in structured reference', () => {
      const config: LlmNodeConfig = {
        provider: 'anthropic',
        model: 'claude-3-5-sonnet',
        prompt: {
          type: 'reference',
          reference: {
            source: 'node_output',
            nodeId: 'step.prepare.prompt.v1',
            path: ['template', 'renderedText'],
          },
        },
      };

      const result = LlmNodeConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success && result.data.prompt.type === 'reference') {
        expect(result.data.prompt.reference.source).toBe('node_output');
        if (result.data.prompt.reference.source === 'node_output') {
          expect(result.data.prompt.reference.nodeId).toBe('step.prepare.prompt.v1');
          expect(result.data.prompt.reference.path).toEqual(['template', 'renderedText']);
        }
      }
    });

    it('16. accepts fully specified LLM configuration with all optional fields', () => {
      const fullConfig: LlmNodeConfig = {
        provider: 'google',
        model: 'gemini-2.5-pro',
        prompt: {
          type: 'literal',
          value: 'Analyze pull request diff for security vulnerabilities.',
        },
        systemInstruction: 'You are an automated code security reviewer in CI.',
        temperature: 0.2,
        maxTokens: 4096,
        responseFormat: 'json',
      };

      const result = LlmNodeConfigSchema.safeParse(fullConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(fullConfig);
      }
    });
  });

  describe('Negative Validation Tests', () => {
    const validBase = {
      provider: 'google',
      model: 'gemini-2.5-flash',
      prompt: { type: 'literal', value: 'Hello world' },
    };

    it('17. rejects missing provider', () => {
      const { provider: _, ...missingProvider } = validBase;
      expect(LlmNodeConfigSchema.safeParse(missingProvider).success).toBe(false);
    });

    it('18. rejects empty or whitespace-only provider', () => {
      expect(LlmNodeConfigSchema.safeParse({ ...validBase, provider: '' }).success).toBe(false);
      expect(LlmNodeConfigSchema.safeParse({ ...validBase, provider: '   ' }).success).toBe(false);
      expect(LlmNodeConfigSchema.safeParse({ ...validBase, provider: '\t\n' }).success).toBe(false);
    });

    it('19. rejects provider exceeding maximum length', () => {
      const oversizedProvider = 'a'.repeat(LLM_PROVIDER_MAX_LENGTH + 1);
      expect(
        LlmNodeConfigSchema.safeParse({ ...validBase, provider: oversizedProvider }).success,
      ).toBe(false);
    });

    it('20. rejects missing model', () => {
      const { model: _, ...missingModel } = validBase;
      expect(LlmNodeConfigSchema.safeParse(missingModel).success).toBe(false);
    });

    it('21. rejects empty or whitespace-only model', () => {
      expect(LlmNodeConfigSchema.safeParse({ ...validBase, model: '' }).success).toBe(false);
      expect(LlmNodeConfigSchema.safeParse({ ...validBase, model: '   ' }).success).toBe(false);
      expect(LlmNodeConfigSchema.safeParse({ ...validBase, model: '\n' }).success).toBe(false);
    });

    it('22. rejects model exceeding maximum length', () => {
      const oversizedModel = 'm'.repeat(LLM_MODEL_MAX_LENGTH + 1);
      expect(LlmNodeConfigSchema.safeParse({ ...validBase, model: oversizedModel }).success).toBe(
        false,
      );
    });

    it('23. rejects missing prompt', () => {
      const { prompt: _, ...missingPrompt } = validBase;
      expect(LlmNodeConfigSchema.safeParse(missingPrompt).success).toBe(false);
    });

    it('24. rejects direct raw string as prompt (must be wrapped in binding)', () => {
      const directStringPrompt = {
        ...validBase,
        prompt: 'This is a raw string prompt, not a binding object',
      };
      expect(LlmNodeConfigSchema.safeParse(directStringPrompt).success).toBe(false);
    });

    it('25. rejects numeric literal prompt', () => {
      const numericPrompt = {
        ...validBase,
        prompt: { type: 'literal', value: 12345 },
      };
      expect(LlmNodeConfigSchema.safeParse(numericPrompt).success).toBe(false);
      expect(
        LlmPromptLiteralBindingSchema.safeParse({ type: 'literal', value: 12345 }).success,
      ).toBe(false);
    });

    it('26. rejects object literal prompt', () => {
      const objectPrompt = {
        ...validBase,
        prompt: { type: 'literal', value: { key: 'value' } },
      };
      expect(LlmNodeConfigSchema.safeParse(objectPrompt).success).toBe(false);
      expect(
        LlmPromptLiteralBindingSchema.safeParse({ type: 'literal', value: { key: 'value' } })
          .success,
      ).toBe(false);
    });

    it('27. rejects null literal prompt', () => {
      const nullPrompt = {
        ...validBase,
        prompt: { type: 'literal', value: null },
      };
      expect(LlmNodeConfigSchema.safeParse(nullPrompt).success).toBe(false);
      expect(
        LlmPromptLiteralBindingSchema.safeParse({ type: 'literal', value: null }).success,
      ).toBe(false);
    });

    it('28. rejects empty literal prompt string', () => {
      const emptyPrompt = {
        ...validBase,
        prompt: { type: 'literal', value: '' },
      };
      expect(LlmNodeConfigSchema.safeParse(emptyPrompt).success).toBe(false);
      expect(LlmPromptLiteralBindingSchema.safeParse({ type: 'literal', value: '' }).success).toBe(
        false,
      );
    });

    it('29. rejects whitespace-only literal prompt string', () => {
      const whitespacePrompt = {
        ...validBase,
        prompt: { type: 'literal', value: '    \n\t  ' },
      };
      expect(LlmNodeConfigSchema.safeParse(whitespacePrompt).success).toBe(false);
      expect(
        LlmPromptLiteralBindingSchema.safeParse({ type: 'literal', value: '    \n\t  ' }).success,
      ).toBe(false);
    });

    it('30. rejects literal prompt string exceeding maximum length', () => {
      const oversizedPrompt = 'a'.repeat(LLM_PROMPT_LITERAL_MAX_LENGTH + 1);
      const invalidConfig = {
        ...validBase,
        prompt: { type: 'literal', value: oversizedPrompt },
      };
      expect(LlmNodeConfigSchema.safeParse(invalidConfig).success).toBe(false);
      expect(
        LlmPromptLiteralBindingSchema.safeParse({ type: 'literal', value: oversizedPrompt })
          .success,
      ).toBe(false);
    });

    it('31. rejects malformed referenced prompt', () => {
      const malformedRef = {
        ...validBase,
        prompt: {
          type: 'reference',
          reference: {
            source: 'invalid_source',
            nodeId: 'node-1',
            path: [],
          },
        },
      };
      expect(LlmNodeConfigSchema.safeParse(malformedRef).success).toBe(false);
    });

    it('32. rejects legacy dotted-path string syntax in referenced prompt', () => {
      const legacyRef = {
        ...validBase,
        prompt: {
          type: 'reference',
          reference: {
            source: 'node_output',
            nodeId: 'node-1',
            path: 'output.text', // String instead of string[]
          },
        },
      };
      expect(LlmNodeConfigSchema.safeParse(legacyRef).success).toBe(false);
    });

    it('33. rejects invalid systemInstruction (empty, whitespace-only, oversized, non-string)', () => {
      expect(LlmNodeConfigSchema.safeParse({ ...validBase, systemInstruction: '' }).success).toBe(
        false,
      );
      expect(
        LlmNodeConfigSchema.safeParse({ ...validBase, systemInstruction: '   ' }).success,
      ).toBe(false);
      expect(
        LlmNodeConfigSchema.safeParse({
          ...validBase,
          systemInstruction: 'a'.repeat(LLM_SYSTEM_INSTRUCTION_MAX_LENGTH + 1),
        }).success,
      ).toBe(false);
      expect(
        LlmNodeConfigSchema.safeParse({ ...validBase, systemInstruction: 12345 }).success,
      ).toBe(false);
    });

    it('34. rejects temperature outside 0 to 2 range and string values', () => {
      expect(LlmNodeConfigSchema.safeParse({ ...validBase, temperature: -0.1 }).success).toBe(
        false,
      );
      expect(LlmNodeConfigSchema.safeParse({ ...validBase, temperature: 2.01 }).success).toBe(
        false,
      );
      expect(LlmNodeConfigSchema.safeParse({ ...validBase, temperature: '0.7' }).success).toBe(
        false,
      );
    });

    it('35. rejects NaN and Infinity temperature', () => {
      expect(LlmNodeConfigSchema.safeParse({ ...validBase, temperature: NaN }).success).toBe(false);
      expect(
        LlmNodeConfigSchema.safeParse({ ...validBase, temperature: Number.POSITIVE_INFINITY })
          .success,
      ).toBe(false);
      expect(
        LlmNodeConfigSchema.safeParse({ ...validBase, temperature: Number.NEGATIVE_INFINITY })
          .success,
      ).toBe(false);
    });

    it('36. rejects fractional maxTokens', () => {
      expect(LlmNodeConfigSchema.safeParse({ ...validBase, maxTokens: 1024.5 }).success).toBe(
        false,
      );
      expect(LlmNodeConfigSchema.safeParse({ ...validBase, maxTokens: 1.0001 }).success).toBe(
        false,
      );
    });

    it('37. rejects maxTokens outside 1 to 16,384 range, negative, or string values', () => {
      expect(LlmNodeConfigSchema.safeParse({ ...validBase, maxTokens: 0 }).success).toBe(false);
      expect(LlmNodeConfigSchema.safeParse({ ...validBase, maxTokens: -100 }).success).toBe(false);
      expect(
        LlmNodeConfigSchema.safeParse({ ...validBase, maxTokens: LLM_MAX_TOKENS_MAX + 1 }).success,
      ).toBe(false);
      expect(LlmNodeConfigSchema.safeParse({ ...validBase, maxTokens: '4096' }).success).toBe(
        false,
      );
    });

    it('38. rejects invalid responseFormat values', () => {
      const invalidFormats = ['markdown', 'json_schema', 'tool_call', 'function_call', 'yaml', 1];
      for (const format of invalidFormats) {
        expect(
          LlmNodeConfigSchema.safeParse({ ...validBase, responseFormat: format }).success,
        ).toBe(false);
      }
    });

    it('39. rejects credential and API key fields via strict mode', () => {
      const credentialFields = [
        { apiKey: 'sk-proj-1234567890' },
        { accessToken: 'ghp_secret_access_token' },
        { bearerToken: 'eyJhbGciOiJIUzI1Ni...' },
        { clientSecret: 'my-super-secret' },
        { password: 'admin' },
        { baseUrl: 'https://api.openai.com/v1' },
        { callback: 'https://webhook.site/abc' },
        { executableCode: 'process.exit(1)' },
      ];

      for (const extra of credentialFields) {
        const configWithSecret = { ...validBase, ...extra };
        expect(LlmNodeConfigSchema.safeParse(configWithSecret).success).toBe(false);
      }
    });

    it('40. rejects unexpected top-level configuration properties due to strict mode', () => {
      const extraProperties = [
        { customField: 'not-allowed' },
        { promptTemplate: 'Template' },
        { stream: true },
        { timeout: 30000 },
        { retries: 3 },
      ];

      for (const extra of extraProperties) {
        const configWithExtra = { ...validBase, ...extra };
        expect(LlmNodeConfigSchema.safeParse(configWithExtra).success).toBe(false);
      }
    });

    it('41. rejects explicitly present undefined for optional fields (JSON serialization policy)', () => {
      expect(
        LlmNodeConfigSchema.safeParse({
          ...validBase,
          systemInstruction: undefined,
        }).success,
      ).toBe(false);

      expect(
        LlmNodeConfigSchema.safeParse({
          ...validBase,
          temperature: undefined,
        }).success,
      ).toBe(false);

      expect(
        LlmNodeConfigSchema.safeParse({
          ...validBase,
          maxTokens: undefined,
        }).success,
      ).toBe(false);

      expect(
        LlmNodeConfigSchema.safeParse({
          ...validBase,
          responseFormat: undefined,
        }).success,
      ).toBe(false);
    });
  });

  describe('Boundary and Structural Integration Tests', () => {
    it('42. WorkflowNodeSchema accepts an LLM node with empty draft config: {}', () => {
      const draftLlmNode: WorkflowNode = {
        id: 'node-llm-draft',
        type: 'LLM',
        position: { x: 250, y: 100 },
        config: {},
      };

      const result = WorkflowNodeSchema.safeParse(draftLlmNode);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(draftLlmNode);
      }
    });

    it('43. LlmNodeConfigSchema strictly rejects incomplete empty configuration {}', () => {
      const result = LlmNodeConfigSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('44. LLM node configuration is independent of graph edges existing', () => {
      const isolatedLlmNode: WorkflowNode = {
        id: 'node-llm-1',
        type: 'LLM',
        position: { x: 250, y: 0 },
        config: {
          provider: 'google',
          model: 'gemini-2.5-pro',
          prompt: {
            type: 'literal',
            value: 'Review pull request',
          },
        },
      };

      // Valid node without any connected edges in graph
      const isolatedGraph: WorkflowGraph = {
        nodes: [isolatedLlmNode],
        edges: [],
      };

      const result = WorkflowGraphSchema.safeParse(isolatedGraph);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(isolatedGraph);
      }
    });

    it('45. LlmNodeConfigSchema does not validate referenced node existence (deferred to graph engine)', () => {
      // Configuration points to a non-existent node 'node-upstream-future'
      const config: LlmNodeConfig = {
        provider: 'openai',
        model: 'gpt-4o',
        prompt: {
          type: 'reference',
          reference: {
            source: 'node_output',
            nodeId: 'node-upstream-future',
            path: ['text'],
          },
        },
      };

      // Schema validates structural syntax only; DAG resolution is Milestone 2B
      const result = LlmNodeConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('46. WorkflowGraphSchema successfully parses a full workflow containing an LLM node', () => {
      const fullGraph: WorkflowGraph = {
        nodes: [
          {
            id: 'node-input-1',
            type: 'INPUT',
            position: { x: 0, y: 0 },
            config: {
              fields: [{ name: 'prDiff', type: 'string', required: true }],
            },
          },
          {
            id: 'node-llm-review',
            type: 'LLM',
            position: { x: 300, y: 0 },
            config: {
              provider: 'google',
              model: 'gemini-2.5-pro',
              prompt: {
                type: 'reference',
                reference: {
                  source: 'input',
                  field: 'prDiff',
                  path: [],
                },
              },
              systemInstruction: 'You are an automated code security reviewer.',
              temperature: 0.1,
              maxTokens: 2048,
              responseFormat: 'json',
            },
          },
          {
            id: 'node-output-1',
            type: 'OUTPUT',
            position: { x: 600, y: 0 },
            config: {
              payloadMapping: {
                reviewResult: {
                  type: 'reference',
                  reference: {
                    source: 'node_output',
                    nodeId: 'node-llm-review',
                    path: ['findings'],
                  },
                },
              },
            },
          },
        ],
        edges: [
          { id: 'edge-1', source: 'node-input-1', target: 'node-llm-review' },
          { id: 'edge-2', source: 'node-llm-review', target: 'node-output-1' },
        ],
      };

      const result = WorkflowGraphSchema.safeParse(fullGraph);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(fullGraph);
      }
    });
  });

  describe('Direct Schemas Verification', () => {
    it('verifies LlmResponseFormatSchema accepts approved values and rejects unapproved', () => {
      expect(LlmResponseFormatSchema.safeParse('text').success).toBe(true);
      expect(LlmResponseFormatSchema.safeParse('json').success).toBe(true);
      expect(LlmResponseFormatSchema.safeParse('xml').success).toBe(false);
      expect(LlmResponseFormatSchema.safeParse('').success).toBe(false);
    });

    it('verifies LlmPromptBindingSchema directly with both variants', () => {
      const literalBinding = {
        type: 'literal' as const,
        value: 'Direct prompt literal test',
      };
      expect(LlmPromptBindingSchema.safeParse(literalBinding).success).toBe(true);

      const referenceBinding = {
        type: 'reference' as const,
        reference: {
          source: 'input' as const,
          field: 'promptField',
          path: [],
        },
      };
      expect(LlmPromptBindingSchema.safeParse(referenceBinding).success).toBe(true);

      const invalidBinding = {
        type: 'template' as const,
        template: 'not supported in LLM prompt binding',
      };
      expect(LlmPromptBindingSchema.safeParse(invalidBinding).success).toBe(false);
    });
  });
});
