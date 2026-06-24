"use client";

import { useState, useMemo, useEffect } from "react";
import { Calculator, ChevronLeft, Save, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useProfileStore } from "@/store/useProfileStore";
import { toast } from "@/components/ui/Toast";

export default function EditProfile() {
  const { profile, metrics, fetchProfile } = useProfileStore();

  useEffect(() => {
    if (!profile) {
      fetchProfile();
    }
  }, [profile, fetchProfile]);

  const [gender, setGender] = useState<"Male" | "Female">(metrics?.gender as any || "Male");
  const [age, setAge] = useState<string>(metrics?.age?.toString() || "25");
  const [weight, setWeight] = useState<string>(metrics?.weight_kg?.toString() || "75");
  const [height, setHeight] = useState<string>(metrics?.height_cm?.toString() || "175");
  const [fullName, setFullName] = useState<string>(profile?.full_name || "");
  const [username, setUsername] = useState<string>(profile?.username || "");

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setUsername(profile.username || "");
    }
  }, [profile]);

  useEffect(() => {
    if (metrics) {
      setGender(metrics.gender as any);
      setAge(metrics.age.toString());
      setWeight(metrics.weight_kg.toString());
      setHeight(metrics.height_cm.toString());
    }
  }, [metrics]);

  const [bodyFat, setBodyFat] = useState<string>("");
  const [goal, setGoal] = useState<string>("Hypertrophy");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const stats = useMemo(() => {
    const w = parseFloat(weight);
    const h = parseFloat(height);
    const a = parseInt(age);
    
    if (!w || !h || !a || !gender) return null;

    const heightInMeters = h / 100;
    const bmi = (w / (heightInMeters * heightInMeters)).toFixed(1);

    let bmr = (10 * w) + (6.25 * h) - (5 * a);
    bmr += gender === "Male" ? 5 : -161;

    const tdee = Math.round(bmr * 1.55);

    return { bmi, bmr: Math.round(bmr), tdee };
  }, [weight, height, age, gender]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const userId = session.user.id;

      // Update user_metrics
      const w = parseFloat(weight);
      const h = parseFloat(height);
      const a = parseInt(age);
      const heightInMeters = h / 100;
      const bmi = parseFloat((w / (heightInMeters * heightInMeters)).toFixed(1));
      let bmr = (10 * w) + (6.25 * h) - (5 * a);
      bmr += gender === 'Male' ? 5 : -161;
      const tdee = Math.round(bmr * 1.55);

      await supabase
        .from('user_metrics')
        .upsert({
          id: userId,
          gender,
          age: a,
          weight_kg: w,
          height_cm: h,
          bmi,
          bmr: Math.round(bmr),
          tdee,
        }, { onConflict: 'id' });

      if (fullName !== profile?.full_name || username !== profile?.username) {
        const { error } = await supabase
          .from('users')
          .update({
            full_name: fullName,
            username: username
          })
          .eq('id', userId);
          
        if (error) {
          if (error.code === '23505') {
            toast.error('Username is already taken');
            return;
          }
          console.error("Error updating user:", error);
        } else {
          fetchProfile(); // Refresh store
        }
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error('Save error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col pt-[var(--notch-top)] pb-24 px-6 bg-[#050505] relative overflow-x-hidden">
      
      {/* Header */}
      <header className="w-full flex items-center justify-between py-4 mb-6 sticky top-[var(--notch-top)] z-20 bg-[#050505]/80 backdrop-blur-lg">
        <div className="flex items-center gap-4">
          <Link href="/profile" className="p-2 bg-white/5 rounded-full border border-white/10 hover:bg-white/10 transition-colors">
            <ChevronLeft className="w-5 h-5 text-white" />
          </Link>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">Edit Profile</h1>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-sm transition-all active:scale-95 ${
            saveSuccess
              ? 'bg-accent-green text-black'
              : 'bg-accent-green/20 text-accent-green border border-accent-green/30'
          }`}
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saveSuccess ? 'Saved!' : 'Save'}
        </button>
      </header>
        
      <section className="w-full mb-6 flex flex-col gap-4 animate-fade-in-up">
        <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest">
          Personal Info
        </h2>
        
        <div className="glass-card p-4 flex flex-col gap-4 border border-white/5">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase text-text-muted font-bold">Full Name</label>
            <input 
              type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
              className="bg-black/50 border border-white/10 rounded-lg p-3 text-white outline-none text-sm w-full min-w-0"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase text-text-muted font-bold">Username</label>
            <input 
              type="text" value={username} onChange={(e) => setUsername(e.target.value)}
              className="bg-black/50 border border-white/10 rounded-lg p-3 text-white outline-none text-sm w-full min-w-0"
            />
          </div>
        </div>
      </section>

      <section className="w-full mb-6 flex flex-col gap-4 animate-fade-in-up">
        <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest">
          Body Metrics
        </h2>
        
        <div className="glass-card p-4 flex flex-col gap-4 border border-white/5">
          <div className="flex gap-4">
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-[10px] uppercase text-text-muted font-bold">Gender</label>
              <select 
                value={gender} 
                onChange={(e) => setGender(e.target.value as any)}
                className="bg-black/50 border border-white/10 rounded-lg p-3 pr-10 text-white outline-none text-sm w-full min-w-0"
              >
                <option value="" disabled>Select</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-[10px] uppercase text-text-muted font-bold">Age</label>
              <input 
                type="number" value={age} onChange={(e) => setAge(e.target.value)}
                className="bg-black/50 border border-white/10 rounded-lg p-3 text-white outline-none text-sm w-full min-w-0"
              />
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-[10px] uppercase text-text-muted font-bold">Weight (kg)</label>
              <input 
                type="number" value={weight} onChange={(e) => setWeight(e.target.value)}
                className="bg-black/50 border border-white/10 rounded-lg p-3 text-white outline-none text-sm w-full min-w-0"
              />
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-[10px] uppercase text-text-muted font-bold">Height (cm)</label>
              <input 
                type="number" value={height} onChange={(e) => setHeight(e.target.value)}
                className="bg-black/50 border border-white/10 rounded-lg p-3 text-white outline-none text-sm w-full min-w-0"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase text-text-muted font-bold">Primary Goal</label>
            <select 
              value={goal} onChange={(e) => setGoal(e.target.value)}
              className="bg-black/50 border border-white/10 rounded-lg p-3 pr-10 text-white outline-none text-sm w-full min-w-0"
            >
              <option value="Hypertrophy">Hypertrophy (Muscle Gain)</option>
              <option value="Strength">Strength / Powerlifting</option>
              <option value="Cut">Cut (Fat Loss)</option>
            </select>
          </div>
        </div>
      </section>

      {/* Advanced Body Stats */}
      <section className="w-full flex flex-col gap-4 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest flex items-center gap-2">
            <Calculator className="w-4 h-4" />
            Advanced Stats
          </h2>
        </div>

        <div className="glass-card p-5 relative overflow-hidden border border-white/5">
          {/* Subtle Glows */}
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500/10 blur-3xl rounded-full" />

          {stats ? (
            <div className="grid grid-cols-2 gap-4 z-10 relative">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-widest text-text-muted font-bold">BMI</span>
                <span className="text-2xl font-black text-white">{stats.bmi}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-widest text-text-muted font-bold">Body Fat % <span className="font-normal opacity-50">(Opt)</span></span>
                <input 
                  type="number" placeholder="e.g. 15" value={bodyFat} onChange={(e) => setBodyFat(e.target.value)}
                  className="bg-transparent border-b border-white/20 text-2xl font-black outline-none w-20 focus:border-accent-green transition-colors text-white"
                />
              </div>
              <div className="flex flex-col mt-2">
                <span className="text-[10px] uppercase tracking-widest text-text-muted font-bold">BMR</span>
                <span className="text-2xl font-black text-white">{stats.bmr} <span className="text-xs font-normal text-text-muted">kcal</span></span>
              </div>
              <div className="flex flex-col mt-2">
                <span className="text-[10px] uppercase tracking-widest text-text-muted font-bold">TDEE (Maint.)</span>
                <span className="text-2xl font-black text-accent-green">{stats.tdee} <span className="text-xs font-normal text-text-muted">kcal</span></span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-text-muted text-center py-4 z-10 relative">
              Fill out Gender, Age, Weight, and Height to automatically calculate your advanced metrics.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
