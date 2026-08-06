// src/features/map/components/LocationMap.web.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import maplibregl, { Map as MapLibreMap, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import type { LocationMapProps } from '../types';
import { normalizeRoutePoints, pointToLatLng } from '../utils/points';
import { MAP_STYLE_URL } from '../utils/mapStyle';

export default function LocationMap({ pontosRota, style }: LocationMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const destMarkerRef = useRef<Marker | null>(null);

  const [mapReady, setMapReady] = useState(false);

  const destinoAtual = useMemo(
    () => normalizeRoutePoints(pontosRota)[0] ?? null,
    [pontosRota],
  );
  const destinationLatLng = useMemo(
    () => (destinoAtual ? pointToLatLng(destinoAtual) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [destinoAtual?.id, destinoAtual?.latitude, destinoAtual?.longitude],
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      center: [-46.63, -23.55],
      zoom: 12,
      attributionControl: { compact: true },
    });

    map.on('load', () => setMapReady(true));
    mapRef.current = map;

    return () => {
      destMarkerRef.current?.remove();
      destMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    if (!destinationLatLng) {
      destMarkerRef.current?.remove();
      destMarkerRef.current = null;
      return;
    }

    const lngLat: [number, number] = [
      destinationLatLng.longitude,
      destinationLatLng.latitude,
    ];

    if (destMarkerRef.current) {
      destMarkerRef.current.setLngLat(lngLat);
    } else {
      destMarkerRef.current = new maplibregl.Marker({ color: '#EA4335' })
        .setLngLat(lngLat)
        .addTo(mapRef.current);
    }

    mapRef.current.flyTo({ center: lngLat, zoom: 15 });
  }, [mapReady, destinationLatLng]);

  return (
    <View style={[styles.container, style]}>
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
    height: 400,
    width: '100%',
    borderRadius: 10,
    backgroundColor: '#fff',
    overflow: 'hidden',
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
