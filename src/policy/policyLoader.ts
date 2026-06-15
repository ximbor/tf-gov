import * as yaml from 'js-yaml';
import * as fs from 'fs';
import { PolicyConfig } from '../types/policy';

export class PolicyLoader {
  loadFromFile(filePath: string): PolicyConfig {
    const content = fs.readFileSync(filePath, 'utf-8');
    return this.loadFromString(content);
  }

  loadFromString(content: string): PolicyConfig {
    const raw = yaml.load(content) as PolicyConfig;
    if (!raw?.policies || !Array.isArray(raw.policies)) {
      throw new Error('Invalid policy file: missing "policies" array');
    }
    return raw;
  }

  // Merge multiple policy files into one config — useful for combining
  // catalog policies with custom team policies
  mergeFiles(filePaths: string[]): PolicyConfig {
    const merged: PolicyConfig = { policies: [] };
    for (const filePath of filePaths) {
      const config = this.loadFromFile(filePath);
      merged.policies.push(...config.policies);
    }
    return merged;
  }
}
