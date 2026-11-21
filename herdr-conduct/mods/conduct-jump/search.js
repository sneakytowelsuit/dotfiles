const fold = (text) => String(text ?? "").normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();

function tokenScore(token, field) {
  if (field === token) return 160;
  const start = field.indexOf(token);
  if (start === 0) return 130;
  if (start > 0) return (/[^\p{L}\p{N}]/u.test(field[start - 1]) ? 105 : 90) - Math.min(start, 20);

  let last = -1;
  for (const letter of token) {
    last = field.indexOf(letter, last + 1);
    if (last < 0) return -Infinity;
  }
  return 60 - Math.min(45, last + 1 - token.length);
}

export function fuzzyScore(query, fields) {
  const tokens = fold(query).trim().split(/\s+/).filter(Boolean);
  const values = fields.map(fold);
  let total = 0;
  for (const token of tokens) {
    const best = Math.max(...values.map((field) => tokenScore(token, field)));
    if (best === -Infinity) return best;
    total += best;
  }
  return total;
}

export function rankEntries(query, entries, recent) {
  const history = new Map((Array.isArray(recent) ? recent : []).map((address, index) => [address, index]));
  if (!query.trim()) {
    const order = (entry) => history.get(entry.address) ?? Infinity;
    const priority = (entry) => entry.attention ? 0 : entry.address ? 1 : 2;
    return [...entries].sort((a, b) => order(a) - order(b) || priority(a) - priority(b));
  }
  return entries.map((entry) => ({ entry, score: fuzzyScore(query, entry.fields) }))
    .filter(({ score }) => score !== -Infinity)
    .sort((a, b) => b.score - a.score)
    .map(({ entry }) => entry);
}
