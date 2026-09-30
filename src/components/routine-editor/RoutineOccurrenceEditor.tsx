'use client';

import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import type { PlannedExerciseOccurrence } from '@/types/routine';
import { TRACKING_LABELS, UNIT_LABELS } from '@/lib/routine-editor-controls';
import { occurrenceProgrammingPresentation, programmingRestLabel } from '@/lib/routine-cardio-presentation';
import { BufferedRoutineInput } from './BufferedRoutineInput';
import { OccurrenceRestControl } from './OccurrenceRestControl';

export function RoutineOccurrenceEditor({ occurrence, canMoveUp, canMoveDown, isSaving, defaultRest, onMove, onRemove }: {
  occurrence: PlannedExerciseOccurrence; canMoveUp: boolean; canMoveDown: boolean; isSaving: boolean;
  defaultRest: number; onMove: (direction: 'up' | 'down') => void; onRemove: () => void;
}) {
  const programming = occurrenceProgrammingPresentation(occurrence);
  const countInput = <BufferedRoutineInput field={{ kind: 'sets', occurrenceId: occurrence.id }} value={String(occurrence.targetSets)} label={programming.countLabel} numeric />;
  return <article id={`routine-occurrence-${occurrence.id}`} tabIndex={-1}
    aria-labelledby={`occurrence-name-${occurrence.id}`}
    className="min-w-0 space-y-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4 focus-visible:ring-2 focus-visible:ring-accent-green">
    <div className="flex min-w-0 items-start justify-between gap-2">
      <div className="min-w-0">
        <h4 id={`occurrence-name-${occurrence.id}`} className="break-words text-base font-bold leading-snug text-white">{occurrence.name}</h4>
        <p className="mt-1 break-words text-xs text-text-muted">{occurrence.targetMuscle} · {occurrence.section === 'warmup' ? 'Warm-up' : 'Main'}</p>
      </div>
      <button type="button" onClick={onRemove} disabled={isSaving} aria-label={`Remove ${occurrence.name}`}
        className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl text-red-300 hover:bg-red-500/10 focus-visible:ring-2 focus-visible:ring-red-300 disabled:opacity-40">
        <Trash2 className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
    <div className={programming.continuous ? 'min-w-0' : 'grid min-w-0 grid-cols-[5.5rem_minmax(0,1fr)] gap-3'}>
      {!programming.continuous && countInput}
      <BufferedRoutineInput field={{ kind: 'target', occurrenceId: occurrence.id }} value={occurrence.targetValue} label={programming.targetLabel} />
    </div>
    {programming.zone !== null && <p aria-label={`Intensity Zone ${programming.zone}`} className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-text-muted">Intensity</span><span className="rounded-lg border border-accent-green/25 bg-accent-green/10 px-2.5 py-1.5 font-semibold text-accent-green">Zone {programming.zone}</span>
    </p>}
    {programming.continuous && <details className="text-sm text-text-muted">
      <summary className="min-h-11 cursor-pointer rounded-lg py-3 focus-visible:ring-2 focus-visible:ring-accent-green">Continuous cardio · Adjust rounds</summary>
      <div className="w-28 pb-2">{countInput}</div>
    </details>}
    <dl className="flex flex-wrap gap-2 text-xs">
      <div className="rounded-lg border border-white/10 px-2.5 py-1.5"><dt className="sr-only">Tracking (read-only)</dt><dd>{TRACKING_LABELS[occurrence.trackingType]}</dd></div>
      <div className="rounded-lg border border-white/10 px-2.5 py-1.5"><dt className="sr-only">Unit (read-only)</dt><dd>{UNIT_LABELS[occurrence.weightUnit]}</dd></div>
    </dl>
    <OccurrenceRestControl occurrenceId={occurrence.id} restSeconds={occurrence.restSeconds} defaultRest={defaultRest}
      label={programmingRestLabel(programming.cardio, occurrence.targetSets)} />
    {occurrence.note && <p className="whitespace-pre-wrap break-words rounded-xl bg-black/30 p-3 text-sm leading-relaxed text-text-muted">{occurrence.note}</p>}
    <div className="flex flex-wrap gap-2 border-t border-white/5 pt-3">
      {(['up', 'down'] as const).map(direction => <button key={direction} type="button" onClick={() => onMove(direction)}
        disabled={direction === 'up' ? !canMoveUp : !canMoveDown} aria-label={`Move ${occurrence.name} ${direction}`}
        className="flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-3 text-sm text-white hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-accent-green disabled:opacity-30">
        {direction === 'up' ? <ArrowUp className="h-4 w-4" aria-hidden="true" /> : <ArrowDown className="h-4 w-4" aria-hidden="true" />} Move {direction}
      </button>)}
    </div>
  </article>;
}
