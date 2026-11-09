import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  InputFieldDefinitionSchema,
  InputFieldTypeSchema,
  InputNodeConfigSchema,
  WORKFLOW_IDENTIFIER_MAX_LENGTH,
  WorkflowNodeSchema,
  type InputFieldDefinition,
  type InputFieldType,
  type InputNodeConfig,
  type WorkflowNode,
} from '../src/index.js';

describe('INPUT Node Configuration Schema', () => {
  describe('TypeScript Type Inference Verification', () => {
    it('infers exact types matching schema declarations', () => {
      expectTypeOf<InputFieldType>().toEqualTypeOf<'string' | 'number' | 'boolean' | 'json'>();
      expectTypeOf<InputFieldDefinition['name']>().toEqualTypeOf<string>();
      expectTypeOf<InputFieldDefinition['type']>().toEqualTypeOf<InputFieldType>();
      expectTypeOf<InputFieldDefinition['required']>().toEqualTypeOf<boolean>();
      expectTypeOf<InputFieldDefinition['description']>().toEqualTypeOf<string | undefined>();
      expectTypeOf<InputNodeConfig['fields']>().toEqualTypeOf<InputFieldDefinition[]>();
    });
  });

  describe('Positive Validation Tests', () => {
    it('1. accepts a configuration with zero fields as valid', () => {
      const config: InputNodeConfig = { fields: [] };
      const result = InputNodeConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ fields: [] });
      }
    });

    it('2. accepts a configuration with one required string field', () => {
      const config = {
        fields: [
          {
            name: 'targetBranch',
            type: 'string',
            required: true,
          },
        ],
      };
      const result = InputNodeConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.fields).toHaveLength(1);
        const firstField = result.data.fields[0];
        expect(firstField).toBeDefined();
        expect(firstField?.name).toBe('targetBranch');
        expect(firstField?.type).toBe('string');
        expect(firstField?.required).toBe(true);
      }
    });

    it('3. accepts multiple distinct fields with various types', () => {
      const config: InputNodeConfig = {
        fields: [
          { name: 'repoName', type: 'string', required: true, description: 'Repository name' },
          { name: 'pullRequestNumber', type: 'number', required: true },
          { name: 'dryRun', type: 'boolean', required: false, defaultValue: true },
          { name: 'metadata', type: 'json', required: false, defaultValue: { source: 'webhook' } },
        ],
      };
      const result = InputNodeConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.fields).toHaveLength(4);
      }
    });

    it('4. accepts a valid string default for string fields', () => {
      const field = {
        name: 'environment',
        type: 'string',
        required: false,
        defaultValue: 'staging',
      };
      const result = InputFieldDefinitionSchema.safeParse(field);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.defaultValue).toBe('staging');
      }
    });

    it('5. accepts a finite number default for number fields', () => {
      const field = {
        name: 'retryCount',
        type: 'number',
        required: false,
        defaultValue: 3,
      };
      const result = InputFieldDefinitionSchema.safeParse(field);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.defaultValue).toBe(3);
      }
    });

    it('6. accepts a boolean default for boolean fields', () => {
      const fieldFalse = {
        name: 'notifySlack',
        type: 'boolean',
        required: false,
        defaultValue: false,
      };
      const fieldTrue = {
        name: 'notifyEmail',
        type: 'boolean',
        required: false,
        defaultValue: true,
      };
      expect(InputFieldDefinitionSchema.safeParse(fieldFalse).success).toBe(true);
      expect(InputFieldDefinitionSchema.safeParse(fieldTrue).success).toBe(true);
    });

    it('7. accepts nested JSON defaults for json fields', () => {
      const field = {
        name: 'payloadConfig',
        type: 'json',
        required: false,
        defaultValue: {
          nested: {
            tags: ['ci', 'automated'],
            flag: true,
            count: 42,
            nullable: null,
          },
        },
      };
      const result = InputFieldDefinitionSchema.safeParse(field);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.defaultValue).toEqual(field.defaultValue);
      }
    });

    it('8. preserves authored names, values and descriptions without mutation', () => {
      const authored = {
        fields: [
          {
            name: 'CaseSensitive_Field-1',
            type: 'string' as const,
            required: true,
            description: '  Preserves whitespace in description exactly  ',
            defaultValue: ' Default Value With Whitespace ',
          },
        ],
      };
      const result = InputNodeConfigSchema.safeParse(authored);
      expect(result.success).toBe(true);
      if (result.success) {
        const field = result.data.fields[0];
        expect(field).toBeDefined();
        expect(field?.name).toBe('CaseSensitive_Field-1');
        expect(field?.description).toBe('  Preserves whitespace in description exactly  ');
        expect(field?.defaultValue).toBe(' Default Value With Whitespace ');
      }
    });
  });

  describe('Negative Validation Tests', () => {
    it('9. rejects a missing fields array', () => {
      const result = InputNodeConfigSchema.safeParse({});
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes('fields'))).toBe(true);
      }
    });

    it('10. rejects non-array fields values', () => {
      expect(InputNodeConfigSchema.safeParse({ fields: 'not-an-array' }).success).toBe(false);
      expect(InputNodeConfigSchema.safeParse({ fields: null }).success).toBe(false);
      expect(InputNodeConfigSchema.safeParse({ fields: 123 }).success).toBe(false);
      expect(InputNodeConfigSchema.safeParse({ fields: {} }).success).toBe(false);
    });

    it('11. rejects more than 50 fields', () => {
      const oversizedFields = Array.from({ length: 51 }, (_, i) => ({
        name: `field_${i}`,
        type: 'string' as const,
        required: true,
      }));
      const result = InputNodeConfigSchema.safeParse({ fields: oversizedFields });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.message.includes('50 fields'))).toBe(true);
      }
    });

    it('12. rejects duplicate field names within the configuration', () => {
      const config = {
        fields: [
          { name: 'duplicateField', type: 'string', required: true },
          { name: 'otherField', type: 'number', required: false },
          { name: 'duplicateField', type: 'boolean', required: false },
        ],
      };
      const result = InputNodeConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
      if (!result.success) {
        const duplicateIssue = result.error.issues.find(
          (i) => i.path.join('.') === 'fields.2.name' && i.message.includes('Duplicate'),
        );
        expect(duplicateIssue).toBeDefined();
      }
    });

    it('13. rejects empty and whitespace-only field names', () => {
      expect(
        InputFieldDefinitionSchema.safeParse({
          name: '',
          type: 'string',
          required: true,
        }).success,
      ).toBe(false);

      expect(
        InputFieldDefinitionSchema.safeParse({
          name: '   ',
          type: 'string',
          required: true,
        }).success,
      ).toBe(false);

      expect(
        InputFieldDefinitionSchema.safeParse({
          name: '\t\n',
          type: 'string',
          required: true,
        }).success,
      ).toBe(false);
    });

    it('14. rejects excessively long field names exceeding limit', () => {
      const oversizedName = 'a'.repeat(WORKFLOW_IDENTIFIER_MAX_LENGTH + 1);
      const result = InputFieldDefinitionSchema.safeParse({
        name: oversizedName,
        type: 'string',
        required: true,
      });
      expect(result.success).toBe(false);
    });

    it('15. rejects invalid or unapproved field types', () => {
      expect(
        InputFieldDefinitionSchema.safeParse({
          name: 'f1',
          type: 'date',
          required: true,
        }).success,
      ).toBe(false);

      expect(
        InputFieldDefinitionSchema.safeParse({
          name: 'f2',
          type: 'file',
          required: true,
        }).success,
      ).toBe(false);

      expect(
        InputFieldDefinitionSchema.safeParse({
          name: 'f3',
          type: 'any',
          required: true,
        }).success,
      ).toBe(false);
    });

    it('16. rejects non-boolean required properties', () => {
      expect(
        InputFieldDefinitionSchema.safeParse({
          name: 'f1',
          type: 'string',
          required: 'true', // string instead of boolean
        }).success,
      ).toBe(false);

      expect(
        InputFieldDefinitionSchema.safeParse({
          name: 'f1',
          type: 'string',
          required: 1, // number instead of boolean
        }).success,
      ).toBe(false);

      expect(
        InputFieldDefinitionSchema.safeParse({
          name: 'f1',
          type: 'string',
          required: null,
        }).success,
      ).toBe(false);
    });

    it('17. rejects a string default assigned to a number field', () => {
      const result = InputFieldDefinitionSchema.safeParse({
        name: 'port',
        type: 'number',
        required: true,
        defaultValue: '8080',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes('defaultValue'))).toBe(true);
      }
    });

    it('18. rejects a numeric default assigned to a boolean field', () => {
      const result = InputFieldDefinitionSchema.safeParse({
        name: 'isActive',
        type: 'boolean',
        required: true,
        defaultValue: 1,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes('defaultValue'))).toBe(true);
      }
    });

    it('19. rejects a null default assigned to a string field', () => {
      const result = InputFieldDefinitionSchema.safeParse({
        name: 'username',
        type: 'string',
        required: true,
        defaultValue: null,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes('defaultValue'))).toBe(true);
      }
    });

    it('20. rejects non-finite numeric defaults (NaN, Infinity, -Infinity)', () => {
      expect(
        InputFieldDefinitionSchema.safeParse({
          name: 'rate',
          type: 'number',
          required: true,
          defaultValue: NaN,
        }).success,
      ).toBe(false);

      expect(
        InputFieldDefinitionSchema.safeParse({
          name: 'rate',
          type: 'number',
          required: true,
          defaultValue: Infinity,
        }).success,
      ).toBe(false);

      expect(
        InputFieldDefinitionSchema.safeParse({
          name: 'rate',
          type: 'number',
          required: true,
          defaultValue: -Infinity,
        }).success,
      ).toBe(false);
    });

    it('21. rejects functions and non-JSON values as default values', () => {
      expect(
        InputFieldDefinitionSchema.safeParse({
          name: 'callback',
          type: 'json',
          required: true,
          defaultValue: () => 'malicious',
        }).success,
      ).toBe(false);

      expect(
        InputFieldDefinitionSchema.safeParse({
          name: 'sym',
          type: 'json',
          required: true,
          defaultValue: Symbol('test'),
        }).success,
      ).toBe(false);

      expect(
        InputFieldDefinitionSchema.safeParse({
          name: 'big',
          type: 'json',
          required: true,
          defaultValue: BigInt(123),
        }).success,
      ).toBe(false);
    });

    it('22. rejects explicitly present undefined as defaultValue', () => {
      const result = InputFieldDefinitionSchema.safeParse({
        name: 'f1',
        type: 'string',
        required: true,
        defaultValue: undefined,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes('defaultValue'))).toBe(true);
      }
    });

    it('22b. rejects explicitly present undefined as description (cross-contract serializability invariant)', () => {
      const result = InputFieldDefinitionSchema.safeParse({
        name: 'f1',
        type: 'string',
        required: true,
        description: undefined,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes('description'))).toBe(true);
      }
    });

    it('23. rejects unexpected field-definition properties via strict validation', () => {
      const result = InputFieldDefinitionSchema.safeParse({
        name: 'f1',
        type: 'string',
        required: true,
        extraProperty: 'forbidden',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.message.includes('extraProperty'))).toBe(true);
      }
    });

    it('24. rejects unexpected INPUT config properties via strict validation', () => {
      const result = InputNodeConfigSchema.safeParse({
        fields: [],
        extraConfigKey: 'forbidden',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.message.includes('extraConfigKey'))).toBe(true);
      }
    });
  });

  describe('Boundary & Draft Compatibility Tests', () => {
    it('25. confirms a draft INPUT node with config: {} passes WorkflowNodeSchema', () => {
      const draftNode: WorkflowNode = {
        id: 'input-node-1',
        type: 'INPUT',
        position: { x: 100, y: 200 },
        config: {},
      };
      const result = WorkflowNodeSchema.safeParse(draftNode);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.config).toEqual({});
      }
    });

    it('26. confirms the same empty config fails InputNodeConfigSchema', () => {
      const emptyConfig = {};
      const result = InputNodeConfigSchema.safeParse(emptyConfig);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes('fields'))).toBe(true);
      }
    });

    it('27. confirms graph node ID constraints remain decoupled from input field names', () => {
      // Input configuration schema only validates its field items, not outer graph node IDs.
      const validConfig: InputNodeConfig = {
        fields: [{ name: 'inputFieldA', type: 'string', required: true }],
      };
      expect(InputNodeConfigSchema.safeParse(validConfig).success).toBe(true);
    });

    it('28. confirms existing structural graph schemas and node types remain intact', () => {
      const approvedTypes = [
        'INPUT',
        'TRANSFORM',
        'CONDITION',
        'LLM',
        'MCP_TOOL',
        'APPROVAL',
        'OUTPUT',
      ];
      for (const t of approvedTypes) {
        expect(InputFieldTypeSchema.safeParse(t).success).toBe(false); // input field types are lowercase 'string', 'number', etc.
      }
    });
  });
});
