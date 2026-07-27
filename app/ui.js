import { html } from "htm/preact";

// Shared widgets. Games render only their entry surface; the shell owns
// the top bar and undo.

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
      (e) => html`<div class=${"scorebox" + (e.lead ? " lead" : "") + (e.active ? " active" : "")}>
        <div class="who">${e.who}</div>
        <div class="pts">${e.pts}</div>
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
export function OverBanner({ line, onRematch, onDone }) {
  return html`<div class="banner fade-in">
    <div class="big">${line}</div>
    <div class="row" style="margin-top:12px;justify-content:center">
      <button type="button" onClick=${onRematch}>Rematch</button>
      <button type="button" class="primary" onClick=${onDone}>Finish</button>
    </div>
  </div>`;
}
