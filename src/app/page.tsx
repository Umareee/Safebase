
"use client";

import { AlertBar } from '@/components/AlertBar';
import { GunshotButton } from '@/components/GunshotButton';
import { LocationSelector } from '@/components/LocationSelector'; // Import LocationSelector
import { useLocationAlerts } from '@/hooks/useLocationAlerts';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge'; // Import Badge
import { LocateFixed, MapPin } from 'lucide-react'; // Icons for location source

export default function Home() {
  const {
    alertState,
    simulateGunshot,
    isLoading,
    error,
    currentLocation, // Get current location
    manuallySetLocation, // Get function to set location
    selectedLocationName, // Name of selected predefined location
    predefinedLocations // List of locations for the selector
   } = useLocationAlerts();

   // Determine location source for display
   const locationSourceDisplay = currentLocation
     ? ('name' in currentLocation ? 'Manual Selection' : 'GPS')
     : (isLoading ? 'Determining...' : 'Unavailable');

   const locationSourceIcon = currentLocation
     ? ('name' in currentLocation ? <MapPin className="h-4 w-4" /> : <LocateFixed className="h-4 w-4" />)
     : null;

  return (
    <>
      <AlertBar alert={alertState} />
      <main className="flex min-h-screen flex-col items-center justify-center p-6 pt-20"> {/* Added padding-top */}
        <h1 className="text-4xl font-bold mb-4 text-center">SafeZone</h1>

        {/* Display Location Source */}
        <div className="mb-6 flex items-center justify-center space-x-2 text-muted-foreground">
           {isLoading ? (
             <Skeleton className="h-5 w-32" />
           ) : (
             <>
               {locationSourceIcon}
               <Badge variant="outline">{locationSourceDisplay}</Badge>
             </>
           )}
         </div>


        {/* Loading State */}
        {isLoading && (
           <div className="text-center text-muted-foreground flex flex-col items-center space-y-4 w-full max-w-md">
             <p>Fetching your location and checking for alerts...</p>
             <Skeleton className="h-12 w-full" /> {/* Skeleton for gunshot button */}
             {/* Skeleton for location selector */}
             <div className="mt-6 w-full">
               <Skeleton className="h-6 w-40 mb-4 mx-auto" />
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
               </div>
             </div>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="text-center text-destructive my-4 p-4 border border-destructive rounded-md bg-destructive/10 w-full max-w-md">
            <p className="font-semibold">Error:</p>
            <p>{error}</p>
            {/* Provide guidance if location permission is denied */}
            {error.includes("denied") && (
              <p className="mt-2 text-sm">Please enable location services in your browser settings to use GPS-based alerts.</p>
            )}
          </div>
        )}

        {/* Loaded State */}
        {!isLoading && (
          <div className="flex flex-col items-center space-y-8 w-full max-w-md">
             {/* Display status message if no alert and no error */}
             {!alertState.type && !error && !currentLocation && (
                <p className="text-muted-foreground text-center">Select a location or enable GPS to check for alerts.</p>
             )}
             {!alertState.type && !error && currentLocation && (
                <p className="text-muted-foreground text-center">No active alerts for your current location.</p>
             )}

            <GunshotButton
              onSimulate={simulateGunshot}
              disabled={!currentLocation} // Disable if no location is set
              aria-label="Simulate Gunshot Event at Current Location"
            />

            <LocationSelector
              locations={predefinedLocations}
              onSelectLocation={manuallySetLocation}
              selectedLocationName={selectedLocationName}
            />
          </div>
        )}

      </main>
    </>
  );
}
