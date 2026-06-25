# Dashboard & Feature Integration Bug Tracker

This tracker monitors progress across our two-phase systematic resolution plan.

---

## 🚀 Phase 1: Core Architecture & Sync Security [COMPLETE]

- [x] Fix the offline sync try/catch loop in `GlobalListeners.tsx` to prevent duplicate database writes and infinite XP exploits.
- [x] Add Zustand persistence middleware to `useWorkoutStore.ts` to survive page reloads and process kills.
- [x] Implement database write sync for active duel scores inside `saveWorkoutToDb`.
- [x] Replace the static "Start Workout" dashboard tile link with a dynamic click handler that launches today's target plan.
- [x] Add Supabase database write syncing in the routine store for logged-in user custom split edits.
- [x] Implement the `fetchFriends` action in `useFriendsStore.ts` to power the live "Online Friends" dashboard widget.
- [x] Fix the `MuscleMapCanvas` to bind `heroGender` and correctly map the missing gluteal heat-map colors.

---

## ⏳ Phase 2: UX Polish, Optimization & Hydration Guardrails [COMPLETE]

- [x] Unify the duplicated Rest Timer tick loops, link it to Zustand, and float the overlay globally in `layout.tsx`.
- [x] Eliminate strict 401 API authentication blocks from the local deterministic AI Routine Generator route for guest users.
- [x] Wrap dashboard and recovery readiness score displays in mounted/useEffect checks to prevent SSR Hydration Mismatch warnings.
- [x] Update the dashboard recovery recommendation logic to accurately evaluate general CNS fatigue when individual muscles aren't heavily damaged.
- [x] Remove the dead tooltip code and enable pointer-events on the `MuscleMapCanvas` widget container.
- [x] Code the dynamic progress bar width calculations for active duels cards and fix the unique ID filter for friend completion counts.
- [x] Add the URL limit parameter to the recommendedAthletes API search query to stop over-fetching user profiles.
