import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  InputValueReferenceSchema,
  LiteralBindingSchema,
  NodeOutputValueReferenceSchema,
  PROPERTY_PATH_MAX_DEPTH,
  PROPERTY_PATH_SEGMENT_MAX_LENGTH,
  PropertyPathSegmentSchema,
  ReferenceBindingSchema,
  ValueBindingSchema,
  ValueReferenceSchema,
  WORKFLOW_IDENTIFIER_MAX_LENGTH,
  type InputValueReference,
  type LiteralBinding,
  type NodeOutputValueReference,
  type PropertyPathSegment,
  type ReferenceBinding,
  type ValueBinding,
  type ValueReference,
} from '../src/index.js';

describe('Value Binding and Reference Schemas', () => {
  describe('TypeScript Type Inference Verification', () => {
    it('infers exact types for literals, references, and union bindings', () => {
      expectTypeOf<PropertyPathSegment>().toEqualTypeOf<string>();

      expectTypeOf<LiteralBinding>().toMatchTypeOf<{
        type: 'literal';
        value: unknown;
      }>();

      expectTypeOf<InputValueReference>().toMatchTypeOf<{
        source: 'input';
        field: string;
        path: string[];
      }>();

      expectTypeOf<NodeOutputValueReference>().toMatchTypeOf<{
        source: 'node_output';
        nodeId: string;
        path: string[];
      }>();

      expectTypeOf<ValueReference>().toEqualTypeOf<
        InputValueReference | NodeOutputValueReference
      >();

      expectTypeOf<ReferenceBinding>().toMatchTypeOf<{
        type: 'reference';
        reference: ValueReference;
      }>();

      expectTypeOf<ValueBinding>().toEqualTypeOf<LiteralBinding | ReferenceBinding>();
    });

    it('narrows types based on discriminators at compile time', () => {
      const getNarrowedBinding = (): ValueBinding => ({
        type: 'reference',
        reference: {
          source: 'node_output',
          nodeId: 'llm-1',
          path: ['summary'],
        },
      });

      const binding = getNarrowedBinding();
      if (binding.type === 'literal') {
        expectTypeOf(binding.type).toEqualTypeOf<'literal'>();
        expectTypeOf(binding).toEqualTypeOf<LiteralBinding>();
      } else {
        expectTypeOf(binding.type).toEqualTypeOf<'reference'>();
        expectTypeOf(binding).toEqualTypeOf<ReferenceBinding>();
        const ref = binding.reference;
        if (ref.source === 'input') {
          expectTypeOf(ref.source).toEqualTypeOf<'input'>();
          expectTypeOf(ref).toEqualTypeOf<InputValueReference>();
        } else {
          expectTypeOf(ref.source).toEqualTypeOf<'node_output'>();
          expectTypeOf(ref).toEqualTypeOf<NodeOutputValueReference>();
        }
      }
    });
  });

  describe('Positive Validation Tests', () => {
    it('1. accepts a literal string binding', () => {
      const binding = { type: 'literal', value: 'production' };
      const result = ValueBindingSchema.safeParse(binding);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(binding);
      }
    });

    it('2. accepts a literal finite number binding', () => {
      const binding = { type: 'literal', value: 42.5 };
      const result = ValueBindingSchema.safeParse(binding);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(binding);
      }
    });

    it('3. accepts a literal boolean binding', () => {
      const bindingFalse = { type: 'literal', value: false };
      const bindingTrue = { type: 'literal', value: true };
      expect(ValueBindingSchema.safeParse(bindingFalse).success).toBe(true);
      expect(ValueBindingSchema.safeParse(bindingTrue).success).toBe(true);
    });

    it('4. accepts a literal null binding', () => {
      const binding = { type: 'literal', value: null };
      const result = ValueBindingSchema.safeParse(binding);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(binding);
      }
    });

    it('5. accepts a nested JSON literal binding', () => {
      const binding = {
        type: 'literal',
        value: {
          items: [1, 'two', { nested: true }],
          metadata: { tags: ['qa', 'ci'] },
        },
      };
      const result = ValueBindingSchema.safeParse(binding);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(binding);
      }
    });

    it('6. preserves a literal containing template text "{{input.value}}" unchanged without interpolation', () => {
      const binding = { type: 'literal', value: '{{input.value}}' };
      const result = ValueBindingSchema.safeParse(binding);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('literal');
        if (result.data.type === 'literal') {
          expect(result.data.value).toBe('{{input.value}}');
        }
      }
    });

    it('7. accepts an input reference with an empty path (referencing whole field)', () => {
      const binding = {
        type: 'reference',
        reference: {
          source: 'input',
          field: 'pullRequestNumber',
          path: [],
        },
      };
      const result = ValueBindingSchema.safeParse(binding);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(binding);
      }
    });

    it('8. accepts an input reference with a nested property path', () => {
      const binding = {
        type: 'reference',
        reference: {
          source: 'input',
          field: 'repository',
          path: ['owner', 'login'],
        },
      };
      const result = ValueBindingSchema.safeParse(binding);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(binding);
      }
    });

    it('9. accepts a node-output reference with an empty path (referencing whole output)', () => {
      const binding = {
        type: 'reference',
        reference: {
          source: 'node_output',
          nodeId: 'transform-node-1',
          path: [],
        },
      };
      const result = ValueBindingSchema.safeParse(binding);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(binding);
      }
    });

    it('10. accepts a node-output reference with a nested property path', () => {
      const binding = {
        type: 'reference',
        reference: {
          source: 'node_output',
          nodeId: 'llm-node',
          path: ['result', 'summary', 'text'],
        },
      };
      const result = ValueBindingSchema.safeParse(binding);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(binding);
      }
    });

    it('11. confirms node IDs containing dots remain valid without string splitting', () => {
      const binding = {
        type: 'reference',
        reference: {
          source: 'node_output',
          nodeId: 'llm.v1.prod',
          path: ['summary'],
        },
      };
      const result = ValueBindingSchema.safeParse(binding);
      expect(result.success).toBe(true);
      if (result.success && result.data.type === 'reference') {
        const ref = result.data.reference;
        if (ref.source === 'node_output') {
          expect(ref.nodeId).toBe('llm.v1.prod');
        }
      }
    });

    it('12. confirms path segments containing dots, spaces, and punctuation remain intact', () => {
      const binding = {
        type: 'reference',
        reference: {
          source: 'node_output',
          nodeId: 'node-1',
          path: ['data.result', 'first name', 'item-id#1'],
        },
      };
      const result = ValueBindingSchema.safeParse(binding);
      expect(result.success).toBe(true);
      if (result.success && result.data.type === 'reference') {
        expect(result.data.reference.path).toEqual(['data.result', 'first name', 'item-id#1']);
      }
    });

    it('13. preserves all authored data casing and characters exactly', () => {
      const binding = {
        type: 'reference',
        reference: {
          source: 'input',
          field: 'CamelCase_Field-Name',
          path: ['nested_Property', 'SubField.v2'],
        },
      };
      const result = ValueBindingSchema.safeParse(binding);
      expect(result.success).toBe(true);
      if (result.success && result.data.type === 'reference') {
        const ref = result.data.reference;
        if (ref.source === 'input') {
          expect(ref.field).toBe('CamelCase_Field-Name');
          expect(ref.path[0]).toBe('nested_Property');
          expect(ref.path[1]).toBe('SubField.v2');
        }
      }
    });

    it('14. verifies direct parsing of standalone schemas', () => {
      const lit = { type: 'literal' as const, value: 123 };
      const inRef = { source: 'input' as const, field: 'f1', path: [] };
      const outRef = {
        source: 'node_output' as const,
        nodeId: 'n1',
        path: ['res'],
      };

      expect(LiteralBindingSchema.safeParse(lit).success).toBe(true);
      expect(InputValueReferenceSchema.safeParse(inRef).success).toBe(true);
      expect(NodeOutputValueReferenceSchema.safeParse(outRef).success).toBe(true);
      expect(ValueReferenceSchema.safeParse(inRef).success).toBe(true);
      expect(ValueReferenceSchema.safeParse(outRef).success).toBe(true);
      expect(
        ReferenceBindingSchema.safeParse({
          type: 'reference',
          reference: inRef,
        }).success,
      ).toBe(true);
    });
  });

  describe('Negative Validation Tests', () => {
    it('15. rejects a binding missing the type property', () => {
      const result = ValueBindingSchema.safeParse({ value: 'hello' });
      expect(result.success).toBe(false);
    });

    it('16. rejects an unknown binding type', () => {
      const result = ValueBindingSchema.safeParse({
        type: 'unknown_type',
        value: 'hello',
      });
      expect(result.success).toBe(false);
    });

    it('17. rejects a literal binding missing the value property', () => {
      const result = LiteralBindingSchema.safeParse({ type: 'literal' });
      expect(result.success).toBe(false);
    });

    it('18. rejects an explicitly present undefined in literal value', () => {
      const result = LiteralBindingSchema.safeParse({
        type: 'literal',
        value: undefined,
      });
      expect(result.success).toBe(false);
    });

    it('19. rejects functions and non-JSON values in literal value', () => {
      expect(
        LiteralBindingSchema.safeParse({
          type: 'literal',
          value: () => 'forbidden',
        }).success,
      ).toBe(false);

      expect(
        LiteralBindingSchema.safeParse({
          type: 'literal',
          value: Symbol('test'),
        }).success,
      ).toBe(false);

      expect(
        LiteralBindingSchema.safeParse({
          type: 'literal',
          value: BigInt(9007199254740991),
        }).success,
      ).toBe(false);
    });

    it('20. rejects a reference missing the source property', () => {
      const result = ValueBindingSchema.safeParse({
        type: 'reference',
        reference: {
          field: 'prNumber',
          path: [],
        },
      });
      expect(result.success).toBe(false);
    });

    it('21. rejects an unknown reference source', () => {
      const result = ValueBindingSchema.safeParse({
        type: 'reference',
        reference: {
          source: 'unsupported_source',
          field: 'prNumber',
          path: [],
        },
      });
      expect(result.success).toBe(false);
    });

    it('22. rejects an input reference missing the field property', () => {
      const result = InputValueReferenceSchema.safeParse({
        source: 'input',
        path: [],
      });
      expect(result.success).toBe(false);
    });

    it('23. rejects a node-output reference missing the nodeId property', () => {
      const result = NodeOutputValueReferenceSchema.safeParse({
        source: 'node_output',
        path: [],
      });
      expect(result.success).toBe(false);
    });

    it('24. rejects empty or whitespace-only identifiers in references', () => {
      expect(
        InputValueReferenceSchema.safeParse({
          source: 'input',
          field: '',
          path: [],
        }).success,
      ).toBe(false);

      expect(
        InputValueReferenceSchema.safeParse({
          source: 'input',
          field: '   ',
          path: [],
        }).success,
      ).toBe(false);

      expect(
        NodeOutputValueReferenceSchema.safeParse({
          source: 'node_output',
          nodeId: '',
          path: [],
        }).success,
      ).toBe(false);

      expect(
        NodeOutputValueReferenceSchema.safeParse({
          source: 'node_output',
          nodeId: '   ',
          path: [],
        }).success,
      ).toBe(false);

      expect(
        NodeOutputValueReferenceSchema.safeParse({
          source: 'node_output',
          nodeId: 'a'.repeat(WORKFLOW_IDENTIFIER_MAX_LENGTH + 1),
          path: [],
        }).success,
      ).toBe(false);
    });

    it('25. rejects non-array path properties', () => {
      expect(
        InputValueReferenceSchema.safeParse({
          source: 'input',
          field: 'prNumber',
          path: 'not-an-array',
        }).success,
      ).toBe(false);

      expect(
        InputValueReferenceSchema.safeParse({
          source: 'input',
          field: 'prNumber',
          path: null,
        }).success,
      ).toBe(false);
    });

    it('26. rejects excessive path depth exceeding limit of 16 segments', () => {
      const oversizedPath = Array.from(
        { length: PROPERTY_PATH_MAX_DEPTH + 1 },
        (_, i) => `prop_${i}`,
      );
      const result = InputValueReferenceSchema.safeParse({
        source: 'input',
        field: 'repo',
        path: oversizedPath,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((i) =>
            i.message.includes(`${PROPERTY_PATH_MAX_DEPTH} segments`),
          ),
        ).toBe(true);
      }
    });

    it('27. rejects invalid path segments (empty string or exceeding 128 characters)', () => {
      expect(PropertyPathSegmentSchema.safeParse('').success).toBe(false);

      expect(
        PropertyPathSegmentSchema.safeParse('a'.repeat(PROPERTY_PATH_SEGMENT_MAX_LENGTH + 1))
          .success,
      ).toBe(false);

      expect(
        InputValueReferenceSchema.safeParse({
          source: 'input',
          field: 'repo',
          path: ['valid', ''],
        }).success,
      ).toBe(false);

      expect(
        NodeOutputValueReferenceSchema.safeParse({
          source: 'node_output',
          nodeId: 'node-1',
          path: ['a'.repeat(PROPERTY_PATH_SEGMENT_MAX_LENGTH + 1)],
        }).success,
      ).toBe(false);
    });

    it('28. rejects unexpected properties at every object level via strict validation', () => {
      // Outer literal binding extra property
      expect(
        LiteralBindingSchema.safeParse({
          type: 'literal',
          value: 123,
          extra: 'forbidden',
        }).success,
      ).toBe(false);

      // Outer reference binding extra property
      expect(
        ReferenceBindingSchema.safeParse({
          type: 'reference',
          reference: {
            source: 'input',
            field: 'pr',
            path: [],
          },
          extra: 'forbidden',
        }).success,
      ).toBe(false);

      // Inner input reference extra property
      expect(
        InputValueReferenceSchema.safeParse({
          source: 'input',
          field: 'pr',
          path: [],
          extra: 'forbidden',
        }).success,
      ).toBe(false);

      // Inner node output reference extra property
      expect(
        NodeOutputValueReferenceSchema.safeParse({
          source: 'node_output',
          nodeId: 'n1',
          path: [],
          extra: 'forbidden',
        }).success,
      ).toBe(false);
    });

    it('29. rejects legacy free-form dotted reference strings', () => {
      expect(ValueBindingSchema.safeParse('nodes.llm.v1.output.summary').success).toBe(false);

      expect(ValueBindingSchema.safeParse('{{input.prNumber}}').success).toBe(false);

      expect(
        ReferenceBindingSchema.safeParse({
          type: 'reference',
          reference: 'nodes.llm.v1.output.summary',
        }).success,
      ).toBe(false);
    });
  });
});
