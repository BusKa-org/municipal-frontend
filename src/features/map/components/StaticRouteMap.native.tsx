import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';

import { MAP_STYLE_JSON } from '../utils/mapStyle';
import { useMultiSegmentRoute } from '../hooks/useMultiSegmentRoute';

MapLibreGL.setAccessToken(null);

interface RoutePoint {
  id?: string | number;
  latitude: number | string;
  longitude: number | string;
  nome?: string;
  apelido?: string;
  ordem?: number;
}

interface StaticRouteMapProps {
  pontosRota: RoutePoint[];
}

interface NormalizedPoint {
  latitude: number;
  longitude: number;
  label: string;
  color: string;
  name: string;
}

const FALLBACK_CENTER: [number, number] = [-47.93, -15.78];

function normalizePoints(points: RoutePoint[]): NormalizedPoint[] {
  const valid = [...points]
    .filter((p) => {
      const lat = Number(p.latitude);
      const lng = Number(p.longitude);
      return Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0;
    })
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

  return valid.map((p, i) => ({
    latitude: Number(p.latitude),
    longitude: Number(p.longitude),
    label: i === 0 ? 'A' : i === valid.length - 1 ? 'B' : String(i + 1),
    color: i === 0 ? '#34A853' : i === valid.length - 1 ? '#EA4335' : '#7B1FA2',
    name: p.nome || p.apelido || `Ponto ${i + 1}`,
  }));
}

export default function StaticRouteMap({ pontosRota }: StaticRouteMapProps) {
  const cameraRef = useRef<MapLibreGL.Camera | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const points = useMemo(() => normalizePoints(pontosRota || []), [pontosRota]);

  const pointsForRouting = useMemo(
    () => points.map((p) => ({ latitude: p.latitude, longitude: p.longitude })),
    [points],
  );

  const {
    coordinates: routedCoords,
    loading: routeLoading,
    error: routeError,
  } = useMultiSegmentRoute(pointsForRouting);

  const lineGeoJson = useMemo(() => {
    let coords: number[][];
    if (routedCoords.length >= 2) {
      coords = routedCoords.map((c) => [c.longitude, c.latitude]);
    } else if (points.length >= 2) {
      coords = points.map((p) => [p.longitude, p.latitude]);
    } else {
      return null;
    }
    return {
      type: 'Feature' as const,
      geometry: {
        type: 'LineString' as const,
        coordinates: coords,
      },
      properties: {},
    };
  }, [points, routedCoords]);

  const isUsingFallback = routedCoords.length < 2 && points.length >= 2;

  const handleMapReady = useCallback(() => {
    setMapReady(true);
  }, []);

  // Centraliza/ajusta câmera quando os pontos mudam ou o mapa fica pronto
  useEffect(() => {
    if (!mapReady || !cameraRef.current || points.length === 0) return;

    if (points.length === 1) {
      cameraRef.current.setCamera({
        centerCoordinate: [points[0].longitude, points[0].latitude],
        zoomLevel: 15,
        animationDuration: 0,
      });
      return;
    }

    const lngs = points.map((p) => p.longitude);
    const lats = points.map((p) => p.latitude);
    const sw: [number, number] = [Math.min(...lngs), Math.min(...lats)];
    const ne: [number, number] = [Math.max(...lngs), Math.max(...lats)];

    cameraRef.current.fitBounds(ne, sw, 60, 0);
  }, [mapReady, points]);

  return (
    <View style={styles.container}>
      <MapLibreGL.MapView
        style={styles.map}
        mapStyle={MAP_STYLE_JSON}
        attributionEnabled
        logoEnabled={false}
        compassEnabled={false}
        onDidFinishLoadingMap={handleMapReady}
      >
        <MapLibreGL.Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: FALLBACK_CENTER,
            zoomLevel: 4,
          }}
        />

        {lineGeoJson && (
          <MapLibreGL.ShapeSource id="staticRouteSource" shape={lineGeoJson}>
            <MapLibreGL.LineLayer
              id="staticRouteLine"
              style={{
                lineColor: '#4285F4',
                lineWidth: 4,
                lineOpacity: isUsingFallback ? 0.5 : 0.85,
                lineCap: 'round',
                lineJoin: 'round',
                lineDasharray: isUsingFallback ? [2, 1] : [1, 0],
              }}
            />
          </MapLibreGL.ShapeSource>
        )}

        {points.map((point, idx) => (
          <MapLibreGL.PointAnnotation
            key={`${point.latitude}-${point.longitude}-${idx}`}
            id={`pin-${idx}`}
            coordinate={[point.longitude, point.latitude]}
            title={point.name}
            anchor={{ x: 0.5, y: 1 }}
          >
            <View style={styles.pinWrapper}>
              <View style={[styles.pinHead, { backgroundColor: point.color }]}>
                <Text style={styles.pinLabel}>{point.label}</Text>
              </View>
              <View
                style={[
                  styles.pinTail,
                  { borderTopColor: point.color },
                ]}
              />
            </View>
          </MapLibreGL.PointAnnotation>
        ))}
      </MapLibreGL.MapView>

      {!mapReady && (
        <View pointerEvents="none" style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color="#00B4D8" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 280,
    width: '100%',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#f5f5f5',
  },
  map: {
    flex: 1,
  },
  pinWrapper: {
    width: 48,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  pinHead: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 4,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinLabel: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    lineHeight: 22,
    textAlign: 'center',
    includeFontPadding: false,
  },
  pinTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 14,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -2,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
  },
});
