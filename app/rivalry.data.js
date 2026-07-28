// Pure rivalry aggregation over the store's history. No imports, node-testable.
// A matchup = the same set of participants in the same game. Records accumulate
// with zero setup: the names typed at game setup ARE the identity.

export const MILESTONES = [10, 25, 50, 100, 250];

// history: { gameId: [ {date, line, result?} ] } · gameMeta: { gameId: displayName }
export function aggregate(history, gameMeta) {
  const map = new Map();
  for (const [gameId, entries] of Object.entries(history || {})) {
    for (const e of entries || []) {
      const r = e.result;
      if (!r || !Array.isArray(r.participants) || r.participants.length < 2) continue;
      const key = gameId + "|" + r.participants.slice().sort().join("|");
      let m = map.get(key);
      if (!m) {
        m = {
          key,
          gameId,
          game: (gameMeta && gameMeta[gameId]) || gameId,
          participants: r.participants.slice(),
          games: 0,
          wins: {},
          results: [], // chronological winners (null = draw/no-winner)
          stats: {},
          lastDate: 0,
        };
        map.set(key, m);
      }
      // only decided games count toward the record; unfinished/tied entries
      // still contribute their stats below
      if (r.winner) {
        m.games += 1;
        m.results.push(r.winner);
        m.wins[r.winner] = (m.wins[r.winner] || 0) + 1;
      }
      m.lastDate = Math.max(m.lastDate, e.date || 0);
      for (const [stat, byName] of Object.entries(r.stats || {})) {
        if (!byName || typeof byName !== "object") continue;
        const agg = (m.stats[stat] ||= {});
        for (const [name, v] of Object.entries(byName)) {
          if (typeof v === "number" && v > 0) agg[name] = (agg[name] || 0) + v;
        }
      }
    }
  }
  return [...map.values()]
    .filter((m) => m.games > 0)
    .map((m) => ({ ...m, streak: streakOf(m.results), milestone: milestoneFor(m.games) }))
    .sort((a, b) => b.games - a.games || b.lastDate - a.lastDate);
}

// current run of consecutive wins by the same participant, counted from the end
export function streakOf(results) {
  const last = results[results.length - 1];
  if (!last) return null;
  let n = 0;
  for (let i = results.length - 1; i >= 0 && results[i] === last; i--) n++;
  return n >= 2 ? { who: last, n } : null;
}

export function milestoneFor(games) {
  if (MILESTONES.includes(games)) return { hit: games };
  const next = MILESTONES.find((x) => x > games);
  return next && next - games === 1 ? { next } : null;
}

// Nemesis/favorite-victim framing for a two-sided matchup, from `who`'s side.
export function edge(m, who) {
  const others = m.participants.filter((p) => p !== who);
  if (others.length !== 1) return null;
  const them = others[0];
  const w = m.wins[who] || 0;
  const l = m.wins[them] || 0;
  if (w + l < 5) return null; // too few games to crown anyone
  if (l >= w * 2) return { kind: "nemesis", them };
  if (w >= l * 2) return { kind: "victim", them };
  return null;
}
