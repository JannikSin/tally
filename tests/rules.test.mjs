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
    assert.ok(!/innerHTML|dangerouslySetInnerHTML|eval\(/.test(src), `${f} unsafe API`);
  }
  for (const m of modules) {
    assert.ok(m.meta?.id && m.meta.name && m.meta.glyph && m.meta.hint, `${m.meta?.id} meta`);
    assert.equal(typeof m.init, "function");
    assert.equal(typeof m.reduce, "function");
    assert.equal(typeof m.summary, "function");
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
  // abandon: We get 50 part-score bonus only (no games yet)
  r = bridge.reduce(s, { type: "abandon" });
  s = r.state;
  assert.ok(s.aboveLog[0].some((e) => e.note === "part-score" && e.pts === 50));
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
      for (const doubled of [false, true]) {
        const alone = sheep.handDeltas(n, 0, null, r.key, doubled);
        assert.equal(alone.reduce((a, b) => a + b, 0), 0, `${n}p alone ${r.key}`);
        if (n === 5) {
          const withPartner = sheep.handDeltas(5, 0, 1, r.key, doubled);
          assert.equal(withPartner.reduce((a, b) => a + b, 0), 0, `5p partner ${r.key}`);
        }
      }
    }
  }
});

test("sheepshead 5-handed shares: picker 2, partner 1, defenders 1", () => {
  assert.deepEqual(sheep.handDeltas(5, 0, 1, "win", false), [2, 1, -1, -1, -1]);
  assert.deepEqual(sheep.handDeltas(5, 0, 1, "winSchneider", false), [4, 2, -2, -2, -2]);
  assert.deepEqual(sheep.handDeltas(5, 0, 1, "lossSchwarz", false), [-6, -3, 3, 3, 3]);
  assert.deepEqual(sheep.handDeltas(5, 0, 1, "win", true), [4, 2, -2, -2, -2]);
  assert.deepEqual(sheep.handDeltas(5, 0, null, "win", false), [4, -1, -1, -1, -1]);
  assert.deepEqual(sheep.handDeltas(3, 1, null, "loss", false), [1, -2, 1]);
});

test("sheepshead hand and leaster application", () => {
  let s = sheep.init({ players: ["P1", "P2", "P3", "P4", "P5"] });
  s = sheep.reduce(s, { type: "hand", active: [0, 1, 2, 3, 4], picker: 2, partner: 4, result: "win", doubled: false }).state;
  assert.deepEqual(s.totals, [-1, -1, 2, -1, 1]);
  s = sheep.reduce(s, { type: "leaster", active: [0, 1, 2, 3, 4], winner: 0 }).state;
  assert.deepEqual(s.totals, [3, -2, 1, -2, 0]);
  const tie = sheep.reduce(s, { type: "leaster", active: [0, 1, 2, 3, 4], noWinner: true });
  assert.deepEqual(tie.state.totals, s.totals);
  assert.match(tie.line, /no score/);
});

// ---------- oh hell ----------
import * as oh from "../app/games/ohhell.rules.js";

test("oh hell round sequence and both scoring presets", () => {
  assert.deepEqual(oh.roundSequence(3, false), [3, 2, 1]);
  assert.deepEqual(oh.roundSequence(3, true), [3, 2, 1, 2, 3]);
  assert.equal(oh.maxHand(4), 10);
  assert.equal(oh.maxHand(7), 6);
  assert.deepEqual(oh.scoreRound("exact10", [2, 0, 1], [2, 1, 0]), [12, 0, 0]);
  assert.deepEqual(oh.scoreRound("tricks10", [2, 0, 1], [2, 1, 0]), [12, 1, 0]);
});

test("oh hell full game flow", () => {
  let s = oh.init({ players: ["P1", "P2", "P3"], maxCards: 2, upAndBack: false, scoring: "exact10" });
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
  assert.match(oh.summary(s).line, /P2 wins with 11|P1 wins/);
  assert.deepEqual(s.totals, [21, 11, 20]);
  assert.match(oh.summary(s).line, /P1 wins with 21/);
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
});
