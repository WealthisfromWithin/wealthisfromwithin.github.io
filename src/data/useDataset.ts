import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { emptyDataset, type SovereignDataset } from './dataset';
import { ensureSeeded, readDataset } from './repositories';

export interface DatasetState {
  dataset: SovereignDataset;
  ready: boolean;
  error: string | null;
}

/** Live view of the local store. Seeds demo rows on first open or when stale. */
export function useDatasetSource(): DatasetState {
  const [seeded, setSeeded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    ensureSeeded()
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Local store unavailable');
      })
      .finally(() => {
        if (!cancelled) setSeeded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const dataset = useLiveQuery(() => readDataset(), [], undefined);

  return {
    dataset: dataset ?? emptyDataset,
    ready: seeded && dataset !== undefined,
    error,
  };
}
