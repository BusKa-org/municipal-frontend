import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';

import { MAP_STYLE_JSON } from '../utils/mapStyle';

MapLibreGL.setAccessToken(null);

export interface PickerLatLng {
  latitude: number;
  longitude: number;
}

interface MapPointPickerProps {
  initialLocation?: PickerLatLng;
  onLocationChange?: (location: PickerLatLng) => void;
}

const FALLBACK: PickerLatLng = { latitude: -15.78, longitude: -47.93 };

type MapLibrePressEvent = {
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
};

export default function MapPointPicker({
  initialLocation,
  onLocationChange,
}: MapPointPickerProps) {
  const cameraRef = useRef<MapLibreGL.Camera | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [position, setPosition] = useState<PickerLatLng>(
    initialLocation ?? FALLBACK,
  );

  // Sincroniza posição interna quando a prop muda externamente
  useEffect(() => {
    if (!initialLocation) return;
    if (
      initialLocation.latitude === position.latitude &&
      initialLocation.longitude === position.longitude
    ) {
      return;
    }
    setPosition(initialLocation);
    if (mapReady && cameraRef.current) {
      cameraRef.current.setCamera({
        centerCoordinate: [initialLocation.longitude, initialLocation.latitude],
        zoomLevel: 16,
        animationDuration: 400,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLocation?.latitude, initialLocation?.longitude]);

  const handleMapReady = useCallback(() => {
    setMapReady(true);
  }, []);

  const updatePosition = useCallback(
    (loc: PickerLatLng) => {
      setPosition(loc);
      onLocationChange?.(loc);
    },
    [onLocationChange],
  );

  const handlePress = useCallback(
    (event: MapLibrePressEvent) => {
      const [longitude, latitude] = event.geometry.coordinates;
      updatePosition({ latitude, longitude });
    },
    [updatePosition],
  );

  const handleDragEnd = useCallback(
    (event: MapLibrePressEvent) => {
      const [longitude, latitude] = event.geometry.coordinates;
      updatePosition({ latitude, longitude });
    },
    [updatePosition],
  );

  return (
    <View style={styles.container}>
      <MapLibreGL.MapView
        style={styles.map}
        mapStyle={MAP_STYLE_JSON}
        attributionEnabled
        logoEnabled={false}
        compassEnabled={false}
        onDidFinishLoadingMap={handleMapReady}
        onPress={handlePress as unknown as (e: any) => void}
      >
        <MapLibreGL.Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: [
              initialLocation?.longitude ?? FALLBACK.longitude,
              initialLocation?.latitude ?? FALLBACK.latitude,
            ],
            zoomLevel: initialLocation ? 16 : 4,
          }}
        />

        <MapLibreGL.PointAnnotation
          id="picker-pin"
          coordinate={[position.longitude, position.latitude]}
          draggable
          onDragEnd={handleDragEnd as unknown as (e: any) => void}
        >
          <View style={styles.pinWrapper}>
            <View style={styles.pinHead}>
              <Text style={styles.pinIcon}>📍</Text>
            </View>
            <View style={styles.pinTail} />
          </View>
        </MapLibreGL.PointAnnotation>
      </MapLibreGL.MapView>

      <View pointerEvents="none" style={styles.hint}>
        <Text style={styles.hintText}>Toque no mapa ou arraste o pino para ajustar</Text>
      </View>

      {!mapReady && (
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
  map: {
    flex: 1,
  },
  pinWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinHead: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#4285F4',
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  pinIcon: {
    fontSize: 18,
    lineHeight: 20,
  },
  pinTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#4285F4',
    marginTop: -2,
  },
  hint: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  hintText: {
    backgroundColor: 'rgba(0,0,0,0.62)',
    color: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    fontSize: 12,
    overflow: 'hidden',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
  },
});
