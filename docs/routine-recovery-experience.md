# D2E-B: recovery experience (local A+B release gate)

D2E-A and D2E-B must ship together after integrated Preview QA. Neither phase
authorizes Production data repair. D2E-C/D2E-D remain separate approvals.

## Read and edit lanes

`needs_attention` remains a `RoutineReadGraph`, never a manufactured strict
`RoutinePlan`. The existing Hybrid day/occurrence cards render saved values;
only supported tracking/unit issues receive the shared `TrackingControls`.
Missing catalog identities do not trigger name resolution. Weighted legacy
unitless pairs display a unit placeholder and require explicit kg/lbs/plates
or an explicit valid tracking correction. Other issues retain raw evidence and
offer private backup, replacement, or support, rather than generic raw editors.

Opening cards is not dirty. Actual incomplete choices use D2B buffers; Done
cannot bypass them. Discard/Restore original settings restores the recoverable
baseline, including its issues. Add remains unavailable until persisted recovery.

## Authority and verification

Recovery Save promotes through the existing strict validators and serializer,
uses `save_active_routine_v1`, then re-reads through the verified loader before
installing `ready`. Workout capability stays false until this verification.
Normal valid-routine revision/single-flight behavior is retained. Existing active
workout snapshots and completion summaries do not depend on routine readiness.

Recovery replacement (built-in/custom template, Reset, Import, AI) extends the
same confirmation bridge. Approval binds subject, source generation/fingerprint,
draft revision/projection and replacement fingerprint. A verified source re-read
checks remote drift immediately before the shared mutation flight. Cancel/stale
approval performs no write. Backup is strongly offered but not forced. Failed RPC
retains the original snapshot and draft. Accepted RPC plus failed verification
requires Reload, not a second write. This preflight is not server-side CAS;
authoritative concurrency closure remains future backend work.

## Private recovery backup

`vortixia-private-routine-recovery`, version 1, is detached/frozen source evidence:
original owner-scoped rows, IDs/relationships/timestamps, source metadata and SHA.
It is explicitly private, distinct from Share/Export, validated without current
write validation, and refused by normal Import. Auth/session secrets are not
selected or included. Fatal states without proven complete graph trust cannot
offer destructive replacement or backup; Retry/support remains available.

## Capacity

The shared client/write validator ceiling is now 200 occurrences/day, matching
the existing RPC. Historical larger graphs remain recoverable and are never
truncated. No server limit, migration, template content, security policy,
workout authority, XP or CNS behavior changed.

## Testing

`validate:routine-compatibility` exercises the foundation corpus and actual store.
`validate:routine-recovery` adds confirmation/cancel/drift/subject/concurrency,
strict Save/reread, backup separation, capacity and actual shared UI rendering.
Local browser QA uses synthetic IO with remote connections denied. Production
repair requires a separate private backup, explicit intended values, staging
and Production authorization.
