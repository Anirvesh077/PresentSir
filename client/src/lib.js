export const TIER_LABEL = { safe: 'Safe', warning: 'Warning', critical: 'Critical' };

export const fmtPct = (p) => (p === null || p === undefined ? '-' : `${p}%`);

export function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function fmtDateTime(iso) {
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

// YYYY-MM-DD in the user's own timezone (toISOString would give UTC and can be off by a day)
export const todayStr = () => new Date().toLocaleDateString('en-CA');
