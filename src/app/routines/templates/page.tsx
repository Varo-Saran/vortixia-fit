"use client";

import { useRoutineStore } from "@/store/useRoutineStore";
import { ChevronLeft, Library, Check, X, Download, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { GoalType, SplitType } from "@/lib/ixia-ai";
import { IxiaLoadingState } from "@/components/IxiaLoadingState";
import Orb from "@/components/Orb";

export default function TemplatesPage() {
  const { templates, loadTemplate, applyAiRoutine, exportRoutine } = useRoutineStore();
  const router = useRouter();
  const [appliedId, setAppliedId] = useState<string | null>(null);

  // iXiA AI Modal State
  const [showAiModal, setShowAiModal] = useState(false);
  const [goal, setGoal] = useState<GoalType>('hypertrophy');
  const [split, setSplit] = useState<SplitType>('ppl');
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Confirmation state
  const [isConfirming, setIsConfirming] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<any>(null);

  const handleApplyTemplate = (id: string) => {
    loadTemplate(id);
    setAppliedId(id);
    setTimeout(() => {
      router.push("/routines");
    }, 800);
  };

  const handleGenerateAi = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal, split })
      });
      
      if (!res.ok) {
        throw new Error('Failed to generate routine from AI');
      }
      
      const data = await res.json();
      if (data.plan) {
        setGeneratedPlan(data.plan);
        setIsGenerating(false);
        setIsConfirming(true);
      } else {
        throw new Error('Invalid response structure');
      }
    } catch (error) {
      console.error('Error generating AI routine:', error);
      setIsGenerating(false);
      // Could show an error message here if an error state existed
    }
  };

  const handleConfirmAndBackup = () => {
    // 1. Auto-Backup current plan
    const base64Str = exportRoutine();
    if (base64Str) {
      const element = document.createElement("a");
      element.href = "data:text/plain;charset=utf-8," + encodeURIComponent(base64Str);
      element.download = `vortixia_routine_backup_${new Date().toISOString().slice(0,10)}.txt`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    }

    // 2. Apply new AI routine
    if (generatedPlan) {
      applyAiRoutine(generatedPlan);
    }

    // 3. Redirect
    setShowAiModal(false);
    setIsConfirming(false);
    router.push("/routines");
  };

  return (
    <main className="flex min-h-screen flex-col pt-[calc(var(--notch-top)+1rem)] pb-28 px-6 bg-[#050505] relative overflow-x-hidden">
      
      <header className="w-full flex items-center justify-between py-4 mb-2 sticky top-[var(--notch-top)] z-20 bg-[#050505]/80 backdrop-blur-lg">
        <div className="flex items-center gap-4">
          <Link href="/routines" className="p-2 bg-white/5 rounded-full border border-white/10 hover:bg-white/10 transition-colors">
            <ChevronLeft className="w-5 h-5 text-white" />
          </Link>
          <div className="flex flex-col">
            <h1 className="text-2xl font-extrabold tracking-tight text-white">Templates</h1>
            <span className="text-[10px] text-accent-green uppercase font-bold tracking-widest">Library</span>
          </div>
        </div>
      </header>

      {/* iXiA AI Premium Button */}
      <button 
        onClick={() => {
          setShowAiModal(true);
          setIsConfirming(false);
          setGeneratedPlan(null);
        }}
        className="w-full relative group overflow-hidden rounded-3xl p-6 border border-[#2EEA82]/40 bg-gradient-to-br from-[#0a1a12] to-[#050505] flex flex-col items-center justify-center gap-3 mb-6 animate-fade-in-up shadow-[0_0_30px_rgba(46,234,130,0.15)] transition-transform active:scale-95"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-[#2EEA82]/0 via-[#2EEA82]/20 to-[#2EEA82]/0 translate-x-[-100%] group-hover:animate-[shimmer_2s_infinite]" />
        
        {/* Breathing Orb inside Button */}
        <div className="relative flex items-center justify-center mb-2 w-16 h-16 pointer-events-none">
           <Orb hoverIntensity={0.2} rotateOnHover={true} forceHoverState={true} backgroundColor="transparent" />
        </div>
        
        <div className="flex flex-col items-center">
          <span className="text-lg font-black text-white tracking-widest uppercase shadow-black drop-shadow-md">iXiA Ai Generator</span>
          <span className="text-xs text-[#2EEA82]/80 font-medium">Auto-build your perfect routine</span>
        </div>
      </button>

      {/* Predefined Templates */}
      <section className="flex flex-col gap-4 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        {templates.map((tpl) => (
          <div key={tpl.id} className="glass-card p-5 relative overflow-hidden group border border-white/5">
            <div className="flex items-start justify-between relative z-10">
              <div className="flex flex-col">
                <h2 className="text-lg font-black text-white">{tpl.name}</h2>
                <span className="text-[10px] uppercase font-bold text-accent-green tracking-widest mt-1">{tpl.frequency}</span>
              </div>
              <Library className="w-6 h-6 text-white/20" />
            </div>
            
            <p className="text-xs text-text-muted mt-3 relative z-10 pr-4">
              {tpl.description}
            </p>

            <button
              onClick={() => handleApplyTemplate(tpl.id)}
              disabled={appliedId !== null}
              className={`w-full mt-5 py-3 rounded-xl font-bold text-sm tracking-wide transition-all ${
                appliedId === tpl.id 
                  ? 'bg-accent-green text-black' 
                  : 'bg-white/10 text-white hover:bg-white/20 border border-white/5'
              }`}
            >
              {appliedId === tpl.id ? (
                <span className="flex items-center justify-center gap-2">
                  <Check className="w-4 h-4" /> APPLIED
                </span>
              ) : (
                "APPLY TEMPLATE"
              )}
            </button>
          </div>
        ))}
      </section>

      {/* iXiA AI Modal */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-fade-in">
          <div className="w-full max-w-sm bg-[#050505] border border-white/10 rounded-[2rem] overflow-hidden relative shadow-[0_0_50px_rgba(46,234,130,0.1)]">
            
            <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-[#2EEA82]/10 to-transparent pointer-events-none" />

            {isGenerating ? (
              <IxiaLoadingState />
            ) : isConfirming ? (
              <div className="p-8 flex flex-col items-center text-center animate-fade-in-up">
                <button 
                  onClick={() => setShowAiModal(false)}
                  className="absolute top-4 right-4 p-2 bg-white/5 rounded-full hover:bg-white/10 z-10"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
                <div className="relative mb-6 mt-4 pointer-events-none">
                  <div className="w-24 h-24">
                    <Orb hoverIntensity={0.8} rotateOnHover={true} forceHoverState={true} backgroundColor="transparent" />
                  </div>
                </div>
                <h2 className="text-2xl font-black text-white mb-2">Routine Built!</h2>
                
                <div className="bg-[#111] border border-white/10 rounded-2xl p-5 mb-6 mt-2 text-left w-full shadow-inner">
                  <div className="flex items-center gap-2 text-orange-400 mb-2">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Auto Backup</span>
                  </div>
                  <p className="text-xs text-text-muted leading-relaxed">
                    Applying this AI routine will <strong className="text-white">replace</strong> your active weekly plan. A backup file of your current routine will be downloaded instantly.
                  </p>
                </div>

                <button
                  onClick={handleConfirmAndBackup}
                  className="w-full bg-white text-black font-black text-sm py-4 rounded-xl hover:bg-gray-200 transition-all flex items-center justify-center gap-2 shadow-lg"
                >
                  <Download className="w-4 h-4" /> PROCEED & DOWNLOAD
                </button>
              </div>
            ) : (
              <div className="p-8 relative z-10">
                <button 
                  onClick={() => setShowAiModal(false)}
                  className="absolute top-4 right-4 p-2 bg-white/5 rounded-full hover:bg-white/10"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
                
                <div className="flex flex-col items-center mb-8 mt-2 pointer-events-none">
                  <div className="w-16 h-16 mb-2">
                     <Orb hoverIntensity={0.1} rotateOnHover={true} forceHoverState={true} backgroundColor="transparent" />
                  </div>
                  <h2 className="text-xl font-black text-white">iXiA Ai Setup</h2>
                  <p className="text-[10px] text-text-muted font-bold tracking-widest uppercase mt-1">Smart Assistant is Ready</p>
                </div>

                <div className="flex flex-col gap-6">
                  {/* Goal Selection */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] uppercase font-bold text-[#2EEA82] tracking-widest ml-1">Main Goal</label>
                    <div className="flex flex-col gap-2">
                      {(['hypertrophy', 'strength', 'endurance'] as GoalType[]).map((g) => (
                        <button
                          key={g}
                          onClick={() => setGoal(g)}
                          className={`py-4 px-5 rounded-2xl text-xs font-bold transition-all border flex items-center justify-between ${
                            goal === g 
                              ? 'bg-[#2EEA82]/10 border-[#2EEA82] text-white shadow-[0_0_15px_rgba(46,234,130,0.1)]' 
                              : 'bg-white/5 border-white/5 text-text-muted hover:bg-white/10'
                          }`}
                        >
                          {g.charAt(0).toUpperCase() + g.slice(1)}
                          {goal === g && <div className="w-2 h-2 rounded-full bg-[#2EEA82]" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Split Selection */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] uppercase font-bold text-[#2EEA82] tracking-widest ml-1 mt-2">Preferred Split</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setSplit('ppl')}
                        className={`py-3 rounded-xl text-xs font-bold transition-all border ${
                          split === 'ppl' ? 'bg-[#2EEA82]/10 border-[#2EEA82] text-white' : 'bg-white/5 border-white/5 text-text-muted'
                        }`}
                      >
                        Push/Pull/Legs
                      </button>
                      <button
                        onClick={() => setSplit('bro_split')}
                        className={`py-3 rounded-xl text-xs font-bold transition-all border ${
                          split === 'bro_split' ? 'bg-[#2EEA82]/10 border-[#2EEA82] text-white' : 'bg-white/5 border-white/5 text-text-muted'
                        }`}
                      >
                        Bro Split
                      </button>
                      <button
                        onClick={() => setSplit('upper_lower')}
                        className={`py-3 rounded-xl text-xs font-bold transition-all border ${
                          split === 'upper_lower' ? 'bg-[#2EEA82]/10 border-[#2EEA82] text-white' : 'bg-white/5 border-white/5 text-text-muted'
                        }`}
                      >
                        Upper/Lower
                      </button>
                      <button
                        onClick={() => setSplit('full_body')}
                        className={`py-3 rounded-xl text-xs font-bold transition-all border ${
                          split === 'full_body' ? 'bg-[#2EEA82]/10 border-[#2EEA82] text-white' : 'bg-white/5 border-white/5 text-text-muted'
                        }`}
                      >
                        Full Body
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={handleGenerateAi}
                    className="w-full mt-4 bg-[#2EEA82] text-black font-black text-sm py-4 rounded-2xl shadow-[0_0_20px_rgba(46,234,130,0.3)] hover:shadow-[0_0_30px_rgba(46,234,130,0.5)] transition-all flex items-center justify-center gap-2"
                  >
                    GENERATE ROUTINE
                  </button>
                </div>
              </div>
            )}
            
          </div>
        </div>
      )}
      
    </main>
  );
}
