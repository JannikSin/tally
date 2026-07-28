import { useState } from "preact/hooks";
import { html } from "htm/preact";
import * as rules from "./sheepshead.rules.js";
import { PlayerNames, Seg } from "../ui.js";

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
      <h2>Players, in seating order</h2>
      <${Seg}
        options=${[3, 4, 5, 6, 7].map((n) => ({ value: n, label: String(n) }))}
        value=${count}
        onChange=${setCount}
      />
      <div style="margin-top:12px">
        <${PlayerNames} count=${count} names=${names} onChange=${setNames} roster=${roster} />
      </div>
      <p class="hint-line">Seat 1 deals first; the deal rotates down the list.${count === 6 ? " The dealer sits out their own deal." : ""}${count === 7 ? " The dealer and the player to the dealer's right sit out." : ""} Losses pay double (bump), always.</p>
    </div>
    <div class="card">
      <h2>House rules</h2>
      <p class="hint-line">If everyone passes (leaster):</p>
      <div class="row wrap" style="margin-top:8px">
        ${LEASTER_RULES.map((o) => html`<button type="button" class=${leasterRule === o.value ? "primary" : ""} style="min-height:40px;padding:6px 12px;font-size:14px" onClick=${() => setLeasterRule(o.value)}>${o.label}</button>`)}
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

const RESULT_LABEL = {
  win: "Won", winSchneider: "Won, no schneider", winSchwarz: "Won, no trick",
  loss: "Lost", lossSchneider: "Lost, no schneider", lossSchwarz: "Lost, no trick",
  leaster: "Leaster",
};

export function Play({ state, dispatch, onDone, onUndo, canUndo }) {
  const n = state.players.length;
  const dealer = state.dealer || 0;
  const sitting = rules.autoSitters(n, dealer); // no exceptions, no overrides
  const active = state.players.map((_, i) => i).filter((i) => !sitting.includes(i));
  const [picker, setPicker] = useState(null);
  const [partner, setPartner] = useState(null);
  const [outcome, setOutcome] = useState(null); // result key | "leaster"
  const leasterRule = state.leasterRule || "fewest";
  const pendingDouble = state.pendingDouble || 1;
  const rows = state.rows || [];
  const clearSel = () => { setPicker(null); setPartner(null); setOutcome(null); };

  // left half = picker, right half = partner; tap toggles, tapping another
  // column steals the role; picker and partner can never be the same player
  const tapPicker = (i) => {
    if (sitting.includes(i)) return;
    if (picker === i) setPicker(null);
    else { setPicker(i); if (partner === i) setPartner(null); }
  };
  const tapPartner = (i) => {
    if (sitting.includes(i)) return;
    if (partner === i) setPartner(null);
    else { setPartner(i); if (picker === i) setPicker(null); }
  };

  const isLeaster = outcome === "leaster";
  const canScore =
    outcome != null && picker != null && (isLeaster || partner != null);
  const preview = canScore
    ? isLeaster
      ? rules.previewLeaster(state, active, picker)
      : rules.previewDeltas(state, active, picker, partner, outcome)
    : null;

  const scoreHand = () => {
    if (!canScore) return;
    if (isLeaster) dispatch({ type: "leaster", active, winner: picker });
    else dispatch({ type: "hand", active, picker, partner, result: outcome });
    clearSel();
  };
  // one undo button for everything: selections unwind first, then scored hands
  const undo = () => {
    if (outcome != null) setOutcome(null);
    else if (partner != null) setPartner(null);
    else if (picker != null) setPicker(null);
    else onUndo();
  };

  return html`<div>
    <div class="sheet-wrap">
      <div class="sheet" style=${`grid-template-columns: repeat(${n}, minmax(64px, 1fr))`}>
        ${state.players.map((p, i) => {
          const sits = sitting.includes(i);
          const cls = `hcell${sits ? " sitting" : ""}${picker === i ? " is-picker" : ""}${partner === i ? " is-partner" : ""}`;
          const t = state.totals[i];
          return html`<div class=${cls}>
            <div class="nm">${p}${i === dealer ? " ●" : ""}</div>
            <div class=${"tot" + (t > 0 ? " pos" : t < 0 ? " neg" : "")}>${t > 0 ? "+" + t : t}</div>
            <div class=${"role" + (picker === i ? " picker" : partner === i ? " partner" : "")}>
              ${picker === i ? (isLeaster ? "WINNER" : "PICKER") : partner === i ? "PARTNER" : sits ? "SITS" : i === dealer ? "DEALS" : " "}
            </div>
            <div class=${"delta" + (preview ? (preview[i] > 0 ? " pos" : preview[i] < 0 ? " neg" : "") : "")}>
              ${preview && preview[i] !== 0 ? (preview[i] > 0 ? "+" + preview[i] : preview[i]) : " "}
            </div>
            ${!sits
              ? html`
                  <button type="button" class="tapL" aria-label=${`${p}: picker`} onClick=${() => tapPicker(i)}></button>
                  <button type="button" class="tapR" aria-label=${`${p}: partner`} onClick=${() => tapPartner(i)}></button>`
              : null}
          </div>`;
        })}
        ${rows.slice().reverse().map((r) => html`
          ${state.players.map((_, i) => {
            const sits = r.sitters.includes(i);
            const t = r.totals[i];
            return html`<div class=${"rcell" + (sits ? " sitting" : "")}>
              ${t > 0 ? "+" + t : t}
              ${r.picker === i
                ? html`<span class="mark picker">${r.result === "leaster" ? "LSTR" : "P"}${r.bumped ? "·×2" : ""}</span>`
                : r.partner === i
                  ? html`<span class="mark partner">Pa</span>`
                  : r.dealer === i
                    ? html`<span class="mark dealer">D</span>`
                    : null}
            </div>`;
          })}`)}
      </div>
    </div>
    <div class="card">
      <h2>Score a hand</h2>
      <p class="hint-line">Tap the LEFT side of a column for picker, the RIGHT side for partner. Losses pay double, always.</p>
      ${pendingDouble > 1 ? html`<p class="hint-line" style="color:var(--brass)">Doubler active: this hand pays ×${pendingDouble}.</p>` : null}
      <div class="btngrid c2">
        ${rules.RESULTS.map(
          (r) => html`<button
            type="button"
            class=${outcome === r.key ? "primary" : ""}
            disabled=${picker == null || partner == null}
            onClick=${() => setOutcome(outcome === r.key ? null : r.key)}
          >
            <div style="font-weight:600" class=${r.win ? "" : "neg"}>${r.label}</div>
            <div style="font-size:12px;color:var(--chalk-dim)">${r.desc}</div>
          </button>`,
        )}
      </div>
      <div class="row" style="margin-top:8px">
        ${leasterRule === "doubler"
          ? html`<button type="button" class="ghost grow" style="font-size:13px"
              onClick=${() => { dispatch({ type: "redeal" }); clearSel(); }}
            >All passed — redeal, double next hand</button>`
          : html`<button
              type="button"
              class=${isLeaster ? "primary grow" : "grow"}
              disabled=${picker == null}
              onClick=${() => setOutcome(isLeaster ? null : "leaster")}
            >Won leaster${picker != null && isLeaster ? ` · ${state.players[picker]}` : ""}</button>`}
        ${leasterRule === "fewest"
          ? html`<button type="button" class="ghost" style="font-size:13px"
              onClick=${() => { dispatch({ type: "leaster", active, noWinner: true }); clearSel(); }}
            >Leaster tie</button>`
          : null}
      </div>
      ${isLeaster ? html`<p class="hint-line">Leaster: tap the winner's LEFT column half above.</p>` : null}
      <div class="row" style="margin-top:12px">
        <button type="button" class="grow" disabled=${!canUndo && picker == null && partner == null && outcome == null} onClick=${undo}>↺ Undo</button>
        <button type="button" class="primary grow" disabled=${!canScore} onClick=${scoreHand}>
          Score hand
        </button>
      </div>
    </div>
    <button type="button" style="width:100%" onClick=${onDone}>Finish session</button>
  </div>`;
}
