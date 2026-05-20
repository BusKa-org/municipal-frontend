// src/features/map/components/RouteMap.web.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import maplibregl, { LngLatBoundsLike, Map as MapLibreMap, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import type { LatLng, RouteMapProps } from '../types';
import { useRoutePolyline } from '../hooks/useRoutePolyline';
import { useArrivalDetection } from '../hooks/useArrivalDetection';
import { normalizeRoutePoints, pointToLatLng, buildFitCoordinates } from '../utils/points';
import { MAP_STYLE_URL } from '../utils/mapStyle';

const ROUTE_SOURCE_ID = 'route-source';
const ROUTE_LAYER_ID = 'route-layer';

export default function RouteMap({ pontosRota, onPontoChegado, style }: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const userMarkerRef = useRef<Marker | null>(null);
  const destMarkerRef = useRef<Marker | null>(null);
  const watchIdRef = useRef<number | null>(null);
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

  // Init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      center: [-46.63, -23.55],
      zoom: 12,
      attributionControl: { compact: true },
    });

    map.on('load', () => {
      // Source + layer pra rota (criados vazios; depois atualizamos a data)
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
          'line-color': '#007bff',
          'line-width': 6,
          'line-opacity': 0.85,
        },
      });
      setMapReady(true);
    });

    mapRef.current = map;

    return () => {
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
      if (destMarkerRef.current) {
        destMarkerRef.current.remove();
        destMarkerRef.current = null;
      }
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Geolocation watch
  useEffect(() => {
    if (!mapReady) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setUserLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
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

  // Destination marker
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    if (!destinationLatLng) {
      destMarkerRef.current?.remove();
      destMarkerRef.current = null;
      return;
    }

    if (destMarkerRef.current) {
      destMarkerRef.current.setLngLat([
        destinationLatLng.longitude,
        destinationLatLng.latitude,
      ]);
    } else {
      destMarkerRef.current = new maplibregl.Marker({ color: '#EA4335' })
        .setLngLat([destinationLatLng.longitude, destinationLatLng.latitude])
        .addTo(mapRef.current);
    }
  }, [mapReady, destinationLatLng]);

  // User marker (custom DOM element)
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    if (!userLocation) {
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      return;
    }

    if (userMarkerRef.current) {
      userMarkerRef.current.setLngLat([userLocation.longitude, userLocation.latitude]);
    } else {
      const el = document.createElement('div');
      el.style.width = '16px';
      el.style.height = '16px';
      el.style.borderRadius = '50%';
      el.style.background = '#2196F3';
      el.style.border = '3px solid #fff';
      el.style.boxShadow = '0 0 5px rgba(0,0,0,0.5)';

      userMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([userLocation.longitude, userLocation.latitude])
        .addTo(mapRef.current);
    }
  }, [mapReady, userLocation]);

  // Route polyline — usa rota calculada se disponível, senão linha reta
  // entre origem e destino como fallback (quando o OSRM falha).
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const source = mapRef.current.getSource(ROUTE_SOURCE_ID) as
      | maplibregl.GeoJSONSource
      | undefined;
    if (!source) return;

    let coordinates: number[][] = [];
    let isFallback = false;
    if (routeCoordinates.length >= 2) {
      coordinates = routeCoordinates.map((c) => [c.longitude, c.latitude]);
    } else if (userLocation && destinationLatLng) {
      coordinates = [
        [userLocation.longitude, userLocation.latitude],
        [destinationLatLng.longitude, destinationLatLng.latitude],
      ];
      isFallback = true;
    }

    if (mapRef.current.getLayer(ROUTE_LAYER_ID)) {
      mapRef.current.setPaintProperty(
        ROUTE_LAYER_ID,
        'line-dasharray',
        isFallback ? [2, 1] : [1, 0],
      );
      mapRef.current.setPaintProperty(
        ROUTE_LAYER_ID,
        'line-opacity',
        isFallback ? 0.5 : 0.85,
      );
      mapRef.current.setPaintProperty(
        ROUTE_LAYER_ID,
        'line-width',
        isFallback ? 4 : 6,
      );
    }

    source.setData({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates },
      properties: {},
    });
  }, [mapReady, routeCoordinates, userLocation, destinationLatLng]);

  // Fit bounds (once per destination)
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    if (!userLocation || !destinationLatLng || hasFittedRef.current) return;

    const coords = buildFitCoordinates({
      userLocation,
      destination: destinoAtual,
      polyline: routeCoordinates,
    });

    if (coords.length < 2) return;

    const lngs = coords.map((c) => c.longitude);
    const lats = coords.map((c) => c.latitude);
    const bounds: LngLatBoundsLike = [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)],
    ];

    mapRef.current.fitBounds(bounds, { padding: 50, duration: 600 });
    hasFittedRef.current = true;
  }, [mapReady, userLocation, destinationLatLng, routeCoordinates, destinoAtual]);

  // Reset fit-once flag when destination changes
  useEffect(() => {
    hasFittedRef.current = false;
  }, [destinoAtual?.id]);

  return (
    <div
      ref={containerRef}
      style={{
        ...(styles.container as React.CSSProperties),
        ...((style as React.CSSProperties) || {}),
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    height: 400,
    width: '100%',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#f5f5f5',
  },
});
