// rook-style partnership bidding, Kentucky Discard scoring. 120 counter points
// in the deck (5s=5, 10s=10, 14s=10, bird=20). Bids 70-120 by 5. Make the bid:
// keep what you captured; get set: lose the bid, defenders keep their capture.
// First team to the target (300 or 500) wins; higher total breaks a double-cross.
// ponytail: no shoot-the-moon variant; add if the table ever calls it.

export const meta = {
  id: "rook",
  name: "Rook",
  glyph: "♜",
  hint: "Bid it, make it, or eat the set.",
};

export const DECK = 120;

export function init(config) {
  return {
    teams: config.teams,
    target: config.target,
    totals: [0, 0],
    rounds: [],
    over: false,
  };
}

export function handScore(bidTeam, bid, captured) {
  const made = captured >= bid;
  const delta = [0, 0];
  delta[bidTeam] = made ? captured : -bid;
  delta[1 - bidTeam] = DECK - captured;
  return { made, delta };
}

export function reduce(state, action) {
  if (action.type !== "hand" || state.over) return { state, line: null };
  const { bidTeam, bid, captured } = action;
  const { made, delta } = handScore(bidTeam, bid, captured);
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
