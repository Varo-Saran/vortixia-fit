import type { ExerciseWeightUnit, ResolvedExercise } from '@/types/exercise-catalog';
import type { CardioZone, TrackingType, WeightUnit } from '@/types/routine';
import { isCatalogCardio } from './routine-cardio-presentation';

export const PROGRAMMING_TRACKING_TYPES: readonly TrackingType[] = ['reps_weight', 'time_weight', 'time_only', 'cardio_hr', 'reps_only'];
export const PROGRAMMING_WEIGHT_UNITS: readonly WeightUnit[] = ['kg', 'lbs', 'plates', 'unitless'];
export const CARDIO_ZONES = [1, 2, 3, 4, 5] as const;
export const LEGACY_CARDIO_IDS = ['9001', '9003', '3666', '2141'] as const;
export interface TrackingConfig { trackingType: TrackingType; weightUnit: WeightUnit }
export interface PendingTrackingConfig { trackingType: TrackingType | null; weightUnit: WeightUnit | null }
export interface ProgrammingOptions { trackingTypes: TrackingType[]; units: WeightUnit[] }
export const isWeightedMode = (mode: TrackingType | null) => mode === 'reps_weight' || mode === 'time_weight';
export const catalogUnitToRoutineUnit = (unit: ExerciseWeightUnit): WeightUnit => unit === 'lb' ? 'lbs' : unit;

export function validateCardioZone(value: unknown): asserts value is CardioZone | null {
  if (value !== null && !CARDIO_ZONES.some(zone => zone === value)) throw new Error('Choose None or Zone 1–5.');
}
export function validateTrackingConfig(config: PendingTrackingConfig): asserts config is TrackingConfig {
  if (!PROGRAMMING_TRACKING_TYPES.includes(config.trackingType as TrackingType)) throw new Error('Choose how you want to track this exercise.');
  if (!PROGRAMMING_WEIGHT_UNITS.includes(config.weightUnit as WeightUnit)
    || (isWeightedMode(config.trackingType) ? config.weightUnit === 'unitless' : config.weightUnit !== 'unitless')) {
    throw new Error(isWeightedMode(config.trackingType) ? 'Choose a compatible load unit.' : 'Non-weighted tracking requires unitless.');
  }
}

// A default is not a rich capability list: only the declared mode is known safe.
// Historical allowances belong to ONE occurrence, never the exercise catalog.
export function programmingOptions(exercise: ResolvedExercise | undefined, mode: TrackingType | null,
  historical?: TrackingConfig): ProgrammingOptions {
  const knownModes = exercise?.defaultTrackingType ? [exercise.defaultTrackingType]
    : exercise?.source === 'imported' ? [...PROGRAMMING_TRACKING_TYPES] : [];
  const trackingTypes = [...new Set([...knownModes, ...(historical ? [historical.trackingType] : [])])];
  let units: WeightUnit[] = !mode ? [] : !isWeightedMode(mode) ? ['unitless']
    : exercise?.supportedWeightUnits ? exercise.supportedWeightUnits.map(catalogUnitToRoutineUnit).filter(unit => unit !== 'unitless')
    : exercise?.source === 'imported' ? ['kg', 'lbs', 'plates'] : [];
  if (mode && !knownModes.includes(mode)) units = [];
  if (historical?.trackingType === mode) units = [...new Set([...units, historical.weightUnit])];
  return { trackingTypes, units };
}
export function validateCompatibleTracking(exercise: ResolvedExercise | undefined, config: PendingTrackingConfig,
  historical?: TrackingConfig): asserts config is TrackingConfig {
  validateTrackingConfig(config);
  // Preserve the exact historical pair, not arbitrary cross-products of it.
  if (historical && config.trackingType === historical.trackingType && config.weightUnit === historical.weightUnit) return;
  const allowed = programmingOptions(exercise, config.trackingType);
  if (!allowed.trackingTypes.includes(config.trackingType) || !allowed.units.includes(config.weightUnit)) {
    throw new Error('Choose a supported tracking method and load unit.');
  }
}
export function changeTracking(config: PendingTrackingConfig, trackingType: TrackingType,
  exercise: ResolvedExercise | undefined, historical?: TrackingConfig): PendingTrackingConfig {
  return transitionTracking(config, trackingType, programmingOptions(exercise, trackingType, historical).units);
}
export function transitionTracking(config: PendingTrackingConfig, trackingType: TrackingType, units: readonly WeightUnit[]): PendingTrackingConfig {
  return { trackingType, weightUnit: !isWeightedMode(trackingType) ? 'unitless'
    : isWeightedMode(config.trackingType) && config.weightUnit && units.includes(config.weightUnit) ? config.weightUnit : null };
}
export function defaultProgramming(exercise: ResolvedExercise) {
  const trackingType = exercise.defaultTrackingType ?? null;
  const units = programmingOptions(exercise, trackingType).units;
  return { rawSets: isCatalogCardio(exercise) ? '1' : '3', rawTarget: '', trackingType,
    weightUnit: trackingType && !isWeightedMode(trackingType) ? 'unitless' as const : units.length === 1 ? units[0] : null,
    cardioZone: null, restSeconds: null, rawRest: 'default' };
}
export function encodeTrackingConfig(config: PendingTrackingConfig): string { return JSON.stringify(config); }
export function decodeTrackingConfig(raw: string): PendingTrackingConfig {
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).some(key => key !== 'trackingType' && key !== 'weightUnit')) throw new Error('Choose a valid tracking configuration.');
  return value as PendingTrackingConfig;
}

// Mirrors routine_legacy_cardio_zone_v1. Separate fields prevent synthetic tokens.
export function legacyCardioZone(exerciseId: string | null | undefined, ...texts: (string | undefined)[]): CardioZone | null {
  if (!LEGACY_CARDIO_IDS.some(id => id === exerciseId)) return null;
  let zone: CardioZone | null = null;
  for (const text of texts) for (const match of (text ?? '').matchAll(/(?<![\p{L}\p{N}_])zone\s+([0-9]+)(?![\p{L}\p{N}_])(\s*(?:[.\-–/]\s*[0-9]+|to\s+[0-9]+))?/giu)) {
    if (!['1', '2', '3', '4', '5'].includes(match[1]) || match[2]) return null;
    const value = Number(match[1]) as CardioZone;
    if (zone !== null && zone !== value) return null;
    zone = value;
  }
  return zone;
}
export function normalizeLegacyCardioZone(input: { exerciseId?: string | null; targetValue?: string; note?: string; cardioZone?: unknown }): CardioZone | null {
  if (Object.hasOwn(input, 'cardioZone')) { validateCardioZone(input.cardioZone); return input.cardioZone; }
  return legacyCardioZone(input.exerciseId, input.targetValue, input.note);
}
