# Tally

Scorekeeper PWA for table games. You bring the cards; this keeps the score.

Eight games, each with its own purpose-built scoring surface:

- **Euchre** — teams to 10; made / march / loner / euchred one-tap entry
- **Cribbage** — peg to 121 on a board shaped like the number 29 (the perfect hand), skunk and double-skunk lines included
- **Sheepshead** — picker/partner shares, schneider and schwarz buckets, leasters, zero-sum standings
- **Oh Hell** — auto round sequence, bid and trick phases with dealer-hook warning, two scoring presets
- **Gin Rummy** — knock / gin / big gin / undercut, boxes, game bonus, shutout doubling
- **Bridge** — full rubber scoring on the classic above/below-the-line pad: vulnerability, doubles, slams, honors, rubber bonuses
- **rook** — partnership bidding 70–120, made-or-set ledger to 300 or 500
- **Mahjong** — variant-agnostic settling with East rotation

No build step: vanilla [Preact](https://preactjs.com) + [htm](https://github.com/developit/htm), vendored.
No server, no accounts, no analytics. Scores live in `localStorage` on the device;
Settings has copy/paste backup and restore.

## Install on a phone

Open the GitHub Pages URL in Safari/Chrome, then Share → **Add to Home Screen**.
Works offline once installed.

## Develop

```
node --test tests/rules.test.mjs   # scoring rules + contract/purity/CSP checks
node tools/make-icons.mjs          # regenerate icons
node tools/bake-board.mjs          # regenerate the cribbage "29" track
```

If you edit the inline import map in `index.html`, recompute its CSP hash
(byte-exact) and paste it into the CSP meta tag:

```
node -e "const f=require('fs').readFileSync('index.html','utf8');const m=f.match(/<script type=\"importmap\">([\s\S]*?)<\/script>/);console.log('sha256-'+require('crypto').createHash('sha256').update(m[1]).digest('base64'))"
```

Scoring logic lives in `app/games/*.rules.js` (pure, dependency-free, tested);
interfaces in `app/games/*.js`. See `CLAUDE.md` for repo rules.

Third-party licenses: `THIRD-PARTY-NOTICES.md`.
