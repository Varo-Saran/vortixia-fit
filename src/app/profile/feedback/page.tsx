"use client";

import Link from "next/link";
import { ChevronLeft, MessageSquarePlus, Send, Target, Dumbbell } from "lucide-react";
import { useState } from "react";

export default function FeedbackPage() {
  const [exerciseName, setExerciseName] = useState("");
  const [targetMuscle, setTargetMuscle] = useState("");
  const [equipment, setEquipment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!exerciseName.trim()) return;
    
    // In production, this would send to Supabase or an API
    console.log("Submitted Request:", { exerciseName, targetMuscle, equipment });
    setSubmitted(true);
    
    setTimeout(() => {
      setSubmitted(false);
      setExerciseName("");
      setTargetMuscle("");
      setEquipment("");
    }, 3000);
  };

  return (
    <main className="flex min-h-screen flex-col pt-[var(--notch-top)] pb-24 px-6 bg-[#050505]">
      <header className="w-full flex items-center gap-4 py-4 mb-6">
        <Link href="/profile" className="p-2 bg-white/5 rounded-full border border-white/10 hover:bg-white/10 transition-colors" aria-label="Go back">
          <ChevronLeft className="w-5 h-5 text-white" />
        </Link>
        <h1 className="text-2xl font-extrabold tracking-tight text-white">Feedback</h1>
      </header>
      
      <section className="glass-card p-6 rounded-3xl flex flex-col gap-4 animate-fade-in-up">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-accent-green/20 flex items-center justify-center">
            <MessageSquarePlus className="w-5 h-5 text-accent-green" />
          </div>
          <div className="flex flex-col">
            <h2 className="text-lg font-black text-white">Request Exercise</h2>
            <span className="text-[10px] text-text-muted uppercase tracking-widest font-bold">Missing something?</span>
          </div>
        </div>

        <p className="text-xs text-text-muted mb-2">
          We have over 1,300+ exercises in our database, but if you can't find a specific variation, let us know and we'll add it to the global library.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase tracking-widest text-text-muted font-bold ml-1">Exercise Name *</label>
            <input 
              type="text" 
              value={exerciseName}
              onChange={e => setExerciseName(e.target.value)}
              placeholder="e.g. Kneeling Donkey Kicks"
              className="bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-text-muted/50 outline-none focus:border-accent-green transition-colors"
              required
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1 flex flex-col gap-1.5">
              <label className="text-[10px] uppercase tracking-widest text-text-muted font-bold ml-1 flex items-center gap-1">
                <Target className="w-3 h-3" /> Target Muscle
              </label>
              <input 
                type="text" 
                value={targetMuscle}
                onChange={e => setTargetMuscle(e.target.value)}
                placeholder="e.g. Glutes"
                className="bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-text-muted/50 outline-none focus:border-accent-green transition-colors"
              />
            </div>
            <div className="flex-1 flex flex-col gap-1.5">
              <label className="text-[10px] uppercase tracking-widest text-text-muted font-bold ml-1 flex items-center gap-1">
                <Dumbbell className="w-3 h-3" /> Equipment
              </label>
              <select 
                value={equipment}
                onChange={e => setEquipment(e.target.value)}
                className="bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-accent-green transition-colors appearance-none"
              >
                <option value="">Select...</option>
                <option value="bodyweight">Bodyweight</option>
                <option value="dumbbell">Dumbbell</option>
                <option value="barbell">Barbell</option>
                <option value="cable">Cable / Machine</option>
                <option value="band">Resistance Band</option>
              </select>
            </div>
          </div>

          <button 
            type="submit"
            disabled={!exerciseName.trim() || submitted}
            className={`w-full py-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 mt-2 transition-all active:scale-95
              ${submitted 
                ? 'bg-white text-black' 
                : 'bg-accent-green text-black hover:bg-accent-green/90 disabled:opacity-50 disabled:cursor-not-allowed'
              }`}
          >
            {submitted ? (
              "REQUEST SUBMITTED"
            ) : (
              <>
                <Send className="w-4 h-4" /> SUBMIT REQUEST
              </>
            )}
          </button>
        </form>
      </section>

      {/* Other Feedback Options (Placeholder for future) */}
      <section className="glass-card p-6 rounded-3xl flex flex-col gap-4 mt-4 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        <h2 className="text-sm font-black text-white uppercase tracking-widest border-b border-white/10 pb-3">General Feedback</h2>
        <p className="text-xs text-text-muted">
          Have an idea for a new feature, or found a bug? Send us an email at <span className="text-white font-bold">feedback@vortixia.fit</span>.
        </p>
      </section>
    </main>
  );
}
