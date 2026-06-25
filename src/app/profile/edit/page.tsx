"use client";

import { useState, useMemo, useEffect } from "react";
import { Calculator, ChevronLeft, Save, Loader2, ChevronDown } from "lucide-react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useProfileStore } from "@/store/useProfileStore";
import { useSettingsStore } from "@/store/useSettingsStore";
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
      setBodyFat(metrics.body_fat_pct?.toString() || "");
    }
  }, [metrics]);

  const [bodyFat, setBodyFat] = useState<string>(metrics?.body_fat_pct?.toString() || "");
  const [goal, setGoal] = useState<string>("Hypertrophy");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([]);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);

  useEffect(() => {
    if (!username || username === profile?.username) {
      setUsernameAvailable(null);
      setUsernameSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setCheckingUsername(true);
      try {
        const res = await fetch(`/api/username-check?q=${encodeURIComponent(username)}`);
        const data = await res.json();
        if (res.ok) {
          setUsernameAvailable(data.available);
          setUsernameSuggestions(data.suggestions || []);
        } else {
          setUsernameAvailable(null);
          setUsernameSuggestions([]);
        }
      } catch (err) {
        setUsernameAvailable(null);
        setUsernameSuggestions([]);
      } finally {
        setCheckingUsername(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [username, profile?.username]);

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
      const bf = bodyFat ? parseFloat(bodyFat) : null;
      const heightInMeters = h / 100;
      const bmi = parseFloat((w / (heightInMeters * heightInMeters)).toFixed(1));
      let bmr = (10 * w) + (6.25 * h) - (5 * a);
      bmr += gender === 'Male' ? 5 : -161;
      const tdee = Math.round(bmr * 1.55);

      const { error: upsertError } = await supabase
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
          body_fat_pct: bf,
        }, { onConflict: 'id' });

      if (upsertError) {
        console.error("Supabase upsert error:", upsertError);
        toast.error(`Failed to update body metrics: ${upsertError.message}`);
        setIsSaving(false);
        return;
      }

      // Update settings store visual state immediately
      const genderVal = gender.toLowerCase() === 'female' ? 'female' : 'male';
      useSettingsStore.getState().setHeroGender(genderVal);

      // Log body metrics to history if changed
      const { data: lastLog, error: lastLogError } = await supabase
        .from('body_metrics_log')
        .select('weight_kg, body_fat_pct')
        .eq('user_id', userId)
        .order('logged_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!lastLogError) {
        const weightChanged = !lastLog || parseFloat(lastLog.weight_kg) !== w;
        const bfChanged = !lastLog || (lastLog.body_fat_pct === null && bf !== null) || (lastLog.body_fat_pct !== null && parseFloat(lastLog.body_fat_pct) !== bf);

        if (weightChanged || bfChanged) {
          const { error: insertLogError } = await supabase
            .from('body_metrics_log')
            .insert({
              user_id: userId,
              weight_kg: w,
              body_fat_pct: bf
            });
          if (insertLogError) {
            console.error("Failed to insert body metrics log:", insertLogError);
          }
        }
      }

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
            setIsSaving(false);
            return;
          }
          console.error("Error updating user profile:", error);
          toast.error(`Failed to update user profile: ${error.message}`);
          setIsSaving(false);
          return;
        }
      }

      await fetchProfile(); // Always refresh profile and metrics in store
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
          <Link href="/profile" className="p-2 bg-white/5 rounded-full border border-white/10 hover:bg-white/10 transition-colors" aria-label="Go back">
            <ChevronLeft className="w-5 h-5 text-white" />
          </Link>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">Edit Profile</h1>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving || usernameAvailable === false}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-sm transition-all active:scale-95 ${
            saveSuccess
              ? 'bg-accent-green text-black'
              : 'bg-accent-green/20 text-accent-green border border-accent-green/30 disabled:opacity-50 disabled:cursor-not-allowed'
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
              className={`bg-black/50 border rounded-lg p-3 text-white outline-none text-sm w-full min-w-0 ${usernameAvailable === false ? 'border-red-500/50 focus:border-red-500' : usernameAvailable === true ? 'border-accent-green/50 focus:border-accent-green' : 'border-white/10 focus:border-white/20'}`}
            />
            {checkingUsername && <span className="text-xs text-text-muted mt-1">Checking availability...</span>}
            {usernameAvailable === false && !checkingUsername && (
              <div className="mt-1 flex flex-col gap-2">
                <span className="text-xs text-red-400 font-medium">Username is already taken.</span>
                {usernameSuggestions.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {usernameSuggestions.map(suggestion => (
                      <button
                        key={suggestion}
                        onClick={() => setUsername(suggestion)}
                        className="text-xs bg-white/5 border border-white/10 rounded-full px-3 py-1.5 hover:bg-white/10 transition-colors text-white"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {usernameAvailable === true && !checkingUsername && (
              <span className="text-xs text-accent-green font-medium mt-1">Username is available!</span>
            )}
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
              <div className="relative">
                <select 
                  value={gender} 
                  onChange={(e) => setGender(e.target.value as any)}
                  className="bg-black/50 border border-white/10 rounded-lg p-3 pr-10 text-white outline-none text-sm w-full min-w-0 appearance-none focus:border-accent-green transition-colors"
                >
                  <option value="" disabled>Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
              </div>
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
            <div className="relative">
              <select 
                value={goal} onChange={(e) => setGoal(e.target.value)}
                className="bg-black/50 border border-white/10 rounded-lg p-3 pr-10 text-white outline-none text-sm w-full min-w-0 appearance-none focus:border-accent-green transition-colors"
              >
                <option value="Hypertrophy">Hypertrophy (Muscle Gain)</option>
                <option value="Strength">Strength / Powerlifting</option>
                <option value="Cut">Cut (Fat Loss)</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
            </div>
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
