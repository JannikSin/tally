import { useState } from "preact/hooks";
import { html } from "htm/preact";
import * as rules from "./bridge.rules.js";
import { LogList, OverBanner, Seg } from "../ui.js";

export const meta = rules.meta;
export { rules };

export function Setup({ onStart, history }) {
  const [teams, setTeams] = useState(["We", "They"]);
  return html`<div>
    <div class="card">
      <h2>Sides</h2>
      ${[0, 1].map(
        (i) => html`<div class="row" style="margin-bottom:8px">
          <input type="text" value=${teams[i]} onInput=${(e) => {
            const t = teams.slice(); t[i] = e.target.value.slice(0, 24); setTeams(t);
          }} />
        </div>`,
      )}
    </div>
    <button type="button" class="primary" style="width:100%"
      onClick=${() => onStart({ teams: teams.map((t) => t.trim() || "Side"), players: [] })}
    >Start rubber</button>
    ${history.length
      ? html`<div class="card" style="margin-top:12px"><h2>Past rubbers</h2>
          ${history.slice(-5).reverse().map((h) => html`<p class="hint-line">${h.line}</p>`)}
        </div>`
      : null}
  </div>`;
}

function Pad({ state }) {
  const t = rules.totals(state);
  return html`<div class="card">
    <h2>Score pad</h2>
    <div style="display:grid;grid-template-columns:1fr 1fr;border:1px solid var(--line);border-radius:12px;overflow:hidden">
      ${[0, 1].map(
        (i) => html`<div style=${`padding:8px 12px;${i === 0 ? "border-right:1px solid var(--line);" : ""}`}>
          <div style="text-align:center;font-weight:600;color:var(--chalk-dim);padding-bottom:6px">
            ${state.teams[i]}${state.vul[i] ? html`<span class="warn"> · vul</span>` : null}
          </div>
          <div style="min-height:70px">
            ${state.aboveLog[i].map((e) => html`<div class="num" style="text-align:right;font-size:15px">${e.pts}</div>`)}
          </div>
        </div>`,
      )}
      <div style="grid-column:1/3;border-top:2px solid var(--chalk-dim)"></div>
      ${state.belowGames.map(
        (g, gi) => html`
          ${[0, 1].map(
            (i) => html`<div style=${`padding:6px 12px;min-height:34px;${i === 0 ? "border-right:1px solid var(--line);" : ""}${gi < state.belowGames.length - 1 ? "border-bottom:1px solid var(--line);" : ""}`}>
              ${g.entries[i].map((e) => html`<div class="num" style="text-align:right;font-size:15px">${e.pts} <span style="color:var(--chalk-dim);font-size:11px">${e.note}</span></div>`)}
              ${g.winner === i ? html`<div style="text-align:right;font-size:11px;color:var(--brass)">game</div>` : null}
            </div>`,
          )}`,
      )}
      <div style="grid-column:1/3;border-top:1px solid var(--line)"></div>
      ${[0, 1].map(
        (i) => html`<div style=${`padding:8px 12px;${i === 0 ? "border-right:1px solid var(--line);" : ""}`}>
          <div class="num" style="text-align:right;font-size:22px;font-weight:700">${t[i]}</div>
        </div>`,
      )}
    </div>
  </div>`;
}

export function Play({ state, log, dispatch, onRematch, onDone }) {
  const [declarer, setDeclarer] = useState(0);
  const [level, setLevel] = useState(0);
  const [strain, setStrain] = useState(null);
  const [dbl, setDbl] = useState(0);
  const sum = rules.summary(state);
  const reset = () => { setLevel(0); setStrain(null); setDbl(0); };
  const ready = level > 0 && strain;
  const overMax = ready ? 7 - level : 0;
  const downMax = ready ? level + 6 : 0;

  return html`<div>
    ${sum.done ? html`<${OverBanner} line=${sum.line} onRematch=${onRematch} onDone=${onDone} />` : null}
    <${Pad} state=${state} />
    ${!sum.done
      ? html`<div class="card">
          <h2>Contract</h2>
          <${Seg} options=${[0, 1].map((i) => ({ value: i, label: state.teams[i] + (state.vul[i] ? " (vul)" : "") }))} value=${declarer} onChange=${setDeclarer} />
          <div class="btngrid c4" style="margin-top:10px">
            ${[1, 2, 3, 4, 5, 6, 7].map(
              (l) => html`<button type="button" class=${l === level ? "primary" : ""} onClick=${() => setLevel(l)}>${l}</button>`,
            )}
          </div>
          <div class="btngrid c6" style="margin-top:8px">
            ${rules.STRAINS.map(
              (st) => html`<button type="button" class=${st === strain ? "primary" : ""}
                style=${st === "H" || st === "D" ? "color:#ff8f7a" : ""}
                onClick=${() => setStrain(st)}>${rules.STRAIN_LABEL[st]}</button>`,
            )}
            <button type="button" class=${dbl > 0 ? "primary" : ""} onClick=${() => setDbl((dbl + 1) % 3)}>
              ${dbl === 2 ? "××" : dbl === 1 ? "×" : "dbl?"}
            </button>
          </div>
          ${ready
            ? html`<h2 style="margin-top:14px">Result</h2>
                <div class="btngrid c4">
                  ${Array.from({ length: overMax + 1 }, (_, i) => html`<button type="button" class="primary"
                    onClick=${() => { dispatch({ type: "contract", declarer, level, strain, dbl, tricks: i }); reset(); }}
                  >${i === 0 ? "Made =" : `+${i}`}</button>`)}
                  ${Array.from({ length: downMax }, (_, i) => html`<button type="button"
                    onClick=${() => { dispatch({ type: "contract", declarer, level, strain, dbl, tricks: -(i + 1) }); reset(); }}
                  ><span class="neg">−${i + 1}</span></button>`)}
                </div>`
            : html`<p class="hint-line">Pick level and strain, then score the result.</p>`}
          <h2 style="margin-top:14px">Bonuses</h2>
          <div class="btngrid c3">
            <button type="button" onClick=${() => dispatch({ type: "honors", side: declarer, kind: "h4" })}>Honors 100</button>
            <button type="button" onClick=${() => dispatch({ type: "honors", side: declarer, kind: "h5" })}>Honors 150</button>
            <button type="button" onClick=${() => dispatch({ type: "abandon" })}>End rubber</button>
          </div>
          <p class="hint-line">Honors go to the side picked above. All five trump honors or four aces at NT = 150; four trump honors = 100 (one hand only).</p>
        </div>`
      : null}
    <div class="card"><h2>Hands</h2><${LogList} lines=${log} /></div>
  </div>`;
}
