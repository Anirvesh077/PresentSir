import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import RiskBadge from '../components/RiskBadge.jsx';
import AttendanceBar from '../components/AttendanceBar.jsx';
import { fmtDateTime, fmtPct } from '../lib.js';

export default function StudentDetail() {
  const { id } = useParams();
  const [summary, setSummary] = useState(null);
  const [notes, setNotes] = useState([]);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [saving, setSaving] = useState(false);

  const loadNotes = () => api(`/interventions?studentId=${id}`).then(setNotes);

  useEffect(() => {
    setSummary(null);
    Promise.all([api(`/students/${id}/summary`), loadNotes()])
      .then(([s]) => {
        setSummary(s);
        // pre-select the weakest subject, that is usually what the chat is about
        setSubjectId(s.worst ? String(s.worst.subjectId) : '');
      })
      .catch((e) => setError(e.message));
  }, [id]);

  async function logIntervention(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api('/interventions', {
        method: 'POST',
        body: { studentId: Number(id), subjectId: subjectId ? Number(subjectId) : null, notes: text },
      });
      setText('');
      await loadNotes();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (error && !summary) return <p className="text-crit">{error}</p>;
  if (!summary) return <p className="text-ink-soft">Loading...</p>;

  const subjectName = (sid) => summary.subjects.find((s) => s.subjectId === sid)?.name;

  return (
    <div className="space-y-6">
      <Link to="/" className="text-sm text-board hover:underline">Back to dashboard</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1>{summary.student.name}</h1>
        <RiskBadge tier={summary.risk} />
      </div>
      <p className="text-ink-soft -mt-4">
        {summary.student.rollNo}. Overall {fmtPct(summary.overall.pct)} ({summary.overall.attended} of {summary.overall.total} classes counted)
      </p>

      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Subject</th>
              <th className="th">Attended</th>
              <th className="th w-56">Attendance</th>
              <th className="th">Risk</th>
              <th className="th">What it takes</th>
            </tr>
          </thead>
          <tbody>
            {summary.subjects.map((s) => (
              <tr key={s.subjectId}>
                <td className="td font-medium">{s.name}<div className="text-xs text-ink-faint">{s.code}</div></td>
                <td className="td">
                  {s.attended} / {s.total}
                  {s.exempted > 0 && <div className="text-xs text-ink-faint">{s.exempted} excused (medical)</div>}
                </td>
                <td className="td">
                  <div className="font-semibold mb-1.5">{fmtPct(s.pct)}</div>
                  <AttendanceBar pct={s.pct} tier={s.tier} />
                </td>
                <td className="td"><RiskBadge tier={s.tier} /></td>
                <td className="td">
                  {s.needed > 0
                    ? <span className="font-medium">Attend the next {s.needed} classes in a row to reach 75%</span>
                    : <span className="text-ink-soft">Eligible. Can miss {s.bunksLeft} more and stay above 75%</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <form onSubmit={logIntervention} className="card p-5 space-y-3">
          <h2>Log mentoring intervention</h2>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="subj">Subject discussed</label>
            <select id="subj" className="input" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              <option value="">General / all subjects</option>
              {summary.subjects.map((s) => <option key={s.subjectId} value={s.subjectId}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="notes">Counselling notes</label>
            <textarea id="notes" className="input min-h-[7rem]" value={text} onChange={(e) => setText(e.target.value)}
              placeholder="What did the student say? What was agreed?" required />
          </div>
          {error && <p className="text-sm text-crit" role="alert">{error}</p>}
          <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Log mentoring intervention'}</button>
        </form>

        <div className="card p-5">
          <h2 className="mb-3">Previous sessions</h2>
          {notes.length === 0 && <p className="text-sm text-ink-soft">No mentoring sessions logged for this student yet.</p>}
          <ul className="space-y-4">
            {notes.map((n) => (
              <li key={n.id} className="text-sm border-l-2 border-slate-300 pl-3">
                <div className="text-xs text-ink-faint">
                  {fmtDateTime(n.createdAt)} by {n.mentorName}
                  {n.subjectId && <> on {subjectName(n.subjectId)}</>}
                </div>
                <p className="mt-0.5 whitespace-pre-wrap">{n.notes}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
