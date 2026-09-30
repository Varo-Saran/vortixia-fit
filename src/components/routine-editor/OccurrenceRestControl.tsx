'use client';

import { formatRest, parseRestInput, REST_PRESETS, restSelection } from '@/lib/routine-editor-controls';
import { useBufferedField, editorInputClass } from './BufferedRoutineInput';

export function RestControl({ id, raw, error, onChange, onCommit, disabled = false, defaultRest, label = 'Rest between sets' }: {
  id: string; raw: string; error: string | null; onChange: (raw: string) => void;
  onCommit?: () => void; disabled?: boolean; defaultRest?: number; label?: string;
}) {
  const selection = restSelection(raw);
  let display = 'Check custom seconds';
  try { display = formatRest(parseRestInput(raw)); } catch { /* Raw invalid values remain visible. */ }
  return <div className="space-y-1.5">
    <label htmlFor={id} className="block text-xs font-semibold text-text-muted">{label}</label>
    <select id={id} className={editorInputClass} value={selection} disabled={disabled}
      aria-invalid={!!error} aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`}
      onChange={event => {
        onChange(event.target.value === 'custom' ? (selection === 'custom' ? raw : '') : event.target.value);
        if (event.target.value !== 'custom') onCommit?.();
      }}>
      <option value="default">Use Default</option>
      {REST_PRESETS.map(seconds => <option key={seconds} value={seconds}>{seconds} sec</option>)}
      <option value="custom">Custom</option>
    </select>
    {selection === 'custom' && <div className="space-y-1.5">
      <label htmlFor={`${id}-custom`} className="block text-xs font-semibold text-text-muted">Custom rest (seconds)</label>
      <input id={`${id}-custom`} className={editorInputClass} type="number" inputMode="numeric"
        min={1} max={3600} step={1} value={raw} disabled={disabled}
        onChange={event => onChange(event.target.value)} onBlur={onCommit}
        aria-invalid={!!error} aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`} />
    </div>}
    <p id={`${id}-help`} className="text-xs text-text-muted">Rest: {display}
      {raw === 'default' && defaultRest !== undefined ? ` (${formatRest(defaultRest)} global default)` : ''}</p>
    {error && <p id={`${id}-error`} className="text-xs text-red-300">{error}</p>}
  </div>;
}

export function OccurrenceRestControl({ occurrenceId, restSeconds, defaultRest, label }: {
  occurrenceId: string; restSeconds: number | null; defaultRest: number; label?: string;
}) {
  const input = useBufferedField({ kind: 'rest', occurrenceId }, restSeconds === null ? 'default' : String(restSeconds));
  return <RestControl id={`rest-${occurrenceId}`} raw={input.raw} error={input.error}
    onChange={input.change} onCommit={input.commit} defaultRest={defaultRest} label={label} />;
}
