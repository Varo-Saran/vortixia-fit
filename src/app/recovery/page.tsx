"use client";

import { useEffect, useState, useRef } from "react";
import { HeartPulse, Moon, Utensils, Activity, Settings2 } from "lucide-react";
import { useRecoveryStore } from "@/store/useRecoveryStore";

import { MuscleMapWidget, resolveColorScale, MuscleIntensity, Muscle } from "@/lib/MuscleMapJS/index";

export default function RecoveryArena() {
  const { readinessScore, cnsStatus, muscles } = useRecoveryStore();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<MuscleMapWidget | null>(null);

  // View state
  const [viewSide, setViewSide] = useState<"front" | "back">("front");

  // Map our generic muscle data to MuscleMapJS specific names
  const getMappedIntensities = () => {
    const data: MuscleIntensity[] = [];
    muscles.forEach(m => {
      // Convert recovery % to a 0.0 to 1.0 intensity (lower recovery = higher intensity/heat)
      const heat = 1.0 - (m.recoveryPercentage / 100);
      
      if (m.id === 'chest') data.push({ muscle: 'chest' as Muscle, intensity: heat });
      if (m.id === 'back') data.push({ muscle: 'upper-back' as Muscle, intensity: heat }, { muscle: 'lower-back' as Muscle, intensity: heat });
      if (m.id === 'legs') data.push({ muscle: 'quadriceps' as Muscle, intensity: heat }, { muscle: 'calves' as Muscle, intensity: heat }, { muscle: 'hamstring' as Muscle, intensity: heat });
      if (m.id === 'arms') data.push({ muscle: 'biceps' as Muscle, intensity: heat }, { muscle: 'triceps' as Muscle, intensity: heat }, { muscle: 'forearm' as Muscle, intensity: heat });
      if (m.id === 'core') data.push({ muscle: 'abs' as Muscle, intensity: heat }, { muscle: 'obliques' as Muscle, intensity: heat });
      if (m.id === 'shoulders') data.push({ muscle: 'deltoids' as Muscle, intensity: heat }, { muscle: 'trapezius' as Muscle, intensity: heat });
    });
    return data;
  };

  // Initialize and update MuscleMapJS widget
  useEffect(() => {
    if (!mapContainerRef.current || muscles.length === 0) return;

    if (!widgetRef.current) {
      // Initialize once
      widgetRef.current = new MuscleMapWidget(mapContainerRef.current, {
        gender: 'male',
        side: viewSide,
        style: 'neon',
        interactive: false,
        selectable: false,
        multiSelect: false
      });
      // Tooltip to show muscle names
      widgetRef.current.enableTooltip();
    }

    // Set heatmap data
    widgetRef.current.setHeatmap(getMappedIntensities(), {
      colorScale: 'thermal', // A good heatmap indicating soreness
      threshold: 0.0,
      gradientFill: true
    });

  }, [muscles]);

  // Handle front/back toggle
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

  if (muscles.length === 0) return null;

  return (
    <main className="flex min-h-screen flex-col items-center pt-[var(--notch-top)] pb-24 px-6 bg-background relative overflow-x-hidden">
      
      {/* Header */}
      <header className="w-full flex items-center justify-between py-4 mb-6 sticky top-[var(--notch-top)] z-20 bg-background/80 backdrop-blur-lg border-b border-white/5">
        <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
          <HeartPulse className="w-6 h-6 text-accent-green" />
          Recovery
        </h1>
        <div className="flex items-center gap-2">
          {process.env.NODE_ENV === 'development' && (
          <button 
            onClick={() => useRecoveryStore.getState().fastForward(12)} 
            className="text-[10px] bg-accent-green/20 text-accent-green px-2 py-1 rounded font-bold uppercase tracking-widest border border-accent-green/30 active:scale-95 transition-transform"
          >
            +12h (Dev)
          </button>
          )}
          <button className="p-2 bg-white/5 rounded-full text-text-muted hover:text-white transition">
            <Settings2 className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Readiness Overview */}
      <section className="w-full mb-8 animate-fade-in-down flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-text-muted uppercase tracking-widest mb-1">Overall Readiness</h2>
          <div className="flex items-end gap-3">
            <span className="text-5xl font-black text-white">{readinessScore}%</span>
            <span className={`text-sm font-bold pb-1 ${readinessScore > 70 ? 'text-accent-green' : readinessScore > 30 ? 'text-yellow-500' : 'text-accent-red'}`}>
              {cnsStatus}
            </span>
          </div>
        </div>
      </section>

      {/* View Toggle */}
      <div className="w-full flex bg-black/50 p-1 rounded-xl mb-6 border border-white/5">
        <button 
          onClick={() => setViewSide("front")}
          className={`flex-1 py-1.5 text-[10px] uppercase tracking-wider font-bold rounded-lg transition-all ${viewSide === "front" ? "bg-white/10 text-white shadow-sm" : "text-text-muted hover:text-white"}`}
        >
          Front View
        </button>
        <button 
          onClick={() => setViewSide("back")}
          className={`flex-1 py-1.5 text-[10px] uppercase tracking-wider font-bold rounded-lg transition-all ${viewSide === "back" ? "bg-white/10 text-white shadow-sm" : "text-text-muted hover:text-white"}`}
        >
          Back View
        </button>
      </div>

      {/* Body Map Visualization using MuscleMapJS */}
      <section className="w-full flex justify-center items-center h-[500px] mb-10 relative animate-fade-in">
        {/* Glow behind map */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-accent-red/10 blur-[50px] rounded-full pointer-events-none" />
        
        {/* The container for MuscleMapJS Canvas */}
        <div ref={mapContainerRef} className="w-full h-full relative z-10 drop-shadow-[0_0_15px_rgba(255,51,51,0.15)] pointer-events-none" />
      </section>

      {/* Quick Log Buttons */}
      <section className="w-full grid grid-cols-2 gap-4 mb-10 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        <div className="relative group">
          <button disabled className="w-full glass-card p-4 flex flex-col items-center justify-center gap-2 border border-white/5 opacity-50 cursor-not-allowed">
            <Moon className="w-6 h-6 text-text-muted" />
            <span className="text-xs font-bold text-text-muted">Log Sleep</span>
          </button>
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-white text-black text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none">
            Coming Soon
          </div>
        </div>
        
        <div className="relative group">
          <button disabled className="w-full glass-card p-4 flex flex-col items-center justify-center gap-2 border border-white/5 opacity-50 cursor-not-allowed">
            <Utensils className="w-6 h-6 text-text-muted" />
            <span className="text-xs font-bold text-text-muted">Log Nutrition</span>
          </button>
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-white text-black text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none">
            Coming Soon
          </div>
        </div>
      </section>

      {/* Detailed Muscle Breakdown */}
      <section className="w-full animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
        <h2 className="text-xs font-bold text-text-muted mb-4 uppercase tracking-widest flex items-center gap-2">
          <Activity className="w-4 h-4 text-white" />
          Muscle Diagnostics
        </h2>

        <div className="flex flex-col gap-3">
          {muscles.map((m) => {
            const isRed = m.recoveryPercentage < 30;
            const isYellow = m.recoveryPercentage >= 30 && m.recoveryPercentage < 70;
            const label = isRed ? "Exhausted" : isYellow ? "Recovering" : "Fresh";

            // Sync exact color from MuscleMapJS thermal scale
            const heat = 1.0 - (m.recoveryPercentage / 100);
            const thermalScale = resolveColorScale('thermal');
            const exactColor = thermalScale.color(heat);

            return (
              <div key={m.id} className="glass-card p-4 flex flex-col gap-3 border border-white/5">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-white">{m.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: exactColor }}>
                      {label}
                    </span>
                    <span className="font-mono text-sm font-bold bg-white/10 px-2 py-1 rounded-md">{Math.round(m.recoveryPercentage)}%</span>
                  </div>
                </div>
                <div className="w-full h-1.5 bg-black/80 rounded-full overflow-hidden">
                  <div className="h-full transition-all duration-1000" style={{ width: `${m.recoveryPercentage}%`, backgroundColor: exactColor, boxShadow: `0 0 10px ${exactColor}80` }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

    </main>
  );
}
