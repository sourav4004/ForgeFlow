import { z } from 'zod';
import { WorkflowIdentifierSchema } from '../identifier.js';

export const InputFieldTypeSchema = z.enum(['string', 'number', 'boolean', 'json']);

export type InputFieldType = z.infer<typeof InputFieldTypeSchema>;

export const InputFieldDefinitionSchema = z
  .object({
    name: WorkflowIdentifierSchema,
    type: InputFieldTypeSchema,
    required: z.boolean(),
    description: z.string().max(500, 'Description must not exceed 500 characters').optional(),
    defaultValue: z.json().optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if ('description' in data && data.description === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'description cannot be explicitly undefined',
        path: ['description'],
      });
    }

    if ('defaultValue' in data) {
      if (data.defaultValue === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'defaultValue cannot be explicitly undefined',
          path: ['defaultValue'],
        });
        return;
      }

      const val = data.defaultValue;
      switch (data.type) {
        case 'string':
          if (typeof val !== 'string') {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Default value must be a string for field type 'string'",
              path: ['defaultValue'],
            });
          }
          break;
        case 'number':
          if (typeof val !== 'number' || !Number.isFinite(val)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Default value must be a finite number for field type 'number'",
              path: ['defaultValue'],
            });
          }
          break;
        case 'boolean':
          if (typeof val !== 'boolean') {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Default value must be a boolean for field type 'boolean'",
              path: ['defaultValue'],
            });
          }
          break;
        case 'json':
          // JSON compatibility is guaranteed by z.json()
          break;
      }
    }
  });

export type InputFieldDefinition = z.infer<typeof InputFieldDefinitionSchema>;

export const InputNodeConfigSchema = z
  .object({
    fields: z
      .array(InputFieldDefinitionSchema)
      .max(50, 'Input node cannot have more than 50 fields'),
  })
  .strict()
  .superRefine((data, ctx) => {
    const seenNames = new Set<string>();
    for (let i = 0; i < data.fields.length; i++) {
      const field = data.fields[i];
      if (!field) {
        continue;
      }
      if (seenNames.has(field.name)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate input field name '${field.name}'`,
          path: ['fields', i, 'name'],
        });
      } else {
        seenNames.add(field.name);
      }
    }
  });

export type InputNodeConfig = z.infer<typeof InputNodeConfigSchema>;
