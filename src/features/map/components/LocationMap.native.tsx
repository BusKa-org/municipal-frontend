// src/features/map/components/LocationMap.native.tsx
import React, { useEffect, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';

import type { LocationMapProps } from '../types';
import { useLeafletWebViewBridge } from '../hooks/useLeafletWebViewBridge';
import { normalizeRoutePoints, pointToLatLng } from '../utils/points';

export default function LocationMap({ pontosRota, usuario }: LocationMapProps) {
  const pontosValidos = useMemo(() => normalizeRoutePoints(pontosRota), [pontosRota]);
  const destinoAtual = pontosValidos[0] ?? null;

  const {
    webViewRef,
    html,
    mapReady,
    mapError,
    loadingMap,
    handleMessage,
    reloadMap,
    setDestination,
    clearDestination,
    setUserMarker,
    clearUserMarker,
    fitToCoordinates,
    reloadKey,
  } = useLeafletWebViewBridge();

  useEffect(() => {
    if (!mapReady) return;

    if (!destinoAtual) {
      clearDestination();
      return;
    }

    setDestination(pointToLatLng(destinoAtual));
  }, [mapReady, destinoAtual, clearDestination, setDestination]);

  useEffect(() => {
    if (!mapReady) return;

    if (!usuario) {
      clearUserMarker();
      return;
    }

    setUserMarker(usuario);
  }, [mapReady, usuario, setUserMarker, clearUserMarker]);

  useEffect(() => {
    if (!mapReady) return;

    const alvos = [
      ...pontosValidos.map(pointToLatLng),
      ...(usuario ? [usuario] : []),
    ];

    if (alvos.length === 0) return;
    fitToCoordinates(alvos);
  }, [mapReady, pontosValidos, usuario, fitToCoordinates]);

  return (
    <View style={styles.container}>
      <WebView
        key={reloadKey}
        ref={webViewRef}
        style={[styles.webview, mapError && styles.hidden]}
        originWhitelist={['*']}
        source={{ html }}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        nestedScrollEnabled={false}
        setSupportMultipleWindows={false}
        onMessage={handleMessage}
        androidLayerType="software"
      />

      {loadingMap && !mapError && (
        <View pointerEvents="none" style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color="#00B4D8" />
        </View>
      )}

      {mapError && (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorIcon}>🗺️</Text>
          <Text style={styles.errorTitle}>Mapa indisponível</Text>
          <Text style={styles.errorSubtitle}>Verifique sua conexão com a internet</Text>
          <TouchableOpacity style={styles.reloadButton} onPress={reloadMap}>
            <Text style={styles.reloadText}>Tentar novamente</Text>
          </TouchableOpacity>
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
  webview: {
    flex: 1,
    opacity: 0.99,
    backgroundColor: 'transparent',
  },
  hidden: {
    opacity: 0,
    height: 0,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    padding: 24,
  },
  errorIcon: { fontSize: 40, marginBottom: 8 },
  errorTitle: { fontSize: 15, fontWeight: '600', color: '#334155', marginBottom: 4 },
  errorSubtitle: { fontSize: 13, color: '#64748B', textAlign: 'center', marginBottom: 16 },
  reloadButton: {
    backgroundColor: '#00B4D8',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  reloadText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});