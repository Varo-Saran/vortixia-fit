'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { registerRoutineGuard, type RoutineGuardPrompt } from '@/lib/routine-draft-guard';
import { useRoutineStore } from '@/store/useRoutineStore';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { downloadRecoveryBackup } from '@/lib/routine-recovery';
import { routineCapabilities } from '@/lib/routine-compatibility';

function RecoveryConfirmation({ prompt, finish }: { prompt: Extract<RoutineGuardPrompt, { kind: 'recovery-replace' }>; finish: (confirmed: boolean) => void }) {
  const [approved, setApproved] = useState(false);
  const [feedback, setFeedback] = useState('');
  const source = useRoutineStore(state => state.sourceSnapshot);
  useEffect(() => { if (source !== prompt.source) finish(false); }, [source, prompt.source, finish]);
  const backup = async () => {
    const state = useRoutineStore.getState();
    if (state.sourceSnapshot !== prompt.source || !routineCapabilities(state).canBackup) return;
    try { await downloadRecoveryBackup(prompt.source); setFeedback('Private recovery backup downloaded. Keep it somewhere safe.'); }
    catch { setFeedback('Backup could not be downloaded. Cancel to preserve your routine and try again.'); }
  };
  return <ConfirmationDialog isOpen title="Replace this routine?" description="Your saved routine contains older settings that need review. Download a private recovery backup before replacing it. The replacement removes the old routine programming; workout history is not changed."
    confirmLabel="Replace Routine" cancelLabel="Keep Routine" confirmDisabled={!approved} onConfirm={() => { if (approved) finish(true); }} onCancel={() => finish(false)}>
    <button type="button" onClick={() => void backup()} className="mt-4 min-h-11 w-full rounded-xl border border-accent-green/30 px-3 text-sm font-semibold text-accent-green">Download Private Recovery Backup</button>
    <p role="status" aria-live="polite" className="mt-2 text-xs text-white/60">{feedback}</p>
    <label className="mt-3 flex min-h-11 items-center gap-3 text-sm text-white/80"><input type="checkbox" checked={approved} onChange={event => setApproved(event.target.checked)} className="h-5 w-5 accent-accent-green" />I understand and want to replace this routine.</label>
  </ConfirmationDialog>;
}

export function RoutineDraftGuard() {
  const hasUnsavedChanges = useRoutineStore(state => state.hasUnsavedChanges);
  const [prompt, setPrompt] = useState<RoutineGuardPrompt | null>(null);
  const pending = useRef<((confirmed: boolean) => void) | null>(null);
  useEffect(() => {
    const unregister = registerRoutineGuard(next => new Promise<boolean>(resolve => {
      if (pending.current) { resolve(false); return; }
      pending.current = resolve;
      setPrompt(next);
    }));
    return () => { unregister(); pending.current?.(false); pending.current = null; };
  }, []);
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasUnsavedChanges]);
  const finish = (confirmed: boolean) => {
    const resolve = pending.current;
    pending.current = null;
    setPrompt(null);
    resolve?.(confirmed);
  };
  if (prompt?.kind === 'recovery-replace') return <RecoveryConfirmation prompt={prompt} finish={finish} />;
  return <ConfirmationDialog
    isOpen={prompt !== null}
    title="Unsaved routine changes"
    description={prompt?.kind === 'replace' ? 'Replace your unsaved routine draft? The saved routine changes only after the new routine is saved.' : 'Discard your unsaved routine edits and leave?'}
    confirmLabel={prompt?.kind === 'replace' ? 'Discard Changes and Replace' : 'Discard Changes and Leave'}
    cancelLabel="Keep Editing"
    onConfirm={() => finish(true)} onCancel={() => finish(false)}
  />;
}

// Next 16's documented onNavigate only intercepts controlled same-document SPA
// navigation. Native Back is untouched; draft/buffers live above route lifetime.
export function RoutineGuardedLink(props: Omit<ComponentProps<typeof Link>, 'href' | 'onNavigate'> & { href: string }) {
  const router = useRouter();
  const pathname = usePathname();
  return <Link {...props} onNavigate={event => {
    const destination = props.href;
    if (!destination || destination === pathname || destination === '/routines/edit') return;
    event.preventDefault();
    void useRoutineStore.getState().requestLeave(destination).then(allowed => {
      if (allowed) {
        if (props.replace) router.replace(destination, { scroll: props.scroll });
        else router.push(destination, { scroll: props.scroll });
      }
    }).catch(error => {
      useRoutineStore.setState({ error: error instanceof Error ? error.message : 'Unable to confirm navigation.' });
    });
  }} />;
}
