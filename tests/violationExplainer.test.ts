import { ViolationExplainer } from '../src/llm/violationExplainer';
import { PolicyViolation } from '../src/types/policy';

const violation: PolicyViolation = {
  policy: {
    name: 'aws-s3-no-public-acl',
    description: 'S3 buckets must not have a public ACL',
    severity: 'error',
    condition: { type: 'field_equals', field: 'acl', value: 'public-read' },
  },
  resource: 'aws_s3_bucket.my_bucket',
  message: '[aws_s3_bucket.my_bucket] violates "aws-s3-no-public-acl"',
};

const mockResponse = JSON.stringify([
  {
    resource: 'aws_s3_bucket.my_bucket',
    policy: 'aws-s3-no-public-acl',
    explanation: 'The bucket ACL is set to public-read, exposing all objects to the internet.',
    suggestion: 'Set acl = "private" and use pre-signed URLs for controlled access.',
  },
]);

describe('ViolationExplainer', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: mockResponse } }],
      }),
    }) as jest.Mock;
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('calls OpenAI with a prompt containing violation details', async () => {
    const explainer = new ViolationExplainer('fake-key');
    await explainer.explain([violation]);

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('returns explanations and summary for violations', async () => {
    const explainer = new ViolationExplainer('fake-key');
    const result = await explainer.explain([violation]);

    expect(result.explanations).toHaveLength(1);
    expect(result.explanations[0].resource).toBe('aws_s3_bucket.my_bucket');
    expect(result.summary).toContain('aws_s3_bucket.my_bucket');
    expect(result.summary).toContain('pre-signed URLs');
  });

  it('returns empty result when no violations are provided', async () => {
    const explainer = new ViolationExplainer('fake-key');
    const result = await explainer.explain([]);

    expect(result.explanations).toHaveLength(0);
    expect(result.summary).toBe('');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('handles malformed LLM response gracefully', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'not valid json' } }],
      }),
    }) as jest.Mock;

    const explainer = new ViolationExplainer('fake-key');
    const result = await explainer.explain([violation]);

    expect(result.explanations).toHaveLength(1);
    expect(result.explanations[0].resource).toBe('unknown');
  });
});
