"use client";

import { useEffect, useState } from "react";
import { Swords, Crown, UserCircle, Trophy, Plus, RefreshCw } from "lucide-react";
import { useSocialStore } from "@/store/useSocialStore";
import { useProfileStore } from "@/store/useProfileStore";
import { ChallengeFriendModal } from "@/components/ChallengeFriendModal";

export default function SocialArena() {
  const { leaderboard, activeDuels, fetchSocialData, isLoading, simulateOpponent } = useSocialStore();
  const { profile } = useProfileStore();
  const [activeTab, setActiveTab] = useState<"leaderboard" | "duels">("leaderboard");
  const [isChallengeModalOpen, setIsChallengeModalOpen] = useState(false);

  useEffect(() => {
    if (leaderboard.length === 0) {
      fetchSocialData();
    }
  }, [leaderboard.length, fetchSocialData]);

  return (
    <main className="flex min-h-screen flex-col items-center pt-[var(--notch-top)] pb-24 px-6 bg-background relative overflow-x-hidden">
      
      {/* Header */}
      <header className="w-full flex items-center justify-between py-4 mb-6 sticky top-[var(--notch-top)] z-20 bg-background/80 backdrop-blur-lg border-b border-white/5">
        <h1 className="text-2xl font-extrabold tracking-tight">Social Arena</h1>
        {profile && leaderboard.find(u => u.id === profile.id) && (
          <div className="bg-white/10 px-3 py-1.5 rounded-full flex items-center gap-2 border border-white/10">
            <span className="text-accent-green font-bold text-sm drop-shadow-sm">Rank #{leaderboard.find(u => u.id === profile.id)?.rank}</span>
          </div>
        )}
      </header>

      {/* Tabs */}
      <div className="w-full flex bg-black/50 p-1 rounded-xl mb-6 border border-white/5 relative z-10">
        <button 
          onClick={() => setActiveTab("leaderboard")}
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === "leaderboard" ? "bg-white/10 text-white shadow-sm" : "text-text-muted hover:text-white"}`}
        >
          Leaderboard
        </button>
        <button 
          onClick={() => setActiveTab("duels")}
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === "duels" ? "bg-white/10 text-white shadow-sm" : "text-text-muted hover:text-white"}`}
        >
          Active Duels
        </button>
      </div>

      {isLoading && leaderboard.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-text-muted font-bold animate-pulse">Loading Arena...</p>
        </div>
      ) : activeTab === "leaderboard" ? (
        /* Leaderboard Tab */
        <section className="w-full animate-fade-in-up">
          <div className="flex flex-col gap-3">
            {leaderboard.map((user) => {
              const isMe = user.id === profile?.id;
              const rankColor = user.rank === 1 ? 'text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]' 
                            : user.rank === 2 ? 'text-gray-300 drop-shadow-[0_0_8px_rgba(209,213,219,0.5)]' 
                            : user.rank === 3 ? 'text-orange-400 drop-shadow-[0_0_8px_rgba(251,146,60,0.5)]' 
                            : 'text-text-muted/50';
                            
              return (
                <div 
                  key={user.id}
                  className={`flex items-center justify-between p-4 rounded-2xl ${isMe ? 'bg-accent-green/10 border border-accent-green/30 shadow-[0_0_15px_rgba(74,222,128,0.1)]' : 'glass-card border border-white/5'}`}
                >
                  <div className="flex items-center gap-4">
                    <span className={`font-black text-xl w-6 text-center ${rankColor}`}>
                      {user.rank}
                    </span>
                    <div className="w-10 h-10 rounded-full bg-black overflow-hidden border border-white/10">
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
                      ) : (
                        <UserCircle className="w-full h-full text-text-muted" strokeWidth={1} />
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className={`font-bold ${isMe ? 'text-accent-green' : 'text-white'}`}>
                        {user.full_name} {isMe && "(You)"}
                      </span>
                      <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">@{user.username}</span>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-sm bg-black/50 px-3 py-1.5 rounded-lg border border-white/5">
                    {user.total_xp?.toLocaleString() || "0"} <span className="text-text-muted text-xs font-sans">XP</span>
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        /* Active Duels Tab */
        <section className="w-full flex flex-col gap-6 animate-fade-in-up">
          <button 
            onClick={() => setIsChallengeModalOpen(true)}
            className="w-full bg-white/5 border border-white/10 hover:border-white/30 text-white font-bold py-4 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" /> Challenge a Friend
          </button>

          {activeDuels.length === 0 ? (
            <div className="glass-card p-6 flex flex-col items-center justify-center text-center border-dashed border-2 border-white/10">
              <Swords className="w-8 h-8 text-text-muted mb-2" />
              <p className="text-sm font-bold text-text-muted">No Active Duels</p>
            </div>
          ) : (
            activeDuels.map((duel) => {
              const totalNeeded = duel.targetScore;
              const myPerc = Math.min(100, (duel.myScore / totalNeeded) * 100);
              const oppPerc = Math.min(100, (duel.opponentScore / totalNeeded) * 100);
              
              const typeLabel = duel.type === 'war' ? 'WAR (All Metrics)' : duel.type === 'volume' ? 'Volume Battle' : 'Completion Streak';
              const durationLabel = duel.duration.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());

              return (
                <div key={duel.id} className={`glass-card w-full p-5 flex flex-col relative overflow-hidden shadow-2xl border ${duel.status === 'winning' ? 'border-accent-green/30 shadow-accent-green/10' : duel.status === 'losing' ? 'border-accent-red/30 shadow-accent-red/10' : 'border-white/5'}`}>
                  {/* Background Glows */}
                  {duel.status === 'losing' && <div className="absolute -top-10 -right-10 w-40 h-40 bg-accent-red/20 blur-3xl rounded-full pointer-events-none" />}
                  {duel.status === 'winning' && <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-accent-green/20 blur-3xl rounded-full pointer-events-none" />}
                  
                  {/* Duel Settings Ribbon */}
                  <div className="flex justify-between items-center mb-6 relative z-10">
                     <span className="text-[10px] bg-white/10 text-white px-2 py-1 rounded-sm uppercase tracking-widest font-black border border-white/5">
                        {typeLabel} ({totalNeeded.toLocaleString()})
                     </span>
                     <div className="flex items-center gap-2">
                       <button 
                         onClick={() => simulateOpponent(duel.id, duel.type === 'volume' ? 500 : duel.type === 'war' ? 100 : 1)}
                         className="text-[8px] bg-white/5 border border-white/10 px-2 py-1 rounded text-text-muted hover:text-white flex items-center gap-1 active:scale-95"
                         title="Simulate Opponent Progress (Dev)"
                       >
                         <RefreshCw className="w-3 h-3" /> Opponent +
                       </button>
                       <span className="text-[10px] text-text-muted uppercase tracking-widest font-bold">
                          {durationLabel}
                       </span>
                     </div>
                  </div>

                  <div className="flex justify-between items-center z-10 mb-6">
                    <div className="flex flex-col items-center gap-2 w-16">
                      <div className={`w-14 h-14 rounded-full border-2 ${duel.status === 'winning' ? 'border-accent-green shadow-lg shadow-green-500/20' : 'border-white/20'} bg-black flex items-center justify-center overflow-hidden`}>
                        {profile?.avatar_url ? (
                           <img src={profile.avatar_url} className="w-full h-full object-cover"/>
                        ) : <UserCircle className="text-text-muted"/>}
                      </div>
                      <span className={`text-xs font-bold ${duel.status === 'winning' ? 'text-accent-green' : 'text-white'}`}>You</span>
                    </div>
                    
                    <div className="bg-black/80 px-4 py-1.5 rounded-full border border-white/10 font-black italic text-lg text-white">
                      VS
                    </div>

                    <div className="flex flex-col items-center gap-2 w-16">
                      <div className={`w-14 h-14 rounded-full border-2 ${duel.status === 'losing' ? 'border-accent-red shadow-lg shadow-red-500/20' : 'border-white/20'} bg-black flex items-center justify-center overflow-hidden`}>
                        {duel.opponent.avatar_url ? (
                           <img src={duel.opponent.avatar_url} className="w-full h-full object-cover"/>
                        ) : <UserCircle className="text-text-muted"/>}
                      </div>
                      <span className={`text-xs font-bold ${duel.status === 'losing' ? 'text-accent-red' : 'text-text-muted'} truncate max-w-full`}>{duel.opponent.full_name || duel.opponent.username}</span>
                    </div>
                  </div>

                  <div className="z-10 flex flex-col gap-3">
                    <div className="flex justify-between text-xs font-black">
                      <span className={duel.status === 'winning' ? 'text-accent-green drop-shadow-sm' : 'text-white'}>{duel.myScore.toLocaleString()}</span>
                      <span className={duel.status === 'losing' ? 'text-accent-red drop-shadow-sm' : 'text-white'}>{duel.opponentScore.toLocaleString()}</span>
                    </div>
                    
                    {/* Progress Bars compared to Target Score */}
                    <div className="flex flex-col gap-1">
                      <div className="w-full h-2 bg-black/80 rounded-full overflow-hidden flex border border-white/5">
                        <div className="h-full bg-accent-green transition-all duration-1000 relative" style={{ width: `${myPerc}%` }}>
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/20" />
                        </div>
                      </div>
                      <div className="w-full h-2 bg-black/80 rounded-full overflow-hidden flex border border-white/5 flex-row-reverse">
                         <div className="h-full bg-accent-red transition-all duration-1000 relative" style={{ width: `${oppPerc}%` }}>
                          <div className="absolute inset-0 bg-gradient-to-l from-transparent to-white/20" />
                        </div>
                      </div>
                    </div>

                    <p className="text-center text-[10px] text-text-muted uppercase tracking-widest font-bold mt-2">
                      Ends on {new Date(duel.endDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </section>
      )}

      <ChallengeFriendModal 
        isOpen={isChallengeModalOpen} 
        onClose={() => setIsChallengeModalOpen(false)} 
      />

    </main>
  );
}
