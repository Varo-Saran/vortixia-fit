# Push credential exposure — 2026-06-29

## Status

Confirmed. Credential and subscription material was committed to public Git
history. This remediation batch removes it from the current tree; history
rewriting and live credential rotation are deliberately pending separate review.

## Affected material

- A server-only VAPID private-key fallback.
- Real-looking web-push subscription endpoints and subscription keys.
- Debug logging that could disclose subscription endpoints or key-bearing
  database responses.

No credential values are recorded in this note.

## Batch 0 containment

- Removed unsafe one-off push test scripts.
- Removed hardcoded VAPID fallbacks from runtime code.
- Removed sensitive push subscription logging and key-bearing responses.
- Added a value-free `.env.example`.
- Added current-tree Gitleaks scanning with explicit web-push rules.

## Required operational follow-up

1. Rotate the VAPID key pair in every Vercel environment.
2. Redeploy because the public VAPID key is embedded at build time.
3. Ensure clients replace subscriptions created with the previous key.
4. Review retained deployment logs for subscription material.
5. Rewrite public Git history only in an approved follow-up batch.
6. After history remediation, change CI from directory scanning to full Git
   history scanning.

## Verification

- Run Gitleaks in directory mode with full output redaction.
- Confirm no hardcoded provider endpoints, subscription keys, or private-key
  fallbacks remain in the checked-out tree.
- Confirm push subscription requests and responses do not log endpoints or
  key-bearing payloads.
