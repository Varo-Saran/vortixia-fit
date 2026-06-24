"use client";

import { useEffect, useState, useCallback } from "react";
import { useRoutineStore, PlannedExercise, TrackingType } from "@/store/useRoutineStore";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Tag, Check, MoreVertical, Plus, Trophy, ArrowRight, Loader2 } from "lucide-react";

export default function ActiveWorkout() {
  const { weeklyPlan, fetchRoutine, isLoading } = useRoutineStore();
  const {
    isActive,
    startTime,
    exercises: storeExercises,
    isSaving,
    lastWorkoutSummary,
    startWorkout,
    finishWorkout,
    saveWorkoutToDb,
    resetWorkout,
    updateSet,
    toggleSetComplete,
    addSet,
    addExerciseToWorkout,
  } = useWorkoutStore();

  const router = useRouter();
  const [time, setTime] = useState("00:00:00");
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);

  // Local state for exercises during this workout session
  const [activeExercises, setActiveExercises] = useState<PlannedExercise[]>([]);
  const [isStarted, setIsStarted] = useState(false);

  useEffect(() => {
    if (weeklyPlan.length === 0) {
      fetchRoutine();
    }
  }, [weeklyPlan.length, fetchRoutine]);

  // Determine today's plan and auto-start if store isn't active
  useEffect(() => {
    if (weeklyPlan.length > 0 && !isStarted && !lastWorkoutSummary) {
      const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const todayName = days[new Date().getDay()];
      const plan = weeklyPlan.find(p => p.day === todayName);

      if (plan && plan.mainLifts && plan.mainLifts.length > 0 && !isActive) {
        startWorkout(plan.title, plan.mainLifts);
      }
      setActiveExercises(plan?.mainLifts || []);
      setIsStarted(true);
    }
  }, [weeklyPlan, isStarted, lastWorkoutSummary, isActive, startWorkout]);

  // Timer
  useEffect(() => {
    if (!startTime || lastWorkoutSummary) return;

    const interval = setInterval(() => {
      const now = new Date();
      const diff = Math.floor((now.getTime() - new Date(startTime).getTime()) / 1000);
      const h = Math.floor(diff / 3600).toString().padStart(2, '0');
      const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
      const s = (diff % 60).toString().padStart(2, '0');
      setTime(`${h}:${m}:${s}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime, lastWorkoutSummary]);

  const handleFinish = useCallback(async () => {
    setShowFinishConfirm(false);
    finishWorkout();
    await saveWorkoutToDb();
  }, [finishWorkout, saveWorkoutToDb]);

  const handleAddExercise = () => {
    const newEx: PlannedExercise = {
      id: Date.now().toString(),
      name: "Freestyle " + (activeExercises.length + 1),
      targetMuscle: "unknown",
      trackingType: "reps_weight",
      weightUnit: "kg",
      targetSets: 3,
      targetValue: "10"
    };
    setActiveExercises([...activeExercises, newEx]);
    addExerciseToWorkout(newEx.name);
  };

  // ——— Success Screen ———
  if (lastWorkoutSummary) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-background px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-accent-green/10 via-transparent to-transparent" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-accent-green/20 blur-[100px] rounded-full" />
        
        <div className="relative z-10 flex flex-col items-center animate-fade-in-up">
          <div className="w-20 h-20 bg-accent-green rounded-full flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(74,222,128,0.5)]">
            <Trophy className="w-10 h-10 text-black" />
          </div>
          <h1 className="text-3xl font-black text-white mb-2">Workout Complete!</h1>
          <p className="text-text-muted text-sm mb-8">Great work, champion.</p>

          <div className="grid grid-cols-2 gap-4 w-full max-w-xs mb-8">
            <div className="glass-card p-4 text-center">
              <div className="text-2xl font-black text-accent-green">{lastWorkoutSummary.totalSets}</div>
              <div className="text-[10px] text-text-muted uppercase font-bold tracking-widest">Sets</div>
            </div>
            <div className="glass-card p-4 text-center">
              <div className="text-2xl font-black text-accent-green">{lastWorkoutSummary.totalVolume.toLocaleString()}</div>
              <div className="text-[10px] text-text-muted uppercase font-bold tracking-widest">Volume (kg)</div>
            </div>
            <div className="glass-card p-4 text-center">
              <div className="text-2xl font-black text-white">{lastWorkoutSummary.durationMins}</div>
              <div className="text-[10px] text-text-muted uppercase font-bold tracking-widest">Minutes</div>
            </div>
            <div className="glass-card p-4 text-center">
              <div className="text-2xl font-black text-yellow-400">+{lastWorkoutSummary.xpEarned}</div>
              <div className="text-[10px] text-text-muted uppercase font-bold tracking-widest">XP Earned</div>
            </div>
          </div>

          <button
            onClick={() => { resetWorkout(); router.push('/'); }}
            className="bg-accent-green text-black font-black py-4 px-8 rounded-2xl flex items-center gap-2 active:scale-95 transition-transform shadow-[0_0_20px_rgba(74,222,128,0.3)]"
          >
            CONTINUE <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </main>
    );
  }

  // ——— Loading ———
  if (isLoading || weeklyPlan.length === 0) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 text-accent-green animate-spin" />
      </main>
    );
  }

  const todayPlan = (() => {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const todayName = days[new Date().getDay()];
    return weeklyPlan.find(p => p.day === todayName);
  })();

  const renderTableHeader = (style: TrackingType) => {
    if (style === 'cardio_hr') {
      return (
        <div className="grid grid-cols-12 gap-1 text-[10px] font-bold text-text-muted uppercase tracking-widest mt-2 px-1 text-center z-10">
          <div className="col-span-2 text-left">Set</div>
          <div className="col-span-4">Duration</div>
          <div className="col-span-4">Intensity</div>
          <div className="col-span-2 flex justify-center"><Check className="w-4 h-4 text-text-muted" /></div>
        </div>
      );
    }
    if (style === 'time_only') {
      return (
        <div className="grid grid-cols-12 gap-1 text-[10px] font-bold text-text-muted uppercase tracking-widest mt-2 px-1 text-center z-10">
          <div className="col-span-2 text-left">Set</div>
          <div className="col-span-4">Previous</div>
          <div className="col-span-4">Time</div>
          <div className="col-span-2 flex justify-center"><Check className="w-4 h-4 text-text-muted" /></div>
        </div>
      );
    }
    if (style === 'reps_only') {
      return (
        <div className="grid grid-cols-12 gap-1 text-[10px] font-bold text-text-muted uppercase tracking-widest mt-2 px-1 text-center z-10">
          <div className="col-span-2 text-left">Set</div>
          <div className="col-span-4">Previous</div>
          <div className="col-span-4">Reps</div>
          <div className="col-span-2 flex justify-center"><Check className="w-4 h-4 text-text-muted" /></div>
        </div>
      );
    }
    return (
      <div className="grid grid-cols-12 gap-1 text-[10px] font-bold text-text-muted uppercase tracking-widest mt-2 px-1 text-center z-10">
        <div className="col-span-2 text-left">Set</div>
        <div className="col-span-3">Previous</div>
        <div className="col-span-3">Weight</div>
        <div className="col-span-2">{style === 'time_weight' ? 'Time' : 'Reps'}</div>
        <div className="col-span-2 flex justify-center"><Check className="w-4 h-4 text-text-muted" /></div>
      </div>
    );
  };

  const renderSetRow = (style: TrackingType, setIndex: number, exercise: PlannedExercise) => {
    // Look up the corresponding store exercise set if available
    const storeExercise = storeExercises.find(e => e.name === exercise.name || e.id === exercise.id);
    const storeSet = storeExercise?.sets[setIndex];
    const isCompleted = storeSet?.isCompleted || false;

    const rowClass = `grid grid-cols-12 gap-1 items-center rounded-xl p-1.5 text-center z-10 transition-colors ${isCompleted ? 'bg-accent-green/10 border border-accent-green/30' : 'bg-white/5 border border-white/10'}`;
    const numClass = `col-span-2 font-black text-sm ${isCompleted ? 'text-accent-green' : 'text-white'}`;
    const inputWrapperClass = `rounded-lg p-2 border ${isCompleted ? 'bg-black/40 border-white/5' : 'bg-black/60 border-white/10'}`;
    const inputClass = `w-full bg-transparent text-center font-black text-white outline-none placeholder-text-muted/30 ${isCompleted ? 'opacity-50' : ''}`;
    
    const prevText = exercise.targetValue;
    const defaultReps = isCompleted ? exercise.targetValue.split('-')[0] : "";

    const handleToggle = () => {
      if (storeExercise && storeSet) {
        toggleSetComplete(storeExercise.id, storeSet.id);
      }
    };

    const handleWeightChange = (value: string) => {
      if (storeExercise && storeSet) {
        updateSet(storeExercise.id, storeSet.id, value ? Number(value) : '', storeSet.reps);
      }
    };

    const handleRepsChange = (value: string) => {
      if (storeExercise && storeSet) {
        updateSet(storeExercise.id, storeSet.id, storeSet.weight, value ? Number(value) : '');
      }
    };

    if (style === 'cardio_hr') {
      return (
        <div key={setIndex} className={rowClass}>
          <div className={numClass}>{setIndex + 1}</div>
          <div className={`col-span-4 ${inputWrapperClass}`}>
            <input type="text" placeholder="e.g. 30m" className={inputClass} style={{ fontSize: '16px' }} />
          </div>
          <div className={`col-span-4 ${inputWrapperClass}`}>
            <input type="text" placeholder="Zone 2" className={inputClass} style={{ fontSize: '16px' }} />
          </div>
          <div className="col-span-2 flex justify-center">
            <input type="checkbox" checked={isCompleted} onChange={handleToggle} className={`w-5 h-5 rounded-md border-2 cursor-pointer ${isCompleted ? 'accent-accent-green' : 'border-white/20'}`} />
          </div>
        </div>
      );
    }
    if (style === 'time_only') {
      return (
        <div key={setIndex} className={rowClass}>
          <div className={numClass}>{setIndex + 1}</div>
          <div className="col-span-4 text-[10px] text-text-muted font-bold">{prevText}</div>
          <div className={`col-span-4 ${inputWrapperClass}`}>
            <input type="text" placeholder="e.g. 60s" className={inputClass} style={{ fontSize: '16px' }} />
          </div>
          <div className="col-span-2 flex justify-center">
            <input type="checkbox" checked={isCompleted} onChange={handleToggle} className={`w-5 h-5 rounded-md border-2 cursor-pointer ${isCompleted ? 'accent-accent-green' : 'border-white/20'}`} />
          </div>
        </div>
      );
    }
    if (style === 'reps_only') {
      return (
        <div key={setIndex} className={rowClass}>
          <div className={numClass}>{setIndex + 1}</div>
          <div className="col-span-4 text-[10px] text-text-muted font-bold">{prevText}</div>
          <div className={`col-span-4 ${inputWrapperClass}`}>
            <input type="number" placeholder="-" onChange={(e) => handleRepsChange(e.target.value)} className={inputClass} style={{ fontSize: '16px' }} />
          </div>
          <div className="col-span-2 flex justify-center">
            <input type="checkbox" checked={isCompleted} onChange={handleToggle} className={`w-5 h-5 rounded-md border-2 cursor-pointer ${isCompleted ? 'accent-accent-green' : 'border-white/20'}`} />
          </div>
        </div>
      );
    }
    // Standard (reps_weight or time_weight)
    return (
      <div key={setIndex} className={rowClass}>
        <div className={numClass}>{setIndex + 1}</div>
        <div className="col-span-3 text-[10px] text-text-muted font-bold">{prevText}</div>
        <div className={`col-span-3 ${inputWrapperClass}`}>
          <input type="number" placeholder="-" onChange={(e) => handleWeightChange(e.target.value)} className={inputClass} style={{ fontSize: '16px' }} />
        </div>
        <div className={`col-span-2 ${inputWrapperClass}`}>
          <input type="number" placeholder="-" onChange={(e) => handleRepsChange(e.target.value)} className={inputClass} style={{ fontSize: '16px' }} />
        </div>
        <div className="col-span-2 flex justify-center">
          <input type="checkbox" checked={isCompleted} onChange={handleToggle} className={`w-5 h-5 rounded-md border-2 cursor-pointer ${isCompleted ? 'accent-accent-green' : 'border-white/20'}`} />
        </div>
      </div>
    );
  };

  return (
    <main className="min-h-screen flex flex-col bg-background relative pb-28">
      {/* Sticky Top Header */}
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-xl px-4 py-3 flex justify-between items-center border-b border-white/5 pt-[max(env(safe-area-inset-top),16px)]">
        <div className="flex flex-col">
          <span className="text-[10px] text-text-muted font-bold uppercase tracking-widest">{activeExercises.length === 0 ? 'Freestyle Mode' : todayPlan?.title || 'Active Workout'}</span>
          <h1 className="text-xl font-black text-accent-green tabular-nums">{time}</h1>
        </div>
        <button 
          onClick={() => setShowFinishConfirm(true)}
          disabled={isSaving}
          className="bg-accent-green text-black px-5 py-2 rounded-xl font-black text-sm active:scale-95 transition-transform shadow-[0_0_15px_rgba(74,222,128,0.3)] disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'FINISH'}
        </button>
      </header>

      {/* Exercises List */}
      <div className="px-3 flex flex-col gap-4 mt-4 animate-fade-in-up">
        {activeExercises.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center p-8 mt-10 glass-card">
            <span className="text-4xl mb-4">🚀</span>
            <h2 className="text-xl font-black mb-2">Freestyle Mode</h2>
            <p className="text-sm text-text-muted">Tap the Add Exercise button below to start building your workout.</p>
          </div>
        )}

        {activeExercises.map((exercise) => (
          <section key={exercise.id} className="glass-card p-4 rounded-3xl flex flex-col gap-3 relative overflow-hidden">
            {/* Glow */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-accent-green/10 blur-3xl rounded-full pointer-events-none" />

            <div className="flex justify-between items-start z-10">
              <h2 className="font-extrabold text-lg text-white pr-4">{exercise.name}</h2>
              <button className="text-text-muted hover:text-white px-2">
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>
            
            <span className="text-[10px] text-text-muted font-bold tracking-widest uppercase flex items-center gap-1 z-10 -mt-1">
              <Tag className="w-3 h-3" />
              {exercise.trackingType.replace('_', ' ')} · Unit: {exercise.weightUnit}
            </span>

            {/* Table Header */}
            {renderTableHeader(exercise.trackingType)}

            {/* Sets */}
            {Array.from({ length: exercise.targetSets }).map((_, setIndex) => 
              renderSetRow(exercise.trackingType, setIndex, exercise)
            )}

            <button 
              onClick={() => {
                const storeEx = storeExercises.find(e => e.name === exercise.name || e.id === exercise.id);
                if (storeEx) addSet(storeEx.id);
                // Also update local state
                setActiveExercises(prev => prev.map(ex =>
                  ex.id === exercise.id ? { ...ex, targetSets: ex.targetSets + 1 } : ex
                ));
              }}
              className="mt-2 text-[10px] uppercase tracking-widest font-bold text-text-muted w-full py-2 flex items-center justify-center gap-1 hover:text-white transition-colors z-10 bg-white/5 rounded-lg border border-white/5"
            >
              + Add Set
            </button>
          </section>
        ))}
      </div>

      {/* Sticky Bottom Add Exercise */}
      <div className="fixed bottom-0 left-0 w-full bg-black/90 backdrop-blur-xl p-4 flex justify-center pb-[max(env(safe-area-inset-bottom),20px)] border-t border-white/10 z-50">
        <button onClick={handleAddExercise} className="bg-white/10 hover:bg-white/20 border border-white/10 text-white font-black py-4 px-8 rounded-2xl shadow-lg w-full max-w-md flex items-center justify-center gap-2 transition-colors active:scale-95">
          <Plus className="w-5 h-5 text-accent-green" strokeWidth={3} />
          ADD EXERCISE
        </button>
      </div>

      {/* Finish Confirmation Modal */}
      {showFinishConfirm && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111] border border-white/10 w-full max-w-sm rounded-3xl p-6">
            <h3 className="text-xl font-black text-white mb-2">Finish Workout?</h3>
            <p className="text-xs text-text-muted mb-6">
              Your completed sets will be saved to your profile.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowFinishConfirm(false)}
                className="flex-1 py-3 bg-white/10 text-white font-bold rounded-xl"
              >
                Cancel
              </button>
              <button 
                onClick={handleFinish}
                className="flex-1 py-3 bg-accent-green text-black font-bold rounded-xl active:scale-95 transition-transform"
              >
                Finish & Save
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
