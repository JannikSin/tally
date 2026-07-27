import { useState } from "preact/hooks";
import { html } from "htm/preact";
import * as rules from "./ohhell.rules.js";
import { PlayerNames, LogList, OverBanner, Seg, Stepper } from "../ui.js";

export const meta = rules.meta;
export { rules };

export function Setup({ onStart, roster, history }) {
  const [count, setCount] = useState(4);
  const [names, setNames] = useState(Array(7).fill(""));
  const [mode, setMode] = useState("down");
  const [scoring, setScoring] = useState("exact10");
  const [hook, setHook] = useState(true);
  const [maxCards, setMaxCards] = useState(rules.maxHand(4));
  return html`<div>
    <div class="card">
      <h2>Players</h2>
      <${Seg}
        options=${[3, 4, 5, 6, 7].map((n) => ({ value: n, label: String(n) }))}
        value=${count}
        onChange=${(n) => { setCount(n); setMaxCards(Math.min(rules.maxHand(n), maxCards)); }}
      />
      <div style="margin-top:12px">
        <${PlayerNames} count=${count} names=${names} onChange=${setNames} roster=${roster} />
      </div>
    </div>
    <div class="card">
      <h2>Rounds</h2>
      <${Stepper} label="Biggest hand" value=${maxCards} min=${3} max=${rules.maxHand(count)} onChange=${setMaxCards} />
      <div class="btngrid c2" style="margin-top:10px">
        ${[
          { value: "down", label: `${maxCards} down to 1` },
          { value: "downup", label: "Down and back up" },
          { value: "up", label: `1 up to ${maxCards}` },
          { value: "updown", label: "Up and back down" },
        ].map(
          (o) => html`<button type="button" class=${mode === o.value ? "primary" : ""} onClick=${() => setMode(o.value)}>${o.label}</button>`,
        )}
      </div>
      <h2 style="margin-top:14px">Scoring</h2>
      <${Seg}
        options=${[{ value: "exact10", label: "10 + bid, exact only" }, { value: "tricks10", label: "Tricks + 10 bonus" }]}
        value=${scoring}
        onChange=${setScoring}
      />
      <div class="row" style="margin-top:10px">
        <button type="button" class=${hook ? "primary" : "ghost"} style="font-size:13px" onClick=${() => setHook(!hook)}>
          Dealer hook rule ${hook ? "on" : "off"}
        </button>
      </div>
      <p class="hint-line">Hook rule: the dealer's bid may not make total bids equal the tricks available.</p>
    </div>
    <button
      type="button" class="primary" style="width:100%"
      onClick=${() => onStart({
        players: Array.from({ length: count }, (_, i) => names[i]?.trim() || `Player ${i + 1}`),
        maxCards, mode, scoring, hook,
      })}
    >Deal the first hand</button>
    ${history.length
      ? html`<div class="card" style="margin-top:12px"><h2>Past games</h2>
          ${history.slice(-5).reverse().map((h) => html`<p class="hint-line">${h.line}</p>`)}
        </div>`
      : null}
  </div>`;
}

export function Play({ state, log, dispatch, onRematch, onDone }) {
  const n = state.players.length;
  const cards = state.seq[state.round];
  const [entry, setEntry] = useState(Array(n).fill(0));
  const sum = rules.summary(state);
  const dealer = rules.dealerIndex(state);
  const entrySum = entry.reduce((a, b) => a + b, 0);
  const bidPhase = state.phase === "bid";
  const evenBids = bidPhase && entrySum === cards;
  const hooked = evenBids && state.hook !== false; // hook off: warn, don't block
  const trickOk = !bidPhase && entrySum === cards;
  const best = Math.max(...state.totals);

  return html`<div>
    <div class="card">
      <h2>Totals</h2>
      <table class="ledger">
        <tbody>
          ${state.players.map(
            (p, i) => html`<tr>
              <td style="font-family:var(--body)">${p}${i === dealer && !state.over ? html`<span class="warn"> · deals</span>` : null}</td>
              <td class=${state.totals[i] === best && best > 0 ? "pos" : ""}>${state.totals[i]}</td>
            </tr>`,
          )}
        </tbody>
      </table>
    </div>
    ${sum.done
      ? html`<${OverBanner} line=${sum.line} onRematch=${onRematch} onDone=${onDone} />`
      : html`<div class="card">
          <h2>Round ${state.round + 1} of ${state.seq.length} · ${cards} card${cards === 1 ? "" : "s"} · ${bidPhase ? "bids" : "tricks taken"}</h2>
          ${state.players.map(
            (p, i) => html`<${Stepper}
              label=${bidPhase ? p : `${p} (bid ${state.bids[i]})`}
              value=${entry[i]}
              min=${0}
              max=${cards}
              onChange=${(v) => { const e = entry.slice(); e[i] = v; setEntry(e); }}
            />`,
          )}
          <p class="hint-line">
            ${bidPhase
              ? hooked
                ? html`<span class="warn">Bids total ${entrySum} — the dealer can't make it come out even.</span>`
                : evenBids
                  ? html`<span class="warn">Bids come out even — someone has to miss.</span>`
                  : `Bids total ${entrySum} of ${cards}.`
              : `Tricks total ${entrySum}; must equal ${cards}.`}
          </p>
          <button
            type="button" class="primary" style="width:100%"
            disabled=${bidPhase ? hooked : !trickOk}
            onClick=${() => {
              dispatch(bidPhase ? { type: "bids", bids: entry } : { type: "tricks", tricks: entry });
              setEntry(Array(n).fill(0));
            }}
          >${bidPhase ? "Lock bids" : "Score round"}</button>
        </div>`}
    <div class="card"><h2>Rounds</h2><${LogList} lines=${log} /></div>
  </div>`;
}
