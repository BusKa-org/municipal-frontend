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
  usuario?: LatLng | null;
};

export type RouteMapProps = {
  pontosRota: RoutePoint[];
  onPontoChegado?: (ponto: RoutePoint) => void;
  fill?: boolean;
};

export type RoutePolylineResult = {
  coordinates: LatLng[];
  distanceMeters?: number;
  durationSeconds?: number;
};