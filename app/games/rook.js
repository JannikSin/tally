import { useState } from "preact/hooks";
import { html } from "htm/preact";
import * as rules from "./rook.rules.js";
import { ScoreBar, LogList, OverBanner, Seg, Stepper } from "../ui.js";

export const meta = rules.meta;
export { rules };

export function Setup({ onStart, history }) {
  const [teams, setTeams] = useState(["We", "They"]);
  const [target, setTarget] = useState(300);
  return html`<div>
    <div class="card">
      <h2>Teams</h2>
      ${[0, 1].map(
        (i) => html`<div class="row" style="margin-bottom:8px">
          <input type="text" value=${teams[i]} onInput=${(e) => {
            const t = teams.slice(); t[i] = e.target.value.slice(0, 24); setTeams(t);
          }} />
        </div>`,
      )}
      <h2 style="margin-top:12px">Play to</h2>
      <${Seg}
        options=${[{ value: 300, label: "300" }, { value: 500, label: "500" }]}
        value=${target}
        onChange=${setTarget}
      />
    </div>
    <button
      type="button" class="primary" style="width:100%"
      onClick=${() => onStart({ teams: teams.map((t) => t.trim() || "Team"), target, players: [] })}
    >Start</button>
    ${history.length
      ? html`<div class="card" style="margin-top:12px"><h2>Past games</h2>
          ${history.slice(-5).reverse().map((h) => html`<p class="hint-line">${h.line}</p>`)}
        </div>`
      : null}
  </div>`;
}

export function Play({ state, log, dispatch, onRematch, onDone }) {
  const [bidTeam, setBidTeam] = useState(0);
  const [bid, setBid] = useState(100);
  const [captured, setCaptured] = useState(null);
  const sum = rules.summary(state);
  const lead = state.totals[0] === state.totals[1] ? -1 : state.totals[0] > state.totals[1] ? 0 : 1;
  return html`<div>
    <${ScoreBar}
      entries=${[0, 1].map((i) => ({ who: state.teams[i], pts: state.totals[i], lead: i === lead, sub: `to ${state.target}` }))}
    />
    ${sum.done
      ? html`<${OverBanner} line=${sum.line} onRematch=${onRematch} onDone=${onDone} />`
      : html`<div class="card">
          <h2>Who took the bid?</h2>
          <${Seg} options=${[0, 1].map((i) => ({ value: i, label: state.teams[i] }))} value=${bidTeam} onChange=${setBidTeam} />
          <div style="margin-top:10px">
            <${Stepper} label="Bid" value=${bid} min=${70} max=${120} step=${5} onChange=${setBid} />
          </div>
          <h2 style="margin-top:12px">Counters they captured</h2>
          <div class="btngrid c6">
            ${Array.from({ length: 25 }, (_, i) => i * 5).map(
              (n) => html`<button type="button" class=${captured === n ? "primary" : ""} onClick=${() => setCaptured(n)}>${n}</button>`,
            )}
          </div>
          <button
            type="button" class="primary" style="width:100%;margin-top:12px"
            disabled=${captured == null}
            onClick=${() => { dispatch({ type: "hand", bidTeam, bid, captured }); setCaptured(null); setBid(100); }}
          >${captured == null ? "Score hand" : captured >= bid ? `Made it · +${captured} / +${rules.DECK - captured}` : `Set · −${bid} / +${rules.DECK - captured}`}</button>
        </div>`}
    <div class="card"><h2>Hands</h2><${LogList} lines=${log} /></div>
  </div>`;
}
