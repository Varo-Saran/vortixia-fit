"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toJpeg } from 'html-to-image';
import { useTrophyStore } from "@/store/useTrophyStore";
import trophiesData from "@/data/trophies.json";
import { Download, Camera, Share2, Copy, Check, Trophy, Flame, Dumbbell, Timer, Star, Activity, TrendingUp } from "lucide-react";
import { WorkoutExercise } from "@/store/useWorkoutStore";

interface SuccessCarouselProps {
  routineName: string;
  totalVolume: number;
  totalSets: number;
  elapsed: string;
  exercises: WorkoutExercise[];
  onDone: () => void;
}

export function SuccessCarousel({
  routineName,
  totalVolume,
  totalSets,
  elapsed,
  exercises,
  onDone
}: SuccessCarouselProps) {
  const { recentUnlocks, clearRecentUnlocks } = useTrophyStore();
  const [activeIndex, setActiveIndex] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);
  
  const [isOfflineSyncMissing, setIsOfflineSyncMissing] = useState(false);
  useEffect(() => {
    setIsOfflineSyncMissing(!navigator.onLine && !('sync' in navigator));
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onDone();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onDone]);
  
  // Collect all cards to display
  const cards = [];
  
  // Card 0: Summary
  cards.push({ id: 'summary', type: 'summary' });
  
  // Card 1: Highlights (if any data makes sense, we'll just mock it as before)
  cards.push({ id: 'highlights', type: 'highlights' });

  // Trophy Cards
  const unlockedTrophyObjects = recentUnlocks
    .map(id => trophiesData.find(t => t.id === id))
    .filter(Boolean);

  unlockedTrophyObjects.forEach(t => {
    cards.push({ id: `trophy-${t?.id}`, type: 'trophy', data: t });
  });

  const activeCard = cards[activeIndex];

  const handleNext = () => {
    if (activeIndex < cards.length - 1) setActiveIndex(prev => prev + 1);
  };

  const handlePrev = () => {
    if (activeIndex > 0) setActiveIndex(prev => prev - 1);
  };

  const exportImage = async (action: 'download' | 'share') => {
    if (!carouselRef.current) return;
    
    // Select the active card element (we can find it by id)
    const cardElement = document.getElementById(`success-card-${activeCard.id}`);
    if (!cardElement) return;

    try {
      const dataUrl = await toJpeg(cardElement, {
        quality: 0.95,
        backgroundColor: '#050505',
        pixelRatio: 2
      });

      if (action === 'download') {
        const link = document.createElement("a");
        link.download = `Vortixia_Workout_${new Date().toISOString().slice(0, 10)}.jpg`;
        link.href = dataUrl;
        link.click();
      } else if (action === 'share') {
        // Use native share API if available
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], 'workout.jpg', { type: 'image/jpeg' });
        if (navigator.share) {
          await navigator.share({
            title: 'My Vortixia Workout',
            text: `Just crushed ${routineName} on Vortixia!`,
            files: [file]
          });
        } else {
          // Fallback download
          const link = document.createElement("a");
          link.download = 'workout.jpg';
          link.href = dataUrl;
          link.click();
        }
      }
    } catch (err) {
      console.error("Export failed:", err);
    }
  };

  // Render specific card contents
  const renderCard = (card: any) => {
    if (card.type === 'summary') {
      return (
        <div id={`success-card-${card.id}`} className="w-full h-[500px] rounded-[2rem] bg-gradient-to-b from-[#0a1a12] to-[#050505] border border-[#2EEA82]/30 flex flex-col p-8 relative overflow-hidden shadow-[0_0_50px_rgba(46,234,130,0.15)] shrink-0">
          <div className="absolute top-0 right-0 w-64 h-64 bg-accent-green/10 blur-[80px] rounded-full pointer-events-none" />
          
          <div className="flex flex-col items-center mb-8 relative z-10">
            <div className="w-20 h-20 bg-accent-green/20 rounded-full flex items-center justify-center mb-4 border border-accent-green/50 shadow-[0_0_20px_rgba(46,234,130,0.3)]">
               <Check className="w-10 h-10 text-accent-green" strokeWidth={3} />
            </div>
            <h2 className="text-3xl font-black text-white text-center tracking-tight mb-1">Excellent!</h2>
            <p className="text-text-muted text-sm text-center">You crushed <strong className="text-white">{routineName}</strong></p>
          </div>

          <div className="grid grid-cols-2 gap-4 relative z-10 mt-auto">
            <div className="bg-black/50 border border-white/5 rounded-2xl p-4 flex flex-col items-center">
               <Timer className="w-6 h-6 text-blue-400 mb-2" />
               <span className="text-2xl font-black text-white">{elapsed}</span>
               <span className="text-[10px] uppercase font-bold text-text-muted tracking-widest mt-1">Duration</span>
            </div>
            <div className="bg-black/50 border border-white/5 rounded-2xl p-4 flex flex-col items-center">
               <Dumbbell className="w-6 h-6 text-orange-400 mb-2" />
               <span className="text-2xl font-black text-white">{totalVolume.toLocaleString()}</span>
               <span className="text-[10px] uppercase font-bold text-text-muted tracking-widest mt-1">Volume (lbs)</span>
            </div>
            <div className="col-span-2 bg-[#2EEA82]/10 border border-[#2EEA82]/20 rounded-2xl p-4 flex items-center justify-between">
               <div className="flex items-center gap-3">
                 <Star className="w-8 h-8 text-[#2EEA82]" />
                 <div className="flex flex-col">
                   <span className="text-white font-bold text-sm">Experience Gained</span>
                   <span className="text-[10px] uppercase font-bold text-[#2EEA82] tracking-widest">Profile Level Up</span>
                 </div>
               </div>
               <span className="text-2xl font-black text-[#2EEA82]">+{totalSets * 50}</span>
            </div>
          </div>
          
          {isOfflineSyncMissing && (
            <div className="mt-4 bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 relative z-10">
              <p className="text-orange-400 text-xs text-center font-medium leading-relaxed">
                Workout saved to local vault! Open the app next time you are online to sync your stats globally.
              </p>
            </div>
          )}
          
          <div className="absolute bottom-4 left-0 w-full flex justify-center">
            <span className="text-[10px] text-white/30 font-bold tracking-widest uppercase">Vortixia Fit</span>
          </div>
        </div>
      );
    }

    if (card.type === 'highlights') {
      return (
        <div id={`success-card-${card.id}`} className="w-full h-[500px] rounded-[2rem] bg-[#0A0A0A] border border-white/10 flex flex-col p-8 relative overflow-hidden shrink-0">
          <div className="absolute top-0 left-0 w-64 h-64 bg-orange-500/10 blur-[80px] rounded-full pointer-events-none" />
          
          <div className="flex items-center gap-3 mb-8 relative z-10">
            <Trophy className="w-8 h-8 text-yellow-500" />
            <h2 className="text-2xl font-black text-white">Session Highlights</h2>
          </div>

          <div className="flex flex-col gap-4 relative z-10 flex-1">
            <div className="bg-[#111] p-4 rounded-2xl border border-white/5 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-white font-bold text-sm">Consistency Streak</span>
                <span className="text-text-muted text-xs mt-1">4 weeks in a row</span>
              </div>
              <div className="bg-orange-500/20 text-orange-500 px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-bold text-xs">
                <Flame className="w-3.5 h-3.5" /> Extended!
              </div>
            </div>

            {exercises.slice(0, 1).map(ex => (
              <div key={`hl-${ex.id}`} className="bg-[#111] p-4 rounded-2xl border border-white/5 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-white font-bold text-sm">{ex.name}</span>
                  <span className="text-text-muted text-xs mt-1">New 1RM Estimated</span>
                </div>
                <div className="bg-accent-green/20 text-accent-green px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-bold text-xs">
                  <TrendingUp className="w-3.5 h-3.5" /> +5 lbs
                </div>
              </div>
            ))}
          </div>

          {/* Pro Tip inside Highlights */}
          <div className="bg-blue-900/20 border border-blue-500/30 p-5 rounded-2xl flex items-start gap-3 relative z-10 mt-auto">
            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
              <Activity className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-xs text-blue-100/80 leading-relaxed mt-0.5">
              <strong className="text-blue-400 block mb-1">Recovery is crucial.</strong>
              You hit a lot of volume today. Make sure to log your sleep and protein intake before your next session.
            </p>
          </div>
          
          <div className="absolute bottom-4 left-0 w-full flex justify-center">
            <span className="text-[10px] text-white/30 font-bold tracking-widest uppercase">Vortixia Fit</span>
          </div>
        </div>
      );
    }

    if (card.type === 'trophy') {
      const t = card.data;
      return (
        <div id={`success-card-${card.id}`} className="w-full h-[500px] rounded-[2rem] bg-[#050505] border border-white/10 flex flex-col items-center justify-center p-8 relative overflow-hidden shrink-0">
          <div 
            className="absolute inset-0 opacity-20 pointer-events-none mix-blend-screen blur-[60px]"
            style={{ background: `radial-gradient(circle at center, ${t.color} 0%, transparent 70%)` }} 
          />

          <span className="text-[10px] text-white/50 font-bold tracking-widest uppercase mb-8 relative z-10">Achievement Unlocked</span>

          <div className="relative mb-8 z-10">
            <div className="w-32 h-32 rounded-full flex items-center justify-center relative z-10 border-2" style={{ backgroundColor: '#0a0a0a', borderColor: t.color }}>
               {/* Icon fallback since we can't easily dynamically render the icon component from string here without a map, we'll use Trophy */}
               <Trophy className="w-16 h-16 drop-shadow-lg" style={{ color: t.color }} />
            </div>
          </div>

          <h2 className="text-3xl font-black text-white mb-3 tracking-wide uppercase text-center relative z-10" style={{ textShadow: `0 0 20px ${t.color}80` }}>
            {t.title}
          </h2>
          
          <p className="text-sm text-white/70 text-center leading-relaxed relative z-10 px-4">
            {t.description}
          </p>

          <div className="mt-auto bg-white/5 border border-white/10 rounded-2xl p-4 w-full flex items-center justify-between relative z-10">
            <span className="text-xs text-text-muted font-bold uppercase tracking-widest">Reward</span>
            <span className="text-xl font-black" style={{ color: t.color }}>
              +{t.xp} XP
            </span>
          </div>
          
          <div className="absolute bottom-4 left-0 w-full flex justify-center z-10">
            <span className="text-[10px] text-white/30 font-bold tracking-widest uppercase">Vortixia Fit</span>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center">
      
      {/* Carousel Track */}
      <div className="w-full relative overflow-hidden pt-4 pb-8 px-6" ref={carouselRef}>
        <motion.div 
          className="flex gap-6"
          drag="x"
          dragConstraints={{ left: -((cards.length - 1) * 350), right: 0 }}
          animate={{ x: `-${activeIndex * 100}%` }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          onDragEnd={(e, { offset, velocity }) => {
            const swipe = swipePower(offset.x, velocity.x);
            if (swipe < -10000) handleNext();
            else if (swipe > 10000) handlePrev();
          }}
        >
          {cards.map((card, idx) => (
            <div key={card.id} className="min-w-full flex justify-center px-1">
              {renderCard(card)}
            </div>
          ))}
        </motion.div>
      </div>

      {/* Pagination Dots */}
      <div className="flex gap-2 mb-8">
        {cards.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setActiveIndex(idx)}
            className={`h-2 rounded-full transition-all duration-300 ${
              activeIndex === idx ? "w-6 bg-accent-green" : "w-2 bg-white/20"
            }`}
          />
        ))}
      </div>

      {/* Share Dock */}
      <div className="w-full px-6 flex flex-col gap-4">
        <div className="grid grid-cols-4 gap-2 bg-[#111] p-2 rounded-2xl border border-white/5">
          <button onClick={() => exportImage('share')} className="flex flex-col items-center gap-1.5 p-3 rounded-xl hover:bg-white/5 transition-colors">
            <Camera className="w-5 h-5 text-pink-500" />
            <span className="text-[9px] text-text-muted font-bold uppercase">Story</span>
          </button>
          <button onClick={() => exportImage('download')} className="flex flex-col items-center gap-1.5 p-3 rounded-xl hover:bg-white/5 transition-colors">
            <Download className="w-5 h-5 text-blue-400" />
            <span className="text-[9px] text-text-muted font-bold uppercase">Save</span>
          </button>
          <button onClick={() => exportImage('share')} className="flex flex-col items-center gap-1.5 p-3 rounded-xl hover:bg-white/5 transition-colors">
            <Share2 className="w-5 h-5 text-white" />
            <span className="text-[9px] text-text-muted font-bold uppercase">Share</span>
          </button>
          <button onClick={() => {}} className="flex flex-col items-center gap-1.5 p-3 rounded-xl hover:bg-white/5 transition-colors">
            <Copy className="w-5 h-5 text-text-muted" />
            <span className="text-[9px] text-text-muted font-bold uppercase">Link</span>
          </button>
        </div>

        <button 
          onClick={() => {
            clearRecentUnlocks();
            onDone();
          }}
          className="w-full bg-accent-green text-black font-black py-4 rounded-2xl shadow-[0_0_20px_rgba(46,234,130,0.2)]"
        >
          FINISH
        </button>
      </div>

    </div>
  );
}

const swipeConfidenceThreshold = 10000;
const swipePower = (offset: number, velocity: number) => {
  return Math.abs(offset) * velocity;
};
