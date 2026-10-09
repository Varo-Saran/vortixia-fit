import { assertValidRoutinePlan, DAY_KINDS, EXERCISE_SECTIONS, parseWeekday, WEEKDAYS } from './routine-model';
import { legacyCardioZone, PROGRAMMING_TRACKING_TYPES, PROGRAMMING_WEIGHT_UNITS, isWeightedMode, validateTrackingConfig, validateCompatibleTracking, programmingOptions, type TrackingConfig } from './routine-programming';
import { getExerciseById } from './exercise-catalog';
import type { RoutinePlan, TrackingType } from '@/types/routine';
import type { CompatibilityCode, CompatibilityField, CompatibilityTarget, RawRoutineRows, RoutineCompatibilityIssue, RoutineLoadError, RoutineLoadResult, RoutineNormalization, RoutineReadContext, RoutineReadGraph, RoutineReadSource, VerifiedRoutineSnapshot } from '@/types/routine-compatibility';

const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const whole = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
const text = (value: unknown, max: number) => typeof value === 'string' && !!value.trim() && value.length <= max;
const contains = (values: readonly string[], value: unknown): value is string => typeof value === 'string' && values.includes(value);
const own = (row: Record<string, unknown>, fields: readonly string[]) => fields.every(field => Object.hasOwn(row, field));
export function detachedImmutable<T>(value: T): T {
  const copy = structuredClone(value);
  const freeze = (item: unknown) => { if (item && typeof item === 'object') { Object.values(item).forEach(freeze); Object.freeze(item); } };
  freeze(copy); return copy;
}
// Private, canonical evidence; callers must never log it. SHA-256 is used for
// source snapshots; the synchronous draft projection preserves unknown values.
export function readGraphFingerprint(graph: RoutineReadGraph): string { return JSON.stringify(graph); }
const fatal = (code: RoutineLoadError['code'], message: string): never => { throw Object.assign(new Error(message), { code }); };
const graphKeys = ['id', 'routine_day_id', 'exercise_id', 'name', 'type', 'tracking_style', 'weight_unit', 'target_sets', 'target_reps', 'rest_seconds', 'note', 'is_warmup', 'order_index', 'created_at'];
export const ROUTINE_NORMALIZATION_RULES = detachedImmutable({
  'weekday-representation': ['database', 'legacy-input'],
  'legacy-pound-unit': ['database', 'legacy-input'],
  'legacy-absent-zone': ['legacy-input'],
  'unique-order-gaps': ['database', 'legacy-input'],
} as const);

export function decodeRoutineRowsForRead(rows: RawRoutineRows, context: RoutineReadContext): RoutineReadGraph {
  if (!uuid(context.subjectId) || !whole(context.generation, 0, Number.MAX_SAFE_INTEGER)) fatal('invalid_identity', 'The routine owner context is unavailable.');
  if (!record(rows.routine) || !Array.isArray(rows.days) || !Array.isArray(rows.exercises)) fatal('incomplete_read', 'The complete routine could not be read.');
  const root = rows.routine as Record<string, unknown>;
  if (!own(root, ['id', 'user_id', 'is_active', 'name', 'created_at'])) fatal('incomplete_read', 'The routine root read is incomplete.');
  if (typeof root.created_at !== 'string') fatal('incomplete_read', 'The routine timestamp is unavailable.');
  if (!uuid(root.id)) fatal('invalid_identity', 'The routine identity is invalid.');
  if (root.user_id !== context.subjectId || root.is_active !== true) fatal('foreign_relationship', 'The routine owner context does not match.');
  const dayIds = new Set<string>(), weekdays = new Set<string>(), occurrenceIds = new Set<string>();
  const graph: RoutineReadGraph = { id: root.id as string, name: root.name, days: [] };
  for (const input of rows.days as unknown[]) {
    if (!record(input) || !own(input, ['id', 'routine_id', 'day_name', 'short_day', 'type', 'title', 'created_at'])) fatal('incomplete_read', 'The routine day read is incomplete.');
    const day = input as Record<string, unknown>;
    if (typeof day.created_at !== 'string') fatal('incomplete_read', 'A routine day timestamp is unavailable.');
    if (!uuid(day.id)) fatal('invalid_identity', 'A routine day identity is invalid.');
    if (dayIds.has(day.id as string)) fatal('duplicate_identity', 'Routine day identities are duplicated.');
    if (day.routine_id !== root.id) fatal('foreign_relationship', 'A routine day belongs to another graph.');
    const weekday = typeof day.day_name === 'string' ? parseWeekday(day.day_name) : null;
    if (!weekday || weekdays.has(weekday)) fatal('weekday_graph', 'The routine weekday graph is ambiguous.');
    dayIds.add(day.id as string); weekdays.add(weekday!);
    graph.days.push({ id: day.id as string, routineId: root.id as string, weekday: weekday!, rawWeekday: day.day_name, title: day.title, kind: day.type, exercises: [] });
  }
  if (graph.days.length !== 7 || WEEKDAYS.some(day => !weekdays.has(day))) fatal('weekday_graph', 'The routine needs seven distinct weekday plans.');
  for (const input of rows.exercises as unknown[]) {
    if (!record(input) || !own(input, context.source === 'database' ? [...graphKeys, 'cardio_zone'] : graphKeys)) fatal('incomplete_read', 'The planned-exercise read is incomplete.');
    const row = input as Record<string, unknown>;
    if (typeof row.created_at !== 'string') fatal('incomplete_read', 'An occurrence timestamp is unavailable.');
    if (!uuid(row.id)) fatal('invalid_identity', 'An occurrence identity is invalid.');
    if (occurrenceIds.has(row.id as string)) fatal('duplicate_identity', 'Occurrence identities are duplicated.');
    const day = graph.days.find(value => value.id === row.routine_day_id);
    if (!day) fatal('foreign_relationship', 'An occurrence belongs to an unavailable day.');
    occurrenceIds.add(row.id as string);
    const fields: RoutineReadGraph['days'][number]['exercises'][number]['fields'] = {
      exerciseId: row.exercise_id, name: row.name, targetMuscle: row.type,
      section: typeof row.is_warmup === 'boolean' ? row.is_warmup ? 'warmup' : 'main' : row.is_warmup,
      order: row.order_index, targetSets: row.target_sets, targetValue: row.target_reps,
      trackingType: row.tracking_style, weightUnit: row.weight_unit, restSeconds: row.rest_seconds, note: row.note,
    };
    if (Object.hasOwn(row, 'cardio_zone')) fields.cardioZone = row.cardio_zone;
    day!.exercises.push({ id: row.id as string, dayId: day!.id, fields });
  }
  return graph;
}

export function normalizeKnownLegacyRepresentations(input: RoutineReadGraph, context: RoutineReadContext) {
  const graph = structuredClone(input), normalizations: RoutineNormalization[] = [];
  const enabled = (rule: RoutineNormalization['rule']) => (ROUTINE_NORMALIZATION_RULES[rule] as readonly RoutineReadSource[]).includes(context.source);
  const add = (rule: RoutineNormalization['rule'], target: CompatibilityTarget, fields: string[]) => normalizations.push({ rule, source: context.source, target, fields });
  // Registered rules are intentionally independent of names/equipment/defaults.
  for (const day of graph.days) {
    const canonicalWeekday = day.weekday[0].toUpperCase() + day.weekday.slice(1);
    if (enabled('weekday-representation') && day.rawWeekday !== canonicalWeekday) { day.rawWeekday = canonicalWeekday; add('weekday-representation', { kind: 'day', dayId: day.id }, ['weekday']); }
    for (const occurrence of day.exercises) {
      const f = occurrence.fields, target: CompatibilityTarget = { kind: 'occurrence', dayId: day.id, occurrenceId: occurrence.id };
      if (enabled('legacy-pound-unit') && f.weightUnit === 'lb') { f.weightUnit = 'lbs'; add('legacy-pound-unit', target, ['weightUnit']); }
      if (enabled('legacy-absent-zone') && !Object.hasOwn(f, 'cardioZone')) {
        f.cardioZone = legacyCardioZone(typeof f.exerciseId === 'string' ? f.exerciseId : null,
          typeof f.targetValue === 'string' ? f.targetValue : undefined, typeof f.note === 'string' ? f.note : undefined);
        add('legacy-absent-zone', target, ['cardioZone']);
      }
    }
    const orders = day.exercises.map(item => item.fields.order);
    if (enabled('unique-order-gaps') && orders.every(value => whole(value, 0, Number.MAX_SAFE_INTEGER)) && new Set(orders).size === orders.length) {
      day.exercises.sort((a, b) => (a.fields.order as number) - (b.fields.order as number));
      day.exercises.forEach((item, index) => { if (item.fields.order !== index) { item.fields.order = index; add('unique-order-gaps', { kind: 'occurrence', dayId: day.id, occurrenceId: item.id }, ['order']); } });
    }
  }
  graph.days.sort((a, b) => WEEKDAYS.indexOf(a.weekday) - WEEKDAYS.indexOf(b.weekday));
  return { graph, normalizations };
}

export function analyzeRoutineCompatibility(graph: RoutineReadGraph): RoutineCompatibilityIssue[] {
  const issues: RoutineCompatibilityIssue[] = [];
  const issue = (target: CompatibilityTarget, fields: CompatibilityField[], code: CompatibilityCode, message: string,
    resolution: RoutineCompatibilityIssue['resolution'] = 'programming-control') => issues.push({ target, fields, code, message, severity: 'blocking', resolution });
  if (!text(graph.name, 80)) issue({ kind: 'routine' }, ['name'], 'invalid_text', 'Choose a routine name of 1–80 characters.');
  for (const day of graph.days) {
    const target: CompatibilityTarget = { kind: 'day', dayId: day.id };
    if (!text(day.title, 60)) issue(target, ['title'], 'invalid_text', 'Choose a day title of 1–60 characters.');
    if (!contains(DAY_KINDS, day.kind)) issue(target, ['kind'], 'unsupported_day_kind', 'Choose a supported day kind.');
    if (day.kind === 'rest' && day.exercises.length) issue(target, ['kind'], 'rest_day_has_occurrences', 'Choose how to handle activities on this Rest day.');
    if (day.exercises.length > 200) issue(target, ['capacity'], 'write_capacity_exceeded', 'This day exceeds the saved-routine capacity.', 'replacement-or-support');
    const orders = day.exercises.map(item => item.fields.order);
    day.exercises.forEach(item => {
      const f = item.fields, target: CompatibilityTarget = { kind: 'occurrence', dayId: day.id, occurrenceId: item.id };
      for (const [field, max] of [['name', 160], ['targetMuscle', 80], ['targetValue', 80]] as const) if (!text(f[field], max)) issue(target, [field], 'invalid_text', 'This programming text needs attention.', field === 'targetValue' ? 'programming-control' : 'replacement-or-support');
      if (f.exerciseId !== null && !text(f.exerciseId, 160)) issue(target, ['exerciseId'], 'invalid_catalog_id', 'The stored exercise identity needs attention.', 'replacement-or-support');
      if (!contains(EXERCISE_SECTIONS, f.section)) issue(target, ['section'], 'invalid_section', 'Choose the intended exercise section.', 'replacement-or-support');
      if (!whole(f.order, 0, 999) || orders.filter(order => order === f.order).length !== 1 || !orders.includes(day.exercises.indexOf(item))) issue(target, ['order'], 'invalid_order', 'The exercise order needs an explicit resolution.', 'replacement-or-support');
      if (!whole(f.targetSets, 1, 100)) issue(target, ['targetSets'], 'invalid_sets', 'Choose whole sets or rounds from 1 to 100.');
      const trackingValid = contains(PROGRAMMING_TRACKING_TYPES, f.trackingType), unitValid = contains(PROGRAMMING_WEIGHT_UNITS, f.weightUnit);
      if (!trackingValid) issue(target, ['trackingType'], 'unsupported_tracking', 'Choose a supported tracking method.');
      if (!unitValid) issue(target, ['weightUnit'], 'unsupported_unit', 'Choose a supported load unit.');
      if (trackingValid && unitValid && (isWeightedMode(f.trackingType as TrackingType) ? f.weightUnit === 'unitless' : f.weightUnit !== 'unitless')) issue(target, ['trackingType', 'weightUnit'], 'tracking_unit_mismatch', 'Choose the intended tracking method and compatible load unit.');
      if (f.cardioZone !== null && !whole(f.cardioZone, 1, 5)) issue(target, ['cardioZone'], 'invalid_zone', 'Choose None or Zone 1–5.');
      if (f.restSeconds !== null && !whole(f.restSeconds, 1, 3600)) issue(target, ['restSeconds'], 'invalid_rest', 'Choose Default or whole rest seconds from 1 to 3600.');
      if (f.note !== null && f.note !== undefined && (typeof f.note !== 'string' || f.note.length > 1000)) issue(target, ['note'], 'invalid_note', 'The original note needs attention.', 'replacement-or-support');
    });
  }
  return issues;
}

export function promoteRoutineForWrite(graph: RoutineReadGraph): RoutinePlan {
  if (graph.days.some(day => day.routineId !== graph.id || day.exercises.some(item => item.dayId !== day.id))) throw new Error('The read graph relationships changed.');
  if (analyzeRoutineCompatibility(graph).some(issue => issue.severity === 'blocking')) throw new Error('Resolve routine compatibility issues before saving.');
  // The checked DTO has current-domain values. The existing validator remains
  // authoritative, including structural checks on a caller-mutated DTO.
  const candidate = { id: graph.id, name: graph.name, days: graph.days.map(day => ({ id: day.id, weekday: day.weekday,
    title: day.title, kind: day.kind, exercises: day.exercises.map(item => ({ id: item.id,
      exerciseId: item.fields.exerciseId, name: item.fields.name, targetMuscle: item.fields.targetMuscle,
      section: item.fields.section, order: item.fields.order, targetSets: item.fields.targetSets, targetValue: item.fields.targetValue,
      trackingType: item.fields.trackingType, weightUnit: item.fields.weightUnit, cardioZone: item.fields.cardioZone,
      restSeconds: item.fields.restSeconds, note: item.fields.note ?? undefined })) })) } as RoutinePlan;
  assertValidRoutinePlan(candidate);
  return candidate;
}

export async function routineLoadResultFromRows(rows: RawRoutineRows, context: RoutineReadContext): Promise<RoutineLoadResult> {
  let source: VerifiedRoutineSnapshot | null = null;
  try {
    const graph = decodeRoutineRowsForRead(rows, context);
    const evidence = structuredClone(rows);
    const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical) : record(value)
      ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
    const bytes = new TextEncoder().encode(JSON.stringify(canonical(evidence)));
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    source = detachedImmutable({ rows: evidence, ...context, fingerprint: Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('') });
    const normalized = normalizeKnownLegacyRepresentations(graph, context);
    const issues = analyzeRoutineCompatibility(normalized.graph);
    if (issues.length) return { status: 'needs_attention', routine: normalized.graph, source, issues, normalizations: normalized.normalizations };
    return { status: 'valid', routine: promoteRoutineForWrite(normalized.graph), source, normalizations: normalized.normalizations };
  } catch (error) {
    return { status: 'fatal', source, error: { kind: 'graph', code: record(error) && typeof error.code === 'string' ? error.code as RoutineLoadError['code'] : 'incomplete_read', message: 'The routine graph could not be safely decoded. No data was changed.' } };
  }
}

// Existing occurrence only: null catalog identity is not ordinary Add fallback.
function validHistoricalConfig(fields: RoutineReadGraph['days'][number]['exercises'][number]['fields']): TrackingConfig | undefined {
  const config = { trackingType: fields.trackingType, weightUnit: fields.weightUnit };
  try { validateTrackingConfig(config as TrackingConfig); return config as TrackingConfig; }
  catch { return undefined; } // Invalid pairs are never remembered as allowances.
}
export function recoveryProgrammingOptions(graph: RoutineReadGraph, occurrenceId: string, mode: TrackingType | null) {
  const item = graph.days.flatMap(day => day.exercises).find(item => item.id === occurrenceId);
  if (!item) throw new Error('The recovery occurrence is unavailable.');
  const f = item.fields;
  if (f.exerciseId === null) return { trackingTypes: [...PROGRAMMING_TRACKING_TYPES], units: !mode ? [] : isWeightedMode(mode) ? ['kg', 'lbs', 'plates'] as const : ['unitless'] as const };
  const exercise = typeof f.exerciseId === 'string' ? getExerciseById(f.exerciseId) : undefined;
  return programmingOptions(exercise, mode, validHistoricalConfig(f));
}
export function correctRecoveryTracking(graph: RoutineReadGraph, id: string, config: TrackingConfig): RoutineReadGraph {
  validateTrackingConfig(config);
  const next = structuredClone(graph), item = next.days.flatMap(day => day.exercises).find(item => item.id === id);
  if (!item) throw new Error('The recovery occurrence is unavailable.');
  const options = recoveryProgrammingOptions(graph, id, config.trackingType);
  if (!options.trackingTypes.includes(config.trackingType) || !options.units.some(unit => unit === config.weightUnit)) throw new Error('Choose an explicitly supported recovery configuration.');
  if (item.fields.exerciseId !== null) validateCompatibleTracking(typeof item.fields.exerciseId === 'string' ? getExerciseById(item.fields.exerciseId) : undefined, config, validHistoricalConfig(item.fields));
  item.fields.trackingType = config.trackingType; item.fields.weightUnit = config.weightUnit;
  return next;
}

export interface RoutineCapabilityState {
  loadStatus: string; routine: RoutinePlan | null; readGraph: RoutineReadGraph | null;
  sourceSnapshot: VerifiedRoutineSnapshot | null; isSaving: boolean; hasUnsavedChanges: boolean;
  editorBuffers: Record<string, { error: string | null }>; pendingAdd: unknown;
}
export function routineCapabilities(state: RoutineCapabilityState) {
  let valid = false;
  try { if (state.readGraph) promoteRoutineForWrite(state.readGraph); else if (state.routine) assertValidRoutinePlan(state.routine); else throw new Error(); valid = true; } catch { /* Fail closed; never submit unresolved data. */ }
  const ready = state.loadStatus === 'ready', recovery = state.loadStatus === 'needs_attention';
  return { canViewRoutine: !!(state.routine || state.readGraph), canEditRecoveryFields: recovery && !!state.readGraph && !state.isSaving,
    canSave: (ready || recovery) && valid && state.hasUnsavedChanges && !state.isSaving && !state.pendingAdd && !Object.values(state.editorBuffers).some(buffer => buffer.error)
      && (!state.readGraph || Object.keys(state.editorBuffers).length === 0),
    canStartWorkout: ready && valid && !state.readGraph, canAddExercise: ready && valid && !state.readGraph && !state.isSaving,
    canApplyTemplate: ready && !!state.routine && !state.readGraph && !state.isSaving,
    canReset: ready && !!state.routine && !state.readGraph && !state.isSaving,
    canBackup: !!state.sourceSnapshot };
}
