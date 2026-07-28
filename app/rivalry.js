import { html } from "htm/preact";
import { store } from "./store.js";
import { aggregate, edge } from "./rivalry.data.js";

// The rivalry scoreboard: lifetime records between the same people, per game,
// accumulated automatically from finished games. Scoped to real opponents,
// never a global leaderboard.

function FormDots({ m }) {
  const last5 = m.results.slice(-5);
  const first = m.participants[0];
  return html`<span class="row" style="gap:4px">
    ${last5.map((w) => {
      const color = w == null ? "var(--chalk-dim)" : w === first ? "var(--sky)" : "var(--brass)";
      return html`<span style="width:9px;height:9px;border-radius:50%;background:${color};display:inline-block"></span>`;
    })}
  </span>`;
}

function MatchupCard({ m }) {
  const [a, b] = m.participants.length === 2 ? m.participants : [null, null];
  const twoSided = a != null;
  const wa = twoSided ? m.wins[a] || 0 : 0;
  const wb = twoSided ? m.wins[b] || 0 : 0;
  const badge = twoSided ? edge(m, a) : null;
  const statLines = Object.entries(m.stats)
    .map(([stat, byName]) => {
      const parts = Object.entries(byName)
        .filter(([, v]) => v > 0)
        .sort((x, y) => y[1] - x[1])
        .map(([n, v]) => `${n} ${v}`);
      return parts.length ? `${stat}: ${parts.join(" · ")}` : null;
    })
    .filter(Boolean);

  return html`<div class="card">
    <div class="row">
      <h2 class="grow" style="margin-bottom:0">${m.game}</h2>
      <span class="hint-line" style="margin:0">${m.games} game${m.games === 1 ? "" : "s"}</span>
    </div>
    ${twoSided
      ? html`<div class="row" style="margin-top:10px;align-items:baseline;justify-content:center;gap:14px">
          <span style="font-weight:600">${a}</span>
          <span class="num" style="font-size:34px;font-weight:720">
            ${wa}<span style="color:var(--chalk-dim);font-size:22px"> – </span>${wb}
          </span>
          <span style="font-weight:600">${b}</span>
        </div>`
      : html`<div class="row wrap" style="margin-top:10px;justify-content:center;gap:10px">
          ${m.participants.map((p) => html`<span class="num" style="font-size:15px">${p} ${m.wins[p] || 0}</span>`)}
        </div>`}
    <div class="row" style="margin-top:10px;justify-content:center;gap:12px">
      <${FormDots} m=${m} />
      ${m.streak ? html`<span class="warn">${m.streak.who} on a ${m.streak.n}-win streak</span>` : null}
    </div>
    ${badge
      ? html`<p class="hint-line" style="text-align:center;color:var(--brass)">
          ${badge.kind === "nemesis" ? `${badge.them} is ${a}'s nemesis.` : `${badge.them} is ${a}'s favorite victim.`}
        </p>`
      : null}
    ${m.milestone?.hit
      ? html`<p class="hint-line" style="text-align:center;color:var(--brass)">Game ${m.milestone.hit} of this rivalry is in the books.</p>`
      : m.milestone?.next
        ? html`<p class="hint-line" style="text-align:center">Next game is number ${m.milestone.next}. Make it count.</p>`
        : null}
    ${statLines.length
      ? html`<div style="margin-top:8px">${statLines.map((l) => html`<p class="hint-line" style="margin:2px">${l}</p>`)}</div>`
      : null}
  </div>`;
}

export function Rivalries({ gameMeta }) {
  const matchups = aggregate(store.historyAll(), gameMeta);
  return html`<div class="fade-in">
    <div class="topbar">
      <a href="#" class="iconlink" aria-label="Back">‹</a>
      <h1>Rivalries</h1>
    </div>
    <div class="screen">
      ${matchups.length
        ? matchups.map((m) => html`<${MatchupCard} m=${m} key=${m.key} />`)
        : html`<div class="card">
            <h2>No rivalries yet</h2>
            <p class="hint-line">Finish games with the same names and the lifetime records build themselves. Same names, same rivalry; no setup.</p>
          </div>`}
    </div>
  </div>`;
}
