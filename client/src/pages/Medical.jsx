import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { fmtDate } from '../lib.js';

const STATUS_STYLE = {
  pending: 'bg-warn-bg text-warn',
  approved: 'bg-safe-bg text-safe',
  rejected: 'bg-crit-bg text-crit',
};

export default function Medical() {
  const { user } = useAuth();
  const isStudent = user.role === 'student';
  const [list, setList] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ fromDate: '', toDate: '', reason: '', fileName: '' });
  const [busy, setBusy] = useState(false);

  const load = () => api('/medical').then(setList).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/medical', { method: 'POST', body: form });
      setForm({ fromDate: '', toDate: '', reason: '', fileName: '' });
      e.target.reset();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function review(id, status) {
    setError('');
    try {
      await api(`/medical/${id}`, { method: 'PATCH', body: { status } });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <h1>Medical leave</h1>
      <p className="text-sm text-ink-soft max-w-2xl">
        Once a certificate is approved, the classes missed in that period no longer count against the student. Attendance percentages are recalculated straight away.
      </p>
      {error && <p className="text-crit" role="alert">{error}</p>}

      {isStudent && (
        <form onSubmit={submit} className="card p-5 grid sm:grid-cols-2 gap-4 max-w-2xl">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="from">First day of leave</label>
            <input id="from" type="date" className="input" required value={form.fromDate}
              onChange={(e) => setForm({ ...form, fromDate: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="to">Last day of leave</label>
            <input id="to" type="date" className="input" required value={form.toDate}
              onChange={(e) => setForm({ ...form, toDate: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium mb-1" htmlFor="reason">Reason</label>
            <input id="reason" className="input" value={form.reason} placeholder="For example: viral fever, doctor advised rest"
              onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium mb-1" htmlFor="file">Medical certificate</label>
            {/* only the file name is stored, the demo does not keep the file itself */}
            <input id="file" type="file" accept=".pdf,.jpg,.jpeg,.png" className="text-sm"
              onChange={(e) => setForm({ ...form, fileName: e.target.files[0]?.name || '' })} />
          </div>
          <div className="sm:col-span-2">
            <button className="btn btn-primary" disabled={busy}>{busy ? 'Submitting...' : 'Submit certificate'}</button>
          </div>
        </form>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              {!isStudent && <th className="th">Student</th>}
              <th className="th">Dates</th>
              <th className="th">Reason</th>
              <th className="th">Certificate</th>
              <th className="th">Status</th>
              {!isStudent && <th className="th">Decision</th>}
            </tr>
          </thead>
          <tbody>
            {list.map((m) => (
              <tr key={m.id}>
                {!isStudent && <td className="td font-medium">{m.studentName}</td>}
                <td className="td whitespace-nowrap">{fmtDate(m.fromDate)} to {fmtDate(m.toDate)}</td>
                <td className="td">{m.reason || '-'}</td>
                <td className="td text-ink-soft">{m.fileName}</td>
                <td className="td">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLE[m.status]}`}>{m.status}</span>
                </td>
                {!isStudent && (
                  <td className="td whitespace-nowrap">
                    {m.status === 'pending' ? (
                      <div className="flex gap-2">
                        <button className="btn btn-primary" onClick={() => review(m.id, 'approved')}>Approve</button>
                        <button className="btn" onClick={() => review(m.id, 'rejected')}>Reject</button>
                      </div>
                    ) : (
                      <button className="btn" onClick={() => review(m.id, m.status === 'approved' ? 'rejected' : 'approved')}>
                        {m.status === 'approved' ? 'Withdraw approval' : 'Approve instead'}
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td className="td text-ink-soft" colSpan={6}>No certificates yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
