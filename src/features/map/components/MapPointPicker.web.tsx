import React, { useEffect, useRef, useState } from 'react';
import type * as LeafletNS from 'leaflet';

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

const DEFAULT_CENTER: PickerLatLng = { latitude: -15.78, longitude: -47.93 };
const PIN_COLOR = '#4285F4';

const PIN_HTML = [
  '<div style="display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 3px 6px rgba(0,0,0,0.4))">',
  '<div style="',
  'width:34px;height:34px;border-radius:50%;',
  `background:${PIN_COLOR};`,
  'color:white;display:flex;align-items:center;justify-content:center;',
  'font-size:20px;',
  'border:3px solid white;',
  '">📍</div>',
  '<div style="',
  'width:0;height:0;',
  'border-left:7px solid transparent;',
  'border-right:7px solid transparent;',
  `border-top:10px solid ${PIN_COLOR};`,
  'margin-top:-2px;',
  '"></div>',
  '</div>',
].join('');

export default function MapPointPicker({
  initialLocation,
  onLocationChange,
}: MapPointPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<LeafletMap | null>(null);
  const LRef = useRef<LeafletModule | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const prevLocationRef = useRef<PickerLatLng | undefined>(initialLocation);

  const onLocationChangeRef = useRef(onLocationChange);
  useEffect(() => {
    onLocationChangeRef.current = onLocationChange;
  }, [onLocationChange]);

  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    const initMap = async () => {
      if (mapInstance.current || !containerRef.current) return;

      const leafletModule = await import('leaflet');
      const L = (leafletModule.default ?? leafletModule) as LeafletModule;
      LRef.current = L;

      if (!mounted || !containerRef.current) return;

      const start = initialLocation ?? DEFAULT_CENTER;
      const zoom = initialLocation ? 16 : 5;

      const map = L.map(containerRef.current, { zoomControl: true }).setView(
        [start.latitude, start.longitude],
        zoom,
      );

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      const icon = L.divIcon({
        className: 'custom-pin',
        html: PIN_HTML,
        iconSize: [34, 50],
        iconAnchor: [17, 50],
        popupAnchor: [0, -52],
      });

      const marker = L.marker([start.latitude, start.longitude], {
        icon,
        draggable: true,
      }).addTo(map);

      const notify = (latitude: number, longitude: number) => {
        prevLocationRef.current = { latitude, longitude };
        onLocationChangeRef.current?.({ latitude, longitude });
      };

      marker.on('dragend', (event) => {
        const pos = (event.target as LeafletMarker).getLatLng();
        notify(pos.lat, pos.lng);
      });

      map.on('click', (event: LeafletNS.LeafletMouseEvent) => {
        marker.setLatLng(event.latlng);
        notify(event.latlng.lat, event.latlng.lng);
      });

      mapInstance.current = map;
      markerRef.current = marker;
      setMapReady(true);
    };

    initMap().catch((err) => console.error('Erro Leaflet:', err));

    return () => {
      mounted = false;
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapReady || !initialLocation) return;
    if (!mapInstance.current || !markerRef.current || !LRef.current) return;

    const prev = prevLocationRef.current;
    if (
      prev?.latitude === initialLocation.latitude &&
      prev?.longitude === initialLocation.longitude
    ) {
      return;
    }

    prevLocationRef.current = initialLocation;

    const latLng = LRef.current.latLng(
      initialLocation.latitude,
      initialLocation.longitude,
    );
    markerRef.current.setLatLng(latLng);
    mapInstance.current.setView(latLng, 16, { animate: true });
  }, [mapReady, initialLocation]);

  return (
    <div style={styles.container}>
      <div ref={containerRef} style={styles.map} />
      <div style={styles.hint}>Clique no mapa ou arraste o pino para ajustar</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: 240,
    width: '100%',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#f5f5f5',
    position: 'relative',
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
