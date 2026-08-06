import { api } from '../../../api/client';
import type { LatLng, RoutePolylineResult } from '../types';

type RouteApiResponse = {
  coordinates: LatLng[];
  distance_meters: number | null;
  duration_seconds: number | null;
};

export async function fetchRoutePolyline(
  origin: LatLng,
  destination: LatLng,
): Promise<RoutePolylineResult> {
  const { data } = await api.get<RouteApiResponse>('/routing/route', {
    params: {
      origin_lat: origin.latitude,
      origin_lng: origin.longitude,
      dest_lat: destination.latitude,
      dest_lng: destination.longitude,
    },
  });

  return {
    coordinates: data.coordinates,
    distanceMeters: data.distance_meters ?? undefined,
    durationSeconds: data.duration_seconds ?? undefined,
  };
}
export async function fetchMultiSegmentRoute(
  points: LatLng[],
): Promise<RoutePolylineResult> {
  if (points.length < 2) {
    return { coordinates: [] };
  }

  const segments: Array<[LatLng, LatLng]> = [];
  for (let i = 0; i < points.length - 1; i++) {
    segments.push([points[i], points[i + 1]]);
  }

  const results = await Promise.all(
    segments.map(([origin, destination]) =>
      fetchRoutePolyline(origin, destination),
    ),
  );

  const coordinates: LatLng[] = [];
  let totalDistance = 0;
  let totalDuration = 0;
  let hasDistance = false;
  let hasDuration = false;

  results.forEach((segment, i) => {
    const segCoords = segment.coordinates ?? [];
    if (i === 0) {
      coordinates.push(...segCoords);
    } else {
      coordinates.push(...segCoords.slice(1));
    }
    if (typeof segment.distanceMeters === 'number') {
      totalDistance += segment.distanceMeters;
      hasDistance = true;
    }
    if (typeof segment.durationSeconds === 'number') {
      totalDuration += segment.durationSeconds;
      hasDuration = true;
    }
  });

  return {
    coordinates,
    distanceMeters: hasDistance ? totalDistance : undefined,
    durationSeconds: hasDuration ? totalDuration : undefined,
  };
}