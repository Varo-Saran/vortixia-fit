"use client";

import { useEffect, useState } from "react";
import { useTrophyStore } from "@/store/useTrophyStore";
import trophiesData from "@/data/trophies.json";
import { X, Trophy, Sword, BrainCircuit, Flame, Zap, Crown, Timer, Wand2, Shield, Share2, Eye } from "lucide-react";
import ReactConfetti from "react-confetti";
import { useWindowSize } from "react-use";
import { usePathname } from "next/navigation";

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

export function TrophyUnlockModal() {
  const { recentUnlocks, clearRecentUnlocks } = useTrophyStore();
  const [activeTrophy, setActiveTrophy] = useState<any>(null);
  const { width, height } = useWindowSize();
  const pathname = usePathname();

  useEffect(() => {
    // Suppress modal on the workout completion page since we use the Carousel there
    if (pathname === '/workout') return;

    if (recentUnlocks.length > 0) {
      // Just show the first one in the queue for now
      const trophyId = recentUnlocks[0];
      const found = trophiesData.find(t => t.id === trophyId);
      if (found) {
        setActiveTrophy(found);
      }
    } else {
      setActiveTrophy(null);
    }
  }, [recentUnlocks]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && activeTrophy) {
        setActiveTrophy(null);
        clearRecentUnlocks();
      }
    };
    if (activeTrophy) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTrophy, clearRecentUnlocks]);

  if (!activeTrophy) return null;

  const IconComponent = ICON_MAP[activeTrophy.icon] || Trophy;

  const handleClose = () => {
    clearRecentUnlocks();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md animate-fade-in">
      <ReactConfetti 
        width={width} 
        height={height} 
        recycle={false} 
        numberOfPieces={400} 
        colors={[activeTrophy.color, '#ffffff', '#2EEA82']}
      />
      
      <div className="w-full max-w-sm bg-[#050505] border border-white/10 rounded-[2rem] overflow-hidden relative shadow-2xl animate-[zoom_0.5s_cubic-bezier(0.175,0.885,0.32,1.275)]">
        
        {/* Glow Background */}
        <div 
          className="absolute inset-0 opacity-20 pointer-events-none mix-blend-screen"
          style={{ 
            background: `radial-gradient(circle at center, ${activeTrophy.color} 0%, transparent 70%)` 
          }} 
        />

        <div className="p-8 flex flex-col items-center text-center relative z-10">
          <button 
            onClick={handleClose}
            className="absolute top-4 right-4 p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors" aria-label="Close"
          >
            <X className="w-4 h-4 text-white" />
          </button>

          <span className="text-[10px] text-text-muted font-bold tracking-widest uppercase mb-6">Achievement Unlocked</span>

          {/* Trophy Icon Area */}
          <div className="relative mb-6">
            <div 
              className="absolute inset-0 blur-2xl rounded-full animate-pulse"
              style={{ backgroundColor: activeTrophy.color, opacity: 0.5 }}
            />
            <div 
              className="w-24 h-24 rounded-full flex items-center justify-center relative z-10 border-2"
              style={{ backgroundColor: '#0a0a0a', borderColor: activeTrophy.color }}
            >
              <IconComponent className="w-12 h-12 drop-shadow-lg" style={{ color: activeTrophy.color }} />
            </div>
          </div>

          <h2 className="text-2xl font-black text-white mb-2 tracking-wide uppercase drop-shadow-lg" style={{ textShadow: `0 0 20px ${activeTrophy.color}` }}>
            {activeTrophy.title}
          </h2>
          
          <p className="text-sm text-white/80 mb-6 leading-relaxed">
            {activeTrophy.description}
          </p>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 w-full flex items-center justify-between mb-2">
            <span className="text-xs text-text-muted font-bold uppercase tracking-widest">Reward</span>
            <span className="text-lg font-black" style={{ color: activeTrophy.color }}>
              +{activeTrophy.xp} XP
            </span>
          </div>
          
          <button
            onClick={handleClose}
            className="w-full bg-white text-black font-black text-sm py-4 rounded-xl hover:bg-gray-200 transition-all shadow-lg mt-4"
          >
            CLAIM REWARD
          </button>
        </div>
      </div>
    </div>
  );
}
