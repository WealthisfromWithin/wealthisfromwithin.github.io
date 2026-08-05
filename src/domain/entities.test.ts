import { describe, expect, it } from 'vitest';
import {
  dataSourceSchema,
  integrationSchema,
  integrationStateSchema,
  taskSchema,
} from '@/domain';

const stamp = '2026-08-05T06:00:00.000Z';

describe('domain schemas', () => {
  it('accepts a well-formed task', () => {
    const parsed = taskSchema.parse({
      id: 't-1',
      source: 'demo',
      createdAt: stamp,
      updatedAt: stamp,
      title: 'Send renewal memo',
      status: 'todo',
      priority: 'critical',
      dueAt: stamp,
    });

    expect(parsed.context).toBe('');
    expect(parsed.status).toBe('todo');
  });

  it('rejects an unknown task status', () => {
    const result = taskSchema.safeParse({
      id: 't-1',
      source: 'demo',
      createdAt: stamp,
      updatedAt: stamp,
      title: 'Nope',
      status: 'archived',
      priority: 'low',
    });

    expect(result.success).toBe(false);
  });

  it('rejects an unparseable timestamp', () => {
    const result = taskSchema.safeParse({
      id: 't-1',
      source: 'demo',
      createdAt: 'yesterday',
      updatedAt: stamp,
      title: 'Nope',
      status: 'todo',
      priority: 'low',
    });

    expect(result.success).toBe(false);
  });

  it('allows exactly three integration states', () => {
    expect(integrationStateSchema.options).toEqual([
      'connected',
      'disabled',
      'awaiting_credentials',
    ]);
    expect(integrationStateSchema.safeParse('healthy').success).toBe(false);
  });

  it('requires provenance on every record', () => {
    expect(dataSourceSchema.options).toEqual(['demo', 'local', 'remote']);

    const result = integrationSchema.safeParse({
      id: 'notion',
      createdAt: stamp,
      updatedAt: stamp,
      name: 'Notion',
      category: 'productivity',
      state: 'awaiting_credentials',
    });

    expect(result.success).toBe(false);
  });
});
