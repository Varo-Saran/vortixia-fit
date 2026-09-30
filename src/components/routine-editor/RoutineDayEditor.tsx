'use client';

import { ChevronDown, Plus } from 'lucide-react';
import type { DayKind, DayPlan } from '@/types/routine';
import { weekdayLabel } from '@/lib/routine-model';
import { useRoutineStore } from '@/store/useRoutineStore';
import { BufferedRoutineInput, editorInputClass } from './BufferedRoutineInput';
import { RoutineOccurrenceEditor } from './RoutineOccurrenceEditor';

export function RoutineDayEditor({ day, expanded, onToggle, onAdd, defaultRest, announce, focus }: {
  day: DayPlan; expanded: boolean; onToggle: () => void; onAdd: () => void; defaultRest: number;
  announce: (message: string) => void; focus: (id: string) => void;
}) {
  const isSaving = useRoutineStore(state => state.isSaving);
  const ordered = [...day.exercises].sort((a, b) => a.order - b.order);
  const kindId = `day-kind-${day.id}`, panelId = `day-panel-${day.id}`;
  const sections = day.kind === 'recovery' ? (ordered.some(item => item.section === 'warmup') ? ['warmup', 'main'] as const : ['main'] as const) : ['warmup', 'main'] as const;
  return <section className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]">
    <h2><button id={`day-heading-${day.id}`} type="button" onClick={onToggle} aria-expanded={expanded} aria-controls={panelId}
      className="flex min-h-11 w-full items-center justify-between gap-3 p-4 text-left focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-green">
      <span className="min-w-0 space-y-1">
        <span className="block text-xs font-bold uppercase tracking-wider text-accent-green">{weekdayLabel(day.weekday)}</span>
        <span className="block break-words text-base font-bold text-white">{day.title}</span>
        <span className="block text-xs text-text-muted"><span className="capitalize">{day.kind}</span> · {ordered.length} {ordered.length === 1 ? 'exercise' : 'exercises'}</span>
      </span>
      <ChevronDown aria-hidden="true" className={`h-5 w-5 shrink-0 text-text-muted transition-transform ${expanded ? 'rotate-180' : ''}`} />
    </button></h2>
    <div id={panelId} hidden={!expanded} role="region" aria-labelledby={`day-heading-${day.id}`} className="space-y-5 border-t border-white/10 p-4">
      <BufferedRoutineInput field={{ kind: 'day-title', dayId: day.id }} value={day.title} label="Day title" />
      <div className="space-y-1.5">
        <label htmlFor={kindId} className="block text-xs font-semibold text-text-muted">Day kind</label>
        <select id={kindId} value={day.kind} className={editorInputClass} disabled={isSaving}
          aria-describedby={ordered.length ? `${kindId}-help` : undefined}
          onChange={event => { try { useRoutineStore.getState().updateDayMetadata(day.weekday, { kind: event.target.value as DayKind }); } catch { /* Store error is visible. */ } }}>
          <option value="training">Training</option><option value="recovery">Recovery</option>
          <option value="rest" disabled={ordered.length > 0}>Rest</option>
        </select>
        {ordered.length > 0 && <p id={`${kindId}-help`} className="text-xs text-text-muted">Remove all exercises before changing this day to Rest.</p>}
      </div>
      {day.kind === 'rest' ? <p className="rounded-xl bg-black/30 p-4 text-sm text-text-muted">Rest day — no exercises planned. Change the day kind to add exercises.</p> : <>
        {sections.map(section => {
          const occurrences = ordered.filter(exercise => exercise.section === section);
          return <div key={section} className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">{section === 'warmup' ? 'Warm-up' : day.kind === 'recovery' ? 'Recovery activities' : 'Main exercises'} <span className="text-white/40">({occurrences.length})</span></h3>
            {!occurrences.length && <p className="text-sm text-text-muted">No {section === 'warmup' ? 'warm-up' : 'main'} exercises yet.</p>}
            {occurrences.map((occurrence, index) => <RoutineOccurrenceEditor key={occurrence.id} occurrence={occurrence}
              canMoveUp={index > 0} canMoveDown={index < occurrences.length - 1} isSaving={isSaving} defaultRest={defaultRest}
              onMove={direction => {
                try { useRoutineStore.getState().moveOccurrence(day.id, occurrence.id, direction); announce(`${occurrence.name} moved ${direction} within ${section === 'warmup' ? 'warm-up' : 'main'}.`); } catch { /* Store error is visible. */ }
              }} onRemove={() => {
                try {
                  useRoutineStore.getState().removeOccurrence(occurrence.id);
                  focus(occurrences[index + 1] ? `routine-occurrence-${occurrences[index + 1].id}` : occurrences[index - 1] ? `routine-occurrence-${occurrences[index - 1].id}` : `routine-add-${day.id}`);
                  announce(`${occurrence.name} removed.`);
                } catch { /* Store error is visible. */ }
              }} />)}
          </div>;
        })}
        <button id={`routine-add-${day.id}`} type="button" onClick={onAdd} disabled={isSaving}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-accent-green/40 px-4 py-3 text-sm font-semibold text-accent-green focus-visible:ring-2 focus-visible:ring-accent-green disabled:opacity-40">
          <Plus className="h-4 w-4" aria-hidden="true" /> Add Exercise
        </button>
      </>}
    </div>
  </section>;
}
