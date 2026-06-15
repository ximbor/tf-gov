import { Octokit } from '@octokit/rest';
import { PolicyResult } from '../types/policy';

interface GitHubContext {
  token: string;
  owner: string;
  repo: string;
  prNumber: number;
}

const COMMENT_MARKER = '<!-- tf-gov -->';

export class PrCommenter {
  private octokit: Octokit;
  private context: GitHubContext;

  constructor(context: GitHubContext) {
    this.octokit = new Octokit({ auth: context.token });
    this.context = context;
  }

  async upsertComment(result: PolicyResult, summary: string): Promise<void> {
    const body = this.buildCommentBody(result, summary);
    const existing = await this.findExistingComment();

    if (existing) {
      await this.octokit.issues.updateComment({
        owner: this.context.owner,
        repo: this.context.repo,
        comment_id: existing.id,
        body,
      });
    } else {
      await this.octokit.issues.createComment({
        owner: this.context.owner,
        repo: this.context.repo,
        issue_number: this.context.prNumber,
        body,
      });
    }
  }

  private buildCommentBody(result: PolicyResult, summary: string): string {
    const lines: string[] = [COMMENT_MARKER];

    lines.push('## tf-gov — Terraform Policy Check\n');
    lines.push('```');
    lines.push(summary);
    lines.push('```');

    if (result.violations.length > 0) {
      lines.push('\n> ❌ Merge is blocked until all violations are resolved.');
    } else if (result.warnings.length > 0) {
      lines.push('\n> ⚠️ Warnings found — review before merging.');
    } else {
      lines.push('\n> ✅ All checks passed — ready to merge.');
    }

    return lines.join('\n');
  }

  // Find an existing tf-gov comment on the PR to update instead of creating a new one
  private async findExistingComment(): Promise<{ id: number } | null> {
    const comments = await this.octokit.issues.listComments({
      owner: this.context.owner,
      repo: this.context.repo,
      issue_number: this.context.prNumber,
    });

    const found = comments.data.find((c) => c.body?.includes(COMMENT_MARKER));
    return found ? { id: found.id } : null;
  }
}
