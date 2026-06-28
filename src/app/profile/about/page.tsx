"use client";

import { useState, useEffect } from "react";
import { 
  ArrowLeft, ChevronDown, ChevronUp, ChevronRight, MessageSquare, 
  Mail, Info, Flame, Swords, Trophy, ShieldCheck, Activity, Smartphone,
  Wifi, HelpCircle, Eye, Monitor
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useProfileStore } from "@/store/useProfileStore";

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
        <div className="text-text-muted transition-transform duration-300">
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>
      
      <div 
        className={`transition-all duration-300 ease-in-out border-white/5 bg-black/20 ${
          isOpen ? "max-h-[300px] border-t p-4" : "max-h-0 overflow-hidden"
        }`}
      >
        <p className="text-xs text-text-muted leading-relaxed font-medium">
          {answer}
        </p>
      </div>
    </div>
  );
}

export default function AboutPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const { profile, fetchProfile } = useProfileStore();

  // Diagnostics state
  const [isOnline, setIsOnline] = useState(true);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [isPWA, setIsPWA] = useState(false);
  const [os, setOs] = useState("Unknown");
  const [networkType, setNetworkType] = useState("Active Connection");
  const [pushPermission, setPushPermission] = useState("Default");

  useEffect(() => {
    setMounted(true);
    
    // Initial fetch of profile if not loaded
    if (!profile) {
      fetchProfile();
    }

    // Capture environment properties safely in client
    if (typeof window !== "undefined") {
      setIsOnline(navigator.onLine);
      setIsPWA(window.matchMedia("(display-mode: standalone)").matches);
      setDimensions({ width: window.innerWidth, height: window.innerHeight });

      const handleResize = () => {
        setDimensions({ width: window.innerWidth, height: window.innerHeight });
      };
      window.addEventListener("resize", handleResize);

      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);

      // Detect OS
      const ua = navigator.userAgent.toLowerCase();
      if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ipod")) {
        setOs("iOS");
      } else if (ua.includes("android")) {
        setOs("Android");
      } else if (ua.includes("macintosh")) {
        setOs("macOS");
      } else if (ua.includes("windows")) {
        setOs("Windows");
      } else if (ua.includes("linux")) {
        setOs("Linux");
      }

      // Safe check for connection speed
      const connection = (navigator as any).connection;
      if (connection?.effectiveType) {
        setNetworkType(connection.effectiveType.toUpperCase());
      }

      // Check Notification Permission
      if (typeof Notification !== "undefined") {
        setPushPermission(Notification.permission);
      }

      return () => {
        window.removeEventListener("resize", handleResize);
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }
  }, [profile, fetchProfile]);

  // Loading spinner to prevent hydration mismatches on SSR
  if (!mounted) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050505] text-white">
        <div className="w-8 h-8 border-2 border-accent-green border-t-transparent rounded-full animate-spin"></div>
      </main>
    );
  }

  // Calculate Level and XP progress
  const userLevel = profile ? Math.floor((profile.total_xp || 0) / 2000) + 1 : 1;
  const currentLevelXp = profile ? (profile.total_xp || 0) % 2000 : 0;
  const progressPercent = Math.min((currentLevelXp / 2000) * 100, 100);

  // Dynamic diagnostic support mailto URL
  const emailSubject = encodeURIComponent("Vortixia Fit Support Request");
  const emailBody = encodeURIComponent(
    `Hi Coach Vathsaran,\n\nI need support with Vortixia Fit.\n\n` +
    `-- App Diagnostics Log --\n` +
    `User ID: ${profile?.id || "Guest/Unauthenticated"}\n` +
    `Username: @${profile?.username || "anonymous"}\n` +
    `Level: ${userLevel} (${profile?.total_xp || 0} total XP)\n` +
    `PWA Standalone: ${isPWA ? "Yes" : "No"}\n` +
    `OS: ${os}\n` +
    `Network state: ${isOnline ? "Online" : "Offline"} (${networkType})\n` +
    `Push Notifications status: ${pushPermission}\n` +
    `Viewport layout size: ${dimensions.width}x${dimensions.height}\n` +
    `User Agent: ${navigator.userAgent}\n`
  );
  const mailtoUrl = `mailto:support@vortixia.fit?subject=${emailSubject}&body=${emailBody}`;

  return (
    <main className="flex min-h-screen flex-col pt-[var(--notch-top)] pb-28 px-6 bg-[#050505] text-white relative overflow-x-hidden">
      
      {/* Background glow highlights */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-accent-green/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-20 left-0 w-48 h-48 bg-emerald-500/5 blur-[100px] rounded-full pointer-events-none" />

      {/* Sticky Header */}
      <header className="w-full flex items-center py-4 mb-6 sticky top-[var(--notch-top)] z-20 bg-[#050505]/80 backdrop-blur-lg border-b border-white/5">
        <button 
          onClick={() => router.back()} 
          className="mr-4 p-2 bg-white/5 rounded-full border border-white/10 hover:bg-white/10 transition-all active:scale-95"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <h1 className="text-xl font-extrabold tracking-tight">About Vortixia</h1>
      </header>

      {/* 1. Athlete Cockpit Header */}
      <section className="flex flex-col items-center text-center my-4 animate-fade-in-up bg-white/3 border border-white/5 p-6 rounded-3xl backdrop-blur-sm relative">
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent-green/10 border border-accent-green/30 text-accent-green font-mono text-[9px] uppercase tracking-widest px-3 py-1 rounded-full font-bold">
          Active Athlete profile
        </div>
        
        <div className="w-16 h-16 rounded-full border-2 border-emerald-500/30 p-0.5 shadow-[0_0_15px_rgba(16,185,129,0.15)] overflow-hidden mb-3.5 mt-2 bg-black/40 flex items-center justify-center">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="Profile" className="w-full h-full rounded-full object-cover" />
          ) : (
            <span className="text-2xl font-black text-accent-green">
              {profile?.username?.charAt(0).toUpperCase() || "V"}
            </span>
          )}
        </div>
        
        <h2 className="text-xl font-black tracking-tight text-white">
          @{profile?.username || "athlete"}
        </h2>
        
        <div className="flex items-center gap-1.5 mt-1 bg-white/5 border border-white/5 px-2.5 py-1 rounded-full text-xs font-bold text-text-muted">
          <span>Level {userLevel}</span>
          <span className="w-1 h-1 rounded-full bg-white/20" />
          <span className="text-white/80">{profile?.total_xp || 0} XP</span>
        </div>

        {/* Progress Bar */}
        <div className="w-full max-w-[200px] h-1.5 bg-white/10 rounded-full mt-3 overflow-hidden relative border border-white/5">
          <div 
            className="h-full bg-accent-green shadow-[0_0_8px_rgba(74,222,128,0.5)] rounded-full transition-all duration-500" 
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </section>

      {/* 2. Live System Diagnostics Panel */}
      <section className="w-full mb-8 animate-fade-in-up" style={{ animationDelay: '0.05s' }}>
        <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-4 ml-2 flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-accent-green" /> Live System Diagnostics
        </h3>

        <div className="bg-zinc-900/40 backdrop-blur-md border border-white/5 rounded-3xl p-5 flex flex-col gap-3.5">
          {/* Diagnostic variables */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col bg-black/30 border border-white/5 rounded-2xl p-3">
              <span className="text-[9px] uppercase font-bold text-text-muted tracking-wider flex items-center gap-1">
                <Smartphone className="w-3 h-3 text-blue-400" /> Platform Mode
              </span>
              <span className="text-xs font-black text-white mt-1.5">
                {isPWA ? "Standalone PWA" : "Browser Web Tab"}
              </span>
            </div>
            
            <div className="flex flex-col bg-black/30 border border-white/5 rounded-2xl p-3">
              <span className="text-[9px] uppercase font-bold text-text-muted tracking-wider flex items-center gap-1">
                <Monitor className="w-3 h-3 text-purple-400" /> OS Platform
              </span>
              <span className="text-xs font-black text-white mt-1.5">
                {os}
              </span>
            </div>
            
            <div className="flex flex-col bg-black/30 border border-white/5 rounded-2xl p-3">
              <span className="text-[9px] uppercase font-bold text-text-muted tracking-wider flex items-center gap-1">
                <Wifi className="w-3 h-3 text-emerald-400" /> Connection state
              </span>
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className={`w-2 h-2 rounded-full ${isOnline ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"}`} />
                <span className="text-xs font-black text-white capitalize">
                  {isOnline ? `Online (${networkType})` : "Offline"}
                </span>
              </div>
            </div>

            <div className="flex flex-col bg-black/30 border border-white/5 rounded-2xl p-3">
              <span className="text-[9px] uppercase font-bold text-text-muted tracking-wider flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-red-400" /> Push Notifications
              </span>
              <span className="text-xs font-black text-white mt-1.5 capitalize">
                {pushPermission === "granted" ? "Granted ✅" : pushPermission === "denied" ? "Blocked 🚫" : "Not prompted 🔔"}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between bg-black/30 border border-white/5 rounded-2xl p-3">
            <span className="text-[9px] uppercase font-bold text-text-muted tracking-wider flex items-center gap-1">
              <Eye className="w-3 h-3 text-orange-400" /> Viewport Resolution
            </span>
            <span className="text-xs font-mono font-black text-white">
              {dimensions.width}px x {dimensions.height}px
            </span>
          </div>
        </div>
      </section>

      {/* 3. Help & FAQ Section */}
      <section className="w-full mb-8 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-4 ml-2 flex items-center gap-1.5">
          <HelpCircle className="w-3.5 h-3.5 text-accent-green" /> Help & Frequently Asked Questions
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
            icon={<Info className="w-4 h-4" />}
            question="How does the Plate Calculator work?"
            answer="The Plate Calculator simplifies barbell loading. When configuring sets inside your active workout tab, tap a weight input field to toggle the Plate Calculator. Choose your bar weight (default is 20kg), adjust your target weight, and instantly visualize exactly which color-coded Olympic plates (25kg, 20kg, 15kg, 10kg, 5kg, 2.5kg, 1.25kg) should be slid onto each side of the barbell."
          />
          <FAQItem
            icon={<ShieldCheck className="w-4 h-4" />}
            question="Offline Sync & Local Caching"
            answer="Vortixia is fully offline capable. If your device loses network connectivity, your logged workouts and feed comments are stored locally inside a localStorage buffer ('unsynced_workouts'). The moment your device regains network access, a background queue auto-sync fires to securely sync all data to the database without data loss."
          />
        </div>
      </section>

      {/* 4. Support Contact Section */}
      <section className="w-full mb-6 animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
        <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-4 ml-2">
          Support & Feedback
        </h3>
        
        <div className="glass-card p-4 border border-white/5 rounded-3xl flex flex-col gap-3 bg-white/3">
          <a 
            href={mailtoUrl}
            className="flex items-center justify-between p-3.5 rounded-2xl bg-black/40 border border-white/5 hover:bg-white/5 transition-all group"
          >
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-accent-green" />
              <div className="flex flex-col">
                <span className="text-sm font-bold text-white">Contact Support</span>
                <span className="text-[10px] text-text-muted">Report bugs with automated diagnostic logs</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-white transition-all" />
          </a>

          <Link 
            href="/profile/feedback" 
            className="flex items-center justify-between p-3.5 rounded-2xl bg-black/40 border border-white/5 hover:bg-white/5 transition-all group"
          >
            <div className="flex items-center gap-3">
              <MessageSquare className="w-4 h-4 text-accent-green" />
              <div className="flex flex-col">
                <span className="text-sm font-bold text-white">Submit Bug / Feedback</span>
                <span className="text-[10px] text-text-muted">Directly report issues in-app</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-white transition-all" />
          </Link>
        </div>
      </section>

      {/* Footer Attributions */}
      <div className="w-full text-center mt-6">
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
