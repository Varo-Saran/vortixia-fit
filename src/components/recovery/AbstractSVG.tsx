import React from 'react';
import { RecoveryData } from '@/store/useRecoveryStore';

interface Props {
  muscles: RecoveryData[];
}

export function AbstractSVG({ muscles }: Props) {
  const getColor = (id: string) => {
    const m = muscles.find(m => m.id === id);
    if (!m) return '#555';
    if (m.recoveryPercentage < 30) return '#ef4444'; // Red
    if (m.recoveryPercentage < 70) return '#eab308'; // Yellow
    return '#22c55e'; // Green
  };

  const getOpacity = (id: string) => {
    const m = muscles.find(m => m.id === id);
    if (!m) return 0.2;
    return 0.4 + (m.recoveryPercentage / 100) * 0.6; 
  };

  return (
    <svg viewBox="0 0 400 400" className="w-full h-full max-w-xs drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
      {/* Background Web */}
      <polygon points="200,50 350,125 350,275 200,350 50,275 50,125" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2"/>
      <polygon points="200,100 300,150 300,250 200,300 100,250 100,150" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2"/>
      <polygon points="200,150 250,175 250,225 200,250 150,225 150,175" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2"/>
      
      {/* Web Spokes */}
      <line x1="200" y1="200" x2="200" y2="50" stroke="rgba(255,255,255,0.1)" strokeWidth="2"/>
      <line x1="200" y1="200" x2="350" y2="125" stroke="rgba(255,255,255,0.1)" strokeWidth="2"/>
      <line x1="200" y1="200" x2="350" y2="275" stroke="rgba(255,255,255,0.1)" strokeWidth="2"/>
      <line x1="200" y1="200" x2="200" y2="350" stroke="rgba(255,255,255,0.1)" strokeWidth="2"/>
      <line x1="200" y1="200" x2="50" y2="275" stroke="rgba(255,255,255,0.1)" strokeWidth="2"/>
      <line x1="200" y1="200" x2="50" y2="125" stroke="rgba(255,255,255,0.1)" strokeWidth="2"/>

      {/* Nodes (Shoulders, Chest, Back, Arms, Core, Legs) */}
      <circle cx="200" cy="50" r="15" fill={getColor('shoulders')} opacity={getOpacity('shoulders')} />
      <circle cx="350" cy="125" r="15" fill={getColor('chest')} opacity={getOpacity('chest')} />
      <circle cx="350" cy="275" r="15" fill={getColor('back')} opacity={getOpacity('back')} />
      <circle cx="200" cy="350" r="15" fill={getColor('legs')} opacity={getOpacity('legs')} />
      <circle cx="50" cy="275" r="15" fill={getColor('core')} opacity={getOpacity('core')} />
      <circle cx="50" cy="125" r="15" fill={getColor('arms')} opacity={getOpacity('arms')} />

      {/* Node Labels */}
      <text x="200" y="30" fill="white" fontSize="12" textAnchor="middle" fontWeight="bold">Shoulders</text>
      <text x="370" y="130" fill="white" fontSize="12" textAnchor="start" fontWeight="bold">Chest</text>
      <text x="370" y="280" fill="white" fontSize="12" textAnchor="start" fontWeight="bold">Back</text>
      <text x="200" y="380" fill="white" fontSize="12" textAnchor="middle" fontWeight="bold">Legs</text>
      <text x="30" y="280" fill="white" fontSize="12" textAnchor="end" fontWeight="bold">Core</text>
      <text x="30" y="130" fill="white" fontSize="12" textAnchor="end" fontWeight="bold">Arms</text>

      {/* Central Core Glow */}
      <circle cx="200" cy="200" r="25" fill="#3b82f6" opacity="0.3" filter="blur(5px)"/>
      <circle cx="200" cy="200" r="10" fill="#60a5fa" />
    </svg>
  );
}
