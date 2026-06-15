export type ChangeAction = 'create' | 'update' | 'delete' | 'no-op' | 'replace';

export interface ResourceChange {
  address: string;       // e.g. "aws_s3_bucket.my_bucket"
  type: string;          // e.g. "aws_s3_bucket"
  name: string;          // e.g. "my_bucket"
  provider_name: string; // e.g. "registry.terraform.io/hashicorp/aws"
  change: {
    actions: ChangeAction[];
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
    after_unknown: Record<string, unknown>;
  };
}

export interface TerraformPlan {
  format_version: string;
  terraform_version: string;
  resource_changes: ResourceChange[];
  variables?: Record<string, { value: unknown }>;
}
