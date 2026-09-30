'use client';

import { Check, Pencil } from 'lucide-react';
import { BufferedRoutineInput } from './BufferedRoutineInput';

export function RoutineInformation({ name, count, expanded, onEdit, onDone }: {
  name: string; count: number; expanded: boolean; onEdit: () => void; onDone: () => void;
}) {
  return <section className="rounded-[22px] border border-white/[0.08] bg-gradient-to-br from-white/[0.055] to-white/[0.015] p-4 shadow-lg shadow-black/10 sm:p-5">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0"><p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">Your routine</p>
        <h2 className="break-words text-lg font-semibold leading-snug tracking-[-0.025em]">{name}</h2>
        <p className="mt-2 text-xs text-white/45">7 days · {count} exercises</p>
      </div>
      <button id="routine-settings-toggle" type="button" aria-label={expanded ? 'Done editing routine name' : 'Edit routine name'} aria-expanded={expanded} aria-controls="routine-settings-panel" onClick={expanded ? onDone : onEdit}
        className="flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-medium text-white/65 hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-accent-green">
        {expanded ? <Check className="h-4 w-4" aria-hidden="true" /> : <Pencil className="h-4 w-4" aria-hidden="true" />}{expanded ? 'Done' : 'Edit'}
      </button>
    </div>
    <div id="routine-settings-panel" hidden={!expanded}>{expanded && <div className="mt-4 border-t border-white/[0.07] pt-4"><BufferedRoutineInput field={{ kind: 'routine-name' }} value={name} label="Routine name" /><p className="mt-2 text-xs text-white/35">Changes only your routine, not its source template.</p></div>}</div>
  </section>;
}
