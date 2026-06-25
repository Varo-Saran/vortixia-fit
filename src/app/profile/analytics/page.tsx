"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, BarChart3, TrendingUp, Activity, Target, Dumbbell, Scale, Clock, Calendar } from "lucide-react";
import Link from "next/link";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line
} from "recharts";
import { supabase } from '@/lib/supabase';

const COLORS = ['#2EEA82', '#1a1a1a'];

export default function AnalyticsPage() {
  const [volumeData, setVolumeData] = useState<{ date: string; volume: number }[]>([]);
  const [muscleData, setMuscleData] = useState<{ subject: string; A: number; fullMark: number }[]>([]);
  const [disciplineScore, setDisciplineScore] = useState<number>(0);
  
  // Advanced Analytics States
  const [metricsHistory, setMetricsHistory] = useState<{ date: string; weight: number; bodyFat: number | null }[]>([]);
  const [weightDelta, setWeightDelta] = useState<number | null>(null);
  const [bfDelta, setBfDelta] = useState<number | null>(null);
  const [activityDays, setActivityDays] = useState<string[]>([]);
  const [availableExercises, setAvailableExercises] = useState<string[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<string>("");
  const [strengthData, setStrengthData] = useState<{ date: string; oneRm: number }[]>([]);
  const [durationData, setDurationData] = useState<{ date: string; duration: number }[]>([]);
  const [metricsTab, setMetricsTab] = useState<"weight" | "bodyfat">("weight");
  
  const [allSets, setAllSets] = useState<any[]>([]);
  const [allSessions, setAllSessions] = useState<any[]>([]);
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
        
        // --- 1. Fetch Workout Sessions (all history) ---
        const { data: sessions, error: sessionsErr } = await supabase
          .from('workout_sessions')
          .select('id, start_time, end_time, total_volume_kg')
          .eq('user_id', userId)
          .order('start_time', { ascending: true });

        if (sessionsErr) throw sessionsErr;
        setAllSessions(sessions || []);

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const recentSessions = (sessions || []).filter(s => new Date(s.start_time) >= thirtyDaysAgo);
        const recentSessionIds = recentSessions.map(s => s.id);

        // --- 2. Process Volume Over Time (last 30 days) ---
        if (recentSessions.length > 0) {
          const volumeByDate = recentSessions.reduce((acc, curr) => {
            const date = new Date(curr.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            acc[date] = (acc[date] || 0) + (curr.total_volume_kg || 0);
            return acc;
          }, {} as Record<string, number>);
          
          setVolumeData(Object.keys(volumeByDate).map(date => ({
            date,
            volume: volumeByDate[date]
          })));
        }

        // --- 3. Process Workout Durations & Activity Calendar ---
        if (sessions && sessions.length > 0) {
          const durData = sessions.map(sess => {
            const start = new Date(sess.start_time).getTime();
            const end = sess.end_time ? new Date(sess.end_time).getTime() : start;
            const durationMin = Math.round((end - start) / 60000);
            return {
              date: new Date(sess.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
              duration: durationMin > 0 ? durationMin : 45
            };
          });
          setDurationData(durData);

          const actDays = sessions.map(s => new Date(s.start_time).toDateString());
          setActivityDays(actDays);
        }

        // --- 4. Fetch Muscle Distribution (using sets from last 30 days) ---
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
          
          // Fallback if no sets have weight
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

        // --- 5. Fetch All Sets for Strength Progression (1RM) ---
        const { data: allSetsData } = await supabase
          .from('workout_sets')
          .select('exercise_name, session_id, weight, reps');
        setAllSets(allSetsData || []);

        if (allSetsData && allSetsData.length > 0) {
          const exercisesList = Array.from(new Set(allSetsData.map(s => s.exercise_name)));
          setAvailableExercises(exercisesList);
          if (exercisesList.length > 0) {
            setSelectedExercise(exercisesList[0]);
          }
        }

        // --- 6. Fetch Body Metrics History & Current Metrics ---
        const { data: metricsLog } = await supabase
          .from('body_metrics_log')
          .select('weight_kg, body_fat_pct, logged_at')
          .eq('user_id', userId)
          .order('logged_at', { ascending: true });

        const { data: currentMetrics } = await supabase
          .from('user_metrics')
          .select('weight_kg, body_fat_pct')
          .eq('id', userId)
          .maybeSingle();

        if (metricsLog && metricsLog.length > 0) {
          const formattedHistory = metricsLog.map(log => ({
            date: new Date(log.logged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            weight: parseFloat(log.weight_kg),
            bodyFat: log.body_fat_pct ? parseFloat(log.body_fat_pct) : null
          }));
          setMetricsHistory(formattedHistory);

          const currentWeight = parseFloat(metricsLog[metricsLog.length - 1].weight_kg);
          const firstWeight = parseFloat(metricsLog[0].weight_kg);
          setWeightDelta(currentWeight - firstWeight);

          const currentBf = metricsLog[metricsLog.length - 1].body_fat_pct ? parseFloat(metricsLog[metricsLog.length - 1].body_fat_pct) : null;
          const firstBf = metricsLog[0].body_fat_pct ? parseFloat(metricsLog[0].body_fat_pct) : null;
          if (currentBf !== null && firstBf !== null) {
            setBfDelta(currentBf - firstBf);
          }
        } else if (currentMetrics) {
          // If no logs exist, seed with current metrics
          const initialLog = {
            date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            weight: parseFloat(currentMetrics.weight_kg),
            bodyFat: currentMetrics.body_fat_pct ? parseFloat(currentMetrics.body_fat_pct) : null
          };
          setMetricsHistory([initialLog]);
          setWeightDelta(0);
          setBfDelta(currentMetrics.body_fat_pct ? 0 : null);
        }

        // --- 7. Weighted Rolling Discipline Score ---
        if (recentSessions.length > 0) {
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

           recentSessions.forEach(sess => {
             const sessionDate = new Date(sess.start_time);
             const setsDone = setsPerSession[sess.id] || 0;
             const setsPlanned = (sess as any).planned_sets || Math.max(setsDone, 15); 
             
             completedSets30d += setsDone;
             plannedSets30d += setsPlanned;
             
             if (sessionDate >= sevenDaysAgo) {
               completedSets7d += setsDone;
               plannedSets7d += setsPlanned;
             }
           });
           
           const earliestSessionDate = new Date(recentSessions[0].start_time);
           const daysOfHistory = Math.floor((now.getTime() - earliestSessionDate.getTime()) / (1000 * 60 * 60 * 24));
           
           let score = 0;
           if (daysOfHistory < 7) {
             score = 100;
           } else {
             const rate7d = plannedSets7d > 0 ? (completedSets7d / plannedSets7d) : 0;
             const rate30d = plannedSets30d > 0 ? (completedSets30d / plannedSets30d) : 0;
             score = (0.6 * rate7d + 0.4 * rate30d) * 100;
           }
           
           let streak = 0;
           const sessionDates = new Set(recentSessions.map(s => new Date(s.start_time).toDateString()));
           
           for (let i = 0; i < 30; i++) {
             const checkDate = new Date();
             checkDate.setDate(now.getDate() - i);
             if (sessionDates.has(checkDate.toDateString())) {
               streak++;
             } else if (i > 0) {
               break; 
             }
           }
           
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
           setDisciplineScore(0);
        }

      } catch (error) {
        console.error("Error fetching analytics data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  // --- Dynamic Strength Progression (1RM) Logic ---
  useEffect(() => {
    if (!selectedExercise || allSets.length === 0 || allSessions.length === 0) return;

    const exerciseSets = allSets.filter(s => s.exercise_name === selectedExercise);

    const sessionMap = allSessions.reduce((acc, curr) => {
      acc[curr.id] = curr.start_time;
      return acc;
    }, {} as Record<string, string>);

    const oneRmByDate: Record<string, number> = {};
    exerciseSets.forEach(setRow => {
      const sessionDate = sessionMap[setRow.session_id];
      if (sessionDate) {
        const dateStr = new Date(sessionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const weightVal = parseFloat(setRow.weight || 0);
        const repsVal = parseInt(setRow.reps || 0);
        
        // Epley formula: 1RM = w * (1 + r/30)
        const oneRm = repsVal === 1 ? weightVal : weightVal * (1 + repsVal / 30);
        
        if (oneRm > 0) {
          oneRmByDate[dateStr] = Math.max(oneRmByDate[dateStr] || 0, Math.round(oneRm));
        }
      }
    });

    const sortedData = Object.keys(oneRmByDate)
      .map(date => ({
        date,
        oneRm: oneRmByDate[date]
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    setStrengthData(sortedData);
  }, [selectedExercise, allSets, allSessions]);

  const consistencyData = [
    { name: 'Completed', value: disciplineScore },
    { name: 'Missed', value: 100 - disciplineScore }
  ];

  // Helper to construct last 30 calendar days for activity heatmap
  const getLast30Days = () => {
    const dates = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      dates.push(d);
    }
    return dates;
  };

  return (
    <main className="flex min-h-screen flex-col pt-[calc(var(--notch-top)+1rem)] pb-28 px-4 bg-[#050505] relative overflow-x-hidden text-white">
      
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
          {/* Section 1: Body Metrics Deltas & History Charts */}
          <section className="mb-6 animate-fade-in-up">
            <div className="glass-card p-6 border-white/5 rounded-[2rem] flex flex-col relative overflow-hidden bg-white/3">
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 blur-3xl rounded-full" />
              
              <div className="flex items-center gap-2 mb-4 w-full">
                <Scale className="w-5 h-5 text-orange-400" />
                <h2 className="text-white font-bold">Body Composition Trends</h2>
              </div>

              {/* Metric Summary Cards */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-black/40 border border-white/5 rounded-2xl p-4 flex flex-col">
                  <span className="text-[9px] uppercase tracking-wider text-text-muted font-bold">Weight Progress</span>
                  <span className="text-xl font-black text-white mt-1">
                    {metricsHistory.length > 0 ? `${metricsHistory[metricsHistory.length - 1].weight} kg` : "N/A"}
                  </span>
                  {weightDelta !== null && (
                    <span className={`text-[10px] font-extrabold mt-1 flex items-center gap-0.5 ${weightDelta <= 0 ? "text-accent-green" : "text-orange-400"}`}>
                      {weightDelta === 0 ? "No change" : `${weightDelta > 0 ? "+" : ""}${weightDelta.toFixed(1)} kg`}
                    </span>
                  )}
                </div>
                <div className="bg-black/40 border border-white/5 rounded-2xl p-4 flex flex-col">
                  <span className="text-[9px] uppercase tracking-wider text-text-muted font-bold">Body Fat Progress</span>
                  <span className="text-xl font-black text-white mt-1">
                    {metricsHistory.length > 0 && metricsHistory[metricsHistory.length - 1].bodyFat !== null 
                      ? `${metricsHistory[metricsHistory.length - 1].bodyFat}%` 
                      : "N/A"}
                  </span>
                  {bfDelta !== null && (
                    <span className={`text-[10px] font-extrabold mt-1 flex items-center gap-0.5 ${bfDelta <= 0 ? "text-accent-green" : "text-orange-400"}`}>
                      {bfDelta === 0 ? "No change" : `${bfDelta > 0 ? "+" : ""}${bfDelta.toFixed(1)}%`}
                    </span>
                  )}
                </div>
              </div>

              {/* Toggle Switch */}
              <div className="flex gap-1.5 bg-black/50 p-1.5 rounded-xl border border-white/5 mb-4">
                <button
                  type="button"
                  onClick={() => setMetricsTab("weight")}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                    metricsTab === "weight" ? "bg-white text-black" : "text-white/60 hover:text-white"
                  }`}
                >
                  Weight Trend
                </button>
                <button
                  type="button"
                  onClick={() => setMetricsTab("bodyfat")}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                    metricsTab === "bodyfat" ? "bg-white text-black" : "text-white/60 hover:text-white"
                  }`}
                >
                  Body Fat % Trend
                </button>
              </div>

              {/* Chart Render */}
              <div className="h-48 w-full mt-2">
                {metricsHistory.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={metricsHistory} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorMetric" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={metricsTab === "weight" ? "#F97316" : "#2EEA82"} stopOpacity={0.4}/>
                          <stop offset="95%" stopColor={metricsTab === "weight" ? "#F97316" : "#2EEA82"} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="date" stroke="rgba(255,255,255,0.2)" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis 
                        stroke="rgba(255,255,255,0.2)" 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false}
                        domain={['dataMin - 2', 'dataMax + 2']}
                        tickFormatter={(v) => metricsTab === "weight" ? `${v}k` : `${v}%`}
                      />
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: '#111', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}
                        itemStyle={{ color: metricsTab === "weight" ? '#F97316' : '#2EEA82', fontWeight: 'bold' }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey={metricsTab === "weight" ? "weight" : "bodyFat"} 
                        stroke={metricsTab === "weight" ? "#F97316" : "#2EEA82"} 
                        strokeWidth={2.5} 
                        fillOpacity={1} 
                        fill="url(#colorMetric)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-text-muted text-xs">
                    No metrics logs recorded yet.
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Section 2: Consistency, Streak & Activity Heatmap */}
          <section className="mb-6 animate-fade-in-up" style={{ animationDelay: '0.05s' }}>
            <div className="glass-card p-6 border-white/5 rounded-[2rem] flex flex-col bg-white/3">
              <div className="flex items-center gap-2 mb-2 w-full">
                <Calendar className="w-5 h-5 text-accent-green" />
                <h2 className="text-white font-bold">Activity Grid</h2>
              </div>
              <p className="text-xs text-text-muted mb-4">Your workout logs over the last 30 days.</p>

              {/* Grid of days */}
              <div className="grid grid-cols-10 gap-2 p-3 bg-black/40 border border-white/5 rounded-2xl">
                {getLast30Days().map((date, idx) => {
                  const isCompleted = activityDays.includes(date.toDateString());
                  return (
                    <div
                      key={idx}
                      title={date.toLocaleDateString()}
                      className={`aspect-square rounded-lg flex flex-col items-center justify-center text-[10px] font-black transition-all ${
                        isCompleted 
                          ? 'bg-accent-green text-black shadow-[0_0_8px_rgba(74,222,128,0.3)]'
                          : 'bg-white/5 text-white/30 border border-white/5'
                      }`}
                    >
                      {date.getDate()}
                    </div>
                  );
                })}
              </div>

              {/* Heatmap Legend */}
              <div className="flex items-center gap-3 mt-3 ml-1 text-[10px] text-text-muted">
                <div className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded bg-white/5 border border-white/5" />
                  <span>Rest Day</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded bg-accent-green" />
                  <span>Logged Workout</span>
                </div>
              </div>
            </div>
          </section>

          {/* Section 3: Strength Progression Hub (1RM) */}
          <section className="mb-6 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            <div className="glass-card p-6 border-white/5 rounded-[2rem] flex flex-col bg-white/3">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Dumbbell className="w-5 h-5 text-blue-400" />
                  <h2 className="text-white font-bold">Strength Progression</h2>
                </div>
                
                {availableExercises.length > 0 && (
                  <select
                    value={selectedExercise}
                    onChange={(e) => setSelectedExercise(e.target.value)}
                    className="bg-black/50 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-blue-400 transition-colors"
                  >
                    {availableExercises.map(ex => (
                      <option key={ex} value={ex}>{ex}</option>
                    ))}
                  </select>
                )}
              </div>
              <p className="text-xs text-text-muted mb-4">Estimated 1-Rep Max progress over time (kg).</p>

              <div className="h-56 w-full">
                {strengthData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={strengthData} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="date" stroke="rgba(255,255,255,0.2)" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="rgba(255,255,255,0.2)" fontSize={10} tickLine={false} axisLine={false} domain={['dataMin - 5', 'dataMax + 5']} />
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: '#111', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}
                        itemStyle={{ color: '#60A5FA', fontWeight: 'bold' }}
                      />
                      <Line type="monotone" dataKey="oneRm" stroke="#60A5FA" strokeWidth={3} dot={{ r: 4, stroke: '#60A5FA', strokeWidth: 1, fill: '#050505' }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-text-muted text-xs">
                    Select an exercise above to begin plotting progress.
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Section 4: Discipline & Volume Over Time */}
          <section className="mb-6 animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
            <div className="glass-card p-6 border-white/5 rounded-[2rem] flex flex-col items-center relative overflow-hidden bg-white/3">
              <div className="absolute top-0 right-0 w-32 h-32 bg-accent-green/10 blur-3xl rounded-full" />
              
              <div className="flex items-center gap-2 mb-2 w-full">
                <Target className="w-5 h-5 text-accent-green" />
                <h2 className="text-white font-bold">Discipline Score</h2>
              </div>
              <p className="text-xs text-text-muted w-full mb-6">Weighted rolling completion rate.</p>

              <div className="relative w-44 h-44 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={consistencyData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={70}
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
                  <span className="text-3xl font-black text-white">{disciplineScore}<span className="text-lg text-accent-green">%</span></span>
                  <span className="text-[9px] text-text-muted font-bold tracking-widest uppercase mt-1">
                    {disciplineScore >= 90 ? 'Excellent' : disciplineScore >= 70 ? 'Good' : 'Needs Work'}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Volume Over Time Area Chart */}
          <section className="mb-6 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <div className="glass-card p-6 border-white/5 rounded-[2rem] flex flex-col bg-white/3">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-blue-400" />
                <h2 className="text-white font-bold">Volume Over Time</h2>
              </div>
              <p className="text-xs text-text-muted mb-6">Total weight lifted per session (kg).</p>

              <div className="h-48 w-full">
                {volumeData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={volumeData} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#60A5FA" stopOpacity={0.4}/>
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
                      <Area type="monotone" dataKey="volume" stroke="#60A5FA" strokeWidth={2} fillOpacity={1} fill="url(#colorVolume)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-text-muted text-xs">
                    No volume data for the last 30 days.
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Section 5: Session Duration Trend Bar Chart */}
          <section className="mb-6 animate-fade-in-up" style={{ animationDelay: '0.25s' }}>
            <div className="glass-card p-6 border-white/5 rounded-[2rem] flex flex-col bg-white/3">
              <div className="flex items-center gap-2 mb-2 w-full">
                <Clock className="w-5 h-5 text-purple-400" />
                <h2 className="text-white font-bold">Session Duration</h2>
              </div>
              <p className="text-xs text-text-muted mb-6">Duration of completed workouts (minutes).</p>

              <div className="h-48 w-full">
                {durationData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={durationData} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="date" stroke="rgba(255,255,255,0.2)" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="rgba(255,255,255,0.2)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}m`} />
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: '#111', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}
                        itemStyle={{ color: '#C084FC', fontWeight: 'bold' }}
                      />
                      <Bar dataKey="duration" fill="#C084FC" radius={[4, 4, 0, 0]} barSize={18} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-text-muted text-xs">
                    No duration data recorded.
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Muscle Usage Radar Chart */}
          <section className="mb-6 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
            <div className="glass-card p-6 border-white/5 rounded-[2rem] flex flex-col items-center bg-white/3">
              <div className="flex items-center gap-2 mb-2 w-full">
                <Activity className="w-5 h-5 text-orange-500" />
                <h2 className="text-white font-bold">Muscle Distribution</h2>
              </div>
              <p className="text-xs text-text-muted w-full mb-2">Relative volume distribution across muscle groups.</p>

              <div className="h-52 w-full flex justify-center items-center">
                {muscleData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={muscleData}>
                      <PolarGrid stroke="rgba(255,255,255,0.1)" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 9, fontWeight: 'bold' }} />
                      <PolarRadiusAxis angle={30} domain={[0, 'dataMax']} tick={false} axisLine={false} />
                      <Radar name="Usage" dataKey="A" stroke="#F97316" strokeWidth={1.5} fill="#F97316" fillOpacity={0.3} />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-text-muted text-xs">
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
