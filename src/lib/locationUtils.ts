import type { Location } from '@/types';

/**
 * Calculates the distance between two points on Earth using the Haversine formula.
 * @param loc1 - The first location { lat: number, lng: number }.
 * @param loc2 - The second location { lat: number, lng: number }.
 * @returns The distance in meters.
 */
export function getDistance(loc1: Location, loc2: Location): number {
  const R = 6371e3; // Earth's radius in meters
  const phi1 = (loc1.lat * Math.PI) / 180; // φ, λ in radians
  const phi2 = (loc2.lat * Math.PI) / 180;
  const deltaPhi = ((loc2.lat - loc1.lat) * Math.PI) / 180;
  const deltaLambda = ((loc2.lng - loc1.lng) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(deltaLambda / 2) *
      Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = R * c; // in meters
  return distance;
}
