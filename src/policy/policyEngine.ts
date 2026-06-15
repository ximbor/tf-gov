import { ResourceChange } from '../types/terraform';
import { Policy, PolicyCondition, PolicyResult, PolicyViolation } from '../types/policy';

export class PolicyEngine {
  evaluate(changes: ResourceChange[], policies: Policy[]): PolicyResult {
    const violations: PolicyViolation[] = [];
    const warnings: PolicyViolation[] = [];

    for (const change of changes) {
      for (const policy of policies) {
        if (!this.appliesToResource(policy, change)) continue;

        const violated = this.checkCondition(policy.condition, change);
        if (violated) {
          const entry: PolicyViolation = {
            policy,
            resource: change.address,
            message: `[${change.address}] violates "${policy.name}": ${policy.description}`,
          };
          if (policy.severity === 'error') {
            violations.push(entry);
          } else {
            warnings.push(entry);
          }
        }
      }
    }

    return {
      passed: violations.length === 0,
      violations,
      warnings,
    };
  }

  private appliesToResource(policy: Policy, change: ResourceChange): boolean {
    // Filter by resource type
    if (policy.resource_types && !policy.resource_types.includes(change.type)) {
      return false;
    }
    // Filter by action
    if (policy.on_actions) {
      const hasMatchingAction = change.change.actions.some((a) =>
        policy.on_actions!.includes(a as 'create' | 'update' | 'delete')
      );
      if (!hasMatchingAction) return false;
    }
    return true;
  }

  private checkCondition(condition: PolicyCondition, change: ResourceChange): boolean {
    const after = change.change.after ?? {};

    switch (condition.type) {
      case 'field_equals': {
        const val = this.getField(after, condition.field);
        return val === condition.value;
      }
      case 'field_not_equals': {
        const val = this.getField(after, condition.field);
        return val !== condition.value;
      }
      case 'field_contains': {
        const val = this.getField(after, condition.field);
        return typeof val === 'string' && val.includes(condition.value);
      }
      case 'field_matches': {
        const val = this.getField(after, condition.field);
        return typeof val === 'string' && new RegExp(condition.pattern).test(val);
      }
      case 'field_missing': {
        const val = this.getField(after, condition.field);
        return val === undefined || val === null;
      }
      case 'field_not_starts_with': {
        const val = this.getField(after, condition.field);
        return typeof val === 'string' && !val.startsWith(condition.prefix);
      }
      default:
        return false;
    }
  }

  // Supports dot notation: "tags.environment"
  private getField(obj: Record<string, unknown>, field: string): unknown {
    return field.split('.').reduce<unknown>((acc, key) => {
      if (acc && typeof acc === 'object') {
        return (acc as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
  }
}
