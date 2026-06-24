"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/Toast";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOAuthLogin = async (provider: 'google' | 'apple') => {
    try {
      setError(null);
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        }
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || `Failed to login with ${provider}`);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setIsLoading(true);
    setError(null);

    try {
      // Using Magic Link for passwordless email login
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        }
      });
      if (error) throw error;
      toast.success("Check your email for the login link!");
    } catch (err: any) {
      setError(err.message || "Failed to send magic link");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col justify-end p-6 relative overflow-hidden bg-[#0a0a0a]">
      {/* Background Image */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center pointer-events-none"
        style={{ 
          backgroundImage: "url('https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=600&auto=format&fit=crop')",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a]/10 to-[#0a0a0a] via-[#0a0a0a]/60" />
      </div>

      {/* Brand Header */}
      <div className="absolute top-10 left-6 z-10">
        <h1 className="text-3xl font-extrabold tracking-tighter text-white drop-shadow-2xl">
          Vortixia<span className="text-accent-green">Fit</span>
        </h1>
      </div>

      <div className="w-full max-w-md mx-auto z-10 glass-card p-6 flex flex-col gap-6 animate-fade-in-up border border-white/10 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] rounded-[30px] bg-[#0a0a0a]/60 backdrop-blur-xl mb-4">
        
        <div>
          <h2 className="text-[28px] font-semibold text-white leading-tight mb-2">Sign in for<br/>Fitness Success</h2>
          <p className="text-sm text-text-muted leading-relaxed">Fuel your fitness journey with our dynamic app designed for a healthier lifestyle.</p>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm font-bold text-center">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <button 
            onClick={() => handleOAuthLogin('google')}
            className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl border border-white/20 bg-white/5 hover:bg-white/10 transition-colors text-white font-semibold text-[15px]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Continue with Google
          </button>
          
          <button 
            onClick={() => handleOAuthLogin('apple')}
            className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl border border-white/20 bg-white/5 hover:bg-white/10 transition-colors text-white font-semibold text-[15px]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.04 2.26-.74 3.58-.8 1.93-.05 3.31.83 4.26 2.16-3.51 2.04-2.92 6.55.54 7.95-.82 2.04-1.98 4-3.46 5.36M12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.35 2.4-1.9 4.38-3.74 4.25"/></svg>
            Continue with Apple
          </button>
        </div>

        <div className="flex items-center text-center text-[12px] text-text-muted my-1">
          <div className="flex-1 border-b border-white/10 mr-4"></div>
          OR
          <div className="flex-1 border-b border-white/10 ml-4"></div>
        </div>

        <form onSubmit={handleEmailLogin} className="flex flex-col gap-3">
          <div className="w-full">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-2xl py-4 px-4 text-white placeholder-white/50 focus:outline-none focus:border-accent-green focus:shadow-[0_0_10px_rgba(74,222,128,0.4)] transition-all text-[15px]"
              placeholder="Email address"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-accent-green text-black font-extrabold uppercase text-[16px] py-4 rounded-2xl hover:scale-[1.02] active:scale-[0.98] shadow-[0_4px_20px_rgba(74,222,128,0.4)] transition-transform mt-2 disabled:opacity-50 flex justify-center items-center h-[56px]"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "CONTINUE"}
          </button>
        </form>

        <div className="text-center mt-2 text-[13px] text-text-muted">
          Don't have an account? <span className="text-accent-green font-semibold cursor-pointer hover:underline">Sign Up</span>
        </div>

      </div>
    </main>
  );
}
