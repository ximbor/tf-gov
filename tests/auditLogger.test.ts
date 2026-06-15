import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { AuditLogger } from '../src/audit/auditLogger';
import { PolicyResult } from '../src/types/policy';

const passedResult: PolicyResult = {
  passed: true,
  violations: [],
  warnings: [],
};

const failedResult: PolicyResult = {
  passed: false,
  violations: [
    {
      policy: {
        name: 'no-public-s3',
        description: 'S3 buckets must not have a public ACL',
        severity: 'error',
        condition: { type: 'field_equals', field: 'acl', value: 'public-read' },
      },
      resource: 'aws_s3_bucket.my_bucket',
      message: '[aws_s3_bucket.my_bucket] violates "no-public-s3"',
    },
  ],
  warnings: [],
};

describe('AuditLogger', () => {
  let tmpDir: string;
  let logFile: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tf-gov-test-'));
    logFile = path.join(tmpDir, 'audit.log');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('creates the log file and writes a valid JSON entry', () => {
    const logger = new AuditLogger({ logFile, repository: 'owner/repo', prNumber: 42, actor: 'dev' });
    logger.log({ planFile: 'plan.json', policyFile: 'policies.yml', resourcesAnalyzed: 2, result: passedResult });

    expect(fs.existsSync(logFile)).toBe(true);
    const line = fs.readFileSync(logFile, 'utf-8').trim();
    const entry = JSON.parse(line);
    expect(entry.repository).toBe('owner/repo');
    expect(entry.pr_number).toBe(42);
    expect(entry.passed).toBe(true);
  });

  it('records violations in the audit entry', () => {
    const logger = new AuditLogger({ logFile });
    logger.log({ planFile: 'plan.json', policyFile: 'policies.yml', resourcesAnalyzed: 1, result: failedResult });

    const line = fs.readFileSync(logFile, 'utf-8').trim();
    const entry = JSON.parse(line);
    expect(entry.passed).toBe(false);
    expect(entry.violations).toHaveLength(1);
    expect(entry.violations[0].policy).toBe('no-public-s3');
  });

  it('appends multiple entries without overwriting', () => {
    const logger = new AuditLogger({ logFile });
    logger.log({ planFile: 'plan.json', policyFile: 'policies.yml', resourcesAnalyzed: 0, result: passedResult });
    logger.log({ planFile: 'plan.json', policyFile: 'policies.yml', resourcesAnalyzed: 1, result: failedResult });

    const lines = fs.readFileSync(logFile, 'utf-8').trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]).passed).toBe(true);
    expect(JSON.parse(lines[1]).passed).toBe(false);
  });
});
