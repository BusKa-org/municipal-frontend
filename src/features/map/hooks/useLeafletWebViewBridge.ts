// src/components/mapa/hooks/useLeafletWebViewBridge.ts
import { useCallback, useMemo, useRef, useState } from 'react';
import type { WebViewMessageEvent } from 'react-native-webview';
import { buildLeafletHtml } from '../utils/leafletHtml';
import type { LatLng, NormalizedRoutePoint } from '../types';

type Result = {
  webViewRef: React.MutableRefObject<any>;
  html: string;
  mapReady: boolean;
  mapError: boolean;
  loadingMap: boolean;
  handleMessage: (event: WebViewMessageEvent) => void;
  reloadMap: () => void;
  setDestination: (coord: LatLng) => void;
  clearDestination: () => void;
  setUserMarker: (coord: LatLng) => void;
  clearUserMarker: () => void;
  setRoute: (coords: LatLng[]) => void;
  clearRoute: () => void;
  fitToCoordinates: (coords: LatLng[]) => void;
  setStops: (paradas: NormalizedRoutePoint[], proximaId?: string | null) => void;
  setMargins: (topo: number, base: number) => void;
  reloadKey: number;
};

export function useLeafletWebViewBridge(): Result {
  const webViewRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const [loadingMap, setLoadingMap] = useState(true);
  const [mapError, setMapError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const html = useMemo(() => buildLeafletHtml(), [reloadKey]);

  const inject = useCallback(
    (script: string) => {
      if (!webViewRef.current || !mapReady) return;
      webViewRef.current.injectJavaScript(`
        try {
          ${script}
        } catch (e) {}
        true;
      `);
    },
    [mapReady]
  );

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === 'mapReady') {
        setMapReady(true);
        setLoadingMap(false);
      }

      if (data.type === 'mapError') {
        setMapReady(false);
        setLoadingMap(false);
        setMapError(true);
      }
    } catch (error) {
      console.warn('Mensagem inválida do WebView:', error);
    }
  }, []);

  const reloadMap = useCallback(() => {
    setMapReady(false);
    setLoadingMap(true);
    setMapError(false);
    setReloadKey((prev) => prev + 1);
  }, []);

  const setDestination = useCallback(
    (coord: LatLng) => {
      inject(`window.BuskaMap.setDestination(${coord.latitude}, ${coord.longitude});`);
    },
    [inject]
  );

  const clearDestination = useCallback(() => {
    inject(`window.BuskaMap.clearDestination();`);
  }, [inject]);

  const setUserMarker = useCallback(
    (coord: LatLng) => {
      inject(`window.BuskaMap.setUserMarker(${coord.latitude}, ${coord.longitude});`);
    },
    [inject]
  );

  const clearUserMarker = useCallback(() => {
    inject(`window.BuskaMap.clearUserMarker();`);
  }, [inject]);

  const setRoute = useCallback(
    (coords: LatLng[]) => {
      inject(`window.BuskaMap.setRoute(${JSON.stringify(coords)});`);
    },
    [inject]
  );

  const clearRoute = useCallback(() => {
    inject(`window.BuskaMap.clearRoute();`);
  }, [inject]);

  const setStops = useCallback(
    (paradas: NormalizedRoutePoint[], proximaId?: string | null) => {
      inject(
        `window.BuskaMap.setStops(${JSON.stringify(paradas)}, ${JSON.stringify(proximaId ?? null)});`,
      );
    },
    [inject],
  );

  const setMargins = useCallback(
    (topo: number, base: number) => {
      inject(`window.BuskaMap.setMargins(${topo}, ${base});`);
    },
    [inject],
  );

  const fitToCoordinates = useCallback(
    (coords: LatLng[]) => {
      inject(`window.BuskaMap.fitToCoordinates(${JSON.stringify(coords)});`);
    },
    [inject]
  );

  return {
    webViewRef,
    html,
    mapReady,
    mapError,
    loadingMap,
    handleMessage,
    reloadMap,
    setDestination,
    clearDestination,
    setUserMarker,
    clearUserMarker,
    setRoute,
    clearRoute,
    fitToCoordinates,
    setStops,
    setMargins,
    reloadKey,
  };
}