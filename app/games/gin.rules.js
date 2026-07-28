// Gin rummy to 100. Knock: deadwood difference. Gin +25, big gin +50,
// undercut +25 to the defender. At 100: game bonus 100, box bonus 25 per hand
// won, and a shutout doubles the winner's whole tally.

export const meta = {
  id: "gin",
  name: "Gin Rummy",
  glyph: "🃏",
  hint: "Knock, gin, undercut. First to 100.",
};

export const KINDS = [
  { key: "knock", label: "Knock", desc: "deadwood difference", bonus: 0 },
  { key: "gin", label: "Gin", desc: "their deadwood +25", bonus: 25 },
  { key: "biggin", label: "Big gin", desc: "their deadwood +50", bonus: 50 },
  { key: "undercut", label: "Undercut", desc: "difference +25", bonus: 25 },
];

export function init(config) {
  return {
    players: config.players,
    target: 100,
    totals: [0, 0],
    boxes: [0, 0],
    over: false,
    final: null,
    stats: { gins: [0, 0], undercuts: [0, 0] }, // rivalry counters (gins incl. big gin)
  };
}

export function finalTally(totals, boxes) {
  const winner = totals[0] >= totals[1] ? 0 : 1;
  const loser = 1 - winner;
  const final = [0, 0];
  final[winner] = totals[winner] + 100 + boxes[winner] * 25;
  final[loser] = totals[loser] + boxes[loser] * 25;
  if (boxes[loser] === 0) final[winner] *= 2; // shutout
  return { winner, final };
}

export function reduce(state, action) {
  if (state.over) return { state, line: null };
  if (action.type === "wall") {
    // stock ran out with no knock: a real gin outcome, no score, hand is void
    return { state: { ...state }, line: "Wall hand, no score" };
  }
  if (action.type !== "hand") return { state, line: null };
  const { winner, kind, points } = action;
  const k = KINDS.find((x) => x.key === kind);
  const gain = points + k.bonus;
  const totals = state.totals.slice();
  const boxes = state.boxes.slice();
  totals[winner] += gain;
  boxes[winner] += 1;
  const stats = structuredClone(state.stats || { gins: [0, 0], undercuts: [0, 0] });
  if (kind === "gin" || kind === "biggin") stats.gins[winner] += 1;
  if (kind === "undercut") stats.undercuts[winner] += 1;
  let next = { ...state, totals, boxes, stats };
  let line = `${state.players[winner]} ${k.label.toLowerCase()} +${gain} (${totals[0]}–${totals[1]})`;
  if (totals[winner] >= state.target) {
    next.over = true;
    next.final = finalTally(totals, boxes);
    line += " · game";
  }
  return { state: next, line };
}

export function summary(state) {
  const st = state.stats || { gins: [0, 0], undercuts: [0, 0] };
  const result = {
    participants: state.players.slice(),
    winner: state.over ? state.players[state.final.winner] : null,
    stats: {
      Gins: { [state.players[0]]: st.gins[0], [state.players[1]]: st.gins[1] },
      Undercuts: { [state.players[0]]: st.undercuts[0], [state.players[1]]: st.undercuts[1] },
      ...(state.over && state.boxes[1 - state.final.winner] === 0
        ? { Shutouts: { [state.players[state.final.winner]]: 1 } }
        : {}),
    },
  };
  if (state.over) {
    const { winner, final } = state.final;
    const shutout = state.boxes[1 - winner] === 0;
    return {
      done: true,
      line: `${state.players[winner]} wins ${final[winner]}–${final[1 - winner]}${shutout ? " (shutout)" : ""}`,
      result,
    };
  }
  return {
    done: false,
    line: `${state.players[0]} ${state.totals[0]} – ${state.players[1]} ${state.totals[1]}`,
    result,
  };
}
