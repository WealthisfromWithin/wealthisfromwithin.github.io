import { describe, expect, it } from 'vitest';
import { enabledModules, enabledSubRoutes } from './modules';
import {
  companyHref,
  contentHref,
  decisionHref,
  documentHref,
  isSafeInternalHref,
  knowledgeHref,
  normalizeInternalHref,
  opportunityHref,
  personHref,
} from './href';

describe('isSafeInternalHref', () => {
  it('allows every enabled module path', () => {
    for (const module of enabledModules()) {
      expect(isSafeInternalHref(module.path)).toBe(true);
    }
  });

  it('allows every enabled sub-route path', () => {
    for (const route of enabledSubRoutes()) {
      expect({ path: route.path, safe: isSafeInternalHref(route.path) }).toEqual({
        path: route.path,
        safe: true,
      });
    }
  });

  it('allows known safe query variants', () => {
    expect(isSafeInternalHref('/inbox?status=unread')).toBe(true);
    expect(isSafeInternalHref('/inbox?status=read&severity=critical')).toBe(true);
    expect(isSafeInternalHref('/approvals?status=all')).toBe(true);
    expect(isSafeInternalHref('/integrations?state=awaiting_credentials')).toBe(true);
    expect(isSafeInternalHref('/crm?view=companies')).toBe(true);
    expect(isSafeInternalHref('/crm?temperature=dormant')).toBe(true);
    expect(isSafeInternalHref('/pipeline?stage=negotiation')).toBe(true);
    expect(isSafeInternalHref('/tasks?status=blocked&priority=high')).toBe(true);
    expect(isSafeInternalHref('/projects?status=all')).toBe(true);
    expect(isSafeInternalHref('/calendar?week=next')).toBe(true);
    expect(isSafeInternalHref('/meetings?when=past')).toBe(true);
    expect(isSafeInternalHref('/content?status=in_review')).toBe(true);
    expect(isSafeInternalHref('/content?status=scheduled&format=video')).toBe(true);
    expect(isSafeInternalHref('/content/ideas?status=all')).toBe(true);
    expect(isSafeInternalHref('/content/calendar?week=next')).toBe(true);
    expect(isSafeInternalHref('/content/library?type=ctas')).toBe(true);
    expect(isSafeInternalHref('/knowledge?view=pinned')).toBe(true);
    expect(isSafeInternalHref('/knowledge?view=all&kind=playbook')).toBe(true);
    expect(isSafeInternalHref('/memory?state=review')).toBe(true);
    expect(isSafeInternalHref('/memory?state=all&kind=constraint')).toBe(true);
    expect(isSafeInternalHref('/documents?status=final')).toBe(true);
    expect(isSafeInternalHref('/documents?status=all&kind=sop')).toBe(true);
    expect(isSafeInternalHref('/decisions?status=proposed')).toBe(true);
    expect(isSafeInternalHref('/prompts?intent=critique')).toBe(true);
    expect(isSafeInternalHref('/research?status=answered')).toBe(true);
  });

  it('allows the declared record detail routes', () => {
    expect(isSafeInternalHref('/crm/person/p-aldridge')).toBe(true);
    expect(isSafeInternalHref('/crm/company/co-truoak')).toBe(true);
    expect(isSafeInternalHref('/pipeline/opportunity/opp-truoak')).toBe(true);
    expect(isSafeInternalHref('/content/item/c-constraint')).toBe(true);
    expect(isSafeInternalHref('/knowledge/node/kn-compounding-thesis')).toBe(true);
    expect(isSafeInternalHref('/documents/doc-truoak-renewal-memo')).toBe(false);
    expect(isSafeInternalHref('/documents/doc/doc-truoak-renewal-memo')).toBe(true);
    expect(isSafeInternalHref('/decisions/entry/dec-no-discount')).toBe(true);
  });

  it('keeps the content hub sub-routes and its detail route apart', () => {
    // `/content/item/:id` rather than `/content/:id`, so no package id can be
    // read as a sub-route and no sub-route can be read as a package.
    expect(isSafeInternalHref('/content/analytics')).toBe(true);
    expect(isSafeInternalHref('/content/c-constraint')).toBe(false);
    expect(isSafeInternalHref('/content/item/ideas/../../etc')).toBe(false);
    expect(isSafeInternalHref('/content/item/')).toBe(false);
    expect(isSafeInternalHref('/content/item/c-constraint?override=true')).toBe(false);
  });

  it('rejects a record route with no id, a nested id, or an unsafe id', () => {
    expect(isSafeInternalHref('/crm/person/')).toBe(false);
    expect(isSafeInternalHref('/crm/person')).toBe(false);
    expect(isSafeInternalHref('/crm/person/p-1/edit')).toBe(false);
    expect(isSafeInternalHref('/crm/person/../../etc')).toBe(false);
    expect(isSafeInternalHref('/crm/person/P-Aldridge')).toBe(false);
    expect(isSafeInternalHref('/crm/person/-leading-hyphen')).toBe(false);
    expect(isSafeInternalHref('/crm/person/p aldridge')).toBe(false);
    expect(isSafeInternalHref('/crm/person/%2e%2e')).toBe(false);
  });

  it('rejects a record route that carries a query string', () => {
    expect(isSafeInternalHref('/crm/person/p-aldridge?redirect=https://evil.example')).toBe(false);
    expect(isSafeInternalHref('/pipeline/opportunity/opp-truoak?stage=won')).toBe(false);
  });

  it('rejects a detail route on a module that serves none', () => {
    expect(isSafeInternalHref('/tasks/t-brief-truoak')).toBe(false);
    expect(isSafeInternalHref('/inbox/n-truoak')).toBe(false);
    expect(isSafeInternalHref('/crm/mission/msn-042')).toBe(false);
  });

  it('rejects a path that only becomes legal after traversal is collapsed', () => {
    expect(isSafeInternalHref('/content/item/../ideas')).toBe(false);
    expect(isSafeInternalHref('/crm/person/../../inbox')).toBe(false);
    expect(isSafeInternalHref('/tasks/../inbox')).toBe(false);
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
    expect(isSafeInternalHref('/missions')).toBe(false);
    expect(isSafeInternalHref('/automations')).toBe(false);
    expect(isSafeInternalHref('/analytics')).toBe(false);
    expect(isSafeInternalHref('/metrics')).toBe(false);
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
    expect(normalizeInternalHref('/missions', '/inbox')).toBe('/inbox');
  });
});

describe('record link builders', () => {
  it('builds the detail route for a legal id', () => {
    expect(personHref('p-aldridge')).toBe('/crm/person/p-aldridge');
    expect(companyHref('co-truoak')).toBe('/crm/company/co-truoak');
    expect(opportunityHref('opp-truoak')).toBe('/pipeline/opportunity/opp-truoak');
    expect(contentHref('c-constraint')).toBe('/content/item/c-constraint');
    expect(knowledgeHref('kn-compounding-thesis')).toBe('/knowledge/node/kn-compounding-thesis');
    expect(documentHref('doc-advisory-sop')).toBe('/documents/doc/doc-advisory-sop');
    expect(decisionHref('dec-no-discount')).toBe('/decisions/entry/dec-no-discount');
  });

  it('degrades to the module list rather than emitting an unsafe link', () => {
    expect(personHref('../../etc/passwd')).toBe('/crm');
    expect(personHref('')).toBe('/crm');
    expect(companyHref('co truoak?x=1')).toBe('/crm?view=companies');
    expect(opportunityHref('javascript:alert(1)')).toBe('/pipeline');
    expect(contentHref('../ideas')).toBe('/content');
    expect(contentHref('')).toBe('/content');
    expect(knowledgeHref('../node')).toBe('/knowledge');
    expect(documentHref('doc truoak?x=1')).toBe('/documents');
    expect(decisionHref('javascript:alert(1)')).toBe('/decisions');
  });

  it('emits only hrefs the allowlist accepts', () => {
    for (const href of [
      personHref('p-1'),
      companyHref('co-1'),
      opportunityHref('opp-1'),
      contentHref('c-1'),
      knowledgeHref('kn-1'),
      documentHref('doc-1'),
      decisionHref('dec-1'),
    ]) {
      expect(isSafeInternalHref(href)).toBe(true);
    }
  });
});
