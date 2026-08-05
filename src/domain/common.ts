import { z } from 'zod';

/**
 * Provenance of every record in the local store. Wave 1 ships `demo` rows only;
 * anything not marked `demo` must have been created by the operator or synced.
 * The UI is required to badge `demo` visibly (ARCHITECTURE_AUDIT §5.3).
 */
export const dataSourceSchema = z.enum(['demo', 'local', 'remote']);
export type DataSource = z.infer<typeof dataSourceSchema>;

export const isoTimestamp = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), { message: 'invalid ISO timestamp' });

export const idSchema = z.string().min(1);

export const recordBase = z.object({
  id: idSchema,
  source: dataSourceSchema,
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
  /**
   * Set when the operator authors or mutates a row. The demo seeder preserves
   * these rows on reseed so a decision is never silently undone.
   */
  touchedAt: isoTimestamp.optional(),
});

export const prioritySchema = z.enum(['critical', 'high', 'normal', 'low']);
export type Priority = z.infer<typeof prioritySchema>;

export const severitySchema = z.enum(['critical', 'warning', 'info']);
export type Severity = z.infer<typeof severitySchema>;

export const priorityRank: Record<Priority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

export const severityRank: Record<Severity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};
