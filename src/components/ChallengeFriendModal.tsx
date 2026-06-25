import { useState, useEffect } from "react";
import { X, Swords, UserCircle } from "lucide-react";
import { useProfileStore, UserProfile } from "@/store/useProfileStore";
import { supabase } from "@/lib/supabase";

interface ChallengeFriendModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChallengeIssued?: () => void;
  friends: UserProfile[];
}

export function ChallengeFriendModal({ isOpen, onClose, onChallengeIssued, friends }: ChallengeFriendModalProps) {
  const { profile } = useProfileStore();

  const [selectedFriend, setSelectedFriend] = useState<UserProfile | null>(null);
  const [duration, setDuration] = useState<"1_week" | "1_month">("1_week");
  const [wagerXP, setWagerXP] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // reset wager when duration changes
    setWagerXP(0);
  }, [duration]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const totalXP = profile?.total_xp || 0;

  const wagerTiers = duration === "1_week" 
    ? [
        { label: "Test", xp: 0 },
        { label: "Friendly", xp: 50 },
        { label: "Serious", xp: 150 },
        { label: "Vengeance", xp: 300 }
      ]
    : [
        { label: "Test", xp: 0 },
        { label: "Friendly", xp: 200 },
        { label: "Serious", xp: 500 },
        { label: "Vengeance", xp: 1000 }
      ];

  const handleChallenge = async () => {
    if (!selectedFriend || !profile) return;
    setIsSubmitting(true);
    try {
      const duration_days = duration === "1_week" ? 7 : 30;
      
      const { error } = await supabase.from('duels').insert({
        challenger_id: profile.id,
        opponent_id: selectedFriend.id,
        wager_xp: wagerXP,
        duration_days,
        status: 'pending'
      });

      if (error) throw error;
      
      if (onChallengeIssued) {
        onChallengeIssued();
      }
      onClose();
    } catch (err) {
      console.error("Error creating duel:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const acceptedFriends = friends || [];

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal Content */}
      <div className="bg-[#111] w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-white/10 shadow-2xl relative z-10 flex flex-col max-h-[85vh] overflow-hidden animate-fade-in-up">
        
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-white/10">
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Swords className="text-accent-red w-5 h-5" />
            Issue Challenge
          </h2>
          <button onClick={onClose} className="p-2 bg-white/5 rounded-full text-text-muted hover:text-white transition" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 flex flex-col gap-6">
          
          {/* Friend Selection */}
          <section>
            <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-3">Select Opponent</h3>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
              {acceptedFriends.length === 0 ? (
                <p className="text-sm text-text-muted italic">No friends available to challenge.</p>
              ) : (
                acceptedFriends.map(friend => (
                  <button
                    key={friend.id}
                    onClick={() => setSelectedFriend(friend)}
                    className={`snap-start flex flex-col items-center gap-2 min-w-[72px] p-2 rounded-xl transition-all ${selectedFriend?.id === friend.id ? 'bg-accent-red/20 border-2 border-accent-red shadow-[0_0_15px_rgba(255,51,51,0.2)]' : 'bg-black border border-white/10 hover:border-white/30'}`}
                  >
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-black/50 border border-white/10">
                      {friend.avatar_url ? (
                        <img src={friend.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                      ) : (
                        <UserCircle className="w-full h-full text-white/50" />
                      )}
                    </div>
                    <span className="text-[10px] font-bold text-white max-w-full truncate">{friend.username}</span>
                  </button>
                ))
              )}
            </div>
          </section>

          {/* Duration Toggle */}
          <section>
            <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-3">Duration</h3>
            <div className="flex bg-black/50 p-1 rounded-xl border border-white/5">
              <button 
                onClick={() => setDuration("1_week")}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${duration === "1_week" ? "bg-white/10 text-white shadow-sm" : "text-text-muted hover:text-white"}`}
              >
                1 Week
              </button>
              <button 
                onClick={() => setDuration("1_month")}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${duration === "1_month" ? "bg-white/10 text-white shadow-sm" : "text-text-muted hover:text-white"}`}
              >
                1 Month
              </button>
            </div>
          </section>

          {/* Wager Tiers */}
          <section>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest">Wager Tier</h3>
              <span className="text-xs font-bold text-text-muted">Your XP: {totalXP.toLocaleString()}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {wagerTiers.map(tier => {
                const canAfford = totalXP >= tier.xp;
                const isSelected = wagerXP === tier.xp;
                return (
                  <button
                    key={tier.label}
                    disabled={!canAfford}
                    onClick={() => setWagerXP(tier.xp)}
                    className={`p-3 rounded-xl flex flex-col gap-1 text-left border transition-all ${
                      !canAfford 
                        ? 'opacity-40 bg-black border-white/5 cursor-not-allowed' 
                        : isSelected 
                          ? 'bg-accent-red/20 border-accent-red shadow-[0_0_10px_rgba(255,51,51,0.2)] text-white' 
                          : 'bg-black border-white/10 text-text-muted hover:border-white/30'
                    }`}
                  >
                    <span className="font-bold text-sm">{tier.label}</span>
                    <span className="text-xs opacity-80">{tier.xp} XP</span>
                  </button>
                );
              })}
            </div>
          </section>

        </div>

        {/* Footer */}
        <div className="p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] border-t border-white/10 bg-black/50">
          <button 
            disabled={!selectedFriend || isSubmitting}
            onClick={handleChallenge}
            className="w-full bg-accent-red hover:bg-red-600 disabled:opacity-50 disabled:hover:bg-accent-red text-white font-black text-sm uppercase tracking-widest py-4 rounded-xl shadow-[0_0_20px_rgba(255,51,51,0.3)] transition-all active:scale-95"
          >
            {isSubmitting ? 'Challenging...' : selectedFriend ? `Challenge ${selectedFriend.username}` : 'Select Opponent'}
          </button>
        </div>

      </div>
    </div>
  );
}
