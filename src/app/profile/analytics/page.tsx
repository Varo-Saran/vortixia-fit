"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, BarChart3, TrendingUp, Activity, Target } from "lucide-react";
import Link from "next/link";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  PieChart, Pie, Cell
} from "recharts";
import { supabase } from '@/lib/supabase';

const COLORS = ['#2EEA82', '#1a1a1a'];

export default function AnalyticsPage() {
  const [volumeData, setVolumeData] = useState<{ date: string; volume: number }[]>([]);
  const [muscleData, setMuscleData] = useState<{ subject: string; A: number; fullMark: number }[]>([]);
  const [disciplineScore, setDisciplineScore] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setIsLoading(false);
          return;
        }
        
        const userId = session.user.id;
        
        // --- 1. Fetch Volume Over Time (last 30 days) ---
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const { data: sessions } = await supabase
          .from('workout_sessions')
          .select('id, start_time, total_volume_kg')
          .eq('user_id', userId)
          .gte('start_time', thirtyDaysAgo.toISOString())
          .order('start_time', { ascending: true });

        const recentSessionIds = sessions ? sessions.map(s => s.id) : [];

        if (sessions && sessions.length > 0) {
          const volumeByDate = sessions.reduce((acc, curr) => {
            const date = new Date(curr.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            acc[date] = (acc[date] || 0) + (curr.total_volume_kg || 0);
            return acc;
          }, {} as Record<string, number>);
          
          setVolumeData(Object.keys(volumeByDate).map(date => ({
            date,
            volume: volumeByDate[date]
          })));
        }

        // --- 2. Fetch Muscle Distribution (using sets from last 30 days) ---
        const { data: setsData } = recentSessionIds.length > 0 
          ? await supabase
              .from('workout_sets')
              .select('exercise_name, session_id, weight, reps')
              .in('session_id', recentSessionIds)
          : { data: [] };
          
        const { data: exercisesData } = await supabase
          .from('exercises')
          .select('name, muscle_group');

        if (setsData && exercisesData) {
          const muscleGroups: Record<string, number> = {};
          
          setsData.forEach(setRow => {
            const exercise = exercisesData.find(e => e.name === setRow.exercise_name);
            if (exercise && exercise.muscle_group) {
              const group = exercise.muscle_group;
              const volume = (setRow.weight || 0) * (setRow.reps || 0);
              muscleGroups[group] = (muscleGroups[group] || 0) + volume;
            }
          });
          
          // Fallback if no sets have weight (e.g., bodyweight only reps)
          if (Object.keys(muscleGroups).length === 0) {
             setsData.forEach(setRow => {
              const exercise = exercisesData.find(e => e.name === setRow.exercise_name);
              if (exercise && exercise.muscle_group) {
                const group = exercise.muscle_group;
                muscleGroups[group] = (muscleGroups[group] || 0) + (setRow.reps || 1);
              }
            });
          }
          
          const maxVol = Math.max(...Object.values(muscleGroups), 1);
          
          setMuscleData(Object.entries(muscleGroups).map(([subject, val]) => ({
            subject: subject.charAt(0).toUpperCase() + subject.slice(1),
            A: val,
            fullMark: maxVol
          })));
        }

        // --- 3. Weighted Rolling Discipline Score ---
        if (sessions && sessions.length > 0) {
           const now = new Date();
           const sevenDaysAgo = new Date();
           sevenDaysAgo.setDate(now.getDate() - 7);
           
           let completedSets7d = 0;
           let plannedSets7d = 0;
           let completedSets30d = 0;
           let plannedSets30d = 0;

           const setsPerSession = setsData?.reduce((acc, set) => {
             acc[set.session_id] = (acc[set.session_id] || 0) + 1;
             return acc;
           }, {} as Record<string, number>) || {};

           sessions.forEach(sess => {
             const sessionDate = new Date(sess.start_time);
             const setsDone = setsPerSession[sess.id] || 0;
             // If DB doesn't track planned sets, use max of (setsDone, 15) to emulate a realistic target
             const setsPlanned = (sess as any).planned_sets || Math.max(setsDone, 15); 
             
             completedSets30d += setsDone;
             plannedSets30d += setsPlanned;
             
             if (sessionDate >= sevenDaysAgo) {
               completedSets7d += setsDone;
               plannedSets7d += setsPlanned;
             }
           });
           
           const earliestSessionDate = new Date(sessions[0].start_time);
           const daysOfHistory = Math.floor((now.getTime() - earliestSessionDate.getTime()) / (1000 * 60 * 60 * 24));
           
           let score = 0;
           if (daysOfHistory < 7) {
             score = 100;
           } else {
             const rate7d = plannedSets7d > 0 ? (completedSets7d / plannedSets7d) : 0;
             const rate30d = plannedSets30d > 0 ? (completedSets30d / plannedSets30d) : 0;
             score = (0.6 * rate7d + 0.4 * rate30d) * 100;
           }
           
           // Active streak bonus: +2% for each consecutive day they hit their planned workout
           let streak = 0;
           const sessionDates = new Set(sessions.map(s => new Date(s.start_time).toDateString()));
           
           for (let i = 0; i < 30; i++) {
             const checkDate = new Date();
             checkDate.setDate(now.getDate() - i);
             if (sessionDates.has(checkDate.toDateString())) {
               streak++;
             } else if (i > 0) {
               break; 
             }
           }
           
           // If they haven't worked out today, check if their streak is still alive starting yesterday
           if (streak === 0) {
             for (let i = 1; i < 30; i++) {
               const checkDate = new Date();
               checkDate.setDate(now.getDate() - i);
               if (sessionDates.has(checkDate.toDateString())) {
                 streak++;
               } else {
                 break;
               }
             }
           }
           
           score += (streak * 2);
           setDisciplineScore(Math.min(Math.round(score), 100));
        } else {
           setDisciplineScore(0); // 0% if no workouts logged in the last 30 days
        }

      } catch (error) {
        console.error("Error fetching analytics data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  const consistencyData = [
    { name: 'Completed', value: disciplineScore },
    { name: 'Missed', value: 100 - disciplineScore }
  ];

  return (
    <main className="flex min-h-screen flex-col pt-[calc(var(--notch-top)+1rem)] pb-28 px-4 bg-[#050505] relative overflow-x-hidden">
      
      {/* Header */}
      <header className="w-full flex items-center mb-8 relative z-10 animate-fade-in-down">
        <Link href="/profile" className="absolute left-0 p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors" aria-label="Go back">
          <ChevronLeft className="w-6 h-6 text-white" />
        </Link>
        <div className="w-full flex justify-center">
          <div className="flex items-center gap-2 px-4 py-1.5 bg-orange-500/10 border border-orange-500/20 rounded-full">
            <BarChart3 className="w-4 h-4 text-orange-400" />
            <h1 className="text-xs font-black tracking-widest text-orange-400 uppercase">Analytics</h1>
          </div>
        </div>
      </header>

      {isLoading ? (
        <div className="w-full h-64 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-orange-500"></div>
        </div>
      ) : (
        <>
          {/* Discipline / Consistency Radial Chart */}
          <section className="mb-6 animate-fade-in-up">
            <div className="glass-card p-6 border-white/5 rounded-[2rem] flex flex-col items-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-accent-green/10 blur-3xl rounded-full" />
              
              <div className="flex items-center gap-2 mb-2 w-full">
                <Target className="w-5 h-5 text-accent-green" />
                <h2 className="text-white font-bold">Discipline Score</h2>
              </div>
              <p className="text-xs text-text-muted w-full mb-6">Weighted rolling completion rate.</p>

              <div className="relative w-48 h-48 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={consistencyData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      startAngle={90}
                      endAngle={-270}
                      dataKey="value"
                      stroke="none"
                    >
                      {consistencyData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-black text-white">{disciplineScore}<span className="text-xl text-accent-green">%</span></span>
                  <span className="text-[10px] text-text-muted font-bold tracking-widest uppercase mt-1">
                    {disciplineScore >= 90 ? 'Excellent' : disciplineScore >= 70 ? 'Good' : 'Needs Work'}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Volume Over Time Area Chart */}
          <section className="mb-6 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            <div className="glass-card p-6 border-white/5 rounded-[2rem] flex flex-col">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-blue-400" />
                <h2 className="text-white font-bold">Volume Over Time</h2>
              </div>
              <p className="text-xs text-text-muted mb-6">Total weight lifted per session (kg).</p>

              <div className="h-64 w-full">
                {volumeData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={volumeData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#60A5FA" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#60A5FA" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="date" stroke="rgba(255,255,255,0.2)" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="rgba(255,255,255,0.2)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value} />
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: '#111', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}
                        itemStyle={{ color: '#60A5FA', fontWeight: 'bold' }}
                      />
                      <Area type="monotone" dataKey="volume" stroke="#60A5FA" strokeWidth={3} fillOpacity={1} fill="url(#colorVolume)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-text-muted text-sm">
                    No volume data for the last 30 days.
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Muscle Usage Radar Chart */}
          <section className="mb-6 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <div className="glass-card p-6 border-white/5 rounded-[2rem] flex flex-col items-center">
              <div className="flex items-center gap-2 mb-2 w-full">
                <Activity className="w-5 h-5 text-orange-500" />
                <h2 className="text-white font-bold">Muscle Distribution</h2>
              </div>
              <p className="text-xs text-text-muted w-full mb-2">Relative volume distribution across muscle groups.</p>

              <div className="h-64 w-full flex justify-center items-center">
                {muscleData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={muscleData}>
                      <PolarGrid stroke="rgba(255,255,255,0.1)" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 'bold' }} />
                      <PolarRadiusAxis angle={30} domain={[0, 'dataMax']} tick={false} axisLine={false} />
                      <Radar name="Usage" dataKey="A" stroke="#F97316" strokeWidth={2} fill="#F97316" fillOpacity={0.4} />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-text-muted text-sm">
                    No muscle data found.
                  </div>
                )}
              </div>
            </div>
          </section>
        </>
      )}

    </main>
  );
}
