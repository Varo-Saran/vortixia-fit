export class RoutineGuardCancelledError extends Error {
  constructor() { super('Keep editing.'); this.name = 'RoutineGuardCancelledError'; }
}
export type RoutineGuardPrompt = { kind: 'leave' | 'replace'; intent: string };
type Confirm = (prompt: RoutineGuardPrompt) => Promise<boolean>;
let confirm: Confirm | null = null;
export function registerRoutineGuard(handler: Confirm): () => void {
  confirm = handler;
  return () => { if (confirm === handler) confirm = null; };
}
export async function confirmRoutineDiscard(prompt: RoutineGuardPrompt): Promise<boolean> {
  // Fail closed without a mounted UI; never silently discard a draft.
  if (!confirm) throw new Error('The routine discard guard is unavailable. Keep editing and try again.');
  return confirm(prompt);
}
