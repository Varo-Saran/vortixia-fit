# 1. Requirements & Features Specification

## 1.1 User Requirements
- **User Authentication**: Users can sign up and securely log in using OAuth (Google, Apple, etc.) or standard credentials.
- **Schedules & Routines**: Users have direct access to their assigned schedules (e.g., the 5-day Intermediate PPL split).
- **Workout Tracking**: Users can log their active workouts, including exercises, sets, reps, and weights used.
- **Progressive Overload**: The app tracks historical data and actively prompts users to increase weight or reps to ensure continuous progress.
- **Co-op Tracking & Social**: Users can track workout completion alongside friends or workout partners (buddy system) to maintain accountability.
- **Stats & Analytics**: Users can view performance metrics including workout streaks, total volume lifted, personal records (PRs), and weekly completion rates.
- **Leaderboard**: A competitive leaderboard based on consistency, volume, and PRs, filterable globally or among friends.
- **Admin Capabilities**: An admin user (the creator/coach) can edit and update their own routine templates, and assign or modify routines for other users dynamically.

## 1.2 System Requirements
- **Platform**: Progressive Web Application (PWA) / Web App designed with a strict mobile-first philosophy.
- **Performance**: Near-instant load times using modern web rendering (e.g., SSR/SSG). Offline capabilities via Service Workers to log sets without connectivity.
- **Security**: Secure, encrypted storage of user data, utilizing Supabase Row Level Security (RLS).
- **Scalability**: Serverless Edge architecture (Vercel & Supabase Edge Functions) capable of handling simultaneous real-time social updates.

## 1.3 Functional Requirements
- **Authentication Module**: Integration of OAuth 2.0 flows.
- **Workout Player**: An interactive UI for active workout sessions featuring a built-in rest timer (mimicking the existing HTML template), exercise checklist, and inline display of previous session stats.
- **Admin Dashboard**: A secure interface for the admin to construct routine templates, manage user profiles, and assign specific workout regimens to user IDs.
- **Social Module**: A backend system to handle friend connections, broadcast completed workouts to a feed, and calculate real-time leaderboard rankings.
- **Analytics Engine**: Automated calculation of weekly volume, 1RM (One Rep Max) estimations, heart rate zone guidance, and streak maintenance.

## 1.4 Non-Functional Requirements
- **Usability (UX)**: The interface must be operable with one hand and feature large touch targets, as users will be interacting with it during intense physical activity.
- **Aesthetics**: Premium, modern UI featuring vibrant accents, glassmorphism, and a robust dark mode, heavily inspired by the existing `intermediate_gym_schedule_v3.html` template.
- **Reliability**: Zero data loss guarantee for workout logs. If the app is force-closed mid-workout, the session state must be preserved.
- **Maintainability**: The codebase must adhere to clean architecture principles with modular components for easy feature expansion.
