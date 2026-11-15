// Tiny JSON "database". The brief allows SQLite or a JSON store; a JSON file means
// no native modules to compile on someone's laptop during a hackathon.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');

const EMPTY = {
  users: [],
  students: [],
  subjects: [],
  sessions: [],
  records: [],
  marks: [],
  interventions: [],
  medical: [],
  emails: [],
  counters: {},
};

let state = null;

export function load() {
  if (state) return state;
  if (!fs.existsSync(DB_PATH)) {
    state = structuredClone(EMPTY);
    return state;
  }
  state = { ...structuredClone(EMPTY), ...JSON.parse(fs.readFileSync(DB_PATH, 'utf8')) };
  return state;
}

export function replace(newState) {
  state = { ...structuredClone(EMPTY), ...newState };
}

export function save() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const tmp = DB_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, DB_PATH);
}

export function nextId(db, name) {
  db.counters[name] = (db.counters[name] || 0) + 1;
  return db.counters[name];
}
