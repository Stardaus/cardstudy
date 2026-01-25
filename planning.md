# Project Plan: Flashcard Fun PWA

## Current Status
A fully functional Progressive Web App (PWA) for studying flashcards.

### Features Implemented
- **User Guide:** Built-in manual and interactive tour.
- **Study Mode:** QA cards and Cloze deletions (fill-in-the-blank).
- **Game/Quiz Mode:** Multiple choice with scoring and streaks.
- **User System:** Multiple profiles, XP, Leveling, and Leaderboard.
- **Data:** IndexedDB storage, offline support (Service Worker), CSV Sync (Google Sheets).
- **UI:** Mobile-first design, animations (confetti), installable PWA.
- **Audio:** Synthesized sound effects (Web Audio API) for interactions, with mute toggle.

## Next Steps
- [x] User Guide & In-App Tour
- [ ] (User to define)

## Debugging: Persistent Bottom Layout Issue
**Problem:** Bottom-most buttons (e.g., "Back Home", "Back to Subjects") are cut off or partially obscured on small screens, despite CSS padding and JS spacers.

**Analysis & Attempted Fixes:**
1.  **CSS Padding:** Increased `#main-content` `padding-bottom` to `calc(140px + env(safe-area-inset-bottom))`.
2.  **JS Spacers:** Added `120px` height `div` elements at the end of every `render` function to force scrollable area.
3.  **Observation:** The issue appears responsive (width/height dependent), suggesting a possible conflict between `height: 100vh`, `flex: 1` containers, and browser chrome (URL bars) on mobile.

**Hypotheses for next steps:**
- **Dynamic Viewport Units:** Replace `100vh` with `100dvh` in `style.css` to better handle mobile browser chrome.
- **Scroll Container:** Check if `#main-content` is correctly receiving the `overflow-y: auto` behavior in all contexts, or if a parent container is clipping it.
- **Flexbox Conflict:** The `display: flex; flex-direction: column;` on `#main-content` might be preventing the spacer from expanding the scroll height if items are trying to fit the container exactly.
- **Safe Area Insets:** Some browsers may not be correctly reporting `env(safe-area-inset-bottom)`, or the value might be `0` when it should be higher.

