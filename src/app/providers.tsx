import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useDatasetSource } from '@/data/useDataset';
import { buildSearchIndex } from '@/search';
import {
  PaletteContext,
  SovereignContext,
  type PaletteContextValue,
  type PaletteMode,
  type SovereignContextValue,
} from './context';

export function AppProviders({ children }: { children: ReactNode }) {
  const source = useDatasetSource();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<PaletteMode>('commands');

  const searchIndex = useMemo(() => buildSearchIndex(source.dataset), [source.dataset]);

  const openPalette = useCallback((next: PaletteMode = 'commands') => {
    setMode(next);
    setOpen(true);
  }, []);

  const closePalette = useCallback(() => {
    setOpen(false);
  }, []);

  const sovereignValue = useMemo<SovereignContextValue>(
    () => ({ ...source, searchIndex }),
    [source, searchIndex],
  );

  const paletteValue = useMemo<PaletteContextValue>(
    () => ({ open, mode, openPalette, closePalette }),
    [open, mode, openPalette, closePalette],
  );

  return (
    <SovereignContext value={sovereignValue}>
      <PaletteContext value={paletteValue}>{children}</PaletteContext>
    </SovereignContext>
  );
}
