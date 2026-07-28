// Euchre scoring, standard 4-hand: 3-4 tricks = 1, march = 2, loner march = 4,
// euchred = 2 to defenders. First to target (10) wins. Pure, no imports.

export const meta = {
  id: "euchre",
  name: "Euchre",
  glyph: "♣",
  tint: "sky",
  hint: "Teams to 10. Loners pay four.",
};

export function init(config) {
  return {
    teams: config.teams,
    target: config.target || 10,
    score: [0, 0],
    hands: 0,
    stats: { euchres: [0, 0], loners: [0, 0], marches: [0, 0] }, // rivalry counters
  };
}

export const RESULTS = [
  { key: "made", label: "Made it", desc: "3–4 tricks", pts: 1, toMakers: true },
  { key: "march", label: "March", desc: "all 5 tricks", pts: 2, toMakers: true },
  { key: "loner", label: "Loner march", desc: "alone, all 5", pts: 4, toMakers: true },
  { key: "euchred", label: "Euchred", desc: "under 3 tricks", pts: 2, toMakers: false },
];

export function reduce(state, action) {
  if (action.type !== "hand" || summary(state).done) return { state, line: null };
  const r = RESULTS.find((x) => x.key === action.result);
  const scorer = r.toMakers ? action.makers : 1 - action.makers;
  const score = state.score.slice();
  score[scorer] += r.pts;
  const stats = structuredClone(state.stats || { euchres: [0, 0], loners: [0, 0], marches: [0, 0] });
  if (action.result === "euchred") stats.euchres[scorer] += 1;
  if (action.result === "loner") stats.loners[action.makers] += 1;
  if (action.result === "march") stats.marches[action.makers] += 1;
  const next = { ...state, score, hands: state.hands + 1, stats };
  const alone = action.alone ? " alone" : "";
  const line = `${state.teams[action.makers]}${alone} ${r.toMakers ? r.label.toLowerCase() : "euchred"}, ${state.teams[scorer]} +${r.pts} (${score[0]}–${score[1]})`;
  return { state: next, line };
}

// per-name stat maps: the shape the rivalry aggregator consumes
function statMap(teams, vals) {
  return { [teams[0]]: vals[0], [teams[1]]: vals[1] };
}

export function summary(state) {
  const [a, b] = state.score;
  const done = a >= state.target || b >= state.target;
  const winner = a >= state.target ? 0 : 1;
  const st = state.stats || { euchres: [0, 0], loners: [0, 0], marches: [0, 0] };
  return {
    done,
    line: done
      ? `${state.teams[winner]} win ${winner === 0 ? `${a}–${b}` : `${b}–${a}`}`
      : `${state.teams[0]} ${a} – ${state.teams[1]} ${b}`,
    result: {
      participants: state.teams.slice(),
      winner: done ? state.teams[winner] : null,
      stats: {
        Euchres: statMap(state.teams, st.euchres),
        Loners: statMap(state.teams, st.loners),
        Marches: statMap(state.teams, st.marches),
      },
    },
  };
}
