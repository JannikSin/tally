import { useState } from "preact/hooks";
import { html } from "htm/preact";
import * as rules from "./sheepshead.rules.js";
import { PlayerNames, LogList, Seg } from "../ui.js";

export const meta = rules.meta;
export { rules };

export function Setup({ onStart, roster, history }) {
  const [count, setCount] = useState(5);
  const [names, setNames] = useState(Array(7).fill(""));
  return html`<div>
    <div class="card">
      <h2>Players</h2>
      <${Seg}
        options=${[3, 4, 5, 6, 7].map((n) => ({ value: n, label: String(n) }))}
        value=${count}
        onChange=${setCount}
      />
      <div style="margin-top:12px">
        <${PlayerNames} count=${count} names=${names} onChange=${setNames} roster=${roster} />
      </div>
      ${count > 5 ? html`<p class="hint-line">Hands play five-handed; pick who sits out each hand.</p>` : null}
    </div>
    <button
      type="button" class="primary" style="width:100%"
      onClick=${() => onStart({ players: Array.from({ length: count }, (_, i) => names[i]?.trim() || `Player ${i + 1}`) })}
    >Start session</button>
    ${history.length
      ? html`<div class="card" style="margin-top:12px"><h2>Past sessions</h2>
          ${history.slice(-5).reverse().map((h) => html`<p class="hint-line">${h.line}</p>`)}
        </div>`
      : null}
  </div>`;
}

function Chip({ on, dim, onClick, children }) {
  return html`<button
    type="button"
    class=${on ? "primary" : ""}
    style=${`min-height:40px;padding:6px 12px;font-size:14px;${dim ? "opacity:0.4;" : ""}`}
    onClick=${onClick}
  >${children}</button>`;
}

export function Play({ state, log, dispatch, onDone }) {
  const n = state.players.length;
  const seats = n - Math.min(n, 5);
  const [sitting, setSitting] = useState([]);
  const [picker, setPicker] = useState(null);
  const [partner, setPartner] = useState(null); // null = alone
  const [doubled, setDoubled] = useState(false);
  const [leaster, setLeaster] = useState(false);
  const active = state.players.map((_, i) => i).filter((i) => !sitting.includes(i));
  const okSitters = sitting.length === seats;
  const reset = () => { setPicker(null); setPartner(null); setDoubled(false); setLeaster(false); setSitting([]); };
  const fiveHanded = active.length === 5;

  return html`<div>
    <div class="card">
      <h2>Standings</h2>
      <table class="ledger">
        <tbody>
          ${state.players
            .map((p, i) => ({ p, t: state.totals[i] }))
            .sort((a, b) => b.t - a.t)
            .map(
              (x) => html`<tr>
                <td style="font-family:var(--body)">${x.p}</td>
                <td class=${x.t < 0 ? "neg" : x.t > 0 ? "pos" : ""}>${x.t > 0 ? "+" : ""}${x.t}</td>
              </tr>`,
            )}
        </tbody>
      </table>
    </div>
    <div class="card">
      <h2>Score a hand</h2>
      ${seats > 0
        ? html`<p class="hint-line">Sitting out (${sitting.length}/${seats}):</p>
            <div class="row wrap" style="margin-bottom:10px">
              ${state.players.map(
                (p, i) => html`<${Chip}
                  on=${sitting.includes(i)}
                  onClick=${() => setSitting(sitting.includes(i) ? sitting.filter((x) => x !== i) : sitting.length < seats ? [...sitting, i] : sitting)}
                >${p}<//>`,
              )}
            </div>`
        : null}
      ${okSitters
        ? html`
            <div class="row" style="margin-bottom:10px">
              <${Chip} on=${leaster} onClick=${() => { setLeaster(!leaster); setPicker(null); setPartner(null); }}>Leaster (all passed)<//>
            </div>
            ${leaster
              ? html`<p class="hint-line">Fewest points with at least one trick wins.</p>
                  <div class="row wrap">
                    ${active.map((i) => html`<${Chip} onClick=${() => { dispatch({ type: "leaster", active, winner: i }); reset(); }}>${state.players[i]} won<//>`)}
                    <${Chip} onClick=${() => { dispatch({ type: "leaster", active, noWinner: true }); reset(); }}>Tie, no score<//>
                  </div>`
              : html`
                  <p class="hint-line">Picker:</p>
                  <div class="row wrap" style="margin-bottom:8px">
                    ${active.map((i) => html`<${Chip} on=${picker === i} onClick=${() => { setPicker(i); if (partner === i) setPartner(null); }}>${state.players[i]}<//>`)}
                  </div>
                  ${picker != null && fiveHanded
                    ? html`<p class="hint-line">Partner:</p>
                        <div class="row wrap" style="margin-bottom:8px">
                          <${Chip} on=${partner === null} onClick=${() => setPartner(null)}>Alone<//>
                          ${active.filter((i) => i !== picker).map(
                            (i) => html`<${Chip} on=${partner === i} onClick=${() => setPartner(i)}>${state.players[i]}<//>`,
                          )}
                        </div>`
                    : null}
                  ${picker != null
                    ? html`
                        <div class="row" style="margin:6px 0 10px">
                          <${Chip} on=${doubled} onClick=${() => setDoubled(!doubled)}>Doubled ×2<//>
                        </div>
                        <div class="btngrid c2">
                          ${rules.RESULTS.map(
                            (r) => html`<button type="button" onClick=${() => { dispatch({ type: "hand", active, picker, partner, result: r.key, doubled }); reset(); }}>
                              <div style="font-weight:600" class=${r.win ? "" : "neg"}>${r.label}</div>
                              <div style="font-size:12px;color:var(--chalk-dim)">${r.desc}</div>
                            </button>`,
                          )}
                        </div>`
                    : null}
                `}
          `
        : null}
    </div>
    <div class="card"><h2>Hands</h2><${LogList} lines=${log} /></div>
    <button type="button" style="width:100%" onClick=${onDone}>Finish session</button>
  </div>`;
}
