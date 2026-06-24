"use client";

import { useWorkoutStore } from "@/store/useWorkoutStore";
import { ChevronDown, Play, Check, Timer, X, Plus, Home, Settings2, Trophy, Star, Flame, TrendingUp, Dumbbell, Activity, Calendar, Calculator } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTrophyStore } from "@/store/useTrophyStore";
import { SuccessCarousel } from "@/components/SuccessCarousel";
import { PlateCalculator } from "@/components/PlateCalculator";
import { RestTimer } from "@/components/RestTimer";
import { ExerciseSelectionModal } from "@/components/ExerciseSelectionModal";
import { useRecoveryStore, MuscleGroup } from "@/store/useRecoveryStore";
import { useSocialStore } from "@/store/useSocialStore";

export default function ActiveWorkoutPage() {
  const router = useRouter();
  const { 
    isActive, startTime, routineName, exercises, 
    restTimeRemaining, isResting, 
    finishWorkout, updateSet, toggleSetComplete, 
    stopRest, addRestTime, tickRest, addSet, addExerciseToWorkout
  } = useWorkoutStore();

  const [elapsed, setElapsed] = useState("00:00");
  const [showSummary, setShowSummary] = useState(false);
  
  // Plate Calculator State
  const [isPlateCalcOpen, setIsPlateCalcOpen] = useState(false);
  const [plateCalcWeight, setPlateCalcWeight] = useState(0);

  // Exercise Modal State
  const [isExerciseModalOpen, setIsExerciseModalOpen] = useState(false);

  // Global Timer and Rest Ticker
  useEffect(() => {
    if (!isActive || !startTime || showSummary) return;
    
    const interval = setInterval(() => {
      // Calculate elapsed time
      const now = new Date();
      const diff = Math.floor((now.getTime() - startTime.getTime()) / 1000);
      const minutes = Math.floor(diff / 60).toString().padStart(2, '0');
      const seconds = (diff % 60).toString().padStart(2, '0');
      setElapsed(`${minutes}:${seconds}`);

      // Tick rest timer
      tickRest();
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, startTime, tickRest]);

  const handleFinish = () => {
    // Calculate volume for Gamification and Duels
    const totalVolume = exercises.reduce((total, ex) => {
      return total + ex.sets.reduce((setTotal, set) => {
        if (set.isCompleted && typeof set.weight === 'number' && typeof set.reps === 'number') {
          return setTotal + (set.weight * set.reps);
        }
        return setTotal;
      }, 0);
    }, 0);

    const diff = Math.floor((new Date().getTime() - startTime!.getTime()) / 1000);
    const durationMins = Math.floor(diff / 60);
    const isAiGenerated = routineName.startsWith('AI') || routineName.includes('AI');

    // Calculate XP roughly as 1 XP per 100 volume + 10 XP per minute
    const earnedXP = Math.floor(totalVolume / 100) + (durationMins * 10);

    // Push progress to Social Active Duels
    useSocialStore.getState().updateDuelProgress(totalVolume, earnedXP);

    // Apply fatigue based on completed sets
    exercises.forEach(ex => {
      const completedSetsCount = ex.sets.filter(s => s.isCompleted).length;
      if (completedSetsCount > 0) {
        // Very basic mapping of exercise name to MuscleGroup
        let muscle: MuscleGroup = 'core';
        const name = ex.name.toLowerCase();
        if (name.includes('bench') || name.includes('push') || name.includes('chest') || name.includes('fly')) muscle = 'chest';
        else if (name.includes('row') || name.includes('pull') || name.includes('deadlift') || name.includes('lat')) muscle = 'back';
        else if (name.includes('squat') || name.includes('leg') || name.includes('calf') || name.includes('lunge')) muscle = 'legs';
        else if (name.includes('curl') || name.includes('tricep') || name.includes('extension')) muscle = 'arms';
        else if (name.includes('press') && name.includes('overhead') || name.includes('raise') || name.includes('shoulder')) muscle = 'shoulders';
        
        // 5% fatigue per completed set
        useRecoveryStore.getState().applyFatigue(muscle, completedSetsCount * 5);
      }
    });

    useTrophyStore.getState().checkAchievements({
      isFirstWorkout: true, // Mocked to always grant for testing
      totalVolume,
      durationMins,
      isAiGenerated
    });

    setShowSummary(true);
  };

  const handleCloseSummary = (href: string) => {
    finishWorkout();
    router.push(href);
  };

  const formatRest = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Offline State
  const [isOffline, setIsOffline] = useState(false);
  useEffect(() => {
    setIsOffline(!navigator.onLine);
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (showSummary) {
    // Calculate total volume for the mock data
    const totalVolume = exercises.reduce((total, ex) => {
      return total + ex.sets.reduce((setTotal, set) => {
        if (set.isCompleted && typeof set.weight === 'number' && typeof set.reps === 'number') {
          return setTotal + (set.weight * set.reps);
        }
        return setTotal;
      }, 0);
    }, 0);

    const totalSets = exercises.reduce((total, ex) => {
      return total + ex.sets.filter(s => s.isCompleted).length;
    }, 0);

    return (
      <main className="flex min-h-screen flex-col items-center pt-8 p-4 bg-background relative overflow-y-auto overflow-x-hidden pb-24">
        <SuccessCarousel 
          routineName={routineName}
          totalVolume={totalVolume}
          totalSets={totalSets}
          elapsed={elapsed}
          exercises={exercises}
          onDone={() => handleCloseSummary("/")}
        />
      </main>
    );
  }

  if (!isActive) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-background">
        <h1 className="text-xl font-bold text-white mb-4">No Active Workout</h1>
        <button onClick={() => router.push("/routines")} className="text-accent-green font-bold">Go to Routines</button>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-background relative pb-32">
      {isOffline && (
        <div className="w-full bg-orange-500/20 text-orange-400 text-xs font-bold text-center py-2 px-4 border-b border-orange-500/30">
          Offline mode active. Progress is securely saved locally on this phone.
        </div>
      )}
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 w-full bg-background/80 backdrop-blur-md border-b border-white/5 px-4 pt-[var(--notch-top)] pb-4 flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-[10px] text-accent-green font-bold uppercase tracking-widest">{routineName}</span>
          <span className="text-2xl font-black text-white font-mono">{elapsed}</span>
        </div>
        <button 
          onClick={handleFinish}
          className="bg-accent-red/20 text-accent-red border border-accent-red/30 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest active:scale-95 transition-transform"
        >
          Finish
        </button>
      </header>

      {/* Exercises */}
      <div className="flex flex-col gap-6 p-4">
        {exercises.map((ex, exIdx) => (
          <div key={ex.id} className="glass-card flex flex-col overflow-hidden animate-fade-in-up" style={{ animationDelay: `${exIdx * 0.1}s` }}>
            <div className="p-4 bg-white/5 border-b border-white/5 flex justify-between items-center">
              <h2 className="text-lg font-black text-white">{ex.name}</h2>
              <button aria-label="Exercise Settings" className="text-text-muted hover:text-white"><Settings2 className="w-4 h-4" /></button>
            </div>
            
            <div className="p-2 flex flex-col gap-1">
              {/* Table Header */}
              <div className="flex items-center px-2 py-1 text-[10px] uppercase font-bold text-text-muted tracking-widest">
                <div className="w-8 text-center">Set</div>
                <div className="flex-1 text-center">Previous</div>
                <div className="w-16 flex items-center justify-center gap-1">
                  LBS
                  <button onClick={() => {
                    // Try to grab the weight of the last logged set or current input to initialize calc
                    const lastWeight = ex.sets.findLast(s => typeof s.weight === 'number' && s.weight > 0)?.weight || 135;
                    setPlateCalcWeight(Number(lastWeight));
                    setIsPlateCalcOpen(true);
                  }} className="text-accent-green hover:bg-accent-green/20 p-1 rounded-md transition-colors">
                    <Calculator className="w-3 h-3" />
                  </button>
                </div>
                <div className="w-16 text-center">Reps</div>
                <div className="w-10 text-center"><Check className="w-3 h-3 mx-auto" /></div>
              </div>

              {/* Sets */}
              {ex.sets.map((set, i) => (
                <div key={set.id} className={`flex items-center px-2 py-2 rounded-lg transition-colors ${set.isCompleted ? 'bg-accent-green/5' : ''}`}>
                  <div className="w-8 text-center text-xs font-bold text-text-muted">{i + 1}</div>
                  <div className="flex-1 text-center text-xs text-text-muted/50 font-medium truncate">
                    {set.previousWeight > 0 ? `${set.previousWeight}lbs × ${set.previousReps}` : '-'}
                  </div>
                  <div className="w-16 px-1">
                    <input 
                      type="number"
                      value={set.weight}
                      onChange={(e) => updateSet(ex.id, set.id, e.target.value === '' ? '' : Number(e.target.value), set.reps)}
                      className={`w-full bg-black/50 border rounded-md text-center text-sm font-bold py-1 outline-none transition-colors ${set.isCompleted ? 'border-transparent text-white/50' : 'border-white/10 text-white focus:border-accent-green focus:bg-accent-green/10'}`}
                      placeholder="-"
                    />
                  </div>
                  <div className="w-16 px-1">
                    <input 
                      type="number"
                      value={set.reps}
                      onChange={(e) => updateSet(ex.id, set.id, set.weight, e.target.value === '' ? '' : Number(e.target.value))}
                      className={`w-full bg-black/50 border rounded-md text-center text-sm font-bold py-1 outline-none transition-colors ${set.isCompleted ? 'border-transparent text-white/50' : 'border-white/10 text-white focus:border-accent-green focus:bg-accent-green/10'}`}
                      placeholder="-"
                    />
                  </div>
                  <div className="w-10 flex justify-center">
                    <button 
                      onClick={() => toggleSetComplete(ex.id, set.id)}
                      className={`w-7 h-7 rounded-md flex items-center justify-center transition-all ${set.isCompleted ? 'bg-accent-green text-black shadow-[0_0_10px_rgba(74,222,128,0.4)]' : 'bg-white/10 text-white/30 hover:bg-white/20'}`}
                    >
                      <Check className="w-4 h-4 stroke-[3]" />
                    </button>
                  </div>
                </div>
              ))}
              
              <button 
                onClick={() => addSet(ex.id)}
                className="mt-2 py-2 text-xs font-bold uppercase tracking-widest text-text-muted hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              >
                + Add Set
              </button>
            </div>
          </div>
        ))}
        
        <button 
          onClick={() => setIsExerciseModalOpen(true)}
          className="w-full py-4 border-2 border-dashed border-white/10 rounded-xl text-xs font-bold uppercase tracking-widest text-text-muted hover:border-white/30 hover:text-white transition-all"
        >
          + Add Exercise
        </button>
      </div>

      <RestTimer 
        isActive={isResting} 
        onClose={stopRest} 
        initialSeconds={90} 
      />

      <PlateCalculator 
        isOpen={isPlateCalcOpen} 
        onClose={() => setIsPlateCalcOpen(false)} 
        targetWeight={plateCalcWeight} 
      />

      <ExerciseSelectionModal
        isOpen={isExerciseModalOpen}
        onClose={() => setIsExerciseModalOpen(false)}
        onSelect={(exercise) => {
          addExerciseToWorkout(exercise.name);
        }}
      />
    </main>
  );
}
