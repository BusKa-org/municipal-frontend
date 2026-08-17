// src/components/map/RouteMap.native.tsx
import React, { useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';

import type { RouteMapProps } from '../types';
import { useLocationPermission } from '../hooks/useLocationPermissionWrapper';
import { useCurrentLocation } from '../hooks/useCurrentLocation';
import { useArrivalDetection } from '../hooks/useArrivalDetection';
import { useRoutePolyline } from '../hooks/useRoutePolyline';
import { useLeafletWebViewBridge } from '../hooks/useLeafletWebViewBridge';
import { normalizeRoutePoints, pointToLatLng } from '../utils/points';

export default function RouteMap({ pontosRota, onPontoChegado, fill }: RouteMapProps) {
  const hasFittedRef = useRef(false);

  const pontosValidos = useMemo(() => normalizeRoutePoints(pontosRota), [pontosRota]);
  const destinoAtual = pontosValidos[0] ?? null;
  const destinationLatLng = useMemo(
    () => (destinoAtual ? pointToLatLng(destinoAtual) : null),
    [destinoAtual?.id, destinoAtual?.latitude, destinoAtual?.longitude]
  );

  const {
    granted: locationGranted,
    loading: permissionLoading,
    error: permissionError,
    requestPermission,
  } = useLocationPermission();

  const {
    location: userLocation,
    loading: locationLoading,
    error: locationError,
    reset: resetLocation,
  } = useCurrentLocation({
    enabled: locationGranted && !!destinoAtual,
  });

  const {
    coordinates: routeCoordinates,
    loading: routeLoading,
    error: routeError,
    reset: resetRoute,
  } = useRoutePolyline({
    origin: userLocation,
    destination: destinationLatLng,
    enabled: !!userLocation && !!destinationLatLng,
    minRefetchDistanceMeters: 20,
  });

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
    setRoute,
    clearRoute,
    fitToCoordinates,
    reloadKey,
  } = useLeafletWebViewBridge();

  useArrivalDetection({
    userLocation,
    destination: destinoAtual,
    thresholdMeters: 50,
    onArrive: (point) => {
      resetRoute();
      resetLocation();
      clearRoute();

      if (onPontoChegado) {
        onPontoChegado(point);
      }
    },
  });

  useEffect(() => {
    requestPermission();
  }, [requestPermission]);

  useEffect(() => {
    if (permissionError) {
      Alert.alert(
        'Permissão negada',
        'Sem acesso à localização, não é possível mostrar a rota.'
      );
    }
  }, [permissionError]);

  useEffect(() => {
    if (!mapReady) return;

    if (!destinoAtual) {
      clearDestination();
      clearUserMarker();
      clearRoute();
      hasFittedRef.current = false;
      return;
    }

    setDestination(pointToLatLng(destinoAtual));
  }, [
    mapReady,
    destinoAtual,
    clearDestination,
    clearUserMarker,
    clearRoute,
    setDestination,
  ]);

  useEffect(() => {
    if (!mapReady) return;

    if (!userLocation) {
      clearUserMarker();
      return;
    }

    setUserMarker(userLocation);
  }, [mapReady, userLocation, clearUserMarker, setUserMarker]);

  useEffect(() => {
    if (!mapReady) return;

    if (routeCoordinates.length < 2) {
      clearRoute();
      return;
    }

    setRoute(routeCoordinates);
  }, [mapReady, routeCoordinates, clearRoute, setRoute]);

  useEffect(() => {
    if (!mapReady || !userLocation || !destinationLatLng) return;

    if (!hasFittedRef.current) {
      const coords = [userLocation, destinationLatLng, ...routeCoordinates];
      fitToCoordinates(coords);
      hasFittedRef.current = true;
    }
  }, [mapReady, userLocation, destinationLatLng, routeCoordinates, fitToCoordinates]);

  useEffect(() => {
    hasFittedRef.current = false;
  }, [destinoAtual?.id]);

  const overlayError =
    mapError
      ? 'Verifique sua conexão com a internet'
      : permissionError || locationError || routeError;

  const overlayLoading = loadingMap || permissionLoading || locationLoading || routeLoading;

  const handleRetry = async () => {
    reloadMap();
    resetRoute();
    resetLocation();
    hasFittedRef.current = false;
    await requestPermission();
  };

  return (
    <View style={[styles.container, fill && styles.fill]}>
      <WebView
        key={reloadKey}
        ref={webViewRef}
        style={[styles.webview, mapError && styles.hidden]}
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

      {overlayLoading && !overlayError && (
        <View pointerEvents="none" style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color="#00B4D8" />
        </View>
      )}

      {!!overlayError && (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorIcon}>🗺️</Text>
          <Text style={styles.errorTitle}>Mapa indisponível</Text>
          <Text style={styles.errorSubtitle}>{overlayError}</Text>
          <TouchableOpacity style={styles.reloadButton} onPress={handleRetry}>
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
  fill: {
    flex: 1,
    height: undefined,
    borderRadius: 0,
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