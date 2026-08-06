import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';

import type { LatLng, RouteMapProps } from '../types';
import { useLocationPermission } from '../hooks/useLocationPermissionWrapper';
import { useCurrentLocation } from '../hooks/useCurrentLocation';
import { useArrivalDetection } from '../hooks/useArrivalDetection';
import { useRoutePolyline } from '../hooks/useRoutePolyline';
import { normalizeRoutePoints, pointToLatLng, buildFitCoordinates } from '../utils/points';
import { MAP_STYLE_JSON } from '../utils/mapStyle';

// MapLibre não exige access token, mas alguns binários esperam a chamada.
// Passar string vazia ou null evita warnings.
MapLibreGL.setAccessToken(null);

const DEFAULT_CENTER: [number, number] = [-46.63, -23.55]; // [lng, lat]

function toLngLat(coord: LatLng): [number, number] {
  return [coord.longitude, coord.latitude];
}

export default function RouteMap({ pontosRota, onPontoChegado, style }: RouteMapProps) {
  const cameraRef = useRef<MapLibreGL.Camera | null>(null);
  const hasFittedRef = useRef(false);

  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);

  const pontosValidos = useMemo(() => normalizeRoutePoints(pontosRota), [pontosRota]);
  const destinoAtual = pontosValidos[0] ?? null;
  const destinationLatLng = useMemo(
    () => (destinoAtual ? pointToLatLng(destinoAtual) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [destinoAtual?.id, destinoAtual?.latitude, destinoAtual?.longitude],
  );

  const {
    granted: locationGranted,
    loading: permissionLoading,
    error: permissionError,
    requestPermission,
  } = useLocationPermission();

  const {
    location: userLocation,
    loading: locationLoading,
    error: locationError,
    reset: resetLocation,
  } = useCurrentLocation({
    enabled: locationGranted && !!destinoAtual,
  });

  const {
    coordinates: routeCoordinates,
    loading: routeLoading,
    error: routeError,
    reset: resetRoute,
  } = useRoutePolyline({
    origin: userLocation,
    destination: destinationLatLng,
    enabled: !!userLocation && !!destinationLatLng,
    minRefetchDistanceMeters: 20,
  });

  useArrivalDetection({
    userLocation,
    destination: destinoAtual,
    thresholdMeters: 50,
    onArrive: (point) => {
      resetRoute();
      resetLocation();
      onPontoChegado?.(point);
    },
  });

  useEffect(() => {
    requestPermission();
  }, [requestPermission]);

  useEffect(() => {
    if (permissionError) {
      Alert.alert(
        'Permissão negada',
        'Sem acesso à localização, não é possível mostrar a rota.',
      );
    }
  }, [permissionError]);

  useEffect(() => {
    hasFittedRef.current = false;
  }, [destinoAtual?.id]);

  // Fit camera once we have user location + destination
  useEffect(() => {
    if (!mapReady || !cameraRef.current) return;
    if (!userLocation || !destinationLatLng) return;
    if (hasFittedRef.current) return;

    const coords = buildFitCoordinates({
      userLocation,
      destination: destinoAtual,
      polyline: routeCoordinates,
    });

    if (coords.length < 2) return;

    const lngs = coords.map((c) => c.longitude);
    const lats = coords.map((c) => c.latitude);
    const sw: [number, number] = [Math.min(...lngs), Math.min(...lats)];
    const ne: [number, number] = [Math.max(...lngs), Math.max(...lats)];

    cameraRef.current.fitBounds(ne, sw, 60, 600);
    hasFittedRef.current = true;
  }, [mapReady, userLocation, destinationLatLng, routeCoordinates, destinoAtual]);

  // Coordenadas usadas pra desenhar a polyline. Se o backend retornar a rota,
  // usamos ela. Senão (erro 5xx do /routing/route por OSRM fora do ar, etc),
  // caímos pra uma linha reta entre origem e destino — melhor que não mostrar
  // nada.
  const polylineCoordinates = useMemo<LatLng[]>(() => {
    if (routeCoordinates.length >= 2) return routeCoordinates;
    if (userLocation && destinationLatLng) {
      return [userLocation, destinationLatLng];
    }
    return [];
  }, [routeCoordinates, userLocation, destinationLatLng]);

  const isRouteFallback = routeCoordinates.length < 2 && polylineCoordinates.length >= 2;

  const routeGeoJson = useMemo(() => {
    if (polylineCoordinates.length < 2) return null;
    return {
      type: 'Feature' as const,
      geometry: {
        type: 'LineString' as const,
        coordinates: polylineCoordinates.map(toLngLat),
      },
      properties: {},
    };
  }, [polylineCoordinates]);

  const handleMapReady = useCallback(() => {
    setMapReady(true);
  }, []);

  const handleMapError = useCallback(() => {
    setMapError(true);
  }, []);

  const handleRetry = useCallback(async () => {
    setMapError(false);
    setMapReady(false);
    resetRoute();
    resetLocation();
    hasFittedRef.current = false;
    await requestPermission();
  }, [requestPermission, resetLocation, resetRoute]);

  // Só consideramos "erro fatal" coisas que impedem o mapa de funcionar:
  // mapError (mapa não carregou), permissionError (sem GPS), locationError
  // (não obteve a localização). O routeError NÃO é fatal — caímos pra linha
  // reta entre origem e destino e o mapa continua funcionando.
  const overlayError =
    mapError ? 'Verifique sua conexão com a internet' : permissionError || locationError;

  const overlayLoading = !mapReady || permissionLoading || locationLoading;

  return (
    <View style={[styles.container, style]}>
      <MapLibreGL.MapView
        style={[styles.map, mapError && styles.hidden]}
        mapStyle={MAP_STYLE_JSON}
        attributionEnabled
        logoEnabled={false}
        compassEnabled={false}
        onDidFinishLoadingMap={handleMapReady}
        onDidFailLoadingMap={handleMapError}
      >
        <MapLibreGL.Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: DEFAULT_CENTER,
            zoomLevel: 12,
          }}
        />

        {destinationLatLng && (
          <MapLibreGL.PointAnnotation
            id="destination"
            coordinate={toLngLat(destinationLatLng)}
          >
            <View style={styles.destMarker}>
              <View style={styles.destMarkerInner} />
            </View>
          </MapLibreGL.PointAnnotation>
        )}

        {userLocation && (
          <MapLibreGL.PointAnnotation
            id="user"
            coordinate={toLngLat(userLocation)}
          >
            <View style={styles.userMarker} />
          </MapLibreGL.PointAnnotation>
        )}

        {routeGeoJson && (
          <MapLibreGL.ShapeSource id="routeSource" shape={routeGeoJson}>
            <MapLibreGL.LineLayer
              id="routeLine"
              style={{
                lineColor: '#007bff',
                lineWidth: isRouteFallback ? 4 : 6,
                lineOpacity: isRouteFallback ? 0.5 : 0.85,
                lineCap: 'round',
                lineJoin: 'round',
                // Quando estamos no fallback (sem dados do OSRM), desenhamos
                // tracejado pra indicar que é uma aproximação.
                lineDasharray: isRouteFallback ? [2, 1] : [1, 0],
              }}
            />
          </MapLibreGL.ShapeSource>
        )}
      </MapLibreGL.MapView>

      {overlayLoading && !overlayError && (
        <View pointerEvents="none" style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color="#00B4D8" />
        </View>
      )}

      {!!overlayError && (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorIcon}>🗺️</Text>
          <Text style={styles.errorTitle}>Mapa indisponível</Text>
          <Text style={styles.errorSubtitle}>{overlayError}</Text>
          <TouchableOpacity style={styles.reloadButton} onPress={handleRetry}>
            <Text style={styles.reloadText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 400,
    width: '100%',
    borderRadius: 10,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  hidden: {
    opacity: 0,
    height: 0,
  },
  destMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EA4335',
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  destMarkerInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  userMarker: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#2196F3',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    padding: 24,
  },
  errorIcon: { fontSize: 40, marginBottom: 8 },
  errorTitle: { fontSize: 15, fontWeight: '600', color: '#334155', marginBottom: 4 },
  errorSubtitle: { fontSize: 13, color: '#64748B', textAlign: 'center', marginBottom: 16 },
  reloadButton: {
    backgroundColor: '#00B4D8',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  reloadText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
