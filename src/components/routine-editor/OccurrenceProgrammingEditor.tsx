'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { TrackingType, WeightUnit } from '@/types/routine';
import { TRACKING_LABELS, UNIT_LABELS } from '@/lib/routine-editor-controls';
import { CARDIO_ZONES, isWeightedMode, transitionTracking, type PendingTrackingConfig, type ProgrammingOptions } from '@/lib/routine-programming';
import { programmingRestLabel } from '@/lib/routine-cardio-presentation';
import { Select } from '@/components/ui/Select';
import { editorInputClass } from './BufferedRoutineInput';
import { RestControl } from './OccurrenceRestControl';

export interface ProgrammingFieldControl {
  id: string; raw: string; error: string | null;
  change: (raw: string) => void; commit?: () => void;
}
export interface ProgrammingEditorProps {
  cardio: boolean; sets: ProgrammingFieldControl; target: ProgrammingFieldControl;
  zone: ProgrammingFieldControl; rest: ProgrammingFieldControl;
  tracking: { id: string; value: PendingTrackingConfig; error: string | null;
    change: (config: PendingTrackingConfig) => void; commit?: () => void };
  optionsFor: (mode: TrackingType | null) => ProgrammingOptions;
  defaultRest: number;
}

// Controlled by pendingAdd / D2B buffers. Local state is disclosure ONLY.
export function OccurrenceProgrammingEditor({ cardio, sets, target, zone, rest, tracking, optionsFor, defaultRest }: ProgrammingEditorProps) {
  const [roundsOpen, setRoundsOpen] = useState(false);
  const mode = tracking.value.trackingType;
  const continuous = cardio && Number(sets.raw) === 1 && ['time_only', 'time_weight', 'cardio_hr'].includes(mode ?? '');
  const zoneDescriptions = { 1: 'Recovery', 2: 'Aerobic Base', 3: 'Tempo', 4: 'Threshold', 5: 'VO₂ Max' };
  const zoneOptions: import('@/components/ui/Select').SelectOption[] = [
    { value: 'none', label: 'None — No zone target', triggerLabel: 'None' },
    ...CARDIO_ZONES.map(value => ({ value: String(value), label: `Zone ${value} — ${zoneDescriptions[value]}`, triggerLabel: `Zone ${value}` })),
  ];
  const input = (field: ProgrammingFieldControl, label: string, numeric = false) => <div className="min-w-0 space-y-1.5">
    <label htmlFor={field.id} className="block text-xs font-semibold text-white/60">{label}</label>
    <input id={field.id} className={editorInputClass} type={numeric ? 'number' : 'text'} inputMode={numeric ? 'numeric' : 'text'}
      min={numeric ? 1 : undefined} max={numeric ? 100 : undefined} step={numeric ? 1 : undefined}
      value={field.raw} onChange={event => field.change(event.target.value)} onBlur={field.commit}
      placeholder={numeric ? undefined : cardio ? 'e.g. 20–25 mins' : 'e.g. 10–12'}
      aria-invalid={!!field.error} aria-describedby={field.error ? `${field.id}-error` : undefined} />
    {field.error && <p id={`${field.id}-error`} className="text-xs text-red-300">{field.error}</p>}
  </div>;
  return <div className="space-y-4">
    <div className={continuous ? 'min-w-0' : 'grid min-w-0 grid-cols-[5.5rem_minmax(0,1fr)] sm:grid-cols-[6.5rem_minmax(0,1fr)] gap-3.5'}>
      {!continuous && input(sets, cardio ? 'Rounds' : 'Sets', true)}
      {input(target, cardio ? 'Duration / prescription' : 'Target / prescription')}
    </div>
    {continuous && <div className="text-sm text-text-muted">
      <button type="button" aria-expanded={roundsOpen || !!sets.error} aria-controls={`${sets.id}-rounds`} onClick={() => setRoundsOpen(!roundsOpen)}
        className="flex min-h-11 items-center gap-2 rounded-lg py-2.5 text-left text-xs font-medium text-white/60 hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-accent-green">
        <ChevronDown aria-hidden="true" className={`h-3.5 w-3.5 transition-transform ${roundsOpen || sets.error ? 'rotate-180' : ''}`} />Continuous cardio · Adjust rounds
      </button>
      <div id={`${sets.id}-rounds`} hidden={!roundsOpen && !sets.error} className="w-28 pb-2">{input(sets, 'Rounds', true)}</div>
    </div>}
    {cardio && <div className="space-y-1.5">
      <label htmlFor={zone.id} className="block text-xs font-semibold text-white/60">Intensity</label>
      <Select variant="routine-editor" id={zone.id} label="Intensity" value={zone.raw} invalid={!!zone.error} describedBy={zone.error ? `${zone.id}-error` : undefined}
        triggerClassName="min-h-11" options={zoneOptions}
        onValueChange={raw => { zone.change(raw); zone.commit?.(); }} />
      {zone.error && <p id={`${zone.id}-error`} className="text-xs text-red-300">{zone.error}</p>}
    </div>}
    <RestControl id={rest.id} raw={rest.raw} error={rest.error} onChange={rest.change} onCommit={rest.commit}
      defaultRest={defaultRest} label={programmingRestLabel(cardio, Number(sets.raw))} />
    <TrackingControls tracking={tracking} optionsFor={optionsFor} />
  </div>;
}

export function TrackingControls({ tracking, optionsFor, disabled = false }: Pick<ProgrammingEditorProps, 'tracking' | 'optionsFor'> & { disabled?: boolean }) {
  const mode = tracking.value.trackingType, weighted = isWeightedMode(mode), options = optionsFor(mode);
  const updateTracking = (value: PendingTrackingConfig) => { tracking.change(value); tracking.commit?.(); };
  const configError = tracking.error ? `${tracking.id}-error` : undefined;
  return <div>
    <div className={`grid gap-4 border-t border-white/[0.06] pt-4 ${weighted ? 'sm:grid-cols-2' : ''}`}>
      <div className="space-y-1.5"><label htmlFor={tracking.id} className="block text-xs font-semibold text-white/60">Tracking</label>
        <Select variant="routine-editor" disabled={disabled} id={tracking.id} label="Tracking" value={mode ?? ''} placeholder="Choose tracking" invalid={!!tracking.error} describedBy={configError} triggerClassName="min-h-11"
          options={options.trackingTypes.map(value => ({ value, label: TRACKING_LABELS[value] }))}
          onValueChange={value => updateTracking(transitionTracking(tracking.value, value as TrackingType, optionsFor(value as TrackingType).units))} />
      </div>
      {weighted && <div className="space-y-1.5"><label htmlFor={`${tracking.id}-unit`} className="block text-xs font-semibold text-white/60">Load unit</label>
        <Select variant="routine-editor" disabled={disabled} id={`${tracking.id}-unit`} label="Load unit" value={tracking.value.weightUnit ?? ''} placeholder="Choose unit" invalid={!!tracking.error} describedBy={configError}
          triggerClassName="min-h-11" options={options.units.map(value => ({ value, label: UNIT_LABELS[value] }))}
          onValueChange={value => updateTracking({ ...tracking.value, weightUnit: value as WeightUnit })} />
      </div>}
    </div>
    {tracking.error && <p id={`${tracking.id}-error`} role="alert" className="text-xs text-red-300">{tracking.error}</p>}
  </div>;
}
