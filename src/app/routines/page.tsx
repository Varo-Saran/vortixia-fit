"use client";

import { useRoutineStore } from "@/store/useRoutineStore";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import {
  isDayStartable,
  mainOccurrences,
  shortWeekday,
  weekdayLabel,
} from "@/lib/routine-model";
import { routineCapabilities } from '@/lib/routine-compatibility';
import { savedValue, workoutDaySelection } from '@/lib/routine-recovery';
import { RoutineStateNotice, RecoveryBackupButton } from '@/components/routine-editor/RoutineStateNotice';
import { RoutineDayEditor } from '@/components/routine-editor/RoutineDayEditor';
import { Settings2, Play, Library, Share, Download, X, Copy, Check, Edit3, RotateCcw, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { RoutineGuardedLink as Link } from '@/components/RoutineDraftGuard';
import { RoutineGuardCancelledError } from '@/lib/routine-draft-guard';
import { toast } from "react-hot-toast";

export default function RoutinesPage() {
  const { 
    routine,
    loadStatus,
    isSaving,
    draftStatus,
    fetchRoutine, 
    exportRoutine, 
    importRoutine,
    resetActiveSplit,
    clearAllCustomTemplates
  } = useRoutineStore();
  const state = useRoutineStore(), caps = routineCapabilities(state);
  const [readDay, setReadDay] = useState<string | null>(null);
  
  const { startWorkout } = useWorkoutStore();
  const router = useRouter();

  // Modals state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importCode, setImportCode] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportCode, setExportCode] = useState("");
  const [copied, setCopied] = useState(false);

  // Settings Modal State
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Workout Day Selection Modal
  const [showDaySelectModal, setShowDaySelectModal] = useState(false);

  useEffect(() => {
    if (loadStatus === 'idle') void fetchRoutine();
  }, [loadStatus, fetchRoutine]);

  const handleExport = () => {
    if (!routineCapabilities(useRoutineStore.getState()).canShare) return;
    const code = exportRoutine();
    setExportCode(code);
    setShowExportModal(true);
    setCopied(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(exportCode);
    setCopied(true);
    toast.success("Code copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleImport = async () => {
    if (isImporting || !routineCapabilities(useRoutineStore.getState()).canApplyTemplate) return;

    setIsImporting(true);
    setImportError(null);
    try {
      const outcome = await importRoutine(importCode);
      if (outcome.status === 'saved-with-newer-edits' || useRoutineStore.getState().hasUnsavedChanges) return;
      setShowImportModal(false);
      setImportCode("");
      toast.success("Split imported and saved successfully!");
    } catch (error) {
      if (error instanceof RoutineGuardCancelledError) return;
      const message = error instanceof Error
        ? error.message
        : "Unable to import and save this routine.";
      setImportError(message);
      toast.error(message);
    } finally {
      setIsImporting(false);
    }
  };

  // Resets active split to defaults
  const handleResetActive = async () => {
    const current = useRoutineStore.getState();
    if (isResetting || !routineCapabilities(current).canReset) return;
    if (current.loadStatus === 'needs_attention' || confirm("Are you sure you want to reset your active split to the default Push/Pull/Legs (6-Day) program? This will overwrite your current schedule.")) {
      setIsResetting(true);
      try {
        const outcome = await resetActiveSplit();
        if (outcome.status === 'saved-with-newer-edits' || useRoutineStore.getState().hasUnsavedChanges) return;
        toast.success("Active routine reset and saved!");
        setShowSettingsModal(false);
      } catch (error) {
        if (error instanceof RoutineGuardCancelledError) return;
        const message = error instanceof Error
          ? error.message
          : "Unable to reset and save the active routine.";
        toast.error(message);
      } finally {
        setIsResetting(false);
      }
    }
  };

  // Clears all custom templates
  const handleClearCustomTemplates = () => {
    if (confirm("Are you sure you want to delete all saved templates from 'My Plans'? This action is permanent.")) {
      clearAllCustomTemplates();
      toast.success("All custom templates deleted!");
      setShowSettingsModal(false);
    }
  };

  // Download active split file
  const handleDownloadBackup = () => {
    if (!routineCapabilities(useRoutineStore.getState()).canShare) return;
    const base64Str = exportRoutine();
    if (base64Str) {
      const element = document.createElement("a");
      element.href = "data:text/plain;charset=utf-8," + encodeURIComponent(base64Str);
      element.download = `vortixia_routine_backup_${new Date().toISOString().slice(0,10)}.txt`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
      toast.success("Backup downloaded!");
      setShowSettingsModal(false);
    } else {
      toast.error("Failed to export active routine.");
    }
  };

  // Workout launching helper
  const handleLaunchWorkout = (dayId: string) => {
    let selection;
    try { selection = workoutDaySelection(useRoutineStore.getState(), dayId); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to start workout.'); return; }
    startWorkout(selection.title, selection.exercises);
    toast.success(`Started workout: ${selection.title}!`);
    router.push("/workout");
  };

  const daysOfWeek = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
  const todayName = daysOfWeek[new Date().getDay()];
  const weeklyPlan = routine?.days ?? [];

  return (
    <main className="flex min-h-screen flex-col pt-[calc(var(--notch-top)+1rem)] pb-28 px-6 bg-[#050505] relative overflow-x-hidden">
      <header className="w-full flex items-center justify-between mb-6">
        <div className="flex flex-col">
          <span className="text-text-muted text-sm font-bold uppercase tracking-widest">My Plans</span>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Routines</h1>
        </div>
        <button 
          onClick={() => setShowSettingsModal(true)}
          aria-label="Routines Settings" 
          className="w-10 h-10 rounded-full border border-white/10 bg-black/50 flex items-center justify-center shadow-[0_0_10px_rgba(255,255,255,0.05)] active:scale-95 transition-all hover:bg-white/5"
        >
          <Settings2 className="w-5 h-5 text-text-muted hover:text-white transition-colors" />
        </button>
      </header>

      <RoutineStateNotice />

      {/* Action Bar */}
      {routine && <p role="status" className="mb-3 text-xs text-text-muted">{isSaving ? 'Saving…' : draftStatus}</p>}
      <section className="flex gap-2 mb-6 animate-fade-in-up">
         <Link href="/routines/templates" className="flex-1 bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform">
            <Library className="w-5 h-5 text-accent-green" />
            <span className="text-[10px] uppercase font-bold text-white tracking-widest">Templates</span>
         </Link>
         <button onClick={handleExport} disabled={!caps.canShare} className="flex-1 bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform disabled:opacity-40">
            <Share className="w-5 h-5 text-blue-400" />
            <span className="text-[10px] uppercase font-bold text-white tracking-widest">Share</span>
         </button>
          <button
            onClick={() => { if (routineCapabilities(useRoutineStore.getState()).canApplyTemplate) setShowImportModal(true); }}
            disabled={!caps.canApplyTemplate}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform disabled:opacity-50"
          >
            <Download className="w-5 h-5 text-orange-400" />
            <span className="text-[10px] uppercase font-bold text-white tracking-widest">Import</span>
         </button>
      </section>

      <section className="mb-6 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        <div className="glass-card p-5 flex flex-col relative overflow-hidden group border-accent-green/30">
           <div className="absolute top-0 right-0 w-32 h-32 bg-accent-green/10 blur-3xl rounded-full" />
           <span className="text-[10px] text-accent-green font-bold tracking-widest uppercase mb-1 z-10">Active Split</span>
           <h2 className="text-2xl font-black text-white z-10">{savedValue(routine?.name ?? state.readGraph?.name ?? 'Routine')}</h2>
           <p className="text-xs text-text-muted mt-1 z-10 mb-4">View your weekly split below.</p>
           
           <div className="flex gap-2 w-full z-10">
             <button 
               onClick={() => { if (routineCapabilities(useRoutineStore.getState()).canStartWorkout) setShowDaySelectModal(true); }}
               disabled={!caps.canStartWorkout}
               className="flex-[2] bg-accent-green hover:bg-[#2ae07b] text-black font-black py-4 rounded-xl flex justify-center items-center gap-2 active:scale-95 transition-all shadow-[0_0_20px_rgba(74,222,128,0.3)]"
             >
               <Play className="w-5 h-5 fill-black" />
               START WORKOUT
             </button>
             <Link 
               href="/routines/edit"
               className="flex-1 bg-white/10 border border-white/10 text-white font-bold py-4 rounded-xl flex flex-col justify-center items-center gap-1 hover:bg-white/20 active:scale-95 transition-all"
             >
               <Edit3 className="w-5 h-5" />
               <span className="text-[10px] tracking-widest uppercase">{state.readGraph ? 'Fix Routine' : 'Edit Split'}</span>
             </Link>
           </div>
        </div>
      </section>

      <section className="flex flex-col gap-3 pb-8">
        {state.readGraph && state.readGraph.days.map(day => <RoutineDayEditor key={day.id} day={day} expanded={readDay === day.id} onToggle={() => setReadDay(readDay === day.id ? null : day.id)} onOccurrence={() => router.push('/routines/edit')} onAdd={() => {}} defaultRest={60} announce={() => {}} focus={() => {}} />)}
        {weeklyPlan.map((plan, index) => {
          const lifts = mainOccurrences(plan);
          return (
          <div key={plan.id} className="glass-card p-4 flex flex-col gap-2 animate-fade-in-up border border-white/5" style={{ animationDelay: `${index * 0.05}s` }}>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-sm
                  ${plan.kind !== 'training' ? 'bg-black/50 text-text-muted border border-white/5' : 'bg-white/10 text-white'}
                  ${plan.weekday === todayName ? 'border-2 border-accent-green' : ''}
                `}>
                  {shortWeekday(plan.weekday)}
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold text-text-muted tracking-widest">{plan.kind}</span>
                    {plan.weekday === todayName && (
                      <span className="text-[8px] bg-accent-green/20 text-accent-green font-black uppercase tracking-widest px-1.5 py-0.5 rounded">TODAY</span>
                    )}
                  </div>
                  <span className="font-bold text-white text-base">{plan.title}</span>
                </div>
              </div>

              {/* Direct Play button on card */}
              {isDayStartable(plan) && (
                <button
                  onClick={() => handleLaunchWorkout(plan.id)}
                  aria-label={`Start ${weekdayLabel(plan.weekday)} Workout`}
                  className="w-10 h-10 rounded-full bg-accent-green/10 border border-accent-green/30 hover:bg-accent-green hover:text-black flex items-center justify-center text-accent-green transition-all active:scale-95"
                >
                  <Play className="w-4 h-4 fill-current" />
                </button>
              )}
            </div>

            {/* Exercises List preview */}
            <div className="mt-2 pl-[4.5rem] flex flex-col gap-1">
              {lifts.map((ex) => (
                <div key={ex.id} className="flex flex-col">
                  <span className="text-sm font-medium text-white truncate">
                    <span className="font-bold text-accent-green/80 mr-2">{ex.targetSets}x</span>
                    {ex.name}
                  </span>
                  <span className="text-[10px] text-text-muted">
                    {ex.targetValue} · {ex.trackingType.replace('_', ' ')} · {ex.weightUnit}
                  </span>
                </div>
              ))}
              {lifts.length === 0 && <span className="text-xs text-text-muted italic">No exercises planned.</span>}
            </div>
          </div>
        )})}
      </section>

      {/* WORKOUT DAY SELECTOR MODAL */}
      {showDaySelectModal && caps.canStartWorkout && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111] border border-white/10 w-full max-w-sm rounded-[2rem] p-6 relative animate-fade-in-up">
            <button 
              onClick={() => setShowDaySelectModal(false)} 
              className="absolute top-4 right-4 p-2 bg-white/5 rounded-full text-text-muted hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-black text-white mb-2">Select Workout Day</h3>
            <p className="text-xs text-text-muted mb-4">Choose which day&apos;s workout from your split you would like to perform today.</p>
            
            <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto pr-1">
              {weeklyPlan.map((plan) => {
                const isToday = plan.weekday === todayName;
                const isRest = !isDayStartable(plan);

                return (
                  <button
                    key={plan.id}
                    disabled={isRest}
                    onClick={() => {
                      setShowDaySelectModal(false);
                      handleLaunchWorkout(plan.id);
                    }}
                    className={`p-3 rounded-xl flex items-center justify-between border transition-all text-left ${
                      isRest 
                        ? 'opacity-40 bg-black/30 border-white/5 cursor-not-allowed'
                        : isToday
                          ? 'bg-accent-green/10 border-accent-green text-white font-bold'
                          : 'bg-white/5 border-white/10 text-white hover:bg-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-white">{weekdayLabel(plan.weekday)}</span>
                        <span className="text-[9px] uppercase text-text-muted font-semibold">({plan.kind})</span>
                        {isToday && <span className="text-[8px] bg-accent-green/20 text-accent-green px-1.5 py-0.5 rounded font-black tracking-widest">TODAY</span>}
                      </div>
                      <span className="text-xs text-text-muted truncate mt-0.5 max-w-[200px]">{plan.title}</span>
                    </div>
                    {!isRest && (
                      <Play className={`w-4 h-4 ${isToday ? 'text-accent-green fill-accent-green/20' : 'text-text-muted'}`} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* IMPORT MODAL */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111] border border-white/10 w-full max-w-sm rounded-3xl p-6 relative animate-fade-in-up">
            <button onClick={() => setShowImportModal(false)} className="absolute top-4 right-4 p-2 bg-white/5 rounded-full text-text-muted hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-black text-white mb-2">Import Split</h3>
            <p className="text-xs text-text-muted mb-4">Paste a routine code shared by a friend to instantly apply their split to your planner.</p>
            <textarea 
              value={importCode}
              onChange={(e) => { setImportCode(e.target.value); setImportError(null); }}
              placeholder="Paste code here..."
              className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white text-xs font-mono outline-none h-24 mb-2 resize-none"
            />
            {importError && <p className="text-red-500 text-xs font-bold mb-4">{importError}</p>}
            <button 
              onClick={() => void handleImport()}
              disabled={importCode.length === 0 || isImporting || !caps.canApplyTemplate}
              className="w-full py-3 bg-accent-green text-black font-black rounded-xl active:scale-95 transition-transform disabled:opacity-50"
            >
              {isImporting ? "IMPORTING..." : "IMPORT"}
            </button>
          </div>
        </div>
      )}

      {/* EXPORT MODAL */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111] border border-white/10 w-full max-w-sm rounded-3xl p-6 relative animate-fade-in-up">
            <button onClick={() => setShowExportModal(false)} className="absolute top-4 right-4 p-2 bg-white/5 rounded-full text-text-muted hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-black text-white mb-2">Share Split</h3>
            <p className="text-xs text-text-muted mb-4">Copy this code and send it to your friends. They can import it into their planner.</p>
            <div className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white text-[10px] font-mono break-all h-32 overflow-y-auto mb-4 select-all">
              {exportCode}
            </div>
            <button 
              onClick={handleCopy}
              className={`w-full py-3 font-black rounded-xl active:scale-95 transition-colors flex items-center justify-center gap-2 ${copied ? 'bg-white text-black' : 'bg-blue-500 text-white'}`}
            >
              {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              {copied ? 'COPIED TO CLIPBOARD' : 'COPY CODE'}
            </button>
          </div>
        </div>
      )}

      {/* ROUTINE SETTINGS MODAL */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111] border border-white/10 w-full max-w-sm rounded-[2rem] p-6 relative animate-fade-in-up">
            <button onClick={() => setShowSettingsModal(false)} className="absolute top-4 right-4 p-2 bg-white/5 rounded-full text-text-muted hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-black text-white mb-2">Routine Settings</h3>
            <p className="text-xs text-text-muted mb-5">Manage and maintain your workout routines.</p>
            
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => void handleResetActive()}
                disabled={isResetting || !caps.canReset}
                className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold p-4 rounded-xl flex items-center gap-3 transition-colors text-left disabled:opacity-50"
              >
                <RotateCcw className="w-5 h-5 text-accent-green" />
                <div className="flex flex-col">
                  <span className="text-sm font-black">{isResetting ? "Resetting..." : "Reset Active Split"}</span>
                  <span className="text-[10px] text-text-muted">Revert your active program to the default 6-day PPL</span>
                </div>
              </button>

              <button 
                onClick={handleClearCustomTemplates}
                className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold p-4 rounded-xl flex items-center gap-3 transition-colors text-left"
              >
                <Trash2 className="w-5 h-5 text-red-500" />
                <div className="flex flex-col">
                  <span className="text-sm font-black">Clear Custom Templates</span>
                  <span className="text-[10px] text-text-muted">Delete all saved splits from your My Plans tab</span>
                </div>
              </button>

              {!caps.canReset && !state.replacementPending && !isSaving && <p className="text-xs text-white/60">Reset is unavailable until your saved routine and ownership can be verified. Retry loading first.</p>}
              {state.readGraph ? <RecoveryBackupButton /> : <button
                onClick={handleDownloadBackup} disabled={!caps.canShare}
                className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold p-4 rounded-xl flex items-center gap-3 transition-colors text-left"
              >
                <Download className="w-5 h-5 text-blue-400" />
                <div className="flex flex-col">
                  <span className="text-sm font-black">Backup Active Split</span>
                  <span className="text-[10px] text-text-muted">Download your current active routine as a file</span>
                </div>
              </button>}
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
