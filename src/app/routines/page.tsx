"use client";

import { useRoutineStore } from "@/store/useRoutineStore";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { ChevronRight, Settings2, Play, Library, Share, Download, X, Copy, Check, Edit3, RotateCcw, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "react-hot-toast";

export default function RoutinesPage() {
  const { 
    weeklyPlan, 
    fetchRoutine, 
    exportRoutine, 
    importRoutine,
    resetActiveSplit,
    clearAllCustomTemplates
  } = useRoutineStore();
  
  const { startWorkout } = useWorkoutStore();
  const router = useRouter();

  // Modals state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importCode, setImportCode] = useState("");
  const [importError, setImportError] = useState(false);
  
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportCode, setExportCode] = useState("");
  const [copied, setCopied] = useState(false);

  // Settings Modal State
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Workout Day Selection Modal
  const [showDaySelectModal, setShowDaySelectModal] = useState(false);

  useEffect(() => {
    if (weeklyPlan.length === 0) {
      fetchRoutine();
    }
  }, [weeklyPlan.length, fetchRoutine]);

  const handleExport = () => {
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

  const handleImport = () => {
    const success = importRoutine(importCode);
    if (success) {
      setShowImportModal(false);
      setImportCode("");
      setImportError(false);
      toast.success("Split imported successfully!");
    } else {
      setImportError(true);
      toast.error("Failed to import. Invalid code.");
    }
  };

  // Resets active split to defaults
  const handleResetActive = () => {
    if (confirm("Are you sure you want to reset your active split to the default Push/Pull/Legs (6-Day) program? This will overwrite your current schedule.")) {
      resetActiveSplit();
      toast.success("Active routine reset to defaults!");
      setShowSettingsModal(false);
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
  const handleLaunchWorkout = (title: string, lifts: any[]) => {
    if (lifts.length === 0) {
      toast.error("Cannot start a workout with 0 exercises.");
      return;
    }
    startWorkout(title, lifts);
    toast.success(`Started workout: ${title}!`);
    router.push("/workout");
  };

  const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const todayName = daysOfWeek[new Date().getDay()];

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

      {/* Action Bar */}
      <section className="flex gap-2 mb-6 animate-fade-in-up">
         <Link href="/routines/templates" className="flex-1 bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform">
            <Library className="w-5 h-5 text-accent-green" />
            <span className="text-[10px] uppercase font-bold text-white tracking-widest">Templates</span>
         </Link>
         <button onClick={handleExport} className="flex-1 bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform">
            <Share className="w-5 h-5 text-blue-400" />
            <span className="text-[10px] uppercase font-bold text-white tracking-widest">Share</span>
         </button>
         <button onClick={() => setShowImportModal(true)} className="flex-1 bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform">
            <Download className="w-5 h-5 text-orange-400" />
            <span className="text-[10px] uppercase font-bold text-white tracking-widest">Import</span>
         </button>
      </section>

      <section className="mb-6 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        <div className="glass-card p-5 flex flex-col relative overflow-hidden group border-accent-green/30">
           <div className="absolute top-0 right-0 w-32 h-32 bg-accent-green/10 blur-3xl rounded-full" />
           <span className="text-[10px] text-accent-green font-bold tracking-widest uppercase mb-1 z-10">Active Split</span>
           <h2 className="text-2xl font-black text-white z-10">Custom Plan</h2>
           <p className="text-xs text-text-muted mt-1 z-10 mb-4">View your weekly split below.</p>
           
           <div className="flex gap-2 w-full z-10">
             <button 
               onClick={() => setShowDaySelectModal(true)}
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
               <span className="text-[10px] tracking-widest uppercase">Edit Split</span>
             </Link>
           </div>
        </div>
      </section>

      <section className="flex flex-col gap-3 pb-8">
        {weeklyPlan.map((plan, index) => (
          <div key={plan.day} className="glass-card p-4 flex flex-col gap-2 animate-fade-in-up border border-white/5" style={{ animationDelay: `${index * 0.05}s` }}>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-sm
                  ${plan.type === 'Rest' ? 'bg-black/50 text-text-muted border border-white/5' : 'bg-white/10 text-white'}
                  ${plan.day === todayName ? 'border-2 border-accent-green' : ''}
                `}>
                  {plan.shortDay}
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold text-text-muted tracking-widest">{plan.type}</span>
                    {plan.day === todayName && (
                      <span className="text-[8px] bg-accent-green/20 text-accent-green font-black uppercase tracking-widest px-1.5 py-0.5 rounded">TODAY</span>
                    )}
                  </div>
                  <span className="font-bold text-white text-base">{plan.title}</span>
                </div>
              </div>

              {/* Direct Play button on card */}
              {plan.type !== 'Rest' && plan.mainLifts.length > 0 && (
                <button
                  onClick={() => handleLaunchWorkout(plan.title, plan.mainLifts)}
                  aria-label={`Start ${plan.day} Workout`}
                  className="w-10 h-10 rounded-full bg-accent-green/10 border border-accent-green/30 hover:bg-accent-green hover:text-black flex items-center justify-center text-accent-green transition-all active:scale-95"
                >
                  <Play className="w-4 h-4 fill-current" />
                </button>
              )}
            </div>

            {/* Exercises List preview */}
            <div className="mt-2 pl-[4.5rem] flex flex-col gap-1">
              {plan.mainLifts.map((ex, i) => (
                <div key={i} className="flex flex-col">
                  <span className="text-sm font-medium text-white truncate">
                    <span className="font-bold text-accent-green/80 mr-2">{ex.targetSets}x</span>
                    {ex.name}
                  </span>
                  <span className="text-[10px] text-text-muted">
                    {ex.targetValue} · {ex.trackingType.replace('_', ' ')} · {ex.weightUnit}
                  </span>
                </div>
              ))}
              {plan.mainLifts.length === 0 && <span className="text-xs text-text-muted italic">No exercises planned.</span>}
            </div>
          </div>
        ))}
      </section>

      {/* WORKOUT DAY SELECTOR MODAL */}
      {showDaySelectModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111] border border-white/10 w-full max-w-sm rounded-[2rem] p-6 relative animate-fade-in-up">
            <button 
              onClick={() => setShowDaySelectModal(false)} 
              className="absolute top-4 right-4 p-2 bg-white/5 rounded-full text-text-muted hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-black text-white mb-2">Select Workout Day</h3>
            <p className="text-xs text-text-muted mb-4">Choose which day's workout from your split you would like to perform today.</p>
            
            <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto pr-1">
              {weeklyPlan.map((plan) => {
                const isToday = plan.day === todayName;
                const isRest = plan.type === "Rest" || plan.mainLifts.length === 0;

                return (
                  <button
                    key={plan.day}
                    disabled={isRest}
                    onClick={() => {
                      setShowDaySelectModal(false);
                      handleLaunchWorkout(plan.title, plan.mainLifts);
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
                        <span className="text-xs font-black text-white">{plan.day}</span>
                        <span className="text-[9px] uppercase text-text-muted font-semibold">({plan.type})</span>
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
              onChange={(e) => { setImportCode(e.target.value); setImportError(false); }}
              placeholder="Paste code here..."
              className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white text-xs font-mono outline-none h-24 mb-2 resize-none"
            />
            {importError && <p className="text-red-500 text-xs font-bold mb-4">Invalid routine code. Please try again.</p>}
            <button 
              onClick={handleImport}
              disabled={importCode.length === 0}
              className="w-full py-3 bg-accent-green text-black font-black rounded-xl active:scale-95 transition-transform disabled:opacity-50"
            >
              IMPORT
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
                onClick={handleResetActive}
                className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold p-4 rounded-xl flex items-center gap-3 transition-colors text-left"
              >
                <RotateCcw className="w-5 h-5 text-accent-green" />
                <div className="flex flex-col">
                  <span className="text-sm font-black">Reset Active Split</span>
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

              <button 
                onClick={handleDownloadBackup}
                className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold p-4 rounded-xl flex items-center gap-3 transition-colors text-left"
              >
                <Download className="w-5 h-5 text-blue-400" />
                <div className="flex flex-col">
                  <span className="text-sm font-black">Backup Active Split</span>
                  <span className="text-[10px] text-text-muted">Download your current active routine as a file</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
