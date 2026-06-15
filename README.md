# tf-gov

Terraform governance for small teams — validate Terraform plans against policy rules before merge, with no infrastructure required.

## What it does

When a developer opens a pull request with Terraform changes, tf-gov:

1. Parses the Terraform plan JSON
2. Validates it against your team's policy rules
3. Posts a comment on the PR with the result
4. Blocks the merge if violations are found
5. Writes an audit log entry for every run

Optionally, if you provide an OpenAI API key, tf-gov generates human-friendly explanations and fix suggestions for each violation.

## Quick start

### 1. Add the workflow to your repository

Create `.github/workflows/tf-gov.yml`:

```yaml
name: Terraform Governance

on:
  pull_request:
    paths:
      - '**.tf'
      - '**.tfvars'

jobs:
  tf-gov:
    name: Policy Check
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v3

      - name: Terraform Init
        run: terraform init
        working-directory: ./infrastructure

      - name: Terraform Plan
        run: |
          terraform plan -out=plan.bin
          terraform show -json plan.bin > plan.json
        working-directory: ./infrastructure

      - name: Run tf-gov
        id: tf-gov
        uses: ximbor/tf-gov@v1
        with:
          plan-file: ./infrastructure/plan.json
          policy-file: .tf-gov/policies.yml
          # Optional: LLM-powered explanations
          # llm-api-key: ${{ secrets.OPENAI_API_KEY }}

      - name: Upload audit log
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: tf-gov-audit-${{ github.run_id }}
          path: .tf-gov/audit.log
          retention-days: 90
```

### 2. Create your policy file

Create `.tf-gov/policies.yml` in your repository:

```yaml
policies:
  - name: no-public-s3
    description: "S3 buckets must not have a public ACL"
    severity: error
    resource_types: ["aws_s3_bucket"]
    on_actions: ["create", "update"]
    condition:
      type: field_equals
      field: acl
      value: "public-read"

  - name: eu-region-only
    description: "Resources must be deployed in EU regions only"
    severity: error
    on_actions: ["create"]
    condition:
      type: field_not_starts_with
      field: region
      prefix: "eu-"
```

That's it. On the next PR that touches Terraform files, tf-gov will run automatically.

## Policy reference

### Fields

| Field | Required | Description |
|---|---|---|
| `name` | yes | Unique identifier for the policy |
| `description` | yes | Human-readable description shown in violation messages |
| `severity` | yes | `error` blocks the merge, `warning` only warns |
| `resource_types` | no | List of Terraform resource types to check. If omitted, applies to all |
| `on_actions` | no | Actions that trigger the policy: `create`, `update`, `delete`. If omitted, applies to all |
| `condition` | yes | The rule to evaluate |

### Condition types

| Type | Description | Fields |
|---|---|---|
| `field_equals` | Field equals a value | `field`, `value` |
| `field_not_equals` | Field does not equal a value | `field`, `value` |
| `field_contains` | Field contains a string | `field`, `value` |
| `field_matches` | Field matches a regex pattern | `field`, `pattern` |
| `field_missing` | Field is absent or null | `field` |
| `field_not_starts_with` | Field does not start with a prefix | `field`, `prefix` |

The `field` property supports dot notation for nested attributes: `tags.environment`, `settings.ip_configuration.ipv4_enabled`.

## Policy catalog

tf-gov ships with a set of ready-to-use policies for AWS, Azure, and GCP. You can use them as a starting point and extend with your own rules.

Catalog files are in the [`catalog/`](./catalog) directory:

- [`catalog/aws.yml`](./catalog/aws.yml) — S3, RDS, EC2, tagging, region
- [`catalog/azure.yml`](./catalog/azure.yml) — Storage, SQL, VM, Key Vault, tagging, region
- [`catalog/gcp.yml`](./catalog/gcp.yml) — Cloud Storage, Cloud SQL, Compute, tagging, region

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `plan-file` | yes | — | Path to the Terraform plan JSON file |
| `policy-file` | yes | `.tf-gov/policies.yml` | Path to the policy YAML file |
| `llm-api-key` | no | — | OpenAI API key for human-friendly violation explanations |

## Outputs

| Output | Description |
|---|---|
| `passed` | `true` if all policy checks passed, `false` otherwise |
| `violations` | JSON array of policy violations found |
| `summary` | Human-readable summary of the policy check result |

## Audit log

Every run appends an entry to `.tf-gov/audit.log` in newline-delimited JSON format. Each entry contains:

```json
{
  "timestamp": "2026-06-15T10:00:00.000Z",
  "repository": "owner/repo",
  "pr_number": 42,
  "actor": "developer",
  "plan_file": "plan.json",
  "policy_file": "policies.yml",
  "resources_analyzed": 3,
  "passed": false,
  "violations": [
    {
      "policy": "no-public-s3",
      "severity": "error",
      "resource": "aws_s3_bucket.my_bucket",
      "message": "[aws_s3_bucket.my_bucket] violates \"no-public-s3\": S3 buckets must not have a public ACL"
    }
  ],
  "warnings": []
}
```

Upload it as a GitHub Actions artifact to retain it across runs (see the workflow example above).

## CLI usage

tf-gov can also be used as a CLI tool for local validation:

```bash
npx ts-node src/index.ts <plan.json> <policies.yml>
```

Example:
```bash
terraform plan -out=plan.bin
terraform show -json plan.bin > plan.json
npx ts-node src/index.ts plan.json .tf-gov/policies.yml
```

## License

MIT
