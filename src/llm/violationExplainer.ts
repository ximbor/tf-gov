import { PolicyViolation } from '../types/policy';

interface LLMExplanation {
  resource: string;
  policy: string;
  explanation: string;
  suggestion: string;
}

export interface ExplainedResult {
  explanations: LLMExplanation[];
  summary: string;
}

export class ViolationExplainer {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = 'gpt-4o-mini') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async explain(violations: PolicyViolation[]): Promise<ExplainedResult> {
    if (violations.length === 0) {
      return { explanations: [], summary: '' };
    }

    const prompt = this.buildPrompt(violations);
    const raw = await this.callOpenAI(prompt);
    return this.parseResponse(raw);
  }

  private buildPrompt(violations: PolicyViolation[]): string {
    const violationList = violations
      .map(
        (v, i) =>
          `${i + 1}. Resource: ${v.resource}\n   Policy: ${v.policy.name}\n   Issue: ${v.message}`
      )
      .join('\n\n');

    return `You are a Terraform security and best-practices expert.
The following policy violations were found in a Terraform plan.
For each violation, provide:
- A short, clear explanation of why it is a problem
- A concrete suggestion on how to fix it in Terraform

Respond with a JSON array with this exact shape:
[
  {
    "resource": "<resource address>",
    "policy": "<policy name>",
    "explanation": "<why this is a problem>",
    "suggestion": "<how to fix it in Terraform>"
  }
]

Violations:
${violationList}

Respond only with the JSON array, no markdown, no extra text.`;
  }

  private async callOpenAI(prompt: string): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as {
      choices: { message: { content: string } }[];
    };

    return data.choices[0]?.message?.content ?? '';
  }

  private parseResponse(raw: string): ExplainedResult {
    let explanations: LLMExplanation[];
    try {
      explanations = JSON.parse(raw) as LLMExplanation[];
    } catch {
      // If parsing fails, return a single generic explanation rather than crashing
      explanations = [{
        resource: 'unknown',
        policy: 'unknown',
        explanation: raw,
        suggestion: 'Review the violation details and consult your team policy documentation.',
      }];
    }

    const summary = explanations
      .map((e) => `❌ ${e.resource} — ${e.policy}\n${e.explanation}\n💡 ${e.suggestion}`)
      .join('\n\n');

    return { explanations, summary };
  }
}
