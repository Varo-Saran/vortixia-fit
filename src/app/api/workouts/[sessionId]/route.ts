import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import {
  isWorkoutReversalResult,
  parseWorkoutReversalRequest,
  parseWorkoutSessionId,
  WORKOUT_REVERSAL_MAX_BODY_BYTES,
  WorkoutReversalRequestError,
} from '@/lib/workout-reversal-authority';

export const runtime = 'nodejs';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store',
};

function errorResponse(error: string, status: number, retryable = false) {
  return NextResponse.json(
    { error, ...(retryable ? { retryable: true } : {}) },
    { status, headers: NO_STORE_HEADERS },
  );
}

async function readJsonBody(request: Request): Promise<unknown> {
  const contentLength = Number(request.headers.get('content-length'));
  if (
    Number.isFinite(contentLength)
    && contentLength > WORKOUT_REVERSAL_MAX_BODY_BYTES
  ) {
    throw new WorkoutReversalRequestError('Request body is too large');
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > WORKOUT_REVERSAL_MAX_BODY_BYTES) {
    throw new WorkoutReversalRequestError('Request body is too large');
  }

  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    throw new WorkoutReversalRequestError('Request body must be valid JSON');
  }
}

async function handleDelete(
  request: Request,
  params: Promise<{ sessionId: string }>,
) {
  const { sessionId: sessionIdValue } = await params;

  let sessionId: string;
  try {
    sessionId = parseWorkoutSessionId(sessionIdValue);
  } catch (error) {
    if (error instanceof WorkoutReversalRequestError) {
      return errorResponse(error.message, 400);
    }
    return errorResponse('Invalid workout reversal request', 400);
  }

  const supabase = await createSupabaseServer();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return errorResponse('Unauthorized', 401);
  }

  let requestBody: unknown;
  try {
    requestBody = await readJsonBody(request);
  } catch (error) {
    if (error instanceof WorkoutReversalRequestError) {
      return errorResponse(error.message, 400);
    }
    return errorResponse('Invalid workout reversal request', 400);
  }

  let reversal;
  try {
    reversal = parseWorkoutReversalRequest(requestBody);
  } catch (error) {
    if (error instanceof WorkoutReversalRequestError) {
      return errorResponse(error.message, 400);
    }
    return errorResponse('Invalid workout reversal request', 400);
  }

  const { data, error } = await supabase.rpc('reverse_workout_v1', {
    p_operation_id: reversal.operationId,
    p_workout_session_id: sessionId,
  });

  if (error) {
    if (error.message === 'WORKOUT_NOT_FOUND' || error.code === 'P0002') {
      return errorResponse('Workout session was not found', 404);
    }

    if (
      error.message === 'WORKOUT_REVERSAL_OPERATION_CONFLICT'
      || error.message === 'WORKOUT_ALREADY_REVERSED'
      || error.message === 'WORKOUT_REVERSAL_STATE_CONFLICT'
    ) {
      return errorResponse('Workout reversal conflicts with current state', 409);
    }

    if (
      error.message === 'WORKOUT_REVERSAL_UNSUPPORTED'
      || error.message === 'WORKOUT_REVERSAL_XP_INVALID'
    ) {
      return errorResponse('Workout reversal is unsupported', 422);
    }

    if (error.code === '42501') {
      return errorResponse('Unauthorized', 401);
    }

    if (error.code === '22023') {
      return errorResponse('Workout reversal could not be validated', 422);
    }

    console.error('Workout reversal RPC failed', {
      code: error.code ?? 'unknown',
    });
    return errorResponse('Unable to delete workout session', 500, true);
  }

  if (
    !isWorkoutReversalResult(data)
    || data.operationId !== reversal.operationId
    || data.sessionId !== sessionId
  ) {
    console.error('Workout reversal RPC returned an invalid result');
    return errorResponse('Unable to delete workout session', 500, true);
  }

  return NextResponse.json(data, {
    status: 200,
    headers: NO_STORE_HEADERS,
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    return await handleDelete(request, params);
  } catch {
    console.error('Workout reversal route failed');
    return errorResponse('Unable to delete workout session', 500, true);
  }
}
