import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { todayStr } from '../lib.js';

const OPTIONS = [
  { value: 'Present', label: 'P', on: 'bg-safe text-white border-safe' },
  { value: 'Late', label: 'L', on: 'bg-warn text-white border-warn' },
  { value: 'Absent', label: 'A', on: 'bg-crit text-white border-crit' },
];

export default function Attendance() {
  const [subjects, setSubjects] = useState([]);
  const [subjectId, setSubjectId] = useState('');
  const [date, setDate] = useState(todayStr());
  const [rows, setRows] = useState([]);
  const [exists, setExists] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/subjects').then((list) => {
      const mine = list.filter((s) => s.mine);
      setSubjects(mine);
      if (mine.length) setSubjectId(String(mine[0].id));
    });
  }, []);

  useEffect(() => {
    if (!subjectId || !date) return;
    setResult(null);
    setError('');
    api(`/attendance/sheet?subjectId=${subjectId}&date=${date}`)
      .then((sheet) => { setRows(sheet.students); setExists(sheet.exists); })
      .catch((e) => setError(e.message));
  }, [subjectId, date]);

  const setStatus = (studentId, status) =>
    setRows((rs) => rs.map((r) => (r.studentId === studentId ? { ...r, status } : r)));

  const markAll = (status) => setRows((rs) => rs.map((r) => ({ ...r, status })));

  async function save() {
    setSaving(true);
    setError('');
    try {
      const out = await api('/attendance/sheet', {
        method: 'POST',
        body: {
          subjectId: Number(subjectId), date,
          records: rows.map((r) => ({ studentId: r.studentId, status: r.status })),
        },
      });
      setResult(out);
      setExists(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const counts = rows.reduce((c, r) => ({ ...c, [r.status]: (c[r.status] || 0) + 1 }), {});

  return (
    <div className="space-y-5">
      <h1>Mark attendance</h1>

      <div className="card p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-ink-soft mb-1" htmlFor="subject">Subject</label>
          <select id="subject" className="input" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-soft mb-1" htmlFor="date">Date</label>
          <input id="date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <button className="btn" onClick={() => markAll('Present')}>Mark all present</button>
        <p className="text-sm text-ink-soft ml-auto">
          {exists ? 'Editing a saved sheet.' : 'New sheet, everyone starts as present. Tap A for the absentees.'}
        </p>
      </div>

      {result && (
        <div className="rounded-lg bg-safe-bg text-safe px-4 py-3 text-sm" role="status">
          <div className="font-medium">Saved attendance for {result.saved} students.</div>
          {result.newlyCritical.length > 0 && (
            <div className="mt-2 text-crit bg-crit-bg rounded px-3 py-2">
              <div className="font-semibold">
                {result.newlyCritical.length} {result.newlyCritical.length === 1 ? 'student' : 'students'} just dropped into Critical. Warning emails queued:
              </div>
              <ul className="list-disc ml-5 mt-1">
                {result.newlyCritical.map((n) => (
                  <li key={`${n.studentId}-${n.subject}`}>
                    {n.name}: {n.subject} is at {n.pct}%, needs the next {n.needed} classes
                  </li>
                ))}
              </ul>
              <Link to="/alerts" className="underline">Open the alerts page</Link>
            </div>
          )}
        </div>
      )}
      {error && <p className="text-crit" role="alert">{error}</p>}

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Roll no</th>
                <th className="th">Student</th>
                <th className="th">P = present, L = late, A = absent</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.studentId} className={r.status === 'Absent' ? 'bg-crit-bg/40' : ''}>
                  <td className="td text-ink-soft">{r.rollNo}</td>
                  <td className="td font-medium">{r.name}</td>
                  <td className="td">
                    <div className="inline-flex" role="group" aria-label={`Attendance for ${r.name}`}>
                      {OPTIONS.map((o, i) => (
                        <button
                          key={o.value}
                          type="button"
                          aria-pressed={r.status === o.value}
                          onClick={() => setStatus(r.studentId, o.value)}
                          className={`w-10 py-1.5 text-sm font-semibold border ${i === 0 ? 'rounded-l-md' : ''} ${i === OPTIONS.length - 1 ? 'rounded-r-md' : ''} ${
                            r.status === o.value ? o.on : 'bg-white text-ink-soft border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 flex flex-wrap items-center gap-4 border-t border-slate-200 sticky bottom-0 bg-white rounded-b-lg">
          <span className="text-sm text-ink-soft">
            Present {counts.Present || 0}, Late {counts.Late || 0}, Absent {counts.Absent || 0}
          </span>
          <button className="btn btn-primary ml-auto" onClick={save} disabled={saving || rows.length === 0}>
            {saving ? 'Saving...' : 'Save attendance'}
          </button>
        </div>
      </div>
    </div>
  );
}
