"use client";

import { type WorkoutSet, useWorkoutStore } from "@/store/useWorkoutStore";
import type { TrackingType, WeightUnit } from "@/store/useRoutineStore";
import { Check, X, Settings2, Calculator } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SuccessCarousel } from "@/components/SuccessCarousel";
import { PlateCalculator } from "@/components/PlateCalculator";
import { ExerciseSelectionModal } from "@/components/ExerciseSelectionModal";
import { toast } from "react-hot-toast";

const TRACKING_MODES: ReadonlyArray<{ id: TrackingType; label: string }> = [
  { id: 'reps_weight', label: 'Weight & Reps' },
  { id: 'reps_only', label: 'Reps Only' },
  { id: 'time_weight', label: 'Time & Weight' },
  { id: 'time_only', label: 'Time Only' },
  { id: 'cardio_hr', label: 'Cardio & HR' },
];

const WEIGHT_UNITS: ReadonlyArray<{ id: WeightUnit; label: string }> = [
  { id: 'lbs', label: 'LBS' },
  { id: 'kg', label: 'KG' },
  { id: 'plates', label: 'Plates' },
  { id: 'unitless', label: 'Unitless' },
];

export default function ActiveWorkoutPage() {
  const router = useRouter();
  const { 
    isActive, startTime, routineName, exercises, 
    isSaving, completionStatus, lastWorkoutSummary,
    finishWorkout, updateSet, toggleSetComplete, 
    addSet, addExerciseToWorkout,
    completeWorkout, resetWorkout,
    changeExerciseTracking
  } = useWorkoutStore();

  const [elapsed, setElapsed] = useState("00:00");
  const [showSummary, setShowSummary] = useState(false);
  const isSummaryVisible = showSummary || Boolean(
    isActive
    && lastWorkoutSummary
    && (completionStatus === 'committed' || completionStatus === 'queued'),
  );
  
  // Plate Calculator State
  const [isPlateCalcOpen, setIsPlateCalcOpen] = useState(false);
  const [plateCalcWeight, setPlateCalcWeight] = useState(0);
  const [plateCalcContext, setPlateCalcContext] = useState<{ exerciseId: string; setId: string; reps: number | '' } | null>(null);

  // Exercise Settings Modal State
  const [activeSettingsExerciseId, setActiveSettingsExerciseId] = useState<string | null>(null);

  // Exercise Modal State
  const [isExerciseModalOpen, setIsExerciseModalOpen] = useState(false);

  // Global Timer
  useEffect(() => {
    if (!isActive || !startTime || isSummaryVisible) return;
    
    const interval = setInterval(() => {
      // Calculate elapsed time safely
      const now = new Date();
      const diff = Math.floor((now.getTime() - new Date(startTime).getTime()) / 1000);
      const minutes = Math.floor(diff / 60).toString().padStart(2, '0');
      const seconds = (diff % 60).toString().padStart(2, '0');
      setElapsed(`${minutes}:${seconds}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, startTime, isSummaryVisible]);

  const handleFinish = async () => {
    try {
      const outcome = await completeWorkout();
      if (outcome.kind === 'committed') {
        setShowSummary(true);
        return;
      }
      if (outcome.kind === 'queued') {
        toast("Workout saved on this device and pending sync.", { icon: "⏳" });
        setShowSummary(true);
        return;
      }

      if (outcome.reason === 'conflict') {
        toast.error("This workout conflicts with an earlier completion. Your current workout was kept for review.");
      } else if (outcome.reason === 'storage') {
        toast.error("This workout could not be saved locally. Keep this page open and try again.");
      } else {
        toast.error("Complete at least one valid set before finishing your workout.");
      }
    } catch {
      console.error("Workout completion failed");
      toast.error("Workout completion failed. Your active workout was kept.");
    }
  };

  const handleCloseSummary = (href: string) => {
    if (isSaving) {
      toast("Still saving your workout progress. Please wait a moment...", { icon: "⏳" });
      return;
    }
    finishWorkout();
    router.push(href);
  };

  const handleCancelWorkout = () => {
    if (confirm("Discard this workout session? Your progress will not be saved.")) {
      resetWorkout();
      toast("Workout discarded.");
      router.push("/routines");
    }
  };

  // Format the previous logs dynamically based on the tracking type
  const formatPrevious = (
    set: WorkoutSet,
    trackingType: TrackingType,
    weightUnit: WeightUnit,
  ) => {
    const weightVal = set.previousWeight || 0;
    const repsVal = set.previousReps || 0;
    
    if (weightVal === 0 && repsVal === 0) return '-';

    switch (trackingType) {
      case 'reps_weight':
        return `${weightVal} ${weightUnit.toLowerCase()} × ${repsVal} reps`;
      case 'reps_only':
        return `${repsVal} reps`;
      case 'time_weight':
        return `${weightVal} ${weightUnit.toLowerCase()} × ${repsVal} secs`;
      case 'time_only':
        const mins = Math.floor(repsVal / 60);
        const secs = repsVal % 60;
        return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
      case 'cardio_hr':
        return `${weightVal} mins × ${repsVal} bpm`;
      default:
        return `${weightVal} × ${repsVal}`;
    }
  };

  // Offline State
  const [isOffline, setIsOffline] = useState(
    () => typeof navigator !== 'undefined' && !navigator.onLine,
  );
  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (isSummaryVisible) {
    const fallbackTotalVolume = exercises.reduce((total, ex) => {
      return total + ex.sets.reduce((setTotal, set) => {
        if (set.isCompleted && typeof set.weight === 'number' && typeof set.reps === 'number') {
          return setTotal + (set.weight * set.reps);
        }
        return setTotal;
      }, 0);
    }, 0);

    const fallbackTotalSets = exercises.reduce((total, ex) => {
      return total + ex.sets.filter((set) => set.isCompleted).length;
    }, 0);

    const totalVolume = lastWorkoutSummary?.totalVolume ?? fallbackTotalVolume;
    const totalSets = lastWorkoutSummary?.totalSets ?? fallbackTotalSets;
    const summaryElapsed = lastWorkoutSummary
      ? `${String(lastWorkoutSummary.durationMins).padStart(2, '0')}:00`
      : elapsed;

    return (
      <main className="flex min-h-screen flex-col items-center pt-8 p-4 bg-background relative overflow-y-auto overflow-x-hidden pb-24">
        {completionStatus === 'queued' && (
          <div className="mb-4 w-full max-w-xl rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-center text-xs font-bold text-orange-300">
            Saved on this device. This workout will sync automatically when your authenticated connection returns.
          </div>
        )}
        <SuccessCarousel 
          routineName={routineName}
          totalVolume={totalVolume}
          totalSets={totalSets}
          elapsed={summaryElapsed}
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
      <header className="sticky top-0 z-40 w-full bg-background/80 backdrop-blur-md border-b border-white/5 px-4 pt-[calc(var(--notch-top)+1rem)] pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={handleCancelWorkout}
            aria-label="Discard Workout"
            className="p-2 bg-white/5 hover:bg-white/10 rounded-full border border-white/10 transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
          <div className="flex flex-col">
            <span className="text-[10px] text-accent-green font-bold uppercase tracking-widest">{routineName}</span>
            <span className="text-2xl font-black text-white font-mono">{elapsed}</span>
          </div>
        </div>
        <button 
          onClick={handleFinish}
          disabled={isSaving}
          className="bg-accent-red/20 text-accent-red border border-accent-red/30 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest active:scale-95 transition-transform disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Finish"}
        </button>
      </header>

      {/* Exercises */}
      <div className="flex flex-col gap-6 p-4">
        {exercises.map((ex, exIdx) => {
          const trackingType = ex.trackingType || 'reps_weight';
          const weightUnit = ex.weightUnit || 'lbs';
          return (
            <div key={ex.id} className="glass-card flex flex-col overflow-hidden animate-fade-in-up" style={{ animationDelay: `${exIdx * 0.1}s` }}>
              <div className="p-4 bg-white/5 border-b border-white/5 flex justify-between items-center">
                <h2 className="text-lg font-black text-white">{ex.name}</h2>
                <button 
                  onClick={() => setActiveSettingsExerciseId(ex.id)}
                  aria-label="Exercise Settings" 
                  className="text-text-muted hover:text-white"
                >
                  <Settings2 className="w-4 h-4" />
                </button>
              </div>
              
              <div className="p-2 flex flex-col gap-1">
                {/* Table Header */}
                <div className="flex items-center px-2 py-1 text-[10px] uppercase font-bold text-text-muted tracking-widest">
                  <div className="w-8 text-center">Set</div>
                  <div className="flex-1 text-center">Previous</div>
                  
                  {/* Dynamic Headers based on trackingType */}
                  {trackingType === 'reps_weight' && (
                    <>
                      <div className="w-20 flex items-center justify-center gap-1">
                        {weightUnit.toUpperCase()}
                        {(weightUnit === 'lbs' || weightUnit === 'kg') && (
                          <button onClick={() => {
                            const lastWeight = ex.sets.findLast((set) => typeof set.weight === 'number' && set.weight > 0)?.weight || 135;
                            setPlateCalcWeight(Number(lastWeight));
                            setPlateCalcContext({ exerciseId: ex.id, setId: ex.sets[ex.sets.length - 1]?.id || '', reps: ex.sets[ex.sets.length - 1]?.reps || '' });
                            setIsPlateCalcOpen(true);
                          }} className="text-accent-green hover:bg-accent-green/20 p-1 rounded-md transition-colors">
                            <Calculator className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <div className="w-16 text-center">Reps</div>
                    </>
                  )}

                  {trackingType === 'reps_only' && (
                    <div className="w-16 text-center">Reps</div>
                  )}

                  {trackingType === 'time_weight' && (
                    <>
                      <div className="w-20 flex items-center justify-center gap-1">
                        {weightUnit.toUpperCase()}
                        {(weightUnit === 'lbs' || weightUnit === 'kg') && (
                          <button onClick={() => {
                            const lastWeight = ex.sets.findLast((set) => typeof set.weight === 'number' && set.weight > 0)?.weight || 135;
                            setPlateCalcWeight(Number(lastWeight));
                            setPlateCalcContext({ exerciseId: ex.id, setId: ex.sets[ex.sets.length - 1]?.id || '', reps: ex.sets[ex.sets.length - 1]?.reps || '' });
                            setIsPlateCalcOpen(true);
                          }} className="text-accent-green hover:bg-accent-green/20 p-1 rounded-md transition-colors">
                            <Calculator className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <div className="w-16 text-center">Secs</div>
                    </>
                  )}

                  {trackingType === 'time_only' && (
                    <div className="w-20 text-center">Secs</div>
                  )}

                  {trackingType === 'cardio_hr' && (
                    <>
                      <div className="w-16 text-center">Mins</div>
                      <div className="w-16 text-center">BPM</div>
                    </>
                  )}

                  <div className="w-10 text-center"><Check className="w-3 h-3 mx-auto" /></div>
                </div>

                {/* Sets */}
                {ex.sets.map((set, i) => (
                  <div key={set.id} className={`flex items-center px-2 py-2 rounded-lg transition-colors ${set.isCompleted ? 'bg-accent-green/5' : ''}`}>
                    <div className="w-8 text-center text-xs font-bold text-text-muted">{i + 1}</div>
                    <div className="flex-1 text-center text-xs text-text-muted/50 font-medium truncate">
                      {formatPrevious(set, trackingType, weightUnit)}
                    </div>

                    {/* Inputs depending on trackingType */}
                    {trackingType === 'reps_weight' && (
                      <>
                        {/* Weight input with calculator icon */}
                        <div className="w-20 px-1 relative flex items-center">
                          <input 
                            type="number"
                            min="0"
                            value={set.weight}
                            onChange={(e) => updateSet(ex.id, set.id, e.target.value === '' ? '' : Math.max(0, Number(e.target.value)), set.reps)}
                            className={`w-full bg-black/50 border rounded-md text-center text-base font-bold py-1 pr-6 outline-none transition-colors ${set.isCompleted ? 'border-transparent text-white/50' : 'border-white/10 text-white focus:border-accent-green focus:bg-accent-green/10'}`}
                            placeholder={weightUnit.toLowerCase()}
                          />
                          {(weightUnit === 'lbs' || weightUnit === 'kg') && (
                            <button 
                              onClick={() => {
                                setPlateCalcContext({ exerciseId: ex.id, setId: set.id, reps: set.reps });
                                setPlateCalcWeight(Number(set.weight) || 135);
                                setIsPlateCalcOpen(true);
                              }}
                              className="absolute right-1.5 text-accent-green hover:text-accent-green/80 p-0.5"
                              title="Plate Calculator"
                            >
                              <Calculator className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        {/* Reps input */}
                        <div className="w-16 px-1">
                          <input 
                            type="number"
                            min="0"
                            value={set.reps}
                            onChange={(e) => updateSet(ex.id, set.id, set.weight, e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                            className={`w-full bg-black/50 border rounded-md text-center text-base font-bold py-1 outline-none transition-colors ${set.isCompleted ? 'border-transparent text-white/50' : 'border-white/10 text-white focus:border-accent-green focus:bg-accent-green/10'}`}
                            placeholder="reps"
                          />
                        </div>
                      </>
                    )}

                    {trackingType === 'reps_only' && (
                      <div className="w-16 px-1">
                        <input 
                          type="number"
                          min="0"
                          value={set.reps}
                          onChange={(e) => updateSet(ex.id, set.id, '', e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                          className={`w-full bg-black/50 border rounded-md text-center text-base font-bold py-1 outline-none transition-colors ${set.isCompleted ? 'border-transparent text-white/50' : 'border-white/10 text-white focus:border-accent-green focus:bg-accent-green/10'}`}
                          placeholder="reps"
                        />
                      </div>
                    )}

                    {trackingType === 'time_weight' && (
                      <>
                        {/* Weight input with calculator icon */}
                        <div className="w-20 px-1 relative flex items-center">
                          <input 
                            type="number"
                            min="0"
                            value={set.weight}
                            onChange={(e) => updateSet(ex.id, set.id, e.target.value === '' ? '' : Math.max(0, Number(e.target.value)), set.reps)}
                            className={`w-full bg-black/50 border rounded-md text-center text-base font-bold py-1 pr-6 outline-none transition-colors ${set.isCompleted ? 'border-transparent text-white/50' : 'border-white/10 text-white focus:border-accent-green focus:bg-accent-green/10'}`}
                            placeholder={weightUnit.toLowerCase()}
                          />
                          {(weightUnit === 'lbs' || weightUnit === 'kg') && (
                            <button 
                              onClick={() => {
                                setPlateCalcContext({ exerciseId: ex.id, setId: set.id, reps: set.reps });
                                setPlateCalcWeight(Number(set.weight) || 135);
                                setIsPlateCalcOpen(true);
                              }}
                              className="absolute right-1.5 text-accent-green hover:text-accent-green/80 p-0.5"
                              title="Plate Calculator"
                            >
                              <Calculator className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        {/* Time input (Secs) */}
                        <div className="w-16 px-1">
                          <input 
                            type="number"
                            min="0"
                            value={set.reps}
                            onChange={(e) => updateSet(ex.id, set.id, set.weight, e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                            className={`w-full bg-black/50 border rounded-md text-center text-base font-bold py-1 outline-none transition-colors ${set.isCompleted ? 'border-transparent text-white/50' : 'border-white/10 text-white focus:border-accent-green focus:bg-accent-green/10'}`}
                            placeholder="secs"
                          />
                        </div>
                      </>
                    )}

                    {trackingType === 'time_only' && (
                      <div className="w-20 px-1">
                        <input 
                          type="number"
                          min="0"
                          value={set.reps}
                          onChange={(e) => updateSet(ex.id, set.id, '', e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                          className={`w-full bg-black/50 border rounded-md text-center text-base font-bold py-1 outline-none transition-colors ${set.isCompleted ? 'border-transparent text-white/50' : 'border-white/10 text-white focus:border-accent-green focus:bg-accent-green/10'}`}
                          placeholder="secs"
                        />
                      </div>
                    )}

                    {trackingType === 'cardio_hr' && (
                      <>
                        {/* Time (Mins) input */}
                        <div className="w-16 px-1">
                          <input 
                            type="number"
                            min="0"
                            value={set.weight}
                            onChange={(e) => updateSet(ex.id, set.id, e.target.value === '' ? '' : Math.max(0, Number(e.target.value)), set.reps)}
                            className={`w-full bg-black/50 border rounded-md text-center text-base font-bold py-1 outline-none transition-colors ${set.isCompleted ? 'border-transparent text-white/50' : 'border-white/10 text-white focus:border-accent-green focus:bg-accent-green/10'}`}
                            placeholder="mins"
                          />
                        </div>
                        {/* HR (BPM) input */}
                        <div className="w-16 px-1">
                          <input 
                            type="number"
                            min="0"
                            value={set.reps}
                            onChange={(e) => updateSet(ex.id, set.id, set.weight, e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                            className={`w-full bg-black/50 border rounded-md text-center text-base font-bold py-1 outline-none transition-colors ${set.isCompleted ? 'border-transparent text-white/50' : 'border-white/10 text-white focus:border-accent-green focus:bg-accent-green/10'}`}
                            placeholder="bpm"
                          />
                        </div>
                      </>
                    )}

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
          );
        })}
        
        <button 
          onClick={() => setIsExerciseModalOpen(true)}
          className="w-full py-4 border-2 border-dashed border-white/10 rounded-xl text-xs font-bold uppercase tracking-widest text-text-muted hover:border-white/30 hover:text-white transition-all"
        >
          + Add Exercise
        </button>
      </div>

      <PlateCalculator 
        isOpen={isPlateCalcOpen} 
        onClose={() => {
          setIsPlateCalcOpen(false);
          setPlateCalcContext(null);
        }} 
        targetWeight={plateCalcWeight} 
        onApplyWeight={(weight) => {
          if (plateCalcContext) {
            updateSet(plateCalcContext.exerciseId, plateCalcContext.setId, weight, plateCalcContext.reps);
          } else {
            // Fallback for header calculator
            const activeEx = exercises[exercises.length - 1];
            if (activeEx && activeEx.sets.length > 0) {
              const lastSet = activeEx.sets[activeEx.sets.length - 1];
              updateSet(activeEx.id, lastSet.id, weight, lastSet.reps);
            }
          }
        }}
      />

      <ExerciseSelectionModal
        isOpen={isExerciseModalOpen}
        onClose={() => setIsExerciseModalOpen(false)}
        onSelect={(exercise) => {
          addExerciseToWorkout(exercise.name);
        }}
      />

      {/* Exercise Settings Modal */}
      {activeSettingsExerciseId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-sm p-6 flex flex-col gap-6 shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-black text-white">Exercise Settings</h3>
              <button 
                onClick={() => setActiveSettingsExerciseId(null)}
                className="p-1 bg-white/5 rounded-full hover:bg-white/10 text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tracking Mode Selection */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-text-muted uppercase tracking-widest">Tracking Mode</label>
              <div className="flex flex-col gap-1.5">
                {TRACKING_MODES.map((mode) => {
                  const currentEx = exercises.find((exercise) => exercise.id === activeSettingsExerciseId);
                  const isSelected = (currentEx?.trackingType || 'reps_weight') === mode.id;
                  return (
                    <button
                      key={mode.id}
                      onClick={() => {
                        const currentEx = exercises.find((exercise) => exercise.id === activeSettingsExerciseId);
                        const currentUnit = currentEx?.weightUnit || 'lbs';
                        changeExerciseTracking(activeSettingsExerciseId, mode.id, currentUnit);
                      }}
                      className={`w-full py-2.5 px-4 rounded-xl border text-left font-bold text-sm transition-all flex justify-between items-center ${
                        isSelected 
                          ? 'bg-accent-green/10 text-accent-green border-accent-green/30' 
                          : 'bg-white/5 text-white/70 border-white/5 hover:bg-white/10'
                      }`}
                    >
                      <span>{mode.label}</span>
                      {isSelected && <Check className="w-4 h-4 stroke-[3]" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Weight Unit Selection */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-text-muted uppercase tracking-widest">Weight Unit</label>
              <div className="grid grid-cols-4 gap-1.5">
                {WEIGHT_UNITS.map((unit) => {
                  const currentEx = exercises.find((exercise) => exercise.id === activeSettingsExerciseId);
                  const isSelected = (currentEx?.weightUnit || 'lbs') === unit.id;
                  return (
                    <button
                      key={unit.id}
                      onClick={() => {
                        const currentEx = exercises.find((exercise) => exercise.id === activeSettingsExerciseId);
                        const currentMode = currentEx?.trackingType || 'reps_weight';
                        changeExerciseTracking(activeSettingsExerciseId, currentMode, unit.id);
                      }}
                      className={`py-2 px-1 rounded-xl border text-center font-bold text-xs transition-all ${
                        isSelected 
                          ? 'bg-accent-green/10 text-accent-green border-accent-green/30' 
                          : 'bg-white/5 text-white/70 border-white/5 hover:bg-white/10'
                      }`}
                    >
                      {unit.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <button 
              onClick={() => setActiveSettingsExerciseId(null)}
              className="w-full bg-accent-green text-black font-black uppercase tracking-widest py-3 rounded-xl hover:opacity-90 transition-all text-xs"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
