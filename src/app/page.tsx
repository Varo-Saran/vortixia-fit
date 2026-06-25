"use client";

import { useEffect, useState } from "react";
import { Plus, UserCircle, Settings, Bell, Swords, HeartPulse, Flame, Check, Moon, Utensils, CloudRain, Sun, Cloud, Snowflake, CloudLightning, MapPin, Users, Activity } from "lucide-react";
import Link from "next/link";
import { useRoutineStore } from "@/store/useRoutineStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useFriendsStore } from "@/store/useFriendsStore";
import { useRecoveryStore } from "@/store/useRecoveryStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useWeather } from "@/hooks/useWeather";
import { supabase } from "@/lib/supabase";
import { useNotificationStore } from "@/store/useNotificationStore";
import { CelebrationModal } from "@/components/ui/CelebrationModal";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";

export default function Dashboard() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const router = useRouter();
  const [greeting, setGreeting] = useState("Hello");
  const [streakDays, setStreakDays] = useState<{ day: string; date: string; active: boolean; today: boolean; timestamp: number }[]>([]);
  
  const { weeklyPlan, fetchRoutine } = useRoutineStore();
  const { profile, fetchProfile } = useProfileStore();
  const { friends, fetchFriends } = useFriendsStore();
  const { readinessScore, cnsStatus, muscles } = useRecoveryStore();
  const { heroGender, setHeroGender } = useSettingsStore();
  const { isActive, startTime, routineName, startWorkout } = useWorkoutStore();
  const weather = useWeather();

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);
  
  const { unreadCount } = useNotificationStore();
  const [showCelebration, setShowCelebration] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  const [recommendedAthletes, setRecommendedAthletes] = useState<any[]>([]);
  
  // Hydration-safe Today Plan Name and Recovery Recommendations
  const [todayPlanName, setTodayPlanName] = useState("Loading plan...");
  const [fatiguedMuscleRecommendation, setFatiguedMuscleRecommendation] = useState("");

  // Active workout timer state
  const [elapsed, setElapsed] = useState("00:00");

  // Dynamic active duel & friend completions count
  const [activeDuelData, setActiveDuelData] = useState<any>(null);
  const [friendWorkoutsCount, setFriendWorkoutsCount] = useState(0);

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        const res = await fetch(`/api/search?q=&limit=5`);
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

  // Streak calculation and Today's plan name (Hydration-safe)
  useEffect(() => {
    // A. Generate Streak Days
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
    setStreakDays(days);

    // B. Calculate Today's plan name safely
    if (weeklyPlan.length > 0) {
      const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const todayName = daysOfWeek[new Date().getDay()];
      const todayPlan = weeklyPlan.find(p => p.day === todayName);
      setTodayPlanName(todayPlan?.type === 'Rest' ? 'Rest Day' : (todayPlan?.title || 'Start Workout'));
    }
  }, [weeklyPlan]);

  // Verify milestone banner claim state
  useEffect(() => {
    if (profile?.id && profile?.unclaimed_rewards && profile.unclaimed_rewards > 0) {
      const isClaimed = localStorage.getItem(`milestone_claimed_${profile.id}`) === 'true';
      if (!isClaimed) {
        setShowBanner(true);
      }
    }
  }, [profile]);

  // Streak Query
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

  // Active workout timer ticking
  useEffect(() => {
    if (!isActive || !startTime) return;
    const interval = setInterval(() => {
      const now = new Date();
      const diff = Math.floor((now.getTime() - new Date(startTime).getTime()) / 1000);
      const minutes = Math.floor(diff / 60).toString().padStart(2, '0');
      const seconds = (diff % 60).toString().padStart(2, '0');
      setElapsed(`${minutes}:${seconds}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [isActive, startTime]);

  // Fetch Recovery Recommendations
  useEffect(() => {
    if (muscles && muscles.length > 0) {
      const tiredMuscles = [...muscles]
        .filter(m => m.recoveryPercentage < 50)
        .sort((a, b) => a.recoveryPercentage - b.recoveryPercentage);
      if (tiredMuscles.length > 0) {
        setFatiguedMuscleRecommendation(`${tiredMuscles[0].name} is fatigued (${Math.round(tiredMuscles[0].recoveryPercentage)}%). Avoid training it today.`);
      } else if (readinessScore < 80) {
        setFatiguedMuscleRecommendation(`CNS is recovering (${Math.round(readinessScore)}%). Focus on light active recovery or rest.`);
      } else {
        setFatiguedMuscleRecommendation("All muscles recovered. Ready to crush your targets!");
      }
    }
  }, [muscles, readinessScore]);

  // Fetch Active Duel & Friend Activity
  useEffect(() => {
    const fetchSocialInfo = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Active Duel Info
        const { data: duels } = await supabase
          .from('duels')
          .select('*')
          .or(`challenger_id.eq.${user.id},opponent_id.eq.${user.id}`)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1);

        if (duels && duels.length > 0) {
          const duel = duels[0];
          const isChallenger = duel.challenger_id === user.id;
          const oppId = isChallenger ? duel.opponent_id : duel.challenger_id;

          const { data: opp } = await supabase.from('users').select('username').eq('id', oppId).single();
          const myScore = isChallenger ? (duel.user_1_score || 0) : (duel.user_2_score || 0);
          const oppScore = isChallenger ? (duel.user_2_score || 0) : (duel.user_1_score || 0);

          setActiveDuelData({
            opponent: opp?.username || 'Opponent',
            myScore,
            oppScore,
            status: myScore > oppScore ? 'winning' : myScore < oppScore ? 'losing' : 'tied',
            wager: duel.wager_xp
          });
        }

        // Friend Activity Today count
        const { data: friendships } = await supabase
          .from('user_friends')
          .select('user_id, friend_id')
          .eq('status', 'accepted')
          .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

        if (friendships && friendships.length > 0) {
          const friendIds = friendships.map(r => r.user_id === user.id ? r.friend_id : r.user_id);
          const todayStr = new Date().toLocaleDateString('en-CA');
          const { data: sessions } = await supabase
            .from('workout_sessions')
            .select('user_id')
            .in('user_id', friendIds)
            .gte('start_time', new Date(`${todayStr}T00:00:00`).toISOString());
          if (sessions) {
            setFriendWorkoutsCount(new Set(sessions.map(s => s.user_id)).size);
          }
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchSocialInfo();
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

  const handleClaimReward = async () => {
    if (!profile) return;
    setShowBanner(false);
    setShowCelebration(true);
    localStorage.setItem(`milestone_claimed_${profile.id}`, 'true');
    try {
      // Atoms updating via Supabase RPC
      await supabase.rpc('increment_user_xp', { user_id: profile.id, xp_to_add: 500 });
      fetchProfile(); // Refresh profile state to dynamically update level
    } catch (e) {
      console.error("Failed to claim milestone rewards:", e);
    }
  };

  const handleWorkoutTileClick = () => {
    if (isActive) {
      router.push("/workout");
      return;
    }

    const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const todayName = daysOfWeek[new Date().getDay()];
    const todayPlan = weeklyPlan.find(p => p.day === todayName);

    if (todayPlan && todayPlan.type !== 'Rest' && todayPlan.mainLifts && todayPlan.mainLifts.length > 0) {
      startWorkout(todayPlan.title, todayPlan.mainLifts);
      toast.success(`Started workout: ${todayPlan.title}`);
      router.push("/workout");
    } else {
      toast("Today is a Rest Day! Let's choose another workout or template.", {
        icon: 'ℹ️',
      });
      router.push("/routines");
    }
  };

  return (
    <main className="flex min-h-screen flex-col pb-28 bg-[#050505] relative overflow-x-hidden">
      
      {/* Massive Hero Background Image */}
      <div className="absolute top-0 left-0 w-full h-[55vh] z-0 pointer-events-none">
        <img 
          src={`/mockups/hero_${mounted ? heroGender : 'male'}.png`} 
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
        
        {/* Header Action shortcuts */}
        <div className="flex items-center gap-3 animate-fade-in-down" style={{ animationDelay: '0.1s' }}>
          <Link href="/notifications" aria-label="Notifications">
            <div className="relative w-11 h-11 rounded-full border border-white/15 bg-black/40 backdrop-blur-md flex items-center justify-center transition-all active:scale-95 shadow-lg">
              <Bell className="w-5 h-5 text-white" />
              {unreadCount > 0 && (
                <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.8)] border border-black" />
              )}
            </div>
          </Link>
          
          <Link href="/profile" aria-label="Profile">
            <div className="w-11 h-11 rounded-full border border-white/15 bg-black/40 backdrop-blur-md flex items-center justify-center overflow-hidden transition-all active:scale-95 shadow-lg">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <UserCircle className="w-6 h-6 text-white/70" />
              )}
            </div>
          </Link>

          <Link href="/settings" aria-label="Settings">
            <div className="w-9 h-9 rounded-full border border-white/10 bg-black/20 backdrop-blur-md flex items-center justify-center transition-all active:scale-95 shadow-lg text-text-muted hover:text-white">
              <Settings className="w-4 h-4" />
            </div>
          </Link>
        </div>
      </header>

      {/* Level Progress Card */}
      {profile && (
        <div className="relative z-10 w-full px-6 mt-4 flex flex-col gap-1.5 animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
          <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-wider text-text-muted">
            <span className="text-accent-green">Level {Math.floor((profile.total_xp || 0) / 2000) + 1}</span>
            <span>{(profile.total_xp || 0) % 2000} / 2000 XP</span>
          </div>
          <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden border border-white/5 shadow-inner">
            <div 
              className="h-full bg-gradient-to-r from-accent-green to-emerald-400 shadow-[0_0_10px_rgba(74,222,128,0.5)] rounded-full transition-all duration-500" 
              style={{ width: `${Math.min(100, Math.round(((profile.total_xp || 0) % 2000) / 2000 * 100))}%` }}
            />
          </div>
        </div>
      )}

      {/* Floating Weekly Streak Panel (Row 2) */}
      <section className="relative z-10 w-full px-4 mt-[8vh] mb-6 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
        <h2 className="text-white text-xs font-bold mb-3 pl-2 opacity-90 drop-shadow-md">My Activity</h2>
        <div className="w-full bg-white/5 backdrop-blur-xl border border-white/10 p-4 rounded-[2rem] flex justify-between items-center shadow-2xl">
           {streakDays.length === 0 ? (
             <div className="w-full text-center py-2 text-xs text-text-muted italic">Loading streak...</div>
           ) : (
             streakDays.map((d, i) => (
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
             ))
           )}
        </div>
      </section>

      {/* Active Workout Resume Banner */}
      {mounted && isActive && (
        <div className="relative z-10 w-[calc(100%-2rem)] mx-auto mb-6 p-4 rounded-2xl bg-gradient-to-r from-accent-red/20 to-red-500/10 border border-accent-red/30 shadow-[0_0_20px_rgba(255,59,48,0.15)] animate-pulse">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-accent-red/20 rounded-full flex items-center justify-center">
                <Activity className="w-5 h-5 text-accent-red animate-pulse" />
              </div>
              <div className="flex flex-col">
                <h3 className="text-white font-black text-sm uppercase tracking-wider">Workout In Progress</h3>
                <span className="text-text-muted text-[10px] font-bold uppercase">{routineName}</span>
                <span className="text-accent-red text-xs font-mono font-bold mt-0.5">Elapsed: {elapsed}</span>
              </div>
            </div>
            <Link href="/workout">
              <button className="bg-accent-red text-white text-xs font-black uppercase tracking-widest px-4 py-2 rounded-lg hover:bg-red-600 transition-colors shadow-lg active:scale-95 transition-transform">
                Resume
              </button>
            </Link>
          </div>
        </div>
      )}

      {showBanner && (
        <div 
          onClick={handleClaimReward}
          className="relative z-10 w-[calc(100%-2rem)] mx-auto mb-6 p-4 rounded-2xl bg-gradient-to-r from-accent-green to-emerald-400 cursor-pointer shadow-[0_0_30px_rgba(74,222,128,0.4)] active:scale-95 transition-transform animate-fade-in-up"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-black/20 rounded-full flex items-center justify-center">
                <span className="text-xl">🎁</span>
              </div>
              <div>
                <h3 className="text-black font-black text-sm uppercase tracking-wider">Milestone Achieved!</h3>
                <p className="text-black/80 text-xs font-bold">Tap to claim your 500 XP reward</p>
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
      <section className="relative z-10 w-full px-4 grid grid-cols-2 gap-3 auto-rows-[minmax(115px,auto)] animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
        
        {/* 1. Start/Resume Workout (Tall) */}
        <button 
          onClick={handleWorkoutTileClick}
          className={`col-span-1 row-span-2 relative p-5 rounded-[2rem] overflow-hidden flex flex-col justify-between group border shadow-2xl active:scale-95 transition-transform text-left w-full ${
            mounted && isActive 
              ? 'bg-[#1a0f0f] border-accent-red/30 shadow-[0_0_20px_rgba(255,59,48,0.1)]' 
              : 'bg-[#111] border-white/5'
          }`}
        >
          <div className={`absolute inset-0 bg-gradient-to-b opacity-50 ${mounted && isActive ? 'from-accent-red/20' : 'from-accent-green/20'} to-transparent`} />
          <div className={`absolute -top-10 -right-10 w-32 h-32 blur-3xl rounded-full ${mounted && isActive ? 'bg-accent-red/30' : 'bg-accent-green/30'}`} />
          
          <div className="z-10">
             <h2 className="text-white font-black text-lg leading-tight">
               {mounted && isActive ? "Workout Active" : todayPlanName}
             </h2>
             <p className="text-text-muted text-[9px] mt-1 font-bold uppercase tracking-widest">
               {mounted && isActive ? `Elapsed: ${elapsed}` : "Today's Plan"}
             </p>
          </div>
          
          <div className="z-10 mt-auto">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-transform group-hover:scale-110 shadow-lg ${
              mounted && isActive ? 'bg-accent-red text-white' : 'bg-accent-green text-black'
            }`}>
              {mounted && isActive ? <Activity className="w-5 h-5 animate-pulse" /> : <Plus className="w-6 h-6 stroke-[3px]" />}
            </div>
          </div>
        </button>

        {/* 2. CNS Readiness */}
        <Link href="/recovery" className="col-span-1 row-span-1 relative p-4 rounded-[2rem] bg-[#1a0f0f] border border-red-500/10 overflow-hidden flex flex-col justify-between group active:scale-95 transition-all">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 bg-red-500/30 blur-2xl rounded-full pointer-events-none" />
          <div className="flex items-center justify-between z-10">
            <span className="text-white text-xs font-bold opacity-80">Readiness</span>
            <HeartPulse className="w-4 h-4 text-red-500" />
          </div>
          <div className="z-10">
            <div className="text-3xl font-black text-white">{mounted ? (readinessScore ?? 100) : 100}<span className="text-sm">%</span></div>
            <p className={`text-[10px] font-bold uppercase mt-0.5 ${
              mounted && readinessScore ? (readinessScore >= 80 ? 'text-accent-green' : readinessScore >= 50 ? 'text-yellow-500' : 'text-accent-red') : 'text-accent-green'
            }`}>
              {mounted ? (cnsStatus || "Fresh CNS") : "Fresh CNS"}
            </p>
            <div className="text-[7px] text-text-muted leading-tight font-bold mt-1 line-clamp-2">
              {mounted ? fatiguedMuscleRecommendation : "All muscles recovered. Ready to crush your targets!"}
            </div>
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
        <Link href="/social" className="col-span-1 row-span-1 relative p-4 rounded-[2rem] bg-[#140a1a] border border-purple-500/10 overflow-hidden flex flex-col justify-between group active:scale-95 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/20 blur-2xl rounded-full pointer-events-none" />
          <div className="flex items-center justify-between z-10">
            <span className="text-white text-xs font-bold opacity-80">Active Duel</span>
            <Swords className="w-4 h-4 text-purple-400" />
          </div>
          <div className="z-10 flex flex-col gap-0.5">
            {activeDuelData ? (
              <>
                <div className="text-lg font-black text-white truncate">vs @{activeDuelData.opponent}</div>
                <p className="text-purple-400 text-[10px] font-black uppercase flex items-center gap-1">
                  {activeDuelData.status === 'winning' ? '🥇 winning' : activeDuelData.status === 'losing' ? '🥈 losing' : '🤝 tied'}
                </p>
                <span className="text-[8px] text-text-muted font-mono">{activeDuelData.myScore} vs {activeDuelData.oppScore} XP</span>
              </>
            ) : (
              <>
                <div className="text-2xl font-black text-white">No Duel</div>
                <p className="text-purple-400 text-[10px] font-bold uppercase mt-1">Challenge now</p>
              </>
            )}
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

          <div className="z-10 mt-3 flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-text-muted font-bold uppercase tracking-widest min-w-max">Recommended:</span>
              <div className="flex -space-x-2">
                 {recommendedAthletes.slice(0, 5).map((user, i) => (
                    <img key={user.id} src={user.avatar_url || "https://i.pravatar.cc/150"} alt="avatar" className="w-7 h-7 rounded-full border-2 border-[#0c121e] relative object-cover shadow-lg" style={{ zIndex: 5 - i }} />
                  ))}
                  {recommendedAthletes.length > 5 && (
                    <div className="w-7 h-7 rounded-full border-2 border-[#0c121e] bg-blue-500/20 text-blue-400 flex items-center justify-center relative z-0 shadow-lg">
                      <span className="text-[9px] font-black">+{recommendedAthletes.length - 5}</span>
                    </div>
                  )}
                  {recommendedAthletes.length === 0 && (
                    <div className="text-[9px] text-text-muted font-bold italic ml-2">Loading...</div>
                  )}
              </div>
            </div>
            
            {friendWorkoutsCount > 0 ? (
              <span className="text-[9px] bg-accent-green/20 text-accent-green px-2 py-1 rounded-md font-black uppercase tracking-widest animate-pulse border border-accent-green/20">
                🔥 {friendWorkoutsCount} friends done!
              </span>
            ) : (
              <span className="text-[9px] text-text-muted font-bold uppercase tracking-wider">No completions today</span>
            )}
          </div>
        </Link>

        {/* 7. Keep it up Trophy (Wide Rectangle) */}
        <Link href="/profile" className="col-span-2 row-span-1 p-5 rounded-[2rem] bg-gradient-to-r from-[#111] to-[#1a1710] border border-yellow-500/10 flex items-center relative overflow-hidden active:scale-95 transition-transform">
           <div className="absolute right-[-20px] top-1/2 -translate-y-1/2 w-32 h-32 pointer-events-none opacity-90">
              <img src="/mockups/trophy.png" alt="Trophy" className="w-full h-full object-contain drop-shadow-2xl" />
           </div>
           <div className="z-10 w-2/3">
              <h3 className="text-white font-black text-xl leading-tight">Keep it up!</h3>
              <p className="text-text-muted text-[10px] mt-1 font-bold">You're building momentum!</p>
           </div>
        </Link>

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
