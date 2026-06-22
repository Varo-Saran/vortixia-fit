"use client";

import { useEffect } from "react";
import { useRecoveryStore } from "@/store/useRecoveryStore";

export function InitRecovery() {
  const { triggerDecay } = useRecoveryStore();

  useEffect(() => {
    // Trigger decay calculation on app mount
    triggerDecay();

    // Optionally set an interval to check every minute while app is open
    const interval = setInterval(() => {
      triggerDecay();
    }, 60000);

    return () => clearInterval(interval);
  }, [triggerDecay]);

  return null;
}
