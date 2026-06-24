"use client";

import { Activity } from "lucide-react";
import { useRecoveryStore } from "@/store/useRecoveryStore";
import { resolveColorScale } from "@/lib/MuscleMapJS/index";

export default function MuscleDiagnostics() {
  const { muscles } = useRecoveryStore();

  return (
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
  );
}
