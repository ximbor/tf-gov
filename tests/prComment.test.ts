import { PrCommenter } from '../src/github/prComment';
import { PolicyResult } from '../src/types/policy';

// Mock Octokit to avoid real GitHub API calls in tests
jest.mock('@octokit/rest', () => {
  return {
    Octokit: jest.fn().mockImplementation(() => ({
      issues: {
        listComments: jest.fn().mockResolvedValue({ data: [] }),
        createComment: jest.fn().mockResolvedValue({}),
        updateComment: jest.fn().mockResolvedValue({}),
      },
    })),
  };
});

const context = {
  token: 'fake-token',
  owner: 'ximbor',
  repo: 'tf-gov',
  prNumber: 42,
};

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
      message: '[aws_s3_bucket.my_bucket] violates "no-public-s3": S3 buckets must not have a public ACL',
    },
  ],
  warnings: [],
};

describe('PrCommenter', () => {
  it('creates a comment when no existing comment is found', async () => {
    const commenter = new PrCommenter(context);
    const { Octokit } = require('@octokit/rest');
    const mockInstance = Octokit.mock.results[0].value;

    await commenter.upsertComment(passedResult, '✅ All policy checks passed.');

    expect(mockInstance.issues.createComment).toHaveBeenCalledWith(
      expect.objectContaining({ issue_number: 42 })
    );
  });

  it('updates existing comment instead of creating a new one', async () => {
    const { Octokit } = require('@octokit/rest');
    const mockInstance = {
      issues: {
        listComments: jest.fn().mockResolvedValue({
          data: [{ id: 99, body: '<!-- tf-gov -->\nPrevious result' }],
        }),
        createComment: jest.fn(),
        updateComment: jest.fn().mockResolvedValue({}),
      },
    };
    Octokit.mockImplementationOnce(() => mockInstance);

    const commenter = new PrCommenter(context);
    await commenter.upsertComment(passedResult, '✅ All policy checks passed.');

    expect(mockInstance.issues.updateComment).toHaveBeenCalledWith(
      expect.objectContaining({ comment_id: 99 })
    );
    expect(mockInstance.issues.createComment).not.toHaveBeenCalled();
  });

  it('includes violation details in comment body when checks fail', async () => {
    const { Octokit } = require('@octokit/rest');
    const mockInstance = {
      issues: {
        listComments: jest.fn().mockResolvedValue({ data: [] }),
        createComment: jest.fn().mockResolvedValue({}),
        updateComment: jest.fn(),
      },
    };
    Octokit.mockImplementationOnce(() => mockInstance);

    const commenter = new PrCommenter(context);
    await commenter.upsertComment(failedResult, '❌ 1 policy violation(s) found.');

    const body = mockInstance.issues.createComment.mock.calls[0][0].body;
    expect(body).toContain('❌ Merge is blocked until all violations are resolved.');
  });
});
