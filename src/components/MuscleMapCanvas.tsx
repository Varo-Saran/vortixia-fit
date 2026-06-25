"use client";

import { useEffect, useRef } from "react";
import { useRecoveryStore } from "@/store/useRecoveryStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { MuscleMapWidget, resolveColorScale, MuscleIntensity, Muscle } from "@/lib/MuscleMapJS/index";

interface MuscleMapCanvasProps {
  viewSide: "front" | "back";
}

export default function MuscleMapCanvas({ viewSide }: MuscleMapCanvasProps) {
  const { muscles } = useRecoveryStore();
  const { heroGender } = useSettingsStore();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<MuscleMapWidget | null>(null);

  const getMappedIntensities = () => {
    const data: MuscleIntensity[] = [];
    muscles.forEach(m => {
      const heat = 1.0 - (m.recoveryPercentage / 100);
      
      if (m.id === 'chest') data.push({ muscle: 'chest' as Muscle, intensity: heat });
      if (m.id === 'back') data.push({ muscle: 'upper-back' as Muscle, intensity: heat }, { muscle: 'lower-back' as Muscle, intensity: heat });
      if (m.id === 'legs') data.push({ muscle: 'quadriceps' as Muscle, intensity: heat }, { muscle: 'calves' as Muscle, intensity: heat }, { muscle: 'hamstring' as Muscle, intensity: heat }, { muscle: 'gluteal' as Muscle, intensity: heat });
      if (m.id === 'arms') data.push({ muscle: 'biceps' as Muscle, intensity: heat }, { muscle: 'triceps' as Muscle, intensity: heat }, { muscle: 'forearm' as Muscle, intensity: heat });
      if (m.id === 'core') data.push({ muscle: 'abs' as Muscle, intensity: heat }, { muscle: 'obliques' as Muscle, intensity: heat });
      if (m.id === 'shoulders') data.push({ muscle: 'deltoids' as Muscle, intensity: heat }, { muscle: 'trapezius' as Muscle, intensity: heat });
    });
    return data;
  };

  useEffect(() => {
    if (!mapContainerRef.current || muscles.length === 0) return;

    if (!widgetRef.current) {
      widgetRef.current = new MuscleMapWidget(mapContainerRef.current, {
        gender: heroGender,
        side: viewSide,
        style: 'neon',
        interactive: true,
        selectable: false,
        multiSelect: false
      });
      widgetRef.current.enableTooltip();
    }

    widgetRef.current.setHeatmap(getMappedIntensities(), {
      colorScale: 'thermal',
      threshold: 0.0,
      gradientFill: true
    });
  }, [muscles]);

  useEffect(() => {
    if (widgetRef.current) {
      widgetRef.current.setSide(viewSide);
      widgetRef.current.setHeatmap(getMappedIntensities(), {
        colorScale: 'thermal',
        threshold: 0.0,
        gradientFill: true
      });
    }
  }, [viewSide]);

  useEffect(() => {
    if (widgetRef.current) {
      widgetRef.current.setGender(heroGender);
    }
  }, [heroGender]);

  return <div ref={mapContainerRef} className="w-full h-full relative z-10 drop-shadow-[0_0_15px_rgba(255,51,51,0.15)]" />;
}
