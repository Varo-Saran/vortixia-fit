"use client";

import { useEffect, useState } from "react";
import { Plus, UserCircle, Settings, Bell, Swords, HeartPulse, Flame, Check, Moon, Utensils, CloudRain, Sun, Cloud, Snowflake, CloudLightning, MapPin, Users } from "lucide-react";
import Link from "next/link";
import { useRoutineStore } from "@/store/useRoutineStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useFriendsStore } from "@/store/useFriendsStore";
import { useRecoveryStore } from "@/store/useRecoveryStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useWeather } from "@/hooks/useWeather";
import { supabase } from "@/lib/supabase";
import { useNotificationStore } from "@/store/useNotificationStore";
import { CelebrationModal } from "@/components/ui/CelebrationModal";

export default function Dashboard() {
  const [greeting, setGreeting] = useState("Hello");
  const [streakDays, setStreakDays] = useState<{ day: string; date: string; active: boolean; today: boolean; timestamp: number }[]>(() => {
    const days = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dayStr = d.toLocaleDateString('en-US', { weekday: 'short' }).charAt(0);
      days.push({
        day: dayStr,
        date: d.getDate().toString(),
        active: false,
        today: i === 0,
        timestamp: new Date(d.setHours(0, 0, 0, 0)).getTime()
      });
    }
    return days;
  });
  const { weeklyPlan, fetchRoutine } = useRoutineStore();
  const { profile, fetchProfile } = useProfileStore();
  const { friends } = useFriendsStore();
  const { readinessScore } = useRecoveryStore();
  const { heroGender, setHeroGender } = useSettingsStore();
  const weather = useWeather();
  
  const { unreadCount } = useNotificationStore();
  const [showCelebration, setShowCelebration] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  const [recommendedAthletes, setRecommendedAthletes] = useState<any[]>([]);

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        const res = await fetch(`/api/search?q=`);
        if (res.ok) {
          const data = await res.json();
          setRecommendedAthletes(data);
        }
      } catch (e) {
        console.error("Failed to fetch recommendations", e);
      }
    };
    fetchRecommendations();
  }, []);

  useEffect(() => {
    if (weeklyPlan.length === 0) fetchRoutine();
    if (!profile) fetchProfile();

    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good morning");
    else if (hour < 18) setGreeting("Good afternoon");
    else setGreeting("Good evening");
  }, [weeklyPlan, profile, fetchRoutine, fetchProfile]);

  useEffect(() => {
    if (profile?.unclaimed_rewards && profile.unclaimed_rewards > 0) {
      setShowBanner(true);
    }
  }, [profile?.unclaimed_rewards]);

  useEffect(() => {
    const fetchStreak = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      sevenDaysAgo.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('workout_sessions')
        .select('start_time')
        .eq('user_id', user.id)
        .gte('start_time', sevenDaysAgo.toISOString());

      if (!error && data) {
        setStreakDays(prev => {
          const newStreak = prev.map(s => ({ ...s }));
          data.forEach(session => {
            const sessionDate = new Date(session.start_time);
            sessionDate.setHours(0, 0, 0, 0);
            const idx = newStreak.findIndex(s => s.timestamp === sessionDate.getTime());
            if (idx !== -1) {
              newStreak[idx].active = true;
            }
          });
          return newStreak;
        });
      }
    };
    
    fetchStreak();
  }, []);

  const onlineFriends = friends.filter(f => f.isOnline && f.status === 'friends');

  const WeatherIcon = () => {
    if (weather.icon === 'sun') return <Sun className="w-4 h-4 text-yellow-400" />;
    if (weather.icon === 'cloud') return <Cloud className="w-4 h-4 text-gray-300" />;
    if (weather.icon === 'rain') return <CloudRain className="w-4 h-4 text-blue-400" />;
    if (weather.icon === 'snow') return <Snowflake className="w-4 h-4 text-blue-200" />;
    if (weather.icon === 'storm') return <CloudLightning className="w-4 h-4 text-purple-400" />;
    return <MapPin className="w-4 h-4 text-text-muted" />;
  };

  return (
    <main className="flex min-h-screen flex-col pb-28 bg-[#050505] relative overflow-x-hidden">
      
      {/* Massive Hero Background Image */}
      <div className="absolute top-0 left-0 w-full h-[55vh] z-0 pointer-events-none">
        <img 
          src={`/mockups/hero_${heroGender}.png`} 
          alt="Hero Athlete" 
          className="w-full h-full object-cover opacity-80 mix-blend-lighten" 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/60 to-black/30" />
      </div>

      {/* Header Content Overlay */}
      <header className="relative z-10 pt-[calc(var(--notch-top)+1rem)] px-6 w-full flex justify-between items-start">
        <div className="flex flex-col animate-fade-in-down">
          <h1 className="text-4xl font-black text-white leading-tight drop-shadow-lg">
            {greeting},<br/>
            <span className="text-accent-green">{profile?.full_name?.split(' ')[0] || "Champion"}</span>
          </h1>
          <div className="group relative w-max mt-3">
            <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/10 shadow-lg cursor-pointer hover:bg-black/60 transition-colors">
              <WeatherIcon />
              <span className="text-xs text-white font-bold">
                {weather.status === "loading" || weather.status === "idle" ? "Loading..." : 
                 weather.status === "denied" || weather.status === "error" ? "--" :
                 `${weather.city} · ${weather.temp}°C · ${weather.condition}`}
              </span>
            </div>
            
            {(weather.status === "denied" || weather.status === "error") && (
              <div className="absolute top-full left-0 mt-2 bg-white text-black text-[10px] font-bold px-3 py-2 rounded shadow-xl opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none z-50">
                Tap to allow location access for local weather
              </div>
            )}
          </div>
        </div>
        
        <div className="flex flex-col items-end gap-3 animate-fade-in-down" style={{ animationDelay: '0.1s' }}>
          <Link href="/notifications">
            <div className="relative w-12 h-12 rounded-full border border-white/20 bg-black/40 backdrop-blur-md flex items-center justify-center transition-transform active:scale-95 shadow-lg">
              <Bell className="w-5 h-5 text-white" />
              {unreadCount > 0 && (
                <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.8)] border border-black" />
              )}
            </div>
          </Link>
          <button 
            onClick={() => setHeroGender(heroGender === 'male' ? 'female' : 'male')} 
            className="text-[9px] uppercase tracking-widest font-bold bg-white/10 backdrop-blur-md px-2 py-1.5 rounded-md border border-white/20 text-white hover:bg-white/20 transition-colors"
          >
            Switch to {heroGender === 'male' ? 'Female' : 'Male'}
          </button>
        </div>
      </header>

      {/* Floating Weekly Streak Panel (Row 2) */}
      <section className="relative z-10 w-full px-4 mt-[12vh] mb-6 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
        <h2 className="text-white text-xs font-bold mb-3 pl-2 opacity-90 drop-shadow-md">My Activity</h2>
        <div className="w-full bg-white/5 backdrop-blur-xl border border-white/10 p-4 rounded-[2rem] flex justify-between items-center shadow-2xl">
           {streakDays.map((d, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <div 
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    d.active 
                      ? 'bg-accent-green shadow-[0_0_15px_rgba(74,222,128,0.4)] text-black scale-110 border border-transparent' 
                      : d.today 
                        ? 'bg-white/10 border-2 border-accent-green/50 text-accent-green' 
                        : 'bg-black/50 border border-white/10 text-text-muted'
                  }`}
                >
                  <Flame className={`w-4 h-4 ${d.active ? 'fill-current' : ''}`} />
                </div>
                <span className={`text-[10px] font-bold ${d.today ? 'text-accent-green' : 'text-text-muted'}`}>{d.day}</span>
              </div>
           ))}
        </div>
      </section>

      {showBanner && (
        <div 
          onClick={() => {
            setShowBanner(false);
            setShowCelebration(true);
            // mock claim logic in real app here
          }}
          className="relative z-10 w-[calc(100%-2rem)] mx-auto mb-6 p-4 rounded-2xl bg-gradient-to-r from-accent-green to-emerald-400 cursor-pointer shadow-[0_0_30px_rgba(74,222,128,0.4)] active:scale-95 transition-transform animate-fade-in-up"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-black/20 rounded-full flex items-center justify-center">
                <span className="text-xl">🎁</span>
              </div>
              <div>
                <h3 className="text-black font-black text-sm uppercase tracking-wider">Milestone Achieved!</h3>
                <p className="text-black/80 text-xs font-bold">Tap to claim your reward</p>
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center">
              <Check className="w-4 h-4 text-accent-green" strokeWidth={3} />
            </div>
          </div>
        </div>
      )}

      {/* Celebration Modal */}
      <CelebrationModal 
        isOpen={showCelebration} 
        onClose={() => setShowCelebration(false)} 
        rewardAmount={500}
      />

      {/* Grid Bento Wrapper */}
      <section className="relative z-10 w-full px-4 grid grid-cols-2 gap-3 auto-rows-[minmax(110px,auto)] animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
        
        {/* 1. Start Workout (Tall) */}
        <Link href="/workout" className="col-span-1 row-span-2 relative p-5 rounded-[2rem] overflow-hidden flex flex-col justify-between group bg-[#111] border border-white/5 shadow-2xl active:scale-95 transition-transform">
          <div className="absolute inset-0 bg-gradient-to-b from-accent-green/20 to-transparent opacity-50" />
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-accent-green/30 blur-3xl rounded-full" />
           <div className="z-10">
             <h2 className="text-white font-bold text-lg leading-tight">{(() => {
               const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
               const todayName = days[new Date().getDay()];
               const todayPlan = weeklyPlan.find(p => p.day === todayName);
               return todayPlan?.type === 'Rest' ? 'Rest Day' : (todayPlan?.title || 'Start');
             })()}</h2>
             <p className="text-text-muted text-[10px] mt-1 font-bold uppercase tracking-widest">Today's Plan</p>
           </div>
          <div className="z-10 mt-auto">
            <div className="w-10 h-10 bg-accent-green text-black rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(74,222,128,0.5)] group-hover:scale-110 transition-transform">
              <Plus className="w-6 h-6" strokeWidth={3} />
            </div>
          </div>
        </Link>

        {/* 2. CNS Readiness */}
        <Link href="/recovery" className="col-span-1 row-span-1 relative p-4 rounded-[2rem] bg-[#1a0f0f] border border-red-500/10 overflow-hidden flex flex-col justify-between">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 bg-red-500/30 blur-2xl rounded-full pointer-events-none" />
          <div className="flex items-center justify-between z-10">
            <span className="text-white text-xs font-bold opacity-80">Readiness</span>
            <HeartPulse className="w-4 h-4 text-red-500" />
          </div>
          <div className="z-10">
            <div className="text-3xl font-black text-white">{readinessScore || 54}<span className="text-sm">%</span></div>
            <p className="text-red-400 text-[10px] font-bold uppercase mt-1">Fatigued</p>
          </div>
        </Link>

        {/* 3. Calories (Mocked with Tooltip) */}
        <div className="col-span-1 row-span-1 relative p-4 rounded-[2rem] bg-[#1f130a] border border-orange-500/10 overflow-hidden flex flex-col items-center justify-center group cursor-not-allowed">
          <div className="absolute inset-0 bg-black/40 z-20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <span className="bg-white text-black text-[10px] font-bold px-2 py-1 rounded">Coming Soon</span>
          </div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-orange-500/20 blur-2xl rounded-full pointer-events-none" />
          
          <div className="flex w-full justify-between items-start z-10 mb-2">
            <span className="text-white text-xs font-bold opacity-80">Calories</span>
            <Utensils className="w-3 h-3 text-orange-400" />
          </div>
          
          <div className="relative w-16 h-16 z-10 flex items-center justify-center">
             <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90 overflow-visible">
               <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(255,165,0,0.2)" strokeWidth="4" />
               <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#f97316" strokeWidth="4" strokeDasharray="60, 100" className="drop-shadow-[0_0_5px_rgba(249,115,22,0.8)]" />
             </svg>
             <div className="absolute text-white font-black text-xs">1.7k</div>
          </div>
        </div>

        {/* 4. Sleep Score (Wide Horizontal) */}
        <div className="col-span-2 row-span-1 relative p-4 rounded-[2rem] bg-[#0a1a10] border border-green-500/10 overflow-hidden flex flex-col justify-between group cursor-not-allowed">
           <div className="absolute inset-0 bg-black/40 z-20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <span className="bg-white text-black text-[10px] font-bold px-2 py-1 rounded">Coming Soon</span>
          </div>
          <div className="absolute right-0 bottom-0 w-32 h-32 bg-green-500/10 blur-3xl rounded-full pointer-events-none" />
          
          <div className="flex justify-between items-start z-10">
            <div className="flex flex-col">
              <span className="text-white text-xs font-bold opacity-80">Sleep Scores</span>
              <div className="text-3xl font-black text-white mt-1">89<span className="text-sm text-text-muted">%</span></div>
            </div>
            <Moon className="w-5 h-5 text-emerald-400" />
          </div>

          <div className="w-full mt-4 flex flex-col gap-1 z-10">
             <div className="flex justify-between text-[8px] text-text-muted font-bold px-1">
               <span>Light</span><span>REM</span><span>Deep</span>
             </div>
             <div className="w-full flex h-2 rounded-full overflow-hidden bg-black/50">
                <div className="h-full bg-emerald-800" style={{ width: '40%' }} />
                <div className="h-full bg-emerald-500" style={{ width: '35%' }} />
                <div className="h-full bg-accent-green shadow-[0_0_8px_#4ade80]" style={{ width: '25%' }} />
             </div>
          </div>
        </div>

        {/* 5. Active Duel (Square) */}
        <Link href="/social" className="col-span-1 row-span-1 relative p-4 rounded-[2rem] bg-[#140a1a] border border-purple-500/10 overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/20 blur-2xl rounded-full pointer-events-none" />
          <div className="flex items-center justify-between z-10">
            <span className="text-white text-xs font-bold opacity-80">Active Duel</span>
            <Swords className="w-4 h-4 text-purple-400" />
          </div>
          <div className="z-10">
            <div className="text-3xl font-black text-white">1st</div>
            <p className="text-purple-400 text-[10px] font-bold uppercase mt-1">+2,150 XP</p>
          </div>
        </Link>

        {/* 6. Friends Online & Recommendations (Wide) */}
        <Link href="/social/add-friends" className="col-span-2 row-span-1 relative p-4 rounded-[2rem] bg-[#0c121e] border border-blue-500/10 overflow-hidden flex flex-col justify-between group active:scale-95 transition-transform">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-blue-500/10 blur-3xl pointer-events-none group-hover:bg-blue-500/20 transition-all" />
          
          <div className="flex justify-between items-start z-10 w-full">
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-white text-xs font-bold opacity-80 flex items-center gap-1"><Users className="w-3 h-3 text-blue-400" /> Community</span>
                <span className="bg-blue-500/20 text-blue-400 text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider border border-blue-500/20">{onlineFriends.length} Online</span>
              </div>
            </div>
            <div className="text-[10px] text-blue-400 font-bold uppercase tracking-widest bg-blue-500/10 px-2 py-1 rounded-lg">View All</div>
          </div>

          <div className="z-10 mt-3 flex items-center gap-3">
            <div className="text-[10px] text-text-muted font-bold uppercase tracking-widest min-w-max">Recommended:</div>
            <div className="flex -space-x-2">
               {recommendedAthletes.slice(0, 5).map((user, i) => (
                  <img key={user.id} src={user.avatar_url || "https://i.pravatar.cc/150"} alt="avatar" className="w-8 h-8 rounded-full border-2 border-[#0c121e] relative object-cover shadow-lg" style={{ zIndex: 5 - i }} />
                ))}
                {recommendedAthletes.length > 5 && (
                  <div className="w-8 h-8 rounded-full border-2 border-[#0c121e] bg-blue-500/20 text-blue-400 flex items-center justify-center relative z-0 shadow-lg">
                    <span className="text-[10px] font-black">+{recommendedAthletes.length - 5}</span>
                  </div>
                )}
                {recommendedAthletes.length === 0 && (
                  <div className="text-[10px] text-text-muted font-bold italic ml-2">Loading...</div>
                )}
            </div>
          </div>
        </Link>

        {/* 7. Keep it up Trophy (Wide Rectangle) */}
        <div className="col-span-2 row-span-1 p-5 rounded-[2rem] bg-gradient-to-r from-[#111] to-[#1a1710] border border-yellow-500/10 flex items-center relative overflow-hidden">
           <div className="absolute right-[-20px] top-1/2 -translate-y-1/2 w-32 h-32 pointer-events-none opacity-90">
              <img src="/mockups/trophy.png" alt="Trophy" className="w-full h-full object-contain drop-shadow-2xl" />
           </div>
           <div className="z-10 w-2/3">
              <h3 className="text-white font-black text-xl leading-tight">Keep it up!</h3>
              <p className="text-text-muted text-[10px] mt-1 font-bold">You're building momentum!</p>
           </div>
        </div>

        {/* 8. Complete Tasks (Wide Rectangle) */}
        <div className="col-span-2 row-span-1 p-5 rounded-[2rem] bg-gradient-to-r from-[#1a1f1a] to-[#111] border border-accent-green/10 flex items-center relative overflow-hidden">
           <div className="absolute left-[-20px] top-1/2 -translate-y-1/2 w-32 h-32 pointer-events-none opacity-90">
              <img src="/mockups/coins.png" alt="Coins" className="w-full h-full object-contain drop-shadow-2xl" />
           </div>
           <div className="z-10 w-full pl-24 flex justify-end text-right">
              <div className="flex flex-col items-end">
                <h3 className="text-white font-black text-xl leading-tight">Complete<br/>new tasks</h3>
                <p className="text-accent-green text-[10px] mt-1 font-bold">+500 XP Available</p>
              </div>
           </div>
        </div>

      </section>

    </main>
  );
}
