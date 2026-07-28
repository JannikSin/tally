import { html } from "htm/preact";

// Shared widgets. Games render only their entry surface; the shell owns
// the top bar and undo.

// Big two-side scoreboard: half-screen color blocks, score at heroic scale.
// Scores stay pinned and huge no matter what's being entered below.
// entries: [{who, pts, sub?, lead?, picked?}] (exactly 2). onPick(i) makes
// each half a tap target for the game's most common selection.
export function BigScore({ entries, onPick }) {
  return html`<div class="bigscore">
    ${entries.map((e, i) => {
      const cls = `half side-${i === 0 ? "a" : "b"}${e.lead ? " lead" : ""}${e.picked ? " picked" : ""}`;
      const body = html`
        <div class="who">${e.who}</div>
        <div class=${"val bump" + (typeof e.pts === "number" && e.pts < 0 ? " neg" : "")} key=${e.pts}>${e.pts}</div>
        <div class="sub">${e.sub || ""}</div>`;
      return onPick
        ? html`<button type="button" class=${cls} onClick=${() => onPick(i)}>${body}</button>`
        : html`<div class=${cls}>${body}</div>`;
    })}
  </div>`;
}

// Horizontal N-player score band: one column per player, ACROSS the screen,
// sticky under the top bar. cells: [{who, pts, dealer?, sitting?, active?, tint?}].
export function ScoreBand({ cells, onPick, signed = false }) {
  return html`<div class="scoreband">
    ${cells.map((c, i) => {
      const cls = `cell${c.active ? " active" : ""}${c.sitting ? " sitting" : ""}`;
      const tot =
        "tot bump" +
        (signed && typeof c.pts === "number" ? (c.pts > 0 ? " pos" : c.pts < 0 ? " neg" : "") : "");
      const body = html`
        ${c.dealer ? html`<span class="dealer-dot" title="dealer"></span>` : null}
        <div class="nm" style=${c.tint ? `color:${c.tint}` : ""}>${c.who}</div>
        <div class=${tot} key=${c.pts} style=${c.tint ? `color:${c.tint}` : ""}>${signed && typeof c.pts === "number" && c.pts > 0 ? "+" + c.pts : c.pts}</div>`;
      return onPick
        ? html`<button type="button" class=${cls} onClick=${() => onPick(i)}>${body}</button>`
        : html`<div class=${cls}>${body}</div>`;
    })}
  </div>`;
}

const CONFETTI_COLORS = ["#4d9fff", "#e5b04a", "#7fd49a", "#e9f1fb", "#e5674a"];

export function Confetti() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return null;
  return html`<div class="confetti">
    ${Array.from({ length: 48 }, (_, i) => {
      // deterministic scatter, no Math.random needed
      const left = (i * 61) % 100;
      const delay = ((i * 37) % 20) / 14;
      const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      return html`<i style=${`left:${left}%;animation-delay:${delay}s;background:${color}`}></i>`;
    })}
  </div>`;
}

export function Seg({ options, value, onChange }) {
  return html`<div class="seg">
    ${options.map(
      (o) => html`<button
        type="button"
        class=${o.value === value ? "on" : ""}
        onClick=${() => onChange(o.value)}
      >${o.label}</button>`,
    )}
  </div>`;
}

export function Stepper({ label, value, min, max, step = 1, onChange }) {
  return html`<div class="row" style="justify-content:space-between">
    <span>${label}</span>
    <div class="row">
      <button type="button" disabled=${value <= min} onClick=${() => onChange(value - step)}>−</button>
      <span class="num" style="min-width:2.2em;text-align:center;font-size:18px">${value}</span>
      <button type="button" disabled=${value >= max} onClick=${() => onChange(value + step)}>+</button>
    </div>
  </div>`;
}

export function PlayerNames({ count, names, onChange, roster, labels }) {
  const set = (i, v) => {
    const next = names.slice();
    next[i] = v.slice(0, 24);
    onChange(next);
  };
  const unused = roster.filter((r) => !names.includes(r));
  return html`<div>
    ${Array.from({ length: count }, (_, i) => html`<div class="row" style="margin-bottom:8px">
      <span style="width:74px;color:var(--chalk-dim);font-size:13px">${labels ? labels[i] : `Player ${i + 1}`}</span>
      <input
        type="text"
        value=${names[i] || ""}
        placeholder=${labels ? labels[i] : `Player ${i + 1}`}
        onInput=${(e) => set(i, e.target.value)}
      />
    </div>`)}
    ${unused.length
      ? html`<div class="row wrap" style="margin-top:4px">
          ${unused.slice(0, 8).map(
            (r) => html`<button
              type="button"
              class="ghost"
              style="border:1px dashed var(--line);min-height:34px;padding:4px 10px;font-size:14px"
              onClick=${() => {
                const i = names.findIndex((n) => !n || !n.trim());
                if (i >= 0) set(i, r);
              }}
            >${r}</button>`,
          )}
        </div>`
      : null}
  </div>`;
}

export function ScoreBar({ entries }) {
  return html`<div class="scorebar">
    ${entries.map(
      (e) => html`<div class=${"scorebox" + (e.lead ? " lead" : "")}>
        <div class="who">${e.who}</div>
        <div class=${"pts" + (typeof e.pts === "number" && e.pts < 0 ? " neg" : "")}>${e.pts}</div>
        ${e.sub ? html`<div class="who">${e.sub}</div>` : null}
      </div>`,
    )}
  </div>`;
}

export function LogList({ lines, empty = "No hands scored yet." }) {
  if (!lines.length) return html`<p class="hint-line">${empty}</p>`;
  return html`<ol style="list-style:none">
    ${lines.map(
      (l, i) => html`<li
        class="row"
        style="padding:7px 2px;border-bottom:1px solid color-mix(in srgb, var(--line) 45%, transparent);gap:10px"
      >
        <span class="num" style="color:var(--chalk-dim);font-size:12px;width:1.8em;text-align:right">${i + 1}</span>
        <span style="font-size:14.5px">${l}</span>
      </li>`,
    )}
  </ol>`;
}

// Game-over banner with rematch / finish, shared by every game.
// Confetti fires here and only here: celebration is reserved for the win.
export function OverBanner({ line, onRematch, onDone }) {
  return html`<div class="banner fade-in">
    <${Confetti} />
    <div class="big">${line}</div>
    <div class="row" style="margin-top:12px;justify-content:center">
      <button type="button" onClick=${onRematch}>Rematch</button>
      <button type="button" class="primary" onClick=${onDone}>Finish</button>
    </div>
  </div>`;
}
