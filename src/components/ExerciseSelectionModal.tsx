"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Dumbbell, Activity, Info } from "lucide-react";
import exerciseDataRaw from "@/data/exerciseLibrary.json";

// The raw data might need typing
interface ExerciseDef {
  id: string;
  name: string;
  bodyPart: string;
  target: string;
  equipment: string;
  muscleGroup?: string;
}

const exerciseData: ExerciseDef[] = exerciseDataRaw as ExerciseDef[];

interface ExerciseSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (exercise: ExerciseDef) => void;
}

const COMMON_ALIASES: Record<string, string[]> = {
  "RDL": ["romanian deadlift"],
  "OHP": ["overhead press"],
  "BB": ["barbell"],
  "DB": ["dumbbell"],
  "Skullcrusher": ["skull crusher", "lying triceps extension"],
  "Bench": ["bench press"],
  "Squat": ["barbell squat", "squat"],
  "Lat Pulldown": ["cable pulldown", "pulldown"],
  "Curls": ["biceps curl", "curl"]
};

// Extract some top-level categories
const CATEGORIES = ["All", "chest", "back", "upper legs", "shoulders", "upper arms", "waist", "lower legs"];

export function ExerciseSelectionModal({ isOpen, onClose, onSelect }: ExerciseSelectionModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const filteredExercises = useMemo(() => {
    let query = searchQuery.toLowerCase().trim();
    
    // Check aliases
    for (const [alias, targets] of Object.entries(COMMON_ALIASES)) {
      if (query === alias.toLowerCase()) {
        query = targets[0]; // just pick the first mapped target for basic fuzzy
        break;
      }
    }

    let results = exerciseData;

    // Filter by Category
    if (selectedCategory !== "All") {
      results = results.filter(e => e.bodyPart.toLowerCase() === selectedCategory.toLowerCase());
    }

    // Filter by Search
    if (query) {
      results = results.filter(e => 
        e.name.toLowerCase().includes(query) || 
        e.target.toLowerCase().includes(query) ||
        e.equipment.toLowerCase().includes(query)
      );
    }

    // To prevent lagging the DOM with 1300 DOM nodes, we just slice the top 50 results.
    // Real virtualization (e.g. react-window) would be better, but slice is perfectly fast for UX.
    return results.slice(0, 50);
  }, [searchQuery, selectedCategory]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/90 z-[100] backdrop-blur-md flex flex-col"
      >
        {/* Header */}
        <div className="pt-[calc(var(--notch-top)+1rem)] px-4 pb-4 bg-background/80 backdrop-blur-xl border-b border-white/10 sticky top-0 z-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <Dumbbell className="w-5 h-5 text-accent-green" />
              Exercise Library
            </h2>
            <button onClick={onClose} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative w-full">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input 
              type="text"
              placeholder="Search exercises (e.g., Bench, RDL...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-text-muted outline-none focus:border-accent-green transition-colors"
              autoFocus
            />
          </div>

          {/* Categories */}
          <div className="flex gap-2 overflow-x-auto mt-4 pb-2 hide-scrollbar">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-colors border ${selectedCategory === cat ? 'bg-accent-green/20 text-accent-green border-accent-green/30' : 'bg-white/5 text-text-muted border-white/5 hover:text-white hover:bg-white/10'}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 pb-24">
          {filteredExercises.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center opacity-50 mt-20">
              <Dumbbell className="w-12 h-12 text-text-muted mb-4" />
              <h3 className="text-lg font-bold text-white mb-1">No Exercises Found</h3>
              <p className="text-xs text-text-muted">Try adjusting your search or category filter.</p>
            </div>
          ) : (
            filteredExercises.map(ex => (
              <button 
                key={ex.id}
                onClick={() => {
                  onSelect(ex);
                  onClose();
                }}
                className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center justify-between hover:bg-white/10 hover:border-accent-green/30 transition-all text-left group"
              >
                <div className="flex flex-col gap-1 pr-4">
                  <h3 className="font-bold text-white text-base group-hover:text-accent-green transition-colors capitalize">{ex.name}</h3>
                  <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-text-muted">
                    <span className="flex items-center gap-1"><Activity className="w-3 h-3 text-orange-400" /> {ex.target}</span>
                    <span className="w-1 h-1 rounded-full bg-white/20" />
                    <span>{ex.equipment}</span>
                  </div>
                </div>
                <div className="p-2 bg-white/5 rounded-full group-hover:bg-accent-green/20 transition-colors shrink-0">
                  <Info className="w-4 h-4 text-text-muted group-hover:text-accent-green" />
                </div>
              </button>
            ))
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
