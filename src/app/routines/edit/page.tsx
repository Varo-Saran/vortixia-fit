"use client";

import { useRoutineStore } from "@/store/useRoutineStore";
import type { ResolvedExercise } from "@/types/exercise-catalog";
import type { TrackingType, Weekday, WeightUnit } from "@/types/routine";
import { mainOccurrences, shortWeekday, weekdayLabel } from "@/lib/routine-model";
import { ChevronLeft, ChevronDown, ChevronUp, Plus, X, Settings, Save } from "lucide-react";
import Link from "next/link";
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
    error,
    fetchRoutine,
    addOccurrence,
    removeOccurrence,
    saveRoutineToDb,
  } = useRoutineStore();
  const router = useRouter();

  const [expandedDay, setExpandedDay] = useState<Weekday | null>("monday");

  // Modal States
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [targetDayForAdd, setTargetDayForAdd] = useState<Weekday | null>(null);

  const [showConfigDrawer, setShowConfigDrawer] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<ResolvedExercise | null>(null);

  // Config Drawer State
  const [cfgTrackingType, setCfgTrackingType] = useState<TrackingType>("reps_weight");
  const [cfgWeightUnit, setCfgWeightUnit] = useState<WeightUnit>("kg");
  const [cfgSets, setCfgSets] = useState(3);
  const [cfgValue, setCfgValue] = useState("10");

  useEffect(() => {
    if (loadStatus === 'idle') void fetchRoutine();
  }, [fetchRoutine, loadStatus]);

  const handleSaveAll = async () => {
    try {
      await saveRoutineToDb();
      router.push("/routines");
    } catch (e) {
      console.error("Error saving routine edits:", e);
    }
  };

  const handleRemoveExercise = (exId: string) => {
    removeOccurrence(exId);
  };

  const openSearchForDay = (weekday: Weekday) => {
    setTargetDayForAdd(weekday);
    setShowSearchModal(true);
  };

  const openConfigForExercise = (ex: ResolvedExercise) => {
    setSelectedExercise(ex);
    
    // Auto-detect defaults based on equipment or name
    if (ex.equipment === "body weight") {
      setCfgTrackingType("reps_only");
      setCfgWeightUnit("unitless");
    } else if (ex.name.toLowerCase().includes("plank")) {
      setCfgTrackingType("time_only");
      setCfgWeightUnit("unitless");
      setCfgValue("60 secs");
    } else {
      setCfgTrackingType("reps_weight");
      setCfgWeightUnit("kg");
      setCfgValue("10");
    }
    
    setShowSearchModal(false);
    setShowConfigDrawer(true);
  };

  const confirmAddExercise = () => {
    if (!targetDayForAdd || !selectedExercise) return;

    addOccurrence(targetDayForAdd, {
      exerciseId: selectedExercise.id,
      name: selectedExercise.name,
      targetMuscle: selectedExercise.target,
      section: "main",
      trackingType: cfgTrackingType,
      weightUnit: cfgWeightUnit,
      targetSets: cfgSets,
      targetValue: cfgValue,
      restSeconds: null,
    });
    setShowConfigDrawer(false);
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
                      <button onClick={() => handleRemoveExercise(ex.id)} className="p-1 text-red-500/50 hover:text-red-500 transition-colors">
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
                  className="w-full py-3 mt-2 rounded-xl border border-dashed border-white/20 text-white/50 text-xs font-bold tracking-widest uppercase hover:bg-white/5 hover:text-white transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Add Exercise
                </button>
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
                <h3 className="text-xl font-black text-white capitalize">{selectedExercise.name}</h3>
                <span className="text-xs text-accent-green uppercase tracking-widest">{selectedExercise.target}</span>
              </div>
              <button onClick={() => setShowConfigDrawer(false)} className="p-2 bg-white/5 rounded-full text-text-muted">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-4 mb-8">
              {/* Sets & Value */}
              <div className="flex gap-4">
                <div className="flex-1 flex flex-col gap-1">
                  <label className="text-[10px] uppercase tracking-widest text-text-muted font-bold">Target Sets</label>
                  <input 
                    type="number" 
                    value={cfgSets}
                    onChange={e => setCfgSets(Number(e.target.value))}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-3 text-white text-sm outline-none focus:border-accent-green"
                  />
                </div>
                <div className="flex-1 flex flex-col gap-1">
                  <label className="text-[10px] uppercase tracking-widest text-text-muted font-bold">Target Value (Reps/Secs)</label>
                  <input 
                    type="text" 
                    value={cfgValue}
                    onChange={e => setCfgValue(e.target.value)}
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
                  value={cfgTrackingType}
                  onValueChange={(nextValue) => setCfgTrackingType(nextValue as TrackingType)}
                  label="Tracking style"
                />
              </div>

              {/* Weight Unit */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-widest text-text-muted font-bold">Weight Unit (For Logging)</label>
                <Select
                  options={WEIGHT_UNIT_OPTIONS}
                  value={cfgWeightUnit}
                  onValueChange={(nextValue) => setCfgWeightUnit(nextValue as WeightUnit)}
                  label="Weight unit for logging"
                  disabled={cfgTrackingType === 'reps_only' || cfgTrackingType === 'time_only' || cfgTrackingType === 'cardio_hr'}
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
