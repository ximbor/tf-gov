import * as fs from 'fs';
import * as path from 'path';
import { PlanParser } from '../src/parser/planParser';

const parser = new PlanParser();
const planJson = fs.readFileSync(
  path.join(__dirname, 'fixtures/plan-public-bucket.json'),
  'utf-8'
);

describe('PlanParser', () => {
  it('parses a valid plan JSON correctly', () => {
    const plan = parser.parse(planJson);
    expect(plan.format_version).toBe('1.1');
    expect(plan.resource_changes).toHaveLength(2);
  });

  it('returns only resources with real changes', () => {
    const plan = parser.parse(planJson);
    const changes = parser.getChanges(plan);
    expect(changes).toHaveLength(2);
    expect(changes[0].address).toBe('aws_s3_bucket.public_bucket');
  });

  it('throws on invalid JSON', () => {
    expect(() => parser.parse('not-json')).toThrow('Invalid JSON');
  });

  it('throws on malformed plan', () => {
    expect(() => parser.parse('{}')).toThrow('Invalid Terraform plan format');
  });
});
