import { useEffect, useState } from "preact/hooks";
import { html } from "htm/preact";
import * as rules from "./sheepshead.rules.js";
import { PlayerNames, ScoreBand, LogList, Seg } from "../ui.js";

export const meta = rules.meta;
export { rules };

const LEASTER_RULES = [
  { value: "fewest", label: "Fewest points, tie = push" },
  { value: "trick", label: "Fewest points, first trick breaks tie" },
  { value: "jackOfDiamonds", label: "Jack of diamonds takes it" },
  { value: "doubler", label: "No leaster — redeal, next hand doubles" },
];

export function Setup({ onStart, roster, history }) {
  const [count, setCount] = useState(5);
  const [names, setNames] = useState(Array(7).fill(""));
  const [leasterRule, setLeasterRule] = useState("fewest");
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
    <div class="card">
      <h2>House rules</h2>
      <p class="hint-line">If everyone passes (leaster):</p>
      <div class="row wrap" style="margin-top:8px">
        ${LEASTER_RULES.map((o) => html`<${Chip} on=${leasterRule === o.value} onClick=${() => setLeasterRule(o.value)}>${o.label}<//>`)}
      </div>
    </div>
    <button
      type="button" class="primary" style="width:100%"
      onClick=${() => onStart({ players: Array.from({ length: count }, (_, i) => names[i]?.trim() || `Player ${i + 1}`), leasterRule })}
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
  const dealer = state.dealer || 0;
  // sitters follow the deal automatically; tapping the chips overrides for one hand
  const [sitOverride, setSitOverride] = useState(null);
  const [picker, setPicker] = useState(null);
  const [partner, setPartner] = useState(null); // null = alone
  const [crack, setCrack] = useState(1);
  const [leaster, setLeaster] = useState(false);
  useEffect(() => setSitOverride(null), [dealer, n]);
  const sitting = sitOverride ?? rules.autoSitters(n, dealer);
  const active = state.players.map((_, i) => i).filter((i) => !sitting.includes(i));
  const okSitters = sitting.length === seats;
  const leasterRule = state.leasterRule || "fewest"; // old sessions predate this field
  const pendingDouble = state.pendingDouble || 1;
  const reset = () => { setPicker(null); setPartner(null); setCrack(1); setLeaster(false); setSitOverride(null); };
  const partnerAllowed = active.length >= 4; // called-ace works 4- and 5-handed

  return html`<div>
    <${ScoreBand}
      signed
      cells=${state.players.map((p, i) => ({
        who: p,
        pts: state.totals[i],
        dealer: i === dealer,
        sitting: seats > 0 && sitting.includes(i),
      }))}
    />
    <div class="card">
      <h2>Score a hand</h2>
      <div class="row wrap" style="margin-bottom:8px">
        <button type="button" class="ghost" style="font-size:13px;padding:4px 10px;min-height:36px"
          onClick=${() => dispatch({ type: "setDealer", dealer: (dealer + 1) % n })}
        >Dealer: ${state.players[dealer]} · tap if wrong</button>
      </div>
      ${pendingDouble > 1 ? html`<p class="hint-line">Doubler active from a redeal: this hand pays ×${pendingDouble}.</p>` : null}
      ${seats > 0
        ? html`<p class="hint-line">Sitting out this hand (dealer sits their own deal${n === 7 ? ", plus the next seat" : ""}; tap to override):</p>
            <div class="row wrap" style="margin-bottom:10px">
              ${state.players.map(
                (p, i) => html`<${Chip}
                  on=${sitting.includes(i)}
                  onClick=${() => {
                    const cur = sitting.includes(i)
                      ? sitting.filter((x) => x !== i)
                      : sitting.length < seats
                        ? [...sitting, i]
                        : sitting;
                    setSitOverride(cur);
                  }}
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
              ? leasterRule === "doubler"
                ? html`<p class="hint-line">House rule: no leaster. Redeal the hand; the next hand pays double.</p>
                    <${Chip} onClick=${() => { dispatch({ type: "redeal" }); reset(); }}>Redeal, double next hand<//>`
                : html`<p class="hint-line">${
                    leasterRule === "trick"
                      ? "Fewest points wins; a tie is broken by whoever took the first trick."
                      : leasterRule === "jackOfDiamonds"
                        ? "Whoever takes the jack of diamonds wins outright."
                        : "Fewest points with at least one trick wins."
                  }</p>
                    <div class="row wrap">
                      ${active.map((i) => html`<${Chip} onClick=${() => { dispatch({ type: "leaster", active, winner: i }); reset(); }}>${state.players[i]} won<//>`)}
                      ${leasterRule === "fewest" ? html`<${Chip} onClick=${() => { dispatch({ type: "leaster", active, noWinner: true }); reset(); }}>Tie, no score<//>` : null}
                    </div>`
              : html`
                  <p class="hint-line">Picker:</p>
                  <div class="row wrap" style="margin-bottom:8px">
                    ${active.map((i) => html`<${Chip} on=${picker === i} onClick=${() => { setPicker(i); if (partner === i) setPartner(null); }}>${state.players[i]}<//>`)}
                  </div>
                  ${picker != null && partnerAllowed
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
                          ${[[1, "Clean"], [2, "Cracked ×2"], [4, "Recracked ×4"]].map(
                            ([v, label]) => html`<${Chip} on=${crack === v} onClick=${() => setCrack(v)}>${label}<//>`,
                          )}
                        </div>
                        <p class="hint-line">Schwarz outranks schneider: check tricks taken before card points.</p>
                        <div class="btngrid c2">
                          ${rules.RESULTS.map(
                            (r) => html`<button type="button" onClick=${() => { dispatch({ type: "hand", active, picker, partner, result: r.key, crack }); reset(); }}>
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
