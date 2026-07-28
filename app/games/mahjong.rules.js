// Mahjong scorekeeping, variant-agnostic on purpose (HK, American, and house
// tables all settle differently). Two entry styles produce the same action:
// winner-collects-from-all, or a free signed entry per player. The deal (East)
// rotates unless East keeps it (East won, or house rule).

export const meta = {
  id: "mahjong",
  name: "Mahjong",
  glyph: "🀄",
  hint: "Any table rules. East rotates the deal.",
};

export const WINDS = ["East", "South", "West", "North"];

export function init(config) {
  return {
    players: config.players,
    totals: Array(config.players.length).fill(0),
    east: 0,
    round: 0,
  };
}

export function reduce(state, action) {
  if (action.type === "draw") {
    // exhaustive draw / wall game: no payments, the deal keeps or passes
    const east = action.keepEast ? state.east : (state.east + 1) % state.players.length;
    return {
      state: { ...state, east, round: state.round + 1 },
      line: `Draw — ${action.keepEast ? `${state.players[state.east]} keeps the deal` : "deal passes"}`,
    };
  }
  if (action.type !== "round") return { state, line: null };
  const { deltas, keepEast } = action;
  const totals = state.totals.map((t, i) => t + deltas[i]);
  const east = keepEast ? state.east : (state.east + 1) % state.players.length;
  const line = state.players
    .map((p, i) => `${p} ${deltas[i] > 0 ? "+" : ""}${deltas[i]}`)
    .join(" · ");
  return {
    state: { ...state, totals, east, round: state.round + 1 },
    line,
  };
}

export function summary(state) {
  // full settlement in the line: this is what history records when the session ends
  const ranked = state.players
    .map((p, i) => ({ p, t: state.totals[i] }))
    .sort((a, b) => b.t - a.t);
  const pairs = ranked.map((x) => `${x.p} ${x.t > 0 ? "+" : ""}${x.t}`).join(" · ");
  return {
    done: false,
    line: `${state.round} hand${state.round === 1 ? "" : "s"}: ${pairs}`,
    result: {
      participants: state.players.slice(),
      winner: ranked.length > 1 && ranked[0].t > ranked[1].t ? ranked[0].p : null,
      stats: {},
    },
  };
}
