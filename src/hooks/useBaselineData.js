import { useEffect, useState } from "react";

export function useBaselineData() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/data/birmingham_baseline.json");
        if (!res.ok) {
          throw new Error(`Failed to load baseline (${res.status})`);
        }
        const json = await res.json();
        if (!cancelled) {
          setData(Array.isArray(json) ? json : []);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err);
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading, error };
}
