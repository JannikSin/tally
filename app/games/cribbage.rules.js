// Cribbage pegging to 121. Loser under 91 is skunked, under 61 double-skunked.
// Tracks front (current) and back (previous) peg per player. Pure, no imports.

export const meta = {
  id: "cribbage",
  name: "Cribbage",
  glyph: "29",
  hint: "Peg to 121 on the 29 board.",
};

export function init(config) {
  const n = config.players.length;
  return {
    players: config.players,
    scores: Array(n).fill(0),
    back: Array(n).fill(0),
    over: false,
    winner: null,
  };
}

export function reduce(state, action) {
  if (action.type !== "peg" || state.over) return { state, line: null };
  const { player, pts } = action;
  const scores = state.scores.slice();
  const back = state.back.slice();
  back[player] = scores[player];
  scores[player] = Math.min(121, scores[player] + pts);
  const over = scores[player] >= 121;
  const next = { ...state, scores, back, over, winner: over ? player : null };
  return {
    state: next,
    line: `${state.players[player]} +${pts} (${scores[player]})`,
  };
}

export function skunkLabel(loserScore) {
  if (loserScore <= 60) return "double skunk";
  if (loserScore <= 90) return "skunk";
  return null;
}

export function summary(state) {
  if (state.over) {
    const losers = state.players
      .map((p, i) => ({ p, s: state.scores[i], i }))
      .filter((x) => x.i !== state.winner);
    const worst = Math.min(...losers.map((x) => x.s));
    const skunk = skunkLabel(worst);
    return {
      done: true,
      line: `${state.players[state.winner]} wins 121–${losers.map((x) => x.s).join("–")}${skunk ? ` (${skunk})` : ""}`,
    };
  }
  return {
    done: false,
    line: state.players.map((p, i) => `${p} ${state.scores[i]}`).join(" · "),
  };
}
