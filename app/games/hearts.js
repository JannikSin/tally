import { useEffect, useRef, useState } from "preact/hooks";
import { html } from "htm/preact";
import * as rules from "./hearts.rules.js";
import { PlayerNames, Seg, OverBanner } from "../ui.js";

export const meta = rules.meta;
export { rules };

const TARGETS = [50, 100, 150];

export function Setup({ onStart, roster, history }) {
  const [count, setCount] = useState(4);
  const [names, setNames] = useState(Array(6).fill(""));
  const [target, setTarget] = useState(100);
  return html`<div>
    <div class="card">
      <h2>Players, in seating order</h2>
      <${Seg}
        options=${[3, 4, 5, 6].map((n) => ({ value: n, label: String(n) }))}
        value=${count}
        onChange=${setCount}
      />
      <div style="margin-top:12px">
        <${PlayerNames} count=${count} names=${names} onChange=${setNames} roster=${roster} />
      </div>
      <p class="hint-line">
        Seat 1 deals first; the deal rotates down the list and the pass rotates with it.
        ${count % 2 === 0 ? " Left, right, across, hold." : " No seat sits across, so the pass runs left, right, hold."}
      </p>
    </div>
    <div class="card">
      <h2>Game ends at</h2>
      <${Seg} options=${TARGETS.map((t) => ({ value: t, label: String(t) }))} value=${target} onChange=${setTarget} />
      <p class="hint-line">
        Twenty-six points every hand: thirteen hearts and the queen. Lowest score wins when
        someone reaches ${target}; a tie at the bottom plays on.
      </p>
    </div>
    <button
      type="button" class="primary" style="width:100%"
      onClick=${() => onStart({ players: Array.from({ length: count }, (_, i) => names[i]?.trim() || `Player ${i + 1}`), target })}
    >Deal the first hand</button>
    ${history.length
      ? html`<div class="card" style="margin-top:12px"><h2>Past games</h2>
          ${history.slice(-5).reverse().map((h) => html`<p class="hint-line">${h.line}</p>`)}
        </div>`
      : null}
  </div>`;
}

export function Play({ state, dispatch, onRematch, onDone, onUndo, canUndo }) {
  const n = state.players.length;
  const dealer = state.dealer || 0;
  const rows = state.rows || [];
  // hearts are typed, so they live as strings and an empty box reads as zero
  const [hearts, setHearts] = useState(Array(n).fill(""));
  const [queen, setQueen] = useState(null);
  const sum = rules.summary(state);

  // a scored hand or an undo wipes the entry row, so stale numbers never leak
  // into the next hand
  useEffect(() => { setHearts(Array(n).fill("")); setQueen(null); }, [state.hands, n]);

  // hands stack upward: the newest row sits just above the header, scroll up
  // through the sheet for the early hands
  const sheetRef = useRef(null);
  useEffect(() => {
    if (sheetRef.current) sheetRef.current.scrollTop = sheetRef.current.scrollHeight;
  }, [rows.length, n]);

  const taken = hearts.map((h) => parseInt(h, 10) || 0);
  const heartsIn = taken.reduce((a, b) => a + b, 0);
  const points = taken.map((h, i) => h + (queen === i ? rules.QUEEN : 0));
  const complete = heartsIn === rules.HEARTS && queen != null;
  const moon = complete ? rules.moonIndex(points) : -1;
  const preview = complete ? rules.handDeltas(points) : null;
  const pass = rules.passDirection(state.hands, n);
  const low = Math.min(...state.totals);

  // only thirteen hearts exist, so nobody can be given more than are left
  const roomFor = (i) => rules.HEARTS - (heartsIn - taken[i]);
  const setHeart = (i, v) => {
    const digits = String(v).replace(/\D/g, "");
    const next = hearts.slice();
    next[i] = digits === "" ? "" : String(Math.min(parseInt(digits, 10), roomFor(i)));
    setHearts(next);
  };
  const clear = () => { setHearts(Array(n).fill("")); setQueen(null); };
  // one undo for everything: the entry row unwinds first, then scored hands
  const undo = () => {
    if (queen != null) setQueen(null);
    else if (heartsIn > 0) setHearts(Array(n).fill(""));
    else onUndo();
  };
  const score = () => {
    if (!complete) return;
    dispatch({ type: "hand", points, queen });
    clear();
  };

  return html`<div>
    <div class="sheet-wrap" ref=${sheetRef}>
      <div class="sheet" style=${`grid-template-columns: repeat(${n}, minmax(64px, 1fr))`}>
        ${rows.map((r) => state.players.map((_, i) => html`<div class="rcell">
          ${r.points[i] ? html`<span class="corner tl hand">+${r.points[i]}</span>` : null}
          ${r.dealer === i ? html`<span class="corner tr">D</span>` : null}
          ${r.totals[i]}
          ${r.moon === i
            ? html`<span class="mark moon">MOON</span>`
            : r.queen === i
              ? html`<span class="mark queen">Q♠</span>`
              : null}
        </div>`))}
        ${state.players.map((p, i) => {
          // the brass leader tint only means something once a hand has been scored
          const tint = state.hands > 0 && state.totals[i] === low ? "color:var(--brass)" : "";
          return html`<div class="hcell">
            <div class="nm" style=${tint}>${p}${i === dealer && !state.over ? " ●" : ""}</div>
            <div class="tot" style=${tint}>${state.totals[i]}</div>
            <div class=${"role" + (moon === i ? " moon" : queen === i ? " queen" : "")}>
              ${moon === i ? "MOON" : queen === i ? "Q♠" : i === dealer && !state.over ? "DEALS" : " "}
            </div>
            <div class=${"delta" + (preview ? (preview[i] > 0 ? " pain" : " pos") : "")}>
              ${preview ? (preview[i] > 0 ? "+" + preview[i] : "0") : " "}
            </div>
          </div>`;
        })}
      </div>
    </div>
    ${sum.done
      ? html`<${OverBanner} line=${sum.line} onRematch=${onRematch} onDone=${onDone} />`
      : html`<div class="card">
          <h2>Hand ${state.hands + 1} · pass ${pass} · ${state.players[dealer]} deals</h2>
          ${state.players.map((p, i) => {
            const room = roomFor(i);
            return html`<div class="row" style="margin-bottom:8px;gap:8px">
              <span class="hint-line grow" style="margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                ${p}${i === dealer ? " ●" : ""}
              </span>
              <button
                type="button"
                style="min-width:44px;min-height:44px;font-size:20px"
                aria-label=${`${p}: one heart fewer`}
                disabled=${taken[i] <= 0}
                onClick=${() => setHeart(i, taken[i] - 1)}
              >−</button>
              <input
                type="text" inputmode="numeric" pattern="[0-9]*" placeholder="0"
                class="num"
                style="width:70px;text-align:center;font-size:17px;padding:8px 4px"
                aria-label=${`${p}: hearts taken`}
                value=${hearts[i]}
                onInput=${(e) => setHeart(i, e.target.value)}
              />
              <button
                type="button"
                style="min-width:44px;min-height:44px;font-size:20px"
                aria-label=${`${p}: one heart more`}
                disabled=${taken[i] >= room}
                onClick=${() => setHeart(i, taken[i] + 1)}
              >+</button>
              <button
                type="button"
                class=${queen === i ? "primary" : ""}
                style="min-height:44px;padding:4px 10px;font-size:13px"
                aria-label=${`${p} took the queen of spades`}
                onClick=${() => setQueen(queen === i ? null : i)}
              >Q♠</button>
              <span
                class="num"
                style=${`min-width:2.6em;text-align:right;font-size:16px;color:${points[i] ? "var(--loss)" : "var(--chalk-dim)"}`}
              >${points[i] ? "+" + points[i] : "0"}</span>
            </div>`;
          })}
          <p class="hint-line" style="margin-top:2px">Hearts are 1 each, the queen is 13. Type the hearts, tap Q♠ for the queen.</p>
          <p class="hint-line">
            ${moon >= 0
              ? html`<span style="color:var(--brass)">${state.players[moon]} shot the moon: 0 for them, +26 for everyone else.</span>`
              : complete
                ? "All 26 points placed."
                : html`<span class="warn">Hearts ${heartsIn} of 13${queen == null ? " · the queen is still loose" : ""}.</span>`}
          </p>
          <div class="row" style="margin-top:12px">
            <button
              type="button" class="ghost" style="font-size:13px;min-height:44px"
              disabled=${!canUndo && heartsIn === 0 && queen == null}
              onClick=${undo}
            >↺ Undo</button>
            <button type="button" class="primary grow" disabled=${!complete} onClick=${score}>Score hand</button>
          </div>
          <button
            type="button" class="ghost" style="width:100%;margin-top:6px;font-size:13px"
            onClick=${() => { dispatch({ type: "misdeal" }); clear(); }}
          >Misdeal — throw this hand in</button>
        </div>`}
  </div>`;
}
