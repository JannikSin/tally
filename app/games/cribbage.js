import { useState } from "preact/hooks";
import { html } from "htm/preact";
import * as rules from "./cribbage.rules.js";
import { PATH, VIEW, HOLES } from "./cribbage.board.js";
import { PlayerNames, LogList, OverBanner, Seg } from "../ui.js";

export const meta = rules.meta;
export { rules };

const LANE_COLORS = ["#4d9fff", "#e5b04a", "#5fd49a"];

export function Setup({ onStart, roster, history }) {
  const [count, setCount] = useState(2);
  const [names, setNames] = useState(["", "", ""]);
  return html`<div>
    <div class="card">
      <h2>Players</h2>
      <${Seg}
        options=${[{ value: 2, label: "2 players" }, { value: 3, label: "3 players" }, { value: 4, label: "4 (teams)" }]}
        value=${count}
        onChange=${setCount}
      />
      <div style="margin-top:12px">
        <${PlayerNames}
          count=${count === 4 ? 2 : count}
          names=${names}
          onChange=${setNames}
          roster=${roster}
          labels=${count === 4 ? ["Team 1", "Team 2"] : null}
        />
      </div>
      ${count === 4 ? html`<p class="hint-line">Four-handed plays as two teams, one peg lane each.</p>` : null}
    </div>
    <button
      type="button" class="primary" style="width:100%"
      onClick=${() => {
        const lanes = count === 4 ? 2 : count;
        const players = Array.from({ length: lanes }, (_, i) => names[i]?.trim() || (count === 4 ? `Team ${i + 1}` : `Player ${i + 1}`));
        onStart({ players });
      }}
    >Start — first to 121</button>
    ${history.length
      ? html`<div class="card" style="margin-top:12px"><h2>Past games</h2>
          ${history.slice(-5).reverse().map((h) => html`<p class="hint-line">${h.line}</p>`)}
        </div>`
      : null}
  </div>`;
}

function Board({ state }) {
  const lanes = state.players.length;
  const offsets = lanes === 2 ? [-4, 4] : [-6, 0, 6];
  const holeAt = (h, lane) => {
    const st = HOLES[h - 1];
    return { x: st.x + st.nx * offsets[lane], y: st.y + st.ny * offsets[lane] };
  };
  const skunk = HOLES[89], dskunk = HOLES[59]; // markers after holes 90 / 60
  return html`<svg viewBox=${VIEW.join(" ")} style="width:100%;display:block" role="img" aria-label="Cribbage board shaped like the number 29">
    <path d=${PATH} fill="none" stroke="#1a3050" stroke-width="22" stroke-linecap="round" stroke-linejoin="round" />
    <path d=${PATH} fill="none" stroke="#27436b" stroke-width="1" stroke-dasharray="2 4" opacity="0.6" />
    ${[skunk, dskunk].map(
      (m, i) => html`<line
        x1=${m.x - m.nx * 13} y1=${m.y - m.ny * 13} x2=${m.x + m.nx * 13} y2=${m.y + m.ny * 13}
        stroke="#e5674a" stroke-width=${i === 1 ? 3 : 1.6} opacity="0.9"
      ><title>${i === 0 ? "skunk line (90)" : "double skunk (60)"}</title></line>`,
    )}
    ${HOLES.map((_, hi) =>
      Array.from({ length: lanes }, (_, lane) => {
        const h = hi + 1;
        const { x, y } = holeAt(h, lane);
        const every5 = h % 5 === 0;
        return html`<circle cx=${x} cy=${y} r=${h === 121 ? 3.4 : every5 ? 2.2 : 1.5}
          fill=${h === 121 ? "#e5b04a" : every5 ? "#3a5a88" : "#22395c"} />`;
      }),
    )}
    ${state.players.map((_, lane) => {
      const front = state.scores[lane];
      const backPos = state.back[lane];
      return [
        backPos > 0 &&
          html`<circle cx=${holeAt(backPos, lane).x} cy=${holeAt(backPos, lane).y} r="3.4"
            fill=${LANE_COLORS[lane]} opacity="0.45"
            style="transition: cx 0.3s, cy 0.3s" />`,
        front > 0 &&
          html`<circle cx=${holeAt(front, lane).x} cy=${holeAt(front, lane).y} r="4"
            fill=${LANE_COLORS[lane]} stroke="#0b1526" stroke-width="1"
            style="transition: cx 0.3s, cy 0.3s" />`,
      ];
    })}
  </svg>`;
}

export function Play({ state, log, dispatch, onRematch, onDone }) {
  const [who, setWho] = useState(0);
  const [more, setMore] = useState(false);
  const sum = rules.summary(state);
  const peg = (pts) => dispatch({ type: "peg", player: who, pts });
  return html`<div>
    <div class="card" style="padding:8px 6px 4px"><${Board} state=${state} /></div>
    ${sum.done ? html`<${OverBanner} line=${sum.line} onRematch=${onRematch} onDone=${onDone} />` : null}
    <div class="scorebar">
      ${state.players.map(
        (p, i) => html`<button
          type="button"
          class=${"scorebox" + (i === who ? " active" : "")}
          style="border-color:${i === who ? LANE_COLORS[i] : "var(--line)"}"
          onClick=${() => setWho(i)}
        >
          <div class="who" style="color:${LANE_COLORS[i]}">${p}</div>
          <div class="pts">${state.scores[i]}</div>
          <div class="who">${121 - state.scores[i]} to go</div>
        </button>`,
      )}
    </div>
    ${!sum.done
      ? html`<div class="card" style="border-color:${LANE_COLORS[who]}">
          <h2 style="color:${LANE_COLORS[who]}">Peg for ${state.players[who]}</h2>
          <div class="btngrid c6">
            ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(
              (n) => html`<button type="button" onClick=${() => peg(n)}>+${n}</button>`,
            )}
          </div>
          <div class="row" style="margin-top:8px">
            <button type="button" class="ghost grow" onClick=${() => setMore(!more)}>${more ? "Fewer" : "13–29…"}</button>
          </div>
          ${more
            ? html`<div class="btngrid c6" style="margin-top:8px">
                ${Array.from({ length: 17 }, (_, i) => i + 13).map(
                  (n) => html`<button type="button" onClick=${() => peg(n)}>+${n}</button>`,
                )}
              </div>`
            : null}
          <button type="button" class="ghost" style="width:100%;margin-top:8px;font-size:13px" onClick=${() => peg(0)}>
            Counted, nothing scored (+0)
          </button>
        </div>`
      : null}
    <div class="card"><h2>Pegging</h2><${LogList} lines=${log} /></div>
  </div>`;
}
