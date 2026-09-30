'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, ChevronLeft, CircleAlert, LoaderCircle, Save } from 'lucide-react';
import { useRoutineStore } from '@/store/useRoutineStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { canSaveEditor, createPendingAdd } from '@/lib/routine-editor-controls';
import type { ResolvedExercise } from '@/types/exercise-catalog';
import { RoutineGuardedLink } from '@/components/RoutineDraftGuard';
import { ExerciseSelectionModal } from '@/components/ExerciseSelectionModal';
import { BufferedRoutineInput } from '@/components/routine-editor/BufferedRoutineInput';
import { RoutineDayEditor } from '@/components/routine-editor/RoutineDayEditor';
import { AddExerciseDrawer } from '@/components/routine-editor/AddExerciseDrawer';

export default function RoutineEditorPage() {
  const state = useRoutineStore();
  const { routine, loadStatus, isLoading, isSaving, draftStatus, error, fetchRoutine } = state;
  const defaultRest = useSettingsStore(settings => settings.defaultRestTimer);
  const [expandedDay, setExpandedDay] = useState<string | null>('monday');
  const [searchDay, setSearchDay] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [saveFailed, setSaveFailed] = useState(false);
  const [focusTarget, setFocusTarget] = useState<{ id: string } | null>(null);
  useEffect(() => { if (loadStatus === 'idle') void fetchRoutine(); }, [fetchRoutine, loadStatus]);
  useEffect(() => {
    if (!focusTarget) return;
    const frame = requestAnimationFrame(() => document.getElementById(focusTarget.id)?.focus());
    return () => cancelAnimationFrame(frame);
  }, [focusTarget]);
  const save = async () => {
    if (!canSaveEditor(useRoutineStore.getState())) return;
    setSaveFailed(false);
    try {
      const outcome = await state.saveRoutineToDb();
      setFeedback(outcome.status === 'saved-with-newer-edits' ? 'Submitted changes saved. Newer edits are still unsaved.' : 'Routine saved.');
    } catch { setSaveFailed(true); }
  };
  const selectExercise = (exercise: ResolvedExercise) => {
    const day = routine?.days.find(value => value.id === searchDay);
    if (!day || day.kind === 'rest') return;
    state.setPendingAdd(createPendingAdd(exercise, day.id));
    setSearchDay(null);
  };
  if (!routine) return <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#050505] px-6 text-center text-text-muted">
    <p role={loadStatus === 'error' ? 'alert' : 'status'}>{isLoading ? 'Loading routine…' : error ?? 'No routine is available.'}</p>
    {loadStatus === 'error' && <button type="button" className="min-h-11 rounded-xl border border-accent-green/40 px-5 text-accent-green" onClick={() => void fetchRoutine()}>Retry</button>}
    <RoutineGuardedLink href="/routines" className="min-h-11 px-4 py-3">Back to Routines</RoutineGuardedLink>
  </main>;
  const status = isSaving ? 'Saving…' : saveFailed && error ? 'Save failed' : draftStatus;
  const count = routine.days.reduce((total, day) => total + day.exercises.length, 0);
  return <main className="mx-auto min-h-screen w-full max-w-2xl space-y-5 bg-[#050505] px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] text-white">
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-white/10 bg-[#050505]/95 py-3 pt-[calc(var(--notch-top)+0.75rem)] backdrop-blur-lg">
      <div className="flex min-w-0 items-center gap-3">
        <RoutineGuardedLink href="/routines" aria-label="Go back" className="flex min-h-11 min-w-11 items-center justify-center rounded-full border border-white/10 focus-visible:ring-2 focus-visible:ring-accent-green"><ChevronLeft aria-hidden="true" className="h-5 w-5" /></RoutineGuardedLink>
        <div className="min-w-0"><h1 className="text-lg font-extrabold sm:text-xl">Routine Editor</h1>
          <p role="status" aria-live="polite" className={`mt-1 flex items-center gap-1.5 text-xs ${status === 'Save failed' ? 'text-red-300' : draftStatus === 'Saved' ? 'text-accent-green' : 'text-text-muted'}`}>
            {isSaving ? <LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 animate-spin" /> : draftStatus === 'Saved' ? <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" /> : <CircleAlert aria-hidden="true" className="h-3.5 w-3.5" />}{status}
          </p>
        </div>
      </div>
      <button type="button" onClick={() => void save()} disabled={!canSaveEditor(state)} aria-busy={isSaving} className="flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-accent-green/20 px-4 text-sm font-bold text-accent-green focus-visible:ring-2 focus-visible:ring-accent-green disabled:opacity-40">
        <Save aria-hidden="true" className="h-4 w-4" />{isSaving ? 'Saving…' : 'Save Changes'}
      </button>
    </header>
    {error && <p role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}
    <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
      <BufferedRoutineInput field={{ kind: 'routine-name' }} value={routine.name} label="Routine name" />
      <p className="text-xs text-text-muted">7 days · {count} exercises · Editing your routine, not its source template.</p>
    </div>
    <p className="sr-only" aria-live="polite" aria-atomic="true">{feedback}</p>
    {routine.days.map(day => <RoutineDayEditor key={day.id} day={day} expanded={expandedDay === day.weekday}
      onToggle={() => setExpandedDay(current => current === day.weekday ? null : day.weekday)} onAdd={() => setSearchDay(day.id)} defaultRest={defaultRest} announce={setFeedback} focus={id => setFocusTarget({ id })} />)}
    <ExerciseSelectionModal isOpen={searchDay !== null} onClose={() => {
      const dayId = searchDay;
      setSearchDay(null);
      // A selection hands focus to configuration, not the background Add button.
      if (dayId && !useRoutineStore.getState().pendingAdd) setFocusTarget({ id: `routine-add-${dayId}` });
    }} onSelect={selectExercise} />
    <AddExerciseDrawer defaultRest={defaultRest} onChooseAnother={setSearchDay} onCancel={dayId => setFocusTarget({ id: `routine-add-${dayId}` })} onAdded={(dayId, occurrenceId) => {
      const day = useRoutineStore.getState().routine?.days.find(value => value.id === dayId);
      if (day) setExpandedDay(day.weekday);
      setFocusTarget({ id: `routine-occurrence-${occurrenceId}` }); setFeedback('Exercise added to your unsaved routine.');
    }} />
  </main>;
}
