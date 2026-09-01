import React, { useEffect, useRef, useState } from 'react';

import type * as LeafletNS from 'leaflet';
import { TILE_ATTRIBUTION, TILE_MAX_ZOOM, TILE_URL } from '../utils/tiles';

type LeafletModule = typeof LeafletNS;
type LeafletMap = LeafletNS.Map;
type LeafletMarker = LeafletNS.Marker;

export interface PickerLatLng {
  latitude: number;
  longitude: number;
}

interface MapPointPickerProps {
  initialLocation?: PickerLatLng;
  onLocationChange?: (location: PickerLatLng) => void;
}

const PIN_HTML = [
  '<div style="display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 3px 6px rgba(0,0,0,0.4))">',
  '<div style="',
  'width:34px;height:34px;border-radius:50%;',
  'background:#4285F4;',
  'color:white;display:flex;align-items:center;justify-content:center;',
  'font-size:20px;',
  'border:3px solid white;',
  '">📍</div>',
  '<div style="',
  'width:0;height:0;',
  'border-left:7px solid transparent;',
  'border-right:7px solid transparent;',
  'border-top:10px solid #4285F4;',
  'margin-top:-2px;',
  '"></div>',
  '</div>',
].join('');

/**
 * Web twin of MapPointPicker.native: drag the pin or click the map to move it.
 * The WebView postMessage bridge collapses into a direct callback here.
 */
export default function MapPointPicker({
  initialLocation,
  onLocationChange,
}: MapPointPickerProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const LRef = useRef<LeafletModule | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Kept in a ref so re-renders never tear down the map to rebind the handler.
  const onChangeRef = useRef(onLocationChange);
  useEffect(() => {
    onChangeRef.current = onLocationChange;
  }, [onLocationChange]);

  useEffect(() => {
    let mounted = true;

    const initMap = async () => {
      if (!mapRef.current || mapInstance.current) return;

      const leafletModule = await import('leaflet');
      const L = (leafletModule.default ?? leafletModule) as LeafletModule;
      if (!mounted || !mapRef.current) return;

      LRef.current = L;

      const lat = initialLocation?.latitude ?? -15.78;
      const lng = initialLocation?.longitude ?? -47.93;
      const zoom = initialLocation ? 16 : 5;

      const map = L.map(mapRef.current, { zoomControl: true }).setView(
        [lat, lng],
        zoom,
      );

      L.tileLayer(TILE_URL, {
        attribution: TILE_ATTRIBUTION,
        maxZoom: TILE_MAX_ZOOM,
      }).addTo(map);

      const icon = L.divIcon({
        className: 'custom-pin',
        html: PIN_HTML,
        iconSize: [34, 50],
        iconAnchor: [17, 50],
        popupAnchor: [0, -52],
      });

      const marker = L.marker([lat, lng], { icon, draggable: true }).addTo(map);

      const notify = (nlat: number, nlng: number) =>
        onChangeRef.current?.({ latitude: nlat, longitude: nlng });

      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        notify(pos.lat, pos.lng);
      });

      map.on('click', (e: LeafletNS.LeafletMouseEvent) => {
        marker.setLatLng(e.latlng);
        notify(e.latlng.lat, e.latlng.lng);
      });

      markerRef.current = marker;
      mapInstance.current = map;
      setMapReady(true);
    };

    initMap().catch((err) => console.error('Erro ao carregar Leaflet:', err));

    return () => {
      mounted = false;
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
        markerRef.current = null;
      }
    };
    // Initial view only — later moves are handled by the sync effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mirrors window.setMarkerPosition from the native bridge.
  useEffect(() => {
    if (!mapReady || !mapInstance.current || !markerRef.current || !LRef.current)
      return;
    if (!initialLocation) return;

    const L = LRef.current;
    const ll = L.latLng(initialLocation.latitude, initialLocation.longitude);
    const current = markerRef.current.getLatLng();

    // Avoid fighting the user's own drag/click updates.
    if (Math.abs(current.lat - ll.lat) < 1e-7 && Math.abs(current.lng - ll.lng) < 1e-7)
      return;

    markerRef.current.setLatLng(ll);
    mapInstance.current.setView(ll, 16, { animate: true });
  }, [mapReady, initialLocation]);

  return (
    <div style={styles.wrapper}>
      <div ref={mapRef} style={styles.map} />
      <div style={styles.hint}>
        Clique no mapa ou arraste o pino para ajustar
      </div>
    </div>
  );
}

// Plain CSS objects: these are real DOM nodes, and the hint uses values
// (shorthand padding, whiteSpace) that aren't valid React Native styles.
const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    position: 'relative',
    height: 320,
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f5f5f5',
  },
  map: {
    height: '100%',
    width: '100%',
  },
  hint: {
    position: 'absolute',
    bottom: 36,
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: 'rgba(0,0,0,0.62)',
    color: '#fff',
    padding: '5px 14px',
    borderRadius: 20,
    fontSize: 12,
    fontFamily: 'sans-serif',
    zIndex: 1000,
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
  },
};
