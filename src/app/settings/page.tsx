"use client";
 
import { useState, useEffect } from "react";
import { ArrowLeft, LogOut, Trash2, Bell, Volume2, Smartphone, Timer, ChevronRight, UserCircle, AlertTriangle, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useProfileStore } from "@/store/useProfileStore";
import { supabase } from "@/lib/supabase";
import { toast } from "react-hot-toast";

export default function Settings() {
  const router = useRouter();
  
  const {
    weightUnit, setWeightUnit,
    heightUnit, setHeightUnit,
    timeFormat, setTimeFormat,
    defaultRestTimer, setDefaultRestTimer,
    soundEffects, setSoundEffects,
    hapticFeedback, setHapticFeedback,
    notifyWorkouts, setNotifyWorkouts,
    notifySocial, setNotifySocial,
    notifyInactivity, setNotifyInactivity,
    fetchSettings
  } = useSettingsStore();

  const { profile, fetchProfile, logout } = useProfileStore();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [confirmUsername, setConfirmUsername] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchSettings();
    if (!profile) {
      fetchProfile();
    }
  }, [fetchSettings, fetchProfile, profile]);

  // Subtle vibration helper
  const triggerHaptic = () => {
    if (hapticFeedback && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(10);
    }
  };

  const handleToggle = (setter: (val: boolean) => void, currentVal: boolean) => {
    setter(!currentVal);
    // Vibrate immediately
    if (hapticFeedback && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(10);
    }
  };

  const handleDeleteAccount = async () => {
    if (confirmUsername !== profile?.username) {
      toast.error("Username does not match confirmation.");
      return;
    }
    
    setIsDeleting(true);
    triggerHaptic();
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const userId = session.user.id;

      // 1. Delete associated database records to clean up (in production this would be handled via server trigger or CASCADE)
      await supabase.from('user_metrics').delete().eq('id', userId);
      await supabase.from('users').delete().eq('id', userId);

      // 2. Sign out
      await supabase.auth.signOut();
      toast.success("Account successfully deleted.");
      window.location.href = '/login';
    } catch (err: any) {
      console.error('Delete account error:', err);
      toast.error(`Failed to delete account: ${err.message}`);
      setIsDeleting(false);
    }
  };

  // Custom switch toggle component
  const ToggleSwitch = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <button
      type="button"
      onClick={onChange}
      className={`w-11 h-6 rounded-full relative transition-colors duration-200 outline-none flex items-center ${
        checked ? 'bg-accent-green' : 'bg-white/10 border border-white/5'
      }`}
    >
      <span
        className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 absolute ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );

  return (
    <main className="flex min-h-screen flex-col pt-[var(--notch-top)] pb-28 px-6 bg-[#050505] text-white relative overflow-x-hidden">
      
      {/* Header */}
      <header className="w-full flex items-center py-4 mb-6 sticky top-[var(--notch-top)] z-20 bg-[#050505]/80 backdrop-blur-lg border-b border-white/5">
        <button 
          onClick={() => router.back()} 
          className="mr-4 p-2 bg-white/5 rounded-full border border-white/10 hover:bg-white/10 transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <h1 className="text-xl font-extrabold tracking-tight">Settings</h1>
      </header>

      {/* Account Info summary card */}
      {profile && (
        <section className="w-full mb-6 animate-fade-in-up">
          <div className="glass-card p-4 flex items-center justify-between border border-white/5 rounded-3xl">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 rounded-full border border-white/10 overflow-hidden bg-black/40 flex items-center justify-center flex-shrink-0">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <UserCircle className="w-7 h-7 text-white/50" />
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-extrabold text-sm text-white truncate">{profile.full_name || "Champion"}</span>
                <span className="text-xs text-text-muted font-mono truncate">@{profile.username || "anonymous"}</span>
                <span className="text-[10px] text-accent-green font-black uppercase mt-0.5 tracking-wider">Level {Math.floor((profile.total_xp || 0) / 2000) + 1}</span>
              </div>
            </div>
            
            <Link href="/profile/edit">
              <button 
                onClick={triggerHaptic}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-white hover:bg-white/10 active:scale-95 transition-all"
              >
                Edit Profile
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </Link>
          </div>
        </section>
      )}

      {/* Preferences Section */}
      <section className="w-full mb-6 animate-fade-in-up">
        <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-3 ml-2">
          Preferences
        </h2>
        <div className="glass-card divide-y divide-white/5 flex flex-col overflow-hidden border border-white/5 rounded-3xl bg-white/3">
          
          <div className="p-4 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="font-bold text-sm">Weight Unit</span>
              <span className="text-xs text-text-muted">Display metrics in metric/imperial</span>
            </div>
            <select 
              value={weightUnit} 
              onChange={(e) => { triggerHaptic(); setWeightUnit(e.target.value as any); }}
              className="bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white outline-none cursor-pointer focus:border-accent-green"
            >
              <option value="kg">Kilograms (kg)</option>
              <option value="lbs">Pounds (lbs)</option>
            </select>
          </div>

          <div className="p-4 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="font-bold text-sm">Height Unit</span>
              <span className="text-xs text-text-muted">Display height measurement system</span>
            </div>
            <select 
              value={heightUnit} 
              onChange={(e) => { triggerHaptic(); setHeightUnit(e.target.value as any); }}
              className="bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white outline-none cursor-pointer focus:border-accent-green"
            >
              <option value="cm">Centimeters (cm)</option>
              <option value="in">Inches (in)</option>
            </select>
          </div>

          <div className="p-4 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="font-bold text-sm">Time Format</span>
              <span className="text-xs text-text-muted">Display clocks format</span>
            </div>
            <select 
              value={timeFormat} 
              onChange={(e) => { triggerHaptic(); setTimeFormat(e.target.value as any); }}
              className="bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white outline-none cursor-pointer focus:border-accent-green"
            >
              <option value="12h">12-Hour (AM/PM)</option>
              <option value="24h">24-Hour</option>
            </select>
          </div>

          <div className="p-4 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="font-bold text-sm flex items-center gap-2"><Timer className="w-4 h-4 text-accent-green" /> Default Rest Timer</span>
              <span className="text-xs text-text-muted">Auto-launch timer between workout sets</span>
            </div>
            <select 
              value={defaultRestTimer} 
              onChange={(e) => { triggerHaptic(); setDefaultRestTimer(parseInt(e.target.value)); }}
              className="bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white outline-none cursor-pointer focus:border-accent-green"
            >
              <option value={30}>30 Seconds</option>
              <option value={45}>45 Seconds</option>
              <option value={60}>60 Seconds (1 Min)</option>
              <option value={90}>90 Seconds (1.5 Min)</option>
              <option value={120}>120 Seconds (2 Min)</option>
              <option value={180}>180 Seconds (3 Min)</option>
            </select>
          </div>

        </div>
      </section>

      {/* Sound & Haptics */}
      <section className="w-full mb-6 animate-fade-in-up" style={{ animationDelay: '0.05s' }}>
        <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-3 ml-2">
          Sound & Haptics
        </h2>
        <div className="glass-card divide-y divide-white/5 flex flex-col overflow-hidden border border-white/5 rounded-3xl bg-white/3">
          
          <div className="p-4 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="font-bold text-sm flex items-center gap-2"><Volume2 className="w-4 h-4 text-accent-green" /> Audio Feedback</span>
              <span className="text-xs text-text-muted">Play alarm sound when rest timer ends</span>
            </div>
            <ToggleSwitch 
              checked={soundEffects} 
              onChange={() => handleToggle(setSoundEffects, soundEffects)} 
            />
          </div>

          <div className="p-4 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="font-bold text-sm flex items-center gap-2"><Smartphone className="w-4 h-4 text-accent-green" /> Tactile Haptics</span>
              <span className="text-xs text-text-muted">Vibrate device on toggles & confirmations</span>
            </div>
            <ToggleSwitch 
              checked={hapticFeedback} 
              onChange={() => handleToggle(setHapticFeedback, hapticFeedback)} 
            />
          </div>

        </div>
      </section>

      {/* Notifications */}
      <section className="w-full mb-6 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-3 ml-2">
          Push Notifications
        </h2>
        <div className="glass-card divide-y divide-white/5 flex flex-col overflow-hidden border border-white/5 rounded-3xl bg-white/3">
          
          <div className="p-4 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="font-bold text-sm flex items-center gap-2"><Bell className="w-4 h-4 text-accent-green" /> Workout Reminders</span>
              <span className="text-xs text-text-muted">Remind me to log today's scheduled split</span>
            </div>
            <ToggleSwitch 
              checked={notifyWorkouts} 
              onChange={() => handleToggle(setNotifyWorkouts, notifyWorkouts)} 
            />
          </div>

          <div className="p-4 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="font-bold text-sm flex items-center gap-2"><Bell className="w-4 h-4 text-accent-green" /> Social & Duels</span>
              <span className="text-xs text-text-muted">Alerts when challenged or followed</span>
            </div>
            <ToggleSwitch 
              checked={notifySocial} 
              onChange={() => handleToggle(setNotifySocial, notifySocial)} 
            />
          </div>

          <div className="p-4 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="font-bold text-sm flex items-center gap-2"><Bell className="w-4 h-4 text-accent-green" /> Inactivity Alerts</span>
              <span className="text-xs text-text-muted">Nudge me after 3 days of no activity</span>
            </div>
            <ToggleSwitch 
              checked={notifyInactivity} 
              onChange={() => handleToggle(setNotifyInactivity, notifyInactivity)} 
            />
          </div>

        </div>
      </section>

      {/* Danger Zone */}
      <section className="w-full animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
        <h2 className="text-xs font-bold text-[#FF3B38] uppercase tracking-widest mb-3 ml-2">
          Danger Zone
        </h2>
        <div className="glass-card flex flex-col overflow-hidden border border-red-500/10 rounded-3xl bg-[#1a0c0c]/30">
          
          <button 
            onClick={() => { triggerHaptic(); logout(); }} 
            className="p-4 flex items-center gap-3 text-white hover:bg-white/5 transition-colors border-b border-white/5 text-left"
          >
            <LogOut className="w-5 h-5 text-text-muted" />
            <span className="font-bold text-sm">Log Out</span>
          </button>

          <button 
            onClick={() => { triggerHaptic(); setShowDeleteConfirm(true); }} 
            className="p-4 flex items-center gap-3 text-[#FF3B38] hover:bg-[#FF3B38]/10 transition-colors text-left"
          >
            <Trash2 className="w-5 h-5" />
            <span className="font-bold text-sm">Delete Account</span>
          </button>

        </div>
      </section>

      {/* High-Security Delete Confirmation Backdrop Overlay */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#0e0a0a] border border-red-500/20 w-full max-w-sm rounded-[2.5rem] p-6 flex flex-col items-center text-center shadow-[0_0_30px_rgba(239,68,68,0.15)] animate-scale-in">
            
            <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-4">
              <ShieldAlert className="w-8 h-8 text-red-500" />
            </div>

            <h3 className="text-xl font-black text-white mb-2">Delete Permanently?</h3>
            
            <p className="text-xs text-text-muted mb-4 leading-relaxed">
              This action is <span className="text-red-500 font-extrabold uppercase">irreversible</span>. You will lose all your workout sessions, total XP progress, active duels scores, and metrics history.
            </p>

            <div className="w-full bg-[#1c0c0c] border border-red-500/15 rounded-2xl p-4 mb-6 text-left flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-[10px] text-red-400 font-bold leading-normal">
                To confirm, please type your username <span className="text-white font-black bg-red-500/20 px-1.5 py-0.5 rounded font-mono">@{profile?.username || "username"}</span> below:
              </p>
            </div>

            <input
              type="text"
              placeholder={profile?.username || "Type username"}
              value={confirmUsername}
              onChange={(e) => setConfirmUsername(e.target.value)}
              className="bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-center text-white outline-none w-full mb-4 focus:border-red-500 transition-colors font-mono"
            />

            <div className="flex gap-3 w-full">
              <button 
                onClick={() => { triggerHaptic(); setShowDeleteConfirm(false); setConfirmUsername(""); }}
                className="flex-1 py-3 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold rounded-xl transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteAccount}
                disabled={isDeleting || confirmUsername !== profile?.username}
                className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl disabled:opacity-30 disabled:cursor-not-allowed hover:bg-red-600 transition-all shadow-lg active:scale-95"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>

          </div>
        </div>
      )}

    </main>
  );
}
