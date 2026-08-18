import { useEffect, useRef, useState } from "preact/hooks";
import { html } from "htm/preact";
import * as rules from "./rook.rules.js";
import { OverBanner, Seg, Stepper } from "../ui.js";

export const meta = rules.meta;
export { rules };

// trump-color chips; black gets a chalk ring so it reads on the felt
const COLOR_HEX = { red: "#e5674a", yellow: "#e5b04a", green: "#7fd49a", black: "#141414" };
const Dot = ({ color }) =>
  html`<i
    style=${`display:inline-block;width:9px;height:9px;border-radius:50%;vertical-align:baseline;background:${COLOR_HEX[color]};${color === "black" ? "border:1px solid var(--chalk-dim)" : ""}`}
  ></i>`;

export function Setup({ onStart, history }) {
  const [teams, setTeams] = useState(["We", "They"]);
  const [target, setTarget] = useState(300);
  const [deck, setDeck] = useState(120);
  return html`<div>
    <div class="card">
      <h2>Teams</h2>
      ${[0, 1].map(
        (i) => html`<div class="row" style="margin-bottom:8px">
          <input type="text" value=${teams[i]} onInput=${(e) => {
            const t = teams.slice(); t[i] = e.target.value.slice(0, 24); setTeams(t);
          }} />
        </div>`,
      )}
      <h2 style="margin-top:12px">Play to</h2>
      <${Seg}
        options=${[{ value: 300, label: "300" }, { value: 500, label: "500" }]}
        value=${target}
        onChange=${setTarget}
      />
      <h2 style="margin-top:12px">Points in the deck</h2>
      <div class="btngrid c2">
        ${rules.DECKS.map(
          (d) => html`<button type="button" class=${deck === d.value ? "primary" : ""} onClick=${() => setDeck(d.value)}>${d.label}</button>`,
        )}
      </div>
      <p class="hint-line">Count the last-trick bonus and 1s into "counters captured" like any other points.</p>
    </div>
    <button
      type="button" class="primary" style="width:100%"
      onClick=${() => onStart({ teams: teams.map((t) => t.trim() || "Team"), target, deck, players: [] })}
    >Start</button>
    ${history.length
      ? html`<div class="card" style="margin-top:12px"><h2>Past games</h2>
          ${history.slice(-5).reverse().map((h) => html`<p class="hint-line">${h.line}</p>`)}
        </div>`
      : null}
  </div>`;
}

export function Play({ state, dispatch, onRematch, onDone }) {
  const [bidTeam, setBidTeam] = useState(0);
  const [bid, setBid] = useState(100);
  const [color, setColor] = useState(null);
  const deck = state.deck || rules.DECK;
  const capturedStart = Math.floor(deck / 2 / 5) * 5;
  const [captured, setCaptured] = useState(capturedStart);
  const [buried, setBuried] = useState(0);
  const sum = rules.summary(state);
  const rounds = state.rounds || [];

  // hands stack downward like a paper pad; keep the newest row in view
  const sheetRef = useRef(null);
  useEffect(() => {
    if (sheetRef.current) sheetRef.current.scrollTop = sheetRef.current.scrollHeight;
  }, [rounds.length]);

  const preview = !sum.done ? rules.handScore(bidTeam, bid, captured, deck).delta : null;

  const score = () => {
    dispatch({ type: "hand", bidTeam, bid, captured, color, buried });
    setCaptured(capturedStart); setColor(null); setBuried(0); setBid(100);
  };

  return html`<div>
    <div class="sheet-wrap" ref=${sheetRef}>
      <div class="sheet" style="grid-template-columns: repeat(2, 1fr)">
        ${rounds.map(
          (r) => html`${[0, 1].map((i) => {
            const t = r.totals[i];
            const bidder = r.bidTeam === i;
            return html`<div class="rcell" style="font-size:15px;padding:6px 4px 5px">
              ${t}
              ${bidder
                ? html`<span class="mark" style=${r.made === false ? "color:var(--loss)" : "color:var(--chalk-dim)"}>
                    ${r.color ? html`<${Dot} color=${r.color} /> ` : null}bid ${r.bid}${r.made === false ? " · SET" : ""}${r.buried ? ` · ${r.buried} in nest` : ""}
                  </span>`
                : null}
            </div>`;
          })}`,
        )}
        ${[0, 1].map((i) => {
          const t = state.totals[i];
          const picked = !sum.done && bidTeam === i;
          return html`<div class=${`hcell${picked ? " is-picker" : ""}`}>
            <div class="nm">${state.teams[i]}</div>
            <div class=${"tot" + (t > 0 ? " pos" : t < 0 ? " neg" : "")}>${t}</div>
            <div class=${"role" + (picked ? " picker" : "")}>${picked ? "HAS THE BID" : " "}</div>
            <div class=${"delta" + (preview ? (preview[i] > 0 ? " pos" : preview[i] < 0 ? " neg" : "") : "")}>
              ${preview ? (preview[i] > 0 ? "+" + preview[i] : preview[i]) : " "}
            </div>
            ${sum.done
              ? null
              : html`<button type="button" class="tapL" style="width:100%" aria-label=${`${state.teams[i]}: took the bid`} onClick=${() => setBidTeam(i)}></button>`}
          </div>`;
        })}
      </div>
    </div>
    <p class="hint-line" style="margin-top:-8px;margin-bottom:12px">Playing to ${state.target} · ${deck}-point deck</p>
    ${sum.done
      ? html`<${OverBanner} line=${sum.line} onRematch=${onRematch} onDone=${onDone} />`
      : html`<div class="card">
          <h2>${state.teams[bidTeam]} took the bid (tap the sheet to switch)</h2>
          <div style="margin-top:10px">
            <${Stepper} label="Bid" value=${bid} min=${rules.minBidFor(deck)} max=${deck} step=${5} onChange=${setBid} />
          </div>
          <h2 style="margin-top:12px">Trump color</h2>
          <div class="btngrid c4">
            ${rules.COLORS.map(
              (c) => html`<button type="button" class=${color === c ? "primary" : ""} onClick=${() => setColor(color === c ? null : c)}>
                <${Dot} color=${c} /> ${c}
              </button>`,
            )}
          </div>
          <div style="margin-top:12px">
            <${Stepper} label="Counters captured" value=${captured} min=${0} max=${deck} step=${5} onChange=${setCaptured} />
          </div>
          <div style="margin-top:12px">
            <${Stepper} label="Counters buried in the nest" value=${buried} min=${0} max=${75} step=${5} onChange=${setBuried} />
          </div>
          <button
            type="button" class="primary" style="width:100%;margin-top:12px"
            disabled=${color == null}
            onClick=${score}
          >Score hand</button>
        </div>`}
  </div>`;
}
