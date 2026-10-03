'use client';

import { ArrowDown, ArrowUp, Check, FileText, Pencil, Trash2 } from 'lucide-react';
import type { PlannedExerciseOccurrence } from '@/types/routine';
import { occurrenceProgrammingPresentation } from '@/lib/routine-cardio-presentation';
import { decodeTrackingConfig, encodeTrackingConfig } from '@/lib/routine-programming';
import { compactOccurrenceSummary } from '@/lib/routine-editor-presentation';
import { useRoutineStore } from '@/store/useRoutineStore';
import { useBufferedField } from './BufferedRoutineInput';
import { OccurrenceProgrammingEditor } from './OccurrenceProgrammingEditor';

export function RoutineOccurrenceEditor({ occurrence, expanded = false, reordering = false, onEdit, onDone, canMoveUp, canMoveDown, isSaving, defaultRest, onMove, onRemove }: {
  occurrence: PlannedExerciseOccurrence; expanded?: boolean; reordering?: boolean; onEdit?: () => void; onDone?: () => void;
  canMoveUp: boolean; canMoveDown: boolean; isSaving: boolean;
  defaultRest: number; onMove: (direction: 'up' | 'down') => void; onRemove: () => void;
}) {
  const programming = occurrenceProgrammingPresentation(occurrence);
  const summary = compactOccurrenceSummary(occurrence);
  const sets = useBufferedField({ kind: 'sets', occurrenceId: occurrence.id }, String(occurrence.targetSets));
  const target = useBufferedField({ kind: 'target', occurrenceId: occurrence.id }, occurrence.targetValue);
  const zone = useBufferedField({ kind: 'zone', occurrenceId: occurrence.id }, occurrence.cardioZone === null ? 'none' : String(occurrence.cardioZone));
  const rest = useBufferedField({ kind: 'rest', occurrenceId: occurrence.id }, occurrence.restSeconds === null ? 'default' : String(occurrence.restSeconds));
  const tracking = useBufferedField({ kind: 'tracking-config', occurrenceId: occurrence.id }, encodeTrackingConfig({ trackingType: occurrence.trackingType, weightUnit: occurrence.weightUnit }));
  let trackingValue = { trackingType: occurrence.trackingType, weightUnit: occurrence.weightUnit } as import('@/lib/routine-programming').PendingTrackingConfig;
  try { trackingValue = decodeTrackingConfig(tracking.raw); } catch { /* Keep the raw/error buffer; show last valid configuration. */ }
  const panelId = `occurrence-editor-${occurrence.id}`;
  return <article id={`routine-occurrence-${occurrence.id}`} tabIndex={-1}
    aria-labelledby={`occurrence-name-${occurrence.id}`}
    className={`min-w-0 rounded-[18px] border p-4 transition-colors focus-visible:ring-2 focus-visible:ring-accent-green ${expanded ? 'border-white/15 bg-white/[0.055] shadow-lg shadow-black/15' : 'border-white/[0.07] bg-white/[0.025]'}`}>
    <div className="flex min-w-0 items-start justify-between gap-3">
      <div className="min-w-0">
        <h4 id={`occurrence-name-${occurrence.id}`} className="break-words text-[15px] font-semibold leading-snug tracking-[-0.01em] text-white sm:text-base">{occurrence.name}</h4>
        <p className="mt-1 break-words text-xs text-white/45">{occurrence.targetMuscle} · {occurrence.section === 'warmup' ? 'Warm-up' : 'Main'}</p>
      </div>
      <button id={`occurrence-edit-${occurrence.id}`} type="button" onClick={expanded ? onDone : onEdit}
        aria-label={`${expanded ? 'Done editing' : 'Edit'} ${occurrence.name}`} aria-expanded={expanded} aria-controls={panelId}
        className={`flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-accent-green ${expanded ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}>
        {expanded ? <Check className="h-4 w-4" aria-hidden="true" /> : <Pencil className="h-4 w-4" aria-hidden="true" />}
        {expanded ? 'Done' : <span className="sr-only sm:not-sr-only">Edit</span>}
      </button>
    </div>
    {!expanded && <>
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2 text-[13px] leading-5 text-white/80">
        <span className="font-medium">{summary.prescription}</span>
        {summary.unit && <span className="rounded-md bg-white/5 px-1.5 text-xs text-white/50">{summary.unit}</span>}
        {summary.zone !== null && <span aria-label={`Intensity Zone ${summary.zone}`} className="rounded-md bg-emerald-300/[0.08] px-2 text-xs text-emerald-200/80">Zone {summary.zone}</span>}
        <span className="text-xs text-white/45">{summary.rest}</span>
        {occurrence.note && <span aria-label="Programming note available in editor" className="inline-flex items-center gap-1 text-xs text-white/40"><FileText aria-hidden="true" className="h-3 w-3" />Note</span>}
      </div>
      {reordering && <div className="mt-3 flex gap-2 border-t border-white/5 pt-3">
        {(['up', 'down'] as const).map(direction => <button key={direction} type="button" onClick={() => onMove(direction)}
          disabled={isSaving || (direction === 'up' ? !canMoveUp : !canMoveDown)} aria-label={`Move ${occurrence.name} ${direction}`}
          className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-white/5 px-3 text-xs font-medium text-white/80 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-accent-green disabled:opacity-25">
          {direction === 'up' ? <ArrowUp className="h-4 w-4" aria-hidden="true" /> : <ArrowDown className="h-4 w-4" aria-hidden="true" />} Move {direction}
        </button>)}
      </div>}
    </>}
    <div id={panelId} hidden={!expanded}>
      {expanded && <div className="mt-5 space-y-4 border-t border-white/[0.07] pt-5">
        <OccurrenceProgrammingEditor cardio={programming.cardio} defaultRest={defaultRest}
          sets={{ id: `editor-sets:${occurrence.id}`, ...sets }} target={{ id: `editor-target:${occurrence.id}`, ...target }}
          zone={{ id: `editor-zone:${occurrence.id}`, ...zone }} rest={{ id: `rest-${occurrence.id}`, ...rest }}
          tracking={{ id: `editor-tracking-config:${occurrence.id}`, value: trackingValue, error: tracking.error,
            change: config => tracking.change(encodeTrackingConfig(config)), commit: tracking.commit }}
          optionsFor={mode => useRoutineStore.getState().occurrenceProgrammingOptions(occurrence.id, mode)} />
        {occurrence.note && <div className="rounded-xl bg-black/20 p-3.5"><p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-white/50"><FileText className="h-3.5 w-3.5" aria-hidden="true" />Programming note</p>
          {programming.cardio && /\bzone\s+[0-9]+\b/i.test(occurrence.note) && <p className="mb-2 text-xs leading-relaxed text-white/45">Original source wording. Intensity above is your current setting; Zone wording in this note is not updated automatically.</p>}
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-text-muted">{occurrence.note}</p></div>}
        <div className="flex items-center justify-between gap-3 border-t border-white/5 pt-3">
          <button type="button" onClick={onRemove} disabled={isSaving} aria-label={`Remove ${occurrence.name}`}
            className="flex min-h-11 items-center gap-2 rounded-xl px-2 text-xs font-medium text-red-200/70 hover:bg-red-500/5 focus-visible:ring-2 focus-visible:ring-red-300 disabled:opacity-40"><Trash2 className="h-4 w-4" aria-hidden="true" />Remove</button>
          <button type="button" onClick={onDone} aria-label={`Done editing ${occurrence.name}`} className="flex min-h-11 items-center gap-2 rounded-xl bg-white/10 px-4 text-sm font-semibold hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-accent-green"><Check className="h-4 w-4" aria-hidden="true" />Done</button>
        </div>
        <p className="text-[11px] text-white/35">Done closes this card. Save Changes saves your routine.</p>
      </div>}
    </div>
  </article>;
}
