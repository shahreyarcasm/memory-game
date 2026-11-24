# Implementation plan

## Phase 1: Shared Infrastructure
- Extend `src/types/game.ts` with `GameScoreBreakdown` and richer result shape.
- Add `src/utils/scoring.ts` — per-game scoring models and feedback-message generator.
- Add `src/utils/demo.ts` — demo enable/disable + first-play tracking via store.
- Update `src/store/app.ts` — persist demo prefs, add `didYouKnow` session fact, session dedupe.
- Add `src/data/facts.ts` — curated science facts.
- Add shared components in `src/components/`:
  - `GameShell.tsx` — header, back link, safe-area container, phases
  - `DemoModal.tsx` — animated demo, skip, "don't show again"
  - `ResultsScreen.tsx` — points, accuracy, stats, best, feedback, Try Again + Library
  - `GameButton.tsx` — consistent primary/ghost/touch-friendly buttons
  - `DidYouKnow.tsx` — session-rotating fact card

## Phase 2: Game Fixes
- DigitSpan: reverse-mode state machine bug (jumps to 'result' before input); auto-submit; timing measurement.
- SpatialMatrix: viewport-scaled grid via CSS `min()` + aspect-square cells.
- CardPairs: blank screen from `phase === 'complete'` returning `null` (score is recomputed in render with `Math.max(0, Math.round(pairCount*100 - moves*2))` which is fine — issue is win condition race); fix result rendering.
- Stroop: blank screen after completion + variable rule types, controlled distribution.
- ObjectLocation: pointer-based drag/drop with click-to-place fallback for touch.
- RapidFlash: fix spawn when container not measured; responsive height.

## Phase 3: Visual Design System
- Tailwind palette refresh (indigo/violet + teal; per-game hue tokens).
- Lucide icons for games; CSS gradient + pattern game cards.
- Animations: micro-interactions, transitions, states.

## Phase 4: Responsive
- Layout safe-area (env(safe-area-inset-bottom)).
- Full-viewport game area: dvh, grid scales to fit, controls within thumb reach.

## Phase 5: QA
- Build + typecheck, Playwright script exercising each game's full cycle at 360x640 and 1280x800.
- Console error check; persistence check via reload.
