'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { registerRoutineGuard, type RoutineGuardPrompt } from '@/lib/routine-draft-guard';
import { useRoutineStore } from '@/store/useRoutineStore';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';

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
