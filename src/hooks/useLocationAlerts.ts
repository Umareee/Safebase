
"use client";

import { useState, useEffect, useCallback } from 'react';
import { collection, addDoc, serverTimestamp, onSnapshot, query, limit, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getCurrentLocation as getGeoLocation } from '@/services/geolocation';
import { getDistance } from '@/lib/locationUtils';
import type { Location, GunshotEvent, AlertState } from '@/types';
import { PREDEFINED_LOCATIONS, DANGER_CHECK_RADIUS, type DefinedLocation } from '@/config/locations';

// Simple browser audio synthesis for gunshot sound
const playGunshotSound = () => {
  try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (!audioContext) return; // AudioContext not supported

      // Create a burst of white noise
      const bufferSize = audioContext.sampleRate * 0.1; // 0.1 second duration
      const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
      const output = buffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
          output[i] = Math.random() * 2 - 1; // White noise
      }

      const noiseSource = audioContext.createBufferSource();
      noiseSource.buffer = buffer;

      // Add a gain node for volume control and decay
      const gainNode = audioContext.createGain();
      gainNode.gain.setValueAtTime(1, audioContext.currentTime);
      // Quick decay
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.08);

      noiseSource.connect(gainNode);
      gainNode.connect(audioContext.destination);
      noiseSource.start();
      noiseSource.stop(audioContext.currentTime + 0.1); // Stop after duration
  } catch (e) {
      console.error("Failed to play gunshot sound:", e);
  }
};


/**
 * Custom hook to manage user location, crime area checks, and gunshot alerts.
 * @returns An object containing the current alert state, functions for interaction,
 *          loading status, error state, and current location info.
 */
export function useLocationAlerts() {
  const [currentLocation, setCurrentLocation] = useState<DefinedLocation | Location | null>(null);
  const [locationSource, setLocationSource] = useState<'gps' | 'manual' | null>(null);
  const [alertState, setAlertState] = useState<AlertState>({ type: null, message: '' });
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Location Handling ---

  // Checks if the given location is within the radius of any predefined dangerous location
  const checkProximityToDanger = useCallback((location: Location): boolean => {
    for (const dangerousSpot of PREDEFINED_LOCATIONS.filter(l => l.isDangerous)) {
      const distance = getDistance(location, dangerousSpot);
      if (distance <= DANGER_CHECK_RADIUS) {
        return true;
      }
    }
    return false;
  }, []);

  // Sets the alert based on proximity check
  const updateAlertForLocation = useCallback((location: Location | null) => {
    if (!location) {
      // If location is lost or unavailable, clear crime alerts. Gunshot alerts are handled by the listener.
      if (alertState.type === 'crime') {
        setAlertState({ type: null, message: '' });
      }
      return;
    }

    const isNearDanger = checkProximityToDanger(location);

    if (isNearDanger) {
      // Only set crime alert if not currently showing a gunshot alert
      if (alertState.type !== 'gunshot') {
         setAlertState({
           type: 'crime',
           message: '🚨 Entering a high-risk area. Stay alert!',
         });
      }
    } else {
      // If not near danger and current alert is 'crime', clear it.
      if (alertState.type === 'crime') {
        setAlertState({ type: null, message: '' });
      }
    }
  }, [alertState.type, checkProximityToDanger]);


  // Fetch initial GPS location
  useEffect(() => {
    let isMounted = true;
    // Only fetch GPS if no location is set yet
    if (!currentLocation && locationSource !== 'manual') {
      setIsLoadingLocation(true);
      setError(null);

      getGeoLocation()
        .then((location) => {
          if (isMounted) {
            setCurrentLocation(location);
            setLocationSource('gps');
            updateAlertForLocation(location);
            setIsLoadingLocation(false);
          }
        })
        .catch((err) => {
          if (isMounted) {
            console.error("Geolocation error:", err);
            setError(err.message || "Could not retrieve location via GPS.");
            setIsLoadingLocation(false);
             // Keep alert state as is, or clear it? Let's clear location-based alerts.
            if (alertState.type === 'crime') {
               setAlertState({ type: null, message: '' });
            }
          }
        });
    } else {
       // If location is already set (e.g., manually), don't show loading
       setIsLoadingLocation(false);
    }

    return () => {
      isMounted = false;
    };
  // Run only once on mount or if dependencies for location fetching change (which they don't here)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Removed dependencies to prevent re-fetching GPS on alert changes

  // Function to manually set location from buttons
  const manuallySetLocation = useCallback((location: DefinedLocation) => {
    setError(null); // Clear errors
    setIsLoadingLocation(false); // Stop loading indicator
    setCurrentLocation(location);
    setLocationSource('manual');
    // Clear gunshot alert immediately when changing location manually
    if (alertState.type === 'gunshot') {
       setAlertState({type: null, message: ''});
    }
    // Update alert based on the manually selected location's danger status *and* proximity check
    if (location.isDangerous) {
        setAlertState({
            type: 'crime',
            message: `🚨 Selected location "${location.name}" is a high-risk area. Stay alert!`,
        });
    } else if (checkProximityToDanger(location)) {
         setAlertState({
           type: 'crime',
           message: `🚨 Selected location "${location.name}" is near a high-risk area. Stay alert!`,
         });
    }
     else {
        setAlertState({ type: null, message: '' }); // Safe location selected
    }
  }, [alertState.type, checkProximityToDanger]);


  // --- Gunshot Simulation and Listener ---

  const simulateGunshot = useCallback(async () => {
    if (!currentLocation) {
      setError("Cannot simulate gunshot without a location selected.");
      return;
    }
    try {
      setError(null); // Clear previous errors
      playGunshotSound(); // Play sound effect
      await addDoc(collection(db, 'gunshotEvents'), {
        // Ensure we only store lat/lng, not the name or isDangerous flag
        location: { lat: currentLocation.lat, lng: currentLocation.lng },
        timestamp: serverTimestamp(),
      });
      // Listener below will set the alert
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
        const eventTimestamp = (latestEvent.timestamp as any)?.toDate()?.getTime();
        const now = Date.now();

        // Adjust the time window as needed (e.g., 60000ms = 1 minute)
        if (eventTimestamp && now - eventTimestamp < 60000) {
            // Check proximity if a current location is set
            let isNearby = true; // Assume nearby if no location context
            if (currentLocation) {
                const distance = getDistance(currentLocation, latestEvent.location);
                // Adjust proximity radius for gunshot alerts as needed
                isNearby = distance < 1000; // e.g., 1km
            }

            if (isNearby) {
                 setAlertState({
                    type: 'gunshot',
                    message: '🔫 Gunshot detected nearby! Take cover!',
                 });
            } else if (alertState.type === 'gunshot') {
                // Gunshot event is recent but not nearby, clear gunshot alert
                 updateAlertForLocation(currentLocation); // Revert to location-based alert
            }

        } else if (alertState.type === 'gunshot') {
          // Latest gunshot event is old, clear the gunshot alert
          updateAlertForLocation(currentLocation); // Revert to location-based alert
        }
      } else if (alertState.type === 'gunshot') {
        // No gunshot events in the database, clear the gunshot alert if active
        updateAlertForLocation(currentLocation); // Revert to location-based alert
      }
    }, (err) => {
      console.error("Error listening to gunshot events:", err);
      setError("Failed to listen for alerts.");
      // If listener fails, potentially clear alerts? Or keep existing state?
      // Let's keep the state for now, but log the error.
    });

    return () => unsubscribe(); // Cleanup listener on unmount
  // Re-run listener if the current location changes, or the way we update alerts changes
  }, [currentLocation, alertState.type, updateAlertForLocation]);

  const selectedLocationName = (currentLocation && 'name' in currentLocation) ? currentLocation.name : null;

  return {
      alertState,
      simulateGunshot,
      isLoading: isLoadingLocation,
      error,
      currentLocation,
      manuallySetLocation,
      selectedLocationName,
      predefinedLocations: PREDEFINED_LOCATIONS
    };
}
