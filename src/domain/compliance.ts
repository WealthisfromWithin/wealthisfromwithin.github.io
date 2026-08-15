import type { Severity } from './common';

/**
 * A local keyword policy, and nothing more.
 *
 * ContentDone runs a compliance check server-side before content is approved.
 * This surface has no server, so it ships the honest half: a fixed list of
 * phrases that are risky for a financial-advisory audience, matched against the
 * copy in the browser. It does not read regulation, understand context, or
 * approve anything. A clean result means "no listed phrase appeared", which is
 * the only claim it is allowed to make.
 */

export interface CompliancePolicyRule {
  id: string;
  /** Matched case-insensitively against the copy. */
  phrase: string;
  severity: Severity;
  reason: string;
}

export const COMPLIANCE_POLICY: readonly CompliancePolicyRule[] = [
  {
    id: 'guaranteed-return',
    phrase: 'guaranteed return',
    severity: 'critical',
    reason: 'Promises a return. No investment outcome can be guaranteed in public copy.',
  },
  {
    id: 'guaranteed',
    phrase: 'guaranteed',
    severity: 'warning',
    reason: 'Unqualified guarantee. State what is actually being committed to.',
  },
  {
    id: 'risk-free',
    phrase: 'risk-free',
    severity: 'critical',
    reason: 'Claims the absence of risk.',
  },
  {
    id: 'no-risk',
    phrase: 'no risk',
    severity: 'critical',
    reason: 'Claims the absence of risk.',
  },
  {
    id: 'double-your',
    phrase: 'double your',
    severity: 'critical',
    reason: 'Quantified performance promise.',
  },
  {
    id: 'get-rich',
    phrase: 'get rich',
    severity: 'warning',
    reason: 'Outcome language with no mechanism attached.',
  },
  {
    id: 'insider',
    phrase: 'insider',
    severity: 'warning',
    reason: 'Implies privileged information.',
  },
  {
    id: 'act-now',
    phrase: 'act now',
    severity: 'info',
    reason: 'Manufactured urgency. Weak on this audience, and easy to remove.',
  },
  {
    id: 'limited-time',
    phrase: 'limited time',
    severity: 'info',
    reason: 'Manufactured urgency unless the deadline is real and stated.',
  },
  {
    id: 'best-in-the-world',
    phrase: 'best in the world',
    severity: 'warning',
    reason: 'Unprovable superlative.',
  },
];

export interface ComplianceFinding extends CompliancePolicyRule {
  /** Where the phrase was found, so the operator can go and fix it. */
  field: string;
  excerpt: string;
}

export interface ComplianceResult {
  /** True when nothing in the policy list matched. Not a legal opinion. */
  clean: boolean;
  /** True when a `critical` phrase matched, which is what blocks an approval. */
  blocking: boolean;
  findings: ComplianceFinding[];
  checkedFields: string[];
  summary: string;
}

export interface ComplianceInput {
  field: string;
  text: string;
}

function excerptAround(text: string, index: number, length: number): string {
  const start = Math.max(0, index - 24);
  const end = Math.min(text.length, index + length + 24);
  return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`;
}

/**
 * Runs the keyword policy over every supplied field. Named after ContentDone's
 * `POST /api/compliance/check` so the two stay recognisable to each other, but
 * this one never leaves the browser.
 */
export function checkContent(inputs: readonly ComplianceInput[]): ComplianceResult {
  const findings: ComplianceFinding[] = [];
  const checkedFields: string[] = [];

  for (const input of inputs) {
    if (input.text.trim().length === 0) continue;
    checkedFields.push(input.field);
    const haystack = input.text.toLowerCase();

    for (const rule of COMPLIANCE_POLICY) {
      const index = haystack.indexOf(rule.phrase);
      if (index === -1) continue;
      findings.push({
        ...rule,
        field: input.field,
        excerpt: excerptAround(input.text, index, rule.phrase.length),
      });
    }
  }

  const blocking = findings.some((finding) => finding.severity === 'critical');
  const clean = findings.length === 0;

  return {
    clean,
    blocking,
    findings,
    checkedFields,
    summary: clean
      ? `Local keyword policy: no findings across ${String(checkedFields.length)} field(s).`
      : `Local keyword policy: ${String(findings.length)} finding(s), ${blocking ? 'one or more blocking' : 'none blocking'}.`,
  };
}

/** The fields the gate reads on a content item. */
export function contentComplianceInputs(item: {
  title: string;
  body: string;
  videoScript: string;
  variants: readonly { platform: string; body: string }[];
}): ComplianceInput[] {
  return [
    { field: 'title', text: item.title },
    { field: 'body', text: item.body },
    { field: 'video script', text: item.videoScript },
    ...item.variants.map((variant) => ({
      field: `${variant.platform} variant`,
      text: variant.body,
    })),
  ];
}
