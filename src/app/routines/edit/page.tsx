"use client";

import { useRoutineStore, PlannedExercise, TrackingType, WeightUnit } from "@/store/useRoutineStore";
import { ChevronLeft, ChevronDown, ChevronUp, Plus, X, Search, Settings, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import exerciseLibrary from "@/data/exerciseLibrary.json";
import { ExerciseSelectionModal } from "@/components/ExerciseSelectionModal";

export default function RoutineEditorPage() {
  const { weeklyPlan, updateDayPlan } = useRoutineStore();
  const router = useRouter();

  const [expandedDay, setExpandedDay] = useState<string | null>("Monday");
  const [localPlan, setLocalPlan] = useState(weeklyPlan);

  // Modal States
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [targetDayForAdd, setTargetDayForAdd] = useState<string | null>(null);

  const [showConfigDrawer, setShowConfigDrawer] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<any>(null); // from library

  // Config Drawer State
  const [cfgTrackingType, setCfgTrackingType] = useState<TrackingType>("reps_weight");
  const [cfgWeightUnit, setCfgWeightUnit] = useState<WeightUnit>("kg");
  const [cfgSets, setCfgSets] = useState(3);
  const [cfgValue, setCfgValue] = useState("10");

  const filteredLibrary = useMemo(() => {
    if (!searchQuery) return exerciseLibrary.slice(0, 50); // don't freeze UI
    return exerciseLibrary.filter((ex: any) => 
      ex.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      ex.target.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 50);
  }, [searchQuery]);

  const handleSaveAll = () => {
    localPlan.forEach(day => {
      updateDayPlan(day.day, day.mainLifts);
    });
    router.push("/routines");
  };

  const handleRemoveExercise = (dayName: string, exId: string) => {
    const newPlan = localPlan.map(d => {
      if (d.day === dayName) {
        return { ...d, mainLifts: d.mainLifts.filter(ex => ex.id !== exId) };
      }
      return d;
    });
    setLocalPlan(newPlan);
  };

  const openSearchForDay = (dayName: string) => {
    setTargetDayForAdd(dayName);
    setShowSearchModal(true);
  };

  const openConfigForExercise = (ex: any) => {
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

    const newEx: PlannedExercise = {
      id: `ex_${Date.now()}`,
      exerciseId: selectedExercise.id,
      name: selectedExercise.name,
      targetMuscle: selectedExercise.target,
      trackingType: cfgTrackingType,
      weightUnit: cfgWeightUnit,
      targetSets: cfgSets,
      targetValue: cfgValue
    };

    const newPlan = localPlan.map(d => {
      if (d.day === targetDayForAdd) {
        return { ...d, mainLifts: [...d.mainLifts, newEx] };
      }
      return d;
    });

    setLocalPlan(newPlan);
    setShowConfigDrawer(false);
    setSearchQuery("");
  };

  return (
    <main className="flex min-h-screen flex-col pt-[var(--notch-top)] pb-28 px-4 bg-[#050505] relative overflow-x-hidden">
      
      <header className="w-full flex items-center justify-between py-4 mb-4 sticky top-[var(--notch-top)] z-20 bg-[#050505]/80 backdrop-blur-lg">
        <div className="flex items-center gap-4">
          <Link href="/routines" className="p-2 bg-white/5 rounded-full border border-white/10 hover:bg-white/10 transition-colors" aria-label="Go back">
            <ChevronLeft className="w-5 h-5 text-white" />
          </Link>
          <div className="flex flex-col">
            <h1 className="text-xl font-extrabold tracking-tight text-white">Routine Editor</h1>
            <span className="text-[10px] text-accent-green uppercase font-bold tracking-widest">Master Planner</span>
          </div>
        </div>
        <button onClick={handleSaveAll} className="flex items-center gap-1 bg-accent-green/20 text-accent-green px-3 py-1.5 rounded-lg border border-accent-green/30 active:scale-95 transition-transform">
          <Save className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-wider">Save</span>
        </button>
      </header>

      <section className="flex flex-col gap-3 animate-fade-in-up">
        {localPlan.map((dayPlan) => (
          <div key={dayPlan.day} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            <button 
              onClick={() => setExpandedDay(expandedDay === dayPlan.day ? null : dayPlan.day)}
              className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm
                  ${dayPlan.type === 'Rest' ? 'bg-black/50 text-text-muted border border-white/5' : 'bg-white/10 text-white'}
                `}>
                  {dayPlan.shortDay}
                </div>
                <div className="flex flex-col items-start">
                  <span className="font-bold text-white text-sm">{dayPlan.day}</span>
                  <span className="text-[10px] text-text-muted uppercase tracking-widest">{dayPlan.mainLifts.length} Exercises</span>
                </div>
              </div>
              {expandedDay === dayPlan.day ? <ChevronUp className="w-5 h-5 text-text-muted" /> : <ChevronDown className="w-5 h-5 text-text-muted" />}
            </button>

            {expandedDay === dayPlan.day && (
              <div className="p-4 border-t border-white/5 bg-black/30 flex flex-col gap-3">
                
                {dayPlan.mainLifts.map((ex, i) => (
                  <div key={ex.id} className="bg-white/5 border border-white/5 rounded-xl p-3 flex flex-col gap-2">
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-white capitalize">{ex.name}</span>
                        <span className="text-[10px] text-text-muted uppercase tracking-wider">{ex.targetMuscle}</span>
                      </div>
                      <button onClick={() => handleRemoveExercise(dayPlan.day, ex.id)} className="p-1 text-red-500/50 hover:text-red-500 transition-colors">
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
                  onClick={() => openSearchForDay(dayPlan.day)}
                  className="w-full py-3 mt-2 rounded-xl border border-dashed border-white/20 text-white/50 text-xs font-bold tracking-widest uppercase hover:bg-white/5 hover:text-white transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Add Exercise
                </button>
              </div>
            )}
          </div>
        ))}
      </section>

      {/* EXERCISE SEARCH MODAL */}
      <ExerciseSelectionModal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        onSelect={(exercise) => openConfigForExercise(exercise)}
      />

      {/* EXERCISE CONFIG DRAWER */}
      {showConfigDrawer && selectedExercise && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col justify-end">
          <div className="bg-[#111] border-t border-white/10 rounded-t-3xl p-6 animate-fade-in-up">
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
                <select 
                  value={cfgTrackingType}
                  onChange={e => setCfgTrackingType(e.target.value as TrackingType)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-3 text-white text-sm outline-none focus:border-accent-green appearance-none"
                >
                  <option value="reps_weight">Standard (Reps + Weight)</option>
                  <option value="reps_only">Bodyweight (Reps Only)</option>
                  <option value="time_only">Time Only (e.g. Planks)</option>
                  <option value="time_weight">Time + Weight (e.g. Carries)</option>
                  <option value="cardio_hr">Cardio (Time + HR Zone)</option>
                </select>
              </div>

              {/* Weight Unit */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-widest text-text-muted font-bold">Weight Unit (For Logging)</label>
                <select 
                  value={cfgWeightUnit}
                  onChange={e => setCfgWeightUnit(e.target.value as WeightUnit)}
                  disabled={cfgTrackingType === 'reps_only' || cfgTrackingType === 'time_only' || cfgTrackingType === 'cardio_hr'}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-3 text-white text-sm outline-none focus:border-accent-green appearance-none disabled:opacity-50"
                >
                  <option value="kg">Kilograms (kg)</option>
                  <option value="lbs">Pounds (lbs)</option>
                  <option value="plates">Plates (Machine Stack count)</option>
                  <option value="unitless">Unitless (Worn dumbell number)</option>
                </select>
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
