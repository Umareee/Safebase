
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
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
 *          loading status, error state, current location info, and side notification visibility.
 */
export function useLocationAlerts() {
  const [currentLocation, setCurrentLocation] = useState<DefinedLocation | Location | null>(null);
  const [locationSource, setLocationSource] = useState<'gps' | 'manual' | null>(null);
  const [alertState, setAlertState] = useState<AlertState>({ type: null, message: '' });
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSideNotification, setShowSideNotification] = useState(false); // State for side notification
  const isGunshotAlertActive = useRef(false); // Ref to track if gunshot alert is explicitly active
  const sideNotificationTimer = useRef<NodeJS.Timeout | null>(null); // Timer for side notification


  // --- Location Handling ---

  // Checks if the given location is within the radius of any predefined dangerous location
  const checkProximityToDanger = useCallback((location: Location): { isNear: boolean; name?: string } => {
    for (const dangerousSpot of PREDEFINED_LOCATIONS.filter(l => l.isDangerous)) {
      const distance = getDistance(location, dangerousSpot);
      if (distance <= DANGER_CHECK_RADIUS) {
        return { isNear: true, name: dangerousSpot.name }; // Return name for potentially better messages
      }
    }
    return { isNear: false };
  }, []);


  const clearSideNotification = useCallback(() => {
      if (sideNotificationTimer.current) {
           clearTimeout(sideNotificationTimer.current);
           sideNotificationTimer.current = null;
       }
       setShowSideNotification(false);
  }, []);


  // Sets the alert based on proximity check, avoiding overwriting gunshot alert
  const updateAlertForLocation = useCallback((location: Location | null) => {
    // If a gunshot alert was just set, don't immediately overwrite it with a location-based one
    if (isGunshotAlertActive.current) {
       return;
    }

    // Clear side notification if location changes or becomes safe
     clearSideNotification();


    if (!location) {
      // If location is lost or unavailable, clear only crime alerts.
      if (alertState.type === 'crime') {
        setAlertState({ type: null, message: '' });
      }
      return;
    }

    let dangerCheckResult: { isNear: boolean; name?: string };
    let locationName: string | null = null;

    if ('name' in location) { // Manually selected DefinedLocation
        dangerCheckResult = { isNear: location.isDangerous, name: location.name };
        locationName = location.name;
    } else { // GPS Location
        dangerCheckResult = checkProximityToDanger(location);
    }


    if (dangerCheckResult.isNear) {
        let message = `🚨 Entering a high-risk area. Stay alert!`;
        if(locationName) {
            message = `🚨 Selected location "${locationName}" is a high-risk area. Stay alert!`;
        } else if (dangerCheckResult.name) {
            // If GPS location is near a named dangerous spot
             message = `🚨 Near high-risk area "${dangerCheckResult.name}". Stay alert!`;
        }
        // Only set crime alert if not currently a gunshot alert
        if (alertState.type !== 'gunshot') {
           setAlertState({ type: 'crime', message });
        }
    } else {
      // If not near danger and current alert is 'crime', clear it.
      // Also clears if current alert is null (safe state)
      if (alertState.type === 'crime' || alertState.type === null) {
        setAlertState({ type: null, message: '' });
      }
      // Do not clear gunshot alerts here. They are cleared by the listener or manual selection.
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alertState.type, checkProximityToDanger, clearSideNotification]); // Dependency on alertState.type ensures it runs when alert changes


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
            // Important: Check alert *after* setting location state
            // The updateAlertForLocation function will read the latest state
            // updateAlertForLocation(location); // Check for crime alert on initial GPS fix
            setIsLoadingLocation(false);
          }
        })
        .catch((err) => {
          if (isMounted) {
            console.error("Geolocation error:", err);
            setError(err.message || "Could not retrieve location via GPS.");
            setIsLoadingLocation(false);
            if (alertState.type === 'crime') {
               setAlertState({ type: null, message: '' });
            }
          }
        });
    } else {
       setIsLoadingLocation(false);
    }

    // Cleanup timer on unmount
    return () => {
       isMounted = false;
       clearSideNotification();
    };
  // Run only once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update alert whenever location changes
  useEffect(() => {
      // Don't update location alert immediately after a gunshot simulation
      if (!isGunshotAlertActive.current) {
           updateAlertForLocation(currentLocation);
      }
  }, [currentLocation, updateAlertForLocation]);


  // Function to manually set location from buttons/cards
  const manuallySetLocation = useCallback((location: DefinedLocation) => {
    setError(null);
    setIsLoadingLocation(false);
    setCurrentLocation(location); // This triggers the useEffect above to update alert
    setLocationSource('manual');
    isGunshotAlertActive.current = false; // Manual selection overrides gunshot alert intention
    clearSideNotification(); // Clear side notification on manual change

    // No need to call updateAlertForLocation here, the useEffect handles it
  }, [clearSideNotification]);


  // --- Gunshot Simulation and Listener ---

  const simulateGunshot = useCallback(async () => {
    if (!currentLocation) {
      setError("Cannot simulate gunshot without a location selected.");
      return;
    }
    try {
      setError(null);
      playGunshotSound();

      // Set flag *before* setting state
      isGunshotAlertActive.current = true;
      setAlertState({
          type: 'gunshot',
          message: '🔫 Gunshot detected nearby! Take cover!',
      });

      // Show the side notification immediately
      setShowSideNotification(true);
      // Clear any existing timer and set a new one to hide it after a delay
      if (sideNotificationTimer.current) clearTimeout(sideNotificationTimer.current);
      sideNotificationTimer.current = setTimeout(() => {
          setShowSideNotification(false);
          sideNotificationTimer.current = null;
      }, 10000); // Show for 10 seconds


      await addDoc(collection(db, 'gunshotEvents'), {
        location: { lat: currentLocation.lat, lng: currentLocation.lng },
        timestamp: serverTimestamp(),
      });

      // Reset the flag after a short delay to allow location alerts to resume if needed
      setTimeout(() => {
         isGunshotAlertActive.current = false;
         // Optionally re-evaluate location alert if needed, though listener might handle it
         // updateAlertForLocation(currentLocation);
      }, 500); // Adjust delay as needed

    } catch (err) {
      console.error("Error simulating gunshot:", err);
      setError("Failed to simulate gunshot event.");
      isGunshotAlertActive.current = false; // Ensure flag is reset on error
      clearSideNotification(); // Clear side notification on error
    }
  }, [currentLocation, clearSideNotification]); // Removed updateAlertForLocation from dependencies


  // Listen for the latest gunshot event
  useEffect(() => {
    const q = query(collection(db, 'gunshotEvents'), orderBy('timestamp', 'desc'), limit(1));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      // Read the state *inside* the callback to get the latest value
      const currentType = alertState.type;
      const isSideNotificationCurrentlyVisible = showSideNotification; // Capture current state

      if (!querySnapshot.empty) {
        const latestEvent = querySnapshot.docs[0].data() as GunshotEvent;
        const eventTimestamp = (latestEvent.timestamp as any)?.toDate()?.getTime();
        const now = Date.now();
        const isRecent = eventTimestamp && now - eventTimestamp < 60000; // 1 minute window

        if (isRecent) {
            let isNearby = true;
            if (currentLocation) {
                const distance = getDistance(currentLocation, latestEvent.location);
                isNearby = distance < 1000; // 1km radius
            }

            if (isNearby && currentType !== 'gunshot') {
                 isGunshotAlertActive.current = true; // Set flag as listener detected gunshot
                 setAlertState({
                    type: 'gunshot',
                    message: '🔫 Gunshot detected nearby! Take cover!',
                 });
                 // Show side notification if not already shown by simulation
                 if (!isSideNotificationCurrentlyVisible) {
                     setShowSideNotification(true);
                      if (sideNotificationTimer.current) clearTimeout(sideNotificationTimer.current);
                      sideNotificationTimer.current = setTimeout(() => {
                           setShowSideNotification(false);
                           sideNotificationTimer.current = null;
                      }, 10000); // Show for 10 seconds
                 }

                 // Reset flag after a short delay
                 setTimeout(() => { isGunshotAlertActive.current = false; }, 500);
            } else if (!isNearby && (currentType === 'gunshot' || isSideNotificationCurrentlyVisible)) {
                 isGunshotAlertActive.current = false; // Clear flag as gunshot is not nearby
                 clearSideNotification(); // Hide side notification
                 updateAlertForLocation(currentLocation); // Revert to location-based alert
            }
            // Case: isNearby and currentType is 'gunshot' -> Do nothing, already alerted.
            // Case: !isNearby and currentType is not 'gunshot' -> Do nothing.

        } else if (currentType === 'gunshot' || isSideNotificationCurrentlyVisible) {
          // Latest event is OLD, clear the gunshot alert and side notification if active
          isGunshotAlertActive.current = false;
          clearSideNotification();
          updateAlertForLocation(currentLocation); // Revert to location-based alert
        }
      } else if (currentType === 'gunshot' || isSideNotificationCurrentlyVisible) {
        // No gunshot events, clear the gunshot alert and side notification if active
        isGunshotAlertActive.current = false;
        clearSideNotification();
        updateAlertForLocation(currentLocation); // Revert to location-based alert
      }
    }, (err) => {
      console.error("Error listening to gunshot events:", err);
       clearSideNotification(); // Clear on error too
    });

    return () => unsubscribe();
  // Dependencies: currentLocation triggers re-check of proximity.
  // alertState.type isn't strictly needed here as we read it inside, but include updateAlertForLocation
  // to ensure the callback is fresh if its definition changes. Add showSideNotification for reading state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLocation, updateAlertForLocation, alertState.type, showSideNotification, clearSideNotification]);

  const selectedLocationName = (currentLocation && 'name' in currentLocation) ? currentLocation.name : null;

  return {
      alertState,
      simulateGunshot,
      isLoading: isLoadingLocation,
      error,
      currentLocation,
      manuallySetLocation,
      selectedLocationName,
      predefinedLocations: PREDEFINED_LOCATIONS,
      showSideNotification // Expose the state
    };
}
