"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Timer, X, Plus, Minus } from "lucide-react";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useSettingsStore } from "@/store/useSettingsStore";

const FALLBACK_REST_SECONDS = 90;

type AudioContextConstructor = new () => AudioContext;

function getAudioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === "undefined") return null;

  const audioWindow = window as typeof window & {
    webkitAudioContext?: AudioContextConstructor;
  };
  return audioWindow.AudioContext ?? audioWindow.webkitAudioContext ?? null;
}

export function RestTimer() {
  const {
    isResting,
    restTimeRemaining,
    restCycleId,
    pendingRestFeedbackCycleId,
    stopRest,
    addRestTime,
    syncRestTimer,
    consumeRestCompletionFeedback,
  } = useWorkoutStore();
  const { soundEffects, hapticFeedback } = useSettingsStore();

  const [isMinimized, setIsMinimized] = useState(false);
  const [initialSeconds, setInitialSeconds] = useState(FALLBACK_REST_SECONDS);
  const activeCycleRef = useRef<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!isResting || !restCycleId) {
      activeCycleRef.current = null;
      return;
    }

    if (activeCycleRef.current !== restCycleId) {
      activeCycleRef.current = restCycleId;
      setInitialSeconds(restTimeRemaining || FALLBACK_REST_SECONDS);
      setIsMinimized(false);
      return;
    }

    setInitialSeconds((current) => Math.max(current, restTimeRemaining));
  }, [isResting, restCycleId, restTimeRemaining]);

  useEffect(() => {
    if (!isResting) return;

    syncRestTimer();

    const interval = window.setInterval(syncRestTimer, 1000);
    const handleFocus = () => syncRestTimer();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") syncRestTimer();
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isResting, syncRestTimer]);

  useEffect(() => {
    if (!soundEffects) return;

    const unlockAudio = () => {
      const AudioContextClass = getAudioContextConstructor();
      if (!AudioContextClass) return;

      try {
        const context = audioContextRef.current ?? new AudioContextClass();
        audioContextRef.current = context;
        if (context.state === "suspended") {
          void context.resume().catch(() => undefined);
        }
      } catch {
        // Audio feedback is optional and must never affect the timer.
      }
    };

    window.addEventListener("pointerdown", unlockAudio, true);
    window.addEventListener("keydown", unlockAudio, true);

    return () => {
      window.removeEventListener("pointerdown", unlockAudio, true);
      window.removeEventListener("keydown", unlockAudio, true);
    };
  }, [soundEffects]);

  useEffect(() => () => {
    const context = audioContextRef.current;
    audioContextRef.current = null;
    if (context && context.state !== "closed") {
      void context.close().catch(() => undefined);
    }
  }, []);

  const playCompletionTone = useCallback(async () => {
    const AudioContextClass = getAudioContextConstructor();
    if (!AudioContextClass) return;

    try {
      const context = audioContextRef.current ?? new AudioContextClass();
      audioContextRef.current = context;
      if (context.state === "suspended") await context.resume();
      if (context.state !== "running") return;

      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const now = context.currentTime;

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.18, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.addEventListener("ended", () => {
        oscillator.disconnect();
        gain.disconnect();
      }, { once: true });
      oscillator.start(now);
      oscillator.stop(now + 0.23);
    } catch {
      // Browsers may block audio outside an unlocked interaction context.
    }
  }, []);

  useEffect(() => {
    const cycleId = pendingRestFeedbackCycleId;
    if (!cycleId || !consumeRestCompletionFeedback(cycleId)) return;

    if (soundEffects) void playCompletionTone();

    if (hapticFeedback && typeof navigator.vibrate === "function") {
      try {
        navigator.vibrate([120, 80, 120]);
      } catch {
        // Haptic feedback is optional and unsupported on some browsers.
      }
    }
  }, [
    consumeRestCompletionFeedback,
    hapticFeedback,
    pendingRestFeedbackCycleId,
    playCompletionTone,
    soundEffects,
  ]);

  const addTime = (secs: number) => {
    addRestTime(secs);
  };

  const subTime = (secs: number) => {
    if (restTimeRemaining <= secs) {
      stopRest();
    } else {
      addRestTime(-secs);
    }
  };

  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const progress = Math.min(
    1,
    Math.max(0, restTimeRemaining) / (initialSeconds || FALLBACK_REST_SECONDS),
  );
  const strokeDasharray = 2 * Math.PI * 40; // r=40
  const strokeDashoffset = strokeDasharray * (1 - progress);

  return (
    <AnimatePresence>
      {isResting && (
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
               <Timer className={`w-5 h-5 ${restTimeRemaining <= 0 ? 'text-red-500 animate-pulse' : 'text-accent-green'}`} />
               <span className={`font-black text-lg ${restTimeRemaining <= 0 ? 'text-red-500' : 'text-white'}`}>
                 {formatTime(Math.max(0, restTimeRemaining))}
               </span>
            </button>
          ) : (
            <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col items-center gap-4 relative overflow-hidden backdrop-blur-xl w-64">
              <div className="absolute top-0 right-0 p-3">
                <button onClick={stopRest} className="p-1 bg-white/5 rounded-full hover:bg-white/10 text-text-muted" aria-label="Close">
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
                    stroke={restTimeRemaining <= 0 ? '#ef4444' : '#2EEA82'} 
                    strokeWidth="6" 
                    strokeLinecap="round"
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                    className="transition-all duration-1000 ease-linear"
                  />
                </svg>
                <div className="flex flex-col items-center">
                  <span className={`text-4xl font-black ${restTimeRemaining <= 0 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                    {formatTime(Math.max(0, restTimeRemaining))}
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
