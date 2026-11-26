"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/** Tiny data hook: runs `fn` when `key` changes; exposes reload(). Never leaves a blank screen. */
export function useQuery<T>(key: string | null, fn: () => Promise<T>) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState<boolean>(!!key);
  const fnRef = useRef(fn);
  useLayoutEffect(() => {
    fnRef.current = fn;
  });
  const seq = useRef(0);

  const run = useCallback(async () => {
    if (!key) return;
    const id = ++seq.current;
    setLoading(true);
    try {
      const result = await fnRef.current();
      if (id === seq.current) {
        setData(result);
        setError(null);
      }
    } catch (e) {
      if (id === seq.current) setError(e);
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    void run();
  }, [run]);

  return { data, error, loading, reload: run, setData };
}
