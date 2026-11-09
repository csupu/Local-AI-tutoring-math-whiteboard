import { useCallback, useEffect, useState } from 'react';

export interface OllamaModel {
  name: string;
  vision: boolean;
}

export function useOllamaModels() {
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/models');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        ollama: string;
        models: OllamaModel[];
        error?: string;
      };
      setModels(data.models ?? []);
      setConnected(data.ollama === 'connected');
      setError(data.error ?? '');
    } catch (err) {
      setModels([]);
      setConnected(false);
      setError(`Cannot reach the MathTutor backend: ${err instanceof Error ? err.message : 'connection failed'}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { models, connected, loading, error, refresh };
}
