"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, MessageSquare, UserPlus, Zap, Info, ArrowLeft, Trash2, CheckCircle2, Swords } from "lucide-react";
import Link from "next/link";
import { useNotificationStore } from "@/store/useNotificationStore";

export default function NotificationsPage() {
  const { notifications, fetchNotifications, markAsRead } = useNotificationStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function init() {
      await fetchNotifications();
      setIsLoading(false);
    }
    init();
  }, [fetchNotifications]);

  const getIcon = (type: string) => {
    switch (type) {
      case "friend_request": return <UserPlus className="w-5 h-5 text-purple-400" />;
      case "duel_challenge": return <Swords className="w-5 h-5 text-accent-red" />;
      case "system_alert": return <Info className="w-5 h-5 text-gray-400" />;
      // Fallbacks
      case "like": return <Heart className="w-5 h-5 text-pink-500" />;
      case "comment": return <MessageSquare className="w-5 h-5 text-blue-400" />;
      case "workout": return <Zap className="w-5 h-5 text-accent-green" />;
      default: return <Info className="w-5 h-5 text-gray-400" />;
    }
  };

  const getBgColor = (type: string) => {
    switch (type) {
      case "friend_request": return "bg-purple-400/10 border-purple-400/20";
      case "duel_challenge": return "bg-accent-red/10 border-accent-red/20";
      case "system_alert": return "bg-gray-400/10 border-gray-400/20";
      // Fallbacks
      case "like": return "bg-pink-500/10 border-pink-500/20";
      case "comment": return "bg-blue-400/10 border-blue-400/20";
      case "workout": return "bg-accent-green/10 border-accent-green/20";
      default: return "bg-white/5 border-white/10";
    }
  };

  const formatTime = (isoString: string) => {
    if (!isoString) return "Just now";
    const date = new Date(isoString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  return (
    <div className="min-h-screen bg-black text-white pb-24 overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-xl border-b border-white/10 pt-[env(safe-area-inset-top,20px)]">
        <div className="flex items-center justify-between px-6 py-4 max-w-2xl mx-auto">
          <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-xl font-bold tracking-tight">Notifications</h1>
          <div className="w-10"></div> {/* Spacer for center alignment */}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 pt-6">
        {isLoading ? (
          <div className="flex justify-center items-center h-40">
            <div className="w-8 h-8 border-2 border-accent-green border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : notifications.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center h-64 text-center"
          >
            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-10 h-10 text-white/20" />
            </div>
            <h2 className="text-xl font-semibold mb-2">All caught up!</h2>
            <p className="text-text-muted">You don't have any new notifications right now.</p>
          </motion.div>
        ) : (
          <div className="flex flex-col gap-3">
            <AnimatePresence mode="popLayout">
              {notifications.map((notif) => (
                <motion.div
                  key={notif.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, x: -100 }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  className="relative group"
                >
                  {/* Background Action (Swipe to delete) */}
                  <div className="absolute inset-0 bg-red-500/20 rounded-2xl flex items-center justify-end px-6 border border-red-500/30">
                    <Trash2 className="w-6 h-6 text-red-500" />
                  </div>

                  {/* Foreground Card */}
                  <motion.div
                    drag="x"
                    dragConstraints={{ left: -100, right: 0 }}
                    dragElastic={0.2}
                    onDragEnd={(e, info) => {
                      if (info.offset.x < -80) {
                        markAsRead(notif.id);
                      }
                    }}
                    onClick={() => notif.status === 'unread' && markAsRead(notif.id)}
                    className={`relative w-full p-4 rounded-2xl backdrop-blur-md border transition-colors ${
                      notif.status === 'read'
                        ? 'bg-white/[0.03] border-white/5' 
                        : 'bg-white/[0.08] border-white/15'
                    }`}
                  >
                    <div className="flex gap-4 items-start">
                      {/* Icon/Avatar */}
                      <div className="relative shrink-0">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center border ${getBgColor(notif.type)}`}>
                          {getIcon(notif.type)}
                        </div>
                        {/* Status dot for unread */}
                        {notif.status === 'unread' && (
                          <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-accent-green shadow-[0_0_10px_rgba(74,222,128,0.8)] border-2 border-black" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2 mb-1">
                          <h3 className={`text-sm font-semibold truncate ${notif.status === 'read' ? 'text-white/80' : 'text-white'}`}>
                            {notif.title}
                          </h3>
                          <span className="text-xs text-text-muted whitespace-nowrap mt-0.5">
                            {formatTime(notif.createdAt)}
                          </span>
                        </div>
                        <p className={`text-sm line-clamp-2 ${notif.status === 'read' ? 'text-text-muted/80' : 'text-text-muted'}`}>
                          {notif.message}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>
    </div>
  );
}

