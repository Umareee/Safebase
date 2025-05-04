/**
 * Represents a geographical location with latitude and longitude coordinates.
 */
export interface Location {
  lat: number;
  lng: number;
}

/**
 * Represents a high-crime area with coordinates and a danger radius.
 */
export interface CrimeHotspot extends Location {
  radius: number; // Danger radius in meters
}

/**
 * Represents a simulated gunshot event with location and timestamp.
 */
export interface GunshotEvent {
  location: Location;
  timestamp: number; // Unix timestamp
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
