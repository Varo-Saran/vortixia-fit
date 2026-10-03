import { BUILT_IN_ROUTINE_TEMPLATES } from "@/data/built-in-routine-templates";
import { getExerciseById, getPreferredExerciseId } from "@/lib/exercise-catalog";
import {
  assertValidRoutinePlan, createRoutineUuid, DAY_KINDS, EXERCISE_SECTIONS,
  TRACKING_TYPES, validateOptionalRestSeconds, WEEKDAYS,
} from "@/lib/routine-model";
import { isTemplateProgrammingCompatible } from "@/lib/template-exercise-compatibility";
import { catalogUnitToRoutineUnit, validateCardioZone } from './routine-programming';
import type { ExerciseWeightUnit } from "@/types/exercise-catalog";
import type { DayKind, PlannedExerciseOccurrence, RoutinePlan } from "@/types/routine";
import type { BuiltInRoutineTemplate, TemplateExerciseRef } from "@/types/routine-template";

function requireObject(value: unknown, keys: readonly string[], label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  for (const key of Object.keys(value)) {
    if (!keys.includes(key)) throw new Error(`${label}: unsupported field ${key}.`);
  }
}

function requireText(value: unknown, maximum: number, label: string): asserts value is string {
  if (typeof value !== "string" || !value.trim() || value.length > maximum) throw new Error(`${label} is invalid.`);
}

export function templateReferenceIds(reference: TemplateExerciseRef): readonly string[] {
  return reference.kind === "single"
    ? [reference.exerciseId]
    : [reference.defaultExerciseId, ...reference.alternativeExerciseIds];
}

function resolveExercise(id: string) {
  const exercise = getExerciseById(id);
  if (!exercise) throw new Error(`Template exercise ID is missing: ${id}.`);
  if (exercise.approval === "red" || exercise.discoveryTier === "hidden" || exercise.deprecatedForDiscovery) {
    throw new Error(`Template exercise is prohibited: ${id}.`);
  }
  if (getPreferredExerciseId(id) !== id) throw new Error(`Template must reference the preferred exercise ID: ${id}.`);
  return exercise;
}

export { catalogUnitToRoutineUnit } from './routine-programming';

export function validateRoutineTemplates(templates: unknown): asserts templates is readonly BuiltInRoutineTemplate[] {
  if (!Array.isArray(templates) || templates.length === 0) throw new Error("Templates must be a nonempty array.");
  const ids = new Set<string>();
  for (const template of templates) {
    requireObject(template, ["id", "name", "description", "days"], "Template");
    requireText(template.id, 80, "Template ID");
    requireText(template.name, 80, "Template name");
    requireText(template.description, 1000, "Template description");
    if (ids.has(template.id)) throw new Error("Duplicate template ID.");
    ids.add(template.id);
    if (!Array.isArray(template.days) || template.days.length !== 7) throw new Error("A template requires exactly seven weekdays.");
    const weekdays = new Set<string>();
    for (const day of template.days) {
      requireObject(day, ["weekday", "title", "kind", "occurrences"], "Template day");
      requireText(day.title, 60, "Day title");
      if (!WEEKDAYS.includes(day.weekday as typeof WEEKDAYS[number]) || weekdays.has(day.weekday as string)) throw new Error("Invalid or duplicate weekday.");
      weekdays.add(day.weekday as string);
      if (!DAY_KINDS.includes(day.kind as typeof DAY_KINDS[number])) throw new Error("Invalid day kind.");
      if (!Array.isArray(day.occurrences)) throw new Error("Day occurrences must be an array.");
      if (day.kind === "rest" && day.occurrences.length) throw new Error("Rest days must be empty.");
      let hasMain = false;
      for (const [order, occurrence] of day.occurrences.entries()) {
        requireObject(occurrence, ["exercise", "section", "order", "targetSets", "targetValue", "trackingType", "weightUnit", "restSeconds", "cardioZone", "note"], "Template occurrence");
        validateCardioZone(occurrence.cardioZone);
        if (occurrence.order !== order) throw new Error("Occurrence order must be contiguous and zero-based across the day.");
        if (!EXERCISE_SECTIONS.includes(occurrence.section as typeof EXERCISE_SECTIONS[number])) throw new Error("Invalid section.");
        if (occurrence.section === "warmup" && hasMain) throw new Error("Warmups must precede main occurrences.");
        hasMain ||= occurrence.section === "main";
        if (!Number.isInteger(occurrence.targetSets) || (occurrence.targetSets as number) < 1 || (occurrence.targetSets as number) > 100) throw new Error("Invalid target sets.");
        requireText(occurrence.targetValue, 80, "Target value");
        if (occurrence.note !== undefined && (typeof occurrence.note !== "string" || occurrence.note.length > 1000)) throw new Error("Invalid note.");
        validateOptionalRestSeconds((occurrence.restSeconds ?? null) as number | null);
        if (occurrence.trackingType !== undefined && !TRACKING_TYPES.includes(occurrence.trackingType as typeof TRACKING_TYPES[number])) throw new Error("Invalid tracking override.");
        if (occurrence.weightUnit !== undefined && !["kg", "lb", "plates", "unitless"].includes(occurrence.weightUnit as string)) throw new Error("Invalid catalog unit.");
        const reference = occurrence.exercise;
        requireObject(reference, ["kind", "exerciseId", "defaultExerciseId", "alternativeExerciseIds"], "Exercise reference");
        if (reference.kind === "single") {
          requireObject(reference, ["kind", "exerciseId"], "Single reference");
          requireText(reference.exerciseId, 120, "Exercise ID");
        } else if (reference.kind === "choice") {
          requireObject(reference, ["kind", "defaultExerciseId", "alternativeExerciseIds"], "Choice reference");
          requireText(reference.defaultExerciseId, 120, "Default exercise ID");
          if (!Array.isArray(reference.alternativeExerciseIds) || !reference.alternativeExerciseIds.length) throw new Error("Choice requires alternatives.");
          for (const id of reference.alternativeExerciseIds) requireText(id, 120, "Alternative exercise ID");
        } else throw new Error("Exercise reference must be single or choice, never a name or composite.");
        const typedReference = reference as unknown as TemplateExerciseRef;
        const references = templateReferenceIds(typedReference);
        if (new Set(references).size !== references.length) throw new Error("Duplicate choice exercise ID.");
        for (const id of references) {
          const exercise = resolveExercise(id);
          const tracking = occurrence.trackingType ?? exercise.defaultTrackingType;
          const unit = occurrence.weightUnit;
          // Catalog has no default unit. Do not arbitrarily pick the first supported unit.
          if (!tracking || !unit || !isTemplateProgrammingCompatible(exercise, tracking as typeof TRACKING_TYPES[number], unit as ExerciseWeightUnit, {
            templateId: template.id,
            weekday: day.weekday as typeof WEEKDAYS[number],
            occurrence: occurrence as unknown as BuiltInRoutineTemplate["days"][number]["occurrences"][number],
          })) throw new Error(`Unreviewed template tracking/unit pair for ${id}.`);
        }
      }
    }
  }
}

export function templateTrainingFrequency(template: { readonly days: readonly { readonly kind: DayKind }[] }): string {
  return `${template.days.filter((day) => day.kind === "training").length} DAYS/WEEK`;
}

export interface ResolvedTemplatePreview {
  id: string;
  name: string;
  description: string;
  days: Array<{
    weekday: BuiltInRoutineTemplate["days"][number]["weekday"];
    title: string;
    kind: BuiltInRoutineTemplate["days"][number]["kind"];
    exercises: Omit<PlannedExerciseOccurrence, "id">[];
  }>;
}

// Preview resolution has no random identities, store writes, or persistence.
export function resolveRoutineTemplate(template: BuiltInRoutineTemplate): ResolvedTemplatePreview {
  validateRoutineTemplates([template]);
  return {
    id: template.id, name: template.name, description: template.description,
    days: WEEKDAYS.map((weekday) => {
      const day = template.days.find((candidate) => candidate.weekday === weekday)!;
      return {
        weekday, title: day.title, kind: day.kind,
        exercises: day.occurrences.map((occurrence) => {
          const id = occurrence.exercise.kind === "single" ? occurrence.exercise.exerciseId : occurrence.exercise.defaultExerciseId;
          const exercise = resolveExercise(id);
          return {
            exerciseId: id, name: exercise.displayName, targetMuscle: exercise.primaryMuscle,
            section: occurrence.section, order: occurrence.order,
            targetSets: occurrence.targetSets, targetValue: occurrence.targetValue,
            trackingType: occurrence.trackingType ?? exercise.defaultTrackingType!,
            weightUnit: catalogUnitToRoutineUnit(occurrence.weightUnit!),
            restSeconds: occurrence.restSeconds ?? null,
            cardioZone: occurrence.cardioZone,
            ...(occurrence.note === undefined ? {} : { note: occurrence.note }),
          };
        }),
      };
    }),
  };
}

export function getBuiltInRoutineTemplate(id: string): BuiltInRoutineTemplate {
  const template = BUILT_IN_ROUTINE_TEMPLATES.find((candidate) => candidate.id === id);
  if (!template) throw new Error("The selected built-in routine template is unavailable.");
  return template;
}

// Callers supply a root only after D1 verifies the current saved-state load.
export function materializeRoutineTemplate(template: BuiltInRoutineTemplate, routineId = createRoutineUuid()): RoutinePlan {
  const resolved = resolveRoutineTemplate(template);
  const routine: RoutinePlan = {
    id: routineId, name: resolved.name,
    days: resolved.days.map((day) => ({
      ...day, id: createRoutineUuid(),
      exercises: day.exercises.map((exercise) => ({ ...exercise, id: createRoutineUuid() })),
    })),
  };
  assertValidRoutinePlan(routine);
  return routine;
}
