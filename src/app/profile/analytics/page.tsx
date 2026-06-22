"use client";

import { ChevronLeft, BarChart3, TrendingUp, Activity, Target } from "lucide-react";
import Link from "next/link";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  PieChart, Pie, Cell
} from "recharts";

// Mock Data
const volumeData = [
  { week: 'W1', volume: 8500 },
  { week: 'W2', volume: 9200 },
  { week: 'W3', volume: 11000 },
  { week: 'W4', volume: 10500 },
  { week: 'W5', volume: 12400 },
  { week: 'W6', volume: 14200 },
];

const muscleData = [
  { subject: 'Chest', A: 120, fullMark: 150 },
  { subject: 'Back', A: 98, fullMark: 150 },
  { subject: 'Legs', A: 86, fullMark: 150 },
  { subject: 'Shoulders', A: 99, fullMark: 150 },
  { subject: 'Arms', A: 130, fullMark: 150 },
  { subject: 'Core', A: 65, fullMark: 150 },
];

const consistencyData = [
  { name: 'Completed', value: 85 },
  { name: 'Missed', value: 15 }
];

const COLORS = ['#2EEA82', '#1a1a1a'];

export default function AnalyticsPage() {
  return (
    <main className="flex min-h-screen flex-col pt-[calc(var(--notch-top)+1rem)] pb-28 px-4 bg-[#050505] relative overflow-x-hidden">
      
      {/* Header */}
      <header className="w-full flex items-center mb-8 relative z-10 animate-fade-in-down">
        <Link href="/profile" className="absolute left-0 p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors">
          <ChevronLeft className="w-6 h-6 text-white" />
        </Link>
        <div className="w-full flex justify-center">
          <div className="flex items-center gap-2 px-4 py-1.5 bg-orange-500/10 border border-orange-500/20 rounded-full">
            <BarChart3 className="w-4 h-4 text-orange-400" />
            <h1 className="text-xs font-black tracking-widest text-orange-400 uppercase">Analytics</h1>
          </div>
        </div>
      </header>

      {/* Discipline / Consistency Radial Chart */}
      <section className="mb-6 animate-fade-in-up">
        <div className="glass-card p-6 border-white/5 rounded-[2rem] flex flex-col items-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-accent-green/10 blur-3xl rounded-full" />
          
          <div className="flex items-center gap-2 mb-2 w-full">
            <Target className="w-5 h-5 text-accent-green" />
            <h2 className="text-white font-bold">Discipline Score</h2>
          </div>
          <p className="text-xs text-text-muted w-full mb-6">Percentage of planned workouts completed.</p>

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
              <span className="text-4xl font-black text-white">85<span className="text-xl text-accent-green">%</span></span>
              <span className="text-[10px] text-text-muted font-bold tracking-widest uppercase mt-1">Excellent</span>
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
          <p className="text-xs text-text-muted mb-6">Total weight lifted per week (lbs).</p>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={volumeData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#60A5FA" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#60A5FA" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="week" stroke="rgba(255,255,255,0.2)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="rgba(255,255,255,0.2)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(value) => `${value / 1000}k`} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#111', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}
                  itemStyle={{ color: '#60A5FA', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="volume" stroke="#60A5FA" strokeWidth={3} fillOpacity={1} fill="url(#colorVolume)" />
              </AreaChart>
            </ResponsiveContainer>
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
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={muscleData}>
                <PolarGrid stroke="rgba(255,255,255,0.1)" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 'bold' }} />
                <PolarRadiusAxis angle={30} domain={[0, 150]} tick={false} axisLine={false} />
                <Radar name="Usage" dataKey="A" stroke="#F97316" strokeWidth={2} fill="#F97316" fillOpacity={0.4} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

    </main>
  );
}
