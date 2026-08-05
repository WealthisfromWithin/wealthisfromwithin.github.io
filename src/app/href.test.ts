import { describe, expect, it } from 'vitest';
import { isSafeInternalHref, normalizeInternalHref } from './href';

describe('isSafeInternalHref', () => {
  it('allows every enabled module path', () => {
    expect(isSafeInternalHref('/')).toBe(true);
    expect(isSafeInternalHref('/approvals')).toBe(true);
    expect(isSafeInternalHref('/health')).toBe(true);
    expect(isSafeInternalHref('/inbox')).toBe(true);
    expect(isSafeInternalHref('/integrations')).toBe(true);
    expect(isSafeInternalHref('/settings')).toBe(true);
  });

  it('allows known safe query variants', () => {
    expect(isSafeInternalHref('/inbox?status=unread')).toBe(true);
    expect(isSafeInternalHref('/inbox?status=read&severity=critical')).toBe(true);
    expect(isSafeInternalHref('/approvals?status=all')).toBe(true);
    expect(isSafeInternalHref('/integrations?state=awaiting_credentials')).toBe(true);
  });

  it('rejects unknown query params on an otherwise enabled route', () => {
    expect(isSafeInternalHref('/inbox?redirect=https://evil.example')).toBe(false);
    expect(isSafeInternalHref('/health?probe=fake')).toBe(false);
  });

  it('rejects unknown query values on a known param', () => {
    expect(isSafeInternalHref('/inbox?status=exploded')).toBe(false);
    expect(isSafeInternalHref('/integrations?state=connected-ish')).toBe(false);
  });

  it('rejects javascript: and other unsafe schemes', () => {
    expect(isSafeInternalHref('javascript:alert(1)')).toBe(false);
    expect(isSafeInternalHref('javascript:/inbox')).toBe(false);
    expect(isSafeInternalHref('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(isSafeInternalHref('mailto:someone@example.com')).toBe(false);
  });

  it('rejects absolute external URLs', () => {
    expect(isSafeInternalHref('https://evil.example/inbox')).toBe(false);
    expect(isSafeInternalHref('http://evil.example')).toBe(false);
    expect(isSafeInternalHref('https://evil.example')).toBe(false);
  });

  it('rejects protocol-relative URLs', () => {
    expect(isSafeInternalHref('//evil.example')).toBe(false);
    expect(isSafeInternalHref('//evil.example/inbox')).toBe(false);
  });

  it('rejects backslash tricks that browsers may normalize to protocol-relative', () => {
    expect(isSafeInternalHref('/\\evil.example')).toBe(false);
  });

  it('rejects planned-module paths', () => {
    expect(isSafeInternalHref('/crm')).toBe(false);
    expect(isSafeInternalHref('/missions')).toBe(false);
    expect(isSafeInternalHref('/pipeline')).toBe(false);
    expect(isSafeInternalHref('/sync')).toBe(false);
  });

  it('rejects malformed strings', () => {
    expect(isSafeInternalHref('')).toBe(false);
    expect(isSafeInternalHref('   ')).toBe(false);
    expect(isSafeInternalHref('not a route')).toBe(false);
    expect(isSafeInternalHref('inbox')).toBe(false);
    expect(isSafeInternalHref('/inbox%')).toBe(false);
    expect(isSafeInternalHref('/%zz')).toBe(false);
  });

  it('rejects unknown internal-looking paths', () => {
    expect(isSafeInternalHref('/does-not-exist')).toBe(false);
    expect(isSafeInternalHref('/Inbox')).toBe(false);
    expect(isSafeInternalHref('/inbox/')).toBe(false);
  });
});

describe('normalizeInternalHref', () => {
  it('passes through a safe href unchanged', () => {
    expect(normalizeInternalHref('/inbox?status=unread', '/inbox')).toBe('/inbox?status=unread');
  });

  it('falls back for undefined or null hrefs', () => {
    expect(normalizeInternalHref(undefined, '/inbox')).toBe('/inbox');
    expect(normalizeInternalHref(null, '/inbox')).toBe('/inbox');
  });

  it('falls back for unsafe hrefs', () => {
    expect(normalizeInternalHref('javascript:alert(1)', '/inbox')).toBe('/inbox');
    expect(normalizeInternalHref('https://evil.example', '/approvals')).toBe('/approvals');
    expect(normalizeInternalHref('//evil.example', '/')).toBe('/');
    expect(normalizeInternalHref('/crm', '/inbox')).toBe('/inbox');
  });
});
