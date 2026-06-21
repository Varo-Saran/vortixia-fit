# 4. Development Roadmap

This roadmap outlines the phases for building, testing, and deploying the fitness application from the ground up.

## Phase 1: Foundation & Minimum Viable Product (MVP)
**Duration:** Weeks 1-3
**Goal:** Establish the core infrastructure and allow users to log a basic workout.

- **Week 1: Setup & Architecture**
  - Initialize Web App project (Next.js/Vite) and setup UI component library (Tailwind CSS).
  - Setup Supabase project (Postgres DB) and connect to Vercel/GitHub for continuous deployment.
  - Implement Supabase Auth (Google/Apple) and session management.
- **Week 2: Database & Admin Capabilities**
  - Finalize and migrate the Supabase database schema with Row Level Security (RLS) policies.
  - Develop admin-only views to input the existing "Intermediate Gym Schedule v3" into the database.
  - Implement secure Edge Functions or RPCs for assigning routines.
- **Week 3: The Workout Logger**
  - Build the mobile-first Dashboard to display the assigned daily workout.
  - Develop the "Active Workout" UI with exercise cards, set logging, and the rest timer.
  - Implement offline-first syncing capabilities via Service Workers and local caching.
- **Milestone 1:** Users can log in, view their schedule, and successfully complete and save a workout.

## Phase 2: Analytics & Progressive Overload
**Duration:** Weeks 4-5
**Goal:** Make the app smart by utilizing historical data to guide the user.

- **Week 4: Data Aggregation**
  - Develop the backend logic to aggregate historical workout data (calculate volume, estimate 1RM).
  - Build the "Stats & History" mobile screens to display line charts and calendars.
- **Week 5: The Overload Engine**
  - Implement the Progressive Overload algorithm.
  - Update the Active Workout UI to display previous set data and suggest weight/rep increases dynamically.
- **Milestone 2:** The app actively coaches the user by recommending progression and visualizing their growth.

## Phase 3: Co-op Tracking & Leaderboards
**Duration:** Weeks 6-7
**Goal:** Introduce social features to increase retention and accountability.

- **Week 6: Social Connections**
  - Update schema to support friendships and connections.
  - Build UI for searching users, sending friend requests, and viewing buddy profiles.
  - Create the Activity Feed to broadcast workout completions.
- **Week 7: Gamification**
  - Implement the Fitness Score algorithm on the backend.
  - Build the real-time Leaderboard UI (Podium, Rankings, Global/Friends toggle).
  - Implement Push Notifications (e.g., "Your buddy just crushed leg day!").
- **Milestone 3:** Users can interact with friends and compete asynchronously.

## Phase 4: Polish, QA, & Launch
**Duration:** Week 8
**Goal:** Finalize the product for public release.

- **UI/UX Polish:** Ensure all transitions are smooth, dark mode is perfectly implemented, and accessibility standards are met.
- **Quality Assurance:** Conduct extensive manual testing simulating interrupted workouts, offline scenarios, and edge cases. Write automated unit and integration tests for critical API routes.
- **Deployment:**
  - Finalize PWA manifest and domain configuration.
  - Deploy production bundle to Vercel.
  - Validate SEO, performance scores, and mobile-browser compatibility.
- **Milestone 4:** Version 1.0 launched to the public!
