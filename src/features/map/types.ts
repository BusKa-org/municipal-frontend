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
  /** Paradas da rota, desenhadas como círculos numerados. */
  pontosRota: RoutePoint[];
  /** Onde o ônibus está agora. */
  posicaoOnibus?: LatLng | null;
  /** Qual parada é a próxima, para destacar no mapa. */
  proximaParadaId?: string | null;
  posicaoAluno?: LatLng | null;
  /** Faixas da interface que ficam por cima do mapa, para os controles do
   *  Leaflet não sumirem embaixo do cabeçalho nem do painel. */
  margemSuperior?: number;
  margemInferior?: number;
};

export type RouteMapProps = {
  pontosRota: RoutePoint[];
  onPontoChegado?: (ponto: RoutePoint) => void;
};

export type RoutePolylineResult = {
  coordinates: LatLng[];
  distanceMeters?: number;
  durationSeconds?: number;
};