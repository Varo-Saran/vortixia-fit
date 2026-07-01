import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import {
  isWorkoutCompletionResult,
  parseWorkoutCompletionRequest,
  WORKOUT_COMPLETION_MAX_BODY_BYTES,
  WorkoutRequestError,
} from '@/lib/workout-authority';

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

async function handlePost(request: Request) {
  const contentLength = Number(request.headers.get('content-length'));
  if (
    Number.isFinite(contentLength)
    && contentLength > WORKOUT_COMPLETION_MAX_BODY_BYTES
  ) {
    return errorResponse('Request body is too large', 413);
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
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > WORKOUT_COMPLETION_MAX_BODY_BYTES) {
      return errorResponse('Request body is too large', 413);
    }
    requestBody = JSON.parse(rawBody) as unknown;
  } catch {
    return errorResponse('Request body must be valid JSON', 400);
  }

  let workout;
  try {
    workout = parseWorkoutCompletionRequest(requestBody);
  } catch (error) {
    if (error instanceof WorkoutRequestError) {
      return errorResponse(error.message, 400);
    }
    return errorResponse('Invalid workout request', 400);
  }

  const { data, error } = await supabase.rpc('complete_workout_v1', {
    p_operation_id: workout.operationId,
    p_start_time: workout.startTime,
    p_end_time: workout.endTime,
    p_routine_name: workout.routineName,
    p_sets: workout.sets,
  });

  if (error) {
    if (error.message === 'WORKOUT_OPERATION_CONFLICT') {
      return errorResponse('Operation ID conflicts with another workout', 409);
    }

    if (error.code === '42501') {
      return errorResponse('Unauthorized', 401);
    }

    if (error.code === '22023') {
      return errorResponse('Workout could not be validated', 422);
    }

    if (error.code === '23505') {
      return errorResponse('Workout completion is already being processed', 409, true);
    }

    console.error('Workout completion RPC failed', {
      code: error.code ?? 'unknown',
    });
    return errorResponse('Unable to complete workout', 500, true);
  }

  if (!isWorkoutCompletionResult(data)) {
    console.error('Workout completion RPC returned an invalid result');
    return errorResponse('Unable to complete workout', 500, true);
  }

  return NextResponse.json(data, {
    status: data.replayed ? 200 : 201,
    headers: NO_STORE_HEADERS,
  });
}

export async function POST(request: Request) {
  try {
    return await handlePost(request);
  } catch {
    console.error('Workout completion route failed');
    return errorResponse('Unable to complete workout', 500, true);
  }
}
