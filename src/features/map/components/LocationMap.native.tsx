import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';

import type { LocationMapProps } from '../types';
import { normalizeRoutePoints, pointToLatLng } from '../utils/points';
import { MAP_STYLE_JSON } from '../utils/mapStyle';

MapLibreGL.setAccessToken(null);

const DEFAULT_CENTER: [number, number] = [-46.63, -23.55];

export default function LocationMap({ pontosRota, style }: LocationMapProps) {
  const cameraRef = useRef<MapLibreGL.Camera | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);

  const pontosValidos = useMemo(() => normalizeRoutePoints(pontosRota), [pontosRota]);
  const destinoAtual = pontosValidos[0] ?? null;
  const destinationLatLng = useMemo(
    () => (destinoAtual ? pointToLatLng(destinoAtual) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [destinoAtual?.id, destinoAtual?.latitude, destinoAtual?.longitude],
  );

  const handleMapReady = useCallback(() => {
    setMapReady(true);
    if (cameraRef.current && destinationLatLng) {
      cameraRef.current.setCamera({
        centerCoordinate: [destinationLatLng.longitude, destinationLatLng.latitude],
        zoomLevel: 15,
        animationDuration: 0,
      });
    }
  }, [destinationLatLng]);

  const handleMapError = useCallback(() => {
    setMapError(true);
  }, []);

  // Re-centraliza quando o destino mudar após o mapa pronto
  React.useEffect(() => {
    if (!mapReady || !cameraRef.current || !destinationLatLng) return;
    cameraRef.current.setCamera({
      centerCoordinate: [destinationLatLng.longitude, destinationLatLng.latitude],
      zoomLevel: 15,
      animationDuration: 400,
    });
  }, [mapReady, destinationLatLng]);

  const handleRetry = useCallback(() => {
    setMapError(false);
    setMapReady(false);
  }, []);

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
            coordinate={[destinationLatLng.longitude, destinationLatLng.latitude]}
          >
            <View style={styles.destMarker}>
              <View style={styles.destMarkerInner} />
            </View>
          </MapLibreGL.PointAnnotation>
        )}
      </MapLibreGL.MapView>

      {!mapReady && !mapError && (
        <View pointerEvents="none" style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color="#00B4D8" />
        </View>
      )}

      {mapError && (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorIcon}>🗺️</Text>
          <Text style={styles.errorTitle}>Mapa indisponível</Text>
          <Text style={styles.errorSubtitle}>Verifique sua conexão com a internet</Text>
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
