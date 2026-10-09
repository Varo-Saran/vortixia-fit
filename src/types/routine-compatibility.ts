import type { PlannedExerciseOccurrence, RoutinePlan, Weekday } from './routine';
import type { DeepReadonly } from './routine-editor';

// A read DTO is deliberately not a RoutinePlan. Unknown values are evidence,
// not current-domain defaults, and cannot be submitted to the save serializer.
export interface RoutineReadOccurrence {
  id: string;
  dayId: string;
  fields: Partial<Record<Exclude<keyof PlannedExerciseOccurrence, 'id'>, unknown>>;
}
export interface RoutineReadDay {
  id: string;
  routineId: string;
  weekday: Weekday;
  rawWeekday: unknown;
  title: unknown;
  kind: unknown;
  exercises: RoutineReadOccurrence[];
}
export interface RoutineReadGraph { id: string; name: unknown; days: RoutineReadDay[] }
export type CompatibilityTarget = { kind: 'routine' }
  | { kind: 'day'; dayId: string }
  | { kind: 'occurrence'; dayId: string; occurrenceId: string };
export type CompatibilityField = Exclude<keyof PlannedExerciseOccurrence, 'id'> | 'title' | 'kind' | 'capacity';
export type CompatibilityCode = 'invalid_text' | 'invalid_catalog_id' | 'unsupported_day_kind'
  | 'rest_day_has_occurrences' | 'invalid_section' | 'invalid_order' | 'invalid_sets'
  | 'unsupported_tracking' | 'unsupported_unit' | 'tracking_unit_mismatch'
  | 'invalid_zone' | 'invalid_rest' | 'invalid_note' | 'write_capacity_exceeded';
export interface RoutineCompatibilityIssue {
  target: CompatibilityTarget;
  fields: readonly CompatibilityField[];
  code: CompatibilityCode;
  severity: 'blocking' | 'warning';
  message: string;
  resolution: 'programming-control' | 'replacement-or-support';
}
export type RoutineReadSource = 'database' | 'legacy-input';
export interface RoutineNormalization {
  rule: 'weekday-representation' | 'legacy-pound-unit' | 'legacy-absent-zone' | 'unique-order-gaps';
  source: RoutineReadSource;
  target: CompatibilityTarget;
  fields: readonly string[];
}
export interface RoutineReadContext { subjectId: string; generation: number; source: RoutineReadSource }
export interface RawRoutineRows {
  routine: unknown;
  days: unknown;
  exercises: unknown;
}
export interface VerifiedRoutineSnapshot {
  readonly rows: DeepReadonly<RawRoutineRows>;
  readonly subjectId: string;
  readonly generation: number;
  readonly source: RoutineReadSource;
  readonly fingerprint: string;
}
export interface RoutineLoadError {
  kind: 'auth' | 'transport' | 'graph';
  code: 'auth_required' | 'subject_changed' | 'incomplete_read' | 'ambiguous_root'
    | 'invalid_identity' | 'duplicate_identity' | 'foreign_relationship' | 'weekday_graph';
  message: string;
}
export type RoutineLoadResult = { status: 'empty' }
  | { status: 'valid'; routine: RoutinePlan; source: VerifiedRoutineSnapshot; normalizations: readonly RoutineNormalization[] }
  | { status: 'needs_attention'; routine: RoutineReadGraph; source: VerifiedRoutineSnapshot;
      issues: readonly RoutineCompatibilityIssue[]; normalizations: readonly RoutineNormalization[] }
  | { status: 'fatal'; error: RoutineLoadError; source: VerifiedRoutineSnapshot | null };
