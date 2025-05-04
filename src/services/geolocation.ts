import type { Location } from '@/types';

/**
 * Asynchronously retrieves the current location of the user using the browser's Geolocation API.
 *
 * @returns A promise that resolves to a Location object containing latitude and longitude.
 * @throws An error if geolocation is not supported or the user denies permission.
 */
export function getCurrentLocation(): Promise<Location> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      return reject(new Error("Geolocation is not supported by your browser."));
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        let errorMessage = "Failed to retrieve location.";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "User denied the request for Geolocation.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Location information is unavailable.";
            break;
          case error.TIMEOUT:
            errorMessage = "The request to get user location timed out.";
            break;
          default: // error.UNKNOWN_ERROR is deprecated but handle it just in case
            errorMessage = "An unknown error occurred while retrieving location.";
            break;
        }
        reject(new Error(errorMessage));
      },
       {
         enableHighAccuracy: true, // Request high accuracy if possible
         timeout: 10000, // Set a timeout of 10 seconds
         maximumAge: 0 // Force a fresh location retrieval
       }
    );
  });
}
