export const WORKOUT_COMPLETION_MAX_BODY_BYTES = 256 * 1024;

const MAX_SETS = 200;
const MAX_ROUTINE_NAME_LENGTH = 120;
const MAX_EXERCISE_NAME_LENGTH = 160;
const MAX_WEIGHT = 5000;
const MAX_REPS = 86400;
const MAX_SET_NUMBER = 1000;
const MAX_DURATION_MS = 24 * 60 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const FORBIDDEN_TOP_LEVEL_FIELDS = new Set([
  'user_id',
  'userId',
  'xpEarned',
  'xp_earned',
  'xpToAdd',
  'xp_to_add',
  'totalVolume',
  'total_volume_kg',
  'duelDelta',
  'duel_delta',
  'user_1_score',
  'user_2_score',
]);

const ALLOWED_TOP_LEVEL_FIELDS = new Set([
  'operationId',
  'startTime',
  'endTime',
  'routineName',
  'sets',
]);

const ALLOWED_SET_FIELDS = new Set([
  'exerciseName',
  'setNumber',
  'weight',
  'reps',
  'weightUnit',
  'trackingType',
  'isWarmup',
]);

const WEIGHT_UNITS = new Set<WeightUnit>([
  'kg',
  'lbs',
  'plates',
  'unitless',
]);

const TRACKING_TYPES = new Set<TrackingType>([
  'reps_weight',
  'time_weight',
  'time_only',
  'cardio_hr',
  'reps_only',
]);

export type WeightUnit = 'kg' | 'lbs' | 'plates' | 'unitless';

export type TrackingType =
  | 'reps_weight'
  | 'time_weight'
  | 'time_only'
  | 'cardio_hr'
  | 'reps_only';

export interface WorkoutCompletionSet {
  exerciseName: string;
  setNumber: number;
  weight: number;
  reps: number;
  weightUnit: WeightUnit;
  trackingType: TrackingType;
  isWarmup: boolean;
}

export interface WorkoutCompletionRequest {
  operationId: string;
  startTime: string;
  endTime: string;
  routineName: string;
  sets: WorkoutCompletionSet[];
}

export interface WorkoutCompletionResult {
  success: true;
  operationId: string;
  sessionId: string;
  replayed: boolean;
  totalSets: number;
  totalVolume: number;
  durationMinutes: number;
  xpAwarded: number;
  totalXp: number;
}

export class WorkoutRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkoutRequestError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertAllowedFields(
  value: Record<string, unknown>,
  allowedFields: ReadonlySet<string>,
): void {
  for (const field of Object.keys(value)) {
    if (!allowedFields.has(field)) {
      throw new WorkoutRequestError('Request contains an unsupported field');
    }
  }
}

function parseTimestamp(value: unknown): { iso: string; epochMs: number } {
  if (typeof value !== 'string' || value.length === 0) {
    throw new WorkoutRequestError('A valid workout timestamp is required');
  }

  const epochMs = Date.parse(value);
  if (!Number.isFinite(epochMs)) {
    throw new WorkoutRequestError('A valid workout timestamp is required');
  }

  return { iso: new Date(epochMs).toISOString(), epochMs };
}

function parseBoundedInteger(
  value: unknown,
  minimum: number,
  maximum: number,
): number {
  if (
    typeof value !== 'number'
    || !Number.isInteger(value)
    || value < minimum
    || value > maximum
  ) {
    throw new WorkoutRequestError('Workout set contains an invalid integer');
  }

  return value;
}

function parseBoundedNumber(
  value: unknown,
  minimum: number,
  maximum: number,
): number {
  if (
    typeof value !== 'number'
    || !Number.isFinite(value)
    || value < minimum
    || value > maximum
  ) {
    throw new WorkoutRequestError('Workout set contains an invalid number');
  }

  return value;
}

function parseWorkoutSet(value: unknown): WorkoutCompletionSet {
  if (!isRecord(value)) {
    throw new WorkoutRequestError('Each workout set must be an object');
  }

  assertAllowedFields(value, ALLOWED_SET_FIELDS);

  if (typeof value.exerciseName !== 'string') {
    throw new WorkoutRequestError('Workout set requires an exercise name');
  }

  const exerciseName = value.exerciseName.trim();
  if (
    exerciseName.length < 1
    || exerciseName.length > MAX_EXERCISE_NAME_LENGTH
  ) {
    throw new WorkoutRequestError('Workout set has an invalid exercise name');
  }

  const weightUnit = value.weightUnit ?? 'kg';
  if (typeof weightUnit !== 'string' || !WEIGHT_UNITS.has(weightUnit as WeightUnit)) {
    throw new WorkoutRequestError('Workout set has an invalid weight unit');
  }

  const trackingType = value.trackingType ?? 'reps_weight';
  if (
    typeof trackingType !== 'string'
    || !TRACKING_TYPES.has(trackingType as TrackingType)
  ) {
    throw new WorkoutRequestError('Workout set has an invalid tracking type');
  }

  const isWarmup = value.isWarmup ?? false;
  if (typeof isWarmup !== 'boolean') {
    throw new WorkoutRequestError('Workout set has an invalid warm-up flag');
  }

  return {
    exerciseName,
    setNumber: parseBoundedInteger(value.setNumber, 1, MAX_SET_NUMBER),
    weight: parseBoundedNumber(value.weight, 0, MAX_WEIGHT),
    reps: parseBoundedInteger(value.reps, 0, MAX_REPS),
    weightUnit: weightUnit as WeightUnit,
    trackingType: trackingType as TrackingType,
    isWarmup,
  };
}

export function parseWorkoutCompletionRequest(
  value: unknown,
): WorkoutCompletionRequest {
  if (!isRecord(value)) {
    throw new WorkoutRequestError('Request body must be an object');
  }

  for (const field of FORBIDDEN_TOP_LEVEL_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(value, field)) {
      throw new WorkoutRequestError('Request contains a prohibited field');
    }
  }

  assertAllowedFields(value, ALLOWED_TOP_LEVEL_FIELDS);

  if (
    typeof value.operationId !== 'string'
    || !UUID_PATTERN.test(value.operationId)
  ) {
    throw new WorkoutRequestError('A valid operation ID is required');
  }

  const startTime = parseTimestamp(value.startTime);
  const endTime = parseTimestamp(value.endTime);
  const durationMs = endTime.epochMs - startTime.epochMs;

  if (
    durationMs < 0
    || durationMs > MAX_DURATION_MS
    || endTime.epochMs > Date.now() + MAX_FUTURE_SKEW_MS
  ) {
    throw new WorkoutRequestError('Workout timestamps are outside allowed bounds');
  }

  const routineNameValue = value.routineName ?? 'Workout';
  if (typeof routineNameValue !== 'string') {
    throw new WorkoutRequestError('Workout routine name must be text');
  }

  const routineName = routineNameValue.trim() || 'Workout';
  if (routineName.length > MAX_ROUTINE_NAME_LENGTH) {
    throw new WorkoutRequestError('Workout routine name is too long');
  }

  if (
    !Array.isArray(value.sets)
    || value.sets.length < 1
    || value.sets.length > MAX_SETS
  ) {
    throw new WorkoutRequestError('Workout must contain a valid number of sets');
  }

  return {
    operationId: value.operationId.toLowerCase(),
    startTime: startTime.iso,
    endTime: endTime.iso,
    routineName,
    sets: value.sets.map(parseWorkoutSet),
  };
}

export function isWorkoutCompletionResult(
  value: unknown,
): value is WorkoutCompletionResult {
  if (!isRecord(value)) {
    return false;
  }

  return value.success === true
    && typeof value.operationId === 'string'
    && UUID_PATTERN.test(value.operationId)
    && typeof value.sessionId === 'string'
    && UUID_PATTERN.test(value.sessionId)
    && typeof value.replayed === 'boolean'
    && typeof value.totalSets === 'number'
    && Number.isInteger(value.totalSets)
    && typeof value.totalVolume === 'number'
    && Number.isFinite(value.totalVolume)
    && typeof value.durationMinutes === 'number'
    && Number.isInteger(value.durationMinutes)
    && typeof value.xpAwarded === 'number'
    && Number.isInteger(value.xpAwarded)
    && typeof value.totalXp === 'number'
    && Number.isInteger(value.totalXp);
}
