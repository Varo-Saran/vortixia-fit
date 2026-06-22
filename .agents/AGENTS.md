# Mobile Web App Strict Rules

**1. No Zoom Features on Mobile:**
- Ensure the `viewport` configuration explicitly blocks user scaling (`maximumScale: 1`, `userScalable: false`).
- Do NOT allow any double-tap-to-zoom or pinch-to-zoom features. The app must behave like a compiled native mobile app.
- Ensure all inputs, textareas, and selects have a minimum font-size of 16px to prevent iOS Safari auto-zoom on focus.

**2. Notch & Safe Area Safety:**
- Do NOT place any interactive UI elements (buttons, text, avatars) in the iOS notch/Dynamic Island area.
- Keep the iOS notch size as default, utilizing `env(safe-area-inset-top)` to push content down.
- Backgrounds, gradients, and images can extend into the notch area (bleed), but the core layout wrapper must ensure safe spacing for content.
