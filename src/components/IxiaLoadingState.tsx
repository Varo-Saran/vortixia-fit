"use client";

import { useEffect, useState } from "react";
import Orb from "./Orb";

export function IxiaLoadingState() {
  const [stage, setStage] = useState(0);

  const messages = [
    "iXiA Ai is analyzing your goals...",
    "iXiA Ai is deciding optimal exercises...",
    "iXiA Ai thinking...",
    "iXiA Ai calculating sets & reps...",
    "Almost ready..."
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setStage((prev) => (prev < messages.length - 1 ? prev + 1 : prev));
    }, 1200); // cycle message every 1.2s

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center p-12 space-y-8 animate-fade-in relative z-10 min-h-[350px]">
      
      {/* 3D WebGL Orb Animation */}
      <div className="relative flex items-center justify-center w-40 h-40">
        <Orb
          hoverIntensity={0.5}
          rotateOnHover={true}
          hue={0}
          forceHoverState={true}
          backgroundColor="transparent"
        />
      </div>
      
      {/* Messages Carousel */}
      <div className="text-center h-16 relative w-full overflow-hidden mt-8">
        {messages.map((msg, idx) => (
          <p
            key={idx}
            className={`absolute w-full text-xs font-black tracking-[0.2em] uppercase transition-all duration-700
              ${idx === stage ? "text-white opacity-100 scale-100 translate-y-0" : 
                idx < stage ? "text-[#2EEA82]/0 opacity-0 scale-95 -translate-y-8" : 
                "text-[#2EEA82]/0 opacity-0 scale-95 translate-y-8"}
            `}
            style={{ textShadow: idx === stage ? '0 0 20px rgba(255,255,255,0.5)' : 'none' }}
          >
            {msg}
          </p>
        ))}
      </div>
    </div>
  );
}
