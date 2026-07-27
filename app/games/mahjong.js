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
  // signs live in chips, not the keyboard: the iOS numeric pad has no minus key
  const [signs, setSigns] = useState(Array(n).fill(1));
  const parsed = deltas.map((d, i) => (parseInt(d, 10) || 0) * signs[i]);
  const freeSum = parsed.reduce((a, b) => a + b, 0);
  const amt = parseInt(amount, 10) || 0;
  const [keepEast, setKeepEast] = useState(false);
  const [eastDoubles, setEastDoubles] = useState(false);
  // collect-mode deltas honoring "East pays/wins double" when enabled
  const collectDeltas = () => {
    const ds = Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      if (i === winner) continue;
      const pays = eastDoubles && (i === state.east || winner === state.east) ? amt * 2 : amt;
      ds[i] = -pays;
      ds[winner] += pays;
    }
    return ds;
  };

  const submit = (ds, ke) => {
    dispatch({ type: "round", deltas: ds, keepEast: ke });
    setWinner(null); setAmount(""); setDeltas(Array(n).fill("")); setSigns(Array(n).fill(1)); setKeepEast(false);
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
            <div class="row wrap" style="margin-top:8px">
              <button type="button" class=${keepEast ? "primary" : ""} style="font-size:13px" onClick=${() => setKeepEast(!keepEast)}>East keeps the deal</button>
              <button type="button" class=${eastDoubles ? "primary" : ""} style="font-size:13px" onClick=${() => setEastDoubles(!eastDoubles)}>East pays/wins double</button>
            </div>
            <button
              type="button" class="primary" style="width:100%;margin-top:10px"
              disabled=${winner == null || amt <= 0}
              onClick=${() => submit(collectDeltas(), keepEast)}
            >${winner == null || amt <= 0 ? "Score hand" : `${state.players[winner]} +${collectDeltas()[winner]}`}</button>`
        : html`
            ${state.players.map(
              (p, i) => html`<div class="row" style="margin-bottom:8px">
                <span style="width:80px;color:var(--chalk-dim);font-size:13px;overflow:hidden;text-overflow:ellipsis">${p}</span>
                <button type="button" class=${signs[i] < 0 ? "" : "ghost"}
                  style=${signs[i] < 0 ? "color:var(--loss);min-width:44px" : "min-width:44px"}
                  aria-label=${signs[i] < 0 ? "losing points" : "winning points"}
                  onClick=${() => { const s = signs.slice(); s[i] = -s[i]; setSigns(s); }}
                >${signs[i] < 0 ? "−" : "+"}</button>
                <input type="text" inputmode="numeric" pattern="[0-9]*" placeholder="0" value=${deltas[i]}
                  onInput=${(e) => { const d = deltas.slice(); d[i] = e.target.value.replace(/\D/g, ""); setDeltas(d); }} />
              </div>`,
            )}
            <p class="hint-line">${parsed.every((d) => d === 0)
              ? "Enter at least one score, or use a Draw button below for a wall game."
              : freeSum === 0
                ? "Balances to zero."
                : `Off by ${freeSum > 0 ? "+" : ""}${freeSum} (fine if your rules aren't zero-sum).`}</p>
            <div class="row" style="margin-top:4px">
              <button type="button" class=${keepEast ? "primary" : ""} style="font-size:13px" onClick=${() => setKeepEast(!keepEast)}>East keeps the deal</button>
            </div>
            <button
              type="button" class="primary" style="width:100%;margin-top:10px"
              disabled=${parsed.every((d) => d === 0)}
              onClick=${() => submit(parsed, keepEast)}
            >Score hand</button>`}
      <div class="row" style="margin-top:10px">
        <button type="button" class="ghost grow" style="font-size:13px"
          onClick=${() => { dispatch({ type: "draw", keepEast: true }); }}
        >Draw — East keeps deal</button>
        <button type="button" class="ghost grow" style="font-size:13px"
          onClick=${() => { dispatch({ type: "draw", keepEast: false }); }}
        >Draw — pass the deal</button>
      </div>
    </div>
    <div class="card"><h2>Hands</h2><${LogList} lines=${log} /></div>
    <button type="button" style="width:100%" onClick=${onDone}>Finish session</button>
  </div>`;
}
