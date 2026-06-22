import { useState, useEffect } from "react";
import { X, Swords, UserCircle } from "lucide-react";
import { useSocialStore, DuelType, DuelDuration } from "@/store/useSocialStore";
import { useFriendsStore } from "@/store/useFriendsStore";
import { UserProfile } from "@/store/useProfileStore";

interface ChallengeFriendModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChallengeFriendModal({ isOpen, onClose }: ChallengeFriendModalProps) {
  const { friends } = useFriendsStore();
  const { createDuel } = useSocialStore();

  const [selectedFriend, setSelectedFriend] = useState<UserProfile | null>(null);
  const [duelType, setDuelType] = useState<DuelType>("war");
  const [duration, setDuration] = useState<DuelDuration>("1_week");
  const [targetScore, setTargetScore] = useState<number>(5000);

  useEffect(() => {
    // Mock friends are loaded instantly, so no fetch needed
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChallenge = () => {
    if (!selectedFriend) return;
    createDuel(selectedFriend, duelType, duration, targetScore);
    onClose();
  };

  const acceptedFriends = friends.filter(f => f.status === 'friends');

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
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
          <button onClick={onClose} className="p-2 bg-white/5 rounded-full text-text-muted hover:text-white transition">
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
                    onClick={() => setSelectedFriend({ id: friend.id, username: friend.username, full_name: friend.name, avatar_url: friend.avatar, total_xp: 0 })}
                    className={`snap-start flex flex-col items-center gap-2 min-w-[72px] p-2 rounded-xl transition-all ${selectedFriend?.id === friend.id ? 'bg-accent-red/20 border-2 border-accent-red shadow-[0_0_15px_rgba(255,51,51,0.2)]' : 'bg-black border border-white/10 hover:border-white/30'}`}
                  >
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-black/50 border border-white/10">
                      {friend.avatar ? (
                        <img src={friend.avatar} alt="avatar" className="w-full h-full object-cover" />
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

          {/* Duel Type */}
          <section>
            <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-3">Duel Type</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: "war", label: "XP War", desc: "Most XP wins" },
                { id: "volume", label: "Volume Battle", desc: "Total weight lifted" },
                { id: "completion_streak", label: "Streak Race", desc: "Most days trained" }
              ].map(type => (
                <button
                  key={type.id}
                  onClick={() => {
                    setDuelType(type.id as DuelType);
                    setTargetScore(type.id === "war" ? 5000 : type.id === "volume" ? 20000 : 7);
                  }}
                  className={`p-3 rounded-xl flex flex-col gap-1 text-left border transition-all ${duelType === type.id ? 'bg-white/10 border-white text-white' : 'bg-black border-white/10 text-text-muted hover:border-white/30'}`}
                >
                  <span className="font-bold text-sm">{type.label}</span>
                  <span className="text-[10px] opacity-70">{type.desc}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Target Score */}
          <section>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest">Target Score</h3>
              <span className="text-xs font-bold text-accent-green">
                {targetScore.toLocaleString()} {duelType === "war" ? "XP" : duelType === "volume" ? "KG" : "Days"}
              </span>
            </div>
            <input 
              type="range" 
              min={duelType === "completion_streak" ? 3 : 1000} 
              max={duelType === "completion_streak" ? 30 : 50000} 
              step={duelType === "completion_streak" ? 1 : 1000}
              value={targetScore}
              onChange={(e) => setTargetScore(Number(e.target.value))}
              className="w-full accent-accent-red"
            />
          </section>

          {/* Duration */}
          <section>
            <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-3">Time Limit</h3>
            <select 
              value={duration} 
              onChange={(e) => setDuration(e.target.value as DuelDuration)}
              className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm font-bold text-white outline-none focus:border-white/50"
            >
              <option value="1_week">1 Week</option>
              <option value="1_month">1 Month</option>
              <option value="3_months">3 Months</option>
              <option value="6_months">6 Months</option>
            </select>
          </section>

        </div>

        {/* Footer */}
        <div className="p-5 border-t border-white/10 bg-black/50">
          <button 
            disabled={!selectedFriend}
            onClick={handleChallenge}
            className="w-full bg-accent-red hover:bg-red-600 disabled:opacity-50 disabled:hover:bg-accent-red text-white font-black text-sm uppercase tracking-widest py-4 rounded-xl shadow-[0_0_20px_rgba(255,51,51,0.3)] transition-all active:scale-95"
          >
            {selectedFriend ? `Challenge ${selectedFriend.username}` : 'Select Opponent'}
          </button>
        </div>

      </div>
    </div>
  );
}
