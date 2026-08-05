import { describe, expect, it, vi } from 'vitest';
import { isSafeInternalHref } from '@/app/href';
import { enabledModules, enabledSubRoutes } from '@/app/modules';
import { buildCommands, commandGroupLabel, type Command } from './registry';

function commands(navigate: (path: string) => void = () => undefined): Command[] {
  return buildCommands({
    navigate,
    reseedDemoData: () => Promise.resolve(),
    resetStore: () => Promise.resolve(),
    markAllRead: () => Promise.resolve(),
    openSearch: () => undefined,
  });
}

describe('command registry', () => {
  it('offers navigation to every enabled module and nothing else', () => {
    const navigation = commands()
      .filter((command) => command.group === 'navigate')
      .map((command) => command.id);

    expect(navigation).toEqual(enabledModules().map((module) => `navigate:${module.id}`));
  });

  it('never navigates to a route the router does not serve', () => {
    const paths: string[] = [];
    const served = new Set([
      ...enabledModules().map((module) => module.path),
      ...enabledSubRoutes().map((route) => route.path),
    ]);

    for (const command of commands((path) => paths.push(path))) {
      void command.run();
    }

    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) {
      expect(served.has(path.split('?')[0] ?? '')).toBe(true);
    }
  });

  it('navigates only to hrefs the allowlist would let a record link use', () => {
    const paths: string[] = [];

    for (const command of commands((path) => paths.push(path))) {
      void command.run();
    }

    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) {
      expect({ path, safe: isSafeInternalHref(path) }).toEqual({ path, safe: true });
    }
  });

  it('reaches the Wave 2 surfaces', () => {
    const ids = new Set(commands().map((command) => command.id));

    expect(ids.has('navigate:inbox')).toBe(true);
    expect(ids.has('navigate:approvals')).toBe(true);
    expect(ids.has('navigate:health')).toBe(true);
    expect(ids.has('act:approvals-pending')).toBe(true);
    expect(ids.has('act:inbox-unread')).toBe(true);
    expect(ids.has('act:mark-all-read')).toBe(true);
  });

  it('reaches the Wave 3 revenue and relationship surfaces', () => {
    const ids = new Set(commands().map((command) => command.id));

    for (const id of [
      'navigate:crm',
      'navigate:pipeline',
      'navigate:tasks',
      'navigate:projects',
      'navigate:calendar',
      'navigate:meetings',
      'act:pipeline-stalled',
      'act:tasks-open',
      'act:tasks-blocked',
      'act:crm-dormant',
      'surface:calendar-week',
      'surface:meetings-notes',
    ]) {
      expect({ id, offered: ids.has(id) }).toEqual({ id, offered: true });
    }
  });

  it('reaches the Wave 4 content surfaces', () => {
    const ids = new Set(commands().map((command) => command.id));

    for (const id of [
      'navigate:content',
      'act:content-review',
      'act:content-due',
      'surface:content-ideas',
      'surface:content-learning',
    ]) {
      expect({ id, offered: ids.has(id) }).toEqual({ id, offered: true });
    }
  });

  it('reaches the Wave 5 cognition surfaces', () => {
    const ids = new Set(commands().map((command) => command.id));

    for (const id of [
      'navigate:knowledge',
      'navigate:memory',
      'navigate:documents',
      'navigate:decisions',
      'navigate:prompts',
      'navigate:research',
      'navigate:ai',
      'act:decisions-open',
      'act:memory-review',
      'act:research-open',
      'surface:knowledge-pinned',
      'surface:documents',
      'surface:ai-workspace',
    ]) {
      expect({ id, offered: ids.has(id) }).toEqual({ id, offered: true });
    }
  });

  it('runs the mark-all-read action instead of navigating', async () => {
    const markAllRead = vi.fn(() => Promise.resolve());
    const command = buildCommands({
      navigate: () => undefined,
      reseedDemoData: () => Promise.resolve(),
      resetStore: () => Promise.resolve(),
      markAllRead,
      openSearch: () => undefined,
    }).find((entry) => entry.id === 'act:mark-all-read');

    await command?.run();

    expect(markAllRead).toHaveBeenCalledTimes(1);
  });

  it('labels every group it uses and keeps ids unique', () => {
    const all = commands();
    for (const command of all) {
      expect(commandGroupLabel[command.group]).toBeTruthy();
    }
    expect(new Set(all.map((command) => command.id)).size).toBe(all.length);
  });
});
