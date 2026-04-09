function tokenize(text = '') {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function toTermFreqVector(text = '') {
  const tokens = tokenize(text);
  const counts = {};
  for (const token of tokens) {
    counts[token] = (counts[token] || 0) + 1;
  }
  const total = tokens.length || 1;
  Object.keys(counts).forEach((key) => {
    counts[key] = counts[key] / total;
  });
  return counts;
}

function cosineSimilarity(v1 = {}, v2 = {}) {
  let dot = 0;
  let mag1 = 0;
  let mag2 = 0;
  const keys = new Set([...Object.keys(v1), ...Object.keys(v2)]);
  for (const k of keys) {
    const a = Number(v1[k] || 0);
    const b = Number(v2[k] || 0);
    dot += a * b;
    mag1 += a * a;
    mag2 += b * b;
  }
  if (!mag1 || !mag2) return 0;
  return dot / (Math.sqrt(mag1) * Math.sqrt(mag2));
}

function splitIntoChunks(text = '', chunkSize = 1200) {
  const normalized = (text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  const chunks = [];
  let i = 0;
  while (i < normalized.length) {
    chunks.push(normalized.slice(i, i + chunkSize));
    i += chunkSize;
  }
  return chunks;
}

module.exports = {
  toTermFreqVector,
  cosineSimilarity,
  splitIntoChunks,
};
