import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import type * as LeafletNS from 'leaflet';

type LeafletModule = typeof LeafletNS;
type LeafletMap = LeafletNS.Map;

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

type PreparedPoint = {
  lat: number;
  lng: number;
  label: string;
  color: string;
  name: string;
};

const START_COLOR = '#34A853';
const END_COLOR = '#EA4335';
const MID_COLOR = '#4285F4';

function preparePoints(points: RoutePoint[]): PreparedPoint[] {
  const valid = [...(points || [])]
    .filter((p) => {
      const lat = Number(p.latitude);
      const lng = Number(p.longitude);
      return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
    })
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

  return valid.map((p, i) => ({
    lat: Number(p.latitude),
    lng: Number(p.longitude),
    label: i === 0 ? 'A' : i === valid.length - 1 ? 'B' : String(i + 1),
    color: i === 0 ? START_COLOR : i === valid.length - 1 ? END_COLOR : MID_COLOR,
    name: p.nome || p.apelido || `Ponto ${i + 1}`,
  }));
}

function buildPinHtml(color: string, label: string): string {
  return [
    '<div style="display:flex;flex-direction:column;align-items:center">',
    '<div style="',
    'width:28px;height:28px;border-radius:50%;',
    `background:${color};`,
    'color:white;display:flex;align-items:center;justify-content:center;',
    'font-size:12px;font-weight:bold;',
    'border:3px solid white;',
    'box-shadow:0 2px 6px rgba(0,0,0,0.35);',
    `">${label}</div>`,
    '<div style="',
    'width:0;height:0;',
    'border-left:5px solid transparent;',
    'border-right:5px solid transparent;',
    `border-top:7px solid ${color};`,
    'margin-top:-1px;',
    '"></div>',
    '</div>',
  ].join('');
}

export default function StaticRouteMap({ pontosRota }: StaticRouteMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<LeafletMap | null>(null);
  const LRef = useRef<LeafletModule | null>(null);
  const layersRef = useRef<LeafletNS.Layer[]>([]);

  const [mapReady, setMapReady] = useState(false);

  const points = useMemo(() => preparePoints(pontosRota), [pontosRota]);

  useEffect(() => {
    let mounted = true;

    const initMap = async () => {
      if (mapInstance.current || !containerRef.current) return;

      const leafletModule = await import('leaflet');
      const L = (leafletModule.default ?? leafletModule) as LeafletModule;
      LRef.current = L;

      if (!mounted || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        zoomControl: true,
        scrollWheelZoom: false,
      }).setView([-15.78, -47.93], 5);

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
      layersRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !mapInstance.current || !LRef.current) return;
    const map = mapInstance.current;
    const L = LRef.current;

    layersRef.current.forEach((layer) => map.removeLayer(layer));
    layersRef.current = [];

    if (points.length === 0) return;

    const latLngs = points.map((p) => L.latLng(p.lat, p.lng));

    points.forEach((point, i) => {
      const icon = L.divIcon({
        className: 'custom-pin',
        html: buildPinHtml(point.color, point.label),
        iconSize: [28, 42],
        iconAnchor: [14, 42],
        popupAnchor: [0, -42],
      });

      const marker = L.marker(latLngs[i], { icon })
        .addTo(map)
        .bindPopup(`<strong>${point.name}</strong>`);

      layersRef.current.push(marker);
    });

    if (latLngs.length >= 2) {
      const line = L.polyline(latLngs, {
        color: MID_COLOR,
        weight: 4,
        opacity: 0.8,
        dashArray: '8, 4',
      }).addTo(map);

      layersRef.current.push(line);
      map.fitBounds(L.latLngBounds(latLngs), { padding: [40, 40] });
    } else {
      map.setView(latLngs[0], 15);
    }
  }, [mapReady, points]);

  return <div ref={containerRef} style={styles.container as React.CSSProperties} />;
}

const styles = StyleSheet.create({
  container: {
    height: 280,
    width: '100%',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#f5f5f5',
  },
});
