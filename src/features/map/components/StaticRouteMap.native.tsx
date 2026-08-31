import React, { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { useUniversidades, type Universidade } from '../hooks/useUniversidades';

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
  mostrarUniversidades?: boolean;
}

function buildStaticRouteHtml(points: RoutePoint[], universidades: Universidade[]): string {
  const validPoints = [...points]
    .filter(p => {
      const lat = Number(p.latitude);
      const lng = Number(p.longitude);
      return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
    })
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

  const universidadesJson = JSON.stringify(
    universidades.map((u) => ({
      lat: u.latitude,
      lng: u.longitude,
      sigla: u.sigla,
      nome: u.nome,
    })),
  );

  const pointsJson = JSON.stringify(
    validPoints.map((p, i) => ({
      lat: Number(p.latitude),
      lng: Number(p.longitude),
      label: i === 0 ? 'A' : i === validPoints.length - 1 ? 'B' : String(i + 1),
      color: i === 0 ? '#34A853' : i === validPoints.length - 1 ? '#EA4335' : '#4285F4',
      name: p.nome || p.apelido || `Ponto ${i + 1}`,
    })),
  );

  return `
<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <meta name="referrer" content="strict-origin-when-cross-origin" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; background: #f5f5f5; }
    body { overflow: hidden; }
    .leaflet-container { width: 100%; height: 100%; }
    .custom-pin { background: transparent; border: none; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    (function() {
      if (typeof L === 'undefined') return;

      var points = ${pointsJson};
      var universidades = ${universidadesJson};
      var map = L.map('map', { zoomControl: true }).setView([-15.78, -47.93], 5);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      var latLngs = [];

      points.forEach(function(point) {
        var latLng = L.latLng(point.lat, point.lng);
        latLngs.push(latLng);

        var pinHtml = [
          '<div style="display:flex;flex-direction:column;align-items:center">',
            '<div style="',
              'width:28px;height:28px;border-radius:50%;',
              'background:' + point.color + ';',
              'color:white;display:flex;align-items:center;justify-content:center;',
              'font-size:12px;font-weight:bold;',
              'border:3px solid white;',
              'box-shadow:0 2px 6px rgba(0,0,0,0.35);',
            '">' + point.label + '</div>',
            '<div style="',
              'width:0;height:0;',
              'border-left:5px solid transparent;',
              'border-right:5px solid transparent;',
              'border-top:7px solid ' + point.color + ';',
              'margin-top:-1px;',
            '"></div>',
          '</div>',
        ].join('');

        var icon = L.divIcon({
          className: 'custom-pin',
          html: pinHtml,
          iconSize: [28, 42],
          iconAnchor: [14, 42],
          popupAnchor: [0, -42],
        });

        L.marker(latLng, { icon: icon }).addTo(map).bindPopup('<strong>' + point.name + '</strong>');
      });

      universidades.forEach(function(uni) {
        var uniHtml = [
          '<div style="display:flex;flex-direction:column;align-items:center">',
            '<div style="',
              'background:#4C1D95;color:#fff;',
              'font-size:11px;font-weight:700;letter-spacing:0.3px;',
              'padding:3px 9px;border-radius:11px;',
              'border:2px solid #fff;white-space:nowrap;',
              'box-shadow:0 2px 8px rgba(0,0,0,0.4);',
            '">&#127891; ' + uni.sigla + '</div>',
            '<div style="',
              'width:0;height:0;',
              'border-left:6px solid transparent;',
              'border-right:6px solid transparent;',
              'border-top:9px solid #4C1D95;',
              'margin-top:-1px;',
            '"></div>',
          '</div>',
        ].join('');

        var uniIcon = L.divIcon({
          className: 'custom-pin',
          html: uniHtml,
          iconSize: [96, 40],
          iconAnchor: [48, 40],
          popupAnchor: [0, -42],
        });

        L.marker(L.latLng(uni.lat, uni.lng), { icon: uniIcon, zIndexOffset: 800 })
          .addTo(map)
          .bindPopup('<strong>' + uni.nome + '</strong>');
      });

      if (latLngs.length >= 2) {
        L.polyline(latLngs, {
          color: '#4285F4',
          weight: 4,
          opacity: 0.8,
          dashArray: '8, 4',
        }).addTo(map);
        map.fitBounds(L.latLngBounds(latLngs), { padding: [40, 40] });
      } else if (latLngs.length === 1) {
        map.setView(latLngs[0], 15);
      }

      try {
        window.ReactNativeWebView &&
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mapReady' }));
      } catch(e) {}
    })();
  </script>
</body>
</html>
  `;
}

export default function StaticRouteMap({
  pontosRota,
  mostrarUniversidades = true,
}: StaticRouteMapProps) {
  const [loading, setLoading] = useState(true);
  const { universidades } = useUniversidades(mostrarUniversidades);

  const { html, webViewKey } = useMemo(() => {
    const keyParts = (pontosRota || []).map(
      p => `${p.id}-${p.latitude}-${p.longitude}-${p.ordem}`,
    );
    return {
      html: buildStaticRouteHtml(pontosRota || [], universidades),
      webViewKey: [...keyParts, `u:${universidades.length}`].join('|'),
    };
  }, [pontosRota, universidades]);

  return (
    <View style={styles.container}>
      <WebView
        key={webViewKey}
        style={styles.webview}
        originWhitelist={['*']}
        source={{ html, baseUrl: 'https://buska.projeto1.lsd.ufcg.edu.br' }}
        userAgent="BusKa/1.0.0-beta (React Native; OpenStreetMap tile client, contact: contato.buska@gmail.com)"
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        nestedScrollEnabled={false}
        setSupportMultipleWindows={false}
        onMessage={event => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'mapReady') setLoading(false);
          } catch {}
        }}
        androidLayerType="software"
      />
      {loading && (
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
  webview: {
    flex: 1,
    opacity: 0.99,
    backgroundColor: 'transparent',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
  },
});
