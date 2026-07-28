import { useState } from "preact/hooks";
import { html } from "htm/preact";
import * as rules from "./gin.rules.js";
import { PlayerNames, BigScore, LogList, OverBanner } from "../ui.js";

export const meta = rules.meta;
export { rules };

export function Setup({ onStart, roster, history }) {
  const [names, setNames] = useState(["", ""]);
  return html`<div>
    <div class="card">
      <h2>Players</h2>
      <${PlayerNames} count=${2} names=${names} onChange=${setNames} roster=${roster} />
    </div>
    <button
      type="button" class="primary" style="width:100%"
      onClick=${() => onStart({ players: [names[0]?.trim() || "Player 1", names[1]?.trim() || "Player 2"] })}
    >Start — first to 100</button>
    ${history.length
      ? html`<div class="card" style="margin-top:12px"><h2>Past games</h2>
          ${history.slice(-5).reverse().map((h) => html`<p class="hint-line">${h.line}</p>`)}
        </div>`
      : null}
  </div>`;
}

export function Play({ state, log, dispatch, onRematch, onDone }) {
  const [winner, setWinner] = useState(0);
  const [kind, setKind] = useState("knock");
  const [points, setPoints] = useState(null);
  const [morePoints, setMorePoints] = useState(false);
  const sum = rules.summary(state);
  const lead = state.totals[0] === state.totals[1] ? -1 : state.totals[0] > state.totals[1] ? 0 : 1;

  return html`<div>
    <${BigScore}
      entries=${[0, 1].map((i) => ({
        who: state.players[i],
        pts: state.totals[i],
        sub: `${state.boxes[i]} box${state.boxes[i] === 1 ? "" : "es"} · to ${state.target}`,
        lead: i === lead,
        picked: !sum.done && winner === i,
      }))}
      onPick=${sum.done ? null : (i) => setWinner(i)}
    />
    ${sum.done
      ? html`<${OverBanner} line=${sum.line} onRematch=${onRematch} onDone=${onDone} />
          <div class="card">
            <h2>Final count</h2>
            <table class="ledger">
              <thead><tr><th></th><th>${state.players[0]}</th><th>${state.players[1]}</th></tr></thead>
              <tbody>
                <tr><td style="font-family:var(--body)">Hand points</td><td>${state.totals[0]}</td><td>${state.totals[1]}</td></tr>
                <tr><td style="font-family:var(--body)">Boxes ×25</td><td>${state.boxes[0] * 25}</td><td>${state.boxes[1] * 25}</td></tr>
                <tr><td style="font-family:var(--body)">Game bonus</td><td>${state.final.winner === 0 ? 100 : 0}</td><td>${state.final.winner === 1 ? 100 : 0}</td></tr>
                <tr class="total"><td style="font-family:var(--body)">Total${state.boxes[1 - state.final.winner] === 0 ? " (shutout ×2)" : ""}</td><td>${state.final.final[0]}</td><td>${state.final.final[1]}</td></tr>
              </tbody>
            </table>
          </div>`
      : html`<div class="card">
          <h2>${state.players[winner]} won the hand (tap the scoreboard to switch)</h2>
          <h2 style="margin-top:12px">How?</h2>
          <div class="btngrid c2">
            ${rules.KINDS.map(
              (k) => html`<button type="button" class=${kind === k.key ? "primary" : ""} onClick=${() => setKind(k.key)}>
                <div style="font-weight:600">${k.label}</div>
                <div style="font-size:12px;color:var(--chalk-dim)">${k.desc}</div>
              </button>`,
            )}
          </div>
          ${kind === "undercut"
            ? html`<p class="hint-line" style="color:var(--brass)">Winner above = the DEFENDER who undercut the knocker. A tie in deadwood counts (enter 0).</p>`
            : null}
          <h2 style="margin-top:12px">${kind === "gin" || kind === "biggin" ? "Their deadwood" : "Deadwood difference"}</h2>
          <div class="btngrid c6">
            ${Array.from({ length: 30 }, (_, i) => i).map(
              (n) => html`<button type="button" class=${points === n ? "primary" : ""} onClick=${() => setPoints(n)}>${n}</button>`,
            )}
          </div>
          <button type="button" class="ghost" style="width:100%;margin-top:8px" onClick=${() => setMorePoints(!morePoints)}>
            ${morePoints ? "Fewer" : "30–100…"}
          </button>
          ${morePoints
            ? html`<div class="btngrid c6" style="margin-top:8px">
                ${Array.from({ length: 71 }, (_, i) => i + 30).map(
                  (n) => html`<button type="button" class=${points === n ? "primary" : ""} onClick=${() => { setPoints(n); setMorePoints(false); }}>${n}</button>`,
                )}
              </div>`
            : null}
          <button
            type="button" class="primary" style="width:100%;margin-top:12px"
            disabled=${points == null}
            onClick=${() => { dispatch({ type: "hand", winner, kind, points }); setPoints(null); setKind("knock"); }}
          >Score hand${points != null ? ` · +${points + rules.KINDS.find((k) => k.key === kind).bonus}` : ""}</button>
          <button type="button" class="ghost" style="width:100%;margin-top:6px;font-size:13px"
            onClick=${() => dispatch({ type: "wall" })}
          >Wall — stock ran out, no score</button>
        </div>`}
    <div class="card"><h2>Hands</h2><${LogList} lines=${log} /></div>
  </div>`;
}
