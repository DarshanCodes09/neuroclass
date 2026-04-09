const fs = require('fs');
const path = require('path');

const dataDir = path.resolve(__dirname, '../data');
const dataFile = path.join(dataDir, 'store.json');

const defaultState = {
  courses: [],
  course_assets: [],
  course_contents: [],
  announcements: [],
  assignments: [],
  submissions: [],
  ai_training_profiles: [],
  ai_rubric_files: [],
  ai_gold_samples: [],
  notifications: [],
};

function ensureStore() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify(defaultState, null, 2), 'utf8');
  }
}

function readStore() {
  ensureStore();
  try {
    const raw = fs.readFileSync(dataFile, 'utf8');
    return { ...defaultState, ...(JSON.parse(raw) || {}) };
  } catch {
    return { ...defaultState };
  }
}

function writeStore(next) {
  ensureStore();
  fs.writeFileSync(dataFile, JSON.stringify(next, null, 2), 'utf8');
}

function insert(table, row) {
  const db = readStore();
  db[table].push(row);
  writeStore(db);
  return row;
}

function update(table, whereFn, updateFn) {
  const db = readStore();
  db[table] = db[table].map((row) => (whereFn(row) ? updateFn(row) : row));
  writeStore(db);
}

function remove(table, whereFn) {
  const db = readStore();
  const existing = Array.isArray(db[table]) ? db[table] : [];
  const kept = existing.filter((row) => !whereFn(row));
  const removedCount = existing.length - kept.length;
  db[table] = kept;
  writeStore(db);
  return removedCount;
}

function find(table, whereFn = () => true) {
  const db = readStore();
  return db[table].filter(whereFn);
}

function first(table, whereFn = () => true) {
  return find(table, whereFn)[0] || null;
}

module.exports = {
  insert,
  update,
  remove,
  find,
  first,
};
