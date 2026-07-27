// Rubber bridge scoring. Pure, no imports.
// Trick values: minors 20, majors 30, NT 40 then 30. Game at 100 below the line,
// part-scores wiped when a game is won. Vulnerability follows games won.
// Undertricks: undoubled 50/100 per trick (nv/v); doubled nv 100,200,200,300...;
// doubled v 200,300,300...; redoubled doubles the doubled figures.
// Insult 50/100. Slams 500/750/1000/1500. Rubber bonus 700 (2-0) / 500 (2-1).
// Unfinished rubber: 300 per side with a game, 50 for a part-score in the open game.
// Honors (single hand only): 4 trump honors 100, 5 trump honors or 4 aces at NT 150.

export const meta = {
  id: "bridge",
  name: "Bridge",
  glyph: "♠",
  hint: "Rubber scoring, above and below the line.",
};

export const STRAINS = ["C", "D", "H", "S", "N"];
export const STRAIN_LABEL = { C: "♣", D: "♦", H: "♥", S: "♠", N: "NT" };

export function init(config) {
  return {
    teams: config.teams,
    games: [0, 0],
    vul: [false, false],
    aboveLog: [[], []],
    belowGames: [{ entries: [[], []], winner: null }],
    over: false,
    result: null, // "rubber" | "abandoned"
  };
}

export function trickScore(level, strain, dbl) {
  const base = strain === "N" ? 40 + 30 * (level - 1) : (strain === "C" || strain === "D" ? 20 : 30) * level;
  return base * (dbl === 2 ? 4 : dbl === 1 ? 2 : 1);
}

export function overtrickScore(n, strain, dbl, vul) {
  if (n <= 0) return 0;
  if (dbl === 0) return n * (strain === "C" || strain === "D" ? 20 : 30);
  const per = (vul ? 200 : 100) * (dbl === 2 ? 2 : 1);
  return n * per;
}

export function undertrickScore(n, dbl, vul) {
  if (dbl === 0) return n * (vul ? 100 : 50);
  let total;
  if (vul) total = 200 + (n - 1) * 300;
  else total = n >= 4 ? 500 + (n - 3) * 300 : [0, 100, 300, 500][n];
  return total * (dbl === 2 ? 2 : 1);
}

export function slamBonus(level, vul) {
  if (level === 6) return vul ? 750 : 500;
  if (level === 7) return vul ? 1500 : 1000;
  return 0;
}

export function totals(state) {
  const t = [0, 1].map((i) => state.aboveLog[i].reduce((a, e) => a + e.pts, 0));
  for (const g of state.belowGames) {
    for (const i of [0, 1]) t[i] += g.entries[i].reduce((a, e) => a + e.pts, 0);
  }
  return t;
}

const push = (log, pts, note) => log.push({ pts, note });

export function reduce(state, action) {
  if (!["honors", "abandon", "contract"].includes(action.type)) return { state, line: null };
  const s = structuredClone(state);
  if (action.type === "honors") {
    const pts = action.kind === "h4" ? 100 : 150;
    push(s.aboveLog[action.side], pts, "honors");
    return { state: s, line: `${s.teams[action.side]} honors +${pts}` };
  }
  if (action.type === "abandon") {
    for (const i of [0, 1]) {
      if (s.games[i] === 1) push(s.aboveLog[i], 300, "unfinished game");
      const open = s.belowGames[s.belowGames.length - 1];
      if (open.winner === null && open.entries[i].length) push(s.aboveLog[i], 50, "part-score");
    }
    s.over = true;
    s.result = "abandoned";
    const t = totals(s);
    return { state: s, line: `Rubber abandoned (${s.teams[0]} ${t[0]} – ${s.teams[1]} ${t[1]})` };
  }
  const { declarer, level, strain, dbl, tricks } = action; // tricks: + made overtricks, 0 = exact, negative = down n
  const vul = s.vul[declarer];
  const defender = 1 - declarer;
  const contractText = `${level}${STRAIN_LABEL[strain]}${dbl === 2 ? "××" : dbl === 1 ? "×" : ""}`;
  let line;

  if (tricks >= 0) {
    const below = trickScore(level, strain, dbl);
    let above = overtrickScore(tricks, strain, dbl, vul) + slamBonus(level, vul);
    if (dbl > 0) above += dbl === 2 ? 100 : 50;
    const game = s.belowGames[s.belowGames.length - 1];
    push(game.entries[declarer], below, contractText);
    if (above) push(s.aboveLog[declarer], above, contractText);

    const gameTotal = game.entries[declarer].reduce((a, e) => a + e.pts, 0);
    let note = "";
    if (gameTotal >= 100) {
      game.winner = declarer;
      s.games[declarer] += 1;
      s.vul[declarer] = true;
      note = " · game";
      if (s.games[declarer] === 2) {
        const bonus = s.games[defender] === 0 ? 700 : 500;
        push(s.aboveLog[declarer], bonus, "rubber");
        s.over = true;
        s.result = "rubber";
        note = ` · rubber +${bonus}`;
      } else {
        s.belowGames.push({ entries: [[], []], winner: null });
      }
    }
    line = `${s.teams[declarer]} ${contractText} ${tricks ? "+" + tricks : "="} · ${below} below${above ? `, ${above} above` : ""}${note}`;
  } else {
    const n = -tricks;
    const pts = undertrickScore(n, dbl, vul);
    push(s.aboveLog[defender], pts, `${contractText} down ${n}`);
    line = `${s.teams[declarer]} ${contractText} −${n} · ${s.teams[defender]} +${pts}`;
  }
  return { state: s, line };
}

export function summary(state) {
  const t = totals(state);
  const score = `${state.teams[0]} ${t[0]} – ${state.teams[1]} ${t[1]}`;
  if (state.over) {
    const w = t[0] === t[1] ? -1 : t[0] > t[1] ? 0 : 1;
    return { done: true, line: w < 0 ? `Tied rubber, ${score}` : `${state.teams[w]} take the rubber, ${score}` };
  }
  return { done: false, line: `${score} · games ${state.games[0]}–${state.games[1]}` };
}
