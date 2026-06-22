"use client";

import { useEffect, useState } from "react";
import { useRoutineStore, PlannedExercise, TrackingType } from "@/store/useRoutineStore";
import Link from "next/link";
import { Tag, Check, MoreVertical, Plus } from "lucide-react";

export default function ActiveWorkout() {
  const { weeklyPlan, fetchRoutine, isLoading } = useRoutineStore();
  const [todayPlan, setTodayPlan] = useState<any>(null);
  const [time, setTime] = useState("00:00:00");
  
  // Local state to manage the active workout session's exercises
  const [activeExercises, setActiveExercises] = useState<PlannedExercise[]>([]);

  useEffect(() => {
    if (weeklyPlan.length === 0) {
      fetchRoutine();
    }

    // Determine today's plan
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const todayName = days[new Date().getDay()];
    const plan = weeklyPlan.find(p => p.day === todayName);
    setTodayPlan(plan);
    
    if (plan && plan.mainLifts) {
      setActiveExercises(plan.mainLifts);
    }

    // Start Timer
    let seconds = 0;
    const interval = setInterval(() => {
      seconds++;
      const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
      const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
      const s = (seconds % 60).toString().padStart(2, '0');
      setTime(`${h}:${m}:${s}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [weeklyPlan]);

  const handleAddExercise = () => {
    // Adding a mock Freestyle exercise to test the UI
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
  };

  if (!todayPlan) return null;

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
    // Standard (reps_weight or time_weight)
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
    const isFirstSet = setIndex === 0;
    const isSecondSet = setIndex === 1;
    const isCompleted = isFirstSet;
    const isActive = isSecondSet;
    
    const rowClass = `grid grid-cols-12 gap-1 items-center rounded-xl p-1.5 text-center z-10 transition-colors ${isCompleted ? 'bg-accent-green/10 border border-accent-green/30' : isActive ? 'bg-white/5 border border-white/10 shadow-lg shadow-black/50 focus-within:border-accent-green/50' : 'bg-transparent border border-transparent opacity-60'}`;
    const numClass = `col-span-2 font-black text-sm ${isCompleted ? 'text-accent-green' : isActive ? 'text-white' : 'text-text-muted'}`;
    const inputWrapperClass = `rounded-lg p-2 border ${isCompleted ? 'bg-black/40 border-white/5' : isActive ? 'bg-black/60 border-white/10' : 'bg-black/40 border-white/5'}`;
    const inputClass = `w-full bg-transparent text-center font-black text-white outline-none placeholder-text-muted/30 ${isCompleted ? 'opacity-50' : ''}`;
    
    const prevText = exercise.targetValue;
    const defaultReps = isCompleted ? exercise.targetValue.split('-')[0] : "";

    if (style === 'cardio_hr') {
      return (
        <div key={setIndex} className={rowClass}>
          <div className={numClass}>{setIndex + 1}</div>
          <div className={`col-span-4 ${inputWrapperClass}`}>
            <input type="text" placeholder="e.g. 30m" defaultValue={isCompleted ? "30m" : ""} disabled={!isActive && !isCompleted} className={inputClass} />
          </div>
          <div className={`col-span-4 ${inputWrapperClass}`}>
            <input type="text" placeholder="Zone 2" defaultValue={isCompleted ? "Zone 2" : ""} disabled={!isActive && !isCompleted} className={inputClass} />
          </div>
          <div className="col-span-2 flex justify-center">
             <input type="checkbox" defaultChecked={isCompleted} disabled={!isActive && !isCompleted} className={`w-5 h-5 rounded-md border-2 ${isCompleted ? 'opacity-50 accent-accent-green' : isActive ? 'border-white/20 cursor-pointer' : 'opacity-30 border-white/10 bg-transparent appearance-none'}`} />
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
            <input type="text" placeholder="e.g. 60s" defaultValue={isCompleted ? "60s" : ""} disabled={!isActive && !isCompleted} className={inputClass} />
          </div>
          <div className="col-span-2 flex justify-center">
             <input type="checkbox" defaultChecked={isCompleted} disabled={!isActive && !isCompleted} className={`w-5 h-5 rounded-md border-2 ${isCompleted ? 'opacity-50 accent-accent-green' : isActive ? 'border-white/20 cursor-pointer' : 'opacity-30 border-white/10 bg-transparent appearance-none'}`} />
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
            <input type="number" placeholder="-" defaultValue={defaultReps} disabled={!isActive && !isCompleted} className={inputClass} />
          </div>
          <div className="col-span-2 flex justify-center">
             <input type="checkbox" defaultChecked={isCompleted} disabled={!isActive && !isCompleted} className={`w-5 h-5 rounded-md border-2 ${isCompleted ? 'opacity-50 accent-accent-green' : isActive ? 'border-white/20 cursor-pointer' : 'opacity-30 border-white/10 bg-transparent appearance-none'}`} />
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
          <input type="number" placeholder="-" defaultValue={isCompleted ? "80" : ""} disabled={!isActive && !isCompleted} className={inputClass} />
        </div>
        <div className={`col-span-2 ${inputWrapperClass}`}>
          <input type="number" placeholder="-" defaultValue={defaultReps} disabled={!isActive && !isCompleted} className={inputClass} />
        </div>
        <div className="col-span-2 flex justify-center">
           <input type="checkbox" defaultChecked={isCompleted} disabled={!isActive && !isCompleted} className={`w-5 h-5 rounded-md border-2 ${isCompleted ? 'opacity-50 accent-accent-green' : isActive ? 'border-white/20 cursor-pointer' : 'opacity-30 border-white/10 bg-transparent appearance-none'}`} />
        </div>
      </div>
    );
  };

  return (
    <main className="min-h-screen flex flex-col bg-background relative pb-28">
      {/* Sticky Top Header */}
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-xl px-4 py-3 flex justify-between items-center border-b border-white/5 pt-[max(env(safe-area-inset-top),16px)]">
        <div className="flex flex-col">
          <span className="text-[10px] text-text-muted font-bold uppercase tracking-widest">{activeExercises.length === 0 ? 'Freestyle Mode' : 'Active Workout'}</span>
          <h1 className="text-xl font-black text-accent-green tabular-nums">{time}</h1>
        </div>
        <Link href="/" className="bg-accent-green text-black px-5 py-2 rounded-xl font-black text-sm active:scale-95 transition-transform shadow-[0_0_15px_rgba(74,222,128,0.3)]">
          FINISH
        </Link>
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

        {activeExercises.map((exercise, exIndex) => (
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

            {/* Simulated Sets Array based on targetSets */}
            {Array.from({ length: exercise.targetSets }).map((_, setIndex) => 
              renderSetRow(exercise.trackingType, setIndex, exercise)
            )}

            <button className="mt-2 text-[10px] uppercase tracking-widest font-bold text-text-muted w-full py-2 flex items-center justify-center gap-1 hover:text-white transition-colors z-10 bg-white/5 rounded-lg border border-white/5">
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
    </main>
  );
}
