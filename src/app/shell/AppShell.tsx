import { Suspense, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { usePalette } from '@/app/context';
import { CommandPalette } from './CommandPalette';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

/** Keyboard-first shell: ⌘K / Ctrl+K opens commands, `/` opens search. */
function useGlobalShortcuts() {
  const { open, openPalette, closePalette } = usePalette();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (open) closePalette();
        else openPalette('commands');
        return;
      }
      if (event.key === '/' && !open && !isTypingTarget(event.target)) {
        event.preventDefault();
        openPalette('search');
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, openPalette, closePalette]);
}

export function AppShell() {
  useGlobalShortcuts();

  return (
    <div className="flex h-dvh overflow-hidden bg-obsidian text-on-surface">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="min-h-0 flex-1 overflow-y-auto">
          {/* Module chunks load on demand (TD-16); the shell stays on screen. */}
          <Suspense
            fallback={<p className="px-6 py-6 text-sm text-faint italic">Loading module…</p>}
          >
            <Outlet />
          </Suspense>
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
