import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type Tone = 'critical' | 'warning' | 'info' | 'neutral' | 'sentinel' | 'gold' | 'muted';

const toneText: Record<Tone, string> = {
  critical: 'text-alert',
  warning: 'text-gold',
  info: 'text-sentinel',
  neutral: 'text-muted',
  sentinel: 'text-sentinel',
  gold: 'text-gold',
  muted: 'text-faint',
};

const toneBorder: Record<Tone, string> = {
  critical: 'border-alert/50',
  warning: 'border-gold/45',
  info: 'border-sentinel/45',
  neutral: 'border-line',
  sentinel: 'border-sentinel/45',
  gold: 'border-gold/45',
  muted: 'border-line',
};

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('label-caps text-faint', className)}>{children}</p>;
}

export function DemoBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'label-caps inline-flex shrink-0 items-center border border-gold/40 px-1 py-px text-gold/80',
        className,
      )}
      title="Seeded demo record. Not operational truth."
    >
      Demo
    </span>
  );
}

export function StatePill({
  tone = 'neutral',
  children,
  title,
}: {
  tone?: Tone;
  children: ReactNode;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        'label-caps inline-flex items-center gap-1.5 border px-2 py-0.5 whitespace-nowrap',
        toneBorder[tone],
        toneText[tone],
      )}
    >
      <span className={cn('size-1.5 rounded-full bg-current')} aria-hidden />
      {children}
    </span>
  );
}

export function Panel({
  title,
  action,
  children,
  className,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('border border-line bg-surface/70', className)}>
      {(title ?? action) ? (
        <header className="flex items-center justify-between gap-4 border-b border-line px-4 py-2.5">
          <div className="label-caps text-faint">{title}</div>
          {action}
        </header>
      ) : null}
      <div className="px-4 py-3">{children}</div>
    </section>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-[3px] border border-line bg-surface-high px-1.5 py-0.5 font-mono text-[0.65rem] text-muted">
      {children}
    </kbd>
  );
}

export function Metric({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
}) {
  return (
    <div className="min-w-0">
      <p className="label-caps text-faint">{label}</p>
      <p className={cn('font-mono text-xl leading-tight tabular-nums', toneText[tone])}>{value}</p>
      {hint ? <p className="mt-0.5 truncate text-xs text-faint">{hint}</p> : null}
    </div>
  );
}

export function EmptyLine({ children }: { children: ReactNode }) {
  return <p className="py-2 text-sm text-faint italic">{children}</p>;
}

export function Divider() {
  return <hr className="border-0 border-t border-line" />;
}
