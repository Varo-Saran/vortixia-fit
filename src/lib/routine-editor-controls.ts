import type { ResolvedExercise } from '@/types/exercise-catalog';
import type { DayPlan, ExerciseSection, TrackingType, WeightUnit } from '@/types/routine';
import type { DraftState, EditorField, PendingAdd } from '@/types/routine-editor';
import { validateOptionalRestSeconds } from './routine-model';

export const REST_PRESETS = [30, 45, 60, 90, 120, 180] as const;
export const TRACKING_LABELS: Record<TrackingType, string> = {
  reps_weight: 'Reps + Weight', reps_only: 'Reps', time_only: 'Time',
  time_weight: 'Time + Weight', cardio_hr: 'Cardio / HR',
};
export const UNIT_LABELS: Record<WeightUnit, string> = {
  kg: 'kg', lbs: 'lbs', plates: 'plates', unitless: 'Unitless',
};
export const isWeightedMode = (mode: TrackingType | null) => mode === 'reps_weight' || mode === 'time_weight';
export function parseRestInput(raw: string): number | null {
  if (raw === 'default') return null;
  const value = raw.trim() ? Number(raw) : NaN;
  validateOptionalRestSeconds(value);
  return value;
}
export function formatRest(seconds: number | null): string {
  if (seconds === null) return 'Default';
  const minutes = Math.floor(seconds / 60), remainder = seconds % 60;
  return [minutes ? `${minutes} min` : '', remainder ? `${remainder} sec` : ''].filter(Boolean).join(' ');
}
export function restSelection(raw: string): string {
  return raw === 'default' || REST_PRESETS.some(value => String(value) === raw) ? raw : 'custom';
}
export function createPendingAdd(exercise: ResolvedExercise, dayId: string, section: ExerciseSection = 'main'): PendingAdd {
  const trackingType = exercise.defaultTrackingType ?? null;
  const declaredUnit = exercise.supportedWeightUnits?.[0];
  return {
    dayId, section, exerciseId: exercise.id, rawSets: '3', rawTarget: '',
    trackingType, weightUnit: trackingType && !isWeightedMode(trackingType) ? 'unitless'
      : declaredUnit === 'lb' ? 'lbs' : declaredUnit ?? null,
    restSeconds: null, rawRest: 'default',
  };
}
export function addTrackingOptions(exercise: ResolvedExercise): TrackingType[] {
  return exercise.defaultTrackingType ? [exercise.defaultTrackingType] : Object.keys(TRACKING_LABELS) as TrackingType[];
}
export function addUnitOptions(exercise: ResolvedExercise, mode: TrackingType | null): WeightUnit[] {
  if (!mode) return [];
  if (!isWeightedMode(mode)) return ['unitless'];
  return exercise.supportedWeightUnits?.map(unit => unit === 'lb' ? 'lbs' : unit) ?? ['kg', 'lbs', 'plates'];
}
export function changeAddTracking(pending: PendingAdd, trackingType: TrackingType): PendingAdd {
  return { ...pending, trackingType, weightUnit: isWeightedMode(trackingType) ? null : 'unitless' };
}
export function pendingAddErrors(pending: PendingAdd, exercise: ResolvedExercise, day: DayPlan): Record<string, string> {
  const errors: Record<string, string> = {};
  const sets = pending.rawSets.trim() ? Number(pending.rawSets) : NaN;
  if (!Number.isInteger(sets) || sets < 1 || sets > 100) errors.sets = 'Enter a whole number from 1 to 100.';
  if (!pending.rawTarget.trim() || pending.rawTarget.trim().length > 80) errors.target = 'Enter a prescription of 1–80 characters.';
  if (!pending.trackingType || !addTrackingOptions(exercise).includes(pending.trackingType)) errors.tracking = 'Choose a supported logging mode.';
  if (!pending.weightUnit || !addUnitOptions(exercise, pending.trackingType).includes(pending.weightUnit)) errors.unit = 'Choose a supported unit.';
  try { parseRestInput(pending.rawRest ?? (pending.restSeconds === null ? 'default' : String(pending.restSeconds))); }
  catch { errors.rest = 'Use Default or a whole number from 1 to 3600 seconds.'; }
  if (day.kind === 'rest' || pending.dayId !== day.id) errors.day = 'Exercises cannot be added to this day.';
  if (pending.section !== 'warmup' && pending.section !== 'main') errors.section = 'Choose Warm-up or Main.';
  return errors;
}
export function canSaveEditor(state: DraftState & { loadStatus: string; isSaving: boolean; hasUnsavedChanges: boolean }): boolean {
  return !!state.routine && state.loadStatus === 'ready' && !state.isSaving && state.hasUnsavedChanges
    && !state.pendingAdd && !Object.values(state.editorBuffers).some(buffer => buffer.error);
}

// Buffer commits dispatch only through the existing D2B operations. No graph
// mutation or independent dirty/save state is introduced by the UI.
export function commitEditorInput(field: EditorField, raw: string, actions: {
  setRoutineName: (name: string) => void;
  updateDayMetadata: (weekday: DayPlan['weekday'], updates: { title: string }) => void;
  updateOccurrence: (id: string, updates: { targetSets?: number; targetValue?: string; restSeconds?: number | null }) => void;
}, days: readonly DayPlan[]): void {
  switch (field.kind) {
    case 'routine-name': actions.setRoutineName(raw); break;
    case 'day-title': {
      const day = days.find(value => value.id === field.dayId);
      if (!day) throw new Error('The selected day is unavailable.');
      actions.updateDayMetadata(day.weekday, { title: raw }); break;
    }
    case 'sets': actions.updateOccurrence(field.occurrenceId, { targetSets: raw.trim() ? Number(raw) : NaN }); break;
    case 'target': actions.updateOccurrence(field.occurrenceId, { targetValue: raw }); break;
    case 'rest': actions.updateOccurrence(field.occurrenceId, { restSeconds: parseRestInput(raw) }); break;
  }
}
