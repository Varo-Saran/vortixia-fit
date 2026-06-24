# Future Recommendation Engine for Social Discovery

As the user base expands beyond the initial testing cohort, the "Recommended Athletes" feed will need to scale from a simple query into an intelligent matching algorithm.

## Current Limitations
Currently, `api/search/route.ts` falls back to querying the top 50 users by `total_xp` (excluding the logged-in user). This guarantees the dashboard never feels empty, but it's not personalized.

## Proposed Recommendation Parameters

### 1. Goal Alignment
Users who share the same primary goal (`user_metrics.goal`) are more likely to want to connect.
- **Match Priority:** High
- **Logic:** Add a `.eq('goal', currentUser.goal)` weight to the query. A user focused on "Powerlifting" shouldn't constantly see "Marathon" athletes in their recommendations.

### 2. Activity Level & Consistency (Discipline Score)
Matching users with similar workout volumes or consistency (Discipline Scores) ensures they can motivate each other effectively.
- **Match Priority:** Medium
- **Logic:** Compare trailing 30-day session volume or the computed discipline score.

### 3. Timezone / Location Proximity
Finding partners who work out at similar times is crucial for real-time engagement and active duels.
- **Match Priority:** Low (for now, higher later)
- **Logic:** Filter by `timezone` or approximate geolocation.

## Implementation Blueprint
1. **DB Function:** Create a `match_athletes(user_id, limit)` Postgres function via Supabase RPC to handle the heavy lifting and scoring logic at the database layer.
2. **Scoring Weight:**
   ```sql
   total_score = (goal_match * 0.5) + (activity_match * 0.3) + (timezone_match * 0.2)
   ```
3. **Frontend:** Keep the UI identical, just point the empty-query `/api/search` route to invoke the new RPC function.
