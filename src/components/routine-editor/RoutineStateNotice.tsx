'use client';

import { useState } from 'react';
import { useRoutineStore } from '@/store/useRoutineStore';
import { routineCapabilities } from '@/lib/routine-compatibility';
import { downloadRecoveryBackup } from '@/lib/routine-recovery';
import { RoutineGuardedLink } from '@/components/RoutineDraftGuard';

export function RecoveryBackupButton() {
  const state = useRoutineStore(), [feedback, setFeedback] = useState('');
  if (!routineCapabilities(state).canBackup) return null;
  return <div><button type="button" className="min-h-11 rounded-xl border border-white/15 px-3 text-xs font-semibold text-white/80" onClick={() => {
    const current = useRoutineStore.getState();
    if (!routineCapabilities(current).canBackup || !current.sourceSnapshot) return;
    void downloadRecoveryBackup(current.sourceSnapshot).then(() => setFeedback('Private recovery backup downloaded.')).catch(() => setFeedback('Unable to download backup. Your saved routine is unchanged.'));
  }}>Private Recovery Backup</button><p role="status" aria-live="polite" className="mt-1 text-xs text-white/60">{feedback}</p></div>;
}

export function RoutineStateNotice({ workout = false, editor = false }: { workout?: boolean; editor?: boolean }) {
  const state = useRoutineStore(), caps = routineCapabilities(state);
  if (state.loadStatus === 'ready') return null;
  const attention = state.loadStatus === 'needs_attention';
  const loading = state.loadStatus === 'loading' || state.loadStatus === 'idle';
  const count = state.compatibilityIssues.filter(issue => issue.severity === 'blocking').length;
  return <section aria-label="Routine availability" className="rounded-2xl border border-white/10 bg-[#0e1210] p-4 text-sm">
    <p role="status" aria-live="polite" className={attention ? 'font-semibold text-amber-200' : 'font-semibold text-white'}>{loading ? 'Loading routine…' : attention ? workout ? 'Fix your routine before starting a workout' : 'Routine needs attention' : 'Unable to load routine'}</p>
    {!loading && <p className="mt-2 text-xs leading-relaxed text-white/65">{attention ? count ? `${count} settings need review. Older programming is preserved; no units or tracking have been chosen for you.` : 'Finish any highlighted fields, then Save Changes to confirm your reviewed settings. Workouts remain blocked until the save is verified.' : 'Your saved routine has not been replaced. Retry loading, or contact support if this continues.'}</p>}
    {!loading && <div className="mt-3 flex flex-wrap items-start gap-2">
      {attention && !editor && caps.canViewRoutine && <RoutineGuardedLink href="/routines/edit" className="inline-flex min-h-11 items-center rounded-xl bg-accent-green px-4 text-xs font-bold text-black">Fix Routine</RoutineGuardedLink>}
      {!attention && <button type="button" className="min-h-11 rounded-xl border border-white/15 px-4 text-xs" onClick={() => void useRoutineStore.getState().fetchRoutine()}>Retry</button>}
      <RoutineGuardedLink href="/routines/templates" className="inline-flex min-h-11 items-center px-3 text-xs text-accent-green">Browse Templates</RoutineGuardedLink>
      <RecoveryBackupButton />
    </div>}
  </section>;
}
