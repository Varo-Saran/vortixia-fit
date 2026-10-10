import { decodeRoutineRowsForRead, detachedImmutable, readGraphFingerprint, routineCapabilities } from './routine-compatibility';
import { isDayStartable, mainOccurrences } from './routine-model';
import type { RoutineCompatibilityIssue, RoutineReadGraph, VerifiedRoutineSnapshot } from '@/types/routine-compatibility';
import type { RoutineCapabilityState } from './routine-compatibility';
import type { DraftState } from '@/types/routine-editor';
import { draftGuardFingerprint } from './routine-editor';

// Display text only. Never use this projection to construct a write candidate.
export function savedValue(value: unknown): string {
  if (value === null) return 'None';
  if (value === undefined) return 'Missing';
  if (typeof value === 'string') return value || '(empty)';
  return JSON.stringify(value) ?? 'Unsupported saved value';
}
export function recoveryIssueHandling(issues: readonly RoutineCompatibilityIssue[]) {
  return issues.every(issue => issue.resolution === 'programming-control' && issue.target.kind === 'occurrence' &&
    ['tracking_unit_mismatch', 'unsupported_tracking', 'unsupported_unit'].includes(issue.code))
    ? 'inline' as const : 'replacement' as const;
}
export function recoveryGuardFingerprint(state: DraftState & { readGraph: RoutineReadGraph | null }) {
  return state.readGraph ? JSON.stringify({ graph: readGraphFingerprint(state.readGraph), buffers: state.editorBuffers, add: state.pendingAdd }) : draftGuardFingerprint(state);
}
export function workoutDaySelection(state: RoutineCapabilityState, dayId: string) {
  if (!routineCapabilities(state).canStartWorkout) throw new Error('Fix and save your routine before starting a workout.');
  const day = state.routine?.days.find(day => day.id === dayId);
  if (!day || !isDayStartable(day)) throw new Error('Choose a training day with exercises.');
  return { title: day.title, exercises: mainOccurrences(day) };
}

export const RECOVERY_BACKUP_FORMAT = 'vortixia-private-routine-recovery';
export interface RoutineRecoveryBackup {
  format: typeof RECOVERY_BACKUP_FORMAT;
  version: 1;
  capturedAt: string;
  source: VerifiedRoutineSnapshot;
}
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const keys = (value: Record<string, unknown>, allowed: readonly string[]) => Object.keys(value).every(key => allowed.includes(key));
export async function sourceFingerprint(rows: unknown): Promise<string> {
  const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical) : record(value)
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
  const bytes = new TextEncoder().encode(JSON.stringify(canonical(rows)));
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
}
export async function validateRecoveryBackup(input: unknown): Promise<RoutineRecoveryBackup> {
  if (!record(input) || !keys(input, ['format', 'version', 'capturedAt', 'source']) || input.format !== RECOVERY_BACKUP_FORMAT || input.version !== 1
    || typeof input.capturedAt !== 'string' || !Number.isFinite(Date.parse(input.capturedAt)) || !record(input.source)) throw new Error('Invalid private recovery backup.');
  const source = input.source;
  if (!keys(source, ['rows', 'subjectId', 'generation', 'source', 'fingerprint']) || !record(source.rows)
    || !keys(source.rows, ['routine', 'days', 'exercises']) || !['database', 'legacy-input'].includes(String(source.source))
    || typeof source.fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(source.fingerprint)) throw new Error('Invalid recovery source evidence.');
  const rows = source.rows;
  const projections = [
    [rows.routine], rows.days, rows.exercises,
  ];
  const columns = [
    ['id', 'user_id', 'name', 'is_active', 'created_at'],
    ['id', 'routine_id', 'day_name', 'short_day', 'type', 'title', 'created_at'],
    ['id', 'routine_day_id', 'exercise_id', 'name', 'type', 'tracking_style', 'weight_unit', 'target_sets', 'target_reps', 'rest_seconds', 'cardio_zone', 'note', 'is_warmup', 'order_index', 'created_at'],
  ];
  if (projections.some((group, i) => !Array.isArray(group) || group.some(row => !record(row) || !keys(row, columns[i])))) throw new Error('Recovery backup contains unexpected fields.');
  const snapshot = source as unknown as VerifiedRoutineSnapshot;
  decodeRoutineRowsForRead(snapshot.rows, snapshot);
  if (await sourceFingerprint(snapshot.rows) !== snapshot.fingerprint) throw new Error('Recovery backup fingerprint does not match.');
  return detachedImmutable(input as unknown as RoutineRecoveryBackup);
}
export async function createRecoveryBackup(source: VerifiedRoutineSnapshot, capturedAt = new Date().toISOString()) {
  return validateRecoveryBackup({ format: RECOVERY_BACKUP_FORMAT, version: 1, capturedAt, source });
}
export async function downloadRecoveryBackup(source: VerifiedRoutineSnapshot) {
  const backup = await createRecoveryBackup(source);
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = `vortixia-routine-recovery-backup-${backup.capturedAt.replace(/[:.]/g, '-')}.json`;
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
