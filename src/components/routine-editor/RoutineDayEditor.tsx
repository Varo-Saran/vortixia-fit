'use client';

import { Check, ChevronDown, ListOrdered, Pencil, Plus } from 'lucide-react';
import type { DayKind, DayPlan, ExerciseSection } from '@/types/routine';
import { weekdayLabel } from '@/lib/routine-model';
import { useRoutineStore } from '@/store/useRoutineStore';
import { Select } from '@/components/ui/Select';
import { BufferedRoutineInput } from './BufferedRoutineInput';
import { RoutineOccurrenceEditor } from './RoutineOccurrenceEditor';

export function RoutineDayEditor({ day, expanded, onToggle, onAdd, settingsOpen = false, activeOccurrenceId = null, reorderSection = null, onSettings, onDone, onOccurrence, onReorder, defaultRest, announce, focus }: {
  day: DayPlan; expanded: boolean; onToggle: () => void; onAdd: (section: ExerciseSection) => void; defaultRest: number;
  settingsOpen?: boolean; activeOccurrenceId?: string | null; reorderSection?: ExerciseSection | null;
  onSettings?: () => void; onDone?: () => void; onOccurrence?: (id: string) => void; onReorder?: (section: ExerciseSection) => void;
  announce: (message: string) => void; focus: (id: string) => void;
}) {
  const isSaving = useRoutineStore(state => state.isSaving);
  const ordered = [...day.exercises].sort((a, b) => a.order - b.order);
  const kindId = `day-kind-${day.id}`, panelId = `day-panel-${day.id}`;
  const sections = day.kind === 'recovery' ? (ordered.some(item => item.section === 'warmup') ? ['warmup', 'main'] as const : ['main'] as const) : ['warmup', 'main'] as const;
  const dayAccent = day.kind === 'recovery' ? 'text-teal-200/80' : day.kind === 'rest' ? 'text-white/45' : 'text-emerald-200/80';
  return <section className={`min-w-0 overflow-hidden rounded-[22px] border shadow-lg shadow-black/10 ${expanded ? 'border-white/10 bg-white/[0.025]' : 'border-white/[0.07] bg-white/[0.02]'}`}>
    <h2><button id={`day-heading-${day.id}`} type="button" onClick={onToggle} aria-expanded={expanded} aria-controls={panelId}
      className="flex min-h-11 w-full items-center justify-between gap-3 p-4 text-left focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-green sm:p-5">
      <span className="min-w-0 space-y-1.5">
        <span className={`block text-[11px] font-semibold uppercase tracking-[0.16em] ${dayAccent}`}>{weekdayLabel(day.weekday)}</span>
        <span className="block break-words text-[17px] font-semibold leading-snug tracking-[-0.02em] text-white">{day.title}</span>
        <span className="block text-xs text-white/45"><span className="capitalize">{day.kind}</span> · {ordered.length} {ordered.length === 1 ? 'exercise' : 'exercises'}</span>
      </span>
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors ${expanded ? 'bg-white/5 text-white/75' : 'text-white/40'}`}><ChevronDown aria-hidden="true" className={`h-[18px] w-[18px] transition-transform ${expanded ? 'rotate-180' : ''}`} /></span>
    </button></h2>
    <div id={panelId} hidden={!expanded} role="region" aria-labelledby={`day-heading-${day.id}`} className="space-y-6 px-3 pb-4 sm:px-4">
      <div className="flex items-center justify-between border-t border-white/[0.06] pt-2">
        <span className="px-1 text-xs text-white/35">Your day, your programming</span>
        <button id={`day-settings-${day.id}`} type="button" onClick={settingsOpen ? onDone : onSettings} aria-expanded={settingsOpen} aria-controls={`day-settings-panel-${day.id}`}
          aria-label={`${settingsOpen ? 'Done editing' : 'Edit'} ${weekdayLabel(day.weekday)} day`}
          className="flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-xs font-medium text-white/65 hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-accent-green">
          {settingsOpen ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Pencil className="h-3.5 w-3.5" aria-hidden="true" />}{settingsOpen ? 'Done' : 'Edit day'}
        </button>
      </div>
      <div id={`day-settings-panel-${day.id}`} hidden={!settingsOpen}>
        {settingsOpen && <div className="space-y-4 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
          <BufferedRoutineInput field={{ kind: 'day-title', dayId: day.id }} value={day.title} label="Day title" />
          <div className="space-y-1.5"><label htmlFor={kindId} className="block text-xs font-semibold text-text-muted">Day kind</label>
            <Select id={kindId} value={day.kind} label="Day kind" disabled={isSaving} triggerClassName="min-h-11"
              describedBy={ordered.length ? `${kindId}-help` : undefined}
              options={[{ value: 'training', label: 'Training' }, { value: 'recovery', label: 'Recovery' }, { value: 'rest', label: 'Rest', disabled: ordered.length > 0 }]}
              onValueChange={kind => { try { useRoutineStore.getState().updateDayMetadata(day.weekday, { kind: kind as DayKind }); } catch { /* Store error is visible. */ } }} />
            {ordered.length > 0 && <p id={`${kindId}-help`} className="text-xs leading-relaxed text-text-muted">Remove all exercises before changing this day to Rest.</p>}
          </div>
        </div>}
      </div>
      {day.kind === 'rest' ? <div className="rounded-2xl bg-white/[0.02] px-4 py-6 text-sm text-text-muted"><p className="font-medium text-white/65">Rest day — no exercises planned.</p><p className="mt-1 text-xs">Change the day kind to add exercises.</p></div> : <>
        {sections.map(section => {
          const occurrences = ordered.filter(exercise => exercise.section === section);
          const reordering = reorderSection === section;
          const title = section === 'warmup' ? 'Warm-up' : day.kind === 'recovery' ? 'Recovery activities' : 'Main exercises';
          const accent = section === 'warmup' ? 'text-amber-200/70' : day.kind === 'recovery' ? 'text-teal-200/75' : 'text-emerald-200/75';
          return <div key={section} className="space-y-2.5">
            <div className="flex items-center justify-between gap-2 px-1">
              <h3 className={`flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] ${accent}`}><span className="h-3 w-0.5 rounded-full bg-current opacity-70" />{title} <span className="text-white/35">({occurrences.length})</span></h3>
              {occurrences.length > 1 && <button type="button" onClick={reordering ? onDone : () => onReorder?.(section)}
                aria-label={reordering ? `Done reordering ${title}` : `Reorder ${title}`} aria-pressed={reordering}
                className="flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-xs text-white/50 hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-accent-green">
                {reordering ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <ListOrdered className="h-3.5 w-3.5" aria-hidden="true" />}{reordering ? 'Done' : 'Reorder'}
              </button>}
            </div>
            {!occurrences.length && <p className="px-1 py-2 text-xs text-white/35">No {section === 'warmup' ? 'warm-up' : 'main'} exercises yet.</p>}
            {occurrences.map((occurrence, index) => <RoutineOccurrenceEditor key={occurrence.id} occurrence={occurrence}
              expanded={activeOccurrenceId === occurrence.id} reordering={reordering} onEdit={() => onOccurrence?.(occurrence.id)} onDone={onDone}
              canMoveUp={index > 0} canMoveDown={index < occurrences.length - 1} isSaving={isSaving} defaultRest={defaultRest}
              onMove={direction => {
                try { useRoutineStore.getState().moveOccurrence(day.id, occurrence.id, direction); announce(`${occurrence.name} moved ${direction} within ${section === 'warmup' ? 'warm-up' : 'main'}.`); } catch { /* Store error is visible. */ }
              }} onRemove={() => {
                try {
                  useRoutineStore.getState().removeOccurrence(occurrence.id); onDone?.();
                  focus(occurrences[index + 1] ? `occurrence-edit-${occurrences[index + 1].id}` : occurrences[index - 1] ? `occurrence-edit-${occurrences[index - 1].id}` : `routine-add-${day.id}-${section}`);
                  announce(`${occurrence.name} removed.`);
                } catch { /* Store error is visible. */ }
              }} />)}
            <button id={`routine-add-${day.id}-${section}`} type="button" onClick={() => onAdd(section)} disabled={isSaving}
              className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-medium transition-colors hover:bg-white/[0.035] focus-visible:ring-2 focus-visible:ring-accent-green disabled:opacity-40 ${accent}`}>
              <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Add {section === 'warmup' ? 'warm-up' : day.kind === 'recovery' ? 'activity' : 'exercise'}
            </button>
          </div>;
        })}
      </>}
    </div>
  </section>;
}
