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
- No trademark branding: "rook" appears only as a lowercase generic game label, no bird
  imagery.

## Architecture
- `app/main.js` — hash router: home grid ↔ per-game screens.
- `app/store.js` — versioned action-log sessions in localStorage (`tally.v1`). Undo = pop
  action, state = pure replay. Corrupt/unknown logs are quarantined to `tally.v1.corrupt`
  and the app boots clean; never throw at boot.
- `app/games/<game>.js` — one module per game: `{ meta, Setup, Play }` UI + pure
  `reduce(state, action)` scoring. Scoring logic stays dependency-free so `node --test`
  can import it without a DOM.
- `tests/` — `node --test tests/` covers every scoring function.

## Verify
- `node --test tests/`
- `npx serve` (or any static server) at repo root; hard-refresh twice to check sw.js.
