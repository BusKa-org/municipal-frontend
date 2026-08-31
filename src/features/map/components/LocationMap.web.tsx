import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import type * as LeafletNS from 'leaflet';

import type { LocationMapProps } from '../types';
import { normalizeRoutePoints, pointToLatLng } from '../utils/points';

type LeafletModule = typeof LeafletNS;
type LeafletMap = LeafletNS.Map;
type LeafletMarker = LeafletNS.Marker;

export default function LocationMap({ pontosRota, usuario }: LocationMapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<LeafletMap | null>(null);
  const LRef = useRef<LeafletModule | null>(null);
  const destMarkerRef = useRef<LeafletMarker | null>(null);
  const userMarkerRef = useRef<LeafletMarker | null>(null);

  const [mapReady, setMapReady] = useState(false);
  const [loadingMap, setLoadingMap] = useState(true);

  const destinoAtual = useMemo(() => {
    return normalizeRoutePoints(pontosRota)[0] ?? null;
  }, [pontosRota]);

  const destinationLatLng = useMemo(
    () => (destinoAtual ? pointToLatLng(destinoAtual) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [destinoAtual?.id, destinoAtual?.latitude, destinoAtual?.longitude],
  );

  // ─── Map initialisation ───────────────────────────────────────────────────

  useEffect(() => {
    let mounted = true;

    const initMap = async () => {
      if (mapInstance.current || !mapRef.current) return;

      const leafletModule = await import('leaflet');
      const L = (leafletModule.default ?? leafletModule) as LeafletModule;
      LRef.current = L;

      if (!mounted || !mapRef.current) return;

      const map = L.map(mapRef.current, { zoomControl: true }).setView([-15.78, -47.93], 4);

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      mapInstance.current = map;
      setMapReady(true);
      setLoadingMap(false);
    };

    initMap().catch((err) => {
      console.error('Erro Leaflet:', err);
      setLoadingMap(false);
    });

    return () => {
      mounted = false;
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  // ─── Destination marker ───────────────────────────────────────────────────

  useEffect(() => {
    if (!mapReady || !mapInstance.current || !LRef.current) return;
    const map = mapInstance.current;
    const L = LRef.current;

    if (!destinationLatLng) {
      if (destMarkerRef.current) {
        map.removeLayer(destMarkerRef.current);
        destMarkerRef.current = null;
      }
      return;
    }

    const latLng = L.latLng(destinationLatLng.latitude, destinationLatLng.longitude);

    if (destMarkerRef.current) {
      destMarkerRef.current.setLatLng(latLng);
    } else {
      destMarkerRef.current = L.marker(latLng).addTo(map);
    }

  }, [mapReady, destinationLatLng]);

  useEffect(() => {
    if (!mapReady || !mapInstance.current || !LRef.current) return;
    const map = mapInstance.current;
    const L = LRef.current;

    if (!usuario) {
      if (userMarkerRef.current) {
        map.removeLayer(userMarkerRef.current);
        userMarkerRef.current = null;
      }
      return;
    }

    const latLng = L.latLng(usuario.latitude, usuario.longitude);

    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng(latLng);
      return;
    }

    const icon = L.divIcon({
      className: 'usuario-icon',
      html: '<div style="width:16px;height:16px;background:#2196F3;border:3px solid white;border-radius:50%;box-shadow:0 0 5px rgba(0,0,0,0.5);"></div>',
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });

    userMarkerRef.current = L.marker(latLng, { icon, zIndexOffset: 1000 })
      .addTo(map)
      .bindPopup('<strong>Você está aqui</strong>');
  }, [mapReady, usuario]);

  useEffect(() => {
    if (!mapReady || !mapInstance.current || !LRef.current) return;
    const map = mapInstance.current;
    const L = LRef.current;

    const alvos = [
      ...(destinationLatLng ? [destinationLatLng] : []),
      ...(usuario ? [usuario] : []),
    ];

    if (alvos.length === 0) return;

    if (alvos.length === 1) {
      map.setView(L.latLng(alvos[0].latitude, alvos[0].longitude), 15);
      return;
    }

    map.fitBounds(
      L.latLngBounds(alvos.map((c) => L.latLng(c.latitude, c.longitude))),
      { padding: [50, 50] },
    );
  }, [mapReady, destinationLatLng, usuario]);

  return (
    <View style={styles.container}>
      <div ref={mapRef} style={styles.map as React.CSSProperties} />

      {loadingMap && (
        <View pointerEvents="none" style={styles.loadingOverlay}>
          <ActivityIndicator size="small" />
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
