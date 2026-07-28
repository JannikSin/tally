// Oh Hell. Rounds deal down from the max hand to 1 (optionally back up).
// Dealer rotates; the dealer's bid may not make total bids equal the tricks
// available (the hook). Scoring presets:
//   "exact10": 10 + bid if you take exactly your bid, else 0 (default)
//   "tricks10": tricks taken, plus 10 bonus for hitting your bid

export const meta = {
  id: "ohhell",
  name: "Oh Hell",
  glyph: "🎯",
  hint: "Bid exact or bust, down to one card.",
};

// mode: "down" max..1 · "downup" max..1..max · "up" 1..max · "updown" 1..max..1
export function roundSequence(maxCards, mode) {
  const down = [];
  for (let c = maxCards; c >= 1; c--) down.push(c);
  const up = down.slice().reverse();
  if (mode === "up") return up;
  if (mode === "updown") return up.concat(down.slice(1));
  if (mode === "downup") return down.concat(up.slice(1));
  return down;
}

export function maxHand(playerCount) {
  return Math.min(10, Math.floor(52 / playerCount) - 1);
}

export function init(config) {
  return {
    players: config.players,
    seq: roundSequence(config.maxCards, config.mode),
    scoring: config.scoring, // "exact10" | "tricks10"
    hook: config.hook !== false, // dealer may not even out the bids
    round: 0,
    phase: "bid",
    bids: null,
    totals: Array(config.players.length).fill(0),
    exacts: Array(config.players.length).fill(0), // rounds where the bid hit exactly
    over: false,
  };
}

export function scoreRound(scoring, bids, tricks) {
  return bids.map((bid, i) => {
    const exact = tricks[i] === bid;
    if (scoring === "tricks10") return tricks[i] + (exact ? 10 : 0);
    return exact ? 10 + bid : 0;
  });
}

export function dealerIndex(state) {
  return state.round % state.players.length;
}

export function reduce(state, action) {
  if (state.over) return { state, line: null };
  if (action.type === "skip") {
    // misdeal / thrown-in hand: no scores, the round is redealt in place
    return { state: { ...state, phase: "bid", bids: null }, line: `${state.seq[state.round]}-card hand thrown in, redeal` };
  }
  if (action.type === "bids" && state.phase === "bid") {
    return { state: { ...state, phase: "tricks", bids: action.bids }, line: null };
  }
  if (action.type === "tricks" && state.phase === "tricks") {
    const pts = scoreRound(state.scoring, state.bids, action.tricks);
    const totals = state.totals.map((t, i) => t + pts[i]);
    const exacts = (state.exacts || state.players.map(() => 0)).map(
      (e, i) => e + (action.tricks[i] === state.bids[i] ? 1 : 0),
    );
    const cards = state.seq[state.round];
    const line = `${cards} card${cards === 1 ? "" : "s"}: ${state.players
      .map((p, i) => `${p} ${state.bids[i]}/${action.tricks[i]}${pts[i] ? ` +${pts[i]}` : ""}`)
      .join(" · ")}`;
    const round = state.round + 1;
    const over = round >= state.seq.length;
    return {
      state: { ...state, totals, exacts, round, phase: "bid", bids: null, over },
      line,
    };
  }
  return { state, line: null };
}

export function summary(state) {
  const best = Math.max(...state.totals);
  const winner = state.players[state.totals.indexOf(best)];
  const exacts = state.exacts || state.players.map(() => 0);
  const result = {
    participants: state.players.slice(),
    winner: state.over ? winner : null,
    stats: {
      "Exact bids": Object.fromEntries(state.players.map((p, i) => [p, exacts[i]])),
    },
  };
  if (state.over) {
    return { done: true, line: `${winner} wins with ${best}`, result };
  }
  return {
    done: false,
    line: `Round ${state.round + 1}/${state.seq.length} · ${winner} leads ${best}`,
    result,
  };
}
