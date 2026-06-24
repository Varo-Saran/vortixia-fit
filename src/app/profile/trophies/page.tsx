"use client";

import { ChevronLeft, Trophy, Sword, BrainCircuit, Flame, Zap, Crown, Timer, Wand2, Shield, Share2, Eye } from "lucide-react";
import Link from "next/link";
import { useTrophyStore } from "@/store/useTrophyStore";
import { useProfileStore } from "@/store/useProfileStore";
import trophiesData from "@/data/trophies.json";

const ICON_MAP: Record<string, any> = {
  Sword,
  BrainCircuit,
  Flame,
  Zap,
  Crown,
  Timer,
  Wand2,
  Shield,
  Share2,
  Eye
};

export default function TrophiesPage() {
  const { unlockedTrophies } = useTrophyStore();
  const profile = useProfileStore((state) => state.profile);
  const totalXP = profile?.total_xp || 0;

  const currentLevel = Math.floor(totalXP / 2000) + 1;
  const currentLevelBaseXp = (currentLevel - 1) * 2000;
  const progressPercentage = Math.round(((totalXP - currentLevelBaseXp) / 2000) * 100);

  return (
    <main className="flex min-h-screen flex-col pt-[calc(var(--notch-top)+1rem)] pb-28 px-4 bg-[#050505] relative overflow-x-hidden">
      
      {/* Header */}
      <header className="w-full flex items-center justify-between mb-8 animate-fade-in-down">
        <div className="flex items-center gap-4">
          <Link href="/profile" className="p-2 bg-white/5 rounded-full border border-white/10 hover:bg-white/10 transition-colors" aria-label="Go back">
            <ChevronLeft className="w-5 h-5 text-white" />
          </Link>
          <div className="flex flex-col">
            <h1 className="text-2xl font-extrabold tracking-tight text-white">Trophy Case</h1>
            <span className="text-[10px] text-accent-green uppercase font-bold tracking-widest">Achievements</span>
          </div>
        </div>
      </header>

      {/* Overview Card */}
      <section className="mb-8 animate-fade-in-up">
        <div className="bg-gradient-to-br from-[#0a0a0a] to-[#111] border border-accent-green/30 rounded-3xl p-6 relative overflow-hidden flex flex-col items-center shadow-[0_0_30px_rgba(46,234,130,0.1)]">
          <div className="absolute top-0 right-0 w-32 h-32 bg-accent-green/10 blur-3xl rounded-full" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/10 blur-3xl rounded-full" />
          
          <Trophy className="w-10 h-10 text-accent-green mb-2 relative z-10" />
          <span className="text-[10px] text-text-muted font-bold tracking-widest uppercase relative z-10 mb-1">Total Experience</span>
          <span className="text-4xl font-black text-white relative z-10 shadow-black drop-shadow-lg">{totalXP.toLocaleString()} XP</span>
          
          <div className="mt-4 w-full bg-white/5 h-2 rounded-full overflow-hidden relative z-10">
            <div className="bg-accent-green h-full" style={{ width: `${progressPercentage}%` }} />
          </div>
          <span className="text-[10px] text-text-muted mt-2 relative z-10">{progressPercentage}% to Next Level</span>
        </div>
      </section>

      {/* Trophies Grid */}
      <section className="grid grid-cols-2 gap-4 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        {trophiesData.map((trophy, idx) => {
          const isUnlocked = unlockedTrophies.includes(trophy.id);
          const IconComp = ICON_MAP[trophy.icon] || Trophy;

          return (
            <div 
              key={trophy.id}
              className={`relative overflow-hidden rounded-3xl p-5 border flex flex-col items-center text-center transition-all duration-500
                ${isUnlocked ? 'bg-[#0a0a0a] border-white/10' : 'bg-[#050505] border-white/5 opacity-50 grayscale'}
              `}
              style={{ animationDelay: `${idx * 0.05}s` }}
            >
              {isUnlocked && (
                <div 
                  className="absolute inset-0 opacity-10"
                  style={{ background: `radial-gradient(circle at top right, ${trophy.color}, transparent)` }}
                />
              )}

              <div 
                className={`w-14 h-14 rounded-full flex items-center justify-center mb-3 border relative z-10
                  ${isUnlocked ? 'bg-[#111]' : 'bg-black border-white/5'}
                `}
                style={{ borderColor: isUnlocked ? trophy.color : undefined }}
              >
                <IconComp className="w-6 h-6" style={{ color: isUnlocked ? trophy.color : '#666' }} />
              </div>

              <h3 className="text-sm font-black text-white mb-1 leading-tight">{trophy.title}</h3>
              <p className="text-[10px] text-text-muted line-clamp-2 mb-3 h-8">{trophy.description}</p>
              
              <div className="mt-auto flex items-center justify-center bg-white/5 px-3 py-1 rounded-full">
                <span className="text-[10px] font-bold tracking-widest" style={{ color: isUnlocked ? trophy.color : '#666' }}>
                  {trophy.xp} XP
                </span>
              </div>
            </div>
          );
        })}
      </section>
      
    </main>
  );
}
