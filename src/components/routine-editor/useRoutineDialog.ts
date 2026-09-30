'use client';

import { useEffect, useRef, type RefObject } from 'react';

export function useRoutineDialog(open: boolean, ref: RefObject<HTMLElement | null>, onClose: () => void) {
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const selector = 'button:not([disabled]),input:not([disabled]),select:not([disabled]),[href],[tabindex="0"]';
    const controls = () => Array.from(ref.current?.querySelectorAll<HTMLElement>(selector) ?? []).filter(item => item.getClientRects().length);
    const frame = requestAnimationFrame(() => (ref.current?.querySelector<HTMLElement>('input,select') ?? controls()[0])?.focus());
    const keydown = (event: KeyboardEvent) => {
      if (!ref.current?.contains(document.activeElement)) return;
      if (event.key === 'Escape') { event.preventDefault(); close.current(); }
      if (event.key !== 'Tab') return;
      const first = controls()[0], last = controls().at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', keydown);
      requestAnimationFrame(() => { if (previousFocus?.isConnected && !document.querySelector('[aria-modal="true"]')) previousFocus.focus(); });
    };
  }, [open, ref]);
}
