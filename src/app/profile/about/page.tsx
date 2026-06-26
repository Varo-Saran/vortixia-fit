"use client";

import { useState } from "react";
import { ArrowLeft, ChevronDown, ChevronUp, ChevronRight, MessageSquare, Mail, Info, Flame, Swords, Trophy, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface FAQItemProps {
  question: string;
  answer: string;
  icon: React.ReactNode;
}

function FAQItem({ question, answer, icon }: FAQItemProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-white/5 border border-white/5 rounded-2xl overflow-hidden transition-all duration-300">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 flex items-center justify-between text-left outline-none hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3 pr-4">
          <div className="p-2 bg-accent-green/10 rounded-xl text-accent-green flex-shrink-0">
            {icon}
          </div>
          <span className="font-extrabold text-sm text-white">{question}</span>
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-text-muted" />
        ) : (
          <ChevronDown className="w-4 h-4 text-text-muted" />
        )}
      </button>
      
      {isOpen && (
        <div className="p-4 pt-0 text-xs text-text-muted leading-relaxed border-t border-white/5 bg-black/20 animate-fade-in">
          {answer}
        </div>
      )}
    </div>
  );
}

export default function AboutPage() {
  const router = useRouter();

  return (
    <main className="flex min-h-screen flex-col pt-[var(--notch-top)] pb-28 px-6 bg-[#050505] text-white relative overflow-x-hidden">
      
      {/* Subtle background glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-accent-green/5 blur-[120px] rounded-full pointer-events-none" />

      {/* Header */}
      <header className="w-full flex items-center py-4 mb-6 sticky top-[var(--notch-top)] z-20 bg-[#050505]/80 backdrop-blur-lg border-b border-white/5">
        <button 
          onClick={() => router.back()} 
          className="mr-4 p-2 bg-white/5 rounded-full border border-white/10 hover:bg-white/10 transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <h1 className="text-xl font-extrabold tracking-tight">About</h1>
      </header>

      {/* App Branding */}
      <section className="flex flex-col items-center text-center my-6 animate-fade-in-up">
        <div className="w-16 h-16 rounded-3xl bg-accent-green/10 border border-accent-green/30 flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(74,222,128,0.15)]">
          <span className="text-3xl font-black text-accent-green">V</span>
        </div>
        <h2 className="text-2xl font-black tracking-tight text-white">VORTIXIA FIT</h2>
        <p className="text-[10px] text-text-muted font-mono mt-1 bg-white/5 px-2.5 py-1 rounded-full border border-white/5">
          Version 1.0.0 (Beta)
        </p>
        <p className="text-xs text-text-muted max-w-sm mt-4 leading-relaxed font-medium">
          The ultimate digital fitness cockpit designed for high-performance athletes. Track workouts dynamically, measure CNS readiness, and battle friends in active gamified duels.
        </p>
      </section>

      {/* Help & FAQ Section */}
      <section className="w-full mb-8 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-4 ml-2">
          Help & Frequently Asked Questions
        </h3>
        
        <div className="flex flex-col gap-3">
          <FAQItem
            icon={<Flame className="w-4 h-4" />}
            question="What is CNS Readiness?"
            answer="CNS (Central Nervous System) Readiness indicates your physical recovery state. It's computed from heart rate metrics, sleep duration, and active muscle recovery percentages. A score above 80% means you are ready for maximum intensity, while scores below 50% suggest active rest or a recovery day."
          />
          <FAQItem
            icon={<Swords className="w-4 h-4" />}
            question="How do active Duels work?"
            answer="Duels allow you to challenge a lifting partner to a gamified workout race. When you log workouts, the XP earned is added to your duel score. You wager a custom amount of XP, and at the end of the duel, the lifter with the highest score wins the entire wager."
          />
          <FAQItem
            icon={<Trophy className="w-4 h-4" />}
            question="How is XP calculated and gained?"
            answer="You earn 50 XP for every set completed during an active workout session, plus 0.1 XP per kilogram of total volume lifted (weight * reps). If you accidentally log a session, deleting it from your streak calendar will automatically recalculate and deduct the exact XP from your total and active duels."
          />
          <FAQItem
            icon={<ShieldCheck className="w-4 h-4" />}
            question="Is my account data stored securely?"
            answer="Yes, all metrics, credentials, and workout histories are safely stored in Supabase with fully configured Row-Level Security (RLS). Only you can read, update, or delete your workout logs and profile metrics."
          />
        </div>
      </section>

      {/* Support Contact Section */}
      <section className="w-full mb-6 animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
        <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-4 ml-2">
          Support & Feedback
        </h3>
        
        <div className="glass-card p-4 border border-white/5 rounded-3xl flex flex-col gap-3 bg-white/3">
          <a 
            href="mailto:support@vortixia.fit" 
            className="flex items-center justify-between p-3 rounded-2xl bg-black/40 border border-white/5 hover:bg-white/5 transition-all group"
          >
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-accent-green" />
              <div className="flex flex-col">
                <span className="text-sm font-bold text-white">Contact Support</span>
                <span className="text-[10px] text-text-muted">support@vortixia.fit</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-white transition-all" />
          </a>

          <Link 
            href="/profile/feedback" 
            className="flex items-center justify-between p-3 rounded-2xl bg-black/40 border border-white/5 hover:bg-white/5 transition-all group"
          >
            <div className="flex items-center gap-3">
              <MessageSquare className="w-4 h-4 text-accent-green" />
              <div className="flex flex-col">
                <span className="text-sm font-bold text-white">Submit Bug / Feedback</span>
                <span className="text-[10px] text-text-muted">Report issues or suggest features</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-white transition-all" />
          </Link>
        </div>
      </section>

      {/* Footer Attributions */}
      <div className="w-full text-center mt-8">
        <p className="text-[9px] text-text-muted font-extrabold uppercase tracking-widest">
          Created by Coach Vathsaran
        </p>
        <p className="text-[8px] text-text-muted font-mono mt-1 opacity-50">
          © 2026 Vortixia Inc. All Rights Reserved.
        </p>
      </div>

    </main>
  );
}
