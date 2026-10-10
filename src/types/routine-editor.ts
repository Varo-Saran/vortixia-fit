import type { CardioZone, ExerciseSection, RoutinePlan, TrackingType, WeightUnit } from './routine';

export type DeepReadonly<T> = T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;
export type EditorField =
  | { kind: 'routine-name' }
  | { kind: 'day-title'; dayId: string }
  | { kind: 'sets' | 'target' | 'rest' | 'zone' | 'tracking-config'; occurrenceId: string };
export interface EditorBuffer {
  field: EditorField;
  // Rest uses "default" for null; blank custom input is invalid, not Default.
  raw: string;
  changed: boolean;
  error: string | null;
}
export interface PendingAdd {
  dayId: string;
  section: ExerciseSection;
  exerciseId: string;
  rawSets: string;
  rawTarget: string;
  trackingType: TrackingType | null;
  weightUnit: WeightUnit | null;
  restSeconds: number | null;
  cardioZone: CardioZone | null;
  // Raw custom input survives route remounts without entering the graph.
  rawRest?: string;
}
export interface DraftState {
  routine: RoutinePlan | null;
  savedBaseline: DeepReadonly<RoutinePlan> | null;
  initialDefaultDraft: DeepReadonly<RoutinePlan> | null;
  editorBuffers: Record<string, EditorBuffer>;
  pendingAdd: PendingAdd | null;
}
export type DraftStatus = 'Saved' | 'Unsaved changes' | 'Not saved yet';
export interface SaveOutcome {
  submittedRevision: number;
  status: 'saved' | 'saved-with-newer-edits' | 'unchanged';
}
export interface ReplacementApproval {
  readonly revision: number;
  readonly fingerprint: string;
}
export interface RecoveryReplacementApproval extends ReplacementApproval {
  readonly subjectId: string;
  readonly generation: number;
  readonly sourceFingerprint: string;
  readonly replacementFingerprint: string;
}
