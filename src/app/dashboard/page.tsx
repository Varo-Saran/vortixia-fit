import { Sun } from "lucide-react";

export default function Dashboard() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <h1 className="text-4xl font-extrabold mb-4 tracking-tight flex items-center justify-center gap-3">
        Good morning <Sun className="w-8 h-8 text-yellow-400" />, <span className="text-accent-green">Alex</span>
      </h1>
      <p className="text-text-muted mb-8 text-sm">
        Dashboard under construction.
      </p>
    </main>
  );
}
