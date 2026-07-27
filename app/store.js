// Versioned localStorage store. Persist state, not history: each session keeps
// current state, a display log, and a bounded undo stack of prior states.
// Corrupt or unknown-schema data is quarantined, never thrown at boot.

const KEY = "tally.v1";
const SCHEMA = 1;
// 30 snapshots ≈ a full cribbage pegging flurry; state is <1 KB so this is cheap.
const UNDO_CAP = 30;
const NAME_MAX = 24;

const fresh = () => ({ schema: SCHEMA, roster: [], games: {}, history: {} });

const isPlainObject = (v) => !!v && typeof v === "object" && !Array.isArray(v);

// Shared by load() and importJSON(): typeof null is "object", so shape checks
// must be explicit or a bad backup bricks every boot.
function validate(data) {
  if (!isPlainObject(data) || data.schema !== SCHEMA) throw new Error("bad shape");
  if (!isPlainObject(data.games) || !Array.isArray(data.roster)) throw new Error("bad shape");
  for (const s of Object.values(data.games)) {
    if (!isPlainObject(s) || !isPlainObject(s.state) || !Array.isArray(s.log) || !Array.isArray(s.undo)) {
      throw new Error("bad session");
    }
  }
  if (!isPlainObject(data.history)) data.history = {};
  for (const v of Object.values(data.history)) {
    if (!Array.isArray(v)) throw new Error("bad history");
  }
  data.roster = data.roster.filter((x) => typeof x === "string");
  return data;
}

function load() {
  let raw = null;
  try {
    raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    return validate(JSON.parse(raw));
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
      const name = String(n).trim().slice(0, NAME_MAX);
      // skip auto-filled defaults so the quick-pick roster stays real people
      if (!name || /^(player|team) \d+$/i.test(name)) continue;
      if (["East", "South", "West", "North", "We", "They"].includes(name)) continue;
      if (!db.roster.includes(name)) db.roster.unshift(name);
    }
    db.roster.length = Math.min(db.roster.length, 24);
    save();
  },

  exportJSON() {
    return JSON.stringify(db);
  },

  importJSON(text) {
    const data = validate(JSON.parse(text)); // caller catches
    try { localStorage.setItem(KEY + ".prev", JSON.stringify(db)); } catch { /* quota */ }
    db = data;
    save();
  },
};

if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
