import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { BUILT_IN_ROUTINE_TEMPLATES } from '@/data/built-in-routine-templates';
import { materializeRoutineTemplate } from '@/lib/routine-templates';
import type { BuiltInRoutineTemplate } from '@/types/routine-template';
import {
  createRoutineUuid,
  legacyPlanToRoutinePlan,
  normalizeRoutineName,
  normalizeLegacyPlanProgramming,
  prepareRoutinePlanForSave,
  routinePlanToLegacyPlan,
} from '@/lib/routine-model';
import {
  loadActiveRoutine,
  saveActiveRoutine,
  observeRoutineSubject,
} from '@/lib/routine-persistence';
import { analyzeRoutineCompatibility, correctRecoveryTracking, detachedImmutable, promoteRoutineForWrite, readGraphFingerprint, routineCapabilities } from '@/lib/routine-compatibility';
import { recoveryGuardFingerprint } from '@/lib/routine-recovery';
import type { RoutineReadGraph, RoutineCompatibilityIssue, VerifiedRoutineSnapshot, RoutineLoadError, RoutineNormalization } from '@/types/routine-compatibility';
import * as editor from '@/lib/routine-editor';
import { parseRestInput } from '@/lib/routine-editor-controls';
import { getExerciseById } from '@/lib/exercise-catalog';
import { programmingOptions, validateTrackingConfig, encodeTrackingConfig, type PendingTrackingConfig, type TrackingConfig, type ProgrammingOptions } from '@/lib/routine-programming';
import { confirmRoutineDiscard, RoutineGuardCancelledError } from '@/lib/routine-draft-guard';
import type { DraftState, DraftStatus, EditorField, PendingAdd, ReplacementApproval, RecoveryReplacementApproval, SaveOutcome } from '@/types/routine-editor';
import type {
  LegacyDayPlan,
  NewPlannedExerciseOccurrence,
  PlannedExerciseOccurrence,
  RoutinePlan,
  RoutineTemplate,
  Weekday,
} from '@/types/routine';

export type {
  DayKind,
  LegacyDayPlan,
  LegacyPlannedExercise,
  NewPlannedExerciseOccurrence,
  PlannedExerciseOccurrence,
  RoutinePlan,
  RoutineTemplate,
  TrackingType,
  Weekday,
  WeightUnit,
} from '@/types/routine';

export interface RoutineStore extends DraftState {
  loadStatus: 'idle' | 'loading' | 'ready' | 'needs_attention' | 'error';
  // Exclusive read-draft lane: routine stays null until strict promotion/save.
  // Existing pages must not deploy with this foundation alone (D2E-B required).
  readGraph: RoutineReadGraph | null;
  readBaseline: RoutineReadGraph | null;
  compatibilityIssues: readonly RoutineCompatibilityIssue[];
  normalizations: readonly RoutineNormalization[];
  sourceSnapshot: VerifiedRoutineSnapshot | null;
  loadError: RoutineLoadError | null;
  setRecoveryTrackingConfig: (id: string, config: TrackingConfig) => void;
  setRecoveryTrackingBuffer: (id: string, config: PendingTrackingConfig) => void;
  replacementPending: boolean;
  revertRecoveryOccurrence: (id: string) => void;
  isLoading: boolean;
  isSaving: boolean;
  isDirty: boolean;
  hasUnsavedChanges: boolean;
  draftStatus: DraftStatus;
  draftRevision: number;
  submittedRevision: number | null;
  error: string | null;
  templates: readonly BuiltInRoutineTemplate[];
  customTemplates: RoutineTemplate[];
  fetchRoutine: () => Promise<void>;
  setRoutine: (routine: RoutinePlan) => void;
  setRoutineName: (name: string) => void;
  updateDayMetadata: (
    weekday: Weekday,
    updates: Partial<Pick<RoutinePlan["days"][number], "title" | "kind">>,
  ) => void;
  addOccurrence: (
    weekday: Weekday,
    occurrence: NewPlannedExerciseOccurrence,
  ) => void;
  updateOccurrence: (
    occurrenceId: string,
    updates: Partial<Pick<PlannedExerciseOccurrence, 'targetSets' | 'targetValue' | 'restSeconds'>>,
  ) => void;
  removeOccurrence: (occurrenceId: string) => void;
  setOccurrenceCardioZone: (id: string, zone: import('@/types/routine').CardioZone | null) => void;
  setOccurrenceTrackingConfig: (id: string, config: TrackingConfig) => void;
  occurrenceProgrammingOptions: (id: string, mode: import('@/types/routine').TrackingType | null) => ProgrammingOptions;
  reorderDayOccurrences: (weekday: Weekday, orderedIds: string[]) => void;
  setEditorBuffer: (field: EditorField, raw: string) => void;
  setPendingAdd: (pending: PendingAdd | null) => void;
  commitPendingAdd: () => void;
  moveOccurrence: (dayId: string, occurrenceId: string, direction: 'up' | 'down') => void;
  discardDraft: () => void;
  requestLeave: (destination: string) => Promise<boolean>;
  requestReplacement: (intent: string) => Promise<ReplacementApproval | null>;
  saveRoutineToDb: () => Promise<SaveOutcome>;
  replaceAndSaveRoutine: (
    plan: LegacyDayPlan[] | BuiltInRoutineTemplate,
    name?: string,
    approval?: ReplacementApproval,
  ) => Promise<SaveOutcome>;
  applyTemplate: (templateId: string) => Promise<SaveOutcome>;
  exportRoutine: () => string;
  importRoutine: (base64Str: string) => Promise<SaveOutcome>;
  applyAiRoutine: (plan: LegacyDayPlan[]) => Promise<SaveOutcome>;
  saveCustomTemplate: (
    name: string,
    description: string,
    plan: LegacyDayPlan[] | RoutinePlan,
  ) => boolean;
  deleteCustomTemplate: (templateId: string) => void;
  resetActiveSplit: () => Promise<SaveOutcome>;
  clearAllCustomTemplates: () => void;
}

export const useRoutineStore = create<RoutineStore>()(
  persist(
    (set, get) => {
      let routineLoadFlight: Promise<void> | null = null;
      let saveFlight: Promise<SaveOutcome> | null = null;
      let loadGeneration = 0;
      let subject: string | null | undefined;
      let subjectEpoch = 0;
      let recoveryReplacementFlight: { key: string; promise: Promise<SaveOutcome> } | null = null;
      const approvals = new WeakSet<ReplacementApproval>();
      // Compatibility allowances, NOT form/dirty/persisted truth. Each trusted
      // incoming pair belongs only to its occurrence and canonical ID.
      const historicalPairs = new Map<string, { exerciseId: string | null; config: TrackingConfig }>();
      const rememberProgramming = (routine: RoutinePlan) => routine.days.forEach(day => day.exercises.forEach(exercise => {
        validateTrackingConfig(exercise);
        if (!historicalPairs.has(exercise.id)) historicalPairs.set(exercise.id, { exerciseId: exercise.exerciseId,
          config: Object.freeze({ trackingType: exercise.trackingType, weightUnit: exercise.weightUnit }) });
      }));
      const historicalFor = (routine: RoutinePlan, id: string) => {
        const occurrence = routine.days.flatMap(day => day.exercises).find(exercise => exercise.id === id);
        const allowance = historicalPairs.get(id);
        return allowance?.exerciseId === occurrence?.exerciseId ? allowance?.config : undefined;
      };
      const bufferFor = (routine: RoutinePlan, field: EditorField, raw: string) => editor.createEditorBuffer(routine, field, raw,
        'occurrenceId' in field ? historicalFor(routine, field.occurrenceId) : undefined);
      const message = (error: unknown) => error instanceof Error ? error.message : 'Unable to update the routine.';
      const requireDraft = () => {
        const state = get();
        if (!state.routine || state.loadStatus !== 'ready') throw new editor.RoutineEditorError('A verified routine draft is required.');
        return state.routine;
      };
      const edit = (operation: (routine: RoutinePlan) => RoutinePlan) => {
        try {
          const state = get();
          const next = operation(requireDraft());
          if (editor.routineFingerprint(next) === editor.routineFingerprint(state.routine!)) return;
          const editorBuffers = Object.fromEntries(Object.entries(state.editorBuffers).flatMap(([key, buffer]) => {
            const updated = bufferFor(next, buffer.field, buffer.raw);
            // A committed/clean input must not undo a newer domain edit to the
            // same field on the next save. Uncommitted/invalid inputs survive.
            if (!buffer.changed && !buffer.error && updated.changed) return [];
            return [[key, updated]];
          }));
          const draft = { ...state, routine: next, editorBuffers };
          set({ routine: next, editorBuffers, draftRevision: state.draftRevision + 1, ...editor.draftFlags(draft), error: null });
        } catch (error) { set({ error: message(error) }); throw error; }
      };
      const checkApproval = (approval: ReplacementApproval) => {
        const state = get();
        if (!approvals.has(approval) || approval.revision !== state.draftRevision || approval.fingerprint !== editor.draftGuardFingerprint(state)) {
          throw new editor.RoutineEditorError('The draft changed. Confirm replacement again.');
        }
      };
      const readFlags = (graph: RoutineReadGraph, baseline: RoutineReadGraph, buffers = get().editorBuffers) => {
        const isDirty = readGraphFingerprint(graph) !== readGraphFingerprint(baseline) || Object.values(buffers).some(buffer => buffer.changed);
        return { isDirty, hasUnsavedChanges: isDirty, draftStatus: isDirty ? 'Unsaved changes' as const : 'Saved' as const };
      };
      observeRoutineSubject(next => {
        if (next === subject) return;
        const first = subject === undefined;
        subject = next;
        if (first && !get()?.routine && !get()?.readGraph) return;
        subjectEpoch++; loadGeneration++; routineLoadFlight = null; historicalPairs.clear();
        set({ routine: null, savedBaseline: null, initialDefaultDraft: null, readGraph: null, readBaseline: null,
          sourceSnapshot: null, compatibilityIssues: [], normalizations: [], loadError: null, editorBuffers: {}, pendingAdd: null,
          loadStatus: 'idle', isLoading: false, isSaving: false, isDirty: false, hasUnsavedChanges: false, error: null,
          draftStatus: 'Saved', replacementPending: false, submittedRevision: null, draftRevision: (get()?.draftRevision ?? 0) + 1 });
      });
      const verifiedAfterWrite = async (submitted: RoutinePlan, epoch: number, expectedSubject: string) => {
        if (epoch !== subjectEpoch) throw new Error('The signed-in account changed during verification.');
        const loaded = await loadActiveRoutine(++loadGeneration);
        if (epoch !== subjectEpoch) throw new Error('The signed-in account changed during verification.');
        if (loaded.status !== 'valid' || !loaded.source || loaded.source.subjectId !== expectedSubject
          || editor.routineFingerprint(prepareRoutinePlanForSave(loaded.routine)) !== editor.routineFingerprint(prepareRoutinePlanForSave(submitted))) {
          throw new Error('Save was accepted, but the saved routine could not be verified. Retry loading before another change.');
        }
        historicalPairs.clear(); rememberProgramming(loaded.routine);
        const draft = { routine: editor.cloneRoutine(loaded.routine), savedBaseline: editor.immutableRoutine(loaded.routine), initialDefaultDraft: null, editorBuffers: {}, pendingAdd: null };
        set({ ...draft, ...editor.draftFlags(draft), sourceSnapshot: loaded.source, normalizations: loaded.normalizations,
          readGraph: null, readBaseline: null, compatibilityIssues: [], loadError: null, loadStatus: 'ready', isLoading: false });
      };
      const recoverReplace = (replacement: RoutinePlan, key: string, intent: string): Promise<SaveOutcome> => {
        const state = get(), source = state.sourceSnapshot;
        if (!routineCapabilities(state).canApplyTemplate || !source || !state.readGraph) return Promise.reject(new Error('A verified recovery source is required before replacement.'));
        const prepared = prepareRoutinePlanForSave(replacement), epoch = subjectEpoch;
        const approval: RecoveryReplacementApproval = Object.freeze({ revision: state.draftRevision, fingerprint: recoveryGuardFingerprint(state),
          subjectId: source.subjectId, generation: source.generation, sourceFingerprint: source.fingerprint, replacementFingerprint: editor.routineFingerprint(prepared) });
        const verifyApproval = () => {
          const current = get();
          if (epoch !== subjectEpoch || current.sourceSnapshot?.subjectId !== approval.subjectId || current.sourceSnapshot.generation !== approval.generation
            || current.sourceSnapshot.fingerprint !== approval.sourceFingerprint || current.draftRevision !== approval.revision
            || recoveryGuardFingerprint(current) !== approval.fingerprint || editor.routineFingerprint(prepared) !== approval.replacementFingerprint
            || current.loadStatus !== 'needs_attention' || current.isSaving || saveFlight) throw new Error('The routine changed. Review and confirm replacement again.');
        };
        let resolve!: (result: SaveOutcome) => void, reject!: (error: unknown) => void;
        const flight = new Promise<SaveOutcome>((yes, no) => { resolve = yes; reject = no; });
        recoveryReplacementFlight = { key, promise: flight };
        set({ replacementPending: true, error: null });
        void (async () => {
          let committed = false;
          try {
            if (!await confirmRoutineDiscard({ kind: 'recovery-replace', intent, source })) throw new RoutineGuardCancelledError();
            verifyApproval();
            // Detect remote/source drift immediately before reserving the shared
            // mutation flight. This is a checked precondition, not server CAS.
            const fresh = await loadActiveRoutine(++loadGeneration);
            verifyApproval();
            if ((fresh.status !== 'valid' && fresh.status !== 'needs_attention') || fresh.source.subjectId !== approval.subjectId
              || fresh.source.fingerprint !== approval.sourceFingerprint) throw new Error('The saved routine changed. Reload and make a new backup before replacing it.');
            prepareRoutinePlanForSave(prepared);
            saveFlight = flight;
            set({ isSaving: true, submittedRevision: approval.revision });
            const saved = await saveActiveRoutine(editor.cloneRoutine(prepared), approval.subjectId);
            committed = true;
            await verifiedAfterWrite(saved, epoch, approval.subjectId);
            resolve({ submittedRevision: approval.revision, status: 'saved' });
          } catch (error) {
            if (epoch === subjectEpoch) set({ error: error instanceof RoutineGuardCancelledError ? null : message(error),
              ...(committed ? { loadStatus: 'error' as const, hasUnsavedChanges: false, isDirty: false, loadError: { kind: 'transport' as const, code: 'incomplete_read' as const, message: message(error) } } : {}) });
            reject(error);
          } finally {
            if (saveFlight === flight) saveFlight = null;
            if (recoveryReplacementFlight?.promise === flight) recoveryReplacementFlight = null;
            if (epoch === subjectEpoch) set({ isSaving: false, replacementPending: false, submittedRevision: null });
          }
        })();
        return flight;
      };
      return ({
      routine: null,
      readGraph: null, readBaseline: null, compatibilityIssues: [], normalizations: [], sourceSnapshot: null, loadError: null,
      savedBaseline: null,
      initialDefaultDraft: null,
      editorBuffers: {},
      pendingAdd: null,
      draftRevision: 0,
      submittedRevision: null,
      loadStatus: 'idle',
      isLoading: false,
      isSaving: false,
      isDirty: false,
      hasUnsavedChanges: false,
      draftStatus: 'Saved',
      error: null,
      replacementPending: false,
      templates: BUILT_IN_ROUTINE_TEMPLATES,
      customTemplates: [],
      
      fetchRoutine: async () => {
        const currentState = get();
        if (currentState.isSaving || currentState.replacementPending || currentState.loadStatus !== 'error' && currentState.hasUnsavedChanges && (currentState.routine || currentState.readGraph)) {
          return;
        }

        if (routineLoadFlight) {
          return routineLoadFlight;
        }

        const generation = ++loadGeneration;
        const run = async () => {
          if (generation !== loadGeneration) return;
          try {
            const loaded = await loadActiveRoutine(generation);
            if (generation !== loadGeneration) return;
            if (loaded.status !== 'empty' && loaded.source) {
              if (subject === undefined) subject = loaded.source.subjectId;
              if (subject !== loaded.source.subjectId) {
                set({ routine: null, readGraph: null, readBaseline: null, sourceSnapshot: null, savedBaseline: null,
                  initialDefaultDraft: null, compatibilityIssues: [], normalizations: [], editorBuffers: {}, pendingAdd: null,
                  loadStatus: 'error', isLoading: false, isDirty: false, hasUnsavedChanges: false,
                  loadError: { kind: 'auth', code: 'subject_changed', message: 'The signed-in account changed. Load again.' } });
                return;
              }
            }
            const latest = get();
            if ((latest.hasUnsavedChanges || latest.isSaving) && (latest.routine || latest.readGraph)) {
              set({ loadStatus: latest.readGraph ? 'needs_attention' : 'ready', isLoading: false });
              return;
            }
            if (loaded.status === 'fatal') {
              set({ routine: null, readGraph: null, readBaseline: null, sourceSnapshot: loaded.source, loadError: loaded.error,
                savedBaseline: null, initialDefaultDraft: null, compatibilityIssues: [], normalizations: [], editorBuffers: {}, pendingAdd: null,
                loadStatus: 'error', isLoading: false, isDirty: false, hasUnsavedChanges: false, error: loaded.error.message });
              return;
            }
            if (loaded.status === 'needs_attention') {
              // Invalid historical pairs remain in evidence/read state, never in
              // rememberProgramming's valid-pair allowances or synthetic buffers.
              if (get().hasUnsavedChanges) return;
              historicalPairs.clear();
              set({ routine: null, savedBaseline: null, initialDefaultDraft: null, readGraph: structuredClone(loaded.routine),
                readBaseline: detachedImmutable(loaded.routine), sourceSnapshot: loaded.source, compatibilityIssues: loaded.issues,
                normalizations: loaded.normalizations,
                loadError: null, editorBuffers: {}, pendingAdd: null, loadStatus: 'needs_attention', isLoading: false,
                ...readFlags(loaded.routine, loaded.routine), draftRevision: get().draftRevision + 1, error: null });
              return;
            }
            const loadedRoutine = loaded.status === 'valid' ? loaded.routine : null;
            set((state) => {
              if ((state.hasUnsavedChanges || state.isSaving) && state.routine) {
                return {
                  loadStatus: 'ready',
                  isLoading: false,
                  error: null,
                };
              }

              const routine = loadedRoutine ?? materializeRoutineTemplate(BUILT_IN_ROUTINE_TEMPLATES[0]);
              historicalPairs.clear();
              rememberProgramming(routine);
              const draft = {
                routine: editor.cloneRoutine(routine),
                savedBaseline: loadedRoutine ? editor.immutableRoutine(loadedRoutine) : null,
                initialDefaultDraft: loadedRoutine ? null : editor.immutableRoutine(routine),
                editorBuffers: {}, pendingAdd: null,
              };
              return {
                ...draft, ...editor.draftFlags(draft), draftRevision: state.draftRevision + 1,
                readGraph: null, readBaseline: null, compatibilityIssues: [], loadError: null,
                normalizations: loaded.status === 'valid' ? loaded.normalizations : [],
                sourceSnapshot: loaded.status === 'valid' ? loaded.source : null,
                loadStatus: 'ready',
                isLoading: false,
                error: null,
              };
            });
          } catch (error) {
            if (generation !== loadGeneration) return;
            const message = error instanceof Error
              ? error.message
              : 'Unable to load the active routine.';
            console.error('Error fetching routine:', error);
            set((state) => {
              if (state.hasUnsavedChanges && state.readGraph) {
                return { loadStatus: 'needs_attention', isLoading: false, error: message };
              }
              if (state.hasUnsavedChanges && state.routine) {
                return {
                  loadStatus: 'ready',
                  isLoading: false,
                  error: message,
                };
              }

              return {
                routine: null,
                readGraph: null, readBaseline: null, sourceSnapshot: null, compatibilityIssues: [], normalizations: [],
                savedBaseline: null, initialDefaultDraft: null, editorBuffers: {}, pendingAdd: null, hasUnsavedChanges: false,
                loadError: { kind: 'transport', code: 'incomplete_read', message: 'Unable to read a complete routine.' },
                loadStatus: 'error',
                isLoading: false,
                isDirty: false,
                error: message,
              };
            });
          }
        };
        let resolve!: () => void, reject!: (error: unknown) => void;
        const flight = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
        routineLoadFlight = flight;
        // Notify only after reserving the flight, while preserving immediate
        // loading state for existing callers and subscriber reentry.
        set({ loadStatus: 'loading', isLoading: true, error: null });
        void run().then(resolve, reject);

        try {
          await flight;
        } finally {
          if (routineLoadFlight === flight) routineLoadFlight = null;
        }
      },

      setRecoveryTrackingConfig: (id, config) => {
        const state = get();
        if (!routineCapabilities(state).canEditRecoveryFields || !state.readGraph || !state.readBaseline || state.replacementPending) throw new editor.RoutineEditorError('An editable recovery graph is required.');
        const next = correctRecoveryTracking(state.readGraph, id, config);
        const editorBuffers = { ...state.editorBuffers }; delete editorBuffers[`tracking-config:${id}`];
        if (readGraphFingerprint(next) === readGraphFingerprint(state.readGraph) && !state.editorBuffers[`tracking-config:${id}`]) return;
        set({ editorBuffers, readGraph: next, compatibilityIssues: analyzeRoutineCompatibility(next), ...readFlags(next, state.readBaseline, editorBuffers),
          draftRevision: state.draftRevision + 1, error: null });
      },
      setRecoveryTrackingBuffer: (id, config) => {
        const state = get();
        if (!routineCapabilities(state).canEditRecoveryFields || !state.readGraph || state.replacementPending) throw new Error('Recovery fields are unavailable.');
        try { validateTrackingConfig(config); get().setRecoveryTrackingConfig(id, config); return; }
        catch (error) {
          const raw = encodeTrackingConfig(config), key = `tracking-config:${id}`;
          if (state.editorBuffers[key]?.raw === raw) return;
          const editorBuffers = { ...state.editorBuffers, [key]: { field: { kind: 'tracking-config' as const, occurrenceId: id }, raw, changed: true, error: message(error) } };
          set({ editorBuffers, draftRevision: state.draftRevision + 1, isDirty: true, hasUnsavedChanges: true, draftStatus: 'Unsaved changes', error: null });
        }
      },
      revertRecoveryOccurrence: id => {
        const state = get();
        if (!state.readGraph || !state.readBaseline || !routineCapabilities(state).canEditRecoveryFields) throw new editor.RoutineEditorError('An editable recovery baseline is required.');
        const original = state.readBaseline.days.flatMap(day => day.exercises).find(item => item.id === id);
        if (!original) throw new editor.RoutineEditorError('The stored recovery occurrence is unavailable.');
        const next = structuredClone(state.readGraph);
        next.days.forEach(day => { day.exercises = day.exercises.map(item => item.id === id ? structuredClone(original) : item); });
        const editorBuffers = { ...state.editorBuffers }; delete editorBuffers[`tracking-config:${id}`];
        if (readGraphFingerprint(next) === readGraphFingerprint(state.readGraph) && !state.editorBuffers[`tracking-config:${id}`]) return;
        // Exact restoration of source evidence is not permission to SAVE it.
        set({ editorBuffers, readGraph: next, compatibilityIssues: analyzeRoutineCompatibility(next), ...readFlags(next, state.readBaseline, editorBuffers), draftRevision: state.draftRevision + 1 });
      },

      // Compatibility setter is an edit, not a load/replacement gate bypass.
      setRoutine: (routine) => edit(current => {
        const protectedFields = (value: RoutinePlan) => JSON.stringify([value.id, value.days.map(day => [day.id, day.weekday,
          [...day.exercises].sort((a, b) => a.id.localeCompare(b.id)).map(exercise => [exercise.id, exercise.exerciseId, exercise.name,
            exercise.targetMuscle, exercise.section, exercise.trackingType, exercise.weightUnit, exercise.cardioZone, exercise.note ?? null])])]);
        if (protectedFields(current) !== protectedFields(routine)) throw new editor.RoutineEditorError('Use guarded replacement or occurrence operations to change graph identity or logging metadata.');
        let next = editor.renameRoutine(current, routine.name);
        for (const day of routine.days) {
          next = editor.renameDay(next, day.id, day.title);
          next = editor.setDayKind(next, day.id, day.kind);
          for (const occurrence of day.exercises) {
            next = editor.setOccurrenceSets(next, occurrence.id, occurrence.targetSets);
            next = editor.setOccurrenceTarget(next, occurrence.id, occurrence.targetValue);
            next = editor.setOccurrenceRest(next, occurrence.id, occurrence.restSeconds);
          }
          next = editor.reorderDay(next, day.id, [...day.exercises].sort((a, b) => a.order - b.order).map(exercise => exercise.id));
        }
        return next;
      }),
      setRoutineName: name => edit(routine => editor.renameRoutine(routine, name)),
      updateDayMetadata: (weekday, updates) => edit(routine => {
        const day = routine.days.find(value => value.weekday === weekday);
        if (!day) throw new editor.RoutineEditorError('The selected day is unavailable.');
        let next = routine;
        if (updates.title !== undefined) next = editor.renameDay(next, day.id, updates.title);
        if (updates.kind !== undefined) next = editor.setDayKind(next, day.id, updates.kind);
        return next;
      }),
      addOccurrence: (weekday, occurrence) => edit(routine => {
        if (!routineCapabilities(get()).canAddExercise) throw new editor.RoutineEditorError('Fix and save the routine before adding exercises.');
        const day = routine.days.find(value => value.weekday === weekday);
        if (!day) throw new editor.RoutineEditorError('The selected day is unavailable.');
        return editor.addOccurrence(routine, day.id, occurrence);
      }),
      updateOccurrence: (id, updates) => edit(routine => {
        if (Object.keys(updates).some(key => !['targetSets', 'targetValue', 'restSeconds'].includes(key))) throw new editor.RoutineEditorError('Only reviewed programming fields can be edited.');
        let next = routine;
        if (updates.targetSets !== undefined) next = editor.setOccurrenceSets(next, id, updates.targetSets);
        if (updates.targetValue !== undefined) next = editor.setOccurrenceTarget(next, id, updates.targetValue);
        if (updates.restSeconds !== undefined) next = editor.setOccurrenceRest(next, id, updates.restSeconds);
        return next;
      }),
      removeOccurrence: id => {
        edit(routine => editor.removeOccurrence(routine, id));
        const state = get();
        const editorBuffers = Object.fromEntries(Object.entries(state.editorBuffers).filter(([, buffer]) => !('occurrenceId' in buffer.field && buffer.field.occurrenceId === id)));
        const draft = { ...state, editorBuffers };
        set({ editorBuffers, ...editor.draftFlags(draft) });
      },
      setOccurrenceCardioZone: (id, zone) => edit(routine => editor.setOccurrenceCardioZone(routine, id, zone)),
      setOccurrenceTrackingConfig: (id, config) => edit(routine => editor.setOccurrenceTrackingConfig(routine, id, config, historicalFor(routine, id))),
      occurrenceProgrammingOptions: (id, mode) => {
        const routine = requireDraft();
        const exercise = routine.days.flatMap(day => day.exercises).find(value => value.id === id);
        return programmingOptions(exercise?.exerciseId ? getExerciseById(exercise.exerciseId) : undefined, mode, historicalFor(routine, id));
      },
      reorderDayOccurrences: (weekday, ids) => edit(routine => {
        const day = routine.days.find(value => value.weekday === weekday);
        if (!day) throw new editor.RoutineEditorError('The selected day is unavailable.');
        return editor.reorderDay(routine, day.id, ids);
      }),
      moveOccurrence: (dayId, id, direction) => edit(routine => editor.moveOccurrence(routine, dayId, id, direction)),
      setEditorBuffer: (field, raw) => {
        const routine = requireDraft();
        const state = get();
        const key = editor.editorFieldKey(field);
        const buffer = bufferFor(routine, field, raw);
        if (!state.editorBuffers[key] && !buffer.changed && !buffer.error) return;
        if (JSON.stringify(state.editorBuffers[key]) === JSON.stringify(buffer)) return;
        const editorBuffers = { ...state.editorBuffers, [key]: buffer };
        const draft = { ...state, editorBuffers };
        set({ editorBuffers, draftRevision: state.draftRevision + 1, ...editor.draftFlags(draft) });
      },
      setPendingAdd: pendingAdd => {
        requireDraft();
        const state = get();
        // Existing valid draft buffers may change during an in-flight normal Save;
        // revision coordination preserves them. Recovery has no Add lane.
        if (pendingAdd && (state.readGraph || state.replacementPending)) throw new editor.RoutineEditorError('Fix and save the existing routine settings before adding exercises.');
        if (JSON.stringify(state.pendingAdd) === JSON.stringify(pendingAdd)) return;
        const draft = { ...state, pendingAdd: pendingAdd && structuredClone(pendingAdd) };
        set({ pendingAdd: draft.pendingAdd, draftRevision: state.draftRevision + 1, ...editor.draftFlags(draft), error: null });
      },
      commitPendingAdd: () => {
        const state = get();
        const pending = state.pendingAdd;
        try {
          if (!routineCapabilities(state).canAddExercise) throw new editor.RoutineEditorError('Fix and save the routine before adding exercises.');
          if (!pending?.trackingType || !pending.weightUnit) throw new editor.RoutineEditorError('Choose explicit logging configuration before adding.');
          const next = editor.addOccurrence(requireDraft(), pending.dayId, {
            exerciseId: pending.exerciseId, name: '', targetMuscle: '', section: pending.section,
            targetSets: pending.rawSets.trim() ? Number(pending.rawSets) : NaN, targetValue: pending.rawTarget,
            trackingType: pending.trackingType, weightUnit: pending.weightUnit,
            restSeconds: pending.rawRest === undefined ? pending.restSeconds : parseRestInput(pending.rawRest),
            cardioZone: pending.cardioZone,
          });
          const draft = { ...state, routine: next, pendingAdd: null };
          set({ routine: next, pendingAdd: null, draftRevision: state.draftRevision + 1, ...editor.draftFlags(draft), error: null });
        } catch (error) { set({ error: message(error) }); throw error; }
      },
      discardDraft: () => {
        const state = get();
        if (saveFlight || state.isSaving || state.replacementPending) throw new editor.RoutineEditorError('Wait for the routine save or cancel replacement before discarding.');
        if (state.readBaseline) {
          const graph = structuredClone(state.readBaseline);
          set({ readGraph: graph, compatibilityIssues: analyzeRoutineCompatibility(graph), ...readFlags(graph, state.readBaseline, {}),
            editorBuffers: {}, pendingAdd: null, draftRevision: state.draftRevision + Number(state.isDirty), error: null });
          return;
        }
        const baseline = state.savedBaseline ?? state.initialDefaultDraft;
        if (!baseline) throw new editor.RoutineEditorError('No verified baseline is available.');
        const draft = { ...state, routine: editor.cloneRoutine(baseline), editorBuffers: {}, pendingAdd: null };
        const changed = editor.draftGuardFingerprint(state) !== editor.draftGuardFingerprint(draft);
        set({ routine: draft.routine, editorBuffers: {}, pendingAdd: null, draftRevision: state.draftRevision + Number(changed), ...editor.draftFlags(draft), error: null });
      },
      requestReplacement: async intent => {
        const state = get();
        requireDraft();
        if (saveFlight || state.isSaving) throw new editor.RoutineEditorError('Wait for the routine save before replacing.');
        const approval = Object.freeze({ revision: state.draftRevision, fingerprint: editor.draftGuardFingerprint(state) });
        if (state.hasUnsavedChanges && !await confirmRoutineDiscard({ kind: 'replace', intent })) return null;
        approvals.add(approval);
        checkApproval(approval);
        return approval;
      },
      requestLeave: async destination => {
        const state = get();
        if (saveFlight || state.isSaving || state.replacementPending) return false;
        if (!state.hasUnsavedChanges) return true;
        const revision = state.draftRevision;
        const fingerprint = recoveryGuardFingerprint(state);
        if (!await confirmRoutineDiscard({ kind: 'leave', intent: destination })) return false;
        if (revision !== get().draftRevision || fingerprint !== recoveryGuardFingerprint(get()) || get().isSaving) {
          set({ error: 'The draft changed. Confirm leaving again.' }); return false;
        }
        get().discardDraft();
        return true;
      },
      saveRoutineToDb: () => {
        if (saveFlight) return saveFlight;
        if (get().replacementPending) return Promise.reject(new Error('Finish or cancel replacement before saving.'));
        let resolve!: (outcome: SaveOutcome) => void;
        let reject!: (error: unknown) => void;
        const flight = new Promise<SaveOutcome>((yes, no) => { resolve = yes; reject = no; });
        // Reserve before validation, state notification, or IO (subscriber reentry).
        saveFlight = flight;
        const epoch = subjectEpoch;
        void (async () => {
          let recoveryCommitted = false;
          try {
            const state = get();
            if (state.readGraph) {
              if (!routineCapabilities(state).canSave) throw new editor.RoutineEditorError('Resolve the highlighted settings before saving this routine.');
              if (state.loadStatus !== 'needs_attention') throw new Error('Retry loading before saving this routine.');
              if (!state.sourceSnapshot) throw new Error('The recovery source is unavailable.');
              if (state.pendingAdd || Object.keys(state.editorBuffers).length) throw new editor.RoutineEditorError('Finish recovery field edits before saving.');
              if (!state.hasUnsavedChanges) throw new editor.RoutineEditorError('Choose explicit corrections before saving.');
              const prepared = promoteRoutineForWrite(state.readGraph);
              const submittedRevision = state.draftRevision;
              set({ isSaving: true, submittedRevision, error: null });
              const savedRoutine = await saveActiveRoutine(editor.cloneRoutine(prepared), state.sourceSnapshot?.subjectId ?? subject);
              recoveryCommitted = true;
              if (epoch !== subjectEpoch) throw new Error('The signed-in account changed during save.');
              await verifiedAfterWrite(savedRoutine, epoch, state.sourceSnapshot.subjectId);
              saveFlight = null;
              set({ isSaving: false, submittedRevision: null, error: null });
              resolve({ submittedRevision, status: 'saved' }); return;
            }
            let routine = requireDraft();
            if (state.pendingAdd) throw new editor.RoutineEditorError('Finish or cancel Add Exercise before saving.');
            for (const buffer of Object.values(state.editorBuffers)) {
              if (buffer.error) throw new editor.RoutineEditorError(buffer.error);
              routine = editor.applyEditorField(routine, buffer.field, buffer.raw,
                'occurrenceId' in buffer.field ? historicalFor(routine, buffer.field.occurrenceId) : undefined);
            }
            const prepared = prepareRoutinePlanForSave(editor.cloneRoutine(routine));
            const submittedRevision = state.draftRevision;
            if (state.savedBaseline && editor.routineFingerprint(prepared) === editor.routineFingerprint(state.savedBaseline)) {
              const draft = { ...state, routine: prepared, editorBuffers: {} };
              saveFlight = null;
              set({ routine: prepared, editorBuffers: {}, ...editor.draftFlags(draft), error: null });
              resolve({ submittedRevision, status: 'unchanged' }); return;
            }
            const editorBuffers = Object.fromEntries(Object.entries(state.editorBuffers).map(([key, buffer]) => [key, bufferFor(prepared, buffer.field, buffer.raw)]));
            set({ routine: prepared, editorBuffers, isSaving: true, submittedRevision, error: null, ...editor.draftFlags({ ...state, routine: prepared, editorBuffers }) });
            const savedRoutine = await saveActiveRoutine(editor.cloneRoutine(prepared), subject);
            if (epoch !== subjectEpoch) throw new Error('The signed-in account changed during save.');
            const latest = get();
            const newer = latest.draftRevision !== submittedRevision;
            const draft = { ...latest, savedBaseline: editor.immutableRoutine(savedRoutine), initialDefaultDraft: null,
              routine: newer ? latest.routine : editor.cloneRoutine(savedRoutine),
              editorBuffers: newer ? Object.fromEntries(Object.entries(latest.editorBuffers).map(([key, buffer]) => [key, bufferFor(latest.routine!, buffer.field, buffer.raw)])) : {} };
            saveFlight = null;
            set({ routine: draft.routine, savedBaseline: draft.savedBaseline, initialDefaultDraft: null,
              sourceSnapshot: null, normalizations: [],
              editorBuffers: draft.editorBuffers, ...editor.draftFlags(draft), isSaving: false, submittedRevision: null, error: null });
            resolve({ submittedRevision, status: newer ? 'saved-with-newer-edits' : 'saved' });
          } catch (error) {
            saveFlight = null;
            if (epoch !== subjectEpoch) { reject(error); return; }
            if (recoveryCommitted) {
              set({ isSaving: false, submittedRevision: null, loadStatus: 'error', hasUnsavedChanges: false, isDirty: false,
                loadError: { kind: 'transport', code: 'incomplete_read', message: message(error) }, error: message(error) });
              reject(error); return;
            }
            if (get().readGraph && get().readBaseline) {
              set({ isSaving: false, submittedRevision: null, error: message(error), ...readFlags(get().readGraph!, get().readBaseline!) });
              reject(error); return;
            }
            set({ isSaving: false, submittedRevision: null, error: message(error), ...editor.draftFlags(get()) });
            reject(error);
          }
        })();
        return flight;
      },

      replaceAndSaveRoutine: async (plan, name, approval) => {
        let currentState = get();
        const key = JSON.stringify({ plan, name });
        if (recoveryReplacementFlight) {
          if (recoveryReplacementFlight.key === key) return await recoveryReplacementFlight.promise;
          throw new Error('Another routine replacement is already being reviewed.');
        }
        if (currentState.loadStatus === 'needs_attention' && currentState.readGraph) {
          if (approval) throw new Error('Recovery replacement needs a fresh source-bound confirmation.');
          const rootId = currentState.readGraph.id;
          const replacement = Array.isArray(plan) ? legacyPlanToRoutinePlan(name ?? 'Replacement Routine', plan, rootId) : materializeRoutineTemplate(plan, rootId);
          return await recoverReplace(replacement, key, replacement.name);
        }
        if (currentState.isSaving) {
          const error = new Error('A routine save is already in progress.');
          set({ error: error.message });
          throw error;
        }

        if (
          currentState.loadStatus === 'idle'
          || currentState.loadStatus === 'loading'
        ) {
          await get().fetchRoutine();
          currentState = get();
        }

        if (currentState.loadStatus !== 'ready' || !currentState.routine) {
          const error = new Error(
            'Load the saved routine successfully before replacing it.',
          );
          set({ error: error.message });
          throw error;
        }
        if (currentState.isSaving) {
          const error = new Error('A routine save is already in progress.');
          set({ error: error.message });
          throw error;
        }

        let replacement: RoutinePlan;
        try {
          replacement = Array.isArray(plan)
            ? legacyPlanToRoutinePlan(
                name ?? currentState.routine.name,
                plan,
                currentState.routine.id,
              )
            : materializeRoutineTemplate(plan, currentState.routine.id);
        } catch (error) {
          const message = error instanceof Error
            ? error.message
            : 'The replacement routine is invalid.';
          set({ error: message });
          throw error;
        }

        // Incoming source is validated before asking to discard/install anything.
        replacement = prepareRoutinePlanForSave(replacement);
        const approved = approval ?? await get().requestReplacement(name ?? 'Replace routine');
        if (!approved) throw new RoutineGuardCancelledError();
        checkApproval(approved);
        if (get().isSaving) throw new editor.RoutineEditorError('A routine save is already in progress.');
        approvals.delete(approved);
        rememberProgramming(replacement);
        const draft = { ...get(), routine: replacement, editorBuffers: {}, pendingAdd: null };
        set({
          routine: replacement,
          loadStatus: 'ready',
          editorBuffers: {}, pendingAdd: null, draftRevision: get().draftRevision + 1,
          ...editor.draftFlags(draft),
          error: null,
        });
        return await get().saveRoutineToDb();
      },

      applyTemplate: async (templateId: string) => {
        const currentState = get();
        const builtIn = currentState.templates.find(
          (candidate) => candidate.id === templateId,
        );
        if (builtIn) {
          return await get().replaceAndSaveRoutine(builtIn);
        }
        const template = currentState.customTemplates.find(
          (candidate) => candidate.id === templateId,
        );
        if (!template) {
          const error = new Error('The selected routine template is unavailable.');
          set({ error: error.message });
          throw error;
        }

        return await get().replaceAndSaveRoutine(template.plan, template.name);
      },

      applyAiRoutine: async (plan) => {
        return await get().replaceAndSaveRoutine(plan);
      },

      exportRoutine: () => {
        const routine = get().routine;
        if (!routine) return '';
        try {
          const jsonStr = JSON.stringify(routinePlanToLegacyPlan(routine));
          return btoa(encodeURIComponent(jsonStr));
        } catch (e) {
          console.error("Failed to export routine", e);
          return "";
        }
      },

      importRoutine: async (base64Str: string) => {
        let plan: LegacyDayPlan[];
        try {
          const jsonStr = decodeURIComponent(atob(base64Str));
          const parsed = JSON.parse(jsonStr) as unknown;
          if (!Array.isArray(parsed) || parsed.length !== 7) {
            throw new Error('The imported routine must contain seven days.');
          }
          plan = parsed as LegacyDayPlan[];
        } catch (error) {
          const message = error instanceof Error
            ? error.message
            : 'Unable to parse the imported routine.';
          console.error('Failed to import routine', error);
          set({ error: message });
          throw error;
        }

        return await get().replaceAndSaveRoutine(plan, 'Imported Routine');
      },

      saveCustomTemplate: (name, description, plan) => {
        const { customTemplates } = get();
        if (customTemplates.length >= 15) {
          return false; // Rate limit exceeded
        }
        const legacyPlan = Array.isArray(plan)
          ? normalizeLegacyPlanProgramming(plan)
          : routinePlanToLegacyPlan(plan);
        const activeDaysCount = legacyPlan.filter(
          (day) => day.type !== 'Rest' && day.mainLifts.length > 0,
        ).length;
        const newTemplate: RoutineTemplate = {
          id: `cust_${createRoutineUuid()}`,
          name: normalizeRoutineName(name),
          description: description || "Custom workout plan saved in app.",
          frequency: `${activeDaysCount || legacyPlan.filter(p => p.type !== 'Rest').length} days/week`,
          plan: legacyPlan,
        };
        set({ customTemplates: [...customTemplates, newTemplate] });
        return true;
      },

      deleteCustomTemplate: (templateId) => {
        set({
          customTemplates: get().customTemplates.filter(t => t.id !== templateId)
        });
      },

      resetActiveSplit: async () => {
        return await get().replaceAndSaveRoutine(
          BUILT_IN_ROUTINE_TEMPLATES[0],
        );
      },

      clearAllCustomTemplates: () => {
        set({ customTemplates: [] });
      }
    }); },
    {
      name: 'vortixia-custom-templates-storage',
      version: 1,
      migrate: () => ({ customTemplates: [] }),
      partialize: (state) => ({
        customTemplates: state.customTemplates,
      }),
      merge: (persistedState, currentState) => ({
        ...currentState,
        customTemplates: ((persistedState as Partial<RoutineStore>)?.customTemplates ?? []).map(template => {
          try { return { ...template, plan: normalizeLegacyPlanProgramming(template.plan) }; }
          catch { return template; } // Invalid legacy data is preserved; Apply rejects it, never erase templates.
        }),
      }),
    }
  )
);
