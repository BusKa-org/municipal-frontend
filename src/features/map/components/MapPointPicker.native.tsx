import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { TILE_ATTRIBUTION, TILE_MAX_ZOOM, TILE_URL } from '../utils/tiles';

export interface PickerLatLng {
  latitude: number;
  longitude: number;
}

interface MapPointPickerProps {
  initialLocation?: PickerLatLng;
  onLocationChange?: (location: PickerLatLng) => void;
}

function buildPickerHtml(initial?: PickerLatLng): string {
  const lat = initial?.latitude ?? -15.78;
  const lng = initial?.longitude ?? -47.93;
  const zoom = initial ? 16 : 5;

  return `<!doctype html>
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
    #hint {
      position: absolute;
      bottom: 36px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0,0,0,0.62);
      color: #fff;
      padding: 5px 14px;
      border-radius: 20px;
      font-size: 12px;
      font-family: sans-serif;
      z-index: 1000;
      white-space: nowrap;
      pointer-events: none;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <div id="hint">Toque no mapa ou arraste o pino para ajustar</div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    (function() {
      if (typeof L === 'undefined') return;

      var map = L.map('map', { zoomControl: true }).setView([${lat}, ${lng}], ${zoom});

      L.tileLayer('${TILE_URL}', {
        attribution: '${TILE_ATTRIBUTION}',
        maxZoom: ${TILE_MAX_ZOOM},
      }).addTo(map);

      var pinHtml = [
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

      var icon = L.divIcon({
        className: 'custom-pin',
        html: pinHtml,
        iconSize: [34, 50],
        iconAnchor: [17, 50],
        popupAnchor: [0, -52],
      });

      var marker = L.marker([${lat}, ${lng}], { icon: icon, draggable: true }).addTo(map);

      function notify(lat, lng) {
        try {
          window.ReactNativeWebView &&
            window.ReactNativeWebView.postMessage(
              JSON.stringify({ type: 'locationChanged', latitude: lat, longitude: lng })
            );
        } catch(e) {}
      }

      marker.on('dragend', function(e) {
        var pos = e.target.getLatLng();
        notify(pos.lat, pos.lng);
      });

      map.on('click', function(e) {
        marker.setLatLng(e.latlng);
        notify(e.latlng.lat, e.latlng.lng);
      });

      window.setMarkerPosition = function(lat, lng) {
        var ll = L.latLng(lat, lng);
        marker.setLatLng(ll);
        map.setView(ll, 16, { animate: true });
      };

      try {
        window.ReactNativeWebView &&
          window.ReactNativeWebView.postMessage(
            JSON.stringify({ type: 'mapReady', latitude: ${lat}, longitude: ${lng} })
          );
      } catch(e) {}
    })();
  </script>
</body>
</html>`;
}

export default function MapPointPicker({ initialLocation, onLocationChange }: MapPointPickerProps) {
  const [loading, setLoading] = useState(true);
  const webViewRef = useRef<any>(null);
  const prevLocationRef = useRef<PickerLatLng | undefined>(initialLocation);

  const html = useMemo(() => buildPickerHtml(initialLocation), []);

  useEffect(() => {
    if (!initialLocation || !webViewRef.current) return;
    const prev = prevLocationRef.current;
    if (
      prev?.latitude === initialLocation.latitude &&
      prev?.longitude === initialLocation.longitude
    ) {
      return;
    }
    prevLocationRef.current = initialLocation;
    webViewRef.current.injectJavaScript(
      `window.setMarkerPosition(${initialLocation.latitude}, ${initialLocation.longitude}); true;`,
    );
  }, [initialLocation]);

  const handleMessage = useCallback(
    (event: any) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === 'mapReady') {
          setLoading(false);
        } else if (data.type === 'locationChanged') {
          onLocationChange?.({ latitude: data.latitude, longitude: data.longitude });
        }
      } catch {}
    },
    [onLocationChange],
  );

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        style={styles.webview}
        originWhitelist={['*']}
        source={{ html, baseUrl: 'https://buska.projeto1.lsd.ufcg.edu.br' }}
        userAgent="BusKa/1.0.0-beta (React Native; OpenStreetMap tile client, contact: contato.buska@gmail.com)"
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        nestedScrollEnabled={false}
        setSupportMultipleWindows={false}
        onMessage={handleMessage}
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
    height: 240,
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
