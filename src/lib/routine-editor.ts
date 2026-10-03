import { getExerciseById, getPreferredExerciseId } from './exercise-catalog';
import {
  assertValidRoutinePlan, createRoutineUuid, DAY_KINDS,
  WEEKDAYS, validateOptionalRestSeconds,
} from './routine-model';
import type { DayKind, DayPlan, NewPlannedExerciseOccurrence, PlannedExerciseOccurrence, RoutinePlan } from '@/types/routine';
import type { DeepReadonly, DraftState, EditorBuffer, EditorField } from '@/types/routine-editor';
import { decodeTrackingConfig, validateCardioZone, validateCompatibleTracking, validateTrackingConfig, type TrackingConfig } from './routine-programming';
import { isCatalogCardio } from './routine-cardio-presentation';

export class RoutineEditorError extends Error {
  constructor(message: string) { super(message); this.name = 'RoutineEditorError'; }
}
const fail = (message: string): never => { throw new RoutineEditorError(message); };
function text(value: string, max: number, label: string): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    return fail(`${label} must be nonempty and at most ${max} characters.`);
  }
  return value.trim();
}
function integer(value: number, max: number, label: string): number {
  if (!Number.isInteger(value) || value < 1 || value > max) return fail(`${label} must be an integer from 1 to ${max}.`);
  return value;
}
function dayById(routine: RoutinePlan, id: string): DayPlan {
  return routine.days.find(day => day.id === id) ?? fail('The selected day is unavailable.');
}
function editDay(routine: RoutinePlan, id: string, edit: (day: DayPlan) => DayPlan): RoutinePlan {
  const original = dayById(routine, id);
  const next = edit(original);
  return next === original ? routine : { ...routine, days: routine.days.map(day => day.id === id ? next : day) };
}
function editOccurrence(routine: RoutinePlan, id: string, edit: (occurrence: PlannedExerciseOccurrence) => PlannedExerciseOccurrence): RoutinePlan {
  const day = routine.days.find(value => value.exercises.some(exercise => exercise.id === id));
  if (!day) return fail('The selected occurrence is unavailable.');
  return editDay(routine, day.id, value => {
    const original = value.exercises.find(exercise => exercise.id === id)!;
    const next = edit(original);
    return next === original ? value : { ...value, exercises: value.exercises.map(exercise => exercise.id === id ? next : exercise) };
  });
}
const ordered = (day: DayPlan) => [...day.exercises].sort((a, b) => a.order - b.order);
const reindex = (exercises: PlannedExerciseOccurrence[]) => exercises.map((exercise, order) => ({ ...exercise, order }));

export function renameRoutine(routine: RoutinePlan, name: string): RoutinePlan {
  const value = text(name, 80, 'Routine name');
  return value === routine.name ? routine : { ...routine, name: value };
}
export function renameDay(routine: RoutinePlan, dayId: string, title: string): RoutinePlan {
  const value = text(title, 60, 'Day title');
  return editDay(routine, dayId, day => day.title === value ? day : { ...day, title: value });
}
export function setDayKind(routine: RoutinePlan, dayId: string, kind: DayKind): RoutinePlan {
  if (!DAY_KINDS.includes(kind)) return fail('Invalid day kind.');
  return editDay(routine, dayId, day => {
    if (kind === 'rest' && day.exercises.length) return fail('Remove all occurrences before changing this day to Rest.');
    return day.kind === kind ? day : { ...day, kind };
  });
}
export function setOccurrenceSets(routine: RoutinePlan, id: string, sets: number): RoutinePlan {
  integer(sets, 100, 'Sets');
  return editOccurrence(routine, id, exercise => exercise.targetSets === sets ? exercise : { ...exercise, targetSets: sets });
}
export function setOccurrenceTarget(routine: RoutinePlan, id: string, target: string): RoutinePlan {
  const value = text(target, 80, 'Target');
  return editOccurrence(routine, id, exercise => exercise.targetValue === value ? exercise : { ...exercise, targetValue: value });
}
export function setOccurrenceRest(routine: RoutinePlan, id: string, rest: number | null): RoutinePlan {
  try { validateOptionalRestSeconds(rest); } catch { return fail('Rest must be Default or an integer from 1 to 3600 seconds.'); }
  return editOccurrence(routine, id, exercise => exercise.restSeconds === rest ? exercise : { ...exercise, restSeconds: rest });
}
export function setOccurrenceCardioZone(routine: RoutinePlan, id: string, zone: import('@/types/routine').CardioZone | null): RoutinePlan {
  validateCardioZone(zone);
  return editOccurrence(routine, id, exercise => {
    if (!isCatalogCardio(exercise.exerciseId ? getExerciseById(exercise.exerciseId) : undefined)) return fail('Intensity Zones are available for canonical cardio exercises.');
    return exercise.cardioZone === zone ? exercise : { ...exercise, cardioZone: zone };
  });
}
export function setOccurrenceTrackingConfig(routine: RoutinePlan, id: string, config: TrackingConfig, historical?: TrackingConfig): RoutinePlan {
  return editOccurrence(routine, id, exercise => {
    validateCompatibleTracking(exercise.exerciseId ? getExerciseById(exercise.exerciseId) : undefined, config, historical ?? exercise);
    return exercise.trackingType === config.trackingType && exercise.weightUnit === config.weightUnit ? exercise
      : { ...exercise, trackingType: config.trackingType, weightUnit: config.weightUnit };
  });
}
export function moveOccurrence(routine: RoutinePlan, dayId: string, id: string, direction: 'up' | 'down'): RoutinePlan {
  if (direction !== 'up' && direction !== 'down') return fail('Invalid move direction.');
  return editDay(routine, dayId, day => {
    const exercises = ordered(day);
    const index = exercises.findIndex(exercise => exercise.id === id);
    if (index < 0) return fail('The selected occurrence is unavailable on this day.');
    const step = direction === 'up' ? -1 : 1;
    let neighbour = index + step;
    while (neighbour >= 0 && neighbour < exercises.length && exercises[neighbour].section !== exercises[index].section) neighbour += step;
    if (neighbour < 0 || neighbour >= exercises.length) return day;
    [exercises[index], exercises[neighbour]] = [exercises[neighbour], exercises[index]];
    return { ...day, exercises: reindex(exercises) };
  });
}
// Compatibility for existing reorder callers: section slots cannot change.
export function reorderDay(routine: RoutinePlan, dayId: string, ids: readonly string[]): RoutinePlan {
  return editDay(routine, dayId, day => {
    const previous = ordered(day);
    if (ids.length !== previous.length || new Set(ids).size !== ids.length) return fail('Reorder must include every occurrence exactly once.');
    const exercises = ids.map((id, index) => {
      const exercise = previous.find(value => value.id === id);
      if (!exercise || exercise.section !== previous[index].section) return fail('Reorder cannot change sections or reference unknown occurrences.');
      return exercise;
    });
    if (ids.every((id, index) => id === previous[index].id)) return day;
    return { ...day, exercises: reindex(exercises) };
  });
}
export function addOccurrence(routine: RoutinePlan, dayId: string, input: NewPlannedExerciseOccurrence): RoutinePlan {
  const day = dayById(routine, dayId);
  if (day.kind === 'rest') return fail('Exercises cannot be added to a Rest day.');
  if (day.exercises.length >= 1000) return fail('A day cannot contain more than 1000 occurrences.');
  const exercise = input.exerciseId ? getExerciseById(input.exerciseId) : undefined;
  if (!exercise || exercise.approval === 'red' || exercise.discoveryTier === 'hidden' || exercise.deprecatedForDiscovery || getPreferredExerciseId(exercise.id) !== exercise.id) {
    return fail('Select an available canonical exercise.');
  }
  validateCompatibleTracking(exercise, input);
  validateCardioZone(input.cardioZone);
  if (input.cardioZone !== null && !isCatalogCardio(exercise)) return fail('Intensity Zones are available for canonical cardio exercises.');
  const occurrence = {
    ...input, name: exercise.displayName, targetMuscle: exercise.primaryMuscle,
    targetSets: integer(input.targetSets, 100, 'Sets'), targetValue: text(input.targetValue, 80, 'Target'),
    // Validate all programming BEFORE allocating identity.
    id: '00000000-0000-4000-8000-000000000000', order: 0,
  };
  const exercises = ordered(day);
  const firstMain = exercises.findIndex(value => value.section === 'main');
  const position = input.section === 'warmup' && firstMain >= 0 ? firstMain : exercises.length;
  exercises.splice(position, 0, occurrence);
  const candidate = editDay(routine, dayId, value => ({ ...value, exercises: reindex(exercises) }));
  try { assertValidRoutinePlan(candidate); } catch (error) { return fail(error instanceof Error ? error.message : 'Invalid occurrence programming.'); }
  const freshId = createRoutineUuid();
  return editDay(candidate, dayId, value => ({ ...value, exercises: value.exercises.map((item, index) => index === position ? { ...item, id: freshId } : item) }));
}
export function removeOccurrence(routine: RoutinePlan, id: string): RoutinePlan {
  const day = routine.days.find(value => value.exercises.some(exercise => exercise.id === id));
  if (!day) return fail('The selected occurrence is unavailable.');
  return editDay(routine, day.id, value => ({ ...value, exercises: reindex(ordered(value).filter(exercise => exercise.id !== id)) }));
}

// Deliberately NOT save normalization/validation: projection must not repair data.
export function persistedRoutineProjection(routine: DeepReadonly<RoutinePlan>) {
  return {
    id: routine.id, name: routine.name,
    days: [...routine.days].sort((a, b) => WEEKDAYS.indexOf(a.weekday) - WEEKDAYS.indexOf(b.weekday)).map(day => ({
      id: day.id, weekday: day.weekday, title: day.title, kind: day.kind,
      exercises: [...day.exercises].sort((a, b) => a.order - b.order).map(exercise => ({
        id: exercise.id, exerciseId: exercise.exerciseId, name: exercise.name, targetMuscle: exercise.targetMuscle,
        section: exercise.section, order: exercise.order, targetSets: exercise.targetSets, targetValue: exercise.targetValue,
        trackingType: exercise.trackingType, weightUnit: exercise.weightUnit, restSeconds: exercise.restSeconds, cardioZone: exercise.cardioZone,
        note: exercise.note ?? null,
      })),
    })),
  };
}
export const routineFingerprint = (routine: DeepReadonly<RoutinePlan>) => JSON.stringify(persistedRoutineProjection(routine));
export function cloneRoutine(routine: DeepReadonly<RoutinePlan>): RoutinePlan { return structuredClone(routine) as RoutinePlan; }
export function immutableRoutine(routine: RoutinePlan): DeepReadonly<RoutinePlan> {
  const copy = cloneRoutine(routine);
  copy.days.forEach(day => { day.exercises.forEach(Object.freeze); Object.freeze(day.exercises); Object.freeze(day); });
  Object.freeze(copy.days);
  return Object.freeze(copy);
}
export function editorFieldKey(field: EditorField): string {
  return field.kind === 'routine-name' ? field.kind : `${field.kind}:${'dayId' in field ? field.dayId : field.occurrenceId}`;
}
export function applyEditorField(routine: RoutinePlan, field: EditorField, raw: string, historical?: TrackingConfig): RoutinePlan {
  switch (field.kind) {
    case 'routine-name': return renameRoutine(routine, raw);
    case 'day-title': return renameDay(routine, field.dayId, raw);
    case 'sets': return setOccurrenceSets(routine, field.occurrenceId, raw.trim() ? Number(raw) : NaN);
    case 'target': return setOccurrenceTarget(routine, field.occurrenceId, raw);
    // Explicit Default is distinct from an incomplete custom numeric input.
    case 'rest': return setOccurrenceRest(routine, field.occurrenceId, raw === 'default' ? null : raw.trim() ? Number(raw) : NaN);
    case 'zone': return setOccurrenceCardioZone(routine, field.occurrenceId, raw === 'none' ? null : Number(raw) as import('@/types/routine').CardioZone);
    case 'tracking-config': {
      const config = decodeTrackingConfig(raw);
      validateTrackingConfig(config);
      return setOccurrenceTrackingConfig(routine, field.occurrenceId, config, historical);
    }
  }
}
export function createEditorBuffer(routine: RoutinePlan, field: EditorField, raw: string, historical?: TrackingConfig): EditorBuffer {
  try {
    const next = applyEditorField(routine, field, raw, historical);
    return { field: { ...field }, raw, changed: routineFingerprint(next) !== routineFingerprint(routine), error: null };
  } catch (error) { return { field: { ...field }, raw, changed: true, error: error instanceof Error ? error.message : 'Invalid input.' }; }
}
export function draftFlags(state: DraftState) {
  const baseline = state.savedBaseline ?? state.initialDefaultDraft;
  const isDirty = !!state.routine && (
    !baseline || routineFingerprint(state.routine) !== routineFingerprint(baseline)
    || Object.values(state.editorBuffers).some(buffer => buffer.changed || buffer.error)
    || state.pendingAdd !== null
  );
  const neverSaved = !!state.routine && !state.savedBaseline && !!state.initialDefaultDraft;
  return { isDirty, hasUnsavedChanges: isDirty || neverSaved, draftStatus: neverSaved ? 'Not saved yet' as const : isDirty ? 'Unsaved changes' as const : 'Saved' as const };
}
export function draftGuardFingerprint(state: DraftState): string {
  return JSON.stringify({ routine: state.routine && persistedRoutineProjection(state.routine),
    buffers: Object.keys(state.editorBuffers).sort().map(key => [key, state.editorBuffers[key]]), pendingAdd: state.pendingAdd });
}
