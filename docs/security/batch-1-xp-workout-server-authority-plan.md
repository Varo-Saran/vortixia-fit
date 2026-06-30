# Batch 1: Server-Authoritative XP and Workout Completion Plan

Status: Implementation plan only  
Prepared: 2026-06-30  
Scope: XP awards, workout completion, offline replay, workout undo, reward claims, and the permission-migration deployment boundary

This document describes a backward-compatible implementation sequence. It does
not authorize applying database migrations, changing Vercel configuration, or
deploying code.

## 1. Problem Statement

XP and workout state currently cross the browser/database trust boundary through
several independent client-issued mutations. The browser calculates XP, inserts
workout records, calls a generic XP mutation function, updates duel scores, and
triggers social notifications. Offline replay trusts values stored in editable
localStorage. Workout deletion separately deletes the session and subtracts XP.

This produces three core risks:

- A user can request arbitrary XP changes through `increment_user_xp`.
- A partial failure can leave sessions, sets, XP, duel scores, and notifications
  inconsistent.
- Repeated submissions, retries, crashes, or repeated deletion can award or
  subtract XP more than once.

Batch 1 must make the server authoritative for identity, XP calculation,
ownership, transaction ordering, and idempotency while preserving online and
offline workout behavior.

## 2. Current Unsafe Flows

### 2.1 Client `increment_user_xp` calls

Four browser-side call sites must be removed:

1. `src/store/useWorkoutStore.ts` awards client-calculated XP after online
   workout persistence.
2. `src/components/GlobalListeners.tsx` awards XP from an editable offline
   localStorage payload.
3. `src/app/page.tsx` passes a negative client-calculated amount when deleting a
   workout.
4. `src/app/page.tsx` awards a fixed 500 XP milestone using client/localStorage
   state as the claim guard.

There are no direct browser inserts or updates to `users.total_xp` or
`users.is_admin`; the generic RPC is the XP mutation boundary. `level` and
`streak` are derived values rather than columns in the current `users` table.

### 2.2 Online workout completion

The current browser flow performs these operations separately:

1. Calculate completed sets, volume, duration, and XP.
2. Insert a `workout_sessions` row.
3. Insert `workout_sets` rows.
4. Call `increment_user_xp`.
5. Read and update active duel scores.
6. Update client trophy, fatigue, and summary state.
7. Call `/api/push/workout-complete` with client-supplied XP.

The set insert can fail while XP still succeeds. The session can succeed while
XP fails. Duel updates can partially succeed. XP RPC errors are not reliably
propagated to the UI, and the store catches failures internally, so a completion
summary can appear even when persistence is incomplete.

### 2.3 Offline workout replay

The offline queue stores raw workout data plus calculated `totalVolume`,
`xpEarned`, and duration in localStorage. Foreground replay repeats the same
multi-step browser mutations as the online flow.

The payload is user-editable, has no stable operation ID, and is removed only
after the mutation sequence. A crash after session insertion or XP award but
before dequeue can replay the workout and award it again.

### 2.4 Workout delete and undo

The dashboard calculates an XP deduction in the browser, deletes the session,
calls `increment_user_xp` with a negative amount, and then updates duel scores.
These steps are not transactional.

A repeated request can subtract XP again even if the second session deletion
affects no row. The handler relies on RLS rather than an explicit server-side
ownership check, and the confirmation button has no mutation-level idempotency
guard.

### 2.5 Client milestone and reward claims

The milestone claim is guarded by UI state and a localStorage marker, then calls
`increment_user_xp` with a fixed amount. Eligibility and uniqueness are not
enforced by the server. Clearing local state or calling the RPC directly bypasses
the intended one-time claim behavior.

## 3. Target Architecture

The Next.js route handler authenticates and validates the request. PostgreSQL
performs the authoritative mutation in one transaction. The client never sends
`user_id`, authoritative XP, duel score deltas, or protected profile values.

### 3.1 `POST /api/workouts/complete`

Request responsibilities:

- Accept a stable client-generated operation UUID.
- Accept start/end timestamps, routine context, and raw completed-set data.
- Reject malformed, out-of-range, empty, or excessively large payloads.
- Ignore any legacy XP or total-volume values supplied by the client.

Server responsibilities:

- Resolve the authenticated user with a verified server auth call.
- Invoke one transactional workout-completion database function.
- Return the authoritative session ID, set count, volume, XP award, total XP,
  and whether the response was newly committed or an idempotent replay.
- Trigger non-critical follow-up work only after the transaction commits.

### 3.2 `DELETE /api/workouts/[sessionId]`

The route must authenticate the user and invoke one transactional undo function.
The function must verify ownership, determine the original authoritative award,
delete or void the session once, create one reversal event, adjust XP and duel
state once, and return an idempotent already-undone response on repetition.

No deduction amount may be accepted from the browser.

### 3.3 `POST /api/rewards/[rewardId]/claim`

The route accepts only a stable reward identifier. The database verifies
eligibility, records a unique claim, creates the XP event, updates total XP, and
returns the authoritative result transactionally. A repeated claim returns the
original result without another award.

The current localStorage-only milestone claim must be removed or disabled until
its eligibility rule has a server-side source of truth.

### 3.4 Post-commit push notification behavior

`/api/push/workout-complete` must not receive client-calculated XP. After a
successful completion transaction, the server should provide the authoritative
session ID to an internal notification helper that reads the committed routine
and XP result.

Push delivery is best-effort and must not roll back a completed workout. A push
failure should be logged without endpoint/key material and returned as follow-up
metadata rather than changing the completion result. A durable outbox can be a
later enhancement if reliable notification retries become necessary.

## 4. Required Database Changes

All changes should first be introduced in an additive migration that can coexist
with the old client. Restrictive grants are applied only after the new client is
deployed and verified.

### 4.1 Stable operation identity

- Every completion receives a UUID generated once by the client.
- Store the operation ID with the user and authoritative session relationship.
- Enforce uniqueness for `(user_id, operation_id)`.
- Retries must return the original result rather than create a new session.
- Operation records must survive undo so an old completion cannot be replayed
  after deletion.

### 4.2 XP event ledger

Introduce an append-only XP event ledger with, at minimum:

- Event ID
- User ID
- Source type (`workout`, `workout_reversal`, `reward`, or another controlled
  enum/value)
- Stable source/operation ID
- Signed XP amount
- Reversal relationship where applicable
- Creation timestamp

Use uniqueness constraints so a source can award or reverse only once. The
ledger and `users.total_xp` update must occur in the same transaction. Existing
XP should not be silently rewritten; any reconciliation/backfill requires a
separate reviewed plan.

### 4.3 Transactional `SECURITY DEFINER` functions

Create narrowly scoped functions for:

- Workout completion
- Workout undo
- Reward claim

Each function must:

- Use a locked `search_path`.
- Reject a missing `auth.uid()`.
- Derive ownership from `auth.uid()` rather than a caller-provided user ID.
- Validate all identifiers and numeric/time bounds.
- Calculate volume and XP inside the trusted transaction.
- Lock affected rows when concurrent mutation could race.
- Apply session, set, XP ledger, total XP, and supported duel mutations
  atomically.
- Return a stable structured result for both first execution and replay.

Revoke public/anonymous execution. Grant only the minimum authenticated or
server role required by the selected route implementation. Do not expose a
generic arbitrary-delta XP function to browser roles.

### 4.4 Constraints and indexes

Required controls include:

- Unique `(user_id, operation_id)` workout operation constraint.
- Unique XP event source constraint.
- Unique reward claim per `(user_id, reward_id)`.
- Foreign keys from sets and XP events to their source records where practical.
- Non-null operation, user, source, and amount fields.
- Checks for non-negative weights/reps, valid timestamps, bounded durations,
  and bounded set counts.
- Indexes for user workout history, operation lookup, XP ledger lookup, and
  active duel updates.

Confirm the live duel score schema before including duel writes; current code
and live table metadata appear to disagree about score columns.

### 4.5 RLS and direct table permissions

RLS should continue to permit users to read their own workout history. Once all
new routes are deployed, revoke direct authenticated inserts, updates, and
deletes on workout sessions/sets and protected duel score fields. The
transactional functions become the only mutation path.

## 5. Client Migration Plan

### 5.1 Online completion

- Generate an operation UUID when a workout begins or first enters completion.
- Preserve it in the persisted workout store.
- Send raw completed sets to `POST /api/workouts/complete`.
- Remove direct session/set inserts, XP RPC calls, and database duel updates.
- Build the summary from the authoritative response.
- Reconcile trophy, fatigue, profile, and duel UI state from committed values.

### 5.2 Offline queue version 2

The queue should store:

- Schema version
- Stable operation UUID
- Start/end timestamps
- Routine context
- Raw completed sets with tracking and unit information
- Queue creation time and retry metadata

It must not store an authoritative XP amount, total XP, user ID, or duel delta.
The queue item is removed only after the server confirms a committed or
idempotently completed operation.

### 5.3 Old offline payload handling

- Detect unversioned/version-1 entries.
- Generate and persist one stable operation UUID before the first network call.
- Convert usable raw set data to the version-2 shape.
- Ignore stored `xpEarned`, duration totals, and volume totals; the server
  recomputes them.
- Quarantine malformed entries with a user-visible recovery option instead of
  repeatedly submitting or silently discarding them.
- Persist the converted payload before submission so a crash reuses the same
  operation UUID.

### 5.4 UI success and failure behavior

- Display an offline/pending state when a workout is queued.
- Display a committed summary only after a successful or idempotent server
  response.
- Keep retryable failures queued and show a non-destructive retry message.
- Do not dequeue on partial or unknown responses.
- Disable duplicate completion and delete controls while a request is active,
  while still relying on server idempotency as the real control.
- Treat push failure as non-fatal after workout commit.
- Refresh profile XP and history from the server after completion or undo.

## 6. Deployment Order

1. Keep the existing emergency permission migration unapplied.
2. Add and review the backward-compatible database migration containing the
   operation model, XP ledger, constraints, and new transactional functions.
3. Apply only that additive prerequisite migration in a controlled window.
4. Deploy the new completion, undo, and reward route handlers while retaining
   the old RPC temporarily for compatibility.
5. Deploy the online client migration and offline queue version-2 migration.
6. Verify old offline payload conversion and service-worker/client update
   behavior.
7. Monitor authoritative completion, replay, undo, reward, duel, and push paths.
8. Confirm all browser `increment_user_xp` and direct workout mutation paths are
   gone.
9. Apply the restrictive emergency permission migration.
10. Verify denied legacy calls and allowed profile editing in Preview, then
    Production.
11. Remove the obsolete generic XP function in a later cleanup migration once
    no rollback depends on it.

## 7. Verification Checklist

### Static and build validation

- `rg increment_user_xp src` returns no browser call sites.
- No browser code directly inserts/deletes workout sessions or sets.
- No browser code directly updates authoritative duel scores.
- TypeScript passes.
- Production build passes.
- Targeted ESLint passes for changed files.
- `git diff --check` passes.
- Clean current-tree Gitleaks scan passes.

### Completion validation

- One request creates one session, its sets, one XP event, and one XP update.
- XP and volume are recomputed from raw sets.
- Caller-supplied XP/user identifiers are ignored or rejected.
- Two concurrent requests with one operation UUID produce one award.
- Retrying after a response timeout returns the original result.
- A forced set/XP failure rolls back the entire transaction.
- Empty, malformed, oversized, negative, and unreasonable payloads are rejected.

### Offline validation

- A version-2 queued workout syncs once.
- A crash after commit but before dequeue does not duplicate data or XP.
- A legacy payload receives and persists one operation UUID before submission.
- Editing legacy `xpEarned` does not change the authoritative award.
- Malformed legacy entries remain recoverable and do not loop indefinitely.

### Undo and reward validation

- Users cannot delete another user's session.
- One undo creates one reversal and updates XP once.
- Repeated/concurrent undo requests do not double-deduct.
- Reward eligibility is server-verified.
- Repeated/concurrent reward claims produce one XP event.

### Post-commit and permission validation

- Push notifications occur only after a committed completion.
- Push failure does not roll back the workout.
- Logs contain no subscription/key material or sensitive workout payloads.
- Direct authenticated calls to the legacy XP function are denied after revoke.
- Direct protected `users` writes are denied.
- Normal profile, settings, timezone, and notification-state editing still works.

## 8. Emergency Supabase Migration Readiness Gate

Do not apply `20260629090000_security_remediation_batch_0.sql` until all of the
following are true:

- Additive transaction/idempotency migration is applied and verified.
- Completion, undo, and reward routes are deployed.
- Online completion uses only the server route.
- Offline replay uses only the server route and stable operation IDs.
- Legacy offline payload conversion is deployed.
- All four browser `increment_user_xp` call sites are removed.
- Direct client workout and authoritative duel mutations are removed.
- Reward claims are server-authoritative or disabled.
- Duplicate completion and undo tests pass.
- Cached/service-worker clients have a safe upgrade path.
- Monitoring can distinguish validation, authorization, transaction, replay,
  and post-commit notification failures without logging sensitive values.
- A rollback/fix-forward procedure has been rehearsed.
- Normal profile editing is confirmed against the migration's column grants.

Applying the emergency migration earlier would allow workout/session inserts or
deletes to succeed while XP calls fail, creating exactly the inconsistency Batch
1 is intended to remove.

## 9. Risks, Rollback, and Fix-Forward

### Key risks

- Existing XP may already be inconsistent with workout history.
- Cached clients may continue using the generic RPC temporarily.
- Legacy offline payloads can be malformed or duplicated.
- Function privilege or `search_path` mistakes can recreate an authorization
  bypass.
- Concurrent completion/undo can deadlock or race without consistent locking.
- Duel code may not match the live database schema.
- Post-commit notification failures may be mistaken for transaction failures.
- Restricting workout table grants too early can break old clients.

### Rollback before permission revocation

The additive migration and new routes should coexist with the old client during
the compatibility window. If the new flow fails, route traffic can be reverted
to the previous application while the old RPC remains available. Do not remove
new ledger/operation data during rollback.

### Rollback after permission revocation

Avoid application rollback to a client that depends on the revoked RPC. Prefer
fix-forward. An emergency temporary re-grant would reopen the original XP
forgery risk and must require an explicit security decision, a short expiry, and
immediate follow-up revocation.

### Fix-forward controls

- Preserve operation IDs and ledger events through every deployment.
- Retry using the same operation ID.
- Correct functions/routes additively rather than rewriting committed history.
- Reconcile discrepancies with a separately reviewed, auditable repair job.
- Keep push delivery outside the transaction boundary.
- Delay restrictive grants until verification is complete.

## 10. Explicit Non-Goals

This batch does not include:

- Applying the prepared emergency Supabase migration during planning.
- Rewriting Git history.
- Changing Vercel environment variables or deployment settings.
- Reworking the XP formula or product economy beyond making it authoritative.
- Automatically rewriting historical XP without a dedicated reconciliation
  specification.
- Broad UI redesign, lint cleanup, or unrelated architecture refactoring.
