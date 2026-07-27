import { useState } from "preact/hooks";
import { html } from "htm/preact";
import * as rules from "./euchre.rules.js";
import { ScoreBar, LogList, OverBanner, Seg } from "../ui.js";

export const meta = rules.meta;
export { rules };

export function Setup({ onStart, history }) {
  const [teams, setTeams] = useState(["We", "They"]);
  return html`<div>
    <div class="card">
      <h2>Teams</h2>
      ${[0, 1].map(
        (i) => html`<div class="row" style="margin-bottom:8px">
          <input
            type="text"
            value=${teams[i]}
            onInput=${(e) => {
              const t = teams.slice();
              t[i] = e.target.value.slice(0, 24);
              setTeams(t);
            }}
          />
        </div>`,
      )}
    </div>
    <button
      type="button"
      class="primary"
      style="width:100%"
      onClick=${() => onStart({ teams: teams.map((t) => t.trim() || "Team"), target: 10, players: [] })}
    >Start — first to 10</button>
    ${history.length
      ? html`<div class="card" style="margin-top:12px"><h2>Past games</h2>
          ${history.slice(-5).reverse().map((h) => html`<p class="hint-line">${h.line}</p>`)}
        </div>`
      : null}
  </div>`;
}

export function Play({ state, log, dispatch, onRematch, onDone }) {
  const [makers, setMakers] = useState(null); // re-pick every hand: stale makers = silent wrong team
  const [alone, setAlone] = useState(false);
  const sum = rules.summary(state);
  const lead = state.score[0] === state.score[1] ? -1 : state.score[0] > state.score[1] ? 0 : 1;
  return html`<div>
    <${ScoreBar}
      entries=${[0, 1].map((i) => ({ who: state.teams[i], pts: state.score[i], lead: i === lead }))}
    />
    ${sum.done
      ? html`<${OverBanner} line=${sum.line} onRematch=${onRematch} onDone=${onDone} />`
      : html`<div class="card">
          <h2>Who called trump?</h2>
          <${Seg}
            options=${[0, 1].map((i) => ({ value: i, label: state.teams[i] }))}
            value=${makers}
            onChange=${setMakers}
          />
          ${makers != null
            ? html`
                <div class="row" style="margin-top:10px">
                  <button type="button" class=${alone ? "primary" : "ghost"} style="font-size:13px" onClick=${() => setAlone(!alone)}>
                    Went alone
                  </button>
                </div>
                <div class="btngrid c2" style="margin-top:10px">
                  ${rules.RESULTS.map(
                    (r) => html`<button type="button" onClick=${() => { dispatch({ type: "hand", makers, result: r.key, alone }); setMakers(null); setAlone(false); }}>
                      <div style="font-weight:600">${r.label}</div>
                      <div style="font-size:12px;color:var(--chalk-dim)">${r.desc} · ${r.toMakers ? "+" : "them +"}${r.pts}</div>
                    </button>`,
                  )}
                </div>`
            : html`<p class="hint-line">Pick the calling team to score the hand. All passed twice? Just redeal.</p>`}
        </div>`}
    <div class="card"><h2>Hands</h2><${LogList} lines=${log} /></div>
  </div>`;
}
