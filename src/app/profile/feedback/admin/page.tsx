"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { 
  ChevronLeft, ShieldAlert, RefreshCw, FileText, CheckCircle, 
  Archive, Copy, ChevronDown, ChevronUp, AlertTriangle, Lightbulb, 
  Dumbbell, HelpCircle, Activity, CheckSquare, Square, Inbox
} from "lucide-react";
import { useProfileStore } from "@/store/useProfileStore";
import { toast } from "@/components/ui/Toast";

interface FeedbackItem {
  id: string;
  type: "bug" | "suggestion" | "exercise" | "general";
  title?: string;
  description?: string;
  severity?: "low" | "medium" | "high" | "critical";
  target_muscle?: string;
  equipment?: string;
  status: "pending" | "reviewed" | "archived";
  device_metadata?: {
    screenResolution?: string;
    viewportSize?: string;
    os?: string;
    connectionState?: string;
    effectiveNetworkType?: string;
    userAgent?: string;
  };
  created_at: string;
  username?: string;
  user_email?: string;
  source: string;
}

export default function AdminFeedbackPage() {
  const { profile, isLoading: isProfileLoading, fetchProfile } = useProfileStore();
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [isFeedbackLoading, setIsFeedbackLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Filters
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  
  // Selections
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  useEffect(() => {
    setMounted(true);
    if (!profile) {
      fetchProfile();
    }
  }, [profile, fetchProfile]);

  // Load feedback immediately if user is verified as admin
  useEffect(() => {
    if (mounted && profile?.is_admin) {
      fetchFeedback();
    }
  }, [profile, mounted]);

  const fetchFeedback = async () => {
    setIsFeedbackLoading(true);
    try {
      const response = await fetch(`/api/feedback?t=${Date.now()}`, {
        method: "GET",
        headers: {
          "Cache-Control": "no-cache",
          "Pragma": "no-cache",
        },
        cache: "no-store",
      });

      if (!response.ok) {
        if (response.status === 403 || response.status === 401) {
          toast.error("Unauthorized to access feedback dashboard.");
        } else {
          toast.error("Failed to load feedback from database.");
        }
        return;
      }

      const result = await response.json();
      if (result.success) {
        setFeedback(result.data || []);
        toast.success("Feedback list synced.");
      }
    } catch (err) {
      console.error("Error fetching feedback:", err);
      toast.error("Error loading feedback list.");
    } finally {
      setIsFeedbackLoading(false);
    }
  };

  // Bulk status updates
  const handleBulkStatusUpdate = async (newStatus: "reviewed" | "archived" | "pending") => {
    if (selectedIds.length === 0) {
      toast.error("No items selected.");
      return;
    }

    const updateToast = toast.loading(`Updating ${selectedIds.length} items...`);
    try {
      const response = await fetch("/api/feedback", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ids: selectedIds,
          status: newStatus,
        }),
      });

      if (!response.ok) {
        throw new Error("HTTP error " + response.status);
      }

      toast.success(`Successfully updated ${selectedIds.length} items!`);
      setSelectedIds([]);
      fetchFeedback();
    } catch (err) {
      console.error("Error updating statuses:", err);
      toast.error("Failed to update status on database.");
    } finally {
      toast.dismiss(updateToast);
    }
  };

  // Filter items
  const filteredFeedback = feedback.filter((item) => {
    const matchesType = typeFilter === "all" || item.type === typeFilter;
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    return matchesType && matchesStatus;
  });

  // Bulk selections
  const toggleSelectAll = () => {
    const visibleIds = filteredFeedback.map(f => f.id);
    const allSelected = visibleIds.every(id => selectedIds.includes(id));
    
    if (allSelected) {
      setSelectedIds(selectedIds.filter(id => !visibleIds.includes(id)));
    } else {
      const union = Array.from(new Set([...selectedIds, ...visibleIds]));
      setSelectedIds(union);
    }
  };

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(x => x !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const toggleExpand = (id: string) => {
    if (expandedIds.includes(id)) {
      setExpandedIds(expandedIds.filter(x => x !== id));
    } else {
      setExpandedIds([...expandedIds, id]);
    }
  };

  // Copy Markdown for Antigravity
  const handleCopyMarkdown = () => {
    const itemsToExport = selectedIds.length > 0 
      ? feedback.filter(item => selectedIds.includes(item.id))
      : filteredFeedback;

    if (itemsToExport.length === 0) {
      toast.error("No items found to copy.");
      return;
    }

    let markdown = `# Feedback Report for Antigravity\n`;
    markdown += `Generated on: ${new Date().toLocaleString()}\n`;
    markdown += `Total items: ${itemsToExport.length}\n\n`;
    markdown += `| Type | Title/Name | Status | Date | User |\n`;
    markdown += `| --- | --- | --- | --- | --- |\n`;
    itemsToExport.forEach(item => {
      markdown += `| ${item.type.toUpperCase()} | ${item.title || "No Title"} | ${item.status} | ${new Date(item.created_at).toLocaleDateString()} | @${item.username || "anonymous"} |\n`;
    });
    markdown += `\n---\n\n`;

    itemsToExport.forEach((item, index) => {
      markdown += `### Item #${index + 1}: [${item.type.toUpperCase()}] ${item.title || "No Title"}\n`;
      markdown += `- **ID**: \`${item.id}\`\n`;
      markdown += `- **Status**: ${item.status}\n`;
      markdown += `- **Date**: ${new Date(item.created_at).toLocaleString()}\n`;
      markdown += `- **Username**: @${item.username || "anonymous"}\n`;
      if (item.user_email) markdown += `- **Email**: ${item.user_email}\n`;
      
      if (item.type === "bug" && item.severity) {
        markdown += `- **Severity**: ${item.severity.toUpperCase()}\n`;
      }
      if (item.type === "exercise") {
        if (item.target_muscle) markdown += `- **Target Muscle**: ${item.target_muscle}\n`;
        if (item.equipment) markdown += `- **Equipment**: ${item.equipment}\n`;
      }

      if (item.description) {
        markdown += `- **Details/Steps**:\n  \`\`\`text\n  ${item.description.replace(/\n/g, "\n  ")}\n  \`\`\`\n`;
      }

      if (item.device_metadata) {
        const meta = item.device_metadata;
        markdown += `#### Client Diagnostics:\n`;
        markdown += `- **Operating System**: ${meta.os || "Unknown"}\n`;
        markdown += `- **Screen Resolution**: ${meta.screenResolution || "Unknown"}\n`;
        markdown += `- **Viewport Size**: ${meta.viewportSize || "Unknown"}\n`;
        markdown += `- **User Agent**: \`${meta.userAgent || "Unknown"}\`\n`;
        if (meta.connectionState) {
          markdown += `- **Network Info**: Connection: ${meta.connectionState}, Network Type: ${meta.effectiveNetworkType || "Unknown"}\n`;
        }
      }
      markdown += `\n---\n\n`;
    });

    navigator.clipboard.writeText(markdown)
      .then(() => {
        toast.success(`Copied ${itemsToExport.length} feedback items to clipboard!`);
      })
      .catch((err) => {
        console.error("Clipboard copy failed:", err);
        toast.error("Failed to copy to clipboard.");
      });
  };

  // Render Loader
  if (!mounted || isProfileLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050505] text-white">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-accent-green animate-spin" />
          <span className="text-sm text-text-muted">Loading profile status...</span>
        </div>
      </main>
    );
  }

  // 403 Access Denied
  if (!profile || profile.is_admin !== true) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-6 bg-[#050505] text-white">
        <div className="glass-card max-w-md w-full p-8 rounded-3xl border border-red-500/20 text-center flex flex-col items-center gap-5">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/35">
            <ShieldAlert className="w-8 h-8 text-red-500" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white uppercase">403 - Access Denied</h1>
            <p className="text-sm text-text-muted mt-3">
              Your account does not have administrator privileges required to access the feedback dashboard.
            </p>
          </div>
          <Link
            href="/profile"
            className="w-full py-3.5 rounded-xl bg-white text-black font-extrabold text-sm hover:bg-white/90 transition-colors text-center"
          >
            Return to Profile
          </Link>
        </div>
      </main>
    );
  }

  // Count active pending categories
  const pendingBugs = feedback.filter(item => item.type === "bug" && item.status === "pending").length;
  const pendingSuggestions = feedback.filter(item => item.type === "suggestion" && item.status === "pending").length;
  const pendingExercises = feedback.filter(item => item.type === "exercise" && item.status === "pending").length;
  const pendingGeneral = feedback.filter(item => item.type === "general" && item.status === "pending").length;

  const visibleIds = filteredFeedback.map(f => f.id);
  const isAllVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.includes(id));

  return (
    <main className="flex min-h-screen flex-col pt-[calc(var(--notch-top)+1rem)] pb-32 px-4 bg-[#050505] text-white">
      <header className="w-full flex items-center justify-between py-4 mb-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <Link href="/profile/feedback" className="p-2 bg-white/5 rounded-full border border-white/10 hover:bg-white/10 transition-colors">
            <ChevronLeft className="w-5 h-5 text-white" />
          </Link>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-white">Admin Feedback Hub</h1>
            <span className="text-[10px] text-accent-green font-bold uppercase tracking-wider">Role Gated Dashboard</span>
          </div>
        </div>
        
        <button
          onClick={fetchFeedback}
          disabled={isFeedbackLoading}
          className="text-xs text-accent-green hover:text-accent-green/80 font-bold border border-accent-green/20 bg-accent-green/5 rounded-xl px-3 py-1.5 transition-colors flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFeedbackLoading ? "animate-spin" : ""}`} />
          Sync
        </button>
      </header>

      {/* Analytics Badges */}
      <section className="grid grid-cols-4 gap-2 mb-4">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex flex-col items-center justify-center text-center">
          <span className="text-[9px] uppercase font-bold text-red-400">Bugs</span>
          <span className="text-lg font-black text-white mt-1">{pendingBugs}</span>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex flex-col items-center justify-center text-center">
          <span className="text-[9px] uppercase font-bold text-blue-400">Ideas</span>
          <span className="text-lg font-black text-white mt-1">{pendingSuggestions}</span>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex flex-col items-center justify-center text-center">
          <span className="text-[9px] uppercase font-bold text-purple-400">Exercises</span>
          <span className="text-lg font-black text-white mt-1">{pendingExercises}</span>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex flex-col items-center justify-center text-center">
          <span className="text-[9px] uppercase font-bold text-gray-400">General</span>
          <span className="text-lg font-black text-white mt-1">{pendingGeneral}</span>
        </div>
      </section>

      {/* Filters */}
      <section className="glass-card p-4 rounded-3xl border border-white/10 mb-4 flex flex-col gap-3 bg-white/5">
        <div className="flex flex-col gap-1.5 md:flex-row md:items-center justify-between">
          <div className="flex items-center justify-between text-xs w-full">
            <span className="font-bold text-text-muted uppercase tracking-widest text-[9px]">Category</span>
            <div className="flex flex-wrap gap-1">
              {["all", "bug", "suggestion", "exercise", "general"].map((t) => (
                <button 
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={`px-2 py-1 rounded-lg font-bold text-[9px] capitalize border transition-all
                    ${typeFilter === t ? "bg-white text-black border-white" : "text-text-muted border-white/10 hover:text-white"}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs border-t border-white/5 pt-3">
          <span className="font-bold text-text-muted uppercase tracking-widest text-[9px]">Status</span>
          <div className="flex gap-1.5">
            {["all", "pending", "reviewed", "archived"].map((s) => (
              <button 
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2 py-1 rounded-lg font-bold text-[9px] capitalize border transition-all
                  ${statusFilter === s ? "bg-white text-black border-white" : "text-text-muted border-white/10 hover:text-white"}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Bulk Action Buttons */}
        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2 p-2 bg-black/40 rounded-xl border border-white/5 mt-1 animate-fade-in">
            <span className="text-[10px] text-text-muted font-bold">
              {selectedIds.length} selected
            </span>
            <div className="flex gap-1.5 ml-auto">
              <button
                onClick={() => handleBulkStatusUpdate("reviewed")}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-green-500/20 text-green-400 border border-green-500/30 text-[10px] font-bold hover:bg-green-500/30 transition-colors"
              >
                <CheckCircle className="w-3 h-3" /> Reviewed
              </button>
              <button
                onClick={() => handleBulkStatusUpdate("archived")}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-bold hover:bg-red-500/30 transition-colors"
              >
                <Archive className="w-3 h-3" /> Archive
              </button>
              <button
                onClick={() => setSelectedIds([])}
                className="text-[10px] text-text-muted hover:text-white px-2 py-1"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Main Feedback List */}
      <section className="flex-1 flex flex-col gap-3">
        {isFeedbackLoading && feedback.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-accent-green" />
            <span className="text-xs text-text-muted">Fetching feedback...</span>
          </div>
        ) : filteredFeedback.length === 0 ? (
          <div className="glass-card p-12 text-center rounded-3xl border border-dashed border-white/10 flex flex-col items-center justify-center gap-3">
            <Inbox className="w-8 h-8 text-text-muted" />
            <div>
              <p className="text-sm font-bold text-white">No feedback matching filters</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-2 py-1 border-b border-white/5 mb-1">
              <button 
                onClick={toggleSelectAll} 
                className="flex items-center gap-2 text-xs text-text-muted hover:text-white font-bold transition-colors"
              >
                {isAllVisibleSelected ? (
                  <CheckSquare className="w-4 h-4 text-accent-green" />
                ) : (
                  <Square className="w-4 h-4 text-white/30" />
                )}
                Select All Visible ({filteredFeedback.length})
              </button>
              <span className="text-[10px] text-text-muted uppercase tracking-widest font-bold">List</span>
            </div>

            <div className="flex flex-col gap-3">
              {filteredFeedback.map((item) => {
                const isExpanded = expandedIds.includes(item.id);
                const isSelected = selectedIds.includes(item.id);

                const badgeColorMap = {
                  bug: "bg-red-500/10 text-red-400 border-red-500/20",
                  suggestion: "bg-blue-500/10 text-blue-400 border-blue-500/20",
                  exercise: "bg-purple-500/10 text-purple-400 border-purple-500/20",
                  general: "bg-gray-500/10 text-gray-400 border-white/10"
                };

                const statusColors = {
                  pending: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
                  reviewed: "bg-green-500/10 text-green-400 border-green-500/20",
                  archived: "bg-white/10 text-text-muted border-white/5"
                };

                return (
                  <div
                    key={item.id}
                    className={`glass-card rounded-2xl border transition-all duration-200 overflow-hidden ${
                      isSelected 
                        ? "border-accent-green/45 bg-accent-green/5" 
                        : "border-white/10 hover:border-white/20 bg-white/3"
                    }`}
                  >
                    <div 
                      className="p-4 flex items-start gap-3 cursor-pointer select-none"
                      onClick={() => toggleExpand(item.id)}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelect(item.id);
                        }}
                        className="mt-0.5"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-accent-green" />
                        ) : (
                          <Square className="w-4 h-4 text-white/30 hover:text-white" />
                        )}
                      </button>

                      <div className="flex flex-col gap-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] uppercase tracking-widest font-black px-2 py-0.5 rounded border ${badgeColorMap[item.type]}`}>
                            {item.type}
                          </span>
                          
                          {item.status !== "pending" && (
                            <span className={`text-[9px] uppercase font-bold px-1.5 py-0.2 rounded-full border ${statusColors[item.status]}`}>
                              {item.status}
                            </span>
                          )}

                          {item.type === "bug" && item.severity && (
                            <span className="text-[9px] text-red-400 font-extrabold uppercase ml-auto">
                              {item.severity}
                            </span>
                          )}
                        </div>

                        <h3 className="font-extrabold text-sm text-white mt-1.5 truncate">
                          {item.title || item.description || "No Title"}
                        </h3>
                        <span className="text-[10px] text-text-muted">
                          {new Date(item.created_at).toLocaleString()} by @{item.username || "anonymous"}
                        </span>
                      </div>

                      <div className="text-white/40 mt-1">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-white/5 bg-black/30 text-xs text-white/90 flex flex-col gap-3 pt-3">
                        {item.description && (
                          <div className="flex flex-col gap-1">
                            <span className="text-[9px] uppercase font-bold text-text-muted tracking-wider">Details/Steps</span>
                            <p className="bg-black/40 p-2.5 rounded-lg border border-white/5 font-mono whitespace-pre-wrap leading-relaxed">
                              {item.description}
                            </p>
                          </div>
                        )}

                        {item.type === "exercise" && (item.target_muscle || item.equipment) && (
                          <div className="grid grid-cols-2 gap-3 bg-white/5 p-2.5 rounded-lg border border-white/5">
                            <div>
                              <span className="text-[9px] uppercase font-bold text-text-muted tracking-wider block">Muscle</span>
                              <span className="font-bold text-white">{item.target_muscle || "N/A"}</span>
                            </div>
                            <div>
                              <span className="text-[9px] uppercase font-bold text-text-muted tracking-wider block">Equipment</span>
                              <span className="font-bold text-white capitalize">{item.equipment || "N/A"}</span>
                            </div>
                          </div>
                        )}

                        {item.device_metadata && (
                          <div className="flex flex-col gap-1">
                            <span className="text-[9px] uppercase font-bold text-text-muted tracking-wider flex items-center gap-1">
                              <Activity className="w-3 h-3 text-accent-green" /> Device Diagnostics
                            </span>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 bg-black/40 p-2.5 rounded-lg border border-white/5 text-[11px] text-white/70">
                              <div><span className="text-text-muted font-bold">OS:</span> {item.device_metadata.os || "Unknown"}</div>
                              <div><span className="text-text-muted font-bold">Resolution:</span> {item.device_metadata.screenResolution || "Unknown"}</div>
                              <div><span className="text-text-muted font-bold">Viewport:</span> {item.device_metadata.viewportSize || "Unknown"}</div>
                              {item.device_metadata.connectionState && (
                                <div>
                                  <span className="text-text-muted font-bold">Network:</span> {item.device_metadata.connectionState} ({item.device_metadata.effectiveNetworkType || "N/A"})
                                </div>
                              )}
                              <div className="col-span-2 mt-1 pt-1 border-t border-white/5 truncate">
                                <span className="text-text-muted font-bold">User Agent:</span> <span className="font-mono text-[9px]">{item.device_metadata.userAgent || "Unknown"}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

      {/* Floating Copy Button */}
      <div className="fixed bottom-[calc(env(safe-area-inset-bottom,20px)+4.5rem)] left-4 right-4 flex justify-center z-40">
        <button
          onClick={handleCopyMarkdown}
          className="flex items-center justify-center gap-2 bg-accent-green text-black font-black text-xs uppercase tracking-widest px-6 py-4 rounded-full shadow-[0_4px_20px_rgba(74,222,128,0.4)] hover:bg-accent-green/90 transition-all hover:scale-105 active:scale-95"
        >
          <Copy className="w-4 h-4" />
          Copy Markdown for Antigravity {selectedIds.length > 0 ? `(${selectedIds.length})` : ""}
        </button>
      </div>
    </main>
  );
}
