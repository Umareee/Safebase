
import type { Location } from '@/types';

export interface DefinedLocation extends Location {
  name: string;
  isDangerous: boolean;
}

export const PREDEFINED_LOCATIONS: DefinedLocation[] = [
  { name: 'Safe Park', lat: 34.0522, lng: -118.2437, isDangerous: false }, // Example Safe Location (Downtown LA approximation)
  { name: 'Downtown Crossing', lat: 34.0550, lng: -118.2450, isDangerous: true }, // Example Dangerous Location 1
  { name: 'Skid Row Adjacent', lat: 34.0400, lng: -118.2500, isDangerous: true }, // Example Dangerous Location 2
  { name: 'Library Square', lat: 34.0500, lng: -118.2550, isDangerous: false }, // Example Safe Location
];

// Radius for checking proximity to dangerous locations when manually selected or geolocated.
export const DANGER_CHECK_RADIUS = 500; // meters
