
"use client";

import { cn } from "@/lib/utils";
import { AlertTriangle, ShieldCheck } from "lucide-react";

interface SideNotificationProps {
  isVisible: boolean;
}

export function SideNotification({ isVisible }: SideNotificationProps) {
  return (
    <div
      className={cn(
        "fixed top-1/4 right-0 z-50 transform transition-transform duration-500 ease-in-out",
        "p-4 rounded-l-lg shadow-xl border-l-4 border-t border-b border-primary", // Styling
        "bg-gradient-to-br from-primary/90 to-blue-600/90 text-primary-foreground backdrop-blur-sm", // Background and text
        isVisible ? "translate-x-0" : "translate-x-full", // Animation logic
        "max-w-xs w-full" // Width constraint
      )}
      role="status" // More appropriate role than alert
      aria-live="polite" // Announce changes politely
      aria-hidden={!isVisible} // Hide from accessibility tree when not visible
    >
      <div className="flex items-center space-x-3">
        <ShieldCheck className="h-8 w-8 flex-shrink-0 animate-pulse" />
        <div>
          <p className="font-bold text-base">Emergency Alert</p>
          <p className="text-sm">
            Fatima your live location has been sent to 15. They'll be soon here to protect you.
          </p>
        </div>
      </div>
    </div>
  );
}

