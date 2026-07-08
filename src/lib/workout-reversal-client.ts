import {
  isWorkoutReversalResult,
  parseWorkoutReversalRequest,
  parseWorkoutSessionId,
  type WorkoutReversalResult,
} from '@/lib/workout-reversal-authority';

export const WORKOUT_REVERSAL_OPERATION_STORAGE_KEY =
  'vortixia-workout-reversal-operations-v1';

type ReversalOperationStore = Record<string, string>;

export type WorkoutReversalOutcome =
  | {
      kind: 'reversed';
      result: WorkoutReversalResult;
    }
  | {
      kind: 'retryable';
      reason: 'network' | 'authentication' | 'server' | 'invalid-response';
      status?: number;
    }
  | {
      kind: 'terminal';
      reason: 'validation' | 'not-found' | 'conflict' | 'unsupported';
      status: number;
    };

const reversalFlights = new Map<string, Promise<WorkoutReversalOutcome>>();

function getStorage(): Storage {
  if (typeof window === 'undefined') {
    throw new Error('Workout reversal storage is unavailable');
  }
  return window.localStorage;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readOperationStore(): ReversalOperationStore {
  const raw = getStorage().getItem(WORKOUT_REVERSAL_OPERATION_STORAGE_KEY);
  if (raw === null) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return {};
  }

  if (!isRecord(parsed)) return {};

  const operations: ReversalOperationStore = {};
  Object.entries(parsed).forEach(([sessionIdValue, operationIdValue]) => {
    try {
      const sessionId = parseWorkoutSessionId(sessionIdValue);
      const { operationId } = parseWorkoutReversalRequest({
        operationId: operationIdValue,
      });
      operations[sessionId] = operationId;
    } catch {
      // Ignore malformed local reversal metadata without logging IDs.
    }
  });
  return operations;
}

function writeOperationStore(operations: ReversalOperationStore): void {
  getStorage().setItem(
    WORKOUT_REVERSAL_OPERATION_STORAGE_KEY,
    JSON.stringify(operations),
  );
}

function createWorkoutReversalOperationId(): string {
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

export function getOrCreateWorkoutReversalOperationId(
  sessionIdValue: string,
): string {
  const sessionId = parseWorkoutSessionId(sessionIdValue);
  const operations = readOperationStore();
  const existingOperationId = operations[sessionId];

  if (existingOperationId) {
    return existingOperationId;
  }

  const operationId = createWorkoutReversalOperationId();
  operations[sessionId] = operationId;
  writeOperationStore(operations);
  return operationId;
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

async function performWorkoutReversal(
  sessionId: string,
  operationId: string,
): Promise<WorkoutReversalOutcome> {
  try {
    const response = await fetch(`/api/workouts/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'manual',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operationId }),
    });

    if (isAuthenticationRedirect(response)) {
      return { kind: 'retryable', reason: 'authentication', status: response.status };
    }

    const body = await parseResponseBody(response);
    if (response.status === 200) {
      if (
        !isWorkoutReversalResult(body)
        || body.operationId !== operationId
        || body.sessionId !== sessionId
      ) {
        return {
          kind: 'retryable',
          reason: 'invalid-response',
          status: response.status,
        };
      }

      return {
        kind: 'reversed',
        result: body,
      };
    }

    if (response.status === 401 || response.status === 403) {
      return { kind: 'retryable', reason: 'authentication', status: response.status };
    }
    if (response.status >= 500 || hasRetryableFlag(body)) {
      return { kind: 'retryable', reason: 'server', status: response.status };
    }
    if (response.status === 404) {
      return { kind: 'terminal', reason: 'not-found', status: response.status };
    }
    if (response.status === 409) {
      return { kind: 'terminal', reason: 'conflict', status: response.status };
    }
    if (response.status === 422) {
      return { kind: 'terminal', reason: 'unsupported', status: response.status };
    }
    if (response.status === 400 || response.status === 413) {
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

export async function submitWorkoutReversal(
  sessionIdValue: string,
): Promise<WorkoutReversalOutcome> {
  let sessionId: string;
  let operationId: string;

  try {
    sessionId = parseWorkoutSessionId(sessionIdValue);
    operationId = getOrCreateWorkoutReversalOperationId(sessionId);
  } catch {
    return { kind: 'terminal', reason: 'validation', status: 400 };
  }

  const flightKey = `${sessionId}:${operationId}`;
  const existingFlight = reversalFlights.get(flightKey);
  if (existingFlight) return existingFlight;

  const flight = performWorkoutReversal(sessionId, operationId).finally(() => {
    reversalFlights.delete(flightKey);
  });
  reversalFlights.set(flightKey, flight);
  return flight;
}
