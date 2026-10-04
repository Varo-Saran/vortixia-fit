'use client';

import { editorFieldKey } from '@/lib/routine-editor';
import { commitEditorInput } from '@/lib/routine-editor-controls';
import { useRoutineStore } from '@/store/useRoutineStore';
import type { EditorField } from '@/types/routine-editor';

export const editorInputClass = 'min-h-11 w-full min-w-0 rounded-xl border border-white/[0.12] bg-[#141a16] px-3.5 py-2.5 text-base font-medium text-white outline-none transition-colors hover:border-white/20 focus-visible:border-accent-green focus-visible:ring-2 focus-visible:ring-accent-green/30 disabled:cursor-not-allowed disabled:opacity-50 tabular-nums aria-[invalid=true]:border-red-500/80 aria-[invalid=true]:focus-visible:border-red-400 aria-[invalid=true]:focus-visible:ring-red-400/30';

export function useBufferedField(field: EditorField, value: string) {
  const key = editorFieldKey(field);
  const buffer = useRoutineStore(state => state.editorBuffers[key]);
  const change = (raw: string) => useRoutineStore.getState().setEditorBuffer(field, raw);
  const commit = () => {
    const state = useRoutineStore.getState();
    const current = state.editorBuffers[key];
    if (!current || current.error || !state.routine) return;
    try {
      commitEditorInput(field, current.raw, state, state.routine.days);
      // Normalize committed text without disturbing incomplete raw input.
      state.setEditorBuffer(field, current.raw.trim());
    } catch { /* D2B retains the draft and exposes the controlled error. */ }
  };
  return { raw: buffer?.raw ?? value, error: buffer?.error ?? null, change, commit };
}

export function BufferedRoutineInput({ field, value, label, numeric = false, disabled = false }: {
  field: EditorField; value: string; label: string; numeric?: boolean; disabled?: boolean;
}) {
  const input = useBufferedField(field, value);
  const id = `editor-${editorFieldKey(field)}`;
  return <div className="min-w-0 space-y-1.5">
    <label htmlFor={id} className="block text-xs font-semibold text-text-muted">{label}</label>
    <input id={id} className={editorInputClass} type={numeric ? 'number' : 'text'}
      inputMode={numeric ? 'numeric' : 'text'} min={numeric ? 1 : undefined} max={numeric ? 100 : undefined}
      step={numeric ? 1 : undefined} value={input.raw} disabled={disabled}
      onChange={event => input.change(event.target.value)} onBlur={input.commit}
      aria-invalid={!!input.error} aria-describedby={input.error ? `${id}-error` : undefined} />
    {input.error && <p id={`${id}-error`} className="text-xs text-red-300">{input.error}</p>}
  </div>;
}
