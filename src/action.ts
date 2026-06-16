import * as path from 'path';
import { run } from './index';
import { PrCommenter } from './github/prComment';
import { AuditLogger } from './audit/auditLogger';
import { ViolationExplainer } from './llm/violationExplainer';

// GitHub Actions communicates via environment files
// Multi-line values require a heredoc delimiter to avoid format errors
function setOutput(name: string, value: string): void {
  const outputFile = process.env['GITHUB_OUTPUT'];
  if (outputFile) {
    const fs = require('fs') as typeof import('fs');
    const delimiter = `EOF_${Date.now()}`;
    fs.appendFileSync(outputFile, `${name}<<${delimiter}\n${value}\n${delimiter}\n`);
  }
}

function setFailed(message: string): void {
  process.stdout.write(`::error::${message}\n`);
  process.exit(1);
}

function info(message: string): void {
  console.log(message);
}

// GitHub Actions passes inputs as environment variables: INPUT_<NAME>
function getInput(name: string, required = false): string {
  const val = process.env[`INPUT_${name.toUpperCase()}`] ?? '';
  if (required && !val) {
    setFailed(`Input "${name}" is required but was not provided.`);
  }
  return val;
}

async function main(): Promise<void> {
const planFile = path.resolve(getInput('plan-file', true));
  const policyFile = path.resolve(getInput('policy-file', true));

  info(`Running tf-gov`);
  info(`  Plan file:   ${planFile}`);
  info(`  Policy file: ${policyFile}`);

  try {
    const { passed, result: policyResult, summary } = run({ planFile, policyFile });

    setOutput('passed', String(passed));
    setOutput('violations', JSON.stringify(policyResult.violations));
    setOutput('summary', summary);

    info('\n' + summary);

    // Optional: enrich violation output with LLM explanations
    const llmApiKey = getInput('llm-api-key');
    if (llmApiKey && policyResult.violations.length > 0) {
      info('\nGenerating human-friendly explanations via LLM...');
      const explainer = new ViolationExplainer(llmApiKey);
      const explained = await explainer.explain(policyResult.violations);
      if (explained.summary) {
        info('\n── LLM Explanations ──────────────────────────────\n');
        info(explained.summary);
      }
    }

    // Write audit log
    const auditLogger = new AuditLogger({
      logFile: path.resolve('.tf-gov/audit.log'),
      repository: process.env['GITHUB_REPOSITORY'],
      prNumber: parseInt(process.env['GITHUB_REF']?.replace('refs/pull/', '').replace('/merge', '') ?? '0', 10) || undefined,
      actor: process.env['GITHUB_ACTOR'],
    });
    const entry = auditLogger.log({
      planFile,
      policyFile,
      resourcesAnalyzed: policyResult.violations.length + policyResult.warnings.length,
      result: policyResult,
    });
    info(`Audit entry written: ${entry.timestamp}`);

    // Post comment on PR if running inside a GitHub Actions PR context
    const token = process.env['GITHUB_TOKEN'];
    const repository = process.env['GITHUB_REPOSITORY'];
    const githubRef = process.env['GITHUB_REF'] ?? '';
    const prNumber = parseInt(githubRef.replace('refs/pull/', '').replace('/merge', ''), 10);

    if (token && repository && prNumber > 0) {
      const [owner, repo] = repository.split('/');
      const commenter = new PrCommenter({ token, owner, repo, prNumber });
      await commenter.upsertComment(policyResult, summary);
      info('PR comment posted.');
    }

    if (!passed) {
      setFailed(`tf-gov: ${policyResult.violations.length} policy violation(s) found. Merge is blocked.`);
    }
  } catch (err) {
    setFailed(`tf-gov error: ${(err as Error).message}`);
  }
}

main();
