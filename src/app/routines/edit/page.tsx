'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, ChevronLeft, CircleAlert, LoaderCircle, Save } from 'lucide-react';
import { useRoutineStore } from '@/store/useRoutineStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { canSaveEditor, createPendingAdd } from '@/lib/routine-editor-controls';
import type { ResolvedExercise } from '@/types/exercise-catalog';
import type { ExerciseSection } from '@/types/routine';
import { editorErrorInputId, INITIAL_EDITOR_DISCLOSURE, revealEditorError, transitionDisclosure, type DisclosureAction } from '@/lib/routine-editor-presentation';
import { RoutineGuardedLink } from '@/components/RoutineDraftGuard';
import { ExerciseSelectionModal } from '@/components/ExerciseSelectionModal';
import { RoutineInformation } from '@/components/routine-editor/RoutineInformation';
import { RoutineDayEditor } from '@/components/routine-editor/RoutineDayEditor';
import { AddExerciseDrawer } from '@/components/routine-editor/AddExerciseDrawer';
import { routineCapabilities } from '@/lib/routine-compatibility';
import { savedValue } from '@/lib/routine-recovery';
import { RoutineStateNotice } from '@/components/routine-editor/RoutineStateNotice';
import type { RoutineCompatibilityIssue, RoutineReadGraph } from '@/types/routine-compatibility';

function issueLabel(graph: RoutineReadGraph, issue: RoutineCompatibilityIssue) {
  const target = issue.target;
  if (target.kind !== 'occurrence') return issue.message;
  const day = graph.days.find(day => day.id === target.dayId);
  const entry = day?.exercises.find(item => item.id === target.occurrenceId);
  return `${day?.weekday ?? 'Saved day'} / ${savedValue(entry?.fields.name)}: ${issue.message}`;
}

export default function RoutineEditorPage() {
  const state = useRoutineStore();
  const { routine, loadStatus, isLoading, isSaving, draftStatus, error, fetchRoutine } = state;
  const graph = routine ?? state.readGraph, caps = routineCapabilities(state);
  const defaultRest = useSettingsStore(settings => settings.defaultRestTimer);
  const [disclosure, setDisclosure] = useState(INITIAL_EDITOR_DISCLOSURE);
  const [searchDay, setSearchDay] = useState<string | null>(null);
  const [searchSection, setSearchSection] = useState<ExerciseSection>('main');
  const [feedback, setFeedback] = useState('');
  const [saveFailed, setSaveFailed] = useState(false);
  const [focusTarget, setFocusTarget] = useState<{ id: string; firstInput?: boolean } | null>(null);
  useEffect(() => { if (loadStatus === 'idle') void fetchRoutine(); }, [fetchRoutine, loadStatus]);
  useEffect(() => {
    if (!focusTarget) return;
    const frame = requestAnimationFrame(() => {
      const root = document.getElementById(focusTarget.id);
      const input = focusTarget.firstInput ? root?.querySelector<HTMLElement>('input:not([disabled]),button[aria-haspopup="listbox"]') : null;
      (input ?? root)?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [focusTarget]);
  const save = async () => {
    const current = useRoutineStore.getState();
    if (!routineCapabilities(current).canSave || (current.routine && !canSaveEditor(current))) return;
    setSaveFailed(false);
    try {
      const outcome = await state.saveRoutineToDb();
      setFeedback(outcome.status === 'saved-with-newer-edits' ? 'Submitted changes saved. Newer edits are still unsaved.' : 'Routine saved.');
    } catch { setSaveFailed(true); }
  };
  const selectExercise = (exercise: ResolvedExercise) => {
    if (!routineCapabilities(useRoutineStore.getState()).canAddExercise) return;
    const day = routine?.days.find(value => value.id === searchDay);
    if (!day || day.kind === 'rest') return;
    state.setPendingAdd(createPendingAdd(exercise, day.id, searchSection));
    setSearchDay(null);
  };
  if (!graph || loadStatus === 'error') return <main className="routine-editor flex min-h-screen flex-col items-center justify-center gap-4 bg-[#090c0a] px-6 text-center text-text-muted">
    <p role={loadStatus === 'error' ? 'alert' : 'status'}>{isLoading ? 'Loading routine…' : error ?? 'No routine is available.'}</p>
    <RoutineStateNotice editor />
    <RoutineGuardedLink href="/routines" className="min-h-11 px-4 py-3">Back to Routines</RoutineGuardedLink>
  </main>;
  const status = isSaving ? 'Saving…' : saveFailed && error ? 'Save failed' : state.readGraph ? `Needs attention${state.hasUnsavedChanges ? ' · Unsaved changes' : ''}` : draftStatus;
  const count = graph.days.reduce((total, day) => total + day.exercises.length, 0);
  const view = routine ? revealEditorError(disclosure, routine, state.editorBuffers) : disclosure;
  const changeDisclosure = (action: DisclosureAction, target?: { id: string; firstInput?: boolean }) => {
    const result = transitionDisclosure(view, action, useRoutineStore.getState().editorBuffers);
    if (result.blockedField) {
      setFocusTarget({ id: editorErrorInputId(result.blockedField, useRoutineStore.getState().editorBuffers) });
      setFeedback('Check the highlighted field before closing or switching editors.');
      return false;
    }
    setDisclosure(result.state);
    if (target) setFocusTarget(target);
    return true;
  };
  const done = () => {
    const id = view.occurrenceId ? `occurrence-edit-${view.occurrenceId}` : view.daySettingsId ? `day-settings-${view.daySettingsId}` : view.routineSettings ? 'routine-settings-toggle' : undefined;
    changeDisclosure({ kind: 'done' }, id ? { id } : undefined);
  };
  const canSave = caps.canSave && (!routine || canSaveEditor(state));
  const statusColor = isSaving
    ? 'text-white/60'
    : saveFailed && error
    ? 'text-red-400'
    : !state.readGraph && draftStatus === 'Saved'
    ? 'text-accent-green'
    : 'text-amber-400';
  return <main className="routine-editor mx-auto min-h-screen w-full max-w-[860px] space-y-4 bg-[#090c0a] px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] text-white sm:space-y-5">
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-white/[0.06] bg-[#090c0a]/90 py-3 pt-[calc(var(--notch-top)+0.75rem)] backdrop-blur-md">
      <div className="flex min-w-0 items-center gap-3">
        <RoutineGuardedLink href="/routines" aria-label="Go back" className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/80 hover:bg-white/[0.08] hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-accent-green"><ChevronLeft aria-hidden="true" className="h-5 w-5" /></RoutineGuardedLink>
        <div className="min-w-0"><h1 className="text-lg font-bold sm:text-xl tracking-tight">Routine Editor</h1>
          <p role="status" aria-live="polite" className={`mt-0.5 flex items-center gap-1.5 text-xs font-semibold ${statusColor}`}>
            {isSaving ? <LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 animate-spin" /> : !state.readGraph && draftStatus === 'Saved' ? <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" /> : <CircleAlert aria-hidden="true" className="h-3.5 w-3.5" />}{status}
          </p>
        </div>
      </div>
      <button type="button" onClick={() => void save()} disabled={!canSave} aria-busy={isSaving}
        className={`flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-xs sm:text-sm font-bold transition-all focus-visible:ring-2 focus-visible:ring-accent-green ${
          canSave
            ? 'bg-accent-green text-black hover:bg-accent-green/90 shadow-[0_0_16px_rgba(74,222,128,0.25)]'
            : 'border border-accent-green/20 bg-accent-green/10 text-accent-green/40 opacity-70 cursor-not-allowed'
        }`}>
        <Save aria-hidden="true" className="h-4 w-4" />{isSaving ? 'Saving…' : 'Save Changes'}
      </button>
    </header>
    {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}
    {state.readGraph && <><RoutineStateNotice editor /><div className="rounded-xl border border-white/10 p-3"><p className="text-xs text-white/60">Choose a setting below to review it. Unsupported saved values require a backup and replacement or support.</p><ul className="mt-2 space-y-1">{state.compatibilityIssues.map((issue, index) => <li key={`${issue.code}-${index}`}><button type="button" className="min-h-11 w-full rounded-lg px-2 text-left text-xs text-amber-200 focus-visible:ring-2 focus-visible:ring-accent-green" onClick={() => {
      if (issue.target.kind === 'occurrence') changeDisclosure({ kind: 'occurrence', dayId: issue.target.dayId, occurrenceId: issue.target.occurrenceId }, { id: `occurrence-editor-${issue.target.occurrenceId}`, firstInput: true });
      else if (issue.target.kind === 'day') changeDisclosure({ kind: 'day', dayId: issue.target.dayId }, { id: `day-heading-${issue.target.dayId}` });
      setFeedback(issue.message);
    }}>{issueLabel(state.readGraph!, issue)}</button></li>)}</ul></div></>}
    {state.hasUnsavedChanges && <button type="button" disabled={isSaving || state.replacementPending} className="min-h-11 rounded-xl border border-white/15 px-4 text-xs text-white/80" onClick={() => { useRoutineStore.getState().discardDraft(); setFeedback('Unsaved edits discarded. Original saved settings restored.'); }}>Discard Changes</button>}
    <RoutineInformation name={savedValue(graph.name)} readOnly={!!state.readGraph} count={count} expanded={view.routineSettings} onEdit={() => changeDisclosure({ kind: 'routine-settings' }, { id: 'routine-settings-panel', firstInput: true })} onDone={done} />
    <p className="sr-only" aria-live="polite" aria-atomic="true">{feedback}</p>
    {graph.days.map(day => <RoutineDayEditor key={day.id} day={day} expanded={view.dayId === day.id}
      settingsOpen={view.daySettingsId === day.id} activeOccurrenceId={view.occurrenceId} reorderSection={view.reorder?.dayId === day.id ? view.reorder.section : null}
      onToggle={() => changeDisclosure({ kind: 'day', dayId: day.id })} onSettings={() => changeDisclosure({ kind: 'day-settings', dayId: day.id }, { id: `day-settings-panel-${day.id}`, firstInput: true })}
      onOccurrence={occurrenceId => changeDisclosure({ kind: 'occurrence', dayId: day.id, occurrenceId }, { id: `occurrence-editor-${occurrenceId}`, firstInput: true })}
      onReorder={section => changeDisclosure({ kind: 'reorder', dayId: day.id, section })} onDone={done}
      onAdd={section => { if (routineCapabilities(useRoutineStore.getState()).canAddExercise && changeDisclosure({ kind: 'done' })) { setSearchSection(section); setSearchDay(day.id); } }} defaultRest={defaultRest} announce={setFeedback} focus={id => setFocusTarget({ id })} />)}
    <ExerciseSelectionModal isOpen={searchDay !== null} onClose={() => {
      const dayId = searchDay;
      setSearchDay(null);
      // A selection hands focus to configuration, not the background Add button.
      if (dayId && !useRoutineStore.getState().pendingAdd) setFocusTarget({ id: `routine-add-${dayId}-${searchSection}` });
    }} onSelect={selectExercise} />
    <AddExerciseDrawer defaultRest={defaultRest} onChooseAnother={setSearchDay} onCancel={dayId => setFocusTarget({ id: `routine-add-${dayId}-${searchSection}` })} onAdded={(dayId, occurrenceId) => {
      const day = useRoutineStore.getState().routine?.days.find(value => value.id === dayId);
      if (day) setDisclosure({ ...INITIAL_EDITOR_DISCLOSURE, dayId, occurrenceId });
      setFocusTarget({ id: `occurrence-editor-${occurrenceId}`, firstInput: true }); setFeedback('Exercise added to your unsaved routine.');
    }} />
  </main>;
}
