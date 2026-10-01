# D2D-A: structured cardio Zone persistence foundation

This change is a database/RPC foundation only. It does not change the deployed
RoutinePlan, editor UI, template source, routine serializer or workout snapshot.
Do not apply it to Production without a separately authorized deployment.

## Contract

`planned_exercises.cardio_zone` is nullable `smallint` with a 1–5 CHECK and no
non-NULL default. It belongs to an occurrence, not the canonical exercise.

The existing `save_active_routine_v1(p_routine jsonb)` signature stays unchanged.
The future occurrence payload key is **camel-case `cardioZone`**; all existing
snake-case payload keys remain unchanged.

| Payload | Persistence |
| --- | --- |
| Key present, integer 1–5 | Exact structured value; ignores legacy Zone text |
| Key present, null | NULL / None; no text fallback for this request |
| Key absent | Reviewed-ID exact-token compatibility fallback, otherwise NULL |
| Other JSON type, fractional or out-of-range number | Validation error before DML |

The compatibility fallback deliberately does not preserve an unrelated stored
value when the submitted old payload contains no explicit Zone. This is the
approved absent-key contract. D2D-B rollout must account for older open clients:
an old-client save can re-derive Zone from unchanged legacy notes after a newer
client cleared it. Do not claim explicit None survives an unrelated subsequent
old-client payload. The new client must always send the structured key, including
null, and its display must not fall back when the key is explicitly null.

## Bounded legacy extraction and backfill

One internal SQL helper owns the reviewed allowlist shared by backfill and RPC:

| Canonical ID | Resolved identity | Canonical classification |
| --- | --- | --- |
| `9001` | Walking (Treadmill or Outdoor) | bodyPart=cardio |
| `9003` | Stationary Bike | bodyPart=cardio |
| `3666` | Incline Treadmill Walk | bodyPart=cardio |
| `2141` | Elliptical | bodyPart=cardio |

These imported records have no movementType override. Their canonical cardio
category and actual built-in single/default/alternative references were reviewed.
Other cardio identities are intentionally outside this legacy allowlist until
reviewed. No exercise-name, equipment or tracking-mode heuristics are used.

Sources: DB `target_reps` and `note`, equivalent to RPC `target_value` and `note`.
Only explicit whole-word, whitespace-separated Zone 1–5 tokens qualify,
case-insensitively. Repeated identical tokens are unambiguous. Conflicting Zones,
unsupported numeric Zones, decimal Zones and ranges remain NULL. No inference
from easy/aerobic/recovery/RPE language. Non-reviewed IDs always return NULL.

The migration updates **only cardio_zone** on qualifying NULL rows. IDs, notes,
timestamps, order, rest, target and all other programming remain unchanged. It is
transactional and one-shot; do not rerun backfill after new clients can clear Zone.
The existing RPC's normal authenticated atomic child replacement is preserved;
the migration itself never executes that routine-save operation or resets data.

The helper is SECURITY INVOKER with pg_catalog-only search_path, and has no
PUBLIC/anon/authenticated EXECUTE. Existing table ACL/RLS and routine RPC
ownership/signature/EXECUTE grants are retained, not broadened.

## Existing immutable template Zone inventory

PPL and Bro: no occurrence Zone tokens. Intermediate: **10** occurrences;
five Zone 1 and five Zone 2. Counts remain 17 / 5 / 64.

| Day / section | Default canonical ID | Explicit Zone |
| --- | --- | --- |
| Monday main | 9003 | 2 |
| Tuesday warm-up | 9003 | 1 |
| Tuesday main | 9003 | 2 |
| Wednesday main | 3666 | 2 |
| Thursday warm-up | 9003 | 1 |
| Thursday main | 9003 | 2 |
| Friday warm-up | 2141 | 1 |
| Friday main | 9003 | 2 |
| Saturday recovery | 9001 | 1 |
| Saturday recovery | 9003 | 1 |

Monday's incline-walk warm-up has no explicit Zone and must remain unspecified.
Template notes remain intact; D2D-B can add structured programming separately.

## Disposable validation

Run `npm run validate:cardio-zone-foundation` with Docker available. The validator
creates and owns a fresh PostgreSQL 17.6 container, exposes no ports, has no
container network and accepts no database URL/project ref. It removes only its
own labelled disposable container. It never loads Production credentials/data.

An optional `CARDIO_ZONE_PGLITE_MODULE` environment variable may point to a local
PGlite module installed outside the app. This runs the actual PostgreSQL WASM
engine in disposable memory, not a JavaScript SQL mock. Dependencies are not
added to the app or lockfile. The fixture reproduces routine schema, Supabase
roles/auth.uid ownership, RLS and grants; it is not a full Auth/PostgREST server.

Both engines execute the actual D1 SQL on an empty fixture, current application
serialization, the actual new migration and RPC. Tests cover 64-occurrence graph
preservation, synthetic backfill cases, 1–5/null roundtrips, strict input
rejection, ownership/grants, late RPC failure and injected failures after each
migration stage. A full native Supabase/PostgREST staging deployment should also
be exercised before any eventual Production authorization.

## D2D-B (recorded, not implemented)

- Add required RoutinePlan occurrence field `cardioZone: 1 | 2 | 3 | 4 | 5 | null`.
- Extend row select/mapping, RPC serializer, validation and draft projection.
- Add structured template programming without changing counts/identities/notes.
- Copy Zone into `WorkoutExercise` at `startWorkout`, like restSeconds, as a
  primitive session snapshot; never subscribe a running workout to routine edits.
  Existing hydrated workout snapshots without this future field should normalize
  to null, not fetch a newer Zone from the current routine.
- Share Add/Edit controls for Zone, tracking, compatible load unit and rest.
- Tracking policy: catalog restrictions/defaults, reviewed per-ID/context
  compatibility, preserve valid existing configuration, then explicit structurally
  valid user configuration for undeclared imported records. No name heuristics.
- Weighted reps/time require compatible load unit. Reps-only, time-only and
  cardio/HR remain internally unitless; hide irrelevant Load Unit UI.
- Routine units are exactly kg, lbs, plates, unitless. Catalog units are kg, lb,
  plates, unitless; translate lb to lbs. Do not hardcode just kg/lbs.
- Cardio Add defaults to one continuous round unless canonical programming says
  otherwise. Rest controls retain identical Add/Edit semantics.
- Manual Programming Notes are a later feature. Section conversion and exercise
  replacement remain deferred. No destructive routine reset is expected.
