import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { useProfileStore } from '@/store/useProfileStore';

interface CelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  rewardAmount?: number;
}

export function CelebrationModal({ isOpen, onClose, rewardAmount = 500 }: CelebrationModalProps) {
  const { profile } = useProfileStore();
  const [showStats, setShowStats] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Fire confetti explosion
      const duration = 3000;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 5,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#4ade80', '#ffffff', '#22c55e']
        });
        confetti({
          particleCount: 5,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#4ade80', '#ffffff', '#22c55e']
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        } else {
          setShowStats(true);
        }
      };
      
      frame();

      return () => {
        setShowStats(false);
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={onClose}
          />
          
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 15, stiffness: 300 }}
            className="relative w-full max-w-sm bg-gradient-to-b from-[#111] to-[#0a0a0a] border border-accent-green/30 rounded-3xl p-6 shadow-[0_0_50px_rgba(74,222,128,0.2)] flex flex-col items-center text-center overflow-hidden"
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-accent-green/20 blur-3xl rounded-full pointer-events-none" />
            
            <div className="w-20 h-20 bg-accent-green/10 rounded-full flex items-center justify-center mb-4 border border-accent-green/30 shadow-[0_0_20px_rgba(74,222,128,0.4)]">
              <span className="text-4xl">🏆</span>
            </div>
            
            <h2 className="text-3xl font-black text-white mb-2 drop-shadow-md">Level Up!</h2>
            <p className="text-text-muted text-sm font-medium mb-6">
              You've claimed your milestone reward. Keep pushing!
            </p>

            <AnimatePresence>
              {showStats && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="w-full bg-black/50 border border-white/5 rounded-2xl p-4 mb-6"
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-text-muted font-bold uppercase tracking-wider">Total XP</span>
                    <span className="text-lg font-black text-accent-green">{(profile?.total_xp || 0) + rewardAmount}</span>
                  </div>
                  <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: '0%' }}
                      animate={{ width: '100%' }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className="h-full bg-accent-green shadow-[0_0_10px_#4ade80]" 
                    />
                  </div>
                  <p className="text-[10px] text-accent-green/80 mt-2 font-bold text-right">+{rewardAmount} XP Earned</p>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              onClick={onClose}
              className="w-full py-3 px-6 bg-accent-green text-black font-black uppercase tracking-widest rounded-xl hover:bg-accent-green/90 transition-colors active:scale-95"
            >
              Continue
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
