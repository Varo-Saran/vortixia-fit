'use client';

import { Check, Pencil } from 'lucide-react';
import { BufferedRoutineInput } from './BufferedRoutineInput';

export function RoutineInformation({ name, count, expanded, onEdit, onDone }: {
  name: string; count: number; expanded: boolean; onEdit: () => void; onDone: () => void;
}) {
  return <section className="rounded-2xl border border-white/[0.06] bg-[#0e1210] p-4 sm:p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">Your routine</p>
        <h2 className="break-words text-lg sm:text-xl font-bold leading-snug tracking-[-0.02em] text-white">{name}</h2>
        <p className="mt-1.5 text-xs text-white/50"><span className="tabular-nums font-semibold">7</span> days · <span className="tabular-nums font-semibold">{count}</span> exercises</p>
      </div>
      <button id="routine-settings-toggle" type="button" aria-label={expanded ? 'Done editing routine name' : 'Edit routine name'} aria-expanded={expanded} aria-controls="routine-settings-panel" onClick={expanded ? onDone : onEdit}
        className="flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-xs font-semibold text-white/70 hover:bg-white/[0.08] hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-accent-green">
        {expanded ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Pencil className="h-3.5 w-3.5" aria-hidden="true" />}{expanded ? 'Done' : 'Edit'}
      </button>
    </div>
    <div id="routine-settings-panel" hidden={!expanded}>{expanded && <div className="mt-4 border-t border-white/[0.06] pt-4"><BufferedRoutineInput field={{ kind: 'routine-name' }} value={name} label="Routine name" /><p className="mt-2 text-xs text-white/35">Changes only your routine, not its source template.</p></div>}</div>
  </section>;
}
