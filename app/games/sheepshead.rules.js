// Sheepshead, money-style zero-sum units. 120 card points in the deck; picker's
// side needs 61. Result buckets keyed off the picker side's own points:
//   win 61-90 (x1) · win schneider 91-120 (x2) · loss 31-60 (x1) · loss schneider 0-30 (x2)
// Schwarz (x3) means the losing side took no tricks — a trick-count fact, so it
// is its own bucket, not a point threshold.
// 5-handed with a partner: picker moves 2 shares, partner 1, each defender 1.
// No partner (3/4-handed, or picker goes alone): picker moves (n-1) shares.
// Leaster: fewest points with at least one trick wins; each other player pays 1.
// "Doubled" doubles the hand (house cracking is defender-initiated and can stack
// to 4x; a single x2 covers the common case).

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
    players: config.players,
    totals: Array(config.players.length).fill(0),
    hands: 0,
  };
}

// deltas over the active players of one hand, in units; zero-sum by construction
export function handDeltas(activeCount, pickerIdx, partnerIdx, resultKey, doubled) {
  const r = RESULTS.find((x) => x.key === resultKey);
  let mult = r.mult * (doubled ? 2 : 1);
  const sign = r.win ? 1 : -1;
  const deltas = Array(activeCount).fill(0);
  if (partnerIdx != null && partnerIdx !== pickerIdx) {
    for (let i = 0; i < activeCount; i++) {
      if (i === pickerIdx) deltas[i] = 2 * mult * sign;
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
  if (action.type === "hand") {
    const { active, picker, partner, result, doubled } = action;
    const r = RESULTS.find((x) => x.key === result);
    const deltas = handDeltas(
      active.length,
      active.indexOf(picker),
      partner == null ? null : active.indexOf(partner),
      result,
      doubled,
    );
    const totals = state.totals.slice();
    active.forEach((p, i) => { totals[p] += deltas[i]; });
    const line = `${state.players[picker]}${partner != null && partner !== picker ? ` + ${state.players[partner]}` : " alone"}: ${r.label.toLowerCase()}${doubled ? " ×2" : ""}`;
    return { state: { ...state, totals, hands: state.hands + 1 }, line };
  }
  if (action.type === "leaster") {
    const { active, winner, noWinner } = action;
    const totals = state.totals.slice();
    let line;
    if (noWinner) {
      line = "Leaster, tied for fewest: no score";
    } else {
      active.forEach((p) => { totals[p] += p === winner ? active.length - 1 : -1; });
      line = `Leaster: ${state.players[winner]} takes it`;
    }
    return { state: { ...state, totals, hands: state.hands + 1 }, line };
  }
  return { state, line: null };
}

export function summary(state) {
  const best = Math.max(...state.totals);
  const leader = state.players[state.totals.indexOf(best)];
  return {
    done: false,
    line: `${state.hands} hand${state.hands === 1 ? "" : "s"} · ${leader} up ${best > 0 ? "+" : ""}${best}`,
  };
}
