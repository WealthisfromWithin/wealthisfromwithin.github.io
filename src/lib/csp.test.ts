import { describe, expect, it } from 'vitest';
import { resolveLocalEndpoint } from '@/agents/providers/local';
import { resolveApiBaseUrl } from '@/modules/sync/sync';
import { buildContentSecurityPolicy, connectSourcesFromEnv } from './csp';

function directives(policy: string): Map<string, string> {
  return new Map(
    policy.split('; ').map((entry) => {
      const [name, ...rest] = entry.split(' ');
      return [name ?? '', rest.join(' ')];
    }),
  );
}

describe('buildContentSecurityPolicy', () => {
  it('allows no script the build did not produce', () => {
    const policy = directives(buildContentSecurityPolicy());

    expect(policy.get('script-src')).toBe("'self'");
    expect(policy.get('default-src')).toBe("'self'");
    expect(policy.get('object-src')).toBe("'none'");
    expect(policy.get('base-uri')).toBe("'self'");
    expect(policy.get('form-action')).toBe("'none'");
    for (const value of policy.values()) {
      expect(value).not.toContain("'unsafe-eval'");
    }
    expect(policy.get('script-src')).not.toContain("'unsafe-inline'");
  });

  it('permits the inline style that paints the background, and says so nowhere else', () => {
    const policy = directives(buildContentSecurityPolicy());

    expect(policy.get('style-src')).toBe("'self' 'unsafe-inline'");
    expect(policy.get('img-src')).toBe("'self' data:");
    expect(policy.get('font-src')).toBe("'self'");
  });

  it('connects nowhere but this origin by default', () => {
    expect(directives(buildContentSecurityPolicy()).get('connect-src')).toBe("'self'");
  });

  it('adds exactly the origins the build was configured for, once each', () => {
    const policy = directives(
      buildContentSecurityPolicy({
        connectSources: ['https://api.example.com', 'https://api.example.com', 'http://localhost:11434'],
      }),
    );

    expect(policy.get('connect-src')).toBe(
      "'self' https://api.example.com http://localhost:11434",
    );
  });

  it('omits frame-ancestors from a meta policy, because a meta tag cannot carry it', () => {
    const meta = directives(buildContentSecurityPolicy({ delivery: 'meta' }));
    const header = directives(buildContentSecurityPolicy({ delivery: 'header' }));

    expect(meta.has('frame-ancestors')).toBe(false);
    expect(header.get('frame-ancestors')).toBe("'none'");
  });
});

describe('connectSourcesFromEnv', () => {
  it('is empty for the public build, which talks to nothing', () => {
    expect(connectSourcesFromEnv({})).toEqual([]);
  });

  it('reads the same variables the adapters read', () => {
    expect(
      connectSourcesFromEnv({
        VITE_API_BASE_URL: 'https://api.example.com/v1',
        VITE_LOCAL_AI_URL: 'http://localhost:11434',
      }),
    ).toEqual(['https://api.example.com', 'http://localhost:11434']);
  });

  it('names only the origin, never the path the adapter would call', () => {
    expect(connectSourcesFromEnv({ VITE_API_BASE_URL: 'https://api.example.com/v1/command' })).toEqual([
      'https://api.example.com',
    ]);
  });

  it('allows the loopback exception both adapters make', () => {
    expect(connectSourcesFromEnv({ VITE_API_BASE_URL: 'http://127.0.0.1:8787' })).toEqual([
      'http://127.0.0.1:8787',
    ]);
  });
});

/**
 * The H2 invariant (`docs/reviews/WAVE_7_GPT_REVIEW.md`): a `connect-src` entry
 * for an origin the adapter refuses is an exfiltration destination granted for
 * nothing. These tests assert the two sides agree by construction — every
 * refused value is checked against the adapter that refuses it *and* against
 * the policy, in the same case.
 */
describe('connect-src cannot outrun the adapters', () => {
  const refusedApiUrls: [string, string][] = [
    ['unparsable', 'nonsense'],
    ['not a fetchable scheme', 'javascript:alert(1)'],
    ['a file URL', 'file:///etc/passwd'],
    ['plaintext http on a remote host', 'http://api.example.com'],
    ['credentials in the userinfo', 'https://user:pw@api.example.com'],
    ['an api key in the query string', 'https://api.example.com?api_key=abc'],
    ['a fragment', 'https://api.example.com#token=abc'],
    ['a non-loopback host that only looks local', 'http://localhost.example.com'],
  ];

  it.each(refusedApiUrls)('adds no connect source for a Command API URL with %s', (_label, value) => {
    expect(resolveApiBaseUrl(value).kind).toBe('refused');
    expect(connectSourcesFromEnv({ VITE_API_BASE_URL: value })).toEqual([]);
    expect(directives(buildContentSecurityPolicy({ connectSources: [] })).get('connect-src')).toBe(
      "'self'",
    );
  });

  const refusedLocalUrls: [string, string][] = [
    ['unparsable', 'nonsense'],
    ['a scheme the adapter does not call', 'ws://localhost:11434'],
    ['a hosted model endpoint', 'https://models.example.com'],
    ['a LAN address, which is another machine', 'http://192.168.1.10:11434'],
    ['a host that merely contains localhost', 'http://localhost.attacker.test'],
  ];

  it.each(refusedLocalUrls)('adds no connect source for a local AI URL with %s', (_label, value) => {
    expect(resolveLocalEndpoint(value).ok).toBe(false);
    expect(connectSourcesFromEnv({ VITE_LOCAL_AI_URL: value })).toEqual([]);
  });

  it('keeps the accepted half of a half-refused build', () => {
    expect(
      connectSourcesFromEnv({
        VITE_API_BASE_URL: 'https://api.example.com',
        VITE_LOCAL_AI_URL: 'https://models.example.com',
      }),
    ).toEqual(['https://api.example.com']);
  });

  it('never carries a secret from a refused URL into the policy', () => {
    const policy = buildContentSecurityPolicy({
      connectSources: connectSourcesFromEnv({
        VITE_API_BASE_URL: 'https://user:sk-secret@api.example.com?api_key=abc',
      }),
    });

    expect(policy).not.toContain('sk-secret');
    expect(policy).not.toContain('api_key');
    expect(directives(policy).get('connect-src')).toBe("'self'");
  });
});
