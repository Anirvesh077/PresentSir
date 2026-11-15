// All the attendance maths lives here so it is easy to test on its own.

export const THRESHOLD = 0.75;
export const WARNING_FLOOR = 65; // percent

// Late counts as attended. If your college treats 3 lates as 1 absence,
// change attendedWeight() and nothing else needs to move.
export function attendedWeight(status) {
  if (status === 'Present' || status === 'Late') return 1;
  return 0;
}

export function percent(attended, total) {
  if (total === 0) return null;
  return (attended / total) * 100;
}

// safe >= 75, warning 65-74.x, critical < 65
export function tierFor(pct) {
  if (pct === null) return 'safe'; // nothing held yet, nothing to worry about
  if (pct >= 75) return 'safe';
  if (pct >= WARNING_FLOOR) return 'warning';
  return 'critical';
}

const TIER_RANK = { safe: 0, warning: 1, critical: 2 };

export function worstTier(tiers) {
  return tiers.reduce((worst, t) => (TIER_RANK[t] > TIER_RANK[worst] ? t : worst), 'safe');
}

// If the student attends x classes in a row, both attended and total go up by x:
//   (A + x) / (T + x) >= 0.75   =>   x >= (0.75T - A) / 0.25
export function classesNeeded(attended, total) {
  const x = Math.ceil((THRESHOLD * total - attended) / (1 - THRESHOLD));
  return Math.max(0, x);
}

// How many classes can still be skipped before dropping under 75%?
export function bunksLeft(attended, total) {
  // A / (T + k) >= 0.75  =>  k <= A/0.75 - T
  const k = Math.floor(attended / THRESHOLD - total + 1e-9);
  return Math.max(0, k);
}

// Minimal CSV parser: handles quoted fields and CRLF. Good enough for roster dumps.
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((f) => f.trim() !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== '')) rows.push(row);
  return rows;
}
