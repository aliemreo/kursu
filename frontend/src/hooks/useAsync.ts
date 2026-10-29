import { useCallback, useEffect, useState } from 'react';
import { toUserMessage } from '../lib/errors';

interface AsyncState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

/**
 * Veri yükleme için küçük bir hook. Bileşen kaldırıldığında veya bağımlılıklar
 * değiştiğinde eski istek sonucu state'i ezmez. `reload` ile yeniden denenebilir.
 */
export function useAsync<T>(loader: () => Promise<T>, deps: readonly unknown[]) {
  const [state, setState] = useState<AsyncState<T>>({ data: null, error: null, loading: true });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    loader()
      .then((data) => {
        if (active) setState({ data, error: null, loading: false });
      })
      .catch((err: unknown) => {
        if (active) setState({ data: null, error: toUserMessage(err), loading: false });
      });

    return () => {
      active = false;
    };
    // loader çağrı başına yeni oluşturulduğu için bilinçli olarak deps kullanılır.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const setData = useCallback(
    (data: T) => setState({ data, error: null, loading: false }),
    [],
  );

  return { ...state, reload, setData };
}