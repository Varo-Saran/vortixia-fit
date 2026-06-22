import React from 'react';
import { RecoveryData } from '@/store/useRecoveryStore';

interface Props {
  muscles: RecoveryData[];
}

export function MinimalistSVG({ muscles }: Props) {
  const getColor = (id: string) => {
    const m = muscles.find(m => m.id === id);
    if (!m) return '#555';
    if (m.recoveryPercentage < 30) return '#ef4444'; // Red
    if (m.recoveryPercentage < 70) return '#eab308'; // Yellow
    return '#22c55e'; // Green
  };

  return (
    <svg viewBox="0 0 200 400" className="w-full h-full max-w-[150px] drop-shadow-[0_0_15px_rgba(255,255,255,0.05)]">
      {/* Base Silhouette Outline */}
      <path 
        d="M100,20 C115,20 120,35 120,50 C120,65 110,70 110,75 C130,75 160,80 170,100 C180,120 180,180 170,190 C165,195 160,190 150,160 C140,130 140,130 135,130 C135,150 135,220 140,240 C145,260 150,370 140,380 C130,390 115,390 110,380 C105,370 105,280 105,250 L95,250 C95,280 95,370 90,380 C85,390 70,390 60,380 C50,370 55,260 60,240 C65,220 65,150 65,130 C60,130 60,130 50,160 C40,190 35,195 30,190 C20,180 20,120 30,100 C40,80 70,75 90,75 C90,70 80,65 80,50 C80,35 85,20 100,20 Z" 
        fill="none" 
        stroke="rgba(255,255,255,0.2)" 
        strokeWidth="3"
      />
      
      {/* Glowing Overlay Zones inside the silhouette */}
      {/* Head/Neck */}
      <circle cx="100" cy="45" r="12" fill="rgba(255,255,255,0.1)" />
      
      {/* Shoulders */}
      <ellipse cx="65" cy="95" rx="15" ry="10" fill={getColor('shoulders')} opacity="0.6" filter="blur(4px)" />
      <ellipse cx="135" cy="95" rx="15" ry="10" fill={getColor('shoulders')} opacity="0.6" filter="blur(4px)" />
      
      {/* Chest */}
      <ellipse cx="85" cy="115" rx="15" ry="12" fill={getColor('chest')} opacity="0.7" filter="blur(3px)" />
      <ellipse cx="115" cy="115" rx="15" ry="12" fill={getColor('chest')} opacity="0.7" filter="blur(3px)" />

      {/* Core/Abs */}
      <rect x="85" y="140" width="30" height="40" rx="10" fill={getColor('core')} opacity="0.7" filter="blur(4px)" />

      {/* Arms */}
      <ellipse cx="50" cy="140" rx="10" ry="25" fill={getColor('arms')} opacity="0.6" filter="blur(3px)" />
      <ellipse cx="150" cy="140" rx="10" ry="25" fill={getColor('arms')} opacity="0.6" filter="blur(3px)" />

      {/* Legs (Quads) */}
      <ellipse cx="80" cy="220" rx="12" ry="30" fill={getColor('legs')} opacity="0.7" filter="blur(4px)" />
      <ellipse cx="120" cy="220" rx="12" ry="30" fill={getColor('legs')} opacity="0.7" filter="blur(4px)" />
      
      {/* Legs (Calves) */}
      <ellipse cx="80" cy="320" rx="10" ry="25" fill={getColor('legs')} opacity="0.7" filter="blur(4px)" />
      <ellipse cx="120" cy="320" rx="10" ry="25" fill={getColor('legs')} opacity="0.7" filter="blur(4px)" />

      {/* Note: Back is hidden on this front-facing silhouette, usually you need a flip button */}
    </svg>
  );
}
