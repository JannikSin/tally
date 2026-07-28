import { useEffect, useRef, useState } from "preact/hooks";
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

export function Play({ state, dispatch, onDone, onUndo, canUndo }) {
  const n = state.players.length;
  const dealer = state.dealer || 0;
  const sitting = rules.autoSitters(n, dealer); // no exceptions, no overrides
  const active = state.players.map((_, i) => i).filter((i) => !sitting.includes(i));
  const [picker, setPicker] = useState(null);
  const [partner, setPartner] = useState(null); // same player as picker = going alone
  const [won, setWon] = useState(null); // true | false | null; Won and Lost exclusive
  const [mod, setMod] = useState(null); // "schneider" | "trick" | null; exclusive pair
  const [leaster, setLeaster] = useState(false);
  const [double, setDouble] = useState(1); // cycles 1 -> 2 -> 4 -> 6 -> 1
  const leasterRule = state.leasterRule || "fewest";
  const pendingDouble = state.pendingDouble || 1;
  const rows = state.rows || [];
  const clearSel = () => { setPicker(null); setPartner(null); setWon(null); setMod(null); setLeaster(false); setDouble(1); };

  // hands stack upward: the newest row sits just above the header, scroll up
  // through the sheet for the early hands
  const sheetRef = useRef(null);
  useEffect(() => {
    if (sheetRef.current) sheetRef.current.scrollTop = sheetRef.current.scrollHeight;
  }, [rows.length, n]);

  const tapPicker = (i) => {
    if (sitting.includes(i)) return;
    setPicker(picker === i ? null : i);
  };
  const tapPartner = (i) => {
    if (sitting.includes(i)) return;
    setPartner(partner === i ? null : i);
  };

  const resultKey = leaster
    ? "leaster"
    : won == null
      ? null
      : won
        ? mod === "schneider" ? "winSchneider" : mod === "trick" ? "winSchwarz" : "win"
        : mod === "schneider" ? "lossSchneider" : mod === "trick" ? "lossSchwarz" : "loss";
  const canScore = leaster ? picker != null : resultKey != null && picker != null && partner != null;
  const preview = canScore
    ? leaster
      ? rules.previewLeaster(state, active, picker, double)
      : rules.previewDeltas(state, active, picker, partner, resultKey, double)
    : null;

  const scoreHand = () => {
    if (!canScore) return;
    if (leaster) dispatch({ type: "leaster", active, winner: picker, doubleMult: double });
    else dispatch({ type: "hand", active, picker, partner, result: resultKey, doubleMult: double });
    clearSel();
  };
  // one undo for everything: selections unwind first, then scored hands
  const undo = () => {
    if (mod != null) setMod(null);
    else if (leaster) setLeaster(false);
    else if (won != null) setWon(null);
    else if (double > 1) setDouble(1);
    else if (partner != null) setPartner(null);
    else if (picker != null) setPicker(null);
    else onUndo();
  };

  const toggle = "min-height:52px;font-weight:600";
  return html`<div>
    <div class="sheet-wrap" ref=${sheetRef}>
      <div class="sheet" style=${`grid-template-columns: repeat(${n}, minmax(64px, 1fr))`}>
        ${rows.map((r) => html`
          ${state.players.map((_, i) => {
            const sits = r.sitters.includes(i);
            const t = r.totals[i];
            const aloneRow = r.picker != null && r.picker === r.partner;
            return html`<div class=${"rcell" + (sits ? " sitting" : "")}>
              ${t > 0 ? "+" + t : t}
              ${r.picker === i
                ? html`<span class="mark picker">${r.result === "leaster" ? "LSTR" : aloneRow ? "P·A" : "P"}${r.doubler > 1 ? `·×${r.doubler}` : r.bumped ? "·×2" : ""}</span>`
                : r.partner === i
                  ? html`<span class="mark partner">Pa</span>`
                  : r.dealer === i
                    ? html`<span class="mark dealer">D</span>`
                    : null}
            </div>`;
          })}`)}
        ${state.players.map((p, i) => {
          const sits = sitting.includes(i);
          const alone = picker === i && partner === i;
          const cls = `hcell${sits ? " sitting" : ""}${picker === i ? " is-picker" : ""}${partner === i ? " is-partner" : ""}`;
          const t = state.totals[i];
          return html`<div class=${cls}>
            <div class="nm">${p}${i === dealer ? " ●" : ""}</div>
            <div class=${"tot" + (t > 0 ? " pos" : t < 0 ? " neg" : "")}>${t > 0 ? "+" + t : t}</div>
            <div class=${"role" + (picker === i ? " picker" : partner === i ? " partner" : "")}>
              ${alone ? "ALONE" : picker === i ? (leaster ? "WINNER" : "PICKER") : partner === i ? "PARTNER" : sits ? "SITS" : i === dealer ? "DEALS" : " "}
            </div>
            <div class=${"delta" + (preview ? (preview[i] > 0 ? " pos" : preview[i] < 0 ? " neg" : "") : "")}>
              ${preview && preview[i] !== 0 ? (preview[i] > 0 ? "+" + preview[i] : preview[i]) : " "}
            </div>
            ${!sits
              ? html`
                  <button type="button" class="tapL" aria-label=${`${p}: picker`} onClick=${() => tapPicker(i)}></button>
                  <button type="button" class="tapR" aria-label=${`${p}: partner`} onClick=${() => tapPartner(i)}></button>`
              : null}
          </div>`;
        })}
      </div>
    </div>
    <div class="card">
      ${pendingDouble > 1 ? html`<p class="hint-line" style="color:var(--brass)">Redeal doubler active: this hand pays ×${pendingDouble} extra.</p>` : null}
      <div class="btngrid c2">
        <button type="button" style=${toggle} class=${won === true ? "primary" : ""}
          onClick=${() => { setWon(won === true ? null : true); setLeaster(false); }}>Won</button>
        <button type="button" style=${toggle} class=${won === false ? "primary" : ""}
          onClick=${() => { setWon(won === false ? null : false); setLeaster(false); }}><span class=${won === false ? "" : "neg"}>Lost</span></button>
        <button type="button" style=${toggle} class=${mod === "schneider" ? "primary" : ""}
          onClick=${() => { setMod(mod === "schneider" ? null : "schneider"); setLeaster(false); }}>No schneider</button>
        <button type="button" style=${toggle} class=${mod === "trick" ? "primary" : ""}
          onClick=${() => { setMod(mod === "trick" ? null : "trick"); setLeaster(false); }}>No trick</button>
        <button type="button" style=${toggle} class=${leaster ? "primary" : ""}
          onClick=${() => {
            if (leasterRule === "doubler") { dispatch({ type: "redeal" }); clearSel(); return; }
            const next = !leaster;
            setLeaster(next);
            if (next) { setWon(null); setMod(null); }
          }}>${leasterRule === "doubler" ? "Redeal ×2" : "Leaster"}</button>
        <button type="button" style=${toggle} class=${double > 1 ? "primary" : ""}
          onClick=${() => setDouble(double === 1 ? 2 : double === 2 ? 4 : double === 4 ? 6 : 1)}
        >Double${double > 1 ? ` ×${double}` : ""}</button>
      </div>
      ${leaster && leasterRule === "fewest"
        ? html`<button type="button" class="ghost" style="width:100%;margin-top:8px;font-size:13px"
            onClick=${() => { dispatch({ type: "leaster", active, noWinner: true }); clearSel(); }}
          >Tie, no score</button>`
        : null}
      <div class="row" style="margin-top:12px">
        <button type="button" class="ghost" style="font-size:13px;min-height:44px"
          disabled=${!canUndo && picker == null && partner == null && won == null && mod == null && !leaster && double === 1}
          onClick=${undo}>↺ Undo</button>
        <button type="button" class="primary grow" disabled=${!canScore} onClick=${scoreHand}>Score hand</button>
      </div>
    </div>
    <button type="button" style="width:100%" onClick=${onDone}>Finish session</button>
  </div>`;
}
