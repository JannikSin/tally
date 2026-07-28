import { render } from "preact";
import { useEffect, useState } from "preact/hooks";
import { html } from "htm/preact";
import { store } from "./store.js";
import { Rivalries } from "./rivalry.js";
import * as euchre from "./games/euchre.js";
import * as ohhell from "./games/ohhell.js";
import * as gin from "./games/gin.js";
import * as cribbage from "./games/cribbage.js";
import * as sheepshead from "./games/sheepshead.js";
import * as rook from "./games/rook.js";
import * as bridge from "./games/bridge.js";
import * as mahjong from "./games/mahjong.js";

const GAMES = [euchre, cribbage, sheepshead, ohhell, gin, bridge, rook, mahjong];

function useHash() {
  const [hash, setHash] = useState(location.hash.slice(1));
  useEffect(() => {
    const on = () => setHash(location.hash.slice(1));
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  }, []);
  return hash;
}

function Home() {
  return html`<div class="fade-in">
    <header class="home-head">
      <div class="row">
        <h1 class="grow">Tally</h1>
        <a href="#settings" class="iconlink" aria-label="Settings">⛭</a>
      </div>
      <p>Deal the cards. This keeps the score.</p>
    </header>
    <div class="tiles">
      ${GAMES.map((g) => {
        const s = store.session(g.meta.id);
        const sum = s ? g.rules.summary(s.state) : null;
        return html`<button class="tile" onClick=${() => (location.hash = g.meta.id)}>
          <span class="glyph" style=${g.meta.tint ? `color:var(--${g.meta.tint === "brass" ? "brass" : "sky"});font-weight:700` : ""}>${g.meta.glyph}</span>
          <span class="name">${g.meta.name}</span>
          ${s
            ? html`<span class="resume">${sum.done ? "Finished" : "Resume"}</span>
                <span class="hint">${sum.line}</span>`
            : html`<span class="hint">${g.meta.hint}</span>`}
        </button>`;
      })}
      <button class="tile" style="grid-column:1/3;min-height:74px;flex-direction:row;align-items:center" onClick=${() => (location.hash = "rivalries")}>
        <span class="glyph" style="color:var(--loss);font-weight:700">⚔</span>
        <span>
          <span class="name" style="display:block">Rivalries</span>
          <span class="hint">Lifetime records between the same names, kept automatically.</span>
        </span>
      </button>
    </div>
  </div>`;
}

function Settings() {
  const [showData, setShowData] = useState(false);
  const [importText, setImportText] = useState("");
  const [msg, setMsg] = useState("");
  return html`<div class="fade-in">
    <div class="topbar">
      <a href="#" class="iconlink" aria-label="Back">‹</a>
      <h1>Settings</h1>
    </div>
    <div class="screen">
      <div class="card">
        <h2>Backup</h2>
        <p class="hint-line">Scores live only on this device. Copy this backup somewhere safe once in a while.</p>
        <div class="row" style="margin-bottom:10px">
          <button
            type="button"
            onClick=${async () => {
              try {
                await navigator.clipboard.writeText(store.exportJSON());
                setMsg("Copied to clipboard.");
              } catch {
                setShowData(true);
                setMsg("Clipboard blocked. Copy the text below.");
              }
            }}
          >Copy backup</button>
          <button type="button" class="ghost" onClick=${() => setShowData(!showData)}>${showData ? "Hide" : "Show"} data</button>
        </div>
        ${showData ? html`<textarea readonly rows="5" style="width:100%;font-family:var(--mono);font-size:11px;background:var(--ink);color:var(--chalk-dim);border:1px solid var(--line);border-radius:10px;padding:8px">${store.exportJSON()}</textarea>` : null}
      </div>
      <div class="card">
        <h2>Restore</h2>
        <textarea
          rows="3"
          placeholder="Paste a backup here"
          style="width:100%;font-family:var(--mono);font-size:11px;background:var(--ink);color:var(--chalk);border:1px solid var(--line);border-radius:10px;padding:8px"
          value=${importText}
          onInput=${(e) => setImportText(e.target.value)}
        ></textarea>
        <button
          type="button"
          style="margin-top:8px"
          disabled=${!importText.trim()}
          onClick=${() => {
            try {
              store.importJSON(importText.trim());
              setImportText("");
              setMsg("Restored.");
            } catch {
              setMsg("That doesn't look like a Tally backup.");
            }
          }}
        >Restore backup</button>
      </div>
      ${msg ? html`<p class="hint-line">${msg}</p>` : null}
      <p class="hint-line" style="margin-top:20px">Tally scores the games; you bring the cards. Everything stays on this device.</p>
    </div>
  </div>`;
}

function GameScreen({ game, bump }) {
  const { meta, rules } = game;
  const session = store.session(meta.id);
  const [confirmEnd, setConfirmEnd] = useState(false);
  useEffect(() => setConfirmEnd(false), [session]);

  // A scorekeeper propped on the table must not sleep mid-game.
  useEffect(() => {
    if (!session || !navigator.wakeLock) return;
    let lock = null;
    const acquire = () =>
      navigator.wakeLock.request("screen").then((l) => { lock = l; }).catch(() => {});
    const onVis = () => { if (document.visibilityState === "visible") acquire(); };
    acquire();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      if (lock) lock.release().catch(() => {});
    };
  }, [!!session]);

  const dispatch = (action) => {
    const s = store.session(meta.id);
    const r = rules.reduce(s.state, action);
    if (r.state === s.state) return; // reducer no-op: don't burn an undo slot
    store.apply(meta.id, r.state, r.line ?? null);
    bump();
  };
  const start = (config) => {
    store.rememberPlayers(config.players || []);
    store.start(meta.id, config, rules.init(config));
    bump();
  };
  const finish = () => {
    const s = store.session(meta.id);
    const sum = rules.summary(s.state);
    // open-ended games (sheepshead, mahjong) are never "done"; their line IS the settlement
    const openEnded = !("done" in sum) || meta.id === "sheepshead" || meta.id === "mahjong";
    store.end(meta.id, sum.done || openEnded ? sum.line : `${sum.line} (unfinished)`, sum.result);
    bump();
  };
  const rematch = () => {
    const s = store.session(meta.id);
    const cfg = s.config;
    const sum = rules.summary(s.state);
    store.end(meta.id, sum.line, sum.result);
    store.start(meta.id, cfg, rules.init(cfg));
    bump();
  };

  return html`<div class="fade-in">
    <div class="topbar">
      <a href="#" class="iconlink" aria-label="Back">‹</a>
      <h1>${meta.name}</h1>
      ${session
        ? html`
            <button
              type="button"
              class="ghost"
              disabled=${!store.canUndo(meta.id)}
              aria-label="Undo"
              onClick=${() => { store.undo(meta.id); bump(); }}
            >↺ Undo</button>
            <button
              type="button"
              class=${confirmEnd ? "primary" : "ghost"}
              onClick=${() => {
                if (confirmEnd) finish(); // records the summary line in history
                else { setConfirmEnd(true); setTimeout(() => setConfirmEnd(false), 3500); }
              }}
            >${confirmEnd ? "End game?" : "✕"}</button>`
        : null}
    </div>
    <div class="screen">
      ${session
        ? html`<${game.Play} state=${session.state} log=${session.log} dispatch=${dispatch} onRematch=${rematch} onDone=${finish} />`
        : html`<${game.Setup} onStart=${start} roster=${store.roster()} history=${store.history(meta.id)} />`}
    </div>
  </div>`;
}

function App() {
  const hash = useHash();
  const [, setTick] = useState(0);
  const bump = () => setTick((t) => t + 1);
  useEffect(() => scrollTo(0, 0), [hash]);
  if (hash === "settings") return html`<${Settings} />`;
  if (hash === "rivalries") {
    return html`<${Rivalries} gameMeta=${Object.fromEntries(GAMES.map((g) => [g.meta.id, g.meta.name]))} />`;
  }
  const game = GAMES.find((g) => g.meta.id === hash);
  if (game) return html`<${GameScreen} game=${game} bump=${bump} key=${hash} />`;
  return html`<${Home} />`;
}

render(html`<${App} />`, document.getElementById("app"));

if ("serviceWorker" in navigator) {
  addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
}
