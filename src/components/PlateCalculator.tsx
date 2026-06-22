import { useState } from "react";
import { X, Dumbbell } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

interface PlateCalculatorProps {
  isOpen: boolean;
  onClose: () => void;
  targetWeight: number;
}

const PLATES = [
  { weight: 45, color: '#FF3B30' }, // Red
  { weight: 35, color: '#007AFF' }, // Blue
  { weight: 25, color: '#34C759' }, // Green
  { weight: 10, color: '#FFD60A' }, // Yellow
  { weight: 5, color: '#8E8E93' },  // Gray
  { weight: 2.5, color: '#1C1C1E' } // Dark Gray
];

const BAR_WEIGHT = 45;

export function PlateCalculator({ isOpen, onClose, targetWeight }: PlateCalculatorProps) {
  if (!isOpen) return null;

  // Calculate plates per side
  const weightToLoad = Math.max(0, targetWeight - BAR_WEIGHT);
  let perSide = weightToLoad / 2;
  
  const platesNeeded: { weight: number, count: number, color: string }[] = [];

  for (const plate of PLATES) {
    if (perSide >= plate.weight) {
      const count = Math.floor(perSide / plate.weight);
      if (count > 0) {
        platesNeeded.push({ weight: plate.weight, count, color: plate.color });
        perSide -= (plate.weight * count);
      }
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 z-[100] backdrop-blur-sm"
          />
          <motion.div 
            initial={{ y: 300, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 300, opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 z-[101] max-w-md mx-auto"
          >
            <div className="bg-[#111] border-t border-white/10 rounded-t-3xl p-6 flex flex-col items-center">
              <div className="w-12 h-1 bg-white/20 rounded-full mb-6" />
              
              <div className="w-full flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-accent-green/20 rounded-full flex items-center justify-center">
                    <Dumbbell className="w-5 h-5 text-accent-green" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white">Plate Math</h2>
                    <p className="text-xs text-text-muted font-bold tracking-widest uppercase">Target: {targetWeight} lbs</p>
                  </div>
                </div>
                <button onClick={onClose} className="p-2 bg-white/5 rounded-full hover:bg-white/10">
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>

              {weightToLoad <= 0 ? (
                <div className="text-center text-text-muted mb-8 py-8 bg-black/40 w-full rounded-2xl border border-white/5">
                  <p>Just the empty bar!</p>
                  <p className="text-xs font-bold uppercase mt-1">({BAR_WEIGHT} lbs)</p>
                </div>
              ) : (
                <>
                  {/* Visual Barbell Representation */}
                  <div className="w-full h-32 bg-black/50 border border-white/5 rounded-2xl mb-6 relative flex items-center justify-center overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.05)_0%,transparent_70%)]" />
                    
                    {/* The Bar */}
                    <div className="h-4 w-full bg-gradient-to-b from-gray-300 via-gray-400 to-gray-500 absolute z-0 flex items-center">
                      <div className="w-full h-[1px] bg-white/50" />
                    </div>
                    {/* Sleeve Collar */}
                    <div className="h-12 w-6 bg-gradient-to-b from-gray-400 via-gray-500 to-gray-600 z-10 rounded-sm shadow-[inset_-2px_0_5px_rgba(0,0,0,0.5)] border-r border-black/50" />

                    {/* The Plates (Iterate through needed plates) */}
                    <div className="flex items-center z-20 gap-0.5">
                      {platesNeeded.map((p, i) => (
                        Array.from({ length: p.count }).map((_, j) => {
                          const height = p.weight >= 45 ? 96 : p.weight >= 25 ? 72 : p.weight >= 10 ? 48 : 32;
                          const width = p.weight >= 25 ? 16 : 12;
                          return (
                            <div 
                              key={`${i}-${j}`}
                              className="rounded-sm flex items-center justify-center shadow-[-2px_0_10px_rgba(0,0,0,0.5)] border-r border-black/30"
                              style={{ height: `${height}px`, width: `${width}px`, backgroundColor: p.color }}
                            />
                          );
                        })
                      ))}
                    </div>
                    {/* Empty Space on sleeve */}
                    <div className="h-8 flex-1 bg-gradient-to-b from-gray-400 via-gray-500 to-gray-600 z-0 shadow-[inset_0_2px_5px_rgba(0,0,0,0.3)] relative overflow-hidden">
                       <div className="absolute inset-0 opacity-20 bg-[repeating-linear-gradient(90deg,transparent,transparent_2px,#000_2px,#000_4px)]" />
                    </div>
                  </div>

                  {/* Text Breakdown */}
                  <div className="w-full flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs font-bold text-text-muted uppercase tracking-widest px-2 mb-1">
                      <span>Per Side</span>
                      <span>{perSide} lbs remaining</span>
                    </div>
                    {platesNeeded.map((p, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white/5 border border-white/5 rounded-xl p-3">
                        <div className="flex items-center gap-3">
                          <div className="w-4 h-8 rounded-sm" style={{ backgroundColor: p.color }} />
                          <span className="text-white font-bold">{p.weight} lbs</span>
                        </div>
                        <span className="text-accent-green font-black">x {p.count}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
