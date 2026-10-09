# D2E-A: local-only compatibility foundation

Do not push/deploy this foundation independently. D2E-B must integrate all page
and recovery controls, followed by A+B authenticated Preview QA. No historical
Production row is repaired by this code.

## Read versus write

`loadActiveRoutine` now returns a typed result: empty, valid, needs_attention,
or fatal. The read DTO stores unknown programming in `fields`, not current enums.
Its identities/relationships and seven-weekday structure are verified. No rows
are discarded or fresh graph identities generated while loading.

The owner-scoped embedded read obtains one coherent graph per request. Exact
independent counts detect row caps; a matching second graph read detects source
drift across those checks. Failed/missing counts, session changes, malformed
responses and unmatched relationships fail closed. This is not server-side
compare-and-swap or protection against a later concurrent Save.

Source snapshots preserve the original explicit row projection, timestamps and
relationships, deeply detached/frozen, with SHA-256 evidence and private subject/
generation binding. Never log, publish or include snapshots in PR bodies.

`promoteRoutineForWrite` checks compatibility, relationships, then invokes the
unchanged strict validator. Save preparation runs only at the write boundary,
not to decide whether rows are readable. The read DTO has no RPC
serializer. Existing serializers still emit cardioZone, including null.

Registered read rules: weekday representation, equivalent lb/lbs unit vocabulary,
unique order gaps with an unambiguous sequence, and the existing reviewed absent-
Zone extraction at the legacy-input boundary only. No natural-language, name,
equipment, unit/default or tracking inference is permitted. Explicit null Zone
never falls back. Original snapshot evidence is never normalized.

## Store integration contract for D2E-B

Valid routines keep the existing `routine`/baseline/buffer lane. Recoverable
routines occupy `readGraph`/`readBaseline` instead; `routine` is null. There is
only one editable lane. This avoids leaking unknown values to unadapted pages.

Issues are sidecar data, addressed by day/occurrence identity. Loading a
recoverable graph is Saved/not dirty, even with blocking issues. Explicit
correction marks dirty; exact source revert or Discard restores the original
graph and issues. No invalid editor buffers are manufactured by loading.

Foundation correction support intentionally covers tracking/unit configurations.
`setRecoveryTrackingConfig` reuses strict programming validation. Existing
null-catalog occurrences may explicitly select a structurally valid pair; this
does not change ordinary Add or catalog restrictions. No unit is preselected.
`revertRecoveryOccurrence` restores exact source evidence, not a save exception.

Resolved recovery stays in needs_attention until successful strict Save.
`routineCapabilities` exposes Save eligibility when all issues are resolved and
changes exist, but blocks workout start and Add until successful persistence.
Recovery Apply/Reset remain unavailable until D2E-B implements safe backup and
confirmation. Saves use the existing single-flight/authoritative RPC path.

On successful Save, source evidence is invalidated; re-read before claiming a
fresh persisted backup/fingerprint. Failed Saves preserve corrections and the
original immutable source. Subject changes clear owner-bound memory; late load
and save responses must not install another account's data.

D2E-B still owns: safe read-DTO presentation, remaining issue-field correction
controls, Home/error messaging, non-empty workout-launch fallback, private backup
format/UI, explicit replacement confirmation and source-aware guard integration.
Do not bypass current replacement guards to make recovery actions reachable.

## Deferred backend closure

The live RPC/table enum checks do not yet enforce the cross-field tracking/unit
invariant. The compatibility validator memorializes this debt; D2E-D must update
that assertion when separately reviewed enforcement lands. No SQL/RLS/grant
change belongs here. Before enforcement, inspect all active/inactive rows, resolve
ambiguous intent explicitly, and deploy recovery frontend first.

RPC per-day limit is 200; existing client Add limit is 1,000. Align the client
downward in D2E-B or separately approved hardening. Never relax the server limit.

Any targeted affected-user repair needs private backup, explicit intended units,
exact old-value predicates, disposable staging and separate Production approval.
Full graph RPC Save recreates child rows/timestamps; a tightly scoped trusted
transaction is preferable when original timestamps must remain unchanged.

Windows migration LF/CRLF policy is separate repository hygiene. Do not include
the existing migration stat marker or private/local files in this commit.
