import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import RiskBadge from '../components/RiskBadge.jsx';
import { fmtDateTime } from '../lib.js';

export default function Alerts() {
  const [tab, setTab] = useState('list');
  const [dash, setDash] = useState(null);
  const [emails, setEmails] = useState([]);
  const [open, setOpen] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api('/dashboard'), api('/emails')])
      .then(([d, e]) => { setDash(d); setEmails(e); })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-crit">{error}</p>;
  if (!dash) return <p className="text-ink-soft">Loading...</p>;

  const atRisk = dash.students
    .filter((s) => s.risk !== 'safe')
    .sort((a, b) => (a.risk === b.risk ? a.worst.pct - b.worst.pct : a.risk === 'critical' ? -1 : 1));

  return (
    <div className="space-y-5">
      <h1>Alerts</h1>

      <div className="flex gap-2 border-b border-slate-300">
        {[['list', `Students to meet (${atRisk.length})`], ['emails', `Email outbox (${emails.length})`]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-3 py-2 text-sm -mb-px border-b-2 ${tab === id ? 'border-board font-semibold' : 'border-transparent text-ink-soft'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'list' && (
        <div className="space-y-3">
          <p className="text-sm text-ink-soft">Lowest attendance first. Anyone not yet counselled is marked so you can plan sessions.</p>
          {atRisk.map((s) => {
            const short = s.subjects.filter((x) => x.tier !== 'safe').sort((a, b) => a.pct - b.pct);
            return (
              <div key={s.id} className="card p-4 flex flex-wrap items-start gap-4">
                <div className="min-w-[12rem] flex-1">
                  <Link to={`/students/${s.id}`} className="font-semibold text-board hover:underline">{s.name}</Link>
                  <div className="text-xs text-ink-faint">{s.rollNo}</div>
                  <div className="mt-1.5"><RiskBadge tier={s.risk} /></div>
                </div>
                <ul className="flex-[2] text-sm space-y-1 min-w-[14rem]">
                  {short.map((x) => (
                    <li key={x.subjectId}>
                      <span className="font-medium">{x.code}</span> at {x.pct}%, needs the next {x.needed} classes in a row
                    </li>
                  ))}
                </ul>
                <div className="text-sm text-ink-soft">
                  {s.interventionCount > 0 ? `${s.interventionCount} session(s) logged` : 'Not counselled yet'}
                </div>
                <Link to={`/students/${s.id}`} className="btn">Open</Link>
              </div>
            );
          })}
          {atRisk.length === 0 && <p>Nobody is below 75% in any subject.</p>}
        </div>
      )}

      {tab === 'emails' && (
        <div className="space-y-3">
          <p className="text-sm text-ink-soft">
            These are simulated. A warning goes out automatically when a student falls into Critical in a subject, to the student and the parent address on file. Nothing is really sent.
          </p>
          {emails.length === 0 && (
            <p className="card p-4 text-sm">No emails yet. Mark a student absent so they drop under 65% and one will appear here.</p>
          )}
          {emails.map((e) => (
            <div key={e.id} className="card">
              <button className="w-full text-left p-4" onClick={() => setOpen(open === e.id ? null : e.id)}>
                <div className="flex justify-between gap-3">
                  <span className="font-medium">{e.subject}</span>
                  <span className="text-xs text-ink-faint whitespace-nowrap">{fmtDateTime(e.createdAt)}</span>
                </div>
                <div className="text-xs text-ink-soft mt-0.5">To: {e.to.join(', ')}</div>
              </button>
              {open === e.id && <pre className="px-4 pb-4 text-sm whitespace-pre-wrap font-sans">{e.body}</pre>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
