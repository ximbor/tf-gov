import * as fs from 'fs';
import * as path from 'path';
import { PlanParser } from '../src/parser/planParser';
import { PolicyEngine } from '../src/policy/policyEngine';
import { PolicyLoader } from '../src/policy/policyLoader';

const parser = new PlanParser();
const engine = new PolicyEngine();
const loader = new PolicyLoader();

const planJson = fs.readFileSync(
  path.join(__dirname, 'fixtures/plan-public-bucket.json'),
  'utf-8'
);
const plan = parser.parse(planJson);
const changes = parser.getChanges(plan);

const config = loader.loadFromFile(
  path.join(__dirname, 'fixtures/policies.yml')
);

describe('PolicyEngine', () => {
  it('detects S3 bucket with public ACL', () => {
    const result = engine.evaluate(changes, config.policies);
    const violation = result.violations.find(
      (v) => v.policy.name === 'no-public-s3'
    );
    expect(violation).toBeDefined();
    expect(violation?.resource).toBe('aws_s3_bucket.public_bucket');
  });

  it('detects resources outside EU region', () => {
    const result = engine.evaluate(changes, config.policies);
    const euViolations = result.violations.filter(
      (v) => v.policy.name === 'eu-region-only'
    );
    expect(euViolations).toHaveLength(2); // bucket + db both in us-east-1
  });

  it('detects publicly accessible database', () => {
    const result = engine.evaluate(changes, config.policies);
    const violation = result.violations.find(
      (v) => v.policy.name === 'no-public-db'
    );
    expect(violation).toBeDefined();
    expect(violation?.resource).toBe('aws_db_instance.main');
  });

  it('returns failed when there are violations', () => {
    const result = engine.evaluate(changes, config.policies);
    expect(result.passed).toBe(false);
  });

  it('returns passed when there are no violations', () => {
    const result = engine.evaluate([], config.policies);
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });
});
