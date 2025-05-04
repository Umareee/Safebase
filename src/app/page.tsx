
"use client";

import { AlertBar } from '@/components/AlertBar';
import { GunshotButton } from '@/components/GunshotButton';
// import { LocationSelector } from '@/components/LocationSelector'; // Removed import
import { SideNotification } from '@/components/SideNotification'; // Import SideNotification
import { useLocationAlerts } from '@/hooks/useLocationAlerts';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { LocateFixed, MapPin, PersonStanding, Siren, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'; // Import Card components
import { cn } from '@/lib/utils';
import type { DefinedLocation } from '@/config/locations';
import { useState, useEffect } from 'react'; // Import useState and useEffect for client-side state

export default function Home() {
  const {
    alertState,
    simulateGunshot,
    isLoading,
    error,
    currentLocation,
    manuallySetLocation,
    selectedLocationName,
    predefinedLocations,
    showSideNotification // Get the new state from the hook
   } = useLocationAlerts();

   // State to manage visual feedback (placeholder for animation)
   const [visualFeedback, setVisualFeedback] = useState<'safe' | 'danger' | 'gunshot' | 'idle'>('idle');

   useEffect(() => {
     if (alertState.type === 'gunshot') {
       setVisualFeedback('gunshot');
     } else if (alertState.type === 'crime') {
       setVisualFeedback('danger');
     } else if (currentLocation) {
       // Check if the currently selected location (manual or GPS resolved) is dangerous
       const currentIsDangerous = 'name' in currentLocation
         ? currentLocation.isDangerous // Manually selected DefinedLocation
         : predefinedLocations.some(loc => // Check proximity for GPS
             loc.isDangerous &&
             getDistance(currentLocation, loc) <= 500 // Use a reasonable proximity check
           );

        if (currentIsDangerous) {
             setVisualFeedback('danger');
        } else {
             setVisualFeedback('safe');
        }
     } else {
       setVisualFeedback('idle');
     }
   }, [alertState.type, currentLocation, predefinedLocations]);


   // Determine location source for display
   const locationSourceDisplay = currentLocation
     ? ('name' in currentLocation ? 'Manual Selection' : 'GPS')
     : (isLoading ? 'Determining...' : 'Unavailable');

   const locationSourceIcon = currentLocation
     ? ('name' in currentLocation ? <MapPin className="h-4 w-4" /> : <LocateFixed className="h-4 w-4" />)
     : null;

  // Helper function to get distance (simplified version, consider moving to utils)
  // Necessary because useLocationAlerts doesn't expose the utility directly
  function getDistance(loc1: any, loc2: any): number {
      const R = 6371e3; // meters
      const phi1 = (loc1.lat * Math.PI) / 180;
      const phi2 = (loc2.lat * Math.PI) / 180;
      const deltaPhi = ((loc2.lat - loc1.lat) * Math.PI) / 180;
      const deltaLambda = ((loc2.lng - loc1.lng) * Math.PI) / 180;
      const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
  }

  return (
    <>
      <AlertBar alert={alertState} />
      <SideNotification isVisible={showSideNotification} /> {/* Add the SideNotification */}
      <main className="flex min-h-screen flex-col items-center justify-center p-6 pt-20">
        <h1 className="text-4xl font-bold mb-4 text-center text-primary">SafeZone</h1> {/* Made title colorful */}

        {/* Display Location Source */}
        <div className="mb-6 flex items-center justify-center space-x-2 text-muted-foreground">
           {isLoading ? (
             <Skeleton className="h-5 w-32" />
           ) : (
             <>
               {locationSourceIcon}
               <Badge variant="secondary">{locationSourceDisplay}</Badge> {/* Different badge variant */}
             </>
           )}
         </div>

        {/* Placeholder Visual Feedback Area */}
        <div className={cn(
          "w-32 h-32 rounded-full mb-8 flex items-center justify-center transition-all duration-500 ease-in-out transform hover:scale-105", // Added transition and hover effect
          visualFeedback === 'idle' && 'bg-gray-200 dark:bg-gray-700', // Adjusted idle color
          visualFeedback === 'safe' && 'bg-gradient-to-br from-green-400 to-emerald-500 text-white shadow-lg', // Safe gradient
          visualFeedback === 'danger' && 'bg-gradient-to-br from-yellow-400 to-amber-500 text-white shadow-lg animate-pulse', // Warning gradient pulse
          visualFeedback === 'gunshot' && 'bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-xl animate-ping' // Gunshot gradient ping
        )}>
          {visualFeedback === 'idle' && <PersonStanding className="h-16 w-16 text-gray-500 dark:text-gray-400" />}
          {visualFeedback === 'safe' && <ShieldCheck className="h-16 w-16" />}
          {(visualFeedback === 'danger' || visualFeedback === 'gunshot') && <Siren className="h-16 w-16" />}
        </div>


        {/* Loading State */}
        {isLoading && (
           <div className="text-center text-muted-foreground flex flex-col items-center space-y-4 w-full max-w-md">
             <p>Fetching your location and checking for alerts...</p>
             <Skeleton className="h-12 w-full max-w-xs" /> {/* Skeleton for gunshot button */}
             {/* Skeleton for location cards */}
             <div className="mt-6 w-full max-w-2xl">
               <Skeleton className="h-6 w-40 mb-4 mx-auto" />
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Skeleton className="h-24 w-full rounded-lg" />
                  <Skeleton className="h-24 w-full rounded-lg" />
                  <Skeleton className="h-24 w-full rounded-lg" />
                  <Skeleton className="h-24 w-full rounded-lg" />
               </div>
             </div>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="text-center text-destructive my-4 p-4 border border-destructive rounded-lg bg-destructive/10 w-full max-w-md shadow-md"> {/* Added shadow */}
            <p className="font-semibold">Error:</p>
            <p>{error}</p>
            {error.includes("denied") && (
              <p className="mt-2 text-sm">Please enable location services in your browser settings to use GPS-based alerts.</p>
            )}
          </div>
        )}

        {/* Loaded State */}
        {!isLoading && (
          <div className="flex flex-col items-center space-y-8 w-full max-w-2xl">
             {/* Display status message if no alert and no error */}
             {!alertState.type && !error && !currentLocation && (
                <p className="text-muted-foreground text-center">Select a location or enable GPS to check for alerts.</p>
             )}
             {!alertState.type && !error && currentLocation && (
                <p className="text-green-600 dark:text-green-400 text-center font-medium">Area clear. Stay safe!</p> // More positive safe message
             )}

            <GunshotButton
              onSimulate={simulateGunshot}
              disabled={!currentLocation}
              aria-label="Simulate Gunshot Event at Current Location"
            />

            {/* Location Cards Section */}
            <div className="mt-6 w-full">
              <h2 className="text-xl font-semibold mb-4 text-center">Select Location</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {predefinedLocations.map((location) => (
                  <Card
                    key={location.name}
                    onClick={() => manuallySetLocation(location)}
                    className={cn(
                      "cursor-pointer transition-all hover:shadow-lg transform hover:-translate-y-1", // Enhanced hover effect
                      location.isDangerous && "border-destructive bg-destructive/5 hover:bg-destructive/10",
                      selectedLocationName === location.name && "ring-2 ring-offset-2 ring-primary shadow-xl", // Added offset to ring
                      !location.isDangerous && selectedLocationName !== location.name && "border-border bg-card hover:bg-accent/70", // Slightly stronger hover for safe cards
                       !location.isDangerous && selectedLocationName === location.name && "bg-primary/10 border-primary" // Highlight selected safe location
                    )}
                    aria-pressed={selectedLocationName === location.name}
                    tabIndex={0} // Make it focusable
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') manuallySetLocation(location); }} // Keyboard accessibility
                  >
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className={cn(
                        "text-lg font-medium truncate",
                         location.isDangerous && "text-destructive", // Always red text if dangerous
                         !location.isDangerous && "text-card-foreground" // Default card foreground
                       )}>
                         {location.name}
                      </CardTitle>
                      <MapPin className={cn(
                        "h-5 w-5",
                         location.isDangerous ? "text-destructive/80" : "text-muted-foreground", // Red icon if dangerous
                         selectedLocationName === location.name && !location.isDangerous && "text-primary/80" // Primary color icon if selected safe
                        )} />
                    </CardHeader>
                    <CardContent>
                       <p className={cn("text-xs",
                         location.isDangerous ? "text-destructive/90 font-semibold" : "text-muted-foreground", // Bolder text for dangerous
                        )}>
                         {location.isDangerous ? 'High-Risk Area' : 'Standard Area'}
                       </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* <LocationSelector
              locations={predefinedLocations}
              onSelectLocation={manuallySetLocation}
              selectedLocationName={selectedLocationName}
            /> */}
          </div>
        )}

      </main>
    </>
  );
}

