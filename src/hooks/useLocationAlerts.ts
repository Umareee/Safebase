"use client";

import { useState, useEffect, useCallback } from 'react';
import { collection, addDoc, serverTimestamp, onSnapshot, query, limit, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getCurrentLocation } from '@/services/geolocation';
import { getDistance } from '@/lib/locationUtils';
import type { Location, CrimeHotspot, GunshotEvent, AlertState, AlertType } from '@/types';

// Define crime hotspots (replace with Firestore fetch if needed)
const CRIME_HOTSPOTS: CrimeHotspot[] = [
  { lat: 34.0550, lng: -118.2450, radius: 500 }, // Example hotspot 1
  { lat: 34.0400, lng: -118.2500, radius: 500 }, // Example hotspot 2
];

const DANGER_RADIUS = 500; // Default radius in meters if not specified per hotspot

/**
 * Custom hook to manage user location, crime area checks, and gunshot alerts.
 * @returns An object containing the current alert state, a function to simulate gunshots,
 *          loading status, and error state.
 */
export function useLocationAlerts() {
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [alertState, setAlertState] = useState<AlertState>({ type: null, message: '' });
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Location Fetching and Crime Area Check ---

  const checkCrimeHotspots = useCallback((location: Location) => {
    for (const hotspot of CRIME_HOTSPOTS) {
      const distance = getDistance(location, hotspot);
      if (distance <= (hotspot.radius || DANGER_RADIUS)) {
        setAlertState({
          type: 'crime',
          message: '🚨 You are currently in a high-crime area. Stay alert!',
        });
        return true; // Found a hotspot, no need to check others or reset alert
      }
    }
    // If no crime hotspot detected and current alert is 'crime', reset it.
    // Don't reset if the alert is 'gunshot'.
    if (alertState.type === 'crime') {
      setAlertState({ type: null, message: '' });
    }
    return false;
  }, [alertState.type]); // Depend on alertState.type to avoid unnecessary resets

  useEffect(() => {
    let isMounted = true;
    setIsLoadingLocation(true);
    setError(null);

    getCurrentLocation()
      .then((location) => {
        if (isMounted) {
          setCurrentLocation(location);
          checkCrimeHotspots(location); // Initial check
          setIsLoadingLocation(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error("Geolocation error:", err);
          setError(err.message || "Could not retrieve location.");
          setIsLoadingLocation(false);
        }
      });

    // Optional: Set up interval polling if continuous location tracking is desired
    // const intervalId = setInterval(() => {
    //   getCurrentLocation()
    //     .then((location) => {
    //       if (isMounted) {
    //         setCurrentLocation(location);
    //         if (alertState.type !== 'gunshot') { // Only check crime if not showing gunshot alert
    //           checkCrimeHotspots(location);
    //         }
    //       }
    //     })
    //     .catch((err) => console.error("Periodic location error:", err));
    // }, 60000); // Check every 60 seconds

    return () => {
      isMounted = false;
      // clearInterval(intervalId); // Clear interval on unmount
    };
  }, [checkCrimeHotspots]); // Re-run if checkCrimeHotspots changes (due to alertState.type dependency)


  // --- Gunshot Simulation and Listener ---

  const simulateGunshot = useCallback(async () => {
    if (!currentLocation) {
      setError("Cannot simulate gunshot without current location.");
      // Optionally trigger location fetch again here
      return;
    }
    try {
      setError(null); // Clear previous errors
      await addDoc(collection(db, 'gunshotEvents'), {
        location: currentLocation,
        timestamp: serverTimestamp(), // Use server timestamp for consistency
      });
      // The listener below will pick this up and update the alert
    } catch (err) {
      console.error("Error simulating gunshot:", err);
      setError("Failed to simulate gunshot event.");
    }
  }, [currentLocation]);

  // Listen for the latest gunshot event
  useEffect(() => {
    const q = query(collection(db, 'gunshotEvents'), orderBy('timestamp', 'desc'), limit(1));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      if (!querySnapshot.empty) {
        const latestEvent = querySnapshot.docs[0].data() as GunshotEvent;
        // Optional: Add logic to check if the event is recent enough or close enough
        // For now, any new event triggers the alert
         // Check if event is recent (e.g., within the last minute)
        const eventTimestamp = (latestEvent.timestamp as any)?.toDate()?.getTime(); // Handle Firestore Timestamp
        const now = Date.now();

        // Adjust the time window as needed (e.g., 60000ms = 1 minute)
        if (eventTimestamp && now - eventTimestamp < 60000) {
          // Optional: Check distance if needed
          // const distance = currentLocation ? getDistance(currentLocation, latestEvent.location) : Infinity;
          // if (distance < SOME_THRESHOLD) { ... }

          setAlertState({
            type: 'gunshot',
            message: '🔫 Gunshot detected nearby! Take cover!',
          });
        } else if (alertState.type === 'gunshot') {
           // If the latest gunshot event is old and we are showing a gunshot alert,
           // revert to checking crime hotspots or clear the alert.
           if (currentLocation) {
              checkCrimeHotspots(currentLocation);
           } else {
              setAlertState({ type: null, message: '' });
           }
        }
      } else if (alertState.type === 'gunshot') {
         // No gunshot events, clear the gunshot alert if active
          if (currentLocation) {
              checkCrimeHotspots(currentLocation);
           } else {
              setAlertState({ type: null, message: '' });
           }
      }
    }, (err) => {
      console.error("Error listening to gunshot events:", err);
      setError("Failed to listen for alerts.");
    });

    return () => unsubscribe(); // Cleanup listener on unmount
  }, [alertState.type, currentLocation, checkCrimeHotspots]); // Re-subscribe if alert type or location changes

  return { alertState, simulateGunshot, isLoading: isLoadingLocation, error };
}
