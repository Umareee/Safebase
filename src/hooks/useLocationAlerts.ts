
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
      // Check if running in a browser environment
      if (typeof window === 'undefined' || typeof window.AudioContext === 'undefined' && typeof (window as any).webkitAudioContext === 'undefined') {
        console.warn("AudioContext not supported. Skipping gunshot sound.");
        return;
      }
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (!audioContext) return; // Should not happen due to above check, but keeps TS happy

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
    // Store the current alert type before potentially changing it
    const previousAlertType = alertState.type;

    if (!location) {
      // If location is lost or unavailable, clear crime alerts. Gunshot alerts are handled separately.
      if (previousAlertType === 'crime') {
        setAlertState({ type: null, message: '' });
      }
      return;
    }

    const isNearDanger = checkProximityToDanger(location);

    if (isNearDanger) {
      // Only set crime alert if not currently showing a gunshot alert (let gunshot take precedence)
      if (previousAlertType !== 'gunshot') {
         setAlertState({
           type: 'crime',
           message: '🚨 Entering a high-risk area. Stay alert!',
         });
      }
    } else {
      // If not near danger and current alert is 'crime', clear it.
      if (previousAlertType === 'crime') {
        setAlertState({ type: null, message: '' });
      }
    }
   // Gunshot alert clearing is handled by the listener or manual location change
  }, [alertState.type, checkProximityToDanger]);


  // Fetch initial GPS location
  useEffect(() => {
    let isMounted = true;
    // Only fetch GPS if no location is set yet and not manually set
    if (!currentLocation && locationSource !== 'manual') {
      setIsLoadingLocation(true);
      setError(null);

      getGeoLocation()
        .then((location) => {
          if (isMounted) {
            setCurrentLocation(location);
            setLocationSource('gps');
            updateAlertForLocation(location); // Check for crime alert on initial GPS fix
            setIsLoadingLocation(false);
          }
        })
        .catch((err) => {
          if (isMounted) {
            console.error("Geolocation error:", err);
            setError(err.message || "Could not retrieve location via GPS.");
            setIsLoadingLocation(false);
             // Clear location-based alerts if GPS fails
            if (alertState.type === 'crime') {
               setAlertState({ type: null, message: '' });
            }
          }
        });
    } else {
       // If location is already set (e.g., manually), don't show loading
       setIsLoadingLocation(false);
       // If manually set, the alert was already handled by manuallySetLocation
    }

    return () => {
      isMounted = false;
    };
  // Run only once on mount, dependencies removed to prevent re-fetching GPS on alert changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Function to manually set location from buttons
  const manuallySetLocation = useCallback((location: DefinedLocation) => {
    setError(null); // Clear errors
    setIsLoadingLocation(false); // Stop loading indicator
    setCurrentLocation(location);
    setLocationSource('manual');

    // Update alert based ONLY on the manually selected location's danger status or proximity
    // Overwrites any existing alert (including gunshot).
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
  }, [checkProximityToDanger]);


  // --- Gunshot Simulation and Listener ---

  const simulateGunshot = useCallback(async () => {
    if (!currentLocation) {
      setError("Cannot simulate gunshot without a location selected.");
      return;
    }
    try {
      setError(null); // Clear previous errors
      playGunshotSound(); // Play sound effect

      // Immediately set the gunshot alert state for instant feedback
      setAlertState({
          type: 'gunshot',
          message: '🔫 Gunshot detected nearby! Take cover!',
      });

      // Record the event in Firestore (listener might update/clear later if needed)
      await addDoc(collection(db, 'gunshotEvents'), {
        // Ensure we only store lat/lng, not the name or isDangerous flag
        location: { lat: currentLocation.lat, lng: currentLocation.lng },
        timestamp: serverTimestamp(),
      });

    } catch (err) {
      console.error("Error simulating gunshot:", err);
      setError("Failed to simulate gunshot event.");
      // Optionally revert the alert state if Firestore write fails
      // For now, we keep the immediate alert shown to the user.
      // updateAlertForLocation(currentLocation); // Revert to location-based alert if needed
    }
  }, [currentLocation]);


  // Listen for the latest gunshot event (primarily for other users or persistence)
  useEffect(() => {
    const q = query(collection(db, 'gunshotEvents'), orderBy('timestamp', 'desc'), limit(1));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const currentAlertType = alertState.type; // Get current alert type *before* potentially changing it

      if (!querySnapshot.empty) {
        const latestEvent = querySnapshot.docs[0].data() as GunshotEvent;
        const eventTimestamp = (latestEvent.timestamp as any)?.toDate()?.getTime();
        const now = Date.now();

        // Adjust the time window as needed (e.g., 60000ms = 1 minute)
        const isRecent = eventTimestamp && now - eventTimestamp < 60000;

        if (isRecent) {
            // Check proximity if a current location is set
            let isNearby = true; // Assume nearby if no location context (shouldn't happen often)
            if (currentLocation) {
                const distance = getDistance(currentLocation, latestEvent.location);
                // Adjust proximity radius for gunshot alerts as needed
                isNearby = distance < 1000; // e.g., 1km
            }

            if (isNearby && currentAlertType !== 'gunshot') {
                 // If a recent, nearby gunshot is detected by the listener and we're *not* already showing one
                 // (e.g., triggered by another user), show the alert.
                 setAlertState({
                    type: 'gunshot',
                    message: '🔫 Gunshot detected nearby! Take cover!',
                 });
            } else if (!isNearby && currentAlertType === 'gunshot') {
                // Gunshot event is recent but NOT nearby, clear gunshot alert if it's currently shown
                 updateAlertForLocation(currentLocation); // Revert to location-based alert
            }
            // If it's recent, nearby, AND already showing gunshot alert, do nothing (avoid flicker)

        } else if (currentAlertType === 'gunshot') {
          // Latest gunshot event is OLD, clear the gunshot alert if active
          updateAlertForLocation(currentLocation); // Revert to location-based alert
        }
      } else if (currentAlertType === 'gunshot') {
        // No gunshot events in the database, clear the gunshot alert if active
        updateAlertForLocation(currentLocation); // Revert to location-based alert
      }
    }, (err) => {
      console.error("Error listening to gunshot events:", err);
      // Don't set error state here to avoid overwriting user-facing errors like geolocation denial
      // setError("Failed to listen for alerts.");
    });

    return () => unsubscribe(); // Cleanup listener on unmount
  // Re-run listener if the current location changes or the way we update alerts changes
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
