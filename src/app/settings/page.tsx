"use client";

import { ArrowLeft, LogOut, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useProfileStore } from "@/store/useProfileStore";
import { supabase } from "@/lib/supabase";

export default function Settings() {
  const { weightUnit, setWeightUnit, heightUnit, setHeightUnit, timeFormat, setTimeFormat, fetchSettings } = useSettingsStore();
  const { logout } = useProfileStore();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      // Sign out the user (full account deletion requires server-side admin)
      await supabase.auth.signOut();
      window.location.href = '/login';
    } catch (err) {
      console.error('Delete account error:', err);
      setIsDeleting(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col pt-[var(--notch-top)] pb-24 px-6 bg-background relative overflow-x-hidden">
      
      {/* Header */}
      <header className="w-full flex items-center py-4 mb-6 sticky top-[var(--notch-top)] z-20 bg-background/80 backdrop-blur-lg border-b border-white/5">
        <Link href="/profile" className="mr-4 p-2 bg-white/5 rounded-full border border-white/10 hover:bg-white/10 transition-colors">
          <ArrowLeft className="w-5 h-5 text-white" />
        </Link>
        <h1 className="text-xl font-extrabold tracking-tight">App Settings</h1>
      </header>

      {/* Preferences */}
      <section className="w-full mb-8 animate-fade-in-up">
        <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-3 ml-2">
          Preferences
        </h2>
        <div className="glass-card divide-y divide-white/5 flex flex-col overflow-hidden">
          
          <div className="p-4 flex items-center justify-between">
            <span className="font-bold text-sm">Weight Unit</span>
            <select 
              value={weightUnit} onChange={(e) => setWeightUnit(e.target.value as 'kg' | 'lbs')}
              className="bg-black/50 border border-white/10 rounded-lg px-3 pr-10 py-1.5 text-sm text-white outline-none cursor-pointer"
            >
              <option value="kg">Kilograms (kg)</option>
              <option value="lbs">Pounds (lbs)</option>
            </select>
          </div>

          <div className="p-4 flex items-center justify-between">
            <span className="font-bold text-sm">Height Unit</span>
            <select 
              value={heightUnit} onChange={(e) => setHeightUnit(e.target.value as 'cm' | 'in')}
              className="bg-black/50 border border-white/10 rounded-lg px-3 pr-10 py-1.5 text-sm text-white outline-none cursor-pointer"
            >
              <option value="cm">Centimeters (cm)</option>
              <option value="in">Inches (in)</option>
            </select>
          </div>

          <div className="p-4 flex items-center justify-between">
            <span className="font-bold text-sm">Time Format</span>
            <select 
              value={timeFormat} onChange={(e) => setTimeFormat(e.target.value as '12h' | '24h')}
              className="bg-black/50 border border-white/10 rounded-lg px-3 pr-10 py-1.5 text-sm text-white outline-none cursor-pointer"
            >
              <option value="12h">12-Hour (AM/PM)</option>
              <option value="24h">24-Hour</option>
            </select>
          </div>

        </div>
      </section>

      {/* Danger Zone */}
      <section className="w-full animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-3 ml-2">
          Account
        </h2>
        <div className="glass-card flex flex-col overflow-hidden">
          
          <button onClick={logout} className="p-4 flex items-center gap-3 text-white hover:bg-white/5 transition-colors border-b border-white/5 text-left">
            <LogOut className="w-5 h-5 text-text-muted" />
            <span className="font-bold text-sm">Log Out</span>
          </button>

          <button onClick={() => setShowDeleteConfirm(true)} className="p-4 flex items-center gap-3 text-accent-red hover:bg-accent-red/10 transition-colors text-left">
            <Trash2 className="w-5 h-5" />
            <span className="font-bold text-sm">Delete Account</span>
          </button>

        </div>
      </section>

      <div className="mt-12 w-full text-center">
        <p className="text-[10px] text-text-muted font-mono">Vortixia Fit v0.1.0 (Beta)</p>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111] border border-red-500/20 w-full max-w-sm rounded-3xl p-6">
            <h3 className="text-xl font-black text-white mb-2">Delete Account?</h3>
            <p className="text-xs text-text-muted mb-6">
              This will sign you out. To permanently delete all your data, please contact us at <span className="text-white font-bold">support@vortixia.fit</span>.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 bg-white/10 text-white font-bold rounded-xl"
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl disabled:opacity-50"
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
