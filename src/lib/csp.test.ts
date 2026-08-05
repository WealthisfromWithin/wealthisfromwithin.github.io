import { describe, expect, it } from 'vitest';
import { buildContentSecurityPolicy, connectSourcesFromEnv, originOf } from './csp';

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

describe('originOf', () => {
  it('keeps the origin and drops everything else', () => {
    expect(originOf('https://api.example.com/v1/health?k=1')).toBe('https://api.example.com');
    expect(originOf('http://localhost:11434')).toBe('http://localhost:11434');
  });

  it('returns nothing for a value that is not an http(s) URL', () => {
    expect(originOf(undefined)).toBeUndefined();
    expect(originOf('')).toBeUndefined();
    expect(originOf('not a url')).toBeUndefined();
    expect(originOf('javascript:alert(1)')).toBeUndefined();
    expect(originOf('file:///etc/passwd')).toBeUndefined();
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

  it('drops a value the adapters would refuse anyway', () => {
    expect(connectSourcesFromEnv({ VITE_API_BASE_URL: 'nonsense' })).toEqual([]);
  });
});
