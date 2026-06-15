import * as fs from 'fs';
import * as path from 'path';
import { PlanParser } from './parser/planParser';
import { PolicyEngine } from './policy/policyEngine';
import { PolicyLoader } from './policy/policyLoader';
import { PolicyResult, PolicyViolation } from './types/policy';

interface RunOptions {
  planFile: string;
  policyFile: string;
}

interface RunResult {
  passed: boolean;
  result: PolicyResult;
  summary: string;
}

export function run(options: RunOptions): RunResult {
  const { planFile, policyFile } = options;

  if (!fs.existsSync(planFile)) {
    throw new Error(`Plan file not found: ${planFile}`);
  }
  if (!fs.existsSync(policyFile)) {
    throw new Error(`Policy file not found: ${policyFile}`);
  }

  const parser = new PlanParser();
  const engine = new PolicyEngine();
  const loader = new PolicyLoader();

  const planJson = fs.readFileSync(planFile, 'utf-8');
  const plan = parser.parse(planJson);
  const changes = parser.getChanges(plan);
  const config = loader.loadFromFile(policyFile);
  const result = engine.evaluate(changes, config.policies);

  const summary = formatSummary(result);

  return { passed: result.passed, result, summary };
}

function formatSummary(result: PolicyResult): string {
  const lines: string[] = [];

  if (result.passed && result.warnings.length === 0) {
    lines.push('✅ All policy checks passed.');
    return lines.join('\n');
  }

  if (result.violations.length > 0) {
    lines.push(`❌ ${result.violations.length} policy violation(s) found:\n`);
    result.violations.forEach((v) => lines.push(`  • ${v.message}`));
  }

  if (result.warnings.length > 0) {
    lines.push(`\n⚠️  ${result.warnings.length} warning(s):\n`);
    result.warnings.forEach((v: PolicyViolation) => lines.push(`  • ${v.message}`));
  }

  return lines.join('\n');
}

// CLI entrypoint
if (require.main === module) {
  const planFile = process.argv[2];
  const policyFile = process.argv[3];

  if (!planFile || !policyFile) {
    console.error('Usage: ts-node src/index.ts <plan.json> <policies.yml>');
    process.exit(1);
  }

  try {
    const { passed, summary } = run({
      planFile: path.resolve(planFile),
      policyFile: path.resolve(policyFile),
    });

    console.log(summary);
    process.exit(passed ? 0 : 1);
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    process.exit(1);
  }
}
