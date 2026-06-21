# 3. User Flows & UX Design

## 3.1 User Flow Diagrams

### Core App Navigation Flow
```mermaid
flowchart TD
    Start((Launch App)) --> Auth{Is Authenticated?}
    Auth -->|No| Login[Premium Image-Driven Login]
    Login --> OAuth[OAuth Provider (Google/Apple)]
    OAuth --> Dashboard
    Auth -->|Yes| Dashboard[Main Dashboard / Hero]
    
    Dashboard --> Workout[Start Workout Session]
    Dashboard --> Recovery[Visual Recovery Tracker]
    Dashboard --> Social[Gamification: Duels & XP]
    Dashboard --> Logs[History & Calendar]
    
    Workout --> Active[Active Workout Logger]
    Active --> LogSet[Log Sets/Reps/Weight]
    LogSet --> RestTimer[Trigger Rest Timer]
    RestTimer --> Active
    Active --> Finish[Finish & Save Session]
    Finish --> Summary[Post-Workout Celebration & XP Award]
    Summary --> Dashboard
```

## 3.2 Design System & Aesthetics
The application utilizes a strictly mobile-first Web App architecture with a highly premium, Gamified dark mode aesthetic.
- **Color Palette**: 
  - Deep Dark Backgrounds (`#0a0a0a` to `#000000`).
  - Primary Accent: Neon Green (`#4ade80`) with soft glows for main actions and positive states.
  - Secondary Accent: Neon Red (`#ff3333`) strictly used for the Recovery tracking and destructive actions.
- **Typography**: Clean, geometric sans-serif (e.g., 'Outfit' or 'Inter') with heavy font weights (800) for headers and light weights (300) for supporting text.
- **Glassmorphism**: Extensive use of frosted glass cards (`rgba(255,255,255,0.05)` with `backdrop-filter: blur(16px)`) to create depth.

## 3.3 Core Features & UX Implementation

### 1. Dashboard & Core Logger (Hero Imagery)
- **Hero Sections**: The daily workout card features a high-quality background image (e.g., a bench press for Chest Day) with frosted glass panels overlaid on top containing the workout stats.
- **Visual Streaks**: A prominent 7-day visual streak tracker (M, T, W, T, F, S, S) using neon green circles for completed days.
- **Time-based Greetings**: Dynamic headers ("Good morning ☀️", "Good evening 🌙") based on the user's local time.

### 2. Gamification (XP, Badges & Duels)
- **XP System**: Users no longer just have a generic score; they earn explicit "XP" for logging workouts, maintaining streaks, and hitting PRs.
- **Badges**: Unlockable milestones (e.g., "100kg Bench Club") displayed on the profile.
- **Duel Mode**: A 1v1 challenge system replacing generic co-op. Users can challenge a friend to a "Volume Battle" for the week, with a dedicated visual VS screen.

### 3. Visual Recovery Tracking
- **Neon Red Aesthetic**: A dedicated view using the secondary neon red accent to separate it visually from the green main app.
- **Precision Tracking**: Instead of abstract heatmaps, a clear list of muscle groups (Arms, Back, Chest, Core, Legs) featuring progress bars that show exactly how many hours/days are remaining until that muscle is fully recovered.

## 3.4 Animations & Premium UX Effects
To ensure the Web App feels like a native, premium application, we will implement the following CSS/JS micro-interactions:
- **Button Hover/Tap States**: All interactive elements will scale down slightly (`transform: scale(0.98)`) and increase their neon box-shadow glow on tap.
- **Page Transitions**: Smooth fade-in and slight vertical slide (`translateY`) when navigating between the Dashboard, Recovery, and Social tabs.
- **Progress Bar Animation**: The Recovery progress bars and XP bars will animate from `width: 0%` to their actual value over `1s` using an `ease-out` cubic-bezier when scrolled into view.
- **Skeleton Loaders**: When fetching data from Supabase, glassmorphism skeleton loaders with a subtle sweeping shimmer effect will be displayed instead of generic spinners.
- **Real Icons**: While prototypes used emojis, the final build will utilize sharp, scalable SVG icons (e.g., Lucide or Phosphor icons) for a professional finish.
