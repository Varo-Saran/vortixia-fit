export const WORKOUT_REVERSAL_MAX_BODY_BYTES = 8 * 1024;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;

const FORBIDDEN_TOP_LEVEL_FIELDS = new Set([
  'userId',
  'user_id',
  'xp',
  'xpAmount',
  'xpReversed',
  'volume',
  'totalVolume',
  'setsCount',
  'duelDelta',
  'user_1_score',
  'user_2_score',
]);

const ALLOWED_TOP_LEVEL_FIELDS = new Set([
  'operationId',
]);

export interface WorkoutReversalRequest {
  operationId: string;
}

export interface WorkoutReversalResult {
  success: true;
  operationId: string;
  sessionId: string;
  deleted: true;
  xpReversed: number;
  totalXp: number;
  replayed: boolean;
}

export class WorkoutReversalRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkoutReversalRequestError';
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
      throw new WorkoutReversalRequestError('Request contains an unsupported field');
    }
  }
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

export function parseWorkoutSessionId(value: unknown): string {
  if (!isUuid(value)) {
    throw new WorkoutReversalRequestError('A valid workout session ID is required');
  }

  return value.toLowerCase();
}

export function parseWorkoutReversalRequest(
  value: unknown,
): WorkoutReversalRequest {
  if (!isRecord(value)) {
    throw new WorkoutReversalRequestError('Request body must be an object');
  }

  for (const field of FORBIDDEN_TOP_LEVEL_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(value, field)) {
      throw new WorkoutReversalRequestError('Request contains a prohibited field');
    }
  }

  assertAllowedFields(value, ALLOWED_TOP_LEVEL_FIELDS);

  if (!isUuid(value.operationId)) {
    throw new WorkoutReversalRequestError('A valid operation ID is required');
  }

  return {
    operationId: value.operationId.toLowerCase(),
  };
}

export function isWorkoutReversalResult(
  value: unknown,
): value is WorkoutReversalResult {
  if (!isRecord(value)) {
    return false;
  }

  return value.success === true
    && typeof value.operationId === 'string'
    && UUID_PATTERN.test(value.operationId)
    && typeof value.sessionId === 'string'
    && UUID_PATTERN.test(value.sessionId)
    && value.deleted === true
    && typeof value.xpReversed === 'number'
    && Number.isInteger(value.xpReversed)
    && value.xpReversed >= 0
    && typeof value.totalXp === 'number'
    && Number.isInteger(value.totalXp)
    && value.totalXp >= 0
    && typeof value.replayed === 'boolean';
}
