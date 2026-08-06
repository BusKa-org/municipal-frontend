import type { StyleProp, ViewStyle } from 'react-native';
import type { PontoFlatResponse } from '../../types';

export type RoutePoint = PontoFlatResponse;

export type LatLng = {
  latitude: number;
  longitude: number;
};

export type NormalizedRoutePoint = RoutePoint & {
  latitude: number;
  longitude: number;
};

export type LocationMapProps = {
  pontosRota: RoutePoint[];
  style?: StyleProp<ViewStyle>;
};

export type RouteMapProps = {
  pontosRota: RoutePoint[];
  onPontoChegado?: (ponto: RoutePoint) => void;
  style?: StyleProp<ViewStyle>;
};

export type RoutePolylineResult = {
  coordinates: LatLng[];
  distanceMeters?: number;
  durationSeconds?: number;
};