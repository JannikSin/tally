import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

const gamesDir = new URL("../app/games/", import.meta.url);
const ruleFiles = readdirSync(gamesDir).filter((f) => f.endsWith(".rules.js"));
const modules = await Promise.all(ruleFiles.map((f) => import(new URL(f, gamesDir))));

test("rules modules stay pure and honor the contract", () => {
  assert.equal(ruleFiles.length, 8);
  for (const f of ruleFiles) {
    const src = readFileSync(new URL(f, gamesDir), "utf8");
    assert.ok(!/from ["'](htm|preact)/.test(src), `${f} imports UI libs`);
  }
  for (const m of modules) {
    assert.ok(m.meta?.id && m.meta.name && m.meta.glyph && m.meta.hint, `${m.meta?.id} meta`);
    assert.equal(typeof m.init, "function");
    assert.equal(typeof m.reduce, "function");
    assert.equal(typeof m.summary, "function");
  }
});

test("no unsafe DOM APIs anywhere in the app", () => {
  const appDir = new URL("../app/", import.meta.url);
  const files = [
    ...readdirSync(appDir).filter((f) => f.endsWith(".js")).map((f) => new URL(f, appDir)),
    ...readdirSync(gamesDir).filter((f) => f.endsWith(".js")).map((f) => new URL(f, gamesDir)),
    new URL("../sw.js", import.meta.url),
    new URL("../index.html", import.meta.url),
  ];
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    assert.ok(
      !/innerHTML|dangerouslySetInnerHTML|\beval\(|new Function\(/.test(src),
      `${file.pathname} uses an unsafe API`,
    );
  }
});

test("CSP hash matches the inline import map byte for byte", async () => {
  const { createHash } = await import("node:crypto");
  const htmlSrc = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const map = htmlSrc.match(/<script type="importmap">([\s\S]*?)<\/script>/);
  assert.ok(map, "import map present");
  const hash = createHash("sha256").update(map[1]).digest("base64");
  assert.ok(htmlSrc.includes(`'sha256-${hash}'`), "CSP hash out of date — see README Develop");
});

test("service worker precaches every shipped app module", () => {
  const sw = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
  const appDir = new URL("../app/", import.meta.url);
  const shipped = [
    ...readdirSync(appDir).filter((f) => f.endsWith(".js") || f.endsWith(".css")).map((f) => `./app/${f}`),
    ...readdirSync(gamesDir).filter((f) => f.endsWith(".js")).map((f) => `./app/games/${f}`),
  ];
  for (const path of shipped) {
    assert.ok(sw.includes(`"${path}"`), `${path} missing from PRECACHE`);
  }
});

// ---------- euchre ----------
import * as euchre from "../app/games/euchre.rules.js";

test("euchre scoring and win", () => {
  let s = euchre.init({ teams: ["We", "They"], target: 10 });
  s = euchre.reduce(s, { type: "hand", makers: 0, result: "made" }).state;
  assert.deepEqual(s.score, [1, 0]);
  s = euchre.reduce(s, { type: "hand", makers: 0, result: "march" }).state;
  assert.deepEqual(s.score, [3, 0]);
  s = euchre.reduce(s, { type: "hand", makers: 1, result: "loner" }).state;
  assert.deepEqual(s.score, [3, 4]);
  s = euchre.reduce(s, { type: "hand", makers: 1, result: "euchred" }).state;
  assert.deepEqual(s.score, [5, 4]);
  assert.equal(euchre.summary(s).done, false);
  for (let i = 0; i < 3; i++) s = euchre.reduce(s, { type: "hand", makers: 0, result: "march" }).state;
  assert.equal(euchre.summary(s).done, true);
  assert.match(euchre.summary(s).line, /We win 11–4/);
  // post-win guard: further hands are no-ops
  assert.equal(euchre.reduce(s, { type: "hand", makers: 1, result: "made" }).state, s);
});

test("euchre winner-first line and alone tag", () => {
  let s = euchre.init({ teams: ["We", "They"], target: 2 });
  const r = s && euchre.reduce(s, { type: "hand", makers: 1, result: "made", alone: true });
  assert.match(r.line, /They alone made it/);
  s = euchre.reduce(r.state, { type: "hand", makers: 1, result: "made" }).state;
  assert.match(euchre.summary(s).line, /They win 2–0/); // winner's score first
});

// ---------- bridge ----------
import * as bridge from "../app/games/bridge.rules.js";

test("bridge trick values", () => {
  assert.equal(bridge.trickScore(4, "H", 0), 120);
  assert.equal(bridge.trickScore(3, "N", 0), 100);
  assert.equal(bridge.trickScore(5, "C", 0), 100);
  assert.equal(bridge.trickScore(2, "S", 1), 120); // doubled
  assert.equal(bridge.trickScore(1, "D", 2), 80); // redoubled
});

test("bridge undertricks match the schedule", () => {
  // undoubled
  assert.equal(bridge.undertrickScore(3, 0, false), 150);
  assert.equal(bridge.undertrickScore(3, 0, true), 300);
  // doubled not vulnerable: 100, 300, 500, 800, 1100
  assert.deepEqual([1, 2, 3, 4, 5].map((n) => bridge.undertrickScore(n, 1, false)), [100, 300, 500, 800, 1100]);
  // doubled vulnerable: 200, 500, 800, 1100
  assert.deepEqual([1, 2, 3, 4].map((n) => bridge.undertrickScore(n, 1, true)), [200, 500, 800, 1100]);
  // redoubled doubles the doubled figures
  assert.equal(bridge.undertrickScore(2, 2, false), 600);
  assert.equal(bridge.undertrickScore(1, 2, true), 400);
});

test("bridge overtricks and slams", () => {
  assert.equal(bridge.overtrickScore(2, "C", 0, false), 40);
  assert.equal(bridge.overtrickScore(2, "N", 0, true), 60);
  assert.equal(bridge.overtrickScore(2, "H", 1, false), 200);
  assert.equal(bridge.overtrickScore(1, "H", 1, true), 200);
  assert.equal(bridge.overtrickScore(1, "H", 2, true), 400);
  assert.equal(bridge.slamBonus(6, false), 500);
  assert.equal(bridge.slamBonus(7, true), 1500);
});

test("bridge rubber flow: games, vulnerability, rubber bonus", () => {
  let s = bridge.init({ teams: ["We", "They"] });
  // We make 4H = 120 below -> game 1
  let r = bridge.reduce(s, { type: "contract", declarer: 0, level: 4, strain: "H", dbl: 0, tricks: 0 });
  s = r.state;
  assert.equal(s.games[0], 1);
  assert.equal(s.vul[0], true);
  assert.match(r.line, /game/);
  // They part-score 2S = 60
  s = bridge.reduce(s, { type: "contract", declarer: 1, level: 2, strain: "S", dbl: 0, tricks: 0 }).state;
  // We go down 2 doubled vulnerable: They +500 above
  r = bridge.reduce(s, { type: "contract", declarer: 0, level: 3, strain: "N", dbl: 1, tricks: -2 });
  s = r.state;
  assert.equal(s.aboveLog[1].at(-1).pts, 500);
  // They make 3NT (100 below) on top of 60 part-score -> game for They
  s = bridge.reduce(s, { type: "contract", declarer: 1, level: 3, strain: "N", dbl: 0, tricks: 0 }).state;
  assert.equal(s.games[1], 1);
  // We make 6S vulnerable: 180 below + 750 slam -> game 2, rubber 500 (2-1)
  r = bridge.reduce(s, { type: "contract", declarer: 0, level: 6, strain: "S", dbl: 0, tricks: 0 });
  s = r.state;
  assert.equal(s.over, true);
  assert.equal(s.aboveLog[0].find((e) => e.note === "rubber").pts, 500);
  assert.equal(s.aboveLog[0].find((e) => e.note.startsWith("6")).pts, 750);
  const t = bridge.totals(s);
  assert.equal(t[0], 120 + 180 + 750 + 500);
  assert.equal(t[1], 60 + 500 + 100);
  assert.equal(bridge.summary(s).done, true);
});

test("bridge doubled part-score with insult and abandon bonuses", () => {
  let s = bridge.init({ teams: ["We", "They"] });
  // 2C doubled made +1, not vul: below 80, above 50 insult + 100 overtrick
  let r = bridge.reduce(s, { type: "contract", declarer: 0, level: 2, strain: "C", dbl: 1, tricks: 1 });
  s = r.state;
  const g = s.belowGames[0];
  assert.equal(g.entries[0][0].pts, 80);
  assert.equal(s.aboveLog[0][0].pts, 150);
  // abandon: We get the 100 part-score bonus only (no games yet)
  r = bridge.reduce(s, { type: "abandon" });
  s = r.state;
  assert.ok(s.aboveLog[0].some((e) => e.note === "part-score" && e.pts === 100));
  assert.ok(!s.aboveLog[0].some((e) => e.note === "unfinished game"));
  assert.equal(s.over, true);
});

// ---------- gin ----------
import * as gin from "../app/games/gin.rules.js";

test("gin hand types and shutout tally", () => {
  let s = gin.init({ players: ["P1", "P2"] });
  s = gin.reduce(s, { type: "hand", winner: 0, kind: "knock", points: 12 }).state;
  assert.deepEqual(s.totals, [12, 0]);
  s = gin.reduce(s, { type: "hand", winner: 0, kind: "gin", points: 30 }).state;
  assert.deepEqual(s.totals, [67, 0]);
  s = gin.reduce(s, { type: "hand", winner: 0, kind: "biggin", points: 10 }).state;
  assert.deepEqual(s.totals, [127, 0]);
  assert.equal(s.over, true);
  // shutout: (127 + 100 + 3*25) * 2 = 604
  assert.deepEqual(s.final.final, [604, 0]);
  assert.match(gin.summary(s).line, /shutout/);
});

test("gin undercut goes to the defender and no shutout when both box", () => {
  let s = gin.init({ players: ["P1", "P2"] });
  s = gin.reduce(s, { type: "hand", winner: 1, kind: "undercut", points: 5 }).state;
  assert.deepEqual(s.totals, [0, 30]);
  s = gin.reduce(s, { type: "hand", winner: 0, kind: "knock", points: 95 }).state;
  assert.equal(s.over, false); // 95 < 100
  s = gin.reduce(s, { type: "hand", winner: 0, kind: "knock", points: 10 }).state;
  assert.equal(s.over, true);
  // winner 0: 105 + 100 + 2*25 = 255 ; loser: 30 + 25 = 55
  assert.deepEqual(s.final.final, [255, 55]);
});

// ---------- cribbage ----------
import * as crib from "../app/games/cribbage.rules.js";

test("cribbage pegging, win, skunks", () => {
  let s = crib.init({ players: ["P1", "P2"] });
  s = crib.reduce(s, { type: "peg", player: 0, pts: 8 }).state;
  assert.equal(s.scores[0], 8);
  assert.equal(s.back[0], 0);
  s = crib.reduce(s, { type: "peg", player: 0, pts: 12 }).state;
  assert.equal(s.back[0], 8);
  s = crib.reduce(s, { type: "peg", player: 1, pts: 29 }).state;
  s = crib.reduce(s, { type: "peg", player: 0, pts: 121 }).state;
  assert.equal(s.over, true);
  assert.equal(s.scores[0], 121);
  assert.match(crib.summary(s).line, /skunk/); // P2 at 29 = double skunk
  assert.equal(crib.skunkLabel(60), "double skunk");
  assert.equal(crib.skunkLabel(61), "skunk");
  assert.equal(crib.skunkLabel(90), "skunk");
  assert.equal(crib.skunkLabel(91), null);
});

test("cribbage board bake: 121 stations, sane geometry", async () => {
  const { HOLES, VIEW } = await import("../app/games/cribbage.board.js");
  assert.equal(HOLES.length, 121);
  for (const h of HOLES) {
    assert.ok(h.x >= VIEW[0] && h.x <= VIEW[2] && h.y >= VIEW[1] && h.y <= VIEW[3]);
    assert.ok(Math.abs(Math.hypot(h.nx, h.ny) - 1) < 0.01);
  }
});

// ---------- sheepshead ----------
import * as sheep from "../app/games/sheepshead.rules.js";

test("sheepshead deltas are zero-sum in every configuration", () => {
  for (const n of [3, 4, 5]) {
    for (const r of sheep.RESULTS) {
      for (const crack of [1, 2, 4]) {
        const alone = sheep.handDeltas(n, 0, null, r.key, crack);
        assert.equal(alone.reduce((a, b) => a + b, 0), 0, `${n}p alone ${r.key} x${crack}`);
        if (n >= 4) {
          const withPartner = sheep.handDeltas(n, 0, 1, r.key, crack);
          assert.equal(withPartner.reduce((a, b) => a + b, 0), 0, `${n}p partner ${r.key} x${crack}`);
        }
      }
    }
  }
});

test("sheepshead shares: 5-hand picker 2/partner 1, 4-hand called ace 1/1, cracks stack", () => {
  assert.deepEqual(sheep.handDeltas(5, 0, 1, "win", 1), [2, 1, -1, -1, -1]);
  assert.deepEqual(sheep.handDeltas(5, 0, 1, "winSchneider", 1), [4, 2, -2, -2, -2]);
  assert.deepEqual(sheep.handDeltas(5, 0, 1, "lossSchwarz", 1), [-6, -3, 3, 3, 3]);
  assert.deepEqual(sheep.handDeltas(5, 0, 1, "win", 2), [4, 2, -2, -2, -2]);
  assert.deepEqual(sheep.handDeltas(5, 0, 1, "win", 4), [8, 4, -4, -4, -4]);
  assert.deepEqual(sheep.handDeltas(4, 0, 1, "win", 1), [1, 1, -1, -1]);
  assert.deepEqual(sheep.handDeltas(5, 0, null, "win", 1), [4, -1, -1, -1, -1]);
  assert.deepEqual(sheep.handDeltas(3, 1, null, "loss", 1), [1, -2, 1]);
});

test("sheepshead hand and leaster application", () => {
  let s = sheep.init({ players: ["P1", "P2", "P3", "P4", "P5"] });
  s = sheep.reduce(s, { type: "hand", active: [0, 1, 2, 3, 4], picker: 2, partner: 4, result: "win", crack: 1 }).state;
  assert.deepEqual(s.totals, [-1, -1, 2, -1, 1]);
  s = sheep.reduce(s, { type: "leaster", active: [0, 1, 2, 3, 4], winner: 0 }).state;
  assert.deepEqual(s.totals, [3, -2, 1, -2, 0]);
  const tie = sheep.reduce(s, { type: "leaster", active: [0, 1, 2, 3, 4], noWinner: true });
  assert.deepEqual(tie.state.totals, s.totals);
  assert.match(tie.line, /no score/);
});

test("sheepshead house rules: leasterRule defaults and doubler carries into the next hand", () => {
  assert.equal(sheep.init({ players: ["P1", "P2"] }).leasterRule, "fewest");
  assert.equal(sheep.init({ players: ["P1", "P2"], leasterRule: "jackOfDiamonds" }).leasterRule, "jackOfDiamonds");

  let s = sheep.init({ players: ["P1", "P2", "P3", "P4", "P5"], leasterRule: "doubler" });
  assert.equal(s.pendingDouble, 1);
  const redeal = sheep.reduce(s, { type: "redeal" });
  s = redeal.state;
  assert.equal(s.pendingDouble, 2);
  assert.deepEqual(s.totals, [0, 0, 0, 0, 0]); // redeal is a void hand: no money moves
  assert.equal(s.hands, 0); // and doesn't count as a played hand
  assert.match(redeal.line, /×2/);

  // next hand pays double, then the doubler is spent
  const doubled = sheep.reduce(s, { type: "hand", active: [0, 1, 2, 3, 4], picker: 0, partner: 1, result: "win", crack: 1 });
  assert.deepEqual(doubled.state.totals, [4, 2, -2, -2, -2]); // 2x the normal [2,1,-1,-1,-1]
  assert.equal(doubled.state.pendingDouble, 1);
  const clean = sheep.reduce(doubled.state, { type: "hand", active: [0, 1, 2, 3, 4], picker: 0, partner: 1, result: "win", crack: 1 });
  assert.deepEqual(
    clean.state.totals.map((t, i) => t - doubled.state.totals[i]),
    [2, 1, -1, -1, -1],
  );

  // a doubler pending into a leaster also doubles, and stacks if passed out twice
  let s2 = sheep.reduce(sheep.init({ players: ["P1", "P2", "P3", "P4", "P5"] }), { type: "redeal" }).state;
  s2 = sheep.reduce(s2, { type: "redeal" }).state;
  assert.equal(s2.pendingDouble, 4);
  const leastered = sheep.reduce(s2, { type: "leaster", active: [0, 1, 2, 3, 4], winner: 0 });
  assert.deepEqual(leastered.state.totals, [16, -4, -4, -4, -4]); // (5-1)*4, -1*4 each
  assert.equal(leastered.state.pendingDouble, 1);
});

// ---------- oh hell ----------
import * as oh from "../app/games/ohhell.rules.js";

test("oh hell round sequences and both scoring presets", () => {
  assert.deepEqual(oh.roundSequence(3, "down"), [3, 2, 1]);
  assert.deepEqual(oh.roundSequence(3, "downup"), [3, 2, 1, 2, 3]);
  assert.deepEqual(oh.roundSequence(3, "up"), [1, 2, 3]);
  assert.deepEqual(oh.roundSequence(3, "updown"), [1, 2, 3, 2, 1]);
  assert.equal(oh.maxHand(4), 10);
  assert.equal(oh.maxHand(7), 6);
  assert.deepEqual(oh.scoreRound("exact10", [2, 0, 1], [2, 1, 0]), [12, 0, 0]);
  assert.deepEqual(oh.scoreRound("tricks10", [2, 0, 1], [2, 1, 0]), [12, 1, 0]);
});

test("oh hell full game flow", () => {
  let s = oh.init({ players: ["P1", "P2", "P3"], maxCards: 2, mode: "down", scoring: "exact10" });
  assert.equal(oh.dealerIndex(s), 0);
  s = oh.reduce(s, { type: "bids", bids: [1, 0, 0] }).state;
  assert.equal(s.phase, "tricks");
  const r = oh.reduce(s, { type: "tricks", tricks: [1, 1, 0] });
  s = r.state;
  assert.deepEqual(s.totals, [11, 0, 10]);
  assert.equal(oh.dealerIndex(s), 1);
  s = oh.reduce(s, { type: "bids", bids: [0, 1, 0] }).state;
  s = oh.reduce(s, { type: "tricks", tricks: [0, 1, 0] }).state;
  assert.equal(s.over, true);
  assert.deepEqual(s.totals, [21, 11, 20]);
  assert.match(oh.summary(s).line, /P1 wins with 21/);
  // over-guard: further actions are no-ops
  const after = oh.reduce(s, { type: "bids", bids: [0, 0, 0] });
  assert.equal(after.state, s);
});

test("oh hell misdeal skip voids the round in place", () => {
  let s = oh.init({ players: ["P1", "P2", "P3"], maxCards: 3, mode: "down", scoring: "exact10" });
  s = oh.reduce(s, { type: "bids", bids: [1, 1, 0] }).state;
  const r = oh.reduce(s, { type: "skip" });
  assert.equal(r.state.phase, "bid");
  assert.equal(r.state.bids, null);
  assert.equal(r.state.round, 0); // same round, redealt
  assert.match(r.line, /thrown in/);
});

test("gin wall hand records but scores nothing", () => {
  let s = gin.init({ players: ["P1", "P2"] });
  const r = gin.reduce(s, { type: "wall" });
  assert.deepEqual(r.state.totals, [0, 0]);
  assert.deepEqual(r.state.boxes, [0, 0]);
  assert.match(r.line, /Wall/);
});

test("mahjong draw advances or keeps the deal without payments", () => {
  let s = mah.init({ players: ["P1", "P2", "P3", "P4"] });
  let r = mah.reduce(s, { type: "draw", keepEast: true });
  assert.equal(r.state.east, 0);
  assert.equal(r.state.round, 1);
  assert.deepEqual(r.state.totals, [0, 0, 0, 0]);
  r = mah.reduce(r.state, { type: "draw", keepEast: false });
  assert.equal(r.state.east, 1);
  assert.match(r.line, /deal passes/);
});

// ---------- rook ----------
import * as rook from "../app/games/rook.rules.js";

test("rook made and set hands", () => {
  assert.deepEqual(rook.handScore(0, 100, 105), { made: true, delta: [105, 15] });
  assert.deepEqual(rook.handScore(0, 100, 95), { made: false, delta: [-100, 25] });
  assert.deepEqual(rook.handScore(1, 70, 70), { made: true, delta: [50, 70] });
  let s = rook.init({ teams: ["We", "They"], target: 300 });
  s = rook.reduce(s, { type: "hand", bidTeam: 0, bid: 120, captured: 120 }).state;
  s = rook.reduce(s, { type: "hand", bidTeam: 0, bid: 120, captured: 120 }).state;
  s = rook.reduce(s, { type: "hand", bidTeam: 0, bid: 100, captured: 100 }).state;
  assert.equal(s.over, true);
  assert.match(rook.summary(s).line, /We win 340–20/);
});

test("rook deck variants change the defender remainder and bid ceiling", () => {
  assert.deepEqual(rook.handScore(0, 100, 100, 140), { made: true, delta: [100, 40] });
  assert.deepEqual(rook.handScore(0, 150, 120, 180), { made: false, delta: [-150, 60] });
  let s = rook.init({ teams: ["We", "They"], target: 300, deck: 140 });
  s = rook.reduce(s, { type: "hand", bidTeam: 0, bid: 100, captured: 90 }).state;
  assert.deepEqual(s.totals, [-100, 50]); // set: defenders keep 140-90
});

// ---------- mahjong ----------
import * as mah from "../app/games/mahjong.rules.js";

test("mahjong totals and east rotation", () => {
  let s = mah.init({ players: ["P1", "P2", "P3", "P4"] });
  s = mah.reduce(s, { type: "round", deltas: [24, -8, -8, -8], keepEast: true }).state;
  assert.equal(s.east, 0);
  assert.deepEqual(s.totals, [24, -8, -8, -8]);
  s = mah.reduce(s, { type: "round", deltas: [-10, 30, -10, -10], keepEast: false }).state;
  assert.equal(s.east, 1);
  assert.deepEqual(s.totals, [14, 22, -18, -18]);
});

test("sheepshead dealer rotates and drives sit-outs, no exceptions", () => {
  assert.deepEqual(sheep.autoSitters(5, 2), []);
  assert.deepEqual(sheep.autoSitters(6, 2), [2]);
  assert.deepEqual(sheep.autoSitters(7, 6), [6, 5]); // dealer + right of dealer
  assert.deepEqual(sheep.autoSitters(7, 0), [0, 6]); // wraps
  let s = sheep.init({ players: ["P1", "P2", "P3", "P4", "P5", "P6"] });
  assert.equal(s.dealer, 0); // deal starts at seat 1
  s = sheep.reduce(s, { type: "hand", active: [1, 2, 3, 4, 5], picker: 1, partner: 2, result: "win" }).state;
  assert.equal(s.dealer, 1);
  s = sheep.reduce(s, { type: "redeal" }).state;
  assert.equal(s.dealer, 1); // same dealer redeals after all-pass
  s = sheep.reduce(s, { type: "leaster", active: [0, 2, 3, 4, 5], winner: 0 }).state;
  assert.equal(s.dealer, 2);
});

test("sheepshead double on the bump and the hand sheet rows", () => {
  let s = sheep.init({ players: ["P1", "P2", "P3", "P4", "P5"] });
  // loss pays double, always
  const full = sheep.previewDeltas(s, [0, 1, 2, 3, 4], 0, 1, "loss");
  assert.deepEqual(full, [-4, -2, 2, 2, 2]);
  assert.equal(full.reduce((a, b) => a + b, 0), 0);
  // no-schneider loss: x2 bucket x2 bump = x4
  assert.deepEqual(sheep.previewDeltas(s, [0, 1, 2, 3, 4], 0, 1, "lossSchneider"), [-8, -4, 4, 4, 4]);
  // wins stay single
  assert.deepEqual(sheep.previewDeltas(s, [0, 1, 2, 3, 4], 0, 1, "win"), [2, 1, -1, -1, -1]);
  s = sheep.reduce(s, { type: "hand", active: [0, 1, 2, 3, 4], picker: 0, partner: 1, result: "loss" }).state;
  assert.deepEqual(s.totals, [-4, -2, 2, 2, 2]);
  assert.equal(s.rows.length, 1);
  assert.deepEqual(s.rows[0], {
    totals: [-4, -2, 2, 2, 2], picker: 0, partner: 1, dealer: 0,
    sitters: [], result: "loss", bumped: true, doubler: 1,
  });
  s = sheep.reduce(s, { type: "leaster", active: [0, 1, 2, 3, 4], winner: 2 }).state;
  assert.equal(s.rows.length, 2);
  assert.equal(s.rows[1].result, "leaster");
  assert.equal(s.rows[1].dealer, 1);
});

test("sheepshead alone (picker = partner) and the Double button multiplier", () => {
  let s = sheep.init({ players: ["P1", "P2", "P3", "P4", "P5"] });
  // picker and partner the same player = going alone: picker moves 4 shares
  assert.deepEqual(sheep.previewDeltas(s, [0, 1, 2, 3, 4], 0, 0, "win"), [4, -1, -1, -1, -1]);
  // Double x4 on a won no-schneider: bucket x2, doubler x4
  assert.deepEqual(sheep.previewDeltas(s, [0, 1, 2, 3, 4], 0, 1, "winSchneider", 4), [16, 8, -8, -8, -8]);
  // Double x2 on a loss stacks with the automatic bump: 1 x2 bump x2 double = x4
  assert.deepEqual(sheep.previewDeltas(s, [0, 1, 2, 3, 4], 0, 1, "loss", 2), [-8, -4, 4, 4, 4]);
  const r = sheep.reduce(s, { type: "hand", active: [0, 1, 2, 3, 4], picker: 0, partner: 0, result: "win", doubleMult: 2 });
  assert.deepEqual(r.state.totals, [8, -2, -2, -2, -2]);
  assert.match(r.line, /P1 alone: won · doubler ×2/);
  assert.equal(r.state.rows[0].partner, 0); // alone recorded as picker = partner
  // leaster with the Double button
  const l = sheep.reduce(s, { type: "leaster", active: [0, 1, 2, 3, 4], winner: 3, doubleMult: 2 });
  assert.deepEqual(l.state.totals, [-2, -2, -2, 8, -2]);
});

test("sheepshead forced pick: dealer's forced loss does not bump", () => {
  const s = sheep.init({ players: ["P1", "P2", "P3", "P4", "P5"], leasterRule: "forcedPick" });
  // dealer is seat 0; dealer forced to pick and loses: no bump
  assert.deepEqual(sheep.previewDeltas(s, [0, 1, 2, 3, 4], 0, 1, "loss"), [-2, -1, 1, 1, 1]);
  // a non-dealer picker still bumps
  assert.deepEqual(sheep.previewDeltas(s, [0, 1, 2, 3, 4], 1, 2, "loss"), [2, -4, -2, 2, 2]);
  const r = sheep.reduce(s, { type: "hand", active: [0, 1, 2, 3, 4], picker: 0, partner: 1, result: "loss" });
  assert.deepEqual(r.state.totals, [-2, -1, 1, 1, 1]);
  assert.equal(r.state.rows[0].bumped, false);
});

test("games emit structured results for the rivalry ledger", () => {
  let e = euchre.init({ teams: ["We", "They"], target: 6 });
  e = euchre.reduce(e, { type: "hand", makers: 1, result: "euchred" }).state; // We euchre them
  e = euchre.reduce(e, { type: "hand", makers: 0, result: "loner" }).state;
  const er = euchre.summary(e).result;
  assert.equal(er.winner, "We");
  assert.deepEqual(er.participants, ["We", "They"]);
  assert.equal(er.stats.Euchres.We, 1);
  assert.equal(er.stats.Loners.We, 1);

  let g = gin.init({ players: ["P1", "P2"] });
  g = gin.reduce(g, { type: "hand", winner: 1, kind: "undercut", points: 3 }).state;
  g = gin.reduce(g, { type: "hand", winner: 0, kind: "biggin", points: 60 }).state;
  const gr = gin.summary(g).result;
  assert.equal(gr.stats.Undercuts.P2, 1);
  assert.equal(gr.stats.Gins.P1, 1);
  assert.equal(gr.winner, "P1"); // 110 >= 100

  let c = crib.init({ players: ["P1", "P2"] });
  c = crib.reduce(c, { type: "peg", player: 0, pts: 121 }).state;
  const cr = crib.summary(c).result;
  assert.equal(cr.winner, "P1");
  assert.deepEqual(cr.stats["Double skunks"], { P1: 1 });
});

// ---------- rivalry aggregation ----------
import * as riv from "../app/rivalry.data.js";

test("rivalry aggregation: records, streaks, badges, milestones", () => {
  const entry = (winner, stats = {}) => ({
    date: 1,
    line: "x",
    result: { participants: ["P1", "P2"], winner, stats },
  });
  const history = {
    euchre: [
      entry("P1", { Euchres: { P1: 2 } }),
      entry("P2"),
      entry(null, { Euchres: { P1: 5 } }), // unfinished: stats count, the game doesn't
      entry("P1", { Euchres: { P1: 1 } }),
      entry("P1"),
      entry("P1"),
    ],
    gin: [{ date: 2, line: "no result entry kept out" }],
  };
  const ms = riv.aggregate(history, { euchre: "Euchre" });
  assert.equal(ms.length, 1);
  const m = ms[0];
  assert.equal(m.games, 5); // the null-winner entry didn't count
  assert.deepEqual(m.wins, { P1: 4, P2: 1 });
  assert.deepEqual(m.streak, { who: "P1", n: 3 });
  assert.equal(m.stats.Euchres.P1, 8); // but its stats did
  assert.equal(riv.edge(m, "P2").kind, "nemesis");
  assert.equal(riv.edge(m, "P1").kind, "victim");
  assert.deepEqual(riv.milestoneFor(10), { hit: 10 });
  assert.deepEqual(riv.milestoneFor(24), { next: 25 });
  assert.equal(riv.milestoneFor(23), null);
});

// ---------- store quarantine ----------
test("store survives corrupt and truncated data", async () => {
  const mem = new Map();
  globalThis.localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
  };
  mem.set("tally.v1", '{"schema":1,"games":{"euchre":{"state":{"sc'); // truncated
  const { store } = await import("../app/store.js");
  assert.equal(store.session("euchre"), null); // booted clean
  assert.ok(mem.get("tally.v1.corrupt").startsWith('{"schema"')); // quarantined
  store.start("euchre", { teams: ["A", "B"] }, { score: [0, 0] });
  store.apply("euchre", { score: [1, 0] }, "line 1");
  assert.deepEqual(store.session("euchre").state, { score: [1, 0] });
  store.undo("euchre");
  assert.deepEqual(store.session("euchre").state, { score: [0, 0] });
  assert.equal(store.session("euchre").log.length, 0);

  // typeof null === "object": a games:null backup must be rejected, not accepted
  assert.throws(() => store.importJSON('{"schema":1,"games":null,"roster":[],"history":{}}'));
  assert.throws(() => store.importJSON('{"schema":1,"games":[],"roster":[],"history":{}}'));
  assert.throws(() => store.importJSON('{"schema":1,"games":{"euchre":{"state":null,"log":[],"undo":[]}},"roster":[],"history":{}}'));
  assert.ok(store.session("euchre"), "failed import must not clobber the live db");

  // a valid import stashes the outgoing db for recovery
  store.importJSON('{"schema":1,"games":{},"roster":[],"history":{}}');
  assert.ok(mem.get("tally.v1.prev").includes("euchre"));
  assert.equal(store.session("euchre"), null);

  // placeholder names never pollute the roster
  store.rememberPlayers(["Player 1", "Team 2", "East", "We", "P-Real Name"]);
  assert.deepEqual(store.roster(), ["P-Real Name"]);

  // history and roster contents are validated too, not just their containers
  assert.throws(() => store.importJSON('{"schema":1,"games":{},"roster":[],"history":{"euchre":"junk"}}'));
  store.importJSON('{"schema":1,"games":{},"roster":[{"evil":1},"P-Ok"],"history":{}}');
  assert.deepEqual(store.roster(), ["P-Ok"]);
});
