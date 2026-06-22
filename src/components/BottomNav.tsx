"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Swords, HeartPulse, UserCircle, ClipboardList } from "lucide-react";

export default function BottomNav() {
  const pathname = usePathname();

  // Hide on specific full-screen flows
  if (pathname === "/settings" || pathname === "/login" || pathname === "/workout/active") {
    return null;
  }

  const navItems = [
    { name: "Home", href: "/", icon: Home },
    { name: "Routines", href: "/routines", icon: ClipboardList },
    { name: "Social", href: "/social", icon: Swords },
    { name: "Recovery", href: "/recovery", icon: HeartPulse },
  ];

  return (
    <nav className="fixed bottom-0 left-0 w-full bg-black/80 backdrop-blur-xl border-t border-white/5 pb-[env(safe-area-inset-bottom,20px)] pt-3 px-6 z-50">
      <div className="flex justify-between items-center max-w-md mx-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          
          return (
            <Link 
              key={item.name} 
              href={item.href}
              className={`flex flex-col items-center gap-1 transition-all duration-300 ${isActive ? 'text-accent-green drop-shadow-[0_0_8px_rgba(74,222,128,0.5)] scale-110' : 'text-text-muted hover:text-white'}`}
            >
              <Icon className={`w-6 h-6 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
              <span className={`text-[10px] font-bold tracking-wider ${isActive ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'} transition-all duration-300`}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
