'use client';

import { useRef } from 'react';
import { X } from 'lucide-react';
import { getExerciseById } from '@/lib/exercise-catalog';
import { isCatalogCardio, programmingRestLabel } from '@/lib/routine-cardio-presentation';
import { addTrackingOptions, addUnitOptions, changeAddTracking, isWeightedMode, parseRestInput, pendingAddErrors, TRACKING_LABELS, UNIT_LABELS } from '@/lib/routine-editor-controls';
import { useRoutineStore } from '@/store/useRoutineStore';
import type { ExerciseSection, TrackingType, WeightUnit } from '@/types/routine';
import { editorInputClass } from './BufferedRoutineInput';
import { RestControl } from './OccurrenceRestControl';
import { useRoutineDialog } from './useRoutineDialog';
import { Select } from '@/components/ui/Select';

export function AddExerciseDrawer({ onAdded, onChooseAnother, onCancel, defaultRest }: {
  onAdded: (dayId: string, occurrenceId: string) => void; onChooseAnother: (dayId: string) => void;
  onCancel: (dayId: string) => void; defaultRest: number;
}) {
  const { pendingAdd: pending, routine, setPendingAdd, commitPendingAdd, isSaving, error } = useRoutineStore();
  const ref = useRef<HTMLDivElement>(null);
  const close = () => {
    if (!isSaving && pending) { setPendingAdd(null); onCancel(pending.dayId); }
  };
  useRoutineDialog(!!pending, ref, close);
  const exercise = pending ? getExerciseById(pending.exerciseId) : undefined;
  const day = routine?.days.find(value => value.id === pending?.dayId);
  if (!pending || !exercise || !day) return null;
  const cardio = isCatalogCardio(exercise);
  const errors = pendingAddErrors(pending, exercise, day);
  const set = (updates: Partial<typeof pending>) => setPendingAdd({ ...pending, ...updates });
  const fieldProps = (key: string) => ({ 'aria-invalid': !!errors[key], 'aria-describedby': errors[key] ? `add-${key}-error` : undefined });
  const selectProps = (key: string) => ({ invalid: !!errors[key], describedBy: errors[key] ? `add-${key}-error` : undefined, triggerClassName: 'min-h-11' });
  const fieldError = (key: string) => errors[key] && <p id={`add-${key}-error`} className="text-xs text-red-300">{errors[key]}</p>;
  const add = () => {
    if (Object.keys(errors).length || isSaving) return;
    const before = new Set(day.exercises.map(value => value.id));
    try {
      commitPendingAdd();
      const added = useRoutineStore.getState().routine?.days.find(value => value.id === day.id)?.exercises.find(value => !before.has(value.id));
      if (added) onAdded(day.id, added.id);
    } catch { /* D2B retains the pending form and exposes the error. */ }
  };
  return <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/80 p-2 backdrop-blur-sm sm:items-center sm:p-6">
    <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="add-exercise-title" className="max-h-[90dvh] w-full max-w-lg space-y-5 overflow-y-auto rounded-3xl border border-white/10 bg-[#121515]/95 p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] shadow-2xl shadow-black/60 backdrop-blur-xl sm:p-6">
      <div className="flex items-start justify-between gap-2"><div className="min-w-0"><h2 id="add-exercise-title" className="break-words text-xl font-bold text-white">Add {exercise.displayName}</h2><p className="mt-1 text-xs text-text-muted">{exercise.primaryMuscle}</p></div>
        <button type="button" onClick={close} disabled={isSaving} aria-label="Cancel Add Exercise" className="flex min-h-11 min-w-11 items-center justify-center rounded-xl hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-accent-green"><X aria-hidden="true" className="h-5 w-5" /></button></div>
      {!exercise.defaultTrackingType && <p className="text-sm text-text-muted">Choose logging mode and unit explicitly. This imported exercise has no declared logging defaults.</p>}
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      <div className="space-y-1.5"><label htmlFor="add-section" className="block text-xs font-semibold text-text-muted">Section</label>
        <Select id="add-section" label="Section" value={pending.section} onValueChange={section => set({ section: section as ExerciseSection })} disabled={day.kind === 'recovery'} {...selectProps('section')}
          options={[...(day.kind === 'training' ? [{ value: 'warmup', label: 'Warm-up' }] : []), { value: 'main', label: day.kind === 'recovery' ? 'Recovery activities' : 'Main' }]} /></div>
      <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3">
        <div className="space-y-1.5"><label htmlFor="add-sets" className="block text-xs font-semibold text-text-muted">{cardio ? 'Rounds' : 'Sets'}</label><input id="add-sets" className={editorInputClass} type="number" inputMode="numeric" min={1} max={100} step={1} value={pending.rawSets} onChange={event => set({ rawSets: event.target.value })} {...fieldProps('sets')} />{fieldError('sets')}</div>
        <div className="min-w-0 space-y-1.5"><label htmlFor="add-target" className="block text-xs font-semibold text-text-muted">{cardio ? 'Duration / prescription' : 'Target / prescription'}</label><input id="add-target" className={editorInputClass} value={pending.rawTarget} placeholder={cardio ? 'e.g. 20–25 mins' : 'e.g. 10–12'} onChange={event => set({ rawTarget: event.target.value })} {...fieldProps('target')} />{fieldError('target')}</div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5"><label htmlFor="add-tracking" className="block text-xs font-semibold text-text-muted">Logging mode</label>
          <Select id="add-tracking" label="Logging mode" value={pending.trackingType ?? ''} placeholder="Choose logging mode" onValueChange={mode => setPendingAdd(changeAddTracking(pending, mode as TrackingType))} {...selectProps('tracking')}
            options={addTrackingOptions(exercise).map(mode => ({ value: mode, label: TRACKING_LABELS[mode] }))} />{fieldError('tracking')}</div>
        <div className="space-y-1.5"><label htmlFor="add-unit" className="block text-xs font-semibold text-text-muted">Load unit</label>
          <Select id="add-unit" label="Load unit" value={pending.weightUnit ?? ''} placeholder="Choose unit" disabled={!isWeightedMode(pending.trackingType)} onValueChange={unit => set({ weightUnit: unit as WeightUnit })} {...selectProps('unit')}
            options={addUnitOptions(exercise, pending.trackingType).map(unit => ({ value: unit, label: UNIT_LABELS[unit] }))} />{fieldError('unit')}</div>
      </div>
      <RestControl id="add-rest" label={programmingRestLabel(cardio, Number(pending.rawSets))} raw={pending.rawRest ?? (pending.restSeconds === null ? 'default' : String(pending.restSeconds))} error={errors.rest ?? null} defaultRest={defaultRest}
        onChange={rawRest => { let restSeconds = pending.restSeconds; try { restSeconds = parseRestInput(rawRest); } catch { /* Keep raw invalid input, never corrupt the graph. */ } set({ rawRest, restSeconds }); }} />
      <div className="flex flex-col gap-3"><button type="button" onClick={add} disabled={!!Object.keys(errors).length || isSaving} className="min-h-11 rounded-xl bg-accent-green px-4 py-3 text-base font-bold text-black focus-visible:ring-2 focus-visible:ring-white disabled:opacity-40">Add to plan</button>
        <button type="button" onClick={() => { setPendingAdd(null); onChooseAnother(day.id); }} disabled={isSaving} className="min-h-11 rounded-xl border border-white/15 px-4 py-3 text-sm text-white focus-visible:ring-2 focus-visible:ring-accent-green">Choose another exercise</button></div>
    </div>
  </div>;
}
