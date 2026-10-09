'use client';

import { ArrowDown, ArrowUp, Check, FileText, Pencil, Trash2 } from 'lucide-react';
import type { PlannedExerciseOccurrence } from '@/types/routine';
import { occurrenceProgrammingPresentation } from '@/lib/routine-cardio-presentation';
import { decodeTrackingConfig, encodeTrackingConfig, PROGRAMMING_TRACKING_TYPES, validateTrackingConfig, type PendingTrackingConfig } from '@/lib/routine-programming';
import { analyzeRoutineCompatibility, recoveryProgrammingOptions } from '@/lib/routine-compatibility';
import { savedValue, recoveryIssueHandling } from '@/lib/routine-recovery';
import type { RoutineReadOccurrence } from '@/types/routine-compatibility';
import { RoutineGuardedLink } from '@/components/RoutineDraftGuard';
import { compactOccurrenceSummary } from '@/lib/routine-editor-presentation';
import { useRoutineStore } from '@/store/useRoutineStore';
import { useBufferedField } from './BufferedRoutineInput';
import { OccurrenceProgrammingEditor, TrackingControls } from './OccurrenceProgrammingEditor';

function CurrentProgrammingFields({ occurrence, defaultRest }: { occurrence: PlannedExerciseOccurrence; defaultRest: number }) {
  const programming = occurrenceProgrammingPresentation(occurrence);
  const sets = useBufferedField({ kind: 'sets', occurrenceId: occurrence.id }, String(occurrence.targetSets));
  const target = useBufferedField({ kind: 'target', occurrenceId: occurrence.id }, occurrence.targetValue);
  const zone = useBufferedField({ kind: 'zone', occurrenceId: occurrence.id }, occurrence.cardioZone === null ? 'none' : String(occurrence.cardioZone));
  const rest = useBufferedField({ kind: 'rest', occurrenceId: occurrence.id }, occurrence.restSeconds === null ? 'default' : String(occurrence.restSeconds));
  const tracking = useBufferedField({ kind: 'tracking-config', occurrenceId: occurrence.id }, encodeTrackingConfig({ trackingType: occurrence.trackingType, weightUnit: occurrence.weightUnit }));
  let trackingValue = { trackingType: occurrence.trackingType, weightUnit: occurrence.weightUnit } as import('@/lib/routine-programming').PendingTrackingConfig;
  try { trackingValue = decodeTrackingConfig(tracking.raw); } catch { /* Keep the raw/error buffer; show last valid configuration. */ }
  return <OccurrenceProgrammingEditor cardio={programming.cardio} defaultRest={defaultRest}
    sets={{ id: `editor-sets:${occurrence.id}`, ...sets }} target={{ id: `editor-target:${occurrence.id}`, ...target }}
    zone={{ id: `editor-zone:${occurrence.id}`, ...zone }} rest={{ id: `rest-${occurrence.id}`, ...rest }}
    tracking={{ id: `editor-tracking-config:${occurrence.id}`, value: trackingValue, error: tracking.error,
      change: config => tracking.change(encodeTrackingConfig(config)), commit: tracking.commit }}
    optionsFor={mode => useRoutineStore.getState().occurrenceProgrammingOptions(occurrence.id, mode)} />;
}

function RecoveryProgrammingFields({ occurrence }: { occurrence: RoutineReadOccurrence }) {
  const state = useRoutineStore(), f = occurrence.fields;
  const issues = state.compatibilityIssues.filter(issue => issue.target.kind === 'occurrence' && issue.target.occurrenceId === occurrence.id);
  const original = state.readBaseline ? analyzeRoutineCompatibility(state.readBaseline).filter(issue => issue.target.kind === 'occurrence' && issue.target.occurrenceId === occurrence.id) : [];
  const inline = original.length > 0 && recoveryIssueHandling(original) === 'inline' && state.readGraph && recoveryProgrammingOptions(state.readGraph, occurrence.id, null).trackingTypes.length > 0;
  let value: PendingTrackingConfig = { trackingType: PROGRAMMING_TRACKING_TYPES.find(mode => mode === f.trackingType) ?? null, weightUnit: null };
  try { const config = { trackingType: f.trackingType, weightUnit: f.weightUnit }; validateTrackingConfig(config as PendingTrackingConfig); value = config as PendingTrackingConfig; } catch { /* Display a placeholder, never infer or mutate the stored pair. */ }
  const buffer = state.editorBuffers[`tracking-config:${occurrence.id}`];
  if (buffer) { try { value = decodeTrackingConfig(buffer.raw); } catch { /* Preserve a malformed buffer for explicit correction. */ } }
  return <div className="space-y-4">
    <dl className="grid grid-cols-2 gap-3 text-xs">
      {([['Sets / rounds', f.targetSets], ['Target / prescription', f.targetValue], ['Stored tracking', f.trackingType], ['Stored load unit', f.weightUnit], ['Intensity', f.cardioZone], ['Rest seconds', f.restSeconds]] as const).map(([label, raw]) => <div key={label} className="min-w-0"><dt className="text-white/50">{label}</dt><dd className="mt-1 break-words font-semibold text-white">{savedValue(raw)}</dd></div>)}
    </dl>
    {inline ? <>
      <p className="text-xs leading-relaxed text-white/60">Choose the intended tracking and load unit. No unit has been selected for you.</p>
      <TrackingControls disabled={state.isSaving || state.replacementPending} tracking={{ id: `editor-tracking-config:${occurrence.id}`, value, error: buffer?.error ?? issues[0]?.message ?? null,
        change: config => state.setRecoveryTrackingBuffer(occurrence.id, config) }} optionsFor={mode => { const options = recoveryProgrammingOptions(state.readGraph!, occurrence.id, mode); return { trackingTypes: [...options.trackingTypes], units: [...options.units] }; }} />
      <button type="button" disabled={state.isSaving || state.replacementPending} className="min-h-11 rounded-xl border border-white/15 px-3 text-xs text-white/70" onClick={() => state.revertRecoveryOccurrence(occurrence.id)}>Restore original settings</button>
    </> : original.length > 0 ? <div className="text-sm text-amber-200"><p>This saved programming cannot be safely corrected inline. Keep a private backup, then choose a replacement or contact support.</p><RoutineGuardedLink className="mt-2 inline-flex min-h-11 items-center text-accent-green" href="/routines/templates">Browse Templates</RoutineGuardedLink></div> : <p className="text-xs text-white/50">Saved programming is preserved. Resolve the highlighted settings before other edits.</p>}
  </div>;
}

export function RoutineOccurrenceEditor({ occurrence: entry, expanded = false, reordering = false, onEdit, onDone, canMoveUp, canMoveDown, isSaving, defaultRest, onMove, onRemove }: {
  occurrence: PlannedExerciseOccurrence | RoutineReadOccurrence; expanded?: boolean; reordering?: boolean; onEdit?: () => void; onDone?: () => void;
  canMoveUp: boolean; canMoveDown: boolean; isSaving: boolean;
  defaultRest: number; onMove: (direction: 'up' | 'down') => void; onRemove: () => void;
}) {
  const state = useRoutineStore(), recovery = 'fields' in entry;
  const occurrence = recovery ? { id: entry.id, name: savedValue(entry.fields.name), targetMuscle: savedValue(entry.fields.targetMuscle), section: savedValue(entry.fields.section), note: entry.fields.note == null ? undefined : savedValue(entry.fields.note) } : entry;
  const programming = recovery ? { cardio: false } : occurrenceProgrammingPresentation(entry);
  const summary = recovery ? { prescription: `${savedValue(entry.fields.targetSets)} × ${savedValue(entry.fields.targetValue)}`, unit: savedValue(entry.fields.weightUnit), zone: typeof entry.fields.cardioZone === 'number' && entry.fields.cardioZone >= 1 && entry.fields.cardioZone <= 5 ? entry.fields.cardioZone : null, rest: `Rest: ${savedValue(entry.fields.restSeconds)}` } : compactOccurrenceSummary(entry);
  const attention = recovery && state.compatibilityIssues.some(issue => issue.target.kind === 'occurrence' && issue.target.occurrenceId === entry.id);
  const panelId = `occurrence-editor-${occurrence.id}`;
  return <article id={`routine-occurrence-${occurrence.id}`} tabIndex={-1}
    aria-labelledby={`occurrence-name-${occurrence.id}`}
    className={`min-w-0 transition-all focus-visible:ring-2 focus-visible:ring-accent-green ${
      expanded
        ? 'rounded-2xl border border-[rgba(74,222,128,0.48)] bg-[#111613] p-4 sm:p-5 shadow-[0_0_24px_rgba(74,222,128,0.06)] my-2.5'
        : 'p-3.5 sm:p-4 hover:bg-white/[0.02]'
    }`}>
    <div className="flex min-w-0 items-start justify-between gap-3">
      <div className="min-w-0">
        <h4 id={`occurrence-name-${occurrence.id}`} className="break-words text-[15px] sm:text-base font-bold leading-snug tracking-[-0.01em] text-white">{occurrence.name}</h4>
        <p className="mt-0.5 break-words text-xs text-white/50">{occurrence.targetMuscle} · {recovery ? savedValue(entry.fields.section) : occurrence.section === 'warmup' ? 'Warm-up' : 'Main'}</p>
        {attention && <p className="mt-1 text-xs font-semibold text-amber-300">Settings need review</p>}
      </div>
      {expanded ? (
        <span className="shrink-0 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
          {recovery ? 'Reviewing' : programming.cardio ? 'Editing Cardio' : 'Editing'}
        </span>
      ) : (
        <button id={`occurrence-edit-${occurrence.id}`} type="button" onClick={onEdit}
          aria-label={`Edit ${occurrence.name}`} aria-expanded={false} aria-controls={panelId}
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-semibold text-white/60 hover:bg-white/[0.08] hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-accent-green">
          <Pencil className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only sm:not-sr-only">Edit</span>
        </button>
      )}
    </div>
    {!expanded && <>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs text-white/70">
        <span className="font-extrabold text-[15px] text-white tabular-nums tracking-tight">{summary.prescription}</span>
        {summary.unit && <span className="rounded bg-white/[0.08] px-1.5 py-0.5 text-[11px] font-semibold text-white/60 uppercase">{summary.unit}</span>}
        {summary.zone !== null && <span aria-label={`Intensity Zone ${summary.zone}`} className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[11px] font-bold text-emerald-300">Zone {summary.zone}</span>}
        <span className="text-xs text-white/45">{summary.rest}</span>
        {occurrence.note && <span aria-label="Programming note available in editor" className="inline-flex items-center gap-1 text-xs text-white/40"><FileText aria-hidden="true" className="h-3 w-3" />Note</span>}
      </div>
      {reordering && <div className="mt-3 flex gap-2 border-t border-white/[0.06] pt-2.5">
        {(['up', 'down'] as const).map(direction => <button key={direction} type="button" onClick={() => onMove(direction)}
          disabled={isSaving || (direction === 'up' ? !canMoveUp : !canMoveDown)} aria-label={`Move ${occurrence.name} ${direction}`}
          className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-xs font-semibold text-white/80 hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-accent-green disabled:opacity-25 transition-colors">
          {direction === 'up' ? <ArrowUp className="h-4 w-4" aria-hidden="true" /> : <ArrowDown className="h-4 w-4" aria-hidden="true" />} Move {direction}
        </button>)}
      </div>}
    </>}
    <div id={panelId} hidden={!expanded}>
      {expanded && <div className="mt-4 space-y-4 border-t border-white/[0.06] pt-4">
        {recovery ? <RecoveryProgrammingFields occurrence={entry} /> : <CurrentProgrammingFields occurrence={entry} defaultRest={defaultRest} />}
        {occurrence.note && <div className="rounded-xl border border-white/[0.06] bg-black/40 p-3.5"><p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-white/50"><FileText className="h-3.5 w-3.5" aria-hidden="true" />Programming note</p>
          {programming.cardio && /\bzone\s+[0-9]+\b/i.test(occurrence.note) && <p className="mb-2 text-xs leading-relaxed text-white/45">Original source wording. Intensity above is your current setting; Zone wording in this note is not updated automatically.</p>}
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-white/70">{occurrence.note}</p></div>}
        <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] pt-3">
          {!recovery && <button type="button" onClick={onRemove} disabled={isSaving} aria-label={`Remove ${occurrence.name}`}
            className="flex min-h-11 items-center gap-2 rounded-xl px-2 text-xs font-semibold text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors focus-visible:ring-2 focus-visible:ring-red-400 disabled:opacity-40"><Trash2 className="h-4 w-4" aria-hidden="true" />Remove</button>}
          <button type="button" onClick={onDone} aria-label={`Done editing ${occurrence.name}`} className="flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-5 text-sm font-bold text-white hover:bg-white/15 transition-colors focus-visible:ring-2 focus-visible:ring-accent-green"><Check className="h-4 w-4" aria-hidden="true" />Done</button>
        </div>
        <p className="text-[11px] text-center sm:text-left text-white/40">Done closes this card. Save Changes saves your routine.</p>
      </div>}
    </div>
  </article>;
}
