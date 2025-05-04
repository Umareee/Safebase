"use client";

import { Button } from "@/components/ui/button";
import { Target } from "lucide-react"; // Using Target icon as a placeholder for gun

interface GunshotButtonProps {
  onSimulate: () => void;
  disabled?: boolean;
}

export function GunshotButton({ onSimulate, disabled = false }: GunshotButtonProps) {
  return (
    <Button
      onClick={onSimulate}
      disabled={disabled}
      size="lg" // Make the button large
      className="mt-8 w-full max-w-xs mx-auto text-lg font-bold shadow-lg" // Centered, large text, shadow
      aria-label="Simulate Gunshot Event"
    >
      <Target className="mr-2 h-6 w-6" aria-hidden="true" /> {/* Larger icon */}
      Simulate Gunshot
    </Button>
  );
}
