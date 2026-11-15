import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import RiskBadge from '../components/RiskBadge.jsx';
import { fmtPct } from '../lib.js';

const MODES = [
  { id: 'atrisk', label: 'At risk (warning + critical)' },
  { id: 'critical', label: 'Critical only' },
  { id: 'warning', label: 'Warning only' },
  { id: 'all', label: 'All students' },
];

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('atrisk');
  const [subject, setSubject] = useState('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    Promise.all([api('/dashboard'), api('/subjects')])
      .then(([d, s]) => { setData(d); setSubjects(s); })
      .catch((e) => setError(e.message));
  }, []);

  const rows = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data.students
      .map((s) => {
        // when a subject is picked, judge the student by that subject alone
        const focus = subject === 'all'
          ? s.worst && { ...s.worst, tier: s.risk }
          : s.subjects.find((x) => x.subjectId === Number(subject));
        return { ...s, focus, tier: focus ? focus.tier : 'safe' };
      })
      .filter((s) => {
        if (mode === 'atrisk' && s.tier === 'safe') return false;
        if (mode === 'critical' && s.tier !== 'critical') return false;
        if (mode === 'warning' && s.tier !== 'warning') return false;
        if (q && !`${s.name} ${s.rollNo}`.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => (a.focus?.pct ?? 100) - (b.focus?.pct ?? 100));
  }, [data, mode, subject, query]);

  if (error) return <p className="text-crit">{error}</p>;
  if (!data) return <p className="text-ink-soft">Loading dashboard...</p>;

  const { counts } = data;

  return (
    <div className="space-y-6">
      <h1>Dashboard</h1>

      {counts.critical > 0 ? (
        <div className="rounded-lg bg-crit text-white px-5 py-4 flex flex-wrap items-center justify-between gap-3" role="alert">
          <div>
            <div className="text-lg font-semibold">
              {counts.critical} {counts.critical === 1 ? 'student is' : 'students are'} in critical shortage (&lt;65%)
            </div>
            <div className="text-sm text-red-100">Hall tickets are at risk. Start with the lowest percentages.</div>
          </div>
          <button className="btn" onClick={() => { setMode('critical'); setSubject('all'); }}>Show critical students</button>
        </div>
      ) : (
        <div className="rounded-lg bg-safe-bg text-safe px-5 py-4 font-medium">Nobody is in critical shortage right now.</div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Students" value={data.total} />
        <Stat label="Safe (75% and above)" value={counts.safe} tone="text-safe" />
        <Stat label="Warning (65-74%)" value={counts.warning} tone="text-warn" />
        <Stat label="Critical (below 65%)" value={counts.critical} tone="text-crit" />
      </div>

      <div className="card">
        <div className="p-4 flex flex-wrap gap-3 items-end border-b border-slate-200">
          <div>
            <label className="block text-xs font-medium text-ink-soft mb-1" htmlFor="mode">Show</label>
            <select id="mode" className="input" value={mode} onChange={(e) => setMode(e.target.value)}>
              {MODES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-soft mb-1" htmlFor="subj">Subject</label>
            <select id="subj" className="input" value={subject} onChange={(e) => setSubject(e.target.value)}>
              <option value="all">Weakest subject per student</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[10rem]">
            <label className="block text-xs font-medium text-ink-soft mb-1" htmlFor="q">Search</label>
            <input id="q" className="input" placeholder="Name or roll number" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Student</th>
                <th className="th">{subject === 'all' ? 'Weakest subject' : 'Subject'}</th>
                <th className="th">Attendance</th>
                <th className="th">To recover</th>
                <th className="th">Risk</th>
                <th className="th">Mentoring</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="td">
                    <Link to={`/students/${s.id}`} className="font-medium text-board hover:underline">{s.name}</Link>
                    <div className="text-xs text-ink-faint">{s.rollNo}</div>
                  </td>
                  <td className="td">{s.focus ? subjects.find((x) => x.id === s.focus.subjectId)?.name : '-'}</td>
                  <td className="td font-semibold">{fmtPct(s.focus?.pct)}</td>
                  <td className="td">
                    {s.focus && s.focus.needed > 0
                      ? `Next ${s.focus.needed} classes in a row`
                      : <span className="text-ink-faint">Eligible</span>}
                  </td>
                  <td className="td"><RiskBadge tier={s.tier} /></td>
                  <td className="td text-ink-soft">
                    {s.interventionCount > 0
                      ? `${s.interventionCount} note${s.interventionCount > 1 ? 's' : ''}`
                      : <span className="text-ink-faint">None yet</span>}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td className="td text-ink-soft" colSpan={6}>No students match these filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone = '' }) {
  return (
    <div className="card p-4">
      <div className={`text-3xl font-semibold ${tone}`}>{value}</div>
      <div className="text-sm text-ink-soft mt-1">{label}</div>
    </div>
  );
}
