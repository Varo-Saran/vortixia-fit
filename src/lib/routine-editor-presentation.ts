import type { RoutinePlan, PlannedExerciseOccurrence, ExerciseSection } from '@/types/routine';
import type { EditorBuffer, EditorField } from '@/types/routine-editor';
import { occurrenceProgrammingPresentation } from './routine-cardio-presentation';
import { formatRest } from './routine-editor-controls';
import { decodeTrackingConfig, isWeightedMode } from './routine-programming';

// View state only. Never part of RoutinePlan, store revisions or RPC payloads.
export interface EditorDisclosure {
  dayId: string | null;
  occurrenceId: string | null;
  daySettingsId: string | null;
  routineSettings: boolean;
  reorder: { dayId: string; section: ExerciseSection } | null;
}
export const INITIAL_EDITOR_DISCLOSURE: EditorDisclosure = {
  dayId: null, occurrenceId: null, daySettingsId: null, routineSettings: false, reorder: null,
};
export type DisclosureAction =
  | { kind: 'day'; dayId: string }
  | { kind: 'occurrence'; dayId: string; occurrenceId: string }
  | { kind: 'day-settings'; dayId: string }
  | { kind: 'routine-settings' }
  | { kind: 'reorder'; dayId: string; section: ExerciseSection }
  | { kind: 'done' };

export function firstEditorError(buffers: Record<string, EditorBuffer>): EditorField | null {
  return Object.values(buffers).find(buffer => buffer.error)?.field ?? null;
}

export function transitionDisclosure(state: EditorDisclosure, action: DisclosureAction, buffers: Record<string, EditorBuffer>) {
  const blockedField = firstEditorError(buffers);
  if (blockedField) return { state, blockedField };
  const closed = { ...state, occurrenceId: null, daySettingsId: null, routineSettings: false, reorder: null };
  switch (action.kind) {
    case 'day': return { state: { ...closed, dayId: state.dayId === action.dayId ? null : action.dayId }, blockedField: null };
    case 'occurrence': return { state: { ...closed, dayId: action.dayId, occurrenceId: action.occurrenceId }, blockedField: null };
    case 'day-settings': return { state: { ...closed, dayId: action.dayId, daySettingsId: action.dayId }, blockedField: null };
    case 'routine-settings': return { state: { ...closed, routineSettings: true }, blockedField: null };
    case 'reorder': return { state: { ...closed, dayId: action.dayId, reorder: { dayId: action.dayId, section: action.section } }, blockedField: null };
    case 'done': return { state: closed, blockedField: null };
  }
}

// Shared invalid buffers may outlive a route remount. Reveal, don't discard them.
export function revealEditorError(state: EditorDisclosure, routine: RoutinePlan, buffers: Record<string, EditorBuffer>): EditorDisclosure {
  const field = firstEditorError(buffers);
  if (!field) return state;
  if (field.kind === 'routine-name') return { ...state, routineSettings: true, occurrenceId: null, daySettingsId: null, reorder: null };
  const day = routine.days.find(day => field.kind === 'day-title' ? day.id === field.dayId : day.exercises.some(item => item.id === field.occurrenceId));
  if (!day) return state;
  return { ...state, dayId: day.id, routineSettings: false, reorder: null,
    daySettingsId: field.kind === 'day-title' ? day.id : null,
    occurrenceId: field.kind === 'day-title' ? null : field.occurrenceId };
}

export function editorErrorInputId(field: EditorField, buffers: Record<string, EditorBuffer> = {}): string {
  if (field.kind === 'rest') return `rest-${field.occurrenceId}-custom`;
  if (field.kind === 'routine-name') return 'editor-routine-name';
  if (field.kind === 'day-title') return `editor-day-title:${field.dayId}`;
  if (field.kind === 'tracking-config') {
    try { if (isWeightedMode(decodeTrackingConfig(buffers[`tracking-config:${field.occurrenceId}`]?.raw ?? '').trackingType)) return `editor-tracking-config:${field.occurrenceId}-unit`; }
    catch { /* Focus Tracking for malformed raw configuration. */ }
  }
  return `editor-${field.kind}:${field.occurrenceId}`;
}

export function compactOccurrenceSummary(occurrence: PlannedExerciseOccurrence) {
  const presentation = occurrenceProgrammingPresentation(occurrence);
  // Format punctuation only for display; the original prescription is untouched.
  const target = occurrence.targetValue.replace(/(\d)-(\d)/g, '$1–$2');
  return {
    prescription: presentation.continuous ? target : presentation.cardio
      ? `${occurrence.targetSets} ${occurrence.targetSets === 1 ? 'Round' : 'Rounds'} · ${target}`
      : `${occurrence.targetSets} × ${target}`,
    unit: occurrence.weightUnit === 'unitless' ? null : occurrence.weightUnit,
    zone: presentation.zone,
    rest: `Rest: ${formatRest(occurrence.restSeconds)}`,
  };
}
