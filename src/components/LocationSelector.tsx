
"use client";

import type { DefinedLocation } from '@/config/locations';
import { Button } from '@/components/ui/button';
import { MapPin } from 'lucide-react';

interface LocationSelectorProps {
  locations: DefinedLocation[];
  onSelectLocation: (location: DefinedLocation) => void;
  selectedLocationName: string | null; // To highlight the active button
}

export function LocationSelector({ locations, onSelectLocation, selectedLocationName }: LocationSelectorProps) {
  return (
    <div className="mt-6 w-full max-w-md mx-auto">
      <h2 className="text-xl font-semibold mb-4 text-center">Select Location</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {locations.map((location) => (
          <Button
            key={location.name}
            variant={location.isDangerous ? 'destructive' : (selectedLocationName === location.name ? 'default' : 'secondary')}
            onClick={() => onSelectLocation(location)}
            className="w-full justify-start text-left h-auto py-3 shadow"
            aria-pressed={selectedLocationName === location.name}
          >
            <MapPin className="mr-2 h-5 w-5 flex-shrink-0" />
            <span className="flex-grow truncate">{location.name}</span>
             {/* Optional: Indicate danger visually beyond color */}
             {/* {location.isDangerous && <ShieldAlert className="ml-auto h-5 w-5 text-destructive-foreground/80" />} */}
          </Button>
        ))}
      </div>
    </div>
  );
}
