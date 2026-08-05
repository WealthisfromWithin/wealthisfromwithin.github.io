import { describe, expect, it } from 'vitest';
import {
  COMPLIANCE_POLICY,
  checkContent,
  contentComplianceInputs,
  type ComplianceInput,
} from './compliance';

function text(field: string, body: string): ComplianceInput {
  return { field, text: body };
}

describe('compliance policy', () => {
  it('is a fixed local list with unique ids and no empty phrases', () => {
    const ids = COMPLIANCE_POLICY.map((rule) => rule.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const rule of COMPLIANCE_POLICY) {
      expect(rule.phrase).toBe(rule.phrase.toLowerCase());
      expect(rule.phrase.trim().length).toBeGreaterThan(0);
      expect(rule.reason.length).toBeGreaterThan(0);
    }
  });

  it('carries at least one blocking phrase, or the gate would never stop anything', () => {
    expect(COMPLIANCE_POLICY.some((rule) => rule.severity === 'critical')).toBe(true);
  });
});

describe('checkContent', () => {
  it('reports clean copy as clean without claiming more than that', () => {
    const result = checkContent([text('body', 'Name the constraint, price it, remove it.')]);

    expect(result.clean).toBe(true);
    expect(result.blocking).toBe(false);
    expect(result.findings).toEqual([]);
    expect(result.checkedFields).toEqual(['body']);
    expect(result.summary).toContain('no findings');
  });

  it('blocks on a critical phrase and names the field it came from', () => {
    const result = checkContent([
      text('title', 'A steady approach'),
      text('body', 'A risk-free way to double your capital.'),
    ]);

    expect(result.blocking).toBe(true);
    expect(result.clean).toBe(false);
    expect(result.findings.map((finding) => finding.id)).toEqual(['risk-free', 'double-your']);
    expect(result.findings.every((finding) => finding.field === 'body')).toBe(true);
  });

  it('flags a warning without blocking the approval', () => {
    const result = checkContent([text('body', 'Insider notes from the desk.')]);

    expect(result.clean).toBe(false);
    expect(result.blocking).toBe(false);
    expect(result.findings[0]?.severity).toBe('warning');
    expect(result.summary).toContain('none blocking');
  });

  it('matches case-insensitively and quotes the copy around the hit', () => {
    const result = checkContent([
      text('body', 'We have found the one GUARANTEED RETURN nobody else will show you.'),
    ]);

    const finding = result.findings.find((row) => row.id === 'guaranteed-return');
    expect(finding).toBeDefined();
    expect(finding?.excerpt).toContain('GUARANTEED RETURN');
  });

  it('skips empty fields rather than counting them as checked', () => {
    const result = checkContent([text('body', 'Clean copy.'), text('video script', '   ')]);

    expect(result.checkedFields).toEqual(['body']);
    expect(result.summary).toContain('1 field');
  });

  it('reads title, body, script and every platform variant on an item', () => {
    const inputs = contentComplianceInputs({
      title: 'The Compounding Constraint',
      body: 'Name it, price it, remove it.',
      videoScript: 'Open on the diagram.',
      variants: [
        { platform: 'linkedin', body: 'Guaranteed to change how you plan.' },
        { platform: 'facebook', body: 'Three questions that find it.' },
      ],
    });

    expect(inputs.map((input) => input.field)).toEqual([
      'title',
      'body',
      'video script',
      'linkedin variant',
      'facebook variant',
    ]);

    const result = checkContent(inputs);
    expect(result.findings.map((finding) => finding.field)).toEqual(['linkedin variant']);
  });
});
