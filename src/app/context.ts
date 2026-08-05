import { createContext, useContext } from 'react';
import { emptyDataset, type SovereignDataset } from '@/data/dataset';
import type { DatasetState } from '@/data/useDataset';
import type { SearchDocument } from '@/search';

export interface SovereignContextValue extends DatasetState {
  searchIndex: SearchDocument[];
}

export const SovereignContext = createContext<SovereignContextValue>({
  dataset: emptyDataset,
  ready: false,
  error: null,
  searchIndex: [],
});

export type PaletteMode = 'commands' | 'search';

export interface PaletteContextValue {
  open: boolean;
  mode: PaletteMode;
  openPalette: (mode?: PaletteMode) => void;
  closePalette: () => void;
}

export const PaletteContext = createContext<PaletteContextValue>({
  open: false,
  mode: 'commands',
  openPalette: () => undefined,
  closePalette: () => undefined,
});

export function useSovereign(): SovereignContextValue {
  return useContext(SovereignContext);
}

export function useDataset(): SovereignDataset {
  return useContext(SovereignContext).dataset;
}

export function usePalette(): PaletteContextValue {
  return useContext(PaletteContext);
}
