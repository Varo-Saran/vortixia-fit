# Batch 1B: Workout Client Cutover Plan

Status: Implementation plan only
Prepared: 2026-07-02
Scope: Online workout completion, offline queue version 2, legacy queue
conversion, idempotent replay, and client UX states

This document defines the client-side cutover to the server-authoritative
`POST /api/workouts/complete` boundary introduced in Batch 1A. It does not
authorize applying a database migration, changing deployment configuration, or
modifying application code.

## Goals and Non-Goals

Batch 1B will:

- Route online and offline workout completion through
  `POST /api/workouts/complete`.
- Give every logical workout one stable operation UUID.
- Stop the browser from directly inserting workout sessions or sets.
- Stop completion flows from calling `increment_user_xp` or updating database
  duel scores.
- Preserve completed workouts across network ambiguity, reloads, and retries.
- Preserve the current completion summary, trophy, recovery, local duel, and
  best-effort push experience without treating browser calculations as
  authoritative.

Batch 1B will not:

- Implement authoritative workout deletion or undo.
- Implement authoritative milestone or reward claims.
- Change the push route implementation.
- Apply the Batch 1A migration or the emergency restrictive migration.
- Reconcile existing XP or workout history.
- Revoke legacy database permissions.

## 1. Current Unsafe Online Completion Flow

The current online flow spans `src/app/workout/page.tsx` and
`src/store/useWorkoutStore.ts`.

`handleFinish` in the workout page currently:

1. Calculates total volume, completed-set count, duration, and XP in the
   browser.
2. Applies local duel progress, recovery fatigue, and trophy checks before the
   workout is known to be persisted.
3. Opens the success carousel immediately.
4. Calls `saveWorkoutToDb()`.

`saveWorkoutToDb()` then independently:

1. Reads the browser Supabase session and user ID.
2. Rebuilds the completed-set array.
3. Recalculates volume and XP.
4. Inserts one `workout_sessions` row.
5. Inserts `workout_sets` in a separate operation.
6. Calls `increment_user_xp` with the browser user ID and calculated XP.
7. Reads and directly updates active duel score columns.
8. Runs another trophy check.
9. Calls `/api/push/workout-complete` with browser-calculated XP.
10. Stores a browser-calculated completion summary.

These mutations are not transactional. A set insert may fail after the session
insert, XP may succeed after a set failure, duel updates may partially succeed,
and the success UI may remain visible after persistence failure. Most store
errors are logged and swallowed, so the page-level error handler cannot
reliably distinguish success from failure.

The finish button's `isSaving` state reduces ordinary double-clicks but does
not provide durable idempotency or protect against response loss, reloads, or
programmatic concurrent calls.

## 2. Current Unsafe Offline Replay Flow

When the browser is offline, `saveWorkoutToDb()` writes an unversioned entry to
the `unsynced_workouts` localStorage array. The entry contains:

- `startTime`
- `endTime`
- `totalVolume`
- `xpEarned`
- `durationMins`
- `completedSets`
- `routineName`

`src/components/GlobalListeners.tsx` replays the queue when the component
mounts and whenever the browser emits an `online` event. For each entry it:

1. Inserts a session using the stored user ID, timestamps, and total volume.
2. Inserts sets separately.
3. Calls `increment_user_xp` using the stored XP value.
4. Directly updates database duel scores.
5. Calls the push route with stored XP.
6. Removes the first queue entry.

The queue has no schema version or operation ID. Its XP and volume fields are
editable and trusted. A crash after any successful mutation but before dequeue
can duplicate the session and XP on retry. Set or XP errors are logged without
stopping the later mutations or dequeue. Replay also currently replaces stored
tracking types and units with `reps_weight` and `kg`.

Multiple sync triggers can overlap because there is no shared single-flight
lock. Dequeue uses array position rather than operation identity, so concurrent
queue changes can remove the wrong entry.

## 3. Client-Side Browser Mutations Batch 1B Will Remove

Batch 1B removes the following completion mutations:

| Location | Mutation to remove |
| --- | --- |
| `src/store/useWorkoutStore.ts` | Direct insert into `workout_sessions` |
| `src/store/useWorkoutStore.ts` | Direct insert into `workout_sets` |
| `src/store/useWorkoutStore.ts` | Completion call to `increment_user_xp` |
| `src/store/useWorkoutStore.ts` | Direct database duel score updates |
| `src/components/GlobalListeners.tsx` | Replay insert into `workout_sessions` |
| `src/components/GlobalListeners.tsx` | Replay insert into `workout_sets` |
| `src/components/GlobalListeners.tsx` | Replay call to `increment_user_xp` |
| `src/components/GlobalListeners.tsx` | Replay database duel score updates |

The direct workout-delete mutation and negative XP call in `src/app/page.tsx`
remain for the later undo batch. The milestone reward XP call in that file
remains for the later reward-claim batch. Consequently, the emergency
restrictive migration is not safe to apply after Batch 1B alone.

Browser volume, duration, set-count, and XP calculations may remain for
provisional presentation and local-only trophy/recovery behavior. They must not
be sent to `/api/workouts/complete` as authoritative inputs.

## 4. Required `operationId` and Idempotency Design

Every logical workout receives one UUID that remains stable for its full
lifecycle.

### Creation and persistence

- Generate `operationId` using `crypto.randomUUID()` when `startWorkout`
  creates a new workout.
- Persist it with the existing `vortixia-workout-storage` Zustand state.
- Never generate a replacement merely because a request failed or timed out.
- Clear it only when the workout is deliberately reset, discarded, or replaced
  by a new workout.
- For a persisted active workout created by an older client, generate one UUID
  on the first completion attempt and persist it before any request or queue
  write.
- If `crypto.randomUUID()` is unavailable, use a UUID-v4 implementation backed
  by `crypto.getRandomValues`; do not use `Math.random()` for operation IDs.

### Submission behavior

- The same operation ID is used for the online request, any fallback queue
  entry, and every replay attempt.
- A response timeout is treated as an unknown commit result, not proof of
  failure. The same request is queued or retried with the same ID.
- A `200` idempotent replay and a `201` fresh commit are both successful
  completion results.
- A `409` operation/payload mismatch is terminal. The client must not generate
  a new ID and resubmit the same workout because that could create a duplicate.
- A client single-flight promise prevents two completion calls for the active
  operation. Database idempotency remains the authoritative control.

### Local side effects

Trophy, recovery, and local visual duel updates must be marked as handled for
the operation so that a reload or idempotent server response does not apply
them twice. This marker is local UX state, not an authorization boundary.

## 5. Queue Version 2 Schema

Queue-v2 entries use a new `unsynced_workouts_v2` localStorage key and this
shape:

```ts
interface OfflineWorkoutQueueV2 {
  schemaVersion: 2;
  operationId: string;
  startTime: string;
  endTime: string;
  routineName: string;
  sets: Array<{
    exerciseName: string;
    setNumber: number;
    weight: number;
    reps: number;
    weightUnit: 'kg' | 'lbs' | 'plates' | 'unitless';
    trackingType:
      | 'reps_weight'
      | 'time_weight'
      | 'time_only'
      | 'cardio_hr'
      | 'reps_only';
    isWarmup: boolean;
  }>;
  queuedAt: string;
  attemptCount: number;
  lastAttemptAt?: string;
}
```

Queue-v2 entries must not contain:

- User IDs
- `xpEarned` or another XP amount
- `totalVolume` or authoritative duration totals
- Total user XP
- Duel score deltas
- Session IDs chosen by the client

`sets` contains only completed sets. Queue writes deduplicate by operation ID.
The queue is replaced atomically with one `localStorage.setItem` call after the
new array is fully constructed in memory.

The separate key is an intentional rollback boundary. The current legacy
client reads only `unsynced_workouts`; it must not attempt to process a v2 item
whose field names and trust model are different.

## 6. Legacy Queue Conversion Strategy

Unversioned entries are treated as queue version 1.

For each legacy entry:

1. Validate that timestamps, routine context, and `completedSets` can be
   converted to the new request contract.
2. Generate an operation UUID only if the entry does not already have one, then
   persist that UUID back into the legacy `unsynced_workouts` entry before any
   other write.
3. Map `completedSets` to queue-v2 `sets`.
4. Preserve valid `weightUnit`, `trackingType`, and warm-up values.
5. Apply the route's documented defaults where legacy optional metadata is
   absent.
6. Ignore and drop legacy `xpEarned`, `totalVolume`, and `durationMins`.
7. Deduplicate and persist the converted entry in `unsynced_workouts_v2`.
8. Remove only the matching legacy entry after the v2 write succeeds.

Persisting the UUID into the legacy item before transferring it makes the
cross-key conversion crash-safe. A crash before the v2 write retries conversion
with the same UUID. A crash after the v2 write but before legacy removal finds
the existing v2 operation, deduplicates it, and then removes the legacy copy.
The network request starts only after conversion is durable. If the browser
later crashes after the server commits, replay uses the same operation ID and
receives the original result instead of creating another workout.

Malformed legacy entries must not loop forever or be silently discarded. Move
them to a separate local quarantine collection with a generic reason category
and show a recoverable user notice. Do not log raw workout payloads. A payload
conflict returned by the server is also quarantined rather than assigned a new
operation ID.

## 7. Online Completion Behavior

The online flow becomes:

1. Disable the finish control and enter the saving state.
2. Ensure the active workout has a persisted operation ID.
3. Build raw completed sets from workout state.
4. Send only `operationId`, timestamps, routine name, and raw sets to
   `POST /api/workouts/complete`.
5. Validate the response structure.
6. On `201`, accept the server values as a fresh authoritative commit.
7. On `200`, accept the server values as an idempotent replay.
8. Populate `lastWorkoutSummary` from server-returned set count, volume,
   duration, XP award, and total XP.
9. Apply local UX effects at most once for the operation.
10. Show the success summary and allow navigation.

No client code may fall back to direct table inserts or `increment_user_xp`.

Network failures, `5xx` responses, authentication interruption, or an explicit
`retryable: true` response preserve the same operation as queue-v2. The user
sees a pending-sync result rather than losing the workout. A terminal request
validation error leaves the active workout recoverable and does not show a
committed success state.

## 8. Offline Completion Behavior

When `navigator.onLine` is false:

1. Ensure and persist the operation ID.
2. Construct a queue-v2 entry from raw completed sets.
3. Deduplicate the queue by operation ID and persist it.
4. Store a provisional local summary for immediate presentation.
5. Apply local-only trophy, fatigue, and visual duel effects once.
6. Show the existing success experience with a clear pending-sync state.

Client-calculated volume and XP may be displayed as provisional estimates but
are not stored in the authoritative queue payload. The eventual server response
replaces the provisional `lastWorkoutSummary` values.

## 9. Replay Behavior and Single-Flight Lock

Offline replay is centralized in a shared client helper and protected by a
module-level single-flight promise. Mount and `online` event triggers reuse the
same promise instead of starting overlapping loops.

For each queue item:

1. Inspect and crash-safely transfer legacy `unsynced_workouts` entries into
   `unsynced_workouts_v2`.
2. Reload the current v2 queue before processing.
3. Submit the queue-v2 payload to `/api/workouts/complete`.
4. For a valid `200` or `201`, update local authoritative summary/profile
   state and remove only the matching operation ID.
5. For an authentication or retryable failure, increment safe retry metadata,
   retain the item, and stop the loop.
6. For terminal validation or payload conflict, quarantine that item and
   continue with later valid entries.
7. Re-read the queue after each mutation so newly queued workouts are not lost.

The queue must never be dequeued based only on its original array index. A
crash after server commit but before dequeue is safe because the next request
uses the same operation ID.

## 10. UX States

### Committed

- Triggered by a validated `200` or `201` response.
- Uses server-returned summary and XP values.
- Allows the user to close the summary.
- Refreshes relevant profile/history state.

### Queued

- Used for intentional offline completion or an ambiguous retryable online
  failure that has been durably saved.
- Shows the success summary with a pending-sync notice.
- Allows navigation because the queue entry is durable.

### Retryable failure

- Covers network errors, transient server errors, temporary authentication
  interruption, and explicit retryable responses.
- Retains the same operation ID and queue item.
- Shows a non-destructive retry/pending message.
- Never falls back to direct database mutation.

### Terminal validation failure

- Covers malformed or out-of-bounds requests and operation/payload conflicts.
- Does not claim that the workout committed.
- Keeps a new online workout recoverable for correction.
- Quarantines an unrecoverable legacy queue entry with a user-visible notice.
- Never retries under a new operation ID automatically.

## 11. Push Behavior Boundary

The existing `/api/push/workout-complete` route is unchanged in Batch 1B.

- Call it only after `/api/workouts/complete` returns a fresh commit with
  `replayed: false`.
- Use the server-returned `xpAwarded`; never use stored or recalculated queue
  XP.
- Do not call it when the completion response has `replayed: true`.
- Treat push failure as non-fatal and never roll back or requeue a committed
  workout because notification delivery failed.
- Do not log the workout payload or sensitive push data.

This provides best-effort notification behavior. A crash after database commit
but before push delivery can miss a notification because the later idempotent
replay must not send a duplicate. A durable server outbox is a separate future
improvement.

## 12. Migration and Deployment Boundary

The Batch 1A migration
`20260630170000_batch_1a_workout_authority_foundation.sql` must be applied and
verified before deploying the Batch 1B client. Until then, the route exists but
its database function and supporting tables do not exist in the live database.

Required order:

1. Review the Batch 1A SQL again against current live schema metadata.
2. Apply the additive Batch 1A migration in a controlled window.
3. Verify function permissions, authenticated `auth.uid()` behavior,
   transaction rollback, canonical replay, and XP ledger writes.
4. Deploy Batch 1B to Preview and test online, offline, ambiguous-response, and
   legacy-conversion paths.
5. Deploy Batch 1B to Production and monitor completion and replay results.
6. Confirm the two completion-related `increment_user_xp` calls and all direct
   workout inserts are gone from shipped client code.

Do not apply the emergency restrictive migration after this cutover. The
workout-delete and milestone-reward browser calls still require replacement by
their server-authoritative batches. Cached older clients also require a planned
permission transition.

## 13. Rollback and Fix-Forward Plan

### Client rollback

- Roll back to the previous client deployment if the new queue or completion
  path has a widespread UI defect.
- Legacy workout and XP permissions remain available because the emergency
  migration is intentionally unapplied.
- The Batch 1A database objects are additive and may remain during client
  rollback.

### Data preservation

- Do not delete `unsynced_workouts_v2` entries during rollback.
- Queue-v2 entries contain enough raw data to retry after a fix-forward deploy.
- The previous client reads only the legacy `unsynced_workouts` key, so it does
  not rewrite, partially insert, or discard v2 entries.
- A fix-forward Batch 1B deployment resumes the preserved v2 queue.

### Fix-forward

- Correct validation or queue parsing without changing existing operation IDs.
- Never repair a retry by assigning a new operation ID.
- Re-submit retained queue entries after the fixed deployment.
- Use the XP event ledger and operation table to diagnose outcomes without
  logging full workout payloads.

## 14. Verification Checklist

### Static validation

- [ ] `rg "increment_user_xp" src` shows no completion or replay call sites.
- [ ] Browser code no longer inserts `workout_sessions` or `workout_sets`.
- [ ] Completion/replay code no longer directly updates database duel scores.
- [ ] Completion requests contain no user ID, XP, total volume, or duel delta.
- [ ] TypeScript passes.
- [ ] Targeted ESLint passes for changed files.
- [ ] `npm run build` passes.
- [ ] `git diff --check` passes.
- [ ] Clean current-tree Gitleaks scan passes.

### Online behavior

- [ ] A fresh online completion returns `201` and one authoritative result.
- [ ] Repeating the same request returns `200` with `replayed: true`.
- [ ] One operation creates one session, its sets, one XP event, and one XP
      update.
- [ ] A response timeout followed by retry does not duplicate data or XP.
- [ ] Two concurrent finish attempts result in one server operation.
- [ ] A terminal validation error does not show committed success.
- [ ] The success summary uses server values after commit.

### Offline and legacy behavior

- [ ] A new offline completion writes one `unsynced_workouts_v2` entry.
- [ ] Queue-v2 contains no XP, volume, user ID, or duel delta.
- [ ] Repeated queue writes deduplicate by operation ID.
- [ ] Foreground replay has a single active worker.
- [ ] A successful item is removed by operation ID only.
- [ ] A crash after commit but before dequeue replays without duplication.
- [ ] A legacy entry is converted and persisted before its first request.
- [ ] A crash at each cross-key conversion step preserves one stable operation
      ID and produces no duplicate v2 entry.
- [ ] The previous client ignores the v2 storage key during rollback.
- [ ] Edited legacy XP/volume fields do not affect the server award.
- [ ] Tracking type and weight unit survive conversion.
- [ ] Malformed entries are quarantined rather than looped or discarded.

### UX and post-commit behavior

- [ ] Committed, queued, retryable, and terminal states are distinguishable.
- [ ] Offline completion remains immediately usable and clearly pending sync.
- [ ] Trophy, recovery, and local duel effects apply at most once per
      operation.
- [ ] Push runs only for `replayed: false` using server-returned XP.
- [ ] Push is not sent for an idempotent replay.
- [ ] Push failure does not change the committed workout result.
- [ ] Logs contain no raw set payloads, user IDs, tokens, or SQL details.

### Deployment gates

- [ ] Batch 1A migration is applied and verified before Batch 1B deployment.
- [ ] Preview online and offline smoke tests pass.
- [ ] Production monitoring can distinguish fresh commits, replays,
      validation failures, authentication failures, and retryable failures.
- [ ] Emergency restrictive migration remains unapplied.
- [ ] Workout undo and reward claim remain tracked as required follow-up work.

## 15. Exact Files Likely to Change During Implementation

The smallest safe Batch 1B implementation PR should be limited to:

1. `src/lib/workout-completion-client.ts` — new request, response, queue-v2,
   legacy-conversion, and single-flight replay helper.
2. `src/store/useWorkoutStore.ts` — persisted operation ID, online cutover,
   durable queue fallback, and authoritative summary state.
3. `src/components/GlobalListeners.tsx` — replace direct offline mutations with
   the shared replay helper.
4. `src/app/workout/page.tsx` — committed/queued/error UX ordering and
   operation-scoped local effects.

The implementation should not require changes to:

- `src/app/api/workouts/complete/route.ts`
- `src/lib/workout-authority.ts`
- `src/components/SuccessCarousel.tsx`
- Any push route
- Any Supabase migration
- Vercel or environment configuration
