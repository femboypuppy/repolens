import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../services/gitService';

export interface AsyncState<T> {
  data: T | undefined;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

/**
 * Runs `fn` whenever `deps` change. Results from superseded runs are dropped,
 * so switching repositories quickly never shows stale data.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[], enabled = true): AsyncState<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(enabled);
  const runId = useRef(0);
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!enabled) return;
    const id = ++runId.current;
    setLoading(true);
    setError(null);
    fnRef.current().then(
      (value) => {
        if (id !== runId.current) return;
        setData(value);
        setLoading(false);
      },
      (e) => {
        if (id !== runId.current) return;
        setError(errorMessage(e));
        setLoading(false);
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick, enabled]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, reload };
}
