"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorText } from "./api";

/** Tiny data hook: loading / error / retry, ignores stale responses. */
export function useFetch<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!path);
  const seq = useRef(0);

  const load = useCallback(() => {
    if (!path) return;
    const id = ++seq.current;
    setLoading(true); setError(null);
    api<T>(path)
      .then((d) => id === seq.current && setData(d))
      .catch((e) => id === seq.current && setError(errorText(e)))
      .finally(() => id === seq.current && setLoading(false));
  }, [path]);

  useEffect(load, [load]);
  return { data, error, loading, reload: load, setData };
}

export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}
