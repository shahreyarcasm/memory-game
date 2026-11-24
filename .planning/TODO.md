# TODO — Memory Game Improvements

## Shared Infrastructure
- [~] Extend types + scoring utils (`src/types/game.ts`, `src/utils/scoring.ts`)
- [ ] Store: demo prefs, first-play flags, did-you-know rotation, session dedupe (`src/store/app.ts`)
- [ ] Facts dataset (`src/data/facts.ts`)
- [ ] Shared components: `GameShell`, `DemoModal`, `ResultsScreen`, `GameButton`, `DidYouKnow`

## Game Fixes
- [ ] DigitSpan — reverse-mode premature evaluation, auto-submit, internal timing
- [ ] SpatialMatrix — responsive grid sizing beyond 5x5
- [ ] CardPairs — blank completion screen
- [ ] Stroop — blank completion, rule A/B randomization, pattern randomization
- [ ] ObjectLocation — pointer drag & drop (mouse + touch)
- [ ] RapidFlash — stimuli not rendering

## Visual / Responsive
- [ ] Palette + Tailwind tokens + per-game identity
- [ ] Game library redesign (cards, tabs, states)
- [ ] Mobile-first layouts, safe areas, no hidden controls

## QA
- [ ] Build + typecheck clean
- [ ] Playwright full-cycle per game @ 360x640, 768x1024, 1280x800
- [ ] Persistence + reload tests
- [ ] Final review report
