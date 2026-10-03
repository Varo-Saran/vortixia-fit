import type {
  DayKind,
  DayPlan,
  ExerciseSection,
  LegacyDayPlan,
  LegacyPlannedExercise,
  NewPlannedExerciseOccurrence,
  PlannedExerciseOccurrence,
  RoutinePlan,
  TrackingType,
  Weekday,
  WeightUnit,
} from "@/types/routine";
import { normalizeLegacyCardioZone, PROGRAMMING_TRACKING_TYPES, PROGRAMMING_WEIGHT_UNITS, validateCardioZone, validateTrackingConfig } from './routine-programming';

export const WEEKDAYS: readonly Weekday[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

export const DAY_KINDS: readonly DayKind[] = ["training", "rest", "recovery"];
export const EXERCISE_SECTIONS: readonly ExerciseSection[] = ["warmup", "main"];
export const TRACKING_TYPES = PROGRAMMING_TRACKING_TYPES;
export const WEIGHT_UNITS = PROGRAMMING_WEIGHT_UNITS;

export const ROUTINE_NAME_MAX_LENGTH = 80;
export const DAY_TITLE_MAX_LENGTH = 60;
export const REST_SECONDS_MAX = 3_600;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface RoutineRow {
  id: string;
  name: string;
}

export interface RoutineDayRow {
  id: string;
  routine_id: string;
  day_name: string;
  type: string;
  title: string;
}

export interface PlannedExerciseRow {
  id: string;
  routine_day_id: string;
  exercise_id: string | null;
  name: string;
  type: string;
  tracking_style: string;
  weight_unit: string;
  target_sets: number;
  target_reps: string;
  rest_seconds: number | null;
  cardio_zone: number | null;
  note: string | null;
  is_warmup: boolean;
  order_index: number;
}

export interface RoutinePersistenceRows {
  routine: RoutineRow;
  days: RoutineDayRow[];
  exercises: PlannedExerciseRow[];
}

export interface RoutineRpcPayload {
  id: string;
  name: string;
  days: Array<{
    id: string;
    weekday: Weekday;
    title: string;
    kind: DayKind;
    exercises: Array<{
      id: string;
      exercise_id: string | null;
      name: string;
      target_muscle: string;
      section: ExerciseSection;
      order: number;
      target_sets: number;
      target_value: string;
      tracking_type: TrackingType;
      weight_unit: WeightUnit;
      rest_seconds: number | null;
      cardioZone: import('@/types/routine').CardioZone | null;
      note: string | null;
    }>;
  }>;
}

export function createRoutineUuid(): string {
  if (typeof crypto === "undefined" || typeof crypto.randomUUID !== "function") {
    throw new Error("Secure UUID generation is unavailable in this environment.");
  }
  return crypto.randomUUID();
}

export function weekdayLabel(weekday: Weekday): string {
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}`;
}

export function shortWeekday(weekday: Weekday): string {
  return weekdayLabel(weekday).charAt(0);
}

export function parseWeekday(value: string): Weekday | null {
  const normalized = value.trim().toLowerCase();
  return WEEKDAYS.includes(normalized as Weekday)
    ? (normalized as Weekday)
    : null;
}

export function normalizeRoutineName(name: string): string {
  const normalized = name.trim();
  if (!normalized) throw new Error("Routine name is required.");
  if (normalized.length > ROUTINE_NAME_MAX_LENGTH) {
    throw new Error(`Routine name must be ${ROUTINE_NAME_MAX_LENGTH} characters or fewer.`);
  }
  return normalized;
}

export function validateOptionalRestSeconds(value: number | null): void {
  if (value === null) return;
  if (!Number.isInteger(value) || value <= 0 || value > REST_SECONDS_MAX) {
    throw new Error(
      `Exercise rest must be null or an integer from 1 to ${REST_SECONDS_MAX} seconds.`,
    );
  }
}

export function effectiveRestSeconds(
  exerciseRestSeconds: number | null,
  defaultRestSeconds: number,
): number {
  validateOptionalRestSeconds(exerciseRestSeconds);
  if (!Number.isInteger(defaultRestSeconds) || defaultRestSeconds <= 0) {
    throw new Error("Default rest timer must be a positive integer.");
  }
  return exerciseRestSeconds ?? defaultRestSeconds;
}

export function mainOccurrences(day: DayPlan): PlannedExerciseOccurrence[] {
  return day.exercises
    .filter((exercise) => exercise.section === "main")
    .sort((left, right) => left.order - right.order);
}

export function isDayStartable(day: DayPlan): boolean {
  return day.kind === "training" && mainOccurrences(day).length > 0;
}

export function createOccurrence(
  input: NewPlannedExerciseOccurrence,
  order: number,
): PlannedExerciseOccurrence {
  return {
    ...input,
    id: createRoutineUuid(),
    order,
  };
}

export function reorderOccurrences(
  exercises: readonly PlannedExerciseOccurrence[],
  orderedIds: readonly string[],
): PlannedExerciseOccurrence[] {
  if (orderedIds.length !== exercises.length) {
    throw new Error("Reorder input must contain every occurrence exactly once.");
  }

  const exercisesById = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  if (exercisesById.size !== exercises.length || new Set(orderedIds).size !== orderedIds.length) {
    throw new Error("Occurrence IDs must be unique when reordering.");
  }

  return orderedIds.map((id, order) => {
    const exercise = exercisesById.get(id);
    if (!exercise) throw new Error(`Unknown occurrence ID: ${id}`);
    return { ...exercise, order };
  });
}

function legacyDayKind(day: LegacyDayPlan): DayKind {
  const normalizedType = day.type.trim().toLowerCase();
  if (normalizedType === "recovery") return "recovery";
  if (normalizedType !== "rest") return "training";
  return day.warmups.length + day.mainLifts.length > 0 ? "recovery" : "rest";
}

function legacyExerciseToOccurrence(
  exercise: LegacyPlannedExercise,
  section: ExerciseSection,
  order: number,
): PlannedExerciseOccurrence {
  return {
    id: createRoutineUuid(),
    exerciseId: exercise.exerciseId?.trim() || null,
    name: exercise.name,
    targetMuscle: exercise.targetMuscle,
    section,
    order,
    targetSets: exercise.targetSets,
    targetValue: exercise.targetValue,
    trackingType: exercise.trackingType,
    weightUnit: exercise.weightUnit,
    restSeconds: exercise.restSeconds ?? null,
    cardioZone: normalizeLegacyCardioZone(exercise),
    note: exercise.note,
  };
}

export function legacyPlanToRoutinePlan(
  name: string,
  legacyPlan: readonly LegacyDayPlan[],
  routineId: string = createRoutineUuid(),
): RoutinePlan {
  const legacyDaysByWeekday = new Map<Weekday, LegacyDayPlan>();
  for (const day of legacyPlan) {
    const weekday = parseWeekday(day.day);
    if (weekday) legacyDaysByWeekday.set(weekday, day);
  }

  const days = WEEKDAYS.map((weekday): DayPlan => {
    const legacyDay = legacyDaysByWeekday.get(weekday);
    if (!legacyDay) {
      return {
        id: createRoutineUuid(),
        weekday,
        title: "Rest",
        kind: "rest",
        exercises: [],
      };
    }

    const exercises = [
      ...legacyDay.warmups.map((exercise, index) =>
        legacyExerciseToOccurrence(exercise, "warmup", index),
      ),
      ...legacyDay.mainLifts.map((exercise, index) =>
        legacyExerciseToOccurrence(
          exercise,
          "main",
          legacyDay.warmups.length + index,
        ),
      ),
    ];

    return {
      id: createRoutineUuid(),
      weekday,
      title: legacyDay.title.trim() || weekdayLabel(weekday),
      kind: legacyDayKind(legacyDay),
      exercises,
    };
  });

  const routine = {
    id: routineId,
    name: normalizeRoutineName(name),
    days,
  };
  assertValidRoutinePlan(routine);
  return routine;
}

// Additive input normalization: no fresh identities and no storage version reset.
export function normalizeLegacyPlanProgramming(plan: readonly LegacyDayPlan[]): LegacyDayPlan[] {
  return plan.map(day => ({ ...day,
    warmups: day.warmups.map(exercise => ({ ...exercise, cardioZone: normalizeLegacyCardioZone(exercise) })),
    mainLifts: day.mainLifts.map(exercise => ({ ...exercise, cardioZone: normalizeLegacyCardioZone(exercise) })),
  }));
}

export function routinePlanToLegacyPlan(routine: RoutinePlan): LegacyDayPlan[] {
  return [...routine.days]
    .sort(
      (left, right) =>
        WEEKDAYS.indexOf(left.weekday) - WEEKDAYS.indexOf(right.weekday),
    )
    .map((day) => {
      const toLegacy = (
        exercise: PlannedExerciseOccurrence,
      ): LegacyPlannedExercise => ({
        id: exercise.id,
        exerciseId: exercise.exerciseId ?? undefined,
        name: exercise.name,
        targetMuscle: exercise.targetMuscle,
        trackingType: exercise.trackingType,
        weightUnit: exercise.weightUnit,
        targetSets: exercise.targetSets,
        targetValue: exercise.targetValue,
        restSeconds: exercise.restSeconds,
        cardioZone: exercise.cardioZone,
        note: exercise.note,
        isWarmup: exercise.section === "warmup",
      });

      const ordered = [...day.exercises].sort((left, right) => left.order - right.order);
      return {
        day: weekdayLabel(day.weekday),
        shortDay: shortWeekday(day.weekday),
        type:
          day.kind === "rest"
            ? "Rest"
            : day.kind === "recovery"
              ? "Recovery"
              : "Training",
        title: day.title,
        warmups: ordered.filter((exercise) => exercise.section === "warmup").map(toLegacy),
        mainLifts: ordered.filter((exercise) => exercise.section === "main").map(toLegacy),
      };
    });
}

export function validateRoutinePlan(routine: RoutinePlan): string[] {
  const errors: string[] = [];
  try {
    normalizeRoutineName(routine.name);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Invalid routine name.");
  }

  if (!UUID_PATTERN.test(routine.id)) errors.push("Routine ID must be a UUID.");
  if (routine.days.length !== WEEKDAYS.length) {
    errors.push("A routine must contain exactly seven weekday plans.");
  }

  const weekdays = new Set<Weekday>();
  const dayIds = new Set<string>();
  const occurrenceIds = new Set<string>();

  for (const day of routine.days) {
    if (!WEEKDAYS.includes(day.weekday)) errors.push(`Invalid weekday: ${day.weekday}`);
    if (weekdays.has(day.weekday)) errors.push(`Duplicate weekday: ${day.weekday}`);
    weekdays.add(day.weekday);
    if (!UUID_PATTERN.test(day.id)) errors.push(`${day.weekday}: day ID must be a UUID.`);
    if (dayIds.has(day.id)) errors.push(`Duplicate day ID: ${day.id}`);
    dayIds.add(day.id);
    if (!DAY_KINDS.includes(day.kind)) errors.push(`${day.weekday}: invalid day kind.`);
    const title = day.title.trim();
    if (!title || title.length > DAY_TITLE_MAX_LENGTH) {
      errors.push(`${day.weekday}: title must contain 1-${DAY_TITLE_MAX_LENGTH} characters.`);
    }
    if (day.kind === "rest" && day.exercises.length > 0) {
      errors.push(`${day.weekday}: rest days cannot contain planned exercises.`);
    }

    const orderedExercises = [...day.exercises].sort(
      (left, right) => left.order - right.order,
    );
    orderedExercises.forEach((exercise, expectedOrder) => {
      const prefix = `${day.weekday}/${exercise.name || exercise.id}`;
      if (!UUID_PATTERN.test(exercise.id)) errors.push(`${prefix}: occurrence ID must be a UUID.`);
      if (occurrenceIds.has(exercise.id)) errors.push(`Duplicate occurrence ID: ${exercise.id}`);
      occurrenceIds.add(exercise.id);
      if (exercise.exerciseId !== null && !exercise.exerciseId.trim()) {
        errors.push(`${prefix}: exerciseId cannot be empty.`);
      }
      if (!exercise.name.trim()) errors.push(`${prefix}: name is required.`);
      if (!exercise.targetMuscle.trim()) errors.push(`${prefix}: target muscle is required.`);
      if (!EXERCISE_SECTIONS.includes(exercise.section)) errors.push(`${prefix}: invalid section.`);
      if (exercise.order !== expectedOrder) {
        errors.push(`${prefix}: order must be contiguous from zero.`);
      }
      if (!Number.isInteger(exercise.targetSets) || exercise.targetSets <= 0 || exercise.targetSets > 100) {
        errors.push(`${prefix}: target sets must be an integer from 1 to 100.`);
      }
      if (!exercise.targetValue.trim() || exercise.targetValue.length > 80) {
        errors.push(`${prefix}: target value must contain 1-80 characters.`);
      }
      if (!TRACKING_TYPES.includes(exercise.trackingType)) errors.push(`${prefix}: invalid tracking type.`);
      if (!WEIGHT_UNITS.includes(exercise.weightUnit)) errors.push(`${prefix}: invalid weight unit.`);
      try { validateTrackingConfig(exercise); validateCardioZone(exercise.cardioZone); }
      catch (error) { errors.push(`${prefix}: ${error instanceof Error ? error.message : 'Invalid programming.'}`); }
      try {
        validateOptionalRestSeconds(exercise.restSeconds);
      } catch (error) {
        errors.push(`${prefix}: ${error instanceof Error ? error.message : "invalid rest timer."}`);
      }
      if (exercise.note !== undefined && exercise.note.length > 1_000) {
        errors.push(`${prefix}: note must be 1,000 characters or fewer.`);
      }
    });
  }

  for (const weekday of WEEKDAYS) {
    if (!weekdays.has(weekday)) errors.push(`Missing weekday: ${weekday}`);
  }
  return errors;
}

export function assertValidRoutinePlan(routine: RoutinePlan): void {
  const errors = validateRoutinePlan(routine);
  if (errors.length > 0) throw new Error(errors.join("\n"));
}

export function prepareRoutinePlanForSave(routine: RoutinePlan): RoutinePlan {
  const prepared: RoutinePlan = {
    ...routine,
    name: normalizeRoutineName(routine.name),
    days: [...routine.days]
      .sort(
        (left, right) =>
          WEEKDAYS.indexOf(left.weekday) - WEEKDAYS.indexOf(right.weekday),
      )
      .map((day) => ({
        ...day,
        title: day.title.trim(),
        exercises: [...day.exercises]
          .sort((left, right) => left.order - right.order)
          .map((exercise, order) => ({
            ...exercise,
            exerciseId: exercise.exerciseId?.trim() || null,
            name: exercise.name.trim(),
            targetMuscle: exercise.targetMuscle.trim(),
            targetValue: exercise.targetValue.trim(),
            note: exercise.note,
            order,
          })),
      })),
  };
  assertValidRoutinePlan(prepared);
  return prepared;
}

export function routinePlanToRpcPayload(routine: RoutinePlan): RoutineRpcPayload {
  const prepared = prepareRoutinePlanForSave(routine);
  return {
    id: prepared.id,
    name: prepared.name,
    days: prepared.days.map((day) => ({
      id: day.id,
      weekday: day.weekday,
      title: day.title,
      kind: day.kind,
      exercises: day.exercises.map((exercise) => ({
        id: exercise.id,
        exercise_id: exercise.exerciseId,
        name: exercise.name,
        target_muscle: exercise.targetMuscle,
        section: exercise.section,
        order: exercise.order,
        target_sets: exercise.targetSets,
        target_value: exercise.targetValue,
        tracking_type: exercise.trackingType,
        weight_unit: exercise.weightUnit,
        rest_seconds: exercise.restSeconds,
        cardioZone: exercise.cardioZone,
        note: exercise.note ?? null,
      })),
    })),
  };
}

export function routinePlanFromRows(rows: RoutinePersistenceRows): RoutinePlan {
  const exercisesByDay = new Map<string, PlannedExerciseRow[]>();
  for (const exercise of rows.exercises) {
    const existing = exercisesByDay.get(exercise.routine_day_id) ?? [];
    existing.push(exercise);
    exercisesByDay.set(exercise.routine_day_id, existing);
  }

  const days = rows.days.map((day): DayPlan => {
    const weekday = parseWeekday(day.day_name);
    if (!weekday) throw new Error(`Unsupported routine weekday: ${day.day_name}`);
    if (!DAY_KINDS.includes(day.type as DayKind)) {
      throw new Error(`Unsupported routine day kind: ${day.type}`);
    }
    const exercises = (exercisesByDay.get(day.id) ?? [])
      .sort((left, right) => left.order_index - right.order_index)
      .map((exercise): PlannedExerciseOccurrence => {
        if (!TRACKING_TYPES.includes(exercise.tracking_style as TrackingType)) {
          throw new Error(`Unsupported tracking type: ${exercise.tracking_style}`);
        }
        if (!WEIGHT_UNITS.includes(exercise.weight_unit as WeightUnit)) {
          throw new Error(`Unsupported weight unit: ${exercise.weight_unit}`);
        }
        return {
          id: exercise.id,
          exerciseId: exercise.exercise_id,
          name: exercise.name,
          targetMuscle: exercise.type,
          section: exercise.is_warmup ? "warmup" : "main",
          order: exercise.order_index,
          targetSets: exercise.target_sets,
          targetValue: exercise.target_reps,
          trackingType: exercise.tracking_style as TrackingType,
          weightUnit: exercise.weight_unit as WeightUnit,
          restSeconds: exercise.rest_seconds,
          cardioZone: exercise.cardio_zone as import('@/types/routine').CardioZone | null,
          note: exercise.note ?? undefined,
        };
      });
    return {
      id: day.id,
      weekday,
      title: day.title,
      kind: day.type as DayKind,
      exercises,
    };
  });

  return prepareRoutinePlanForSave({
    id: rows.routine.id,
    name: rows.routine.name,
    days,
  });
}
