"use client";

import { useEffect, useState } from "react";
import { Plus, UserCircle, Settings, Bell, Swords, HeartPulse, Flame, Check, Moon, Utensils, CloudRain, Sun, Cloud, Snowflake, CloudLightning, MapPin } from "lucide-react";
import Link from "next/link";
import { useRoutineStore } from "@/store/useRoutineStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useFriendsStore } from "@/store/useFriendsStore";
import { useRecoveryStore } from "@/store/useRecoveryStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useWeather } from "@/hooks/useWeather";

export default function Dashboard() {
  const [greeting, setGreeting] = useState("Hello");
  const { weeklyPlan, fetchRoutine } = useRoutineStore();
  const { profile, fetchProfile } = useProfileStore();
  const { friends } = useFriendsStore();
  const { readinessScore } = useRecoveryStore();
  const { heroGender, setHeroGender } = useSettingsStore();
  const weather = useWeather();

  useEffect(() => {
    if (weeklyPlan.length === 0) fetchRoutine();
    if (!profile) fetchProfile();

    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good morning");
    else if (hour < 18) setGreeting("Good afternoon");
    else setGreeting("Good evening");
  }, [weeklyPlan, profile, fetchRoutine, fetchProfile]);

  const streakDays = [
    { day: "M", date: "19", active: true },
    { day: "T", date: "20", active: true },
    { day: "W", date: "21", active: false },
    { day: "T", date: "22", active: true, today: true },
    { day: "F", date: "23", active: false },
    { day: "S", date: "24", active: false },
    { day: "S", date: "25", active: false },
  ];

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
          <Link href="/profile">
            <div className="relative w-14 h-14 rounded-full border-2 border-accent-green overflow-hidden shadow-[0_0_20px_rgba(74,222,128,0.4)] transition-transform active:scale-95 bg-black">
              {profile?.avatar_url ? (
                 <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                 <UserCircle className="w-full h-full text-white/50" />
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

      {/* Grid Bento Wrapper */}
      <section className="relative z-10 w-full px-4 grid grid-cols-2 gap-3 auto-rows-[minmax(110px,auto)] animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
        
        {/* 1. Start Workout (Tall) */}
        <Link href="/workout" className="col-span-1 row-span-2 relative p-5 rounded-[2rem] overflow-hidden flex flex-col justify-between group bg-[#111] border border-white/5 shadow-2xl active:scale-95 transition-transform">
          <div className="absolute inset-0 bg-gradient-to-b from-accent-green/20 to-transparent opacity-50" />
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-accent-green/30 blur-3xl rounded-full" />
          <div className="z-10">
            <h2 className="text-white font-bold text-lg leading-tight">Leg Day<br/>Crusher</h2>
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

        {/* 6. Friends Online (Square) */}
        <Link href="/social/add-friends" className="col-span-1 row-span-1 relative p-4 rounded-[2rem] bg-[#111] border border-white/5 overflow-hidden flex flex-col justify-between group">
          <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-24 h-24 bg-blue-500/10 blur-2xl rounded-full pointer-events-none group-hover:bg-blue-500/20 transition-all" />
          <div className="z-10">
            <span className="text-white text-xs font-bold opacity-80">Friends</span>
            <div className="text-lg font-black text-white mt-1">{onlineFriends.length} <span className="text-xs text-text-muted font-bold">online</span></div>
          </div>
          <div className="flex -space-x-2 z-10 mt-2">
             {onlineFriends.slice(0, 4).map((f, i) => (
                <img key={f.id} src={f.avatar} alt="avatar" className={`w-8 h-8 rounded-full border-2 border-[#111] z-[${4-i}] object-cover`} />
              ))}
              <div className="w-8 h-8 rounded-full border-2 border-[#111] bg-white/10 flex items-center justify-center z-0">
                <span className="text-[8px] font-bold text-white">+{friends.length}</span>
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
              <p className="text-text-muted text-[10px] mt-1 font-bold">35 days in a row you are here!</p>
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
