"use client";

import Link from "next/link";
import { ChevronLeft, MessageSquarePlus, Send, Target, Dumbbell, AlertTriangle, Lightbulb, HelpCircle, Laptop, ChevronDown } from "lucide-react";
import { useState, useEffect } from "react";
import { useProfileStore } from "@/store/useProfileStore";
import { toast } from "@/components/ui/Toast";

type FeedbackType = "bug" | "suggestion" | "exercise" | "general";
type SeverityType = "low" | "medium" | "high" | "critical";

export default function FeedbackPage() {
  const { profile, fetchProfile } = useProfileStore();
  const [activeTab, setActiveTab] = useState<FeedbackType>("bug");
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [bugTitle, setBugTitle] = useState("");
  const [bugSteps, setBugSteps] = useState("");
  const [bugSeverity, setBugSeverity] = useState<SeverityType>("medium");

  const [suggestionTitle, setSuggestionTitle] = useState("");
  const [suggestionDetails, setSuggestionDetails] = useState("");

  const [exerciseName, setExerciseName] = useState("");
  const [targetMuscle, setTargetMuscle] = useState("");
  const [equipment, setEquipment] = useState("");

  const [generalMessage, setGeneralMessage] = useState("");

  useEffect(() => {
    if (!profile) {
      fetchProfile();
    }
  }, [profile, fetchProfile]);

  // Synchronize offline feedback when connection is restored
  useEffect(() => {
    const syncOfflineFeedback = async () => {
      const unsynced = localStorage.getItem("unsynced_feedback");
      if (!unsynced) return;

      try {
        const items = JSON.parse(unsynced);
        if (!Array.isArray(items) || items.length === 0) return;

        const loadingToast = toast.loading("Syncing saved offline feedback...");
        const failedItems: any[] = [];

        for (const item of items) {
          try {
            const res = await fetch("/api/feedback", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(item),
            });
            if (!res.ok) {
              if (res.status >= 400 && res.status < 500) {
                console.warn("Discarding invalid offline feedback item (client error):", res.status);
              } else {
                failedItems.push(item);
              }
            }
          } catch (err) {
            failedItems.push(item);
          }
        }

        toast.dismiss(loadingToast);

        if (failedItems.length === 0) {
          localStorage.removeItem("unsynced_feedback");
          toast.success("All offline feedback synced successfully!");
        } else {
          localStorage.setItem("unsynced_feedback", JSON.stringify(failedItems));
          toast.error(`Failed to sync ${failedItems.length} items. Retrying later.`);
        }
      } catch (e) {
        console.error("Error parsing unsynced feedback:", e);
      }
    };

    syncOfflineFeedback();

    window.addEventListener("online", syncOfflineFeedback);
    return () => {
      window.removeEventListener("online", syncOfflineFeedback);
    };
  }, []);

  const getDeviceMetadata = () => {
    if (typeof window === "undefined") return {};

    const ua = navigator.userAgent;
    let os = "Unknown OS";
    if (ua.indexOf("Win") !== -1) os = "Windows";
    else if (ua.indexOf("Mac") !== -1) os = "macOS";
    else if (ua.indexOf("X11") !== -1) os = "UNIX";
    else if (ua.indexOf("Linux") !== -1) os = "Linux";
    else if (/Android/.test(ua)) os = "Android";
    else if (/iPhone|iPad|iPod/.test(ua)) os = "iOS";

    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    const networkState = {
      online: navigator.onLine,
      effectiveType: connection?.effectiveType || "unknown",
      downlink: connection?.downlink || 0,
      rtt: connection?.rtt || 0,
    };

    return {
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      viewportSize: `${window.innerWidth}x${window.innerHeight}`,
      os,
      networkState,
      userAgent: ua,
    };
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    let payload: any = {
      type: activeTab,
      data: {},
      deviceMetadata: getDeviceMetadata(),
    };

    if (activeTab === "bug") {
      if (!bugTitle.trim() || !bugSteps.trim()) {
        toast.error("Please fill in all required fields.");
        setSubmitting(false);
        return;
      }
      payload.data = {
        title: bugTitle,
        steps: bugSteps,
        severity: bugSeverity,
      };
    } else if (activeTab === "suggestion") {
      if (!suggestionTitle.trim() || !suggestionDetails.trim()) {
        toast.error("Please fill in all required fields.");
        setSubmitting(false);
        return;
      }
      payload.data = {
        title: suggestionTitle,
        details: suggestionDetails,
      };
    } else if (activeTab === "exercise") {
      if (!exerciseName.trim()) {
        toast.error("Please enter the exercise name.");
        setSubmitting(false);
        return;
      }
      payload.data = {
        title: exerciseName,
        targetMuscle: targetMuscle,
        equipment: equipment,
      };
    } else if (activeTab === "general") {
      if (!generalMessage.trim()) {
        toast.error("Please enter your message.");
        setSubmitting(false);
        return;
      }
      payload.data = {
        message: generalMessage,
      };
    }

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP error ${response.status}`);
      }

      toast.success("Feedback submitted! Thank you.");
      
      // Clear current tab fields
      if (activeTab === "bug") {
        setBugTitle("");
        setBugSteps("");
        setBugSeverity("medium");
      } else if (activeTab === "suggestion") {
        setSuggestionTitle("");
        setSuggestionDetails("");
      } else if (activeTab === "exercise") {
        setExerciseName("");
        setTargetMuscle("");
        setEquipment("");
      } else if (activeTab === "general") {
        setGeneralMessage("");
      }
    } catch (error: any) {
      console.warn("Feedback POST failed:", error);
      
      const isNetworkError = error.message?.includes("Failed to fetch") || 
                             error.name === "TypeError" || 
                             (typeof navigator !== 'undefined' && !navigator.onLine);

      if (isNetworkError) {
        // Offline fallback: save to localStorage
        try {
          const unsynced = JSON.parse(localStorage.getItem("unsynced_feedback") || "[]");
          unsynced.push({
            ...payload,
            created_at: new Date().toISOString(),
          });
          localStorage.setItem("unsynced_feedback", JSON.stringify(unsynced));
          toast.success("Offline: Feedback saved locally and will sync when network is restored.");
        } catch (localErr) {
          console.error("Failed to save to localStorage:", localErr);
          toast.error("Unable to send feedback. Please check your network connection.");
        }
      } else {
        // Real validation or database rejection: show the actual error message
        toast.error(`Submission rejected: ${error.message}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const tabs = [
    { id: "bug", label: "Bug Report", icon: AlertTriangle },
    { id: "suggestion", label: "Feature Idea", icon: Lightbulb },
    { id: "exercise", label: "Missing Exercise", icon: Dumbbell },
    { id: "general", label: "General Feedback", icon: HelpCircle },
  ];

  return (
    <main className="flex min-h-screen flex-col pt-[calc(var(--notch-top)+1rem)] pb-24 px-6 bg-[#050505]">
      <header className="w-full flex items-center justify-between py-4 mb-6">
        <div className="flex items-center gap-4">
          <Link href="/profile" className="p-2 bg-white/5 rounded-full border border-white/10 hover:bg-white/10 transition-colors" aria-label="Go back">
            <ChevronLeft className="w-5 h-5 text-white" />
          </Link>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">Feedback</h1>
        </div>

        <Link
          href="/profile/feedback/admin"
          className="text-xs font-bold text-accent-green hover:underline uppercase tracking-wider flex items-center gap-1.5 border border-accent-green/20 rounded-xl px-3 py-1.5 bg-accent-green/5"
        >
          <Laptop className="w-3.5 h-3.5" />
          Admin Viewer
        </Link>
      </header>

      {/* Tab Selectors */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-6 scrollbar-none">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as FeedbackType)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-extrabold whitespace-nowrap transition-all border ${
                activeTab === tab.id
                  ? "bg-accent-green text-black border-accent-green shadow-[0_0_15px_rgba(74,222,128,0.2)]"
                  : "bg-white/5 text-white/70 border-white/10 hover:bg-white/10"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <section className="glass-card p-6 rounded-3xl flex flex-col gap-4 animate-fade-in-up">
        {/* Dynamic header details based on active tab */}
        <div className="flex items-center gap-3 mb-2 animate-fade-in">
          <div className="w-10 h-10 rounded-full bg-accent-green/10 flex items-center justify-center border border-accent-green/20">
            {activeTab === "bug" && <AlertTriangle className="w-5 h-5 text-accent-green" />}
            {activeTab === "suggestion" && <Lightbulb className="w-5 h-5 text-accent-green" />}
            {activeTab === "exercise" && <Dumbbell className="w-5 h-5 text-accent-green" />}
            {activeTab === "general" && <HelpCircle className="w-5 h-5 text-accent-green" />}
          </div>
          <div className="flex flex-col">
            <h2 className="text-lg font-black text-white">
              {activeTab === "bug" && "Report a Bug"}
              {activeTab === "suggestion" && "Suggest a Feature"}
              {activeTab === "exercise" && "Request Exercise"}
              {activeTab === "general" && "General Feedback"}
            </h2>
            <span className="text-[10px] text-text-muted uppercase tracking-widest font-bold">
              {activeTab === "bug" && "Help us crush issues"}
              {activeTab === "suggestion" && "Shape the future of Vortixia"}
              {activeTab === "exercise" && "Expand the global library"}
              {activeTab === "general" && "Have a question or comment?"}
            </span>
          </div>
        </div>

        {/* Feedback form */}
        <form onSubmit={handleFormSubmit} className="flex flex-col gap-5 mt-2">
          {activeTab === "bug" && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase tracking-widest text-text-muted font-bold ml-1">Bug Summary *</label>
                <input
                  type="text"
                  value={bugTitle}
                  onChange={(e) => setBugTitle(e.target.value)}
                  placeholder="e.g. Profile stats load indefinitely on iOS"
                  className="bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-base text-white placeholder-text-muted/50 outline-none focus:border-accent-green transition-colors"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase tracking-widest text-text-muted font-bold ml-1">Steps to Reproduce *</label>
                <textarea
                  value={bugSteps}
                  onChange={(e) => setBugSteps(e.target.value)}
                  placeholder="Please describe what you did and what went wrong..."
                  className="bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-base text-white placeholder-text-muted/50 outline-none focus:border-accent-green transition-colors min-h-[120px] resize-y"
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] uppercase tracking-widest text-text-muted font-bold ml-1">Severity Level</label>
                <div className="flex gap-2">
                  {(["low", "medium", "high", "critical"] as SeverityType[]).map((sev) => (
                    <button
                      key={sev}
                      type="button"
                      onClick={() => setBugSeverity(sev)}
                      className={`flex-1 py-3 rounded-xl text-xs uppercase font-extrabold border transition-all ${
                        bugSeverity === sev
                          ? sev === "critical"
                            ? "bg-red-500/20 text-red-400 border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.2)]"
                            : sev === "high"
                            ? "bg-orange-500/20 text-orange-400 border-orange-500/50"
                            : sev === "medium"
                            ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/50"
                            : "bg-green-500/20 text-green-400 border-green-500/50"
                          : "bg-white/5 text-white/50 border-white/10 hover:bg-white/10"
                      }`}
                    >
                      {sev}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeTab === "suggestion" && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase tracking-widest text-text-muted font-bold ml-1">Feature Title *</label>
                <input
                  type="text"
                  value={suggestionTitle}
                  onChange={(e) => setSuggestionTitle(e.target.value)}
                  placeholder="e.g. Custom workout split export"
                  className="bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-base text-white placeholder-text-muted/50 outline-none focus:border-accent-green transition-colors"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase tracking-widest text-text-muted font-bold ml-1">Details & Pain Points *</label>
                <textarea
                  value={suggestionDetails}
                  onChange={(e) => setSuggestionDetails(e.target.value)}
                  placeholder="What feature would you like to see, and what problem does it solve for you?"
                  className="bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-base text-white placeholder-text-muted/50 outline-none focus:border-accent-green transition-colors min-h-[150px] resize-y"
                  required
                />
              </div>
            </>
          )}

          {activeTab === "exercise" && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase tracking-widest text-text-muted font-bold ml-1">Exercise Name *</label>
                <input
                  type="text"
                  value={exerciseName}
                  onChange={(e) => setExerciseName(e.target.value)}
                  placeholder="e.g. Kneeling Donkey Kicks"
                  className="bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-base text-white placeholder-text-muted/50 outline-none focus:border-accent-green transition-colors"
                  required
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase tracking-widest text-text-muted font-bold ml-1 flex items-center gap-1">
                    <Target className="w-3.5 h-3.5" /> Target Muscle
                  </label>
                  <input
                    type="text"
                    value={targetMuscle}
                    onChange={(e) => setTargetMuscle(e.target.value)}
                    placeholder="e.g. Glutes"
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-base text-white placeholder-text-muted/50 outline-none focus:border-accent-green transition-colors"
                  />
                </div>
                <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase tracking-widest text-text-muted font-bold ml-1 flex items-center gap-1">
                    <Dumbbell className="w-3.5 h-3.5" /> Equipment
                  </label>
                  <div className="relative">
                    <select
                      value={equipment}
                      onChange={(e) => setEquipment(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 pr-10 text-base text-white outline-none focus:border-accent-green transition-colors appearance-none"
                    >
                      <option value="">Select...</option>
                      <option value="bodyweight">Bodyweight</option>
                      <option value="dumbbell">Dumbbell</option>
                      <option value="barbell">Barbell</option>
                      <option value="cable">Cable / Machine</option>
                      <option value="band">Resistance Band</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === "general" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase tracking-widest text-text-muted font-bold ml-1">Message *</label>
              <textarea
                value={generalMessage}
                onChange={(e) => setGeneralMessage(e.target.value)}
                placeholder="Write your feedback or questions here..."
                className="bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-base text-white placeholder-text-muted/50 outline-none focus:border-accent-green transition-colors min-h-[180px] resize-y"
                required
              />
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 mt-2 transition-all active:scale-95 bg-accent-green text-black hover:bg-accent-green/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              "SUBMITTING..."
            ) : (
              <>
                <Send className="w-4 h-4" /> SUBMIT FEEDBACK
              </>
            )}
          </button>
        </form>
      </section>
    </main>
  );
}
