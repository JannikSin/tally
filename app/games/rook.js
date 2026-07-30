import { useState } from "preact/hooks";
import { html } from "htm/preact";
import * as rules from "./rook.rules.js";
import { BigScore, LogList, OverBanner, Seg, Stepper } from "../ui.js";

export const meta = rules.meta;
export { rules };

export function Setup({ onStart, history }) {
  const [teams, setTeams] = useState(["We", "They"]);
  const [target, setTarget] = useState(300);
  const [deck, setDeck] = useState(120);
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
      <h2 style="margin-top:12px">Points in the deck</h2>
      <div class="btngrid c2">
        ${rules.DECKS.map(
          (d) => html`<button type="button" class=${deck === d.value ? "primary" : ""} onClick=${() => setDeck(d.value)}>${d.label}</button>`,
        )}
      </div>
      <p class="hint-line">Count the last-trick bonus and 1s into "counters captured" like any other points.</p>
    </div>
    <button
      type="button" class="primary" style="width:100%"
      onClick=${() => onStart({ teams: teams.map((t) => t.trim() || "Team"), target, deck, players: [] })}
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
  const deck = state.deck || rules.DECK;
  const sum = rules.summary(state);
  const lead = state.totals[0] === state.totals[1] ? -1 : state.totals[0] > state.totals[1] ? 0 : 1;
  return html`<div>
    <${BigScore}
      entries=${[0, 1].map((i) => ({
        who: state.teams[i],
        pts: state.totals[i],
        lead: i === lead,
        picked: !sum.done && bidTeam === i,
        sub: !sum.done && bidTeam === i ? `has the bid · to ${state.target}` : `to ${state.target}`,
      }))}
      onPick=${sum.done ? null : (i) => setBidTeam(i)}
    />
    ${sum.done
      ? html`<${OverBanner} line=${sum.line} onRematch=${onRematch} onDone=${onDone} />`
      : html`<div class="card">
          <h2>${state.teams[bidTeam]} took the bid (tap the scoreboard to switch)</h2>
          <div style="margin-top:10px">
            <${Stepper} label="Bid" value=${bid} min=${rules.minBidFor(deck)} max=${deck} step=${5} onChange=${setBid} />
          </div>
          <h2 style="margin-top:12px">Counters the bidding team captured</h2>
          <div class="btngrid c6">
            ${Array.from({ length: deck / 5 + 1 }, (_, i) => i * 5).map(
              (n) => html`<button type="button" class=${captured === n ? "primary" : ""} onClick=${() => setCaptured(n)}>${n}</button>`,
            )}
          </div>
          <button
            type="button" class="primary" style="width:100%;margin-top:12px"
            disabled=${captured == null}
            onClick=${() => { dispatch({ type: "hand", bidTeam, bid, captured }); setCaptured(null); setBid(100); }}
          >${captured == null ? "Score hand" : captured >= bid ? `Made it · +${captured} / +${deck - captured}` : `Set · −${bid} / +${deck - captured}`}</button>
        </div>`}
    <div class="card"><h2>Hands</h2><${LogList} lines=${log} /></div>
  </div>`;
}
