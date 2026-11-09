import { z } from 'zod';

export const APPROVAL_TITLE_MAX_LENGTH = 120;
export const APPROVAL_DESCRIPTION_MAX_LENGTH = 1000;
export const APPROVAL_POLICY_MAX_ROLES = 3;
export const APPROVAL_TIMEOUT_MINUTES_MIN = 1;
export const APPROVAL_TIMEOUT_MINUTES_MAX = 10080; // 7 days (7 * 24 * 60)

/**
 * Approved workspace membership roles for human approval policies.
 * Opaque configuration identifiers; actual permission is verified at runtime.
 */
export const ApproverRoleSchema = z.enum(['OWNER', 'ADMIN', 'MEMBER']);

export type ApproverRole = z.infer<typeof ApproverRoleSchema>;

/**
 * Authorization policy schema specifying required approver workspace roles.
 * Rejects duplicate roles and unknown properties. Preserves authored order.
 */
export const ApprovalPolicySchema = z
  .object({
    roles: z
      .array(ApproverRoleSchema)
      .min(1, 'Approval policy must specify at least one role')
      .max(
        APPROVAL_POLICY_MAX_ROLES,
        `Approval policy must not exceed ${APPROVAL_POLICY_MAX_ROLES} roles`,
      ),
  })
  .strict()
  .superRefine((data, ctx) => {
    const seenRoles = new Set<string>();
    for (let i = 0; i < data.roles.length; i++) {
      const role = data.roles[i];
      if (!role) {
        continue;
      }
      if (seenRoles.has(role)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate approver role '${role}' in policy`,
          path: ['roles', i],
        });
      } else {
        seenRoles.add(role);
      }
    }
  });

export type ApprovalPolicy = z.infer<typeof ApprovalPolicySchema>;

/**
 * Approved timeout actions when an approval deadline expires without a decision.
 * Never automatically approves.
 */
export const ApprovalTimeoutActionSchema = z.enum(['REJECT', 'EXPIRE']);

export type ApprovalTimeoutAction = z.infer<typeof ApprovalTimeoutActionSchema>;

/**
 * Strict configuration schema for the human APPROVAL workflow node.
 * Declares gate title, optional description, approver role policy, and timeout parameters.
 */
export const ApprovalNodeConfigSchema = z
  .object({
    title: z
      .string()
      .min(1, 'Title must not be empty')
      .max(
        APPROVAL_TITLE_MAX_LENGTH,
        `Title must not exceed ${APPROVAL_TITLE_MAX_LENGTH} characters`,
      )
      .refine((val) => val.trim().length > 0, {
        message: 'Title must not be whitespace-only',
      }),
    description: z
      .string()
      .min(1, 'Description must not be empty')
      .max(
        APPROVAL_DESCRIPTION_MAX_LENGTH,
        `Description must not exceed ${APPROVAL_DESCRIPTION_MAX_LENGTH} characters`,
      )
      .refine((val) => val.trim().length > 0, {
        message: 'Description must not be whitespace-only',
      })
      .optional(),
    policy: ApprovalPolicySchema,
    timeoutMinutes: z
      .number()
      .int({ message: 'timeoutMinutes must be an integer' })
      .min(
        APPROVAL_TIMEOUT_MINUTES_MIN,
        `timeoutMinutes must be at least ${APPROVAL_TIMEOUT_MINUTES_MIN} minute`,
      )
      .max(
        APPROVAL_TIMEOUT_MINUTES_MAX,
        `timeoutMinutes must not exceed ${APPROVAL_TIMEOUT_MINUTES_MAX} minutes`,
      ),
    timeoutAction: ApprovalTimeoutActionSchema,
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
  });

export type ApprovalNodeConfig = z.infer<typeof ApprovalNodeConfigSchema>;
