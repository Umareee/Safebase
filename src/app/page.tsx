"use client";

import { AlertBar } from '@/components/AlertBar';
import { GunshotButton } from '@/components/GunshotButton';
import { useLocationAlerts } from '@/hooks/useLocationAlerts';
import { Skeleton } from '@/components/ui/skeleton'; // Import Skeleton

export default function Home() {
  const { alertState, simulateGunshot, isLoading, error } = useLocationAlerts();

  return (
    <>
      <AlertBar alert={alertState} />
      <main className="flex min-h-screen flex-col items-center justify-center p-6 pt-20"> {/* Added padding-top for fixed alert bar */}
        <h1 className="text-4xl font-bold mb-8 text-center">SafeZone</h1>

        {isLoading && (
           <div className="text-center text-muted-foreground flex flex-col items-center space-y-4">
            <Skeleton className="h-6 w-48" /> {/* Skeleton for loading text */}
             <p>Fetching your location and checking for alerts...</p>
             <Skeleton className="h-12 w-full max-w-xs" /> {/* Skeleton for button */}
          </div>
        )}

        {error && !isLoading && (
          <div className="text-center text-destructive my-4 p-4 border border-destructive rounded-md bg-destructive/10">
            <p className="font-semibold">Error:</p>
            <p>{error}</p>
          </div>
        )}

        {!isLoading && (
          <div className="flex flex-col items-center space-y-4 w-full">
             {/* Display status message if no alert and no error */}
             {!alertState.type && !error && (
                <p className="text-muted-foreground text-center">No active alerts in your area.</p>
             )}
            <GunshotButton onSimulate={simulateGunshot} disabled={!!error && !alertState.type} />
          </div>
        )}

      </main>
    </>
  );
}
