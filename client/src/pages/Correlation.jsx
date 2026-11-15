import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

// chart size and margins
const W = 640, H = 380, M = { top: 20, right: 20, bottom: 48, left: 52 };
const X_MIN = 40, X_MAX = 100;

export default function Correlation() {
  const [subjects, setSubjects] = useState([]);
  const [subjectId, setSubjectId] = useState('');
  const [data, setData] = useState(null);
  const [hover, setHover] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/subjects').then((s) => { setSubjects(s); setSubjectId(String(s[0].id)); }).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!subjectId) return;
    api(`/correlation?subjectId=${subjectId}`).then(setData).catch((e) => setError(e.message));
  }, [subjectId]);

  if (error) return <p className="text-crit">{error}</p>;

  const outOf = data?.points[0]?.outOf || 50;
  const sx = (v) => M.left + ((v - X_MIN) / (X_MAX - X_MIN)) * (W - M.left - M.right);
  const sy = (v) => H - M.bottom - (v / outOf) * (H - M.top - M.bottom);
  const dotColor = (a) => (a >= 75 ? '#1c7a4b' : a >= 65 ? '#9a5b00' : '#b3261e');

  const strength = (r) => {
    if (r === null) return '';
    const a = Math.abs(r);
    return a >= 0.7 ? 'strong' : a >= 0.4 ? 'moderate' : 'weak';
  };

  return (
    <div className="space-y-5">
      <h1>Marks vs attendance</h1>
      <div className="max-w-xs">
        <label className="block text-xs font-medium text-ink-soft mb-1" htmlFor="subj">Subject</label>
        <select id="subj" className="input" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {data && (
        <div className="card p-4">
          <p className="text-sm mb-2">
            {data.r !== null
              ? <>Correlation (Pearson r) is <b>{data.r}</b>, a {strength(data.r)} {data.r >= 0 ? 'positive' : 'negative'} link between attendance and midterm marks.</>
              : 'Not enough data to work out a correlation.'}
          </p>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-3xl" role="img"
            aria-label="Scatter plot of attendance percentage against midterm marks">
            {/* horizontal grid + y labels */}
            {[0, 0.25, 0.5, 0.75, 1].map((f) => (
              <g key={f}>
                <line x1={M.left} x2={W - M.right} y1={sy(f * outOf)} y2={sy(f * outOf)} stroke="#e2e8f0" />
                <text x={M.left - 8} y={sy(f * outOf) + 4} textAnchor="end" fontSize="11" fill="#4a5663">{Math.round(f * outOf)}</text>
              </g>
            ))}
            {/* x labels */}
            {[40, 50, 60, 70, 80, 90, 100].map((v) => (
              <text key={v} x={sx(v)} y={H - M.bottom + 18} textAnchor="middle" fontSize="11" fill="#4a5663">{v}%</text>
            ))}
            {/* 75% line */}
            <line x1={sx(75)} x2={sx(75)} y1={M.top} y2={H - M.bottom} stroke="#17212b" strokeDasharray="4 4" />
            <text x={sx(75) + 5} y={M.top + 10} fontSize="11" fill="#17212b">75% minimum</text>
            <text x={(W + M.left) / 2} y={H - 8} textAnchor="middle" fontSize="12" fill="#17212b">Attendance in this subject</text>
            <text transform={`rotate(-90 14 ${H / 2})`} x="14" y={H / 2} textAnchor="middle" fontSize="12" fill="#17212b">Midterm marks (out of {outOf})</text>

            {data.points.map((p) => (
              <circle key={p.studentId} cx={sx(Math.max(X_MIN, p.attendance))} cy={sy(p.marks)} r={hover === p.studentId ? 8 : 5.5}
                fill={dotColor(p.attendance)} fillOpacity="0.8" stroke="#fff" strokeWidth="1.5"
                onMouseEnter={() => setHover(p.studentId)} onMouseLeave={() => setHover(null)}>
                <title>{`${p.name}: ${p.attendance}% attendance, ${p.marks}/${p.outOf}`}</title>
              </circle>
            ))}
          </svg>
          <p className="text-xs text-ink-faint mt-2">
            Each dot is a student. Hover for the name. Green is 75% and above, amber 65-74%, red below 65%.
            {' '}Click a name below to open their record.
          </p>
          {hover && (() => {
            const p = data.points.find((x) => x.studentId === hover);
            return <p className="text-sm mt-1 font-medium">{p.name}: {p.attendance}% attendance, {p.marks}/{p.outOf} marks</p>;
          })()}
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-sm">
            {data.points.filter((p) => p.attendance < 65).map((p) => (
              <Link key={p.studentId} to={`/students/${p.studentId}`} className="text-crit underline">{p.name}</Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
