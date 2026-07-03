import {
  isWorkoutCompletionResult,
  parseWorkoutCompletionRequest,
  type WorkoutCompletionRequest,
  type WorkoutCompletionResult,
  type WorkoutCompletionSet,
} from '@/lib/workout-authority';

export const WORKOUT_QUEUE_V2_KEY = 'unsynced_workouts_v2';
export const LEGACY_WORKOUT_QUEUE_KEY = 'unsynced_workouts';
export const WORKOUT_QUARANTINE_KEY = 'unsynced_workouts_quarantine_v2';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface OfflineWorkoutQueueV2 extends WorkoutCompletionRequest {
  schemaVersion: 2;
  queuedAt: string;
  attemptCount: number;
  lastAttemptAt?: string;
}

export type WorkoutSubmissionOutcome =
  | {
      kind: 'committed';
      status: 200 | 201;
      result: WorkoutCompletionResult;
    }
  | {
      kind: 'retryable';
      reason: 'network' | 'authentication' | 'server' | 'invalid-response';
      status?: number;
    }
  | {
      kind: 'terminal';
      reason: 'validation' | 'conflict';
      status: number;
    };

export interface WorkoutQueueSyncHooks {
  onCommitted?: (
    request: WorkoutCompletionRequest,
    result: WorkoutCompletionResult,
  ) => void | Promise<void>;
  onLegacyConverted?: (operationId: string) => void | Promise<void>;
  onQuarantined?: (reason: WorkoutQuarantineReason) => void | Promise<void>;
}

export interface WorkoutQueueSyncResult {
  synced: number;
  quarantined: number;
  remaining: number;
  stoppedForRetry: boolean;
}

export type WorkoutQuarantineReason =
  | 'malformed-legacy'
  | 'malformed-v2'
  | 'operation-conflict'
  | 'terminal-validation';

interface QuarantinedWorkout {
  schemaVersion: 2;
  operationId: string;
  quarantinedAt: string;
  reason: WorkoutQuarantineReason;
  entry: unknown;
}

interface LegacyWorkoutRecord extends Record<string, unknown> {
  operationId: string;
}

let replayPromise: Promise<WorkoutQueueSyncResult> | null = null;

function getStorage(): Storage {
  if (typeof window === 'undefined') {
    throw new Error('Workout queue storage is unavailable');
  }
  return window.localStorage;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readArray(key: string): unknown[] {
  const raw = getStorage().getItem(key);
  if (raw === null) return [];

  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error('Workout queue storage is invalid');
  }
  return parsed;
}

function writeArray(key: string, entries: unknown[]): void {
  const storage = getStorage();
  if (entries.length === 0) {
    storage.removeItem(key);
    return;
  }
  storage.setItem(key, JSON.stringify(entries));
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function canonicalRequest(request: WorkoutCompletionRequest): string {
  return JSON.stringify(request);
}

function requestFromQueueEntry(entry: unknown): WorkoutCompletionRequest {
  if (!isRecord(entry) || entry.schemaVersion !== 2) {
    throw new Error('Workout queue entry is invalid');
  }

  return parseWorkoutCompletionRequest({
    operationId: entry.operationId,
    startTime: entry.startTime,
    endTime: entry.endTime,
    routineName: entry.routineName,
    sets: entry.sets,
  });
}

function readQueueV2(): unknown[] {
  return readArray(WORKOUT_QUEUE_V2_KEY);
}

function removeQueueItem(operationId: string): void {
  const queue = readQueueV2();
  writeArray(
    WORKOUT_QUEUE_V2_KEY,
    queue.filter(
      (entry) => !isRecord(entry) || entry.operationId !== operationId,
    ),
  );
}

function updateQueueAttempt(operationId: string): void {
  const attemptedAt = new Date().toISOString();
  const queue = readQueueV2().map((entry) => {
    if (!isRecord(entry) || entry.operationId !== operationId) return entry;
    const attemptCount =
      typeof entry.attemptCount === 'number'
      && Number.isInteger(entry.attemptCount)
      && entry.attemptCount >= 0
        ? entry.attemptCount
        : 0;
    return {
      ...entry,
      attemptCount: attemptCount + 1,
      lastAttemptAt: attemptedAt,
    };
  });
  writeArray(WORKOUT_QUEUE_V2_KEY, queue);
}

function ensureEntryOperationId(
  key: string,
  entry: unknown,
  index: number,
): LegacyWorkoutRecord {
  if (isRecord(entry) && isUuid(entry.operationId)) {
    const operationId = entry.operationId.toLowerCase();
    const normalizedEntry = { ...entry, operationId };
    if (entry.operationId !== operationId) {
      const entries = readArray(key);
      entries[index] = normalizedEntry;
      writeArray(key, entries);
    }
    return normalizedEntry;
  }

  const operationId = createWorkoutOperationId();
  const normalizedEntry: LegacyWorkoutRecord = isRecord(entry)
    ? { ...entry, operationId }
    : { operationId, invalidEntry: entry };
  const entries = readArray(key);
  entries[index] = normalizedEntry;
  writeArray(key, entries);
  return normalizedEntry;
}

function quarantineWorkout(
  operationId: string,
  entry: unknown,
  reason: WorkoutQuarantineReason,
): void {
  const quarantine = readArray(WORKOUT_QUARANTINE_KEY);
  const alreadyQuarantined = quarantine.some(
    (item) => isRecord(item) && item.operationId === operationId,
  );
  if (alreadyQuarantined) return;

  const quarantined: QuarantinedWorkout = {
    schemaVersion: 2,
    operationId,
    quarantinedAt: new Date().toISOString(),
    reason,
    entry,
  };
  writeArray(WORKOUT_QUARANTINE_KEY, [...quarantine, quarantined]);
}

function normalizeLegacySet(value: unknown): WorkoutCompletionSet {
  if (!isRecord(value)) {
    throw new Error('Legacy workout set is invalid');
  }

  return {
    exerciseName: value.exerciseName,
    setNumber: value.setNumber,
    weight: value.weight,
    reps: value.reps,
    weightUnit: value.weightUnit ?? 'kg',
    trackingType: value.trackingType ?? 'reps_weight',
    isWarmup: value.isWarmup ?? false,
  } as WorkoutCompletionSet;
}

function legacyEntryToRequest(
  entry: LegacyWorkoutRecord,
): WorkoutCompletionRequest {
  if (!Array.isArray(entry.completedSets)) {
    throw new Error('Legacy workout is missing completed sets');
  }

  return parseWorkoutCompletionRequest({
    operationId: entry.operationId,
    startTime: entry.startTime,
    endTime: entry.endTime,
    routineName: entry.routineName ?? 'Workout',
    sets: entry.completedSets.map(normalizeLegacySet),
  });
}

async function convertLegacyQueue(
  hooks: WorkoutQueueSyncHooks,
): Promise<number> {
  let quarantined = 0;

  while (true) {
    const legacyEntries = readArray(LEGACY_WORKOUT_QUEUE_KEY);
    if (legacyEntries.length === 0) break;

    const legacyEntry = ensureEntryOperationId(
      LEGACY_WORKOUT_QUEUE_KEY,
      legacyEntries[0],
      0,
    );

    try {
      const request = legacyEntryToRequest(legacyEntry);
      enqueueWorkoutCompletion(request);
      await hooks.onLegacyConverted?.(request.operationId);
    } catch {
      quarantineWorkout(
        legacyEntry.operationId,
        legacyEntry,
        'malformed-legacy',
      );
      quarantined += 1;
      await hooks.onQuarantined?.('malformed-legacy');
    }

    const latestLegacyEntries = readArray(LEGACY_WORKOUT_QUEUE_KEY);
    writeArray(
      LEGACY_WORKOUT_QUEUE_KEY,
      latestLegacyEntries.filter(
        (entry) => !isRecord(entry)
          || entry.operationId !== legacyEntry.operationId,
      ),
    );
  }

  return quarantined;
}

async function sendWorkoutCompletionPush(
  request: WorkoutCompletionRequest,
  result: WorkoutCompletionResult,
): Promise<void> {
  if (result.replayed) return;

  try {
    await fetch('/api/push/workout-complete', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'manual',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        routineName: request.routineName,
        xpEarned: result.xpAwarded,
      }),
    });
  } catch {
    console.error('Workout completion push failed');
  }
}

function isAuthenticationRedirect(response: Response): boolean {
  if (response.type === 'opaqueredirect' || response.status === 0) return true;
  if (!response.redirected) return false;

  try {
    return new URL(response.url).pathname.startsWith('/login');
  } catch {
    return false;
  }
}

async function parseResponseBody(response: Response): Promise<unknown> {
  try {
    return await response.json() as unknown;
  } catch {
    return null;
  }
}

function hasRetryableFlag(value: unknown): boolean {
  return isRecord(value) && value.retryable === true;
}

export function createWorkoutOperationId(): string {
  if (typeof crypto === 'undefined' || !crypto.getRandomValues) {
    throw new Error('Secure UUID generation is unavailable');
  }
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().toLowerCase();
  }

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'));
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-');
}

export function createWorkoutCompletionRequest(
  value: unknown,
): WorkoutCompletionRequest {
  return parseWorkoutCompletionRequest(value);
}

export function enqueueWorkoutCompletion(
  requestValue: WorkoutCompletionRequest,
): OfflineWorkoutQueueV2 {
  const request = parseWorkoutCompletionRequest(requestValue);
  const queue = readQueueV2();
  const existing = queue.find(
    (entry) => isRecord(entry) && entry.operationId === request.operationId,
  );

  if (existing) {
    const existingRequest = requestFromQueueEntry(existing);
    if (canonicalRequest(existingRequest) !== canonicalRequest(request)) {
      throw new Error('Workout operation conflicts with queued payload');
    }
    return existing as unknown as OfflineWorkoutQueueV2;
  }

  const entry: OfflineWorkoutQueueV2 = {
    schemaVersion: 2,
    ...request,
    queuedAt: new Date().toISOString(),
    attemptCount: 0,
  };
  writeArray(WORKOUT_QUEUE_V2_KEY, [...queue, entry]);
  return entry;
}

export async function submitWorkoutCompletion(
  requestValue: WorkoutCompletionRequest,
): Promise<WorkoutSubmissionOutcome> {
  const request = parseWorkoutCompletionRequest(requestValue);

  try {
    const response = await fetch('/api/workouts/complete', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'manual',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (isAuthenticationRedirect(response)) {
      return { kind: 'retryable', reason: 'authentication', status: response.status };
    }

    const body = await parseResponseBody(response);
    if (response.status === 200 || response.status === 201) {
      if (
        !isWorkoutCompletionResult(body)
        || body.operationId !== request.operationId
        || body.replayed !== (response.status === 200)
      ) {
        return {
          kind: 'retryable',
          reason: 'invalid-response',
          status: response.status,
        };
      }

      await sendWorkoutCompletionPush(request, body);
      return {
        kind: 'committed',
        status: response.status,
        result: body,
      };
    }

    if (response.status === 401 || response.status === 403) {
      return { kind: 'retryable', reason: 'authentication', status: response.status };
    }
    if (response.status >= 500 || hasRetryableFlag(body)) {
      return { kind: 'retryable', reason: 'server', status: response.status };
    }
    if (response.status === 409) {
      return { kind: 'terminal', reason: 'conflict', status: response.status };
    }
    if ([400, 413, 422].includes(response.status)) {
      return { kind: 'terminal', reason: 'validation', status: response.status };
    }
    return {
      kind: 'retryable',
      reason: response.status >= 300 && response.status < 400
        ? 'authentication'
        : 'invalid-response',
      status: response.status,
    };
  } catch {
    return { kind: 'retryable', reason: 'network' };
  }
}

async function runQueueSync(
  hooks: WorkoutQueueSyncHooks,
): Promise<WorkoutQueueSyncResult> {
  let synced = 0;
  let quarantined = await convertLegacyQueue(hooks);
  let stoppedForRetry = false;

  while (true) {
    const queue = readQueueV2();
    if (queue.length === 0) break;

    const firstEntry = ensureEntryOperationId(WORKOUT_QUEUE_V2_KEY, queue[0], 0);
    let request: WorkoutCompletionRequest;
    try {
      request = requestFromQueueEntry(firstEntry);
    } catch {
      quarantineWorkout(firstEntry.operationId, firstEntry, 'malformed-v2');
      removeQueueItem(firstEntry.operationId);
      quarantined += 1;
      await hooks.onQuarantined?.('malformed-v2');
      continue;
    }

    updateQueueAttempt(request.operationId);
    const outcome = await submitWorkoutCompletion(request);

    if (outcome.kind === 'committed') {
      await hooks.onCommitted?.(request, outcome.result);
      removeQueueItem(request.operationId);
      synced += 1;
      continue;
    }

    if (outcome.kind === 'retryable') {
      stoppedForRetry = true;
      break;
    }

    const reason = outcome.reason === 'conflict'
      ? 'operation-conflict'
      : 'terminal-validation';
    quarantineWorkout(request.operationId, firstEntry, reason);
    removeQueueItem(request.operationId);
    quarantined += 1;
    await hooks.onQuarantined?.(reason);
  }

  return {
    synced,
    quarantined,
    remaining: readQueueV2().length,
    stoppedForRetry,
  };
}

export function syncQueuedWorkoutCompletions(
  hooks: WorkoutQueueSyncHooks = {},
): Promise<WorkoutQueueSyncResult> {
  if (replayPromise) return replayPromise;

  replayPromise = runQueueSync(hooks).finally(() => {
    replayPromise = null;
  });
  return replayPromise;
}
