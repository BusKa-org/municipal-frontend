import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import maplibregl, { LngLatBoundsLike, Map as MapLibreMap, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import { MAP_STYLE_URL } from '../utils/mapStyle';
import { useMultiSegmentRoute } from '../hooks/useMultiSegmentRoute';

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

const ROUTE_SOURCE_ID = 'static-route-source';
const ROUTE_LAYER_ID = 'static-route-layer';

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
    color: i === 0 ? '#34A853' : i === valid.length - 1 ? '#EA4335' : '#4285F4',
    name: p.nome || p.apelido || `Ponto ${i + 1}`,
  }));
}

function buildPinElement(label: string, color: string, title: string): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.title = title;
  wrapper.style.position = 'relative';
  wrapper.style.width = '60px';
  wrapper.style.height = '88px';
  wrapper.style.filter = 'drop-shadow(0 5px 10px rgba(0,0,0,0.5))';
  wrapper.style.cursor = 'pointer';

  wrapper.innerHTML = `
    <svg width="60" height="88" viewBox="-4 -4 44 60" xmlns="http://www.w3.org/2000/svg">
      <path d="M 13 50 a 5 1.8 0 1 0 10 0 a 5 1.8 0 1 0 -10 0 z"
            fill="rgba(0,0,0,0.5)" />
      <path d="M 18 0 C 8.06 0 0 8.06 0 18 c 0 13.5 18 32 18 32 s 18 -18.5 18 -32 C 36 8.06 27.94 0 18 0 z"
            fill="#ffffff" stroke="#ffffff" stroke-width="6" stroke-linejoin="round" />
      <path d="M 18 0 C 8.06 0 0 8.06 0 18 c 0 13.5 18 32 18 32 s 18 -18.5 18 -32 C 36 8.06 27.94 0 18 0 z"
            fill="${color}" />
      <circle cx="18" cy="18" r="11" fill="#ffffff" />
    </svg>
    <span style="
      position: absolute;
      top: 8px;
      left: 0;
      width: 60px;
      text-align: center;
      font-size: 20px;
      font-weight: bold;
      line-height: 32px;
      color: ${color};
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      pointer-events: none;
    ">${label}</span>
  `;

  return wrapper;
}

export default function StaticRouteMap({ pontosRota }: StaticRouteMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);

  const [mapReady, setMapReady] = useState(false);

  const points = useMemo(() => normalizePoints(pontosRota || []), [pontosRota]);

  const pointsForRouting = useMemo(
    () => points.map((p) => ({ latitude: p.latitude, longitude: p.longitude })),
    [points],
  );

  const { coordinates: routedCoords } = useMultiSegmentRoute(pointsForRouting);

  const isUsingFallback = routedCoords.length < 2 && points.length >= 2;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      center: [-47.93, -15.78],
      zoom: 4,
      attributionControl: { compact: true },
    });

    map.on('load', () => {
      map.addSource(ROUTE_SOURCE_ID, {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: [] },
          properties: {},
        },
      });
      map.addLayer({
        id: ROUTE_LAYER_ID,
        type: 'line',
        source: ROUTE_SOURCE_ID,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#4285F4',
          'line-width': 4,
          'line-opacity': 0.85,
        },
      });
      setMapReady(true);
    });

    mapRef.current = map;

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    points.forEach((point) => {
      const el = buildPinElement(point.label, point.color, point.name);
      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([point.longitude, point.latitude])
        .addTo(map);
      markersRef.current.push(marker);
    });

    const source = map.getSource(ROUTE_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (source) {
      let coords: number[][] = [];
      if (routedCoords.length >= 2) {
        coords = routedCoords.map((c) => [c.longitude, c.latitude]);
      } else if (points.length >= 2) {
        coords = points.map((p) => [p.longitude, p.latitude]);
      }
      source.setData({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: coords },
        properties: {},
      });
    }

    if (map.getLayer(ROUTE_LAYER_ID)) {
      map.setPaintProperty(
        ROUTE_LAYER_ID,
        'line-dasharray',
        isUsingFallback ? [2, 1] : [1, 0],
      );
      map.setPaintProperty(
        ROUTE_LAYER_ID,
        'line-opacity',
        isUsingFallback ? 0.5 : 0.85,
      );
    }

    // Ajusta viewport
    if (points.length === 1) {
      map.flyTo({ center: [points[0].longitude, points[0].latitude], zoom: 15 });
    } else if (points.length >= 2) {
      const lngs = points.map((p) => p.longitude);
      const lats = points.map((p) => p.latitude);
      const bounds: LngLatBoundsLike = [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ];
      map.fitBounds(bounds, { padding: 50, duration: 500 });
    }
  }, [mapReady, points, routedCoords, isUsingFallback]);

  return (
    <View style={styles.container}>
      <div ref={containerRef} style={styles.map as React.CSSProperties} />
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
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
