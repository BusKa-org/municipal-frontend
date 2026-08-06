// src/features/map/hooks/useMultiSegmentRoute.ts
import { useEffect, useMemo, useRef, useState } from 'react';
import type { LatLng } from '../types';
import { fetchMultiSegmentRoute } from '../utils/routeProvider';

type Result = {
  coordinates: LatLng[];
  loading: boolean;
  error: string | null;
};

/**
 * Hook que calcula a rota seguindo as ruas a partir de uma sequência de pontos.
 * Recalcula sempre que a sequência muda. Tolera falhas: em caso de erro o
 * componente consumidor pode cair pra desenhar linhas retas como fallback.
 */
export function useMultiSegmentRoute(points: LatLng[]): Result {
  const [coordinates, setCoordinates] = useState<LatLng[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  // Assinatura estável das coordenadas pra evitar re-fetches por novas refs
  // do mesmo array.
  const signature = useMemo(
    () => points.map((p) => `${p.latitude},${p.longitude}`).join('|'),
    [points],
  );

  useEffect(() => {
    if (points.length < 2) {
      setCoordinates([]);
      setLoading(false);
      setError(null);
      return;
    }

    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    fetchMultiSegmentRoute(points)
      .then((result) => {
        if (requestId !== requestIdRef.current) return;
        setCoordinates(result.coordinates);
        setLoading(false);
      })
      .catch((err) => {
        if (requestId !== requestIdRef.current) return;
        console.warn('Erro ao calcular rota multi-segmento:', err);
        setError('Não foi possível calcular a rota.');
        setLoading(false);
      });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return { coordinates, loading, error };
}
