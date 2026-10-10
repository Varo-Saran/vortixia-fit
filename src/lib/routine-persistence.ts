import { supabase } from "@/lib/supabase";
import {
  prepareRoutinePlanForSave,
  routinePlanToRpcPayload,
} from "@/lib/routine-model";
import type { RoutinePlan } from "@/types/routine";
import { routineLoadResultFromRows } from './routine-compatibility';
import type { RawRoutineRows, RoutineLoadResult } from '@/types/routine-compatibility';

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

export function observeRoutineSubject(listener: (subject: string | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => listener(session?.user.id ?? null));
  return () => data.subscription.unsubscribe();
}

const graphSelect = 'id,user_id,is_active,name,created_at,routine_days(id,routine_id,day_name,short_day,type,title,created_at,planned_exercises(id,routine_day_id,exercise_id,name,type,tracking_style,weight_unit,target_sets,target_reps,rest_seconds,cardio_zone,note,is_warmup,order_index,created_at))';
function unpackGraph(value: unknown): RawRoutineRows {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Incomplete root.');
  const { routine_days, ...routine } = value as Record<string, unknown>;
  if (!Array.isArray(routine_days)) throw new Error('Incomplete days.');
  const days: unknown[] = [], exercises: unknown[] = [];
  for (const input of routine_days) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Incomplete day.');
    const { planned_exercises, ...day } = input as Record<string, unknown>;
    if (!Array.isArray(planned_exercises)) throw new Error('Incomplete occurrences.');
    days.push(day); exercises.push(...planned_exercises);
  }
  return { routine, days, exercises };
}

export async function loadActiveRoutine(generation = 0): Promise<RoutineLoadResult> {
  let userId: string;
  try { userId = await requireSessionUserId(); } catch { return { status: 'fatal', source: null, error: { kind: 'auth', code: 'auth_required', message: 'Sign in to load a routine.' } }; }
  try {
    // Each embedded graph comes from one statement snapshot. Exact independent
    // counts detect PostgREST row caps. A matching second snapshot detects drift
    // across the count checks; never manufacture a backup from partial reads.
    const read = () => supabase.from('routines').select(graphSelect, { count: 'exact' })
      .eq('user_id', userId).eq('is_active', true)
      .order('day_name', { referencedTable: 'routine_days' })
      .order('order_index', { referencedTable: 'routine_days.planned_exercises' }).maybeSingle();
    const first = await read();
    if (first.error || first.count === null || first.count > 1) return { status: 'fatal', source: null, error: { kind: 'transport', code: first.count && first.count > 1 ? 'ambiguous_root' : 'incomplete_read', message: 'Unable to read one complete active routine.' } };
    if (!first.data) {
      if (first.count !== 0 || await requireSessionUserId() !== userId) throw new Error('Read context changed.');
      return { status: 'empty' };
    }
    if (first.count !== 1) throw new Error('Incomplete root count.');
    const rows = unpackGraph(first.data);
    const decoded = await routineLoadResultFromRows(rows, { subjectId: userId, generation, source: 'database' });
    if (decoded.status === 'fatal') return decoded;
    const root = rows.routine as Record<string, unknown>, days = rows.days as Record<string, unknown>[];
    const dayIds = days.map(day => day.id as string);
    const dayCount = await supabase.from('routine_days').select('id', { count: 'exact', head: true }).eq('routine_id', root.id as string);
    const occurrenceCount = dayIds.length ? await supabase.from('planned_exercises').select('id', { count: 'exact', head: true }).in('routine_day_id', dayIds) : { count: 0, error: null };
    if (dayCount.error || occurrenceCount.error || dayCount.count !== days.length || occurrenceCount.count !== (rows.exercises as unknown[]).length) throw new Error('Incomplete graph count.');
    const second = await read();
    if (second.error || second.count !== 1 || JSON.stringify(rows) !== JSON.stringify(unpackGraph(second.data))) throw new Error('Routine changed during read.');
    if (await requireSessionUserId() !== userId) return { status: 'fatal', source: null, error: { kind: 'auth', code: 'subject_changed', message: 'The signed-in account changed. Load again.' } };
    return decoded;
  } catch { return { status: 'fatal', source: null, error: { kind: 'transport', code: 'incomplete_read', message: 'The complete routine could not be read. Retry without changing data.' } }; }
}

export async function saveActiveRoutine(routine: RoutinePlan, expectedSubject?: string | null): Promise<RoutinePlan> {
  const userId = await requireSessionUserId();
  if (expectedSubject !== undefined && expectedSubject !== userId) {
    throw new RoutinePersistenceError('The signed-in account changed. Load again before saving.');
  }
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
