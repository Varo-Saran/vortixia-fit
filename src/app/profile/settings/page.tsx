import Link from "next/link";
import { ChevronLeft, Settings } from "lucide-react";

export default function SettingsPlaceholder() {
  return (
    <main className="flex min-h-screen flex-col pt-[var(--notch-top)] pb-24 px-6 bg-[#050505]">
      <header className="w-full flex items-center gap-4 py-4 mb-6">
        <Link href="/profile" className="p-2 bg-white/5 rounded-full border border-white/10 hover:bg-white/10 transition-colors" aria-label="Go back">
          <ChevronLeft className="w-5 h-5 text-white" />
        </Link>
        <h1 className="text-2xl font-extrabold tracking-tight text-white">App Settings</h1>
      </header>
      
      <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50">
        <Settings className="w-16 h-16 text-text-muted mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Coming Soon</h2>
        <p className="text-sm text-text-muted max-w-[250px]">Notification filters, theme preferences, and account management.</p>
      </div>
    </main>
  );
}
