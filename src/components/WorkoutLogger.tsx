"use client";

import { useState } from "react";
import { Plus, Tag } from "lucide-react";

type Unit = "kg" | "lbs" | "plates";

export default function WorkoutLogger() {
  const [weight, setWeight] = useState<string>("");
  const [reps, setReps] = useState<string>("");
  const [unit, setUnit] = useState<Unit>("kg");
  const [equipmentTag, setEquipmentTag] = useState<string>("");
  const [showTagInput, setShowTagInput] = useState(false);

  const [xpEarned, setXpEarned] = useState<number | null>(null);

  const handleLogSet = () => {
    const weightNum = parseFloat(weight);
    const repsNum = parseInt(reps);
    if (isNaN(weightNum) || isNaN(repsNum)) return;

    // The Relative Intensity Algorithm
    // Epley Formula: 1RM = Weight * (1 + Reps / 30)
    const calculated1RM = weightNum * (1 + (repsNum / 30));
    
    // In production, we fetch the Stored 1RM from Supabase for this specific:
    // (User + Exercise + Unit + Equipment Tag)
    
    // For this mockup UI, we will simulate the user's stored baseline as 15% higher than what they just lifted.
    const stored1RM = calculated1RM * 1.15; 

    // XP = (Logged Weight / Stored 1RM) * BaseRewardMultiplier
    // Using the user's exact formula constraint
    const baseReward = 500;
    const earned = Math.round((weightNum / stored1RM) * baseReward);

    setXpEarned(earned);

    // Reset fields for next set
    setWeight("");
    setReps("");
  };

  return (
    <div className="glass-card p-6 w-full max-w-sm flex flex-col gap-5 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-accent-green/5 blur-3xl rounded-full" />
      
      <h3 className="font-bold text-lg flex items-center justify-between z-10">
        Log Set
        {xpEarned !== null && (
          <span className="text-accent-green text-sm font-extrabold animate-fade-in-up bg-accent-green/10 px-2 py-1 rounded-md border border-accent-green/20">
            +{xpEarned} XP
          </span>
        )}
      </h3>

      {/* Equipment Isolation Tag (Mystery Weights solution) */}
      <div className="flex flex-col gap-2 z-10">
        {!showTagInput ? (
          <button 
            onClick={() => setShowTagInput(true)}
            className="text-text-muted text-xs flex items-center gap-1.5 hover:text-white transition-colors w-fit"
          >
            <Tag className="w-3.5 h-3.5" />
            Add Machine Tag (e.g., "Old Corner Cable")
          </button>
        ) : (
          <div className="flex flex-col gap-1">
             <label className="text-[10px] uppercase tracking-wider text-text-muted font-bold">Equipment Isolation Tag</label>
            <input
              type="text"
              placeholder="e.g., Corner Cable Machine..."
              value={equipmentTag}
              onChange={(e) => setEquipmentTag(e.target.value)}
              className="bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-text-muted/50 outline-none focus:border-accent-green transition-colors w-full"
            />
          </div>
        )}
      </div>

      {/* Inputs */}
      <div className="flex gap-3 z-10">
        <div className="flex-1 flex flex-col gap-1">
          <label className="text-xs text-text-muted font-medium">Weight / Unit</label>
          <div className="flex bg-black/50 border border-white/10 rounded-lg overflow-hidden focus-within:border-accent-green transition-colors h-12">
            <input 
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-full bg-transparent px-3 py-2 text-white outline-none"
              placeholder="0"
            />
            <select 
              value={unit}
              onChange={(e) => setUnit(e.target.value as Unit)}
              className="bg-transparent text-text-muted px-2 border-l border-white/10 outline-none text-sm font-medium focus:text-white cursor-pointer"
            >
              <option value="kg">kg</option>
              <option value="lbs">lbs</option>
              <option value="plates">Plates</option>
            </select>
          </div>
        </div>

        <div className="w-24 flex flex-col gap-1">
          <label className="text-xs text-text-muted font-medium">Reps</label>
          <input 
            type="number"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-accent-green transition-colors h-12"
            placeholder="0"
          />
        </div>
      </div>

      <button 
        onClick={handleLogSet}
        disabled={!weight || !reps}
        className="premium-btn w-full py-3.5 mt-2 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed z-10" aria-label="Add"
      >
        <Plus className="w-5 h-5" />
        Log Set & Earn XP
      </button>
    </div>
  );
}
