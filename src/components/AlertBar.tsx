"use client";

import type { AlertState } from '@/types';
import { cn } from '@/lib/utils';

interface AlertBarProps {
  alert: AlertState;
}

export function AlertBar({ alert }: AlertBarProps) {
  if (!alert.type) {
    return null; // Don't render anything if there's no active alert
  }

  const alertClasses = cn(
    "fixed top-0 left-0 right-0 z-50 p-4 text-center text-sm md:text-base font-semibold shadow-md",
    {
      'bg-warning text-warning-foreground': alert.type === 'crime', // Yellow for crime
      'bg-destructive text-destructive-foreground': alert.type === 'gunshot', // Red for gunshot
    }
  );

  return (
    <div className={alertClasses} role="alert">
      {alert.message}
    </div>
  );
}
