'use client';

import { useRef } from 'react';
import { X } from 'lucide-react';
import { getExerciseById } from '@/lib/exercise-catalog';
import { isCatalogCardio } from '@/lib/routine-cardio-presentation';
import { parseRestInput, pendingAddErrors } from '@/lib/routine-editor-controls';
import { programmingOptions } from '@/lib/routine-programming';
import { useRoutineStore } from '@/store/useRoutineStore';
import type { ExerciseSection } from '@/types/routine';
import { OccurrenceProgrammingEditor } from './OccurrenceProgrammingEditor';
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
  const selectProps = (key: string) => ({ invalid: !!errors[key], describedBy: errors[key] ? `add-${key}-error` : undefined, triggerClassName: 'min-h-11' });
  const add = () => {
    if (Object.keys(errors).length || isSaving) return;
    const before = new Set(day.exercises.map(value => value.id));
    try {
      commitPendingAdd();
      const added = useRoutineStore.getState().routine?.days.find(value => value.id === day.id)?.exercises.find(value => !before.has(value.id));
      if (added) onAdded(day.id, added.id);
    } catch { /* D2B retains the pending form and exposes the error. */ }
  };
  return <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/80 backdrop-blur-sm p-0 sm:items-center sm:p-4">
    <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="add-exercise-title"
      className="routine-sheet-slide-up flex max-h-[88dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[28px] border border-white/[0.12] bg-[#121515]/98 shadow-2xl shadow-black/80 backdrop-blur-xl sm:rounded-2xl sm:max-w-md">

      {/* 1. Header (Sticky Top Tier) */}
      <div className="shrink-0 border-b border-white/[0.06] p-5 pb-3 sm:p-6 sm:pb-4">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20 sm:hidden" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="add-exercise-title" className="break-words text-lg sm:text-xl font-extrabold tracking-tight text-white">Add {exercise.displayName}</h2>
            <p className="mt-0.5 text-xs text-white/50">{exercise.primaryMuscle} · {pending.section === 'warmup' ? 'Warm-up' : day.kind === 'recovery' ? 'Recovery activity' : 'Main'}</p>
          </div>
          <button type="button" onClick={close} disabled={isSaving} aria-label="Cancel Add Exercise"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-accent-green">
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* 2. Body (Independently Scrollable Middle Tier) */}
      <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
        {!exercise.defaultTrackingType && <p className="text-xs text-white/50">Choose how you want to track this exercise.</p>}
        {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">{error}</p>}
        <div className="space-y-1.5">
          <label htmlFor="add-section" className="block text-xs font-semibold text-white/60">Section</label>
          <Select variant="routine-editor" id="add-section" label="Section" value={pending.section} onValueChange={section => set({ section: section as ExerciseSection })} disabled={day.kind === 'recovery'} {...selectProps('section')}
            options={[...(day.kind === 'training' ? [{ value: 'warmup', label: 'Warm-up' }] : []), { value: 'main', label: day.kind === 'recovery' ? 'Recovery activities' : 'Main' }]} />
        </div>
        <OccurrenceProgrammingEditor cardio={cardio} defaultRest={defaultRest}
          sets={{ id: 'add-sets', raw: pending.rawSets, error: errors.sets ?? null, change: rawSets => set({ rawSets }) }}
          target={{ id: 'add-target', raw: pending.rawTarget, error: errors.target ?? null, change: rawTarget => set({ rawTarget }) }}
          zone={{ id: 'add-zone', raw: pending.cardioZone === null ? 'none' : String(pending.cardioZone), error: errors.zone ?? null,
            change: value => set({ cardioZone: value === 'none' ? null : Number(value) as typeof pending.cardioZone }) }}
          tracking={{ id: 'add-tracking', value: pending, error: errors.tracking ?? errors.unit ?? null, change: config => set(config) }}
          optionsFor={mode => programmingOptions(exercise, mode)}
          rest={{ id: 'add-rest', raw: pending.rawRest ?? (pending.restSeconds === null ? 'default' : String(pending.restSeconds)), error: errors.rest ?? null,
            change: rawRest => { let restSeconds = pending.restSeconds; try { restSeconds = parseRestInput(rawRest); } catch { /* Invalid raw input stays pending, never enters the graph. */ } set({ rawRest, restSeconds }); } }} />
      </div>

      {/* 3. Footer (Sticky Bottom CTA Tier) */}
      <div className="shrink-0 border-t border-white/[0.06] bg-[#121515]/95 p-4 sm:p-6 pt-3 flex flex-col gap-2.5 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
        <button type="button" onClick={add} disabled={!!Object.keys(errors).length || isSaving}
          className="flex min-h-12 w-full items-center justify-center rounded-xl bg-accent-green px-4 text-base font-extrabold text-black hover:bg-accent-green/90 transition-colors focus-visible:ring-2 focus-visible:ring-white disabled:opacity-40">
          Add to plan
        </button>
        <button type="button" onClick={() => { setPendingAdd(null); onChooseAnother(day.id); }} disabled={isSaving}
          className="flex min-h-11 w-full items-center justify-center rounded-xl border border-white/[0.12] bg-white/[0.04] px-4 text-sm font-semibold text-white/80 hover:bg-white/[0.08] hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-accent-green">
          Choose another exercise
        </button>
      </div>
    </div>
  </div>;
}
