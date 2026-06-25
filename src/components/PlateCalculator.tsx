import { useState, useEffect } from "react";
import { X, Dumbbell } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

interface PlateCalculatorProps {
  isOpen: boolean;
  onClose: () => void;
  targetWeight: number;
  onApplyWeight?: (weight: number) => void;
}

const PLATES = [
  { weight: 45, color: '#FF3B30' }, // Red
  { weight: 35, color: '#007AFF' }, // Blue
  { weight: 25, color: '#34C759' }, // Green
  { weight: 10, color: '#FFD60A' }, // Yellow
  { weight: 5, color: '#8E8E93' },  // Gray
  { weight: 2.5, color: '#1C1C1E' } // Dark Gray
];

export function PlateCalculator({ isOpen, onClose, targetWeight, onApplyWeight }: PlateCalculatorProps) {
  const [weight, setWeight] = useState(targetWeight);
  const [barWeight, setBarWeight] = useState(45);

  // Sync weight state when targetWeight changes or component opens
  useEffect(() => {
    if (isOpen) {
      setWeight(targetWeight);
    }
  }, [isOpen, targetWeight]);

  if (!isOpen) return null;

  // Calculate plates per side
  const weightToLoad = Math.max(0, weight - barWeight);
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

  // Generate legend summary
  const getLegendSummary = () => {
    if (platesNeeded.length === 0) {
      return `Load 0 plates (just the empty ${barWeight}lb bar)`;
    }
    const parts = platesNeeded.map(p => `${p.count}x ${p.weight}lb`);
    return `Load ${parts.join(', ')} plate${platesNeeded.some(p => p.count > 1 || platesNeeded.length > 1) ? 's' : ''} on each side`;
  };

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
            <div className="bg-[#111] border-t border-white/10 rounded-t-3xl p-6 flex flex-col items-center max-h-[90vh] overflow-y-auto">
              <div className="w-12 h-1 bg-white/20 rounded-full mb-6 flex-shrink-0" />
              
              <div className="w-full flex items-center justify-between mb-6 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-accent-green/20 rounded-full flex items-center justify-center">
                    <Dumbbell className="w-5 h-5 text-accent-green" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white">Plate Math</h2>
                    <p className="text-xs text-text-muted font-bold tracking-widest uppercase">Target: {weight} lbs</p>
                  </div>
                </div>
                <button onClick={onClose} className="p-2 bg-white/5 rounded-full hover:bg-white/10" aria-label="Close">
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>

              {/* Input controls at the top */}
              <div className="w-full flex flex-col gap-4 mb-6">
                <div className="flex items-center gap-4 w-full justify-between">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-text-muted font-bold uppercase tracking-widest mb-1">Target Weight (lbs)</span>
                    <input
                      type="number"
                      min="0"
                      value={weight === 0 ? "" : weight}
                      onChange={(e) => setWeight(e.target.value === "" ? 0 : Math.max(0, Number(e.target.value)))}
                      className="bg-black/50 border border-white/10 rounded-lg py-2 px-3 text-white font-bold text-base w-32 focus:outline-none focus:border-accent-green"
                    />
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] text-text-muted font-bold uppercase tracking-widest mb-1">Bar Weight</span>
                    <div className="flex bg-white/5 p-1 rounded-lg border border-white/10">
                      {[45, 35, 15].map((w) => (
                        <button
                          key={w}
                          onClick={() => setBarWeight(w)}
                          className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                            barWeight === w
                              ? 'bg-accent-green text-black shadow-md'
                              : 'text-white/60 hover:text-white'
                          }`}
                        >
                          {w} lb
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Preset adjustment buttons */}
                <div className="flex flex-wrap gap-2 justify-center w-full">
                  {[-45, -10, -5, 5, 10, 45].map((adj) => (
                    <button
                      key={adj}
                      onClick={() => setWeight((prev) => Math.max(0, prev + adj))}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                        adj < 0
                          ? 'bg-accent-red/10 text-accent-red border-accent-red/20 hover:bg-accent-red/20'
                          : 'bg-accent-green/10 text-accent-green border-accent-green/20 hover:bg-accent-green/20'
                      }`}
                    >
                      {adj > 0 ? `+${adj}` : adj}
                    </button>
                  ))}
                </div>
              </div>

              {/* Visual Barbell Representation */}
              <div className="w-full h-32 bg-black/50 border border-white/5 rounded-2xl mb-4 relative flex items-center justify-center overflow-hidden flex-shrink-0">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.05)_0%,transparent_70%)]" />
                
                {/* The Bar */}
                <div className="h-4 w-full bg-gradient-to-b from-gray-300 via-gray-400 to-gray-500 absolute z-0 flex items-center">
                  <div className="w-full h-[1px] bg-white/50" />
                </div>
                {/* Sleeve Collar */}
                <div className="h-12 w-6 bg-gradient-to-b from-gray-400 via-gray-500 to-gray-600 z-10 rounded-sm shadow-[inset_-2px_0_5px_rgba(0,0,0,0.5)] border-r border-black/50" />

                {/* The Plates with vertical text labels */}
                {weightToLoad > 0 ? (
                  <div className="flex items-center z-20 gap-0.5">
                    {platesNeeded.map((p, i) => (
                      Array.from({ length: p.count }).map((_, j) => {
                        const height = p.weight >= 45 ? 96 : p.weight >= 25 ? 72 : p.weight >= 10 ? 48 : 32;
                        const width = p.weight >= 25 ? 16 : 12;
                        return (
                          <div 
                            key={`${i}-${j}`}
                            className="rounded-sm flex items-center justify-center shadow-[-2px_0_10px_rgba(0,0,0,0.5)] border-r border-black/30 text-white font-bold select-none text-[8px] overflow-hidden"
                            style={{ height: `${height}px`, width: `${width}px`, backgroundColor: p.color }}
                          >
                            <span className="rotate-90 origin-center whitespace-nowrap block leading-none">
                              {p.weight}
                            </span>
                          </div>
                        );
                      })
                    ))}
                  </div>
                ) : (
                  <div className="z-20 text-center text-text-muted text-xs font-bold uppercase">
                    Empty Bar
                  </div>
                )}
                {/* Empty Space on sleeve */}
                <div className="h-8 flex-1 bg-gradient-to-b from-gray-400 via-gray-500 to-gray-600 z-0 shadow-[inset_0_2px_5px_rgba(0,0,0,0.3)] relative overflow-hidden">
                   <div className="absolute inset-0 opacity-20 bg-[repeating-linear-gradient(90deg,transparent,transparent_2px,#000_2px,#000_4px)]" />
                </div>
              </div>

              {/* Text Legend Summary */}
              <div className="w-full bg-accent-green/10 border border-accent-green/20 rounded-xl p-3 text-center mb-4 flex-shrink-0">
                <p className="text-xs font-bold text-accent-green uppercase tracking-wide">
                  {getLegendSummary()}
                </p>
              </div>

              {/* Text Breakdown */}
              {weightToLoad > 0 && (
                <div className="w-full flex flex-col gap-2 mb-4 flex-shrink-0">
                  <div className="flex items-center justify-between text-xs font-bold text-text-muted uppercase tracking-widest px-2 mb-1">
                    <span>Per Side</span>
                    {perSide > 0 && <span>{perSide} lbs remaining</span>}
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
              )}

              {/* Apply to Set Button */}
              {onApplyWeight && (
                <button
                  onClick={() => {
                    onApplyWeight(weight);
                    onClose();
                  }}
                  className="w-full bg-accent-green text-black font-black uppercase tracking-widest py-3 rounded-xl hover:bg-accent-green/90 transition-colors shadow-lg active:scale-95 text-xs flex-shrink-0"
                >
                  Apply to Set
                </button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
