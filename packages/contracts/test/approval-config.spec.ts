import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  APPROVAL_DESCRIPTION_MAX_LENGTH,
  APPROVAL_POLICY_MAX_ROLES,
  APPROVAL_TIMEOUT_MINUTES_MAX,
  APPROVAL_TIMEOUT_MINUTES_MIN,
  APPROVAL_TITLE_MAX_LENGTH,
  ApprovalNodeConfigSchema,
  ApprovalPolicySchema,
  ApprovalTimeoutActionSchema,
  ApproverRoleSchema,
  WorkflowGraphSchema,
  WorkflowNodeSchema,
  type ApprovalNodeConfig,
  type ApprovalPolicy,
  type ApprovalTimeoutAction,
  type ApproverRole,
  type WorkflowGraph,
  type WorkflowNode,
} from '../src/index.js';

describe('Human APPROVAL Node Configuration Schema', () => {
  describe('TypeScript Type Inference Verification', () => {
    it('infers exact types matching schema declarations', () => {
      expectTypeOf<ApproverRole>().toEqualTypeOf<'OWNER' | 'ADMIN' | 'MEMBER'>();
      expectTypeOf<ApprovalTimeoutAction>().toEqualTypeOf<'REJECT' | 'EXPIRE'>();

      expectTypeOf<ApprovalPolicy>().toMatchTypeOf<{
        roles: ApproverRole[];
      }>();

      expectTypeOf<ApprovalNodeConfig>().toMatchTypeOf<{
        title: string;
        description?: string | undefined;
        policy: ApprovalPolicy;
        timeoutMinutes: number;
        timeoutAction: ApprovalTimeoutAction;
      }>();
    });
  });

  describe('Positive Validation Tests', () => {
    it('1. accepts valid minimal configuration with all required fields', () => {
      const config: ApprovalNodeConfig = {
        title: 'Approve production deployment',
        policy: {
          roles: ['ADMIN'],
        },
        timeoutMinutes: 60,
        timeoutAction: 'REJECT',
      };

      const result = ApprovalNodeConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(config);
      }
    });

    it('2. accepts configuration with optional description', () => {
      const config: ApprovalNodeConfig = {
        title: 'Review database migration',
        description:
          'Ensure the migration script has been tested on staging before applying to production.',
        policy: {
          roles: ['OWNER'],
        },
        timeoutMinutes: 120,
        timeoutAction: 'EXPIRE',
      };

      const result = ApprovalNodeConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(config);
      }
    });

    it('3. accepts OWNER role in approval policy', () => {
      const config: ApprovalNodeConfig = {
        title: 'Transfer repository ownership',
        policy: { roles: ['OWNER'] },
        timeoutMinutes: 1440,
        timeoutAction: 'REJECT',
      };

      const result = ApprovalNodeConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.policy.roles).toEqual(['OWNER']);
      }
    });

    it('4. accepts ADMIN role in approval policy', () => {
      const config: ApprovalNodeConfig = {
        title: 'Approve infrastructure change',
        policy: { roles: ['ADMIN'] },
        timeoutMinutes: 1440,
        timeoutAction: 'REJECT',
      };

      const result = ApprovalNodeConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.policy.roles).toEqual(['ADMIN']);
      }
    });

    it('5. accepts MEMBER role when explicitly selected in approval policy', () => {
      const config: ApprovalNodeConfig = {
        title: 'Peer code review signoff',
        policy: { roles: ['MEMBER'] },
        timeoutMinutes: 240,
        timeoutAction: 'EXPIRE',
      };

      const result = ApprovalNodeConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.policy.roles).toEqual(['MEMBER']);
      }
    });

    it('6. accepts multiple unique roles in approval policy', () => {
      const multiRoleCombinations: ApproverRole[][] = [
        ['OWNER', 'ADMIN'],
        ['ADMIN', 'MEMBER'],
        ['OWNER', 'MEMBER'],
        ['OWNER', 'ADMIN', 'MEMBER'],
      ];

      for (const roles of multiRoleCombinations) {
        const config: ApprovalNodeConfig = {
          title: 'Multi-role approval gate',
          policy: { roles },
          timeoutMinutes: 60,
          timeoutAction: 'REJECT',
        };

        const result = ApprovalNodeConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.policy.roles).toEqual(roles);
        }
      }
    });

    it('7. preserves authored role order exactly', () => {
      const orderedRoles: ApproverRole[] = ['MEMBER', 'ADMIN', 'OWNER'];
      const config: ApprovalNodeConfig = {
        title: 'Escalation review order',
        policy: { roles: orderedRoles },
        timeoutMinutes: 720,
        timeoutAction: 'REJECT',
      };

      const result = ApprovalNodeConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.policy.roles).toEqual(orderedRoles);
      }
    });

    it('8. accepts boundary timeout of 1 minute (APPROVAL_TIMEOUT_MINUTES_MIN)', () => {
      const config: ApprovalNodeConfig = {
        title: 'Instant verification gate',
        policy: { roles: ['ADMIN'] },
        timeoutMinutes: APPROVAL_TIMEOUT_MINUTES_MIN,
        timeoutAction: 'EXPIRE',
      };

      const result = ApprovalNodeConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.timeoutMinutes).toBe(1);
      }
    });

    it('9. accepts boundary timeout of 10,080 minutes (APPROVAL_TIMEOUT_MINUTES_MAX - 7 days)', () => {
      const config: ApprovalNodeConfig = {
        title: 'Seven-day approval window',
        policy: { roles: ['OWNER'] },
        timeoutMinutes: APPROVAL_TIMEOUT_MINUTES_MAX,
        timeoutAction: 'REJECT',
      };

      const result = ApprovalNodeConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.timeoutMinutes).toBe(10080);
      }
    });

    it('10. accepts REJECT timeout action', () => {
      const config: ApprovalNodeConfig = {
        title: 'Security-critical release',
        policy: { roles: ['ADMIN'] },
        timeoutMinutes: 60,
        timeoutAction: 'REJECT',
      };

      const result = ApprovalNodeConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.timeoutAction).toBe('REJECT');
      }
    });

    it('11. accepts EXPIRE timeout action', () => {
      const config: ApprovalNodeConfig = {
        title: 'Non-blocking advisory gate',
        policy: { roles: ['MEMBER'] },
        timeoutMinutes: 120,
        timeoutAction: 'EXPIRE',
      };

      const result = ApprovalNodeConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.timeoutAction).toBe('EXPIRE');
      }
    });

    it('12. preserves omitted optional description without injecting a default value', () => {
      const config = {
        title: 'Production hotfix',
        policy: { roles: ['OWNER' as const] },
        timeoutMinutes: 30,
        timeoutAction: 'REJECT' as const,
      };

      const result = ApprovalNodeConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect('description' in result.data).toBe(false);
      }
    });

    it('13. preserves multiline formatting and whitespace in title and description', () => {
      const multilineDescription = [
        'Detailed review checklist:',
        '  - All unit tests must pass.',
        '  - Security team signoff required.',
        '  - No high-severity CVEs in dependencies.',
      ].join('\n');

      const config: ApprovalNodeConfig = {
        title: 'Security Checklist Verification',
        description: multilineDescription,
        policy: { roles: ['ADMIN', 'OWNER'] },
        timeoutMinutes: 480,
        timeoutAction: 'REJECT',
      };

      const result = ApprovalNodeConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.description).toBe(multilineDescription);
      }
    });

    it('14. parses configuration without requiring external database or auth services', () => {
      const config: ApprovalNodeConfig = {
        title: 'Standalone schema validation',
        policy: { roles: ['ADMIN'] },
        timeoutMinutes: 60,
        timeoutAction: 'EXPIRE',
      };

      expect(ApprovalNodeConfigSchema.safeParse(config).success).toBe(true);
    });

    it('15. parses configuration independently of workflow graph topology', () => {
      const node: WorkflowNode = {
        id: 'node-approval-isolated',
        type: 'APPROVAL',
        position: { x: 100, y: 200 },
        config: {
          title: 'Isolated approval node without edges',
          policy: { roles: ['ADMIN'] },
          timeoutMinutes: 60,
          timeoutAction: 'REJECT',
        },
      };

      const graph: WorkflowGraph = {
        nodes: [node],
        edges: [],
      };

      expect(WorkflowGraphSchema.safeParse(graph).success).toBe(true);
    });
  });

  describe('Negative Validation Tests', () => {
    const validBase = {
      title: 'Approve release',
      policy: { roles: ['ADMIN' as const] },
      timeoutMinutes: 60,
      timeoutAction: 'REJECT' as const,
    };

    it('16. rejects missing title', () => {
      const { title: _, ...missingTitle } = validBase;
      expect(ApprovalNodeConfigSchema.safeParse(missingTitle).success).toBe(false);
    });

    it('17. rejects empty or whitespace-only title', () => {
      expect(ApprovalNodeConfigSchema.safeParse({ ...validBase, title: '' }).success).toBe(false);
      expect(ApprovalNodeConfigSchema.safeParse({ ...validBase, title: '   ' }).success).toBe(
        false,
      );
      expect(ApprovalNodeConfigSchema.safeParse({ ...validBase, title: '\t\n' }).success).toBe(
        false,
      );
    });

    it('18. rejects oversized title exceeding 120 characters', () => {
      const oversizedTitle = 'a'.repeat(APPROVAL_TITLE_MAX_LENGTH + 1);
      expect(
        ApprovalNodeConfigSchema.safeParse({ ...validBase, title: oversizedTitle }).success,
      ).toBe(false);
    });

    it('19. rejects invalid description (empty, whitespace-only, oversized, non-string)', () => {
      expect(ApprovalNodeConfigSchema.safeParse({ ...validBase, description: '' }).success).toBe(
        false,
      );
      expect(ApprovalNodeConfigSchema.safeParse({ ...validBase, description: '   ' }).success).toBe(
        false,
      );
      expect(
        ApprovalNodeConfigSchema.safeParse({
          ...validBase,
          description: 'd'.repeat(APPROVAL_DESCRIPTION_MAX_LENGTH + 1),
        }).success,
      ).toBe(false);
      expect(ApprovalNodeConfigSchema.safeParse({ ...validBase, description: 12345 }).success).toBe(
        false,
      );
    });

    it('20. rejects explicit undefined for description (JSON serialization policy)', () => {
      const config = {
        ...validBase,
        description: undefined,
      };

      const result = ApprovalNodeConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path[0] === 'description');
        expect(issue).toBeDefined();
        expect(issue?.message).toContain('explicitly undefined');
      }
    });

    it('21. rejects missing policy', () => {
      const { policy: _, ...missingPolicy } = validBase;
      expect(ApprovalNodeConfigSchema.safeParse(missingPolicy).success).toBe(false);
    });

    it('22. rejects missing policy.roles', () => {
      const config = {
        ...validBase,
        policy: {},
      };
      expect(ApprovalNodeConfigSchema.safeParse(config).success).toBe(false);
    });

    it('23. rejects empty roles array in policy', () => {
      const config = {
        ...validBase,
        policy: { roles: [] },
      };
      expect(ApprovalNodeConfigSchema.safeParse(config).success).toBe(false);
      expect(ApprovalPolicySchema.safeParse({ roles: [] }).success).toBe(false);
    });

    it('24. rejects duplicate roles in policy with error at path policy.roles[index]', () => {
      const config = {
        ...validBase,
        policy: { roles: ['ADMIN', 'ADMIN'] },
      };

      const result = ApprovalNodeConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find(
          (i) =>
            i.path.join('.') === 'policy.roles.1' && i.message.includes('Duplicate approver role'),
        );
        expect(issue).toBeDefined();
      }
    });

    it('25. rejects unsupported roles in policy', () => {
      const unsupportedRoles = [
        'SUPER_ADMIN',
        'GUEST',
        'ANONYMOUS',
        'EVERYONE',
        'PUBLIC',
        'REVIEWER',
        'admin',
      ];

      for (const role of unsupportedRoles) {
        const config = {
          ...validBase,
          policy: { roles: [role] },
        };
        expect(ApprovalNodeConfigSchema.safeParse(config).success).toBe(false);
      }
    });

    it('26. rejects more than 3 roles in policy (APPROVAL_POLICY_MAX_ROLES limit)', () => {
      expect(APPROVAL_POLICY_MAX_ROLES).toBe(3);
      const config = {
        ...validBase,
        policy: { roles: ['OWNER', 'ADMIN', 'MEMBER', 'ADMIN'] },
      };
      expect(ApprovalNodeConfigSchema.safeParse(config).success).toBe(false);
    });

    it('27. rejects non-array roles', () => {
      expect(
        ApprovalNodeConfigSchema.safeParse({ ...validBase, policy: { roles: 'ADMIN' } }).success,
      ).toBe(false);
      expect(
        ApprovalNodeConfigSchema.safeParse({ ...validBase, policy: { roles: 123 } }).success,
      ).toBe(false);
      expect(
        ApprovalNodeConfigSchema.safeParse({ ...validBase, policy: { roles: null } }).success,
      ).toBe(false);
    });

    it('28. rejects unknown nested policy properties via strict mode', () => {
      const config = {
        ...validBase,
        policy: {
          roles: ['ADMIN'],
          requireAll: true,
        },
      };
      expect(ApprovalNodeConfigSchema.safeParse(config).success).toBe(false);
    });

    it('29. rejects missing timeoutMinutes', () => {
      const { timeoutMinutes: _, ...missingTimeout } = validBase;
      expect(ApprovalNodeConfigSchema.safeParse(missingTimeout).success).toBe(false);
    });

    it('30. rejects fractional timeoutMinutes', () => {
      expect(
        ApprovalNodeConfigSchema.safeParse({ ...validBase, timeoutMinutes: 1.5 }).success,
      ).toBe(false);
      expect(
        ApprovalNodeConfigSchema.safeParse({ ...validBase, timeoutMinutes: 60.001 }).success,
      ).toBe(false);
    });

    it('31. rejects zero, negative, or oversized timeoutMinutes', () => {
      expect(ApprovalNodeConfigSchema.safeParse({ ...validBase, timeoutMinutes: 0 }).success).toBe(
        false,
      );
      expect(
        ApprovalNodeConfigSchema.safeParse({ ...validBase, timeoutMinutes: -60 }).success,
      ).toBe(false);
      expect(
        ApprovalNodeConfigSchema.safeParse({
          ...validBase,
          timeoutMinutes: APPROVAL_TIMEOUT_MINUTES_MAX + 1,
        }).success,
      ).toBe(false);
    });

    it('32. rejects NaN, Infinity, and string timeoutMinutes', () => {
      expect(
        ApprovalNodeConfigSchema.safeParse({ ...validBase, timeoutMinutes: NaN }).success,
      ).toBe(false);
      expect(
        ApprovalNodeConfigSchema.safeParse({
          ...validBase,
          timeoutMinutes: Number.POSITIVE_INFINITY,
        }).success,
      ).toBe(false);
      expect(
        ApprovalNodeConfigSchema.safeParse({
          ...validBase,
          timeoutMinutes: Number.NEGATIVE_INFINITY,
        }).success,
      ).toBe(false);
      expect(
        ApprovalNodeConfigSchema.safeParse({ ...validBase, timeoutMinutes: '60' }).success,
      ).toBe(false);
    });

    it('33. rejects missing timeoutAction', () => {
      const { timeoutAction: _, ...missingAction } = validBase;
      expect(ApprovalNodeConfigSchema.safeParse(missingAction).success).toBe(false);
    });

    it('34. rejects invalid timeoutAction values (e.g. APPROVE, AUTO_APPROVE, CONTINUE, SKIP, RETRY)', () => {
      const invalidActions = [
        'APPROVE',
        'AUTO_APPROVE',
        'CONTINUE',
        'IGNORE',
        'SKIP',
        'RETRY',
        'reject',
        'expire',
        1,
      ];

      for (const action of invalidActions) {
        expect(
          ApprovalNodeConfigSchema.safeParse({ ...validBase, timeoutAction: action }).success,
        ).toBe(false);
      }
    });

    it('35. rejects auto-approval or self-authorization bypass fields via strict mode', () => {
      const bypassFields = [
        { autoApprove: true },
        { approved: true },
        { approvalGranted: true },
        { bypassApproval: true },
        { skipAuthorization: true },
        { allowAnonymous: true },
        { requireAuthentication: false },
        { approvalToken: 'secret_token' },
        { sessionToken: 'session_123' },
        { accessToken: 'ghp_secret' },
      ];

      for (const bypass of bypassFields) {
        expect(ApprovalNodeConfigSchema.safeParse({ ...validBase, ...bypass }).success).toBe(false);
      }
    });

    it('36. rejects runtime execution and decision state fields via strict mode', () => {
      const runtimeStateFields = [
        { status: 'PENDING' },
        { decision: 'APPROVED' },
        { decidedAt: '2026-11-04T00:00:00Z' },
        { decidedBy: 'user-123' },
        { approverUserId: 'user-123' },
        { approverUserIds: ['user-1', 'user-2'] },
        { executionId: 'exec-abc-123' },
        { runId: 'run-xyz' },
        { attempts: 1 },
        { notificationJobId: 'job-999' },
      ];

      for (const stateField of runtimeStateFields) {
        expect(ApprovalNodeConfigSchema.safeParse({ ...validBase, ...stateField }).success).toBe(
          false,
        );
      }
    });

    it('37. rejects unknown top-level configuration properties via strict mode', () => {
      const unexpected = [
        { extraField: 'not-allowed' },
        { prompt: 'should be on LLM node' },
        { integrationRef: 'should be on MCP_TOOL node' },
        { rules: [] },
      ];

      for (const extra of unexpected) {
        expect(ApprovalNodeConfigSchema.safeParse({ ...validBase, ...extra }).success).toBe(false);
      }
    });

    it('38. rejects non-object configurations', () => {
      expect(ApprovalNodeConfigSchema.safeParse(null).success).toBe(false);
      expect(ApprovalNodeConfigSchema.safeParse(undefined).success).toBe(false);
      expect(ApprovalNodeConfigSchema.safeParse('string-config').success).toBe(false);
      expect(ApprovalNodeConfigSchema.safeParse(123).success).toBe(false);
      expect(ApprovalNodeConfigSchema.safeParse([]).success).toBe(false);
    });
  });

  describe('Boundary and Structural Integration Tests', () => {
    it('39. WorkflowNodeSchema accepts an APPROVAL draft node with config: {}', () => {
      const draftNode: WorkflowNode = {
        id: 'node-approval-draft',
        type: 'APPROVAL',
        position: { x: 400, y: 200 },
        config: {},
      };

      const result = WorkflowNodeSchema.safeParse(draftNode);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(draftNode);
      }
    });

    it('40. ApprovalNodeConfigSchema strictly rejects incomplete empty object {}', () => {
      const result = ApprovalNodeConfigSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('41. WorkflowGraphSchema validates a graph containing a fully configured APPROVAL node', () => {
      const graph: WorkflowGraph = {
        nodes: [
          {
            id: 'node-llm-1',
            type: 'LLM',
            position: { x: 0, y: 0 },
            config: {
              provider: 'google',
              model: 'gemini-2.5-pro',
              prompt: { type: 'literal', value: 'Generate deployment plan' },
            },
          },
          {
            id: 'node-approval-gate',
            type: 'APPROVAL',
            position: { x: 300, y: 0 },
            config: {
              title: 'Approve Cloud Run Deployment',
              description: 'Human verification required for production deployment.',
              policy: { roles: ['OWNER', 'ADMIN'] },
              timeoutMinutes: 1440,
              timeoutAction: 'REJECT',
            },
          },
          {
            id: 'node-mcp-deploy',
            type: 'MCP_TOOL',
            position: { x: 600, y: 0 },
            config: {
              integrationRef: 'gcp-integration',
              toolName: 'cloud_run_deploy',
            },
          },
        ],
        edges: [
          { id: 'edge-1', source: 'node-llm-1', target: 'node-approval-gate' },
          { id: 'edge-2', source: 'node-approval-gate', target: 'node-mcp-deploy' },
        ],
      };

      const result = WorkflowGraphSchema.safeParse(graph);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(graph);
      }
    });
  });

  describe('Direct Schemas Verification', () => {
    it('verifies ApproverRoleSchema directly', () => {
      expect(ApproverRoleSchema.safeParse('OWNER').success).toBe(true);
      expect(ApproverRoleSchema.safeParse('ADMIN').success).toBe(true);
      expect(ApproverRoleSchema.safeParse('MEMBER').success).toBe(true);
      expect(ApproverRoleSchema.safeParse('OTHER').success).toBe(false);
    });

    it('verifies ApprovalTimeoutActionSchema directly', () => {
      expect(ApprovalTimeoutActionSchema.safeParse('REJECT').success).toBe(true);
      expect(ApprovalTimeoutActionSchema.safeParse('EXPIRE').success).toBe(true);
      expect(ApprovalTimeoutActionSchema.safeParse('APPROVE').success).toBe(false);
    });

    it('verifies ApprovalPolicySchema directly with valid and invalid configurations', () => {
      expect(ApprovalPolicySchema.safeParse({ roles: ['ADMIN'] }).success).toBe(true);
      expect(ApprovalPolicySchema.safeParse({ roles: ['OWNER', 'ADMIN', 'MEMBER'] }).success).toBe(
        true,
      );
      expect(ApprovalPolicySchema.safeParse({ roles: [] }).success).toBe(false);
      expect(ApprovalPolicySchema.safeParse({ roles: ['ADMIN', 'ADMIN'] }).success).toBe(false);
      expect(ApprovalPolicySchema.safeParse({ roles: ['ADMIN'], extra: 1 }).success).toBe(false);
    });
  });
});
