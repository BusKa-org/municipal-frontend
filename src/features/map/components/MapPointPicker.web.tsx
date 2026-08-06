// src/features/map/components/MapPointPicker.web.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import maplibregl, { Map as MapLibreMap, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import { MAP_STYLE_URL } from '../utils/mapStyle';

export interface PickerLatLng {
  latitude: number;
  longitude: number;
}

interface MapPointPickerProps {
  initialLocation?: PickerLatLng;
  onLocationChange?: (location: PickerLatLng) => void;
}

const FALLBACK: PickerLatLng = { latitude: -15.78, longitude: -47.93 };

function buildPinElement(): HTMLDivElement {
  const wrapper = document.createElement('div');
  wrapper.style.display = 'flex';
  wrapper.style.flexDirection = 'column';
  wrapper.style.alignItems = 'center';
  wrapper.style.filter = 'drop-shadow(0 3px 6px rgba(0,0,0,0.4))';
  wrapper.style.cursor = 'grab';

  const head = document.createElement('div');
  head.style.width = '34px';
  head.style.height = '34px';
  head.style.borderRadius = '50%';
  head.style.background = '#4285F4';
  head.style.color = '#fff';
  head.style.display = 'flex';
  head.style.alignItems = 'center';
  head.style.justifyContent = 'center';
  head.style.fontSize = '18px';
  head.style.border = '3px solid #fff';
  head.textContent = '📍';

  const tail = document.createElement('div');
  tail.style.width = '0';
  tail.style.height = '0';
  tail.style.borderLeft = '7px solid transparent';
  tail.style.borderRight = '7px solid transparent';
  tail.style.borderTop = '10px solid #4285F4';
  tail.style.marginTop = '-2px';

  wrapper.appendChild(head);
  wrapper.appendChild(tail);
  return wrapper;
}

export default function MapPointPicker({
  initialLocation,
  onLocationChange,
}: MapPointPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const onLocationChangeRef = useRef(onLocationChange);

  const [mapReady, setMapReady] = useState(false);
  const [position, setPosition] = useState<PickerLatLng>(initialLocation ?? FALLBACK);

  useEffect(() => {
    onLocationChangeRef.current = onLocationChange;
  }, [onLocationChange]);

  const updatePosition = useCallback((loc: PickerLatLng) => {
    setPosition(loc);
    onLocationChangeRef.current?.(loc);
  }, []);

  // Init map (apenas uma vez)
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const startLng = initialLocation?.longitude ?? FALLBACK.longitude;
    const startLat = initialLocation?.latitude ?? FALLBACK.latitude;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      center: [startLng, startLat],
      zoom: initialLocation ? 16 : 4,
      attributionControl: { compact: true },
    });

    map.on('load', () => setMapReady(true));

    map.on('click', (e) => {
      const { lng, lat } = e.lngLat;
      updatePosition({ latitude: lat, longitude: lng });
    });

    const pinEl = buildPinElement();
    const marker = new maplibregl.Marker({
      element: pinEl,
      draggable: true,
      anchor: 'bottom',
    })
      .setLngLat([startLng, startLat])
      .addTo(map);

    marker.on('dragend', () => {
      const { lng, lat } = marker.getLngLat();
      updatePosition({ latitude: lat, longitude: lng });
    });

    mapRef.current = map;
    markerRef.current = marker;

    return () => {
      marker.remove();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sincroniza marcador quando posição muda (por click/drag interno OU prop externa)
  useEffect(() => {
    if (!markerRef.current) return;
    markerRef.current.setLngLat([position.longitude, position.latitude]);
  }, [position]);

  // Reage a mudanças externas em initialLocation
  useEffect(() => {
    if (!initialLocation) return;
    if (
      initialLocation.latitude === position.latitude &&
      initialLocation.longitude === position.longitude
    ) {
      return;
    }
    setPosition(initialLocation);
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [initialLocation.longitude, initialLocation.latitude],
        zoom: 16,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLocation?.latitude, initialLocation?.longitude]);

  return (
    <View style={styles.container}>
      <div ref={containerRef} style={styles.map as React.CSSProperties} />

      <View pointerEvents="none" style={styles.hint}>
        <Text style={styles.hintText}>Toque no mapa ou arraste o pino para ajustar</Text>
      </View>

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
    height: 240,
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
  hint: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  hintText: {
    backgroundColor: 'rgba(0,0,0,0.62)',
    color: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    fontSize: 12,
    overflow: 'hidden',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
