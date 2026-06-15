import * as fs from 'fs';
import * as path from 'path';
import { PolicyResult, PolicyViolation } from '../types/policy';

export interface AuditEntry {
  timestamp: string;
  repository: string;
  pr_number: number | null;
  actor: string;
  plan_file: string;
  policy_file: string;
  resources_analyzed: number;
  passed: boolean;
  violations: AuditViolation[];
  warnings: AuditViolation[];
}

interface AuditViolation {
  policy: string;
  severity: string;
  resource: string;
  message: string;
}

interface AuditLoggerOptions {
  logFile: string;
  repository?: string;
  prNumber?: number;
  actor?: string;
}

export class AuditLogger {
  private options: AuditLoggerOptions;

  constructor(options: AuditLoggerOptions) {
    this.options = options;
  }

  log(params: {
    planFile: string;
    policyFile: string;
    resourcesAnalyzed: number;
    result: PolicyResult;
  }): AuditEntry {
    const entry: AuditEntry = {
      timestamp: new Date().toISOString(),
      repository: this.options.repository ?? 'unknown',
      pr_number: this.options.prNumber ?? null,
      actor: this.options.actor ?? 'unknown',
      plan_file: path.basename(params.planFile),
      policy_file: path.basename(params.policyFile),
      resources_analyzed: params.resourcesAnalyzed,
      passed: params.result.passed,
      violations: this.mapViolations(params.result.violations),
      warnings: this.mapViolations(params.result.warnings),
    };

    this.append(entry);
    return entry;
  }

  private mapViolations(violations: PolicyViolation[]): AuditViolation[] {
    return violations.map((v) => ({
      policy: v.policy.name,
      severity: v.policy.severity,
      resource: v.resource,
      message: v.message,
    }));
  }

  private append(entry: AuditEntry): void {
    const dir = path.dirname(this.options.logFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Append as newline-delimited JSON (one entry per line, easy to parse/grep)
    fs.appendFileSync(this.options.logFile, JSON.stringify(entry) + '\n', 'utf-8');
  }
}
