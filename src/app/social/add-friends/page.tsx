"use client";

import { ChevronLeft, Flame, Star, CheckCircle2, UserPlus, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AddFriendsPage() {
  const router = useRouter();
  
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data);
        }
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    };
    
    const debounce = setTimeout(fetchUsers, 300);
    return () => clearTimeout(debounce);
  }, [query]);

  const handleAddFriend = async (friendId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    
    const { error } = await supabase.from('user_friends').insert({
      user_id: session.user.id,
      friend_id: friendId,
      status: 'pending'
    });
    
    if (error) {
      console.error("Error adding friend:", error);
    } else {
      alert("Friend request sent!");
    }
  };

  return (
    <main className="flex min-h-screen flex-col bg-[#050505] relative overflow-x-hidden pb-24">
      
      {/* Header */}
      <header className="fixed top-0 w-full z-50 flex items-center justify-between p-4 pt-[calc(var(--notch-top)+1rem)]">
        {searchOpen ? (
          <div className="flex w-full items-center gap-2 bg-black/80 backdrop-blur-md p-2 rounded-full border border-white/10">
            <Search className="w-5 h-5 text-white ml-2" />
            <input 
              autoFocus
              type="text" 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search athletes..."
              className="flex-1 bg-transparent text-white outline-none text-sm placeholder:text-gray-500"
            />
            <button onClick={() => { setSearchOpen(false); setQuery(""); }} className="p-1 text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <>
            <button onClick={() => router.back()} className="w-10 h-10 bg-black/40 backdrop-blur-md border border-white/10 rounded-full flex items-center justify-center text-white">
              <ChevronLeft className="w-6 h-6 pr-1" />
            </button>
            <div className="flex items-center gap-3">
              <button onClick={() => setSearchOpen(true)} className="w-10 h-10 bg-black/40 backdrop-blur-md border border-white/10 rounded-full flex items-center justify-center text-white">
                <Search className="w-5 h-5" />
              </button>
            </div>
          </>
        )}
      </header>

      {/* Hero Section */}
      <section className="relative w-full h-[55vh] flex flex-col justify-end p-6">
        <div className="absolute inset-0 z-0">
          <img src="/mockups/neon_athlete.png" alt="Athlete" className="w-full h-full object-cover opacity-80 mix-blend-screen" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/60 to-transparent" />
          
          {/* Decorative floating stats */}
          <div className="absolute top-[30%] left-6 glass-card px-3 py-1.5 flex items-center gap-2 border-accent-green/30 animate-fade-in-up">
            <img src="https://i.pravatar.cc/150?u=a1" className="w-5 h-5 rounded-full" />
            <span className="text-[10px] text-white font-bold">Matched 90%</span>
          </div>
          <div className="absolute top-[45%] right-6 glass-card px-3 py-1.5 flex items-center gap-2 border-purple-500/30 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <img src="https://i.pravatar.cc/150?u=a2" className="w-5 h-5 rounded-full" />
            <span className="text-[10px] text-white font-bold">Matched 85%</span>
          </div>
        </div>

        <div className="z-10 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          <h1 className="text-4xl font-black text-white leading-tight mb-2">
            Find Your<br/>
            <span className="text-accent-green">Lifting Partner</span>
          </h1>
          <p className="text-sm text-text-muted">
            Connect with like-minded athletes globally and hit the iron together!
          </p>
          
          {/* Quick Stats Row */}
          <div className="flex gap-4 mt-6">
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2 backdrop-blur-md">
              <Flame className="w-5 h-5 text-purple-500" />
              <div className="flex flex-col">
                <span className="text-[10px] text-text-muted uppercase font-bold tracking-widest">Global Pool</span>
                <span className="text-sm font-black text-white">40.5 k</span>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2 backdrop-blur-md">
              <CheckCircle2 className="w-5 h-5 text-accent-green" />
              <div className="flex flex-col">
                <span className="text-[10px] text-text-muted uppercase font-bold tracking-widest">Matches</span>
                <span className="text-sm font-black text-white">120</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Global Athletes Grid */}
      <section className="w-full px-6 mt-8 z-10 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-black text-white">{query ? "Search Results" : "Recommended Athletes"}</h2>
          {!query && <button className="text-xs font-bold text-purple-400 bg-purple-400/10 px-3 py-1 rounded-full">View all &rarr;</button>}
        </div>

        {loading ? (
          <div className="text-white text-sm">Loading...</div>
        ) : (
          <div className="flex overflow-x-auto no-scrollbar gap-4 pb-8 pr-6 -mr-6 pl-1">
            {results.map((user, idx) => (
              <div 
                key={user.id}
                className={`min-w-[180px] p-5 rounded-3xl flex flex-col items-center relative overflow-hidden bg-black border ${
                  idx % 2 === 0 ? 'border-accent-green/50 shadow-[0_0_30px_rgba(74,222,128,0.15)]' : 'border-purple-500/50 shadow-[0_0_30px_rgba(168,85,247,0.15)]'
                }`}
              >
                {/* Inner glow */}
                <div className={`absolute bottom-0 left-0 w-full h-1/2 blur-2xl ${idx % 2 === 0 ? 'bg-accent-green/20' : 'bg-purple-500/20'}`} />
                
                <h3 className="text-white font-bold z-10">{user.username || 'Unknown'}</h3>
                <div className="flex items-center gap-1 mt-1 z-10">
                  <Flame className={`w-3 h-3 ${idx % 2 === 0 ? 'text-accent-green' : 'text-purple-400'}`} />
                  <span className="text-[10px] text-text-muted font-bold">XP: {user.total_xp || 0}</span>
                </div>

                <div className="relative mt-4 mb-6 z-10">
                  <div className={`absolute inset-[-4px] rounded-full blur-md ${idx % 2 === 0 ? 'bg-accent-green/40' : 'bg-purple-500/40'}`} />
                  <img src={user.avatar_url || "https://i.pravatar.cc/150"} className="w-16 h-16 rounded-full border-2 border-black relative z-10 object-cover" />
                </div>

                <button 
                  onClick={() => handleAddFriend(user.id)}
                  className={`w-full py-3 rounded-2xl font-bold text-xs z-10 transition-transform active:scale-95 ${
                    idx % 2 === 0 
                      ? 'bg-white text-black hover:bg-gray-200' 
                      : 'bg-white text-black hover:bg-gray-200'
                  }`}
                >
                  Add friend
                </button>
              </div>
            ))}
            {results.length === 0 && (
              <div className="text-text-muted text-sm">No athletes found.</div>
            )}
          </div>
        )}
      </section>

    </main>
  );
}
