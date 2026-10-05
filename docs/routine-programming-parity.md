# D2D-B programming contract

Every materialized occurrence has `cardioZone: 1 | 2 | 3 | 4 | 5 | null`.
Database reload maps `cardio_zone` directly; structured null means None, not a
request to infer intensity. All current-client RPC and export serializers include
the field, including null. Saves and replacements retain the D2B coordinator and
the authoritative `save_active_routine_v1` boundary.

Legacy input normalization alone can infer an absent field. Its reviewed identity
allowlist and strict numeric-token semantics match D2D-A. Present null suppresses
inference; invalid present values reject. Notes and prescriptions are not rewritten.
The editor identifies legacy Zone notes as original source wording and identifies
the separate Intensity control as the current setting.

## Shared programming

`routine-programming.ts` owns defaults, options, structural validation and tracking
transitions. `OccurrenceProgrammingEditor` renders the same controlled fields for
Add (`pendingAdd`) and Edit (D2B `editorBuffers`). Disclosure is view state only.

Catalog declarations establish known safe choices, not an invented capability list.
An existing structurally valid historical pair is an exact allowance for that one
occurrence and exercise identity. It cannot authorize cross-products or other
occurrences. Trusted reload refreshes those allowances. Undeclared imported records
require explicit configuration using the five existing modes and four existing units.

Tracking and unit commit atomically. A non-weighted-to-weighted transition requires
a compatible unit and stays buffered until complete. Save, Done and editor switches
are blocked while invalid. Non-weighted modes store unitless and hide Load Unit.
Unit changes affect future logging metadata only; no logged-load conversion occurs.

New canonical cardio defaults to one round. Existing counts are preserved. Intensity
is independent of tracking, rest and prescription. Rest inheritance/presets/custom
limits remain unchanged. Custom templates retain storage version 1 and normalize
additively. Workout storage version 4 adds a Zone snapshot and preserves existing
session/rest/completion metadata; missing or malformed legacy Zones become null.

## Rollout and later visual handoff

D2D-A already supplies the schema/RPC contract. This phase adds no migration and
does not retire absent-key backend fallback. A stale old client can still rederive
Zone after a newer client explicitly clears it if legacy text remains. Fallback
retirement requires a separately reviewed rollout; new clients must always send null.

Later visual previews should cover compact/expanded strength and cardio, both Add
drawers, Zone/Tracking/Load Unit menus, invalid buffers, mobile and desktop.
Visual changes may refine component layout and classes, but must not alter domain
options, buffers, persistence, store migration, snapshots, security or validators.
Keep one active editor, custom Select semantics, focus/error handling and explicit Save.

Manual notes, section conversion, replacement, interval redesign and SQL LF policy
remain separate work. No Antigravity work is included in this phase.
