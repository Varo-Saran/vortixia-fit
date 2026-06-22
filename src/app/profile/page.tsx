"use client";

import { useEffect } from "react";
import { UserCircle, Edit3, BarChart3, Users, Swords, Settings, MessageSquarePlus, Info, Coffee, ChevronRight, User, LogOut } from "lucide-react";
import Link from "next/link";
import { useProfileStore } from "@/store/useProfileStore";
import { useTrophyStore } from "@/store/useTrophyStore";

export default function ProfileHub() {
  const { profile, fetchProfile, logout } = useProfileStore();

  useEffect(() => {
    if (!profile) {
      fetchProfile();
    }
  }, [profile, fetchProfile]);

  return (
    <main className="flex min-h-screen flex-col pt-[calc(var(--notch-top)+1rem)] pb-28 px-4 bg-[#050505] relative overflow-x-hidden">
      
      {/* Top Bar */}
      <header className="w-full flex items-center justify-center py-2 mb-4 animate-fade-in-down">
        <h1 className="text-sm font-extrabold tracking-widest uppercase text-text-muted">Profile Hub</h1>
      </header>

      {/* Hero Profile Area */}
      <section className="w-full mb-8 flex flex-col items-center animate-fade-in-up">
        <div className="relative mb-5">
          <div className="w-32 h-32 rounded-full bg-black border-[3px] border-accent-green flex items-center justify-center overflow-hidden relative shadow-[0_0_30px_rgba(74,222,128,0.2)]">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <UserCircle className="w-20 h-20 text-accent-green/50" strokeWidth={1} />
            )}
          </div>
        </div>
        <h2 className="text-3xl font-black text-white">{profile?.full_name || "Champion"}</h2>
        <p className="text-sm font-bold text-accent-green mt-1">@{profile?.username || "athlete"}</p>
      </section>

      {/* Quick Stats Bar */}
      <section className="w-full mb-8 flex justify-center animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        <div className="flex bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-md shadow-lg divide-x divide-white/10 w-full max-w-sm">
          <div className="flex-1 flex flex-col items-center justify-center">
             <span className="text-[10px] text-text-muted uppercase font-bold tracking-widest mb-1">Level</span>
             <span className="text-xl font-black text-white">8</span>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center">
             <span className="text-[10px] text-text-muted uppercase font-bold tracking-widest mb-1">Total XP</span>
             <span className="text-xl font-black text-accent-green">{useTrophyStore().totalXP.toLocaleString() || "0"}</span>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center">
             <span className="text-[10px] text-text-muted uppercase font-bold tracking-widest mb-1">Goal</span>
             <span className="text-sm font-black text-white">Hypertrophy</span>
          </div>
        </div>
      </section>

      {/* Grouped Navigation Links */}
      <div className="w-full flex flex-col gap-6 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
        
        {/* Gamification / Trophies */}
        <div className="mb-2">
          <Link href="/profile/trophies" className="bg-gradient-to-r from-accent-green/20 to-transparent border border-accent-green/30 rounded-3xl overflow-hidden flex flex-col hover:from-accent-green/30 transition-all p-5 relative group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-accent-green/20 blur-3xl rounded-full group-hover:bg-accent-green/30 transition-colors" />
            <div className="flex items-center justify-between relative z-10">
               <div className="flex items-center gap-4">
                 <div className="w-12 h-12 rounded-full bg-[#0a0a0a] border border-accent-green flex items-center justify-center shadow-[0_0_15px_rgba(46,234,130,0.5)]">
                   <Swords className="w-6 h-6 text-accent-green" />
                 </div>
                 <div className="flex flex-col">
                   <span className="font-black text-white text-lg tracking-wide uppercase">Trophy Case</span>
                   <span className="text-xs text-accent-green font-bold">View Achievements</span>
                 </div>
               </div>
               <ChevronRight className="w-6 h-6 text-accent-green group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>

        {/* Group 1: Account & Performance */}
        <div>
          <h3 className="text-[10px] uppercase tracking-widest text-text-muted font-bold ml-4 mb-2">Account & Performance</h3>
          <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden flex flex-col">
            <Link href="/profile/edit" className="flex items-center justify-between p-4 border-b border-white/5 hover:bg-white/5 transition-colors group">
               <div className="flex items-center gap-4">
                 <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                   <User className="w-5 h-5 text-blue-400" />
                 </div>
                 <span className="font-bold text-white text-sm">Edit Profile</span>
               </div>
               <ChevronRight className="w-5 h-5 text-text-muted group-hover:text-white transition-colors" />
            </Link>
            <Link href="/profile/analytics" className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors group">
               <div className="flex items-center gap-4">
                 <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center group-hover:bg-orange-500/20 transition-colors">
                   <BarChart3 className="w-5 h-5 text-orange-400" />
                 </div>
                 <span className="font-bold text-white text-sm">Analytics</span>
               </div>
               <ChevronRight className="w-5 h-5 text-text-muted group-hover:text-white transition-colors" />
            </Link>
          </div>
        </div>

        {/* Group 2: Community & Social */}
        <div>
          <h3 className="text-[10px] uppercase tracking-widest text-text-muted font-bold ml-4 mb-2">Community</h3>
          <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden flex flex-col">
            <Link href="/social/add-friends" className="flex items-center justify-between p-4 border-b border-white/5 hover:bg-white/5 transition-colors group">
               <div className="flex items-center gap-4">
                 <div className="w-10 h-10 rounded-full bg-accent-green/10 flex items-center justify-center group-hover:bg-accent-green/20 transition-colors">
                   <Users className="w-5 h-5 text-accent-green" />
                 </div>
                 <span className="font-bold text-white text-sm">Find Lifting Partners</span>
               </div>
               <ChevronRight className="w-5 h-5 text-text-muted group-hover:text-white transition-colors" />
            </Link>
            <Link href="/social" className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors group">
               <div className="flex items-center gap-4">
                 <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
                   <Swords className="w-5 h-5 text-purple-400" />
                 </div>
                 <span className="font-bold text-white text-sm">Global Leaderboard</span>
               </div>
               <ChevronRight className="w-5 h-5 text-text-muted group-hover:text-white transition-colors" />
            </Link>
          </div>
        </div>

        {/* Group 3: App & Preferences */}
        <div>
          <h3 className="text-[10px] uppercase tracking-widest text-text-muted font-bold ml-4 mb-2">Preferences</h3>
          <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden flex flex-col">
            <Link href="/profile/settings" className="flex items-center justify-between p-4 border-b border-white/5 hover:bg-white/5 transition-colors group">
               <div className="flex items-center gap-4">
                 <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                   <Settings className="w-5 h-5 text-white" />
                 </div>
                 <span className="font-bold text-white text-sm">App Settings</span>
               </div>
               <ChevronRight className="w-5 h-5 text-text-muted group-hover:text-white transition-colors" />
            </Link>
            <Link href="/profile/feedback" className="flex items-center justify-between p-4 border-b border-white/5 hover:bg-white/5 transition-colors group">
               <div className="flex items-center gap-4">
                 <div className="w-10 h-10 rounded-full bg-pink-500/10 flex items-center justify-center group-hover:bg-pink-500/20 transition-colors">
                   <MessageSquarePlus className="w-5 h-5 text-pink-400" />
                 </div>
                 <span className="font-bold text-white text-sm">Feedback & Suggestions</span>
               </div>
               <ChevronRight className="w-5 h-5 text-text-muted group-hover:text-white transition-colors" />
            </Link>
            <button onClick={logout} className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors group">
               <div className="flex items-center gap-4">
                 <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center group-hover:bg-red-500/20 transition-colors">
                   <LogOut className="w-5 h-5 text-red-500" />
                 </div>
                 <span className="font-bold text-red-500 text-sm">Log Out</span>
               </div>
               <ChevronRight className="w-5 h-5 text-text-muted group-hover:text-white transition-colors" />
            </button>
          </div>
        </div>

        {/* Group 4: About */}
        <div>
          <h3 className="text-[10px] uppercase tracking-widest text-text-muted font-bold ml-4 mb-2">About</h3>
          <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden flex flex-col">
            <button className="flex items-center justify-between p-4 border-b border-white/5 hover:bg-white/5 transition-colors group">
               <div className="flex items-center gap-4">
                 <div className="w-10 h-10 rounded-full bg-cyan-500/10 flex items-center justify-center group-hover:bg-cyan-500/20 transition-colors">
                   <Info className="w-5 h-5 text-cyan-400" />
                 </div>
                 <span className="font-bold text-white text-sm">About This App</span>
               </div>
               <ChevronRight className="w-5 h-5 text-text-muted group-hover:text-white transition-colors" />
            </button>
            <button className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors group">
               <div className="flex items-center gap-4">
                 <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center group-hover:bg-yellow-500/20 transition-colors">
                   <Coffee className="w-5 h-5 text-yellow-400" />
                 </div>
                 <span className="font-bold text-white text-sm">Buy me a coffee</span>
               </div>
               <ChevronRight className="w-5 h-5 text-text-muted group-hover:text-white transition-colors" />
            </button>
          </div>
        </div>

      </div>

      {/* Footer Signature */}
      <div className="w-full flex justify-center mt-12 mb-8 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
        <p className="text-[10px] text-text-muted font-bold tracking-widest uppercase opacity-50">
          Engineered by Vathsaran Yasotharan
        </p>
      </div>

    </main>
  );
}
