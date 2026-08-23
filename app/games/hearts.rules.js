// Hearts. Every hand puts exactly 26 penalty points on the table: thirteen
// hearts at 1 each and the queen of spades at 13. Scores only ever go UP and
// the LOWEST score wins, so the sheet is a race away from the target.
// Shooting the moon: take all 26 yourself and you score 0 while everyone
// else takes 26.
// The game ends the moment anyone reaches the target (100 by default) at the
// end of a hand — unless the low score is tied, in which case the table plays
// on until one player is clear at the bottom.
// The deal rotates one seat every hand and the pass rotates with it:
// left, right, across, hold. An odd table has no seat across, so those
// tables cycle left, right, hold.

export const TOTAL = 26; // points in the deck, every hand, no exceptions
export const HEARTS = 13; // one point each
export const QUEEN = 13; // the queen of spades, alone worth half the deck

export const meta = {
  id: "hearts",
  name: "Hearts",
  glyph: "♥",
  tint: "loss",
  hint: "Duck the queen. Low score wins.",
};

export function init(config) {
  return {
    players: config.players, // seating order; seat 1 deals first, the deal rotates down the list
    totals: Array(config.players.length).fill(0),
    hands: 0,
    dealer: 0,
    target: config.target || 100,
    rows: [], // one per scored hand: {totals, points, dealer, queen, moon}
    over: false,
    stats: { moons: {}, queens: {}, cleans: {} }, // rivalry counters keyed by player name
  };
}

// left · right · across · hold, rotating with the deal. No seat sits across
// at an odd table, so the across pass is dropped there.
export function passDirection(hands, playerCount) {
  const cycle = playerCount % 2 === 0 ? ["left", "right", "across", "hold"] : ["left", "right", "hold"];
  return cycle[hands % cycle.length];
}

export function moonIndex(points) {
  return points.findIndex((p) => p === TOTAL);
}

// What each player's total actually moves by. Normally that is the points
// they took; on a moon it flips, the shooter takes nothing and the table
// takes the full 26 each.
export function handDeltas(points) {
  const moon = moonIndex(points);
  if (moon >= 0) return points.map((_, i) => (i === moon ? 0 : TOTAL));
  return points.slice();
}

// A hand is only enterable once all 26 points are accounted for.
export function validPoints(points, playerCount) {
  return (
    Array.isArray(points) &&
    points.length === playerCount &&
    points.every((p) => Number.isInteger(p) && p >= 0 && p <= TOTAL) &&
    points.reduce((a, b) => a + b, 0) === TOTAL
  );
}

export function reduce(state, action) {
  if (state.over) return { state, line: null };
  if (action.type === "misdeal") {
    // thrown-in hand: nothing scored, the same dealer deals again
    return { state: { ...state }, line: `Hand ${state.hands + 1} thrown in, redeal` };
  }
  if (action.type === "hand") {
    const points = action.points;
    if (!validPoints(points, state.players.length)) return { state, line: null }; // never score a partial hand
    const deltas = handDeltas(points);
    const totals = state.totals.map((t, i) => t + deltas[i]);
    const moon = moonIndex(points);
    const queen =
      Number.isInteger(action.queen) && action.queen >= 0 && action.queen < state.players.length
        ? action.queen
        : null;

    const stats = structuredClone(state.stats || { moons: {}, queens: {}, cleans: {} });
    if (moon >= 0) {
      const shooter = state.players[moon];
      stats.moons[shooter] = (stats.moons[shooter] || 0) + 1;
    }
    if (queen != null) {
      const qp = state.players[queen];
      stats.queens[qp] = (stats.queens[qp] || 0) + 1;
    }
    points.forEach((p, i) => {
      if (p === 0) {
        const name = state.players[i];
        stats.cleans[name] = (stats.cleans[name] || 0) + 1;
      }
    });

    const lowest = Math.min(...totals);
    const tiedAtLow = totals.filter((t) => t === lowest).length > 1;
    const reached = Math.max(...totals) >= state.target;
    const over = reached && !tiedAtLow; // a tie at the bottom keeps the game alive

    const line =
      moon >= 0
        ? `Hand ${state.hands + 1}: ${state.players[moon]} shot the moon, everyone else +${TOTAL}`
        : `Hand ${state.hands + 1}: ${state.players
            .map((p, i) => `${p} ${points[i] ? "+" + points[i] : "0"}`)
            .join(" · ")}`;

    const rows = (state.rows || []).concat([
      { totals: totals.slice(), points: points.slice(), dealer: state.dealer || 0, queen, moon: moon >= 0 ? moon : null },
    ]);
    const dealer = ((state.dealer || 0) + 1) % state.players.length;
    return {
      state: { ...state, totals, hands: state.hands + 1, dealer, rows, stats, over },
      line: reached && tiedAtLow ? `${line} · tied at ${lowest}, play on` : line,
    };
  }
  return { state, line: null };
}

export function summary(state) {
  const ranked = state.players
    .map((p, i) => ({ p, t: state.totals[i] }))
    .sort((a, b) => a.t - b.t); // low score wins
  const st = state.stats || { moons: {}, queens: {}, cleans: {} };
  const result = {
    participants: state.players.slice(),
    winner: state.over ? ranked[0].p : null,
    stats: { Moons: st.moons, "Queens taken": st.queens, "Clean hands": st.cleans },
  };
  if (state.over) {
    return { done: true, line: `${ranked[0].p} wins with ${ranked[0].t}`, result };
  }
  const high = Math.max(...state.totals);
  return {
    done: false,
    line: `${state.hands} hand${state.hands === 1 ? "" : "s"}: ${ranked[0].p} low with ${ranked[0].t} · ${state.target - high} to go`,
    result,
  };
}
