// Sheepshead, money-style zero-sum units. 120 card points in the deck; picker's
// side needs 61. Result buckets keyed off the picker side's own points:
//   win 61-90 (x1) · win schneider 91-120 (x2) · loss 31-60 (x1) · loss schneider 0-30 (x2)
// Schwarz (x3) means the losing side took no tricks — a trick-count fact, so it
// is its own bucket, not a point threshold.
// With a partner and d defenders: each defender pays 1 share, partner gets 1,
// picker gets d-1 (5-handed: picker 2, partner 1, defenders 1 each; 4-handed
// called-ace: picker 1, partner 1, defenders 1 each). Zero-sum by construction.
// No partner (or picker goes alone): picker moves (n-1) shares.
// Leaster house rule (config.leasterRule, default "fewest"):
//   "fewest" — fewest points (with a trick) wins; a tie pushes (no score)
//   "trick" — fewest points wins; a tie is broken by first trick, so never a push
//   "jackOfDiamonds" — whoever takes the jack of diamonds wins outright
//   "doubler" — no leaster at all: redeal, next hand's stakes double (stacks
//     if it happens again) via state.pendingDouble, consumed by the next hand/leaster
// crack: x2, crack-and-recrack: x4 (the crack multiplier stacks on the result,
// and on any pending doubler).

export const meta = {
  id: "sheepshead",
  name: "Sheepshead",
  glyph: "🐑",
  hint: "Picker, partner, schneider, schwarz.",
};

export const RESULTS = [
  { key: "win", label: "Won", desc: "61–90", mult: 1, win: true },
  { key: "winSchneider", label: "Won schneider", desc: "91–120", mult: 2, win: true },
  { key: "winSchwarz", label: "Won schwarz", desc: "every trick", mult: 3, win: true },
  { key: "loss", label: "Lost", desc: "31–60", mult: 1, win: false },
  { key: "lossSchneider", label: "Lost schneider", desc: "0–30", mult: 2, win: false },
  { key: "lossSchwarz", label: "Lost schwarz", desc: "no tricks", mult: 3, win: false },
];

export function init(config) {
  return {
    players: config.players, // seating order; the deal passes left through this array
    totals: Array(config.players.length).fill(0),
    hands: 0,
    dealer: 0,
    leasterRule: config.leasterRule || "fewest", // "fewest" | "trick" | "jackOfDiamonds" | "doubler"
    pendingDouble: 1, // set by a "doubler" redeal; consumed by the next hand/leaster
    stats: { picks: {}, pickWins: {}, schwarzes: {} }, // rivalry counters keyed by player name
  };
}

// House convention: hands play at most five-handed; the dealer sits out their
// own deal in a 6-hand game, dealer plus the next seat in a 7-hand game.
export function autoSitters(playerCount, dealer) {
  if (playerCount <= 5) return [];
  if (playerCount === 6) return [dealer];
  return [dealer, (dealer + 1) % playerCount];
}

// deltas over the active players of one hand, in units; zero-sum by construction.
// crack: 1 (clean), 2 (cracked), 4 (recracked)
export function handDeltas(activeCount, pickerIdx, partnerIdx, resultKey, crack = 1) {
  const r = RESULTS.find((x) => x.key === resultKey);
  const mult = r.mult * crack;
  const sign = r.win ? 1 : -1;
  const deltas = Array(activeCount).fill(0);
  if (partnerIdx != null && partnerIdx !== pickerIdx) {
    const defenders = activeCount - 2;
    for (let i = 0; i < activeCount; i++) {
      if (i === pickerIdx) deltas[i] = (defenders - 1) * mult * sign;
      else if (i === partnerIdx) deltas[i] = mult * sign;
      else deltas[i] = -mult * sign;
    }
  } else {
    for (let i = 0; i < activeCount; i++) {
      deltas[i] = i === pickerIdx ? (activeCount - 1) * mult * sign : -mult * sign;
    }
  }
  return deltas;
}

export function reduce(state, action) {
  if (action.type === "setDealer") {
    // manual correction when the table's deal got out of sync with the app
    return { state: { ...state, dealer: action.dealer }, line: null };
  }
  if (action.type === "redeal") {
    // all passed under the "doubler" house rule: void hand, SAME dealer redeals,
    // next hand's stakes double
    const pendingDouble = (state.pendingDouble || 1) * 2;
    return { state: { ...state, pendingDouble }, line: `Redeal, all passed: next hand pays ×${pendingDouble}` };
  }
  if (action.type === "hand") {
    const { active, picker, partner, result, crack = 1 } = action;
    const r = RESULTS.find((x) => x.key === result);
    const doubler = state.pendingDouble || 1;
    const deltas = handDeltas(
      active.length,
      active.indexOf(picker),
      partner == null ? null : active.indexOf(partner),
      result,
      crack * doubler,
    );
    const totals = state.totals.slice();
    active.forEach((p, i) => { totals[p] += deltas[i]; });
    const stats = structuredClone(state.stats || { picks: {}, pickWins: {}, schwarzes: {} });
    const pname = state.players[picker];
    stats.picks[pname] = (stats.picks[pname] || 0) + 1;
    if (r.win) stats.pickWins[pname] = (stats.pickWins[pname] || 0) + 1;
    if (result === "winSchwarz") stats.schwarzes[pname] = (stats.schwarzes[pname] || 0) + 1;
    const line = `${state.players[picker]}${partner != null && partner !== picker ? ` + ${state.players[partner]}` : " alone"}: ${r.label.toLowerCase()}${crack > 1 ? ` ×${crack}` : ""}${doubler > 1 ? ` (doubler ×${doubler})` : ""}`;
    const dealer = ((state.dealer || 0) + 1) % state.players.length;
    return { state: { ...state, totals, hands: state.hands + 1, pendingDouble: 1, dealer, stats }, line };
  }
  if (action.type === "leaster") {
    const { active, winner, noWinner } = action;
    const doubler = state.pendingDouble || 1;
    const totals = state.totals.slice();
    let line;
    if (noWinner) {
      line = "Leaster, tied for fewest: no score";
    } else {
      active.forEach((p) => { totals[p] += (p === winner ? active.length - 1 : -1) * doubler; });
      line = `Leaster: ${state.players[winner]} takes it${doubler > 1 ? ` (doubler ×${doubler})` : ""}`;
    }
    const dealer = ((state.dealer || 0) + 1) % state.players.length;
    return { state: { ...state, totals, hands: state.hands + 1, pendingDouble: 1, dealer }, line };
  }
  return { state, line: null };
}

export function summary(state) {
  // full settlement in the line: this is what history records when the session ends
  const ranked = state.players
    .map((p, i) => ({ p, t: state.totals[i] }))
    .sort((a, b) => b.t - a.t);
  const pairs = ranked.map((x) => `${x.p} ${x.t > 0 ? "+" : ""}${x.t}`).join(" · ");
  const st = state.stats || { picks: {}, pickWins: {}, schwarzes: {} };
  return {
    done: false,
    line: `${state.hands} hand${state.hands === 1 ? "" : "s"}: ${pairs}`,
    result: {
      participants: state.players.slice(),
      // session winner = biggest money; a tie at the top records no winner
      winner: ranked.length > 1 && ranked[0].t > ranked[1].t ? ranked[0].p : null,
      stats: { Picks: st.picks, "Picks won": st.pickWins, Schwarzes: st.schwarzes },
    },
  };
}
