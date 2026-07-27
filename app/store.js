// Versioned localStorage store. Persist state, not history: each session keeps
// current state, a display log, and a bounded undo stack of prior states.
// Corrupt or unknown-schema data is quarantined, never thrown at boot.

const KEY = "tally.v1";
const SCHEMA = 1;
const UNDO_CAP = 10;

const fresh = () => ({ schema: SCHEMA, roster: [], games: {}, history: {} });

function load() {
  let raw = null;
  try {
    raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const data = JSON.parse(raw);
    if (
      !data || typeof data !== "object" || data.schema !== SCHEMA ||
      typeof data.games !== "object" || !Array.isArray(data.roster)
    ) throw new Error("bad shape");
    if (!data.history || typeof data.history !== "object") data.history = {};
    return data;
  } catch {
    try { if (raw) localStorage.setItem(KEY + ".corrupt", raw); } catch { /* quota: drop */ }
    return fresh();
  }
}

let db = load();

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* quota: keep running in-memory */ }
}

export const store = {
  session(gameId) {
    return db.games[gameId] || null;
  },

  start(gameId, config, state) {
    db.games[gameId] = { config, state, log: [], undo: [], started: Date.now() };
    save();
  },

  // apply a pre-reduced result: new state + display line (line may be null)
  apply(gameId, state, line) {
    const s = db.games[gameId];
    if (!s) return;
    s.undo.push({ state: s.state, logLen: s.log.length });
    if (s.undo.length > UNDO_CAP) s.undo.shift();
    s.state = state;
    if (line != null) s.log.push(line);
    save();
  },

  canUndo(gameId) {
    const s = db.games[gameId];
    return !!(s && s.undo.length);
  },

  undo(gameId) {
    const s = db.games[gameId];
    if (!s || !s.undo.length) return;
    const prev = s.undo.pop();
    s.state = prev.state;
    s.log.length = prev.logLen;
    save();
  },

  end(gameId, line) {
    if (line) {
      (db.history[gameId] ||= []).push({ date: Date.now(), line });
      if (db.history[gameId].length > 50) db.history[gameId].shift();
    }
    delete db.games[gameId];
    save();
  },

  history(gameId) {
    return db.history[gameId] || [];
  },

  roster() {
    return db.roster;
  },

  rememberPlayers(names) {
    for (const n of names) {
      const name = String(n).slice(0, 24).trim();
      if (name && !db.roster.includes(name)) db.roster.unshift(name);
    }
    db.roster.length = Math.min(db.roster.length, 24);
    save();
  },

  exportJSON() {
    return JSON.stringify(db);
  },

  importJSON(text) {
    const data = JSON.parse(text); // caller catches
    if (!data || data.schema !== SCHEMA || typeof data.games !== "object") {
      throw new Error("Not a Tally backup");
    }
    db = data;
    if (!db.history || typeof db.history !== "object") db.history = {};
    if (!Array.isArray(db.roster)) db.roster = [];
    save();
  },
};

if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
