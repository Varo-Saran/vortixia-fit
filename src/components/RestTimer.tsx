"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Timer, X, Plus, Minus } from "lucide-react";

interface RestTimerProps {
  isActive: boolean;
  onClose: () => void;
  initialSeconds?: number;
}

export function RestTimer({ isActive, onClose, initialSeconds = 90 }: RestTimerProps) {
  const [timeLeft, setTimeLeft] = useState(initialSeconds);
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    if (!isActive) {
      setTimeLeft(initialSeconds);
      setIsMinimized(false);
      return;
    }

    if (timeLeft <= 0) {
      // Could play a sound here
      return;
    }

    const interval = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, timeLeft, initialSeconds]);

  const addTime = (secs: number) => setTimeLeft(prev => prev + secs);
  const subTime = (secs: number) => setTimeLeft(prev => Math.max(0, prev - secs));

  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const progress = Math.max(0, timeLeft) / initialSeconds;
  const strokeDasharray = 2 * Math.PI * 40; // r=40
  const strokeDashoffset = strokeDasharray * (1 - progress);

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div 
          initial={{ y: 100, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 100, opacity: 0, scale: 0.9 }}
          className={`fixed left-1/2 -translate-x-1/2 z-[90] transition-all duration-300 ${isMinimized ? 'bottom-24' : 'bottom-24'}`}
        >
          {isMinimized ? (
            <button 
              onClick={() => setIsMinimized(false)}
              className="bg-black/90 border border-accent-green/50 p-3 rounded-full flex items-center gap-3 shadow-[0_0_20px_rgba(46,234,130,0.3)] backdrop-blur-md"
            >
               <Timer className={`w-5 h-5 ${timeLeft <= 0 ? 'text-red-500 animate-pulse' : 'text-accent-green'}`} />
               <span className={`font-black text-lg ${timeLeft <= 0 ? 'text-red-500' : 'text-white'}`}>
                 {formatTime(Math.max(0, timeLeft))}
               </span>
            </button>
          ) : (
            <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col items-center gap-4 relative overflow-hidden backdrop-blur-xl w-64">
              <div className="absolute top-0 right-0 p-3">
                <button onClick={onClose} className="p-1 bg-white/5 rounded-full hover:bg-white/10 text-text-muted">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <span className="text-[10px] text-text-muted font-bold uppercase tracking-widest mt-1">Rest Timer</span>

              <div className="relative w-32 h-32 flex items-center justify-center">
                {/* SVG Ring */}
                <svg className="absolute inset-0 w-full h-full -rotate-90">
                  <circle 
                    cx="64" cy="64" r="40" 
                    fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" 
                  />
                  <circle 
                    cx="64" cy="64" r="40" 
                    fill="none" 
                    stroke={timeLeft <= 0 ? '#ef4444' : '#2EEA82'} 
                    strokeWidth="6" 
                    strokeLinecap="round"
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                    className="transition-all duration-1000 ease-linear"
                  />
                </svg>
                <div className="flex flex-col items-center">
                  <span className={`text-4xl font-black ${timeLeft <= 0 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                    {formatTime(Math.max(0, timeLeft))}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4 w-full justify-center">
                <button onClick={() => subTime(15)} className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 text-white">
                  <Minus className="w-4 h-4" />
                </button>
                <button onClick={() => setIsMinimized(true)} className="px-4 py-2 bg-accent-green/10 text-accent-green rounded-full font-bold text-xs border border-accent-green/20">
                  Minimize
                </button>
                <button onClick={() => addTime(15)} className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 text-white">
                  <Plus className="w-4 h-4" />
                </button>
              </div>

            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
