import { supabase } from "@/lib/supabase";
import {
  prepareRoutinePlanForSave,
  routinePlanFromRows,
  routinePlanToRpcPayload,
  type PlannedExerciseRow,
  type RoutineDayRow,
  type RoutineRow,
} from "@/lib/routine-model";
import type { RoutinePlan } from "@/types/routine";

export class RoutinePersistenceError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "RoutinePersistenceError";
  }
}

async function requireSessionUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new RoutinePersistenceError("Unable to verify the current session.", {
      cause: error,
    });
  }
  if (!data.session?.user.id) {
    throw new RoutinePersistenceError("Sign in to load or save a routine.");
  }
  return data.session.user.id;
}

export async function loadActiveRoutine(): Promise<RoutinePlan | null> {
  const userId = await requireSessionUserId();
  const { data: routine, error: routineError } = await supabase
    .from("routines")
    .select("id, name")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (routineError) {
    throw new RoutinePersistenceError("Unable to load the active routine.", {
      cause: routineError,
    });
  }
  if (!routine) return null;

  const { data: days, error: daysError } = await supabase
    .from("routine_days")
    .select("id, routine_id, day_name, type, title")
    .eq("routine_id", routine.id);
  if (daysError) {
    throw new RoutinePersistenceError("Unable to load routine days.", {
      cause: daysError,
    });
  }

  const dayIds = (days ?? []).map((day) => day.id);
  let exercises: PlannedExerciseRow[] = [];
  if (dayIds.length > 0) {
    const { data, error } = await supabase
      .from("planned_exercises")
      .select(
      "id, routine_day_id, exercise_id, name, type, tracking_style, weight_unit, target_sets, target_reps, rest_seconds, cardio_zone, note, is_warmup, order_index",
      )
      .in("routine_day_id", dayIds)
      .order("order_index");
    if (error) {
      throw new RoutinePersistenceError("Unable to load planned exercises.", {
        cause: error,
      });
    }
    exercises = (data ?? []) as PlannedExerciseRow[];
  }

  return routinePlanFromRows({
    routine: routine as RoutineRow,
    days: (days ?? []) as RoutineDayRow[],
    exercises,
  });
}

export async function saveActiveRoutine(routine: RoutinePlan): Promise<RoutinePlan> {
  await requireSessionUserId();
  const prepared = prepareRoutinePlanForSave(routine);
  const { error } = await supabase.rpc("save_active_routine_v1", {
    p_routine: routinePlanToRpcPayload(prepared),
  });
  if (error) {
    throw new RoutinePersistenceError("Unable to save the routine atomically.", {
      cause: error,
    });
  }
  return prepared;
}
