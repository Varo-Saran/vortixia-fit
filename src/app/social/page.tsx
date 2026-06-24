"use client";

import { useEffect, useState } from "react";
import { Swords, Crown, UserCircle, Trophy, Plus, RefreshCw } from "lucide-react";
import { useSocialStore } from "@/store/useSocialStore";
import { useProfileStore } from "@/store/useProfileStore";
import { ChallengeFriendModal } from "@/components/ChallengeFriendModal";
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/Toast";

export default function SocialArena() {
  const { leaderboard, fetchSocialData, isLoading, simulateOpponent } = useSocialStore();
  const { profile } = useProfileStore();
  const [activeTab, setActiveTab] = useState<"leaderboard" | "duels">("leaderboard");
  const [isChallengeModalOpen, setIsChallengeModalOpen] = useState(false);
  const [dbDuels, setDbDuels] = useState<any[]>([]);
  const [loadingDuels, setLoadingDuels] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);

  const fetchPendingRequests = async () => {
    if (!profile) return;
    const { data: reqs, error } = await supabase
      .from('user_friends')
      .select('id, user_id, status')
      .eq('friend_id', profile.id)
      .eq('status', 'pending');

    if (reqs && reqs.length > 0) {
      const userIds = reqs.map(r => r.user_id);
      const { data: users } = await supabase.from('users').select('*').in('id', userIds);
      
      const enriched = reqs.map(r => ({
        ...r,
        sender: users?.find(u => u.id === r.user_id)
      }));
      setPendingRequests(enriched);
    } else {
      setPendingRequests([]);
    }
  };

  const handleRequestAction = async (requestId: string, action: 'accepted' | 'rejected') => {
    try {
      const res = await fetch('/api/friends', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, status: action })
      });
      if (res.ok) {
        setPendingRequests(prev => prev.filter(r => r.id !== requestId));
      } else {
        const err = await res.json();
        toast.error(`Error: ${err.error}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDuels = async () => {
    if (!profile) return;
    setLoadingDuels(true);
    try {
      const { data, error } = await supabase
        .from('duels')
        .select('*')
        .or(`user_id_1.eq.${profile.id},user_id_2.eq.${profile.id}`);
      if (error) throw error;
      setDbDuels(data || []);
    } catch (err) {
      console.error("Error fetching duels", err);
    } finally {
      setLoadingDuels(false);
    }
  };

  useEffect(() => {
    if (activeTab === "duels") {
      fetchDuels();
    }
  }, [activeTab, profile]);

  useEffect(() => {
    if (profile) {
      fetchPendingRequests();
    }
  }, [profile]);

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

      {pendingRequests.length > 0 && (
        <section className="w-full mb-6 animate-fade-in-up">
          <h2 className="text-sm font-bold text-text-muted mb-3 uppercase tracking-widest">Pending Requests</h2>
          <div className="flex flex-col gap-3">
            {pendingRequests.map(req => (
              <div key={req.id} className="flex items-center justify-between p-4 rounded-2xl glass-card border border-white/5">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-black overflow-hidden border border-white/10">
                    {req.sender?.avatar_url ? (
                      <img src={req.sender.avatar_url} alt={req.sender.username} className="w-full h-full object-cover" />
                    ) : (
                      <UserCircle className="w-full h-full text-text-muted" strokeWidth={1} />
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-white">{req.sender?.full_name || req.sender?.username}</span>
                    <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">@{req.sender?.username}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleRequestAction(req.id, 'accepted')} className="px-3 py-1.5 bg-accent-green text-black text-xs font-bold rounded-lg hover:opacity-80 transition-opacity">Accept</button>
                  <button onClick={() => handleRequestAction(req.id, 'rejected')} className="px-3 py-1.5 bg-white/10 text-white text-xs font-bold rounded-lg hover:bg-white/20 transition-opacity">Decline</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

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

          {loadingDuels ? (
            <div className="flex-1 flex items-center justify-center py-10">
              <p className="text-text-muted font-bold animate-pulse">Loading Duels...</p>
            </div>
          ) : dbDuels.length === 0 ? (
            <div className="glass-card p-6 flex flex-col items-center justify-center text-center border-dashed border-2 border-white/10">
              <Swords className="w-8 h-8 text-text-muted mb-2" />
              <p className="text-sm font-bold text-text-muted">No Active Duels</p>
            </div>
          ) : (
            dbDuels.map((duel) => {
              const isChallenger = duel.user_id_1 === profile?.id;
              const oppId = isChallenger ? duel.user_id_2 : duel.user_id_1;
              const opponent = leaderboard.find(u => u.id === oppId) || { id: oppId, username: 'Unknown', avatar_url: null, full_name: 'Unknown' };
              
              const durationLabel = duel.duration_days === 7 ? "1 Week" : "1 Month";
              
              const myScore = isChallenger ? (duel.user_1_score || 0) : (duel.user_2_score || 0);
              const oppScore = isChallenger ? (duel.user_2_score || 0) : (duel.user_1_score || 0);
              
              return (
                <div key={duel.id} className={`glass-card w-full p-5 flex flex-col relative overflow-hidden shadow-2xl border border-white/5`}>
                  
                  {/* Duel Settings Ribbon */}
                  <div className="flex justify-between items-center mb-6 relative z-10">
                     <span className="text-[10px] bg-white/10 text-white px-2 py-1 rounded-sm uppercase tracking-widest font-black border border-white/5">
                        Wager: {duel.wager_xp} XP
                     </span>
                     <div className="flex items-center gap-2">
                       <span className="text-[10px] text-text-muted uppercase tracking-widest font-bold">
                          {durationLabel}
                       </span>
                       <span className={`text-[10px] px-2 py-1 rounded-sm uppercase tracking-widest font-black border ${duel.status === 'pending' ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30' : 'bg-white/10 text-white border-white/5'}`}>
                          {duel.status}
                       </span>
                     </div>
                  </div>

                  <div className="flex justify-between items-center z-10 mb-6">
                    <div className="flex flex-col items-center gap-2 w-16">
                      <div className={`w-14 h-14 rounded-full border-2 border-white/20 bg-black flex items-center justify-center overflow-hidden`}>
                        {profile?.avatar_url ? (
                           <img src={profile.avatar_url} className="w-full h-full object-cover"/>
                        ) : <UserCircle className="text-text-muted"/>}
                      </div>
                      <span className={`text-xs font-bold text-white`}>You</span>
                    </div>
                    
                    <div className="bg-black/80 px-4 py-1.5 rounded-full border border-white/10 font-black italic text-lg text-white">
                      VS
                    </div>

                    <div className="flex flex-col items-center gap-2 w-16">
                      <div className={`w-14 h-14 rounded-full border-2 border-white/20 bg-black flex items-center justify-center overflow-hidden`}>
                        {opponent.avatar_url ? (
                           <img src={opponent.avatar_url} className="w-full h-full object-cover"/>
                        ) : <UserCircle className="text-text-muted"/>}
                      </div>
                      <span className={`text-xs font-bold text-text-muted truncate max-w-full`}>{opponent.full_name || opponent.username}</span>
                    </div>
                  </div>

                  {duel.status !== 'pending' && (
                    <div className="z-10 flex flex-col gap-3">
                      <div className="flex justify-between text-xs font-black">
                        <span className="text-white">{myScore.toLocaleString()}</span>
                        <span className="text-white">{oppScore.toLocaleString()}</span>
                      </div>
                      
                      <div className="flex flex-col gap-1">
                        <div className="w-full h-2 bg-black/80 rounded-full overflow-hidden flex border border-white/5">
                          <div className="h-full bg-white/20 transition-all duration-1000 relative" style={{ width: `50%` }}>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {duel.created_at && (
                    <p className="text-center text-[10px] text-text-muted uppercase tracking-widest font-bold mt-2">
                      Started on {new Date(duel.created_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </section>
      )}

      <ChallengeFriendModal 
        isOpen={isChallengeModalOpen} 
        onClose={() => setIsChallengeModalOpen(false)} 
        onChallengeIssued={fetchDuels}
      />

    </main>
  );
}
