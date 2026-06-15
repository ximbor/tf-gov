import { TerraformPlan, ResourceChange } from '../types/terraform';

export class PlanParser {
  parse(jsonContent: string): TerraformPlan {
    let raw: unknown;
    try {
      raw = JSON.parse(jsonContent);
    } catch {
      throw new Error('Invalid JSON: cannot parse Terraform plan');
    }

    if (!this.isValidPlan(raw)) {
      throw new Error('Invalid Terraform plan format: missing required fields');
    }

    return raw;
  }

  // Returns only resources with real changes (excludes no-op)
  getChanges(plan: TerraformPlan): ResourceChange[] {
    return plan.resource_changes.filter(
      (r) => !r.change.actions.every((a) => a === 'no-op')
    );
  }

  private isValidPlan(raw: unknown): raw is TerraformPlan {
    if (typeof raw !== 'object' || raw === null) return false;
    const obj = raw as Record<string, unknown>;
    return (
      typeof obj['format_version'] === 'string' &&
      Array.isArray(obj['resource_changes'])
    );
  }
}
