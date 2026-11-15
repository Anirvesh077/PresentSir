import { TIER_LABEL } from '../lib.js';

const STYLES = {
  safe: 'bg-safe-bg text-safe',
  warning: 'bg-warn-bg text-warn',
  critical: 'bg-crit-bg text-crit',
};
const DOTS = { safe: 'bg-safe', warning: 'bg-warn', critical: 'bg-crit' };

export default function RiskBadge({ tier }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STYLES[tier]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${DOTS[tier]}`} />
      {TIER_LABEL[tier]}
    </span>
  );
}
