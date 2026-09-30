"use client";

import { useRoutineStore } from "@/store/useRoutineStore";
import type { ResolvedExercise } from "@/types/exercise-catalog";
import type { TrackingType, Weekday, WeightUnit } from "@/types/routine";
import { getExerciseById } from '@/lib/exercise-catalog';
import { mainOccurrences, shortWeekday, weekdayLabel } from "@/lib/routine-model";
import { ChevronLeft, ChevronDown, ChevronUp, Plus, X, Settings, Save } from "lucide-react";
import { RoutineGuardedLink as Link } from '@/components/RoutineDraftGuard';
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ExerciseSelectionModal } from "@/components/ExerciseSelectionModal";
import { Select } from "@/components/ui/Select";

const TRACKING_TYPE_OPTIONS = [
  { value: "reps_weight", label: "Standard (Reps + Weight)" },
  { value: "reps_only", label: "Bodyweight (Reps Only)" },
  { value: "time_only", label: "Time Only (e.g. Planks)" },
  { value: "time_weight", label: "Time + Weight (e.g. Carries)" },
  { value: "cardio_hr", label: "Cardio (Time + HR Zone)" },
];

const WEIGHT_UNIT_OPTIONS = [
  { value: "kg", label: "Kilograms (kg)" },
  { value: "lbs", label: "Pounds (lbs)" },
  { value: "plates", label: "Plates (Machine Stack count)" },
  { value: "unitless", label: "Unitless (Worn dumbell number)" },
];

export default function RoutineEditorPage() {
  const {
    routine,
    loadStatus,
    isLoading,
    isSaving,
    draftStatus,
    pendingAdd,
    setPendingAdd,
    commitPendingAdd,
    error,
    fetchRoutine,
    removeOccurrence,
    saveRoutineToDb,
  } = useRoutineStore();
  const router = useRouter();

  const [expandedDay, setExpandedDay] = useState<Weekday | null>("monday");

  // Modal States
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [targetDayForAdd, setTargetDayForAdd] = useState<Weekday | null>(null);

  // Configuration survives native Back / route remount; no UUID until Add.
  const selectedExercise = pendingAdd ? getExerciseById(pendingAdd.exerciseId) : undefined;
  const showConfigDrawer = !!pendingAdd;

  useEffect(() => {
    if (loadStatus === 'idle') void fetchRoutine();
  }, [fetchRoutine, loadStatus]);

  const handleSaveAll = async () => {
    try {
      const outcome = await saveRoutineToDb();
      if (outcome.status !== 'saved-with-newer-edits' && !useRoutineStore.getState().hasUnsavedChanges) router.push("/routines");
    } catch (e) {
      console.error("Error saving routine edits:", e);
    }
  };

  const handleRemoveExercise = (exId: string) => {
    try { removeOccurrence(exId); } catch { /* Store exposes the controlled error. */ }
  };

  const openSearchForDay = (weekday: Weekday) => {
    setTargetDayForAdd(weekday);
    setShowSearchModal(true);
  };

  const openConfigForExercise = (ex: ResolvedExercise) => {
    const day = routine?.days.find(value => value.weekday === targetDayForAdd);
    if (!day || day.kind === 'rest') return;
    const trackingType = ex.defaultTrackingType ?? null;
    const weighted = trackingType === 'reps_weight' || trackingType === 'time_weight';
    const unit = ex.supportedWeightUnits?.[0];
    setPendingAdd({ dayId: day.id, section: 'main', exerciseId: ex.id, rawSets: '3', rawTarget: '',
      trackingType, weightUnit: trackingType && !weighted ? 'unitless' : unit === 'lb' ? 'lbs' : unit ?? null, restSeconds: null });
    setShowSearchModal(false);
  };

  const confirmAddExercise = () => {
    try { commitPendingAdd(); } catch { /* Invalid Add remains buffered with a visible store error. */ }
  };

  if (!routine) {
    const loadFailed = loadStatus === 'error';
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#050505] px-6 text-center text-sm text-text-muted">
        <p role={loadFailed ? "alert" : undefined}>
          {isLoading ? "Loading routine…" : (error ?? "No routine is available.")}
        </p>
        {loadFailed && (
          <button
            type="button"
            onClick={() => void fetchRoutine()}
            className="rounded-lg border border-accent-green/30 bg-accent-green/20 px-4 py-2 text-xs font-bold uppercase tracking-wider text-accent-green"
          >
            Retry
          </button>
        )}
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col pb-28 px-4 bg-[#050505] relative overflow-x-hidden">
      
      <header className="w-full flex items-center justify-between pt-[calc(var(--notch-top)+1rem)] pb-4 mb-4 sticky top-0 z-20 bg-[#050505]/80 backdrop-blur-lg">
        <div className="flex items-center gap-4">
          <Link href="/routines" className="p-2 bg-white/5 rounded-full border border-white/10 hover:bg-white/10 transition-colors" aria-label="Go back">
            <ChevronLeft className="w-5 h-5 text-white" />
          </Link>
          <div className="flex flex-col">
            <h1 className="text-xl font-extrabold tracking-tight text-white">Routine Editor</h1>
            <span className="text-[10px] text-accent-green uppercase font-bold tracking-widest">{routine.name}</span>
            <span role="status" className="text-xs text-text-muted">{isSaving ? 'Saving…' : draftStatus}</span>
          </div>
        </div>
        <button 
          onClick={handleSaveAll} 
          disabled={isSaving || loadStatus !== 'ready'}
          className="flex items-center gap-1 bg-accent-green/20 text-accent-green px-3 py-1.5 rounded-lg border border-accent-green/30 active:scale-95 transition-transform disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-wider">
            {isSaving ? "Saving..." : "Save"}
          </span>
        </button>
      </header>

      {error && (
        <div role="alert" className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-200">
          {error}
        </div>
      )}

      <section className="flex flex-col gap-3 animate-fade-in-up">
        {routine.days.map((dayPlan) => {
          const lifts = mainOccurrences(dayPlan);
          return (
          <div key={dayPlan.id} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            <button 
              onClick={() => setExpandedDay(expandedDay === dayPlan.weekday ? null : dayPlan.weekday)}
              className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm
                  ${dayPlan.kind !== 'training' ? 'bg-black/50 text-text-muted border border-white/5' : 'bg-white/10 text-white'}
                `}>
                  {shortWeekday(dayPlan.weekday)}
                </div>
                <div className="flex flex-col items-start">
                  <span className="font-bold text-white text-sm">{weekdayLabel(dayPlan.weekday)}</span>
                  <span className="text-[10px] text-text-muted uppercase tracking-widest">{lifts.length} Exercises</span>
                </div>
              </div>
              {expandedDay === dayPlan.weekday ? <ChevronUp className="w-5 h-5 text-text-muted" /> : <ChevronDown className="w-5 h-5 text-text-muted" />}
            </button>

            {expandedDay === dayPlan.weekday && (
              <div className="p-4 border-t border-white/5 bg-black/30 flex flex-col gap-3">
                
                {lifts.map((ex) => (
                  <div key={ex.id} className="bg-white/5 border border-white/5 rounded-xl p-3 flex flex-col gap-2">
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-white capitalize">{ex.name}</span>
                        <span className="text-[10px] text-text-muted uppercase tracking-wider">{ex.targetMuscle}</span>
                      </div>
                      <button aria-label={`Remove ${ex.name}`} onClick={() => handleRemoveExercise(ex.id)} className="p-1 text-red-500/50 hover:text-red-500 transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 mt-1">
                      <span className="text-[10px] bg-black/50 border border-white/10 rounded-md px-2 py-1 text-accent-green font-mono">
                        {ex.targetSets} sets
                      </span>
                      <span className="text-[10px] bg-black/50 border border-white/10 rounded-md px-2 py-1 text-white font-mono">
                        {ex.targetValue}
                      </span>
                      <span className="text-[10px] bg-black/50 border border-white/10 rounded-md px-2 py-1 text-text-muted font-mono">
                        {ex.trackingType.replace('_', ' ')}
                      </span>
                      {ex.weightUnit !== 'unitless' && (
                        <span className="text-[10px] bg-black/50 border border-white/10 rounded-md px-2 py-1 text-blue-400 font-mono">
                          {ex.weightUnit}
                        </span>
                      )}
                    </div>
                  </div>
                ))}

                <button 
                  onClick={() => openSearchForDay(dayPlan.weekday)}
                  disabled={dayPlan.kind === 'rest'}
                  className="w-full py-3 mt-2 rounded-xl border border-dashed border-white/20 text-white/50 text-xs font-bold tracking-widest uppercase hover:bg-white/5 hover:text-white transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Add Exercise
                </button>
                {dayPlan.kind === 'rest' && <p className="text-xs text-text-muted">Exercises cannot be added to a Rest day.</p>}
              </div>
            )}
          </div>
        )})}
      </section>

      {/* EXERCISE SEARCH MODAL */}
      <ExerciseSelectionModal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        onSelect={(exercise) => openConfigForExercise(exercise)}
      />

      {/* EXERCISE CONFIG DRAWER */}
      {showConfigDrawer && selectedExercise && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex flex-col justify-end">
          <div className="bg-[#111] border-t border-white/10 rounded-t-3xl p-6 pb-safe-bottom max-h-[90vh] overflow-y-auto animate-fade-in-up">
            <div className="flex justify-between items-start mb-6">
              <div className="flex flex-col">
                <h3 className="text-xl font-black text-white capitalize">{selectedExercise.displayName}</h3>
                <span className="text-xs text-accent-green uppercase tracking-widest">{selectedExercise.primaryMuscle}</span>
              </div>
              <button aria-label="Cancel Add Exercise" onClick={() => setPendingAdd(null)} className="p-2 bg-white/5 rounded-full text-text-muted">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-4 mb-8">
              {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
              {!selectedExercise.defaultTrackingType && <p className="text-xs text-text-muted">This exercise needs an explicit logging mode and unit. No defaults are inferred.</p>}
              {/* Sets & Value */}
              <div className="flex gap-4">
                <div className="flex-1 flex flex-col gap-1">
                  <label className="text-[10px] uppercase tracking-widest text-text-muted font-bold">Target Sets</label>
                  <input 
                    type="number" 
                    value={pendingAdd!.rawSets}
                    min={1} max={100} step={1}
                    aria-label="Target sets"
                    onChange={e => setPendingAdd({ ...pendingAdd!, rawSets: e.target.value })}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-3 text-white text-sm outline-none focus:border-accent-green"
                  />
                </div>
                <div className="flex-1 flex flex-col gap-1">
                  <label className="text-[10px] uppercase tracking-widest text-text-muted font-bold">Target Value (Reps/Secs)</label>
                  <input 
                    type="text" 
                    value={pendingAdd!.rawTarget}
                    aria-label="Target value"
                    onChange={e => setPendingAdd({ ...pendingAdd!, rawTarget: e.target.value })}
                    placeholder="e.g. 10-12, 60s"
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-3 text-white text-sm outline-none focus:border-accent-green"
                  />
                </div>
              </div>

              {/* Tracking Style */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-widest text-text-muted font-bold flex items-center gap-1">
                  <Settings className="w-3 h-3" /> Tracking Style
                </label>
                <Select
                  options={TRACKING_TYPE_OPTIONS}
                  value={pendingAdd!.trackingType ?? ''}
                  onValueChange={(nextValue) => {
                    const trackingType = nextValue as TrackingType;
                    const weighted = trackingType === 'reps_weight' || trackingType === 'time_weight';
                    setPendingAdd({ ...pendingAdd!, trackingType, weightUnit: weighted ? null : 'unitless' });
                  }}
                  label="Tracking style"
                />
              </div>

              {/* Weight Unit */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-widest text-text-muted font-bold">Weight Unit (For Logging)</label>
                <Select
                  options={WEIGHT_UNIT_OPTIONS}
                  value={pendingAdd!.weightUnit ?? ''}
                  onValueChange={(nextValue) => setPendingAdd({ ...pendingAdd!, weightUnit: nextValue as WeightUnit })}
                  label="Weight unit for logging"
                  disabled={pendingAdd!.trackingType === null || pendingAdd!.trackingType === 'reps_only' || pendingAdd!.trackingType === 'time_only' || pendingAdd!.trackingType === 'cardio_hr'}
                />
              </div>
            </div>

            <button 
              onClick={confirmAddExercise}
              className="w-full py-4 bg-accent-green text-black font-black rounded-xl active:scale-95 transition-transform"
            >
              ADD TO PLAN
            </button>
          </div>
        </div>
      )}

    </main>
  );
}
