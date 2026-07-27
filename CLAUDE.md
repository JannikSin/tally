# Tally — multi-game scorekeeper PWA

Static PWA, no build step, vanilla Preact + htm vendored. Deployed to GitHub Pages
(public repo). Scores games; does not play them.

## Hard rules (public repo)
- **No real names anywhere in the repo**: tests, fixtures, README, screenshots, commit
  messages use `P1..P6`, `North/South/East/West`, or `We/They` only. Player names live
  exclusively in localStorage on-device.
- **Zero `innerHTML` / `dangerouslySetInnerHTML` / `eval` / `new Function`.** SVG (cribbage
  board) is built as Preact nodes. Player names are always rendered as text nodes.
- **CSP is pinned.** The only inline script is the import map, hash-pinned in the CSP meta
  tag. If the import map changes byte-for-byte, recompute the sha256 (see tools/ note in
  README). Never resolve a CSP failure with `unsafe-inline`.
- **Zero network calls at runtime** beyond same-origin fetches. No analytics, no beacons,
  ever.
- **`vendor/` upgrade ritual**: update file, update `vendor/VERSIONS.md`, bump `CACHE` in
  `sw.js` — all three or none.
- No trademark branding: "Rook" is a plain generic game label (chess-rook glyph), no bird
  imagery.

## Architecture
- `app/main.js` — hash router: home grid ↔ per-game screens. Shell owns the top bar,
  undo, and end-game; games render only their entry surface and score display.
- `app/store.js` — versioned localStorage store (`tally.v1`). Persists STATE, not an
  action log: each session holds `{config, state, log[], undo[]}` where `undo` is a
  bounded snapshot stack (see `UNDO_CAP`) and `log` is display-only lines. Corrupt or
  unknown-schema data is quarantined to `tally.v1.corrupt` and the app boots clean;
  never throw at boot. Restore stashes the outgoing db to `tally.v1.prev`.
- `app/games/<game>.rules.js` — pure scoring: `meta`, `init(config)`,
  `reduce(state, action) -> {state, line}`, `summary(state) -> {done, line}`.
  ZERO imports — may never import htm/preact; `tests/rules.test.mjs` enforces this.
- `app/games/<game>.js` — the UI: imports its rules module, re-exports
  `meta`/`rules`, exports `Setup` and `Play` components.
- `app/ui.js` — the only shared-widget file (Seg, Stepper, PlayerNames, ScoreBar,
  LogList, OverBanner).
- `tests/rules.test.mjs` — every scoring function + contract/purity/CSP checks.

## Adding a game
Three touch points, all manual:
1. `app/games/<name>.rules.js` + `app/games/<name>.js` — clone the closest template:
   euchre/rook/bridge for two-team target games, ohhell/sheepshead/mahjong for N-player
   running-tally games, gin/cribbage for 2-3 player races.
2. `app/main.js` — import it and add to the `GAMES` array (this puts it on the home grid).
3. `sw.js` — add BOTH files to `PRECACHE` and bump `CACHE`, or the game silently breaks
   offline for installed users. Nothing derives that list automatically.
Then add rules tests to `tests/rules.test.mjs` (the contract test picks up the new
`.rules.js` file automatically and will fail until `meta/init/reduce/summary` exist).

## Verify
- `node --test tests/rules.test.mjs`
- `npx serve` (or any static server) at repo root; hard-refresh twice to check sw.js.
- CSP hash after editing the import map: run the snippet in README (Develop) and paste
  the output into the CSP meta tag. The hash is byte-exact; a whitespace change breaks it.
