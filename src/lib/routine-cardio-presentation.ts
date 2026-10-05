import { getExerciseById } from './exercise-catalog';
import type { ResolvedExercise } from '@/types/exercise-catalog';
import type { PlannedExerciseOccurrence } from '@/types/routine';

type HeartRateZone = 1 | 2 | 3 | 4 | 5;

export function programmingRestLabel(cardio: boolean, targetSets: number): string {
  return !cardio ? 'Rest between sets' : targetSets > 1 ? 'Rest between rounds' : 'Rest';
}

// Imported records predate movementType. Their exact canonical bodyPart category
// is the fallback, never an occurrence snapshot, name or equipment heuristic.
export function isCatalogCardio(exercise: Pick<ResolvedExercise, 'movementType' | 'bodyPart'> | undefined): boolean {
  return !!exercise && (exercise.movementType === 'cardio'
    || (exercise.movementType === undefined && exercise.bodyPart === 'cardio'));
}

// Presentation only: ambiguous/multiple zones and unsupported numeric suffixes
// do not produce a badge. The original programming text remains untouched.
export function explicitHeartRateZone(...texts: (string | undefined)[]): HeartRateZone | null {
  const zones = new Set<HeartRateZone>();
  for (const text of texts) {
    for (const match of (text ?? '').matchAll(/\bzone\s+([1-5])\b(?!\s*(?:[.\-–/]\s*\d|to\s+\d))/gi)) {
      zones.add(Number(match[1]) as HeartRateZone);
    }
  }
  return zones.size === 1 ? [...zones][0] : null;
}

export function occurrenceProgrammingPresentation(occurrence: Pick<PlannedExerciseOccurrence,
  'exerciseId' | 'targetSets' | 'trackingType' | 'targetValue' | 'note' | 'cardioZone'>) {
  const cardio = isCatalogCardio(occurrence.exerciseId ? getExerciseById(occurrence.exerciseId) : undefined);
  const durationMode = occurrence.trackingType === 'time_only' || occurrence.trackingType === 'time_weight'
    || occurrence.trackingType === 'cardio_hr';
  return {
    cardio,
    continuous: cardio && occurrence.targetSets === 1 && durationMode,
    countLabel: cardio ? 'Rounds' : 'Sets',
    targetLabel: cardio ? 'Duration / prescription' : 'Target / prescription',
    zone: cardio ? occurrence.cardioZone : null,
  };
}
