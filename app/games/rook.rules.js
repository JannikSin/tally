// rook-style partnership bidding, Kentucky Discard scoring. Base deck: 120
// counter points (5s=5, 10s=10, 14s=10, bird=20). Deck variants add points:
//   140 = last trick worth 20 · 180 = 1s high worth 15 each · 200 = both
// Bids 70..deck by 5. Make the bid: keep what you captured; get set: lose the
// bid, defenders keep their capture. First team to the target (300 or 500)
// wins; higher total breaks a double-cross.
// ponytail: no shoot-the-moon variant; add if the table ever calls it.

export const meta = {
  id: "rook",
  name: "Rook",
  glyph: "♜",
  tint: "sky",
  hint: "Bid it, make it, or eat the set.",
};

export const DECK = 120; // base deck; sessions carry their own state.deck
export const DECKS = [
  { value: 120, label: "120 · base" },
  { value: 140, label: "140 · last trick +20" },
  { value: 180, label: "180 · 1s high" },
  { value: 200, label: "200 · both" },
];

export function init(config) {
  return {
    teams: config.teams,
    target: config.target,
    deck: config.deck || DECK,
    totals: [0, 0],
    rounds: [],
    over: false,
  };
}

export function handScore(bidTeam, bid, captured, deck = DECK) {
  const made = captured >= bid;
  const delta = [0, 0];
  delta[bidTeam] = made ? captured : -bid;
  delta[1 - bidTeam] = deck - captured;
  return { made, delta };
}

export function reduce(state, action) {
  if (action.type !== "hand" || state.over) return { state, line: null };
  const { bidTeam, bid, captured } = action;
  const { made, delta } = handScore(bidTeam, bid, captured, state.deck || DECK);
  const totals = [state.totals[0] + delta[0], state.totals[1] + delta[1]];
  const rounds = state.rounds.concat([{ delta, totals: totals.slice() }]);
  const over =
    (totals[0] >= state.target || totals[1] >= state.target) && totals[0] !== totals[1];
  const line = `${state.teams[bidTeam]} bid ${bid}, ${made ? `made ${captured}` : `set (took ${captured})`} · ${totals[0]}–${totals[1]}`;
  return { state: { ...state, totals, rounds, over }, line };
}

export function summary(state) {
  const [a, b] = state.totals;
  if (state.over) {
    const w = a > b ? 0 : 1;
    return { done: true, line: `${state.teams[w]} win ${Math.max(a, b)}–${Math.min(a, b)}` };
  }
  return { done: false, line: `${state.teams[0]} ${a} – ${state.teams[1]} ${b} · to ${state.target}` };
}
