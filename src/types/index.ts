
import type { Timestamp } from 'firebase/firestore'; // Import Timestamp

/**
 * Represents a geographical location with latitude and longitude coordinates.
 */
export interface Location {
  lat: number;
  lng: number;
}

/**
 * Represents a high-crime area with coordinates and a danger radius.
 * Note: This is now primarily managed in `src/config/locations.ts`.
 * This interface remains for potential future use or if fetching from DB.
 */
export interface CrimeHotspot extends Location {
  radius: number; // Danger radius in meters
}

/**
 * Represents a simulated gunshot event recorded in Firestore.
 */
export interface GunshotEvent {
  location: Location;
  /** Firestore server timestamp or null if pending write */
  timestamp: Timestamp | null;
}

/**
 * Represents the possible types of alerts.
 */
export type AlertType = 'crime' | 'gunshot' | null;

/**
 * Represents the state of the alert bar.
 */
export interface AlertState {
  type: AlertType;
  message: string;
}

// You might also want a type for the combined location data used internally:
// import type { DefinedLocation } from '@/config/locations';
// export type CurrentContextLocation = Location | DefinedLocation | null;
