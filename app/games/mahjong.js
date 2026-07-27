import { useState } from "preact/hooks";
import { html } from "htm/preact";
import * as rules from "./mahjong.rules.js";
import { PlayerNames, LogList, Seg } from "../ui.js";

export const meta = rules.meta;
export { rules };

export function Setup({ onStart, roster, history }) {
  const [names, setNames] = useState(Array(4).fill(""));
  return html`<div>
    <div class="card">
      <h2>Players (East first)</h2>
      <${PlayerNames} count=${4} names=${names} onChange=${setNames} roster=${roster} labels=${rules.WINDS} />
      <p class="hint-line">Scores are whatever your table plays; Tally just keeps the running count and the deal.</p>
    </div>
    <button
      type="button" class="primary" style="width:100%"
      onClick=${() => onStart({ players: names.map((n, i) => n?.trim() || rules.WINDS[i]) })}
    >Start session</button>
    ${history.length
      ? html`<div class="card" style="margin-top:12px"><h2>Past sessions</h2>
          ${history.slice(-5).reverse().map((h) => html`<p class="hint-line">${h.line}</p>`)}
        </div>`
      : null}
  </div>`;
}

export function Play({ state, log, dispatch, onDone }) {
  const n = state.players.length;
  const [mode, setMode] = useState("collect");
  const [winner, setWinner] = useState(null);
  const [amount, setAmount] = useState("");
  const [deltas, setDeltas] = useState(Array(n).fill(""));
  const parsed = deltas.map((d) => parseInt(d, 10) || 0);
  const freeSum = parsed.reduce((a, b) => a + b, 0);
  const amt = parseInt(amount, 10) || 0;
  const [keepEast, setKeepEast] = useState(false);

  const submit = (ds, ke) => {
    dispatch({ type: "round", deltas: ds, keepEast: ke });
    setWinner(null); setAmount(""); setDeltas(Array(n).fill("")); setKeepEast(false);
  };

  return html`<div>
    <div class="card">
      <h2>Standings</h2>
      <table class="ledger">
        <tbody>
          ${state.players.map(
            (p, i) => html`<tr>
              <td style="font-family:var(--body)">${p}${i === state.east ? html`<span class="warn"> · East</span>` : null}</td>
              <td class=${state.totals[i] < 0 ? "neg" : state.totals[i] > 0 ? "pos" : ""}>${state.totals[i] > 0 ? "+" : ""}${state.totals[i]}</td>
            </tr>`,
          )}
        </tbody>
      </table>
    </div>
    <div class="card">
      <h2>Score a hand</h2>
      <${Seg}
        options=${[{ value: "collect", label: "Winner collects" }, { value: "free", label: "Enter each" }]}
        value=${mode}
        onChange=${setMode}
      />
      ${mode === "collect"
        ? html`
            <p class="hint-line">Who won?</p>
            <div class="row wrap" style="margin-bottom:8px">
              ${state.players.map(
                (p, i) => html`<button type="button" class=${winner === i ? "primary" : ""} style="min-height:40px;padding:6px 12px;font-size:14px"
                  onClick=${() => { setWinner(i); setKeepEast(i === state.east); }}>${p}</button>`,
              )}
            </div>
            <input type="number" inputmode="numeric" placeholder="Points from each player" value=${amount} onInput=${(e) => setAmount(e.target.value)} />
            <div class="row" style="margin-top:8px">
              <button type="button" class=${keepEast ? "primary" : ""} style="font-size:13px" onClick=${() => setKeepEast(!keepEast)}>East keeps the deal</button>
            </div>
            <button
              type="button" class="primary" style="width:100%;margin-top:10px"
              disabled=${winner == null || amt <= 0}
              onClick=${() => {
                const ds = state.players.map((_, i) => (i === winner ? amt * (n - 1) : -amt));
                submit(ds, keepEast);
              }}
            >${winner == null || amt <= 0 ? "Score hand" : `${state.players[winner]} +${amt * (n - 1)}`}</button>`
        : html`
            ${state.players.map(
              (p, i) => html`<div class="row" style="margin-bottom:8px">
                <span style="width:90px;color:var(--chalk-dim);font-size:13px;overflow:hidden;text-overflow:ellipsis">${p}</span>
                <input type="number" inputmode="numeric" placeholder="±0" value=${deltas[i]}
                  onInput=${(e) => { const d = deltas.slice(); d[i] = e.target.value; setDeltas(d); }} />
              </div>`,
            )}
            <p class="hint-line">${freeSum === 0 ? "Balances to zero." : `Off by ${freeSum > 0 ? "+" : ""}${freeSum} (fine if your rules aren't zero-sum).`}</p>
            <div class="row" style="margin-top:4px">
              <button type="button" class=${keepEast ? "primary" : ""} style="font-size:13px" onClick=${() => setKeepEast(!keepEast)}>East keeps the deal</button>
            </div>
            <button
              type="button" class="primary" style="width:100%;margin-top:10px"
              disabled=${parsed.every((d) => d === 0)}
              onClick=${() => submit(parsed, keepEast)}
            >Score hand</button>`}
    </div>
    <div class="card"><h2>Hands</h2><${LogList} lines=${log} /></div>
    <button type="button" style="width:100%" onClick=${onDone}>Finish session</button>
  </div>`;
}
