"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function SettingsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/settings");
  }, [router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#050505] text-white">
      <Loader2 className="w-8 h-8 text-accent-green animate-spin" />
    </main>
  );
}
