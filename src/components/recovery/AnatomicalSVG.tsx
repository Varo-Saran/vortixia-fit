import React from 'react';
import { RecoveryData } from '@/store/useRecoveryStore';

interface Props {
  muscles: RecoveryData[];
}

export function AnatomicalSVG({ muscles }: Props) {
  const getColor = (id: string) => {
    const m = muscles.find(m => m.id === id);
    if (!m) return '#555';
    if (m.recoveryPercentage < 30) return '#ef4444'; // Red
    if (m.recoveryPercentage < 70) return '#eab308'; // Yellow
    return '#22c55e'; // Green
  };

  return (
    <svg viewBox="0 0 200 400" className="w-full h-full max-w-[150px] drop-shadow-[0_0_20px_rgba(255,255,255,0.05)]">
      {/* Head */}
      <rect x="85" y="20" width="30" height="35" rx="8" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.3)" />
      
      {/* Neck */}
      <rect x="90" y="58" width="20" height="15" fill="rgba(255,255,255,0.1)" />

      {/* Shoulders */}
      <polygon points="50,75 150,75 140,95 60,95" fill={getColor('shoulders')} opacity="0.8" stroke="black" strokeWidth="2" />

      {/* Chest */}
      <rect x="70" y="100" width="28" height="30" rx="4" fill={getColor('chest')} opacity="0.8" stroke="black" strokeWidth="2" />
      <rect x="102" y="100" width="28" height="30" rx="4" fill={getColor('chest')} opacity="0.8" stroke="black" strokeWidth="2" />

      {/* Core / Abs (6-pack blocks) */}
      <rect x="75" y="135" width="23" height="15" rx="2" fill={getColor('core')} opacity="0.8" stroke="black" strokeWidth="2" />
      <rect x="102" y="135" width="23" height="15" rx="2" fill={getColor('core')} opacity="0.8" stroke="black" strokeWidth="2" />
      
      <rect x="75" y="153" width="23" height="15" rx="2" fill={getColor('core')} opacity="0.8" stroke="black" strokeWidth="2" />
      <rect x="102" y="153" width="23" height="15" rx="2" fill={getColor('core')} opacity="0.8" stroke="black" strokeWidth="2" />
      
      <rect x="75" y="171" width="23" height="15" rx="2" fill={getColor('core')} opacity="0.8" stroke="black" strokeWidth="2" />
      <rect x="102" y="171" width="23" height="15" rx="2" fill={getColor('core')} opacity="0.8" stroke="black" strokeWidth="2" />

      {/* Upper Arms (Biceps/Triceps) */}
      <rect x="45" y="100" width="18" height="40" rx="6" fill={getColor('arms')} opacity="0.8" stroke="black" strokeWidth="2" />
      <rect x="137" y="100" width="18" height="40" rx="6" fill={getColor('arms')} opacity="0.8" stroke="black" strokeWidth="2" />

      {/* Forearms */}
      <rect x="42" y="145" width="14" height="45" rx="4" fill={getColor('arms')} opacity="0.8" stroke="black" strokeWidth="2" />
      <rect x="144" y="145" width="14" height="45" rx="4" fill={getColor('arms')} opacity="0.8" stroke="black" strokeWidth="2" />

      {/* Hands */}
      <rect x="40" y="195" width="12" height="15" rx="3" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.2)" />
      <rect x="148" y="195" width="12" height="15" rx="3" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.2)" />

      {/* Pelvis/Hips */}
      <polygon points="70,195 130,195 120,215 80,215" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.2)" />

      {/* Upper Legs (Quads) */}
      <rect x="72" y="220" width="24" height="60" rx="8" fill={getColor('legs')} opacity="0.8" stroke="black" strokeWidth="2" />
      <rect x="104" y="220" width="24" height="60" rx="8" fill={getColor('legs')} opacity="0.8" stroke="black" strokeWidth="2" />

      {/* Knees */}
      <circle cx="84" cy="290" r="8" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.2)" />
      <circle cx="116" cy="290" r="8" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.2)" />

      {/* Lower Legs (Calves) */}
      <polygon points="78,305 90,305 87,360 81,360" fill={getColor('legs')} opacity="0.8" stroke="black" strokeWidth="2" />
      <polygon points="110,305 122,305 119,360 113,360" fill={getColor('legs')} opacity="0.8" stroke="black" strokeWidth="2" />

      {/* Feet */}
      <rect x="75" y="365" width="15" height="10" rx="2" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.2)" />
      <rect x="110" y="365" width="15" height="10" rx="2" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.2)" />
    </svg>
  );
}
