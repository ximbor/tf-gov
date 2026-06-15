export type PolicySeverity = 'error' | 'warning';

export interface Policy {
  name: string;
  description: string;
  severity: PolicySeverity;
  // Resource types this policy applies to, e.g. ["aws_s3_bucket", "aws_db_instance"]
  // If omitted, applies to all resource types
  resource_types?: string[];
  // Actions that trigger this policy: create, update, delete
  on_actions?: ('create' | 'update' | 'delete')[];
  // Condition expressed as a field path and forbidden value
  condition: PolicyCondition;
}

export type PolicyCondition =
  | { type: 'field_equals'; field: string; value: unknown }
  | { type: 'field_not_equals'; field: string; value: unknown }
  | { type: 'field_contains'; field: string; value: string }
  | { type: 'field_matches'; field: string; pattern: string }
  | { type: 'field_missing'; field: string }
  | { type: 'field_not_starts_with'; field: string; prefix: string };

export interface PolicyConfig {
  policies: Policy[];
}

export interface PolicyViolation {
  policy: Policy;
  resource: string;  // address della risorsa, e.g. "aws_s3_bucket.my_bucket"
  message: string;
}

export interface PolicyResult {
  passed: boolean;
  violations: PolicyViolation[];
  warnings: PolicyViolation[];
}
