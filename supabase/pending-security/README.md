# Pending Security Migrations

Files in this folder are intentionally deferred security migrations. They are outside the active Supabase CLI migration chain and must not be applied casually.

Before promoting a deferred migration, verify that all documented prerequisites have passed and create a new timestamped migration in `supabase/migrations`. Do not move the old timestamped file back into the active migration directory.

The current prerequisite is that workout completion, workout undo, and reward flows must be server-authoritative before restrictive database permissions are applied.
