const FILL = { safe: 'bg-safe', warning: 'bg-warn', critical: 'bg-crit' };

// bar with a tick at the 75% line so the gap to eligibility is visible at a glance
export default function AttendanceBar({ pct, tier }) {
  const width = Math.max(0, Math.min(100, pct ?? 0));
  return (
    <div className="relative h-2.5 w-full rounded bg-slate-200" role="img" aria-label={`${pct}% attendance`}>
      <div className={`h-full rounded ${FILL[tier]}`} style={{ width: `${width}%` }} />
      <div className="absolute -top-1 w-0.5 bg-ink" style={{ left: '75%', height: '18px' }} title="75% minimum" />
    </div>
  );
}
