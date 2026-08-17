import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import type * as LeafletNS from 'leaflet';

import type { LatLng, RouteMapProps } from '../types';
import { useRoutePolyline } from '../hooks/useRoutePolyline';
import { useArrivalDetection } from '../hooks/useArrivalDetection';
import { normalizeRoutePoints, pointToLatLng, buildFitCoordinates } from '../utils/points';

type LeafletModule = typeof LeafletNS;
type LeafletMap = LeafletNS.Map;
type LeafletMarker = LeafletNS.Marker;
type LeafletPolyline = LeafletNS.Polyline;

export default function RouteMap({ pontosRota, onPontoChegado, fill }: RouteMapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<LeafletMap | null>(null);
  const LRef = useRef<LeafletModule | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const userMarkerRef = useRef<LeafletMarker | null>(null);
  const destMarkerRef = useRef<LeafletMarker | null>(null);
  const routeLineRef = useRef<LeafletPolyline | null>(null);
  const hasFittedRef = useRef(false);

  const [mapReady, setMapReady] = useState(false);
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);

  const pontosValidos = useMemo(() => normalizeRoutePoints(pontosRota), [pontosRota]);
  const destinoAtual = pontosValidos[0] ?? null;
  const destinationLatLng = useMemo(
    () => (destinoAtual ? pointToLatLng(destinoAtual) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [destinoAtual?.id, destinoAtual?.latitude, destinoAtual?.longitude],
  );

  const { coordinates: routeCoordinates, reset: resetRoute } = useRoutePolyline({
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
      onPontoChegado?.(point);
    },
  });

  // ─── Map initialisation ───────────────────────────────────────────────────

  useEffect(() => {
    let mounted = true;

    const initMap = async () => {
      if (mapInstance.current || !mapRef.current) return;

      const leafletModule = await import('leaflet');
      const L = (leafletModule.default ?? leafletModule) as LeafletModule;
      LRef.current = L;

      if (!mounted || !mapRef.current) return;

      const map = L.map(mapRef.current).setView([-23.55, -46.63], 13);

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      mapInstance.current = map;
      setMapReady(true);
    };

    initMap().catch((err) => console.error('Erro Leaflet:', err));

    return () => {
      mounted = false;
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  // ─── Geolocation watch (browser API — react-native-geolocation-service is native-only) ───

  useEffect(() => {
    if (!mapReady) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      },
      (err) => console.warn('Geolocation error:', err),
      { enableHighAccuracy: true },
    );

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [mapReady]);

  // ─── User marker ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!mapReady || !mapInstance.current || !LRef.current) return;
    const map = mapInstance.current;
    const L = LRef.current;

    if (!userLocation) {
      if (userMarkerRef.current) {
        map.removeLayer(userMarkerRef.current);
        userMarkerRef.current = null;
      }
      return;
    }

    const latLng = L.latLng(userLocation.latitude, userLocation.longitude);

    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng(latLng);
    } else {
      const icon = L.divIcon({
        className: 'motorista-icon',
        html: '<div style="width:16px;height:16px;background:#2196F3;border:3px solid white;border-radius:50%;box-shadow:0 0 5px rgba(0,0,0,0.5);"></div>',
      });
      userMarkerRef.current = L.marker(latLng, { icon, zIndexOffset: 1000 }).addTo(map);
    }
  }, [mapReady, userLocation]);

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
      hasFittedRef.current = false;
      return;
    }

    const latLng = L.latLng(destinationLatLng.latitude, destinationLatLng.longitude);

    if (destMarkerRef.current) {
      destMarkerRef.current.setLatLng(latLng);
    } else {
      destMarkerRef.current = L.marker(latLng).addTo(map);
    }
  }, [mapReady, destinationLatLng]);

  // ─── Route polyline ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!mapReady || !mapInstance.current || !LRef.current) return;
    const map = mapInstance.current;
    const L = LRef.current;

    if (routeLineRef.current) {
      map.removeLayer(routeLineRef.current);
      routeLineRef.current = null;
    }

    if (routeCoordinates.length < 2) return;

    routeLineRef.current = L.polyline(
      routeCoordinates.map((c) => L.latLng(c.latitude, c.longitude)),
      { color: '#007bff', weight: 6, opacity: 0.8 },
    ).addTo(map);
  }, [mapReady, routeCoordinates]);

  // ─── Fit bounds (once per destination) ───────────────────────────────────

  useEffect(() => {
    if (!mapReady || !mapInstance.current || !LRef.current) return;
    if (!userLocation || !destinationLatLng || hasFittedRef.current) return;

    const L = LRef.current;
    const coords = buildFitCoordinates({
      userLocation,
      destination: destinoAtual,
      polyline: routeCoordinates,
    });

    if (coords.length < 2) return;

    mapInstance.current.fitBounds(
      L.latLngBounds(coords.map((c) => L.latLng(c.latitude, c.longitude))),
      { padding: [30, 30] },
    );
    hasFittedRef.current = true;
  }, [mapReady, userLocation, destinationLatLng, routeCoordinates, destinoAtual]);

  // Reset fit-once flag when the destination changes
  useEffect(() => {
    hasFittedRef.current = false;
  }, [destinoAtual?.id]);

  return (
    <div
      ref={mapRef}
      style={
        {
          ...(styles.container as React.CSSProperties),
          ...(fill ? { height: '100%', flex: 1, borderRadius: 0 } : null),
        } as React.CSSProperties
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {
    height: 400,
    width: '100%',
    borderRadius: 10,
    overflow: 'hidden',
  },
});
