import { describe, expect, it } from 'vitest';
import {
  enabledModules,
  enabledRecordRoutes,
  enabledSubRoutes,
  findModuleByPath,
  moduleRegistry,
  modulesByGroup,
  plannedModules,
  recordRoutes,
  subRoutes,
  subRoutesOf,
} from './modules';
import { routes } from './router';

/** Wave 6 adds the four leverage surfaces; Wave 7 (Sync) stays hidden. */
const WAVE_6_ENABLED = [
  'ai',
  'analytics',
  'approvals',
  'automations',
  'brief',
  'calendar',
  'content',
  'crm',
  'decisions',
  'documents',
  'health',
  'inbox',
  'integrations',
  'knowledge',
  'meetings',
  'memory',
  'metrics',
  'missions',
  'pipeline',
  'projects',
  'prompts',
  'research',
  'settings',
  'tasks',
];

function servedPaths(): string[] {
  return (routes[0]?.children ?? []).map((child) => child.path ?? (child.index ? 'index' : ''));
}

describe('module registry', () => {
  it('enables exactly the Wave 1 through Wave 6 modules', () => {
    expect(enabledModules().map((module) => module.id).sort()).toEqual(WAVE_6_ENABLED);
  });

  it('splits the enabled modules across Commander and Operator', () => {
    expect(modulesByGroup('commander').map((module) => module.id)).toEqual([
      'brief',
      'approvals',
      'health',
      'missions',
      'metrics',
      'decisions',
    ]);
    expect(modulesByGroup('operator').map((module) => module.id)).toEqual([
      'inbox',
      'crm',
      'pipeline',
      'tasks',
      'projects',
      'calendar',
      'meetings',
      'content',
      'knowledge',
      'memory',
      'documents',
      'research',
      'ai',
      'prompts',
      'automations',
      'analytics',
      'integrations',
      'settings',
    ]);
  });

  it('keeps unfinished modules out of navigation', () => {
    const navigable = new Set(
      [...modulesByGroup('commander'), ...modulesByGroup('operator')].map((module) => module.id),
    );
    for (const module of plannedModules()) {
      expect(navigable.has(module.id)).toBe(false);
    }
  });

  it('leaves every Wave 7+ module planned', () => {
    for (const module of moduleRegistry) {
      if (module.wave > 6) expect({ id: module.id, status: module.status }).toEqual({
        id: module.id,
        status: 'planned',
      });
    }
  });

  it('enables every Wave 6 module the leverage wave promised', () => {
    for (const id of ['automations', 'missions', 'metrics', 'analytics']) {
      const module = moduleRegistry.find((entry) => entry.id === id);
      expect({ id, wave: module?.wave, status: module?.status }).toEqual({
        id,
        wave: 6,
        status: 'enabled',
      });
    }
  });

  it('keeps Command API Sync out of the router until there is an API to sync with', () => {
    const sync = moduleRegistry.find((module) => module.id === 'sync');
    expect({ status: sync?.status, wave: sync?.wave }).toEqual({ status: 'planned', wave: 7 });
    expect(plannedModules().map((module) => module.id)).toEqual(['sync']);
  });

  it('enables every Wave 5 module the cognition wave promised', () => {
    for (const id of ['knowledge', 'memory', 'documents', 'decisions', 'prompts', 'ai', 'research']) {
      const module = moduleRegistry.find((entry) => entry.id === id);
      expect({ id, wave: module?.wave, status: module?.status }).toEqual({
        id,
        wave: 5,
        status: 'enabled',
      });
    }
  });

  it('keeps the Content OS sub-routes out of the sidebar', () => {
    const navigable = new Set(
      [...modulesByGroup('commander'), ...modulesByGroup('operator')].map((module) => module.path),
    );
    expect(navigable.has('/content')).toBe(true);
    for (const route of subRoutes) {
      expect(navigable.has(route.path)).toBe(false);
    }
  });

  it('declares every sub-route beneath a module that owns its prefix', () => {
    const paths = new Map(moduleRegistry.map((module) => [module.id, module.path]));
    for (const route of subRoutes) {
      expect(route.path.startsWith(`${String(paths.get(route.moduleId))}/`)).toBe(true);
      expect(route.path).not.toContain(':');
    }
    expect(new Set(subRoutes.map((route) => route.path)).size).toBe(subRoutes.length);
  });

  it('serves a sub-route only while its module is enabled', () => {
    const enabled = new Set(enabledModules().map((module) => module.id));
    for (const route of subRoutes) {
      expect(enabledSubRoutes().includes(route)).toBe(enabled.has(route.moduleId));
    }
    expect(subRoutesOf('content').map((route) => route.path)).toEqual([
      '/content/ideas',
      '/content/calendar',
      '/content/campaigns',
      '/content/library',
      '/content/analytics',
    ]);
  });

  it('names a nested surface after the module that owns it', () => {
    expect(findModuleByPath('/content/ideas')?.id).toBe('content');
    expect(findModuleByPath('/content/item/c-constraint')?.id).toBe('content');
    expect(findModuleByPath('/crm/person/p-aldridge')?.id).toBe('crm');
    expect(findModuleByPath('/nowhere')).toBeUndefined();
  });

  it('gives the MCP panel to the registry rather than a module of its own', () => {
    // One table of integration state, read two ways: a top-level `/mcp` would
    // need its own idea of Connected, and two sources of that answer drift.
    expect(moduleRegistry.some((module) => module.path === '/mcp')).toBe(false);
    expect(subRoutesOf('integrations').map((route) => route.path)).toEqual(['/integrations/mcp']);
  });

  it('has unique ids and paths', () => {
    const ids = moduleRegistry.map((module) => module.id);
    const paths = moduleRegistry.map((module) => module.path);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('routes exactly the enabled modules, their sub-routes and record routes, and a catch-all', () => {
    const expected = [
      ...enabledModules().map((module) =>
        module.path === '/' ? 'index' : module.path.replace(/^\//, ''),
      ),
      ...enabledSubRoutes().map((route) => route.path.replace(/^\//, '')),
      ...enabledRecordRoutes().map((record) => record.pattern.replace(/^\//, '')),
      '*',
    ];
    expect(servedPaths()).toEqual(expected);
  });

  it('gives every planned module a route the router refuses to serve', () => {
    const served = new Set(servedPaths().map((path) => `/${path}`));
    for (const module of plannedModules()) {
      expect(served.has(module.path)).toBe(false);
    }
  });

  it('serves a record route only while its module is enabled', () => {
    const enabled = new Set(enabledModules().map((module) => module.id));
    for (const record of recordRoutes) {
      expect(enabledRecordRoutes().includes(record)).toBe(enabled.has(record.moduleId));
    }
    expect(enabledRecordRoutes().map((record) => record.id)).toEqual([
      'crm-person',
      'crm-company',
      'pipeline-opportunity',
      'content-item',
      'knowledge-node',
      'document',
      'decision',
      'automation-rule',
      'mission',
    ]);
  });

  it('declares every record route against a module that owns its path prefix', () => {
    const paths = new Map(moduleRegistry.map((module) => [module.id, module.path]));
    for (const record of recordRoutes) {
      const modulePath = paths.get(record.moduleId);
      expect(modulePath).toBeDefined();
      expect(record.pattern.startsWith(`${String(modulePath)}/`)).toBe(true);
      expect(record.pattern.endsWith('/:id')).toBe(true);
    }
  });
});
