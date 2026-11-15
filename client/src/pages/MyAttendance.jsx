import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import RiskBadge from '../components/RiskBadge.jsx';
import AttendanceBar from '../components/AttendanceBar.jsx';
import { fmtPct } from '../lib.js';

export default function MyAttendance() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/students/${user.studentId}/summary`).then(setData).catch((e) => setError(e.message));
  }, [user.studentId]);

  if (error) return <p className="text-crit">{error}</p>;
  if (!data) return <p className="text-ink-soft">Loading...</p>;

  const short = data.subjects.filter((s) => s.tier !== 'safe');

  return (
    <div className="space-y-6">
      <div>
        <h1>Hi {data.student.name.split(' ')[0]}</h1>
        <p className="text-ink-soft">Overall attendance is {fmtPct(data.overall.pct)}. You need 75% in every subject to sit the exams.</p>
      </div>

      {short.length > 0 && (
        <div className={`rounded-lg px-5 py-4 ${data.risk === 'critical' ? 'bg-crit-bg text-crit' : 'bg-warn-bg text-warn'}`} role="alert">
          <div className="font-semibold">
            {short.length === 1 ? 'One subject is' : `${short.length} subjects are`} below 75%
          </div>
          <ul className="text-sm mt-1 list-disc ml-5">
            {short.map((s) => (
              <li key={s.subjectId}>{s.name}: attend the next {s.needed} classes in a row to get back to 75%</li>
            ))}
          </ul>
          <p className="text-sm mt-2">Missed classes for illness? <Link to="/medical" className="underline">Submit a medical certificate</Link>.</p>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {data.subjects.map((s) => (
          <div key={s.subjectId} className="card p-4">
            <div className="flex justify-between items-start gap-2">
              <div>
                <div className="font-semibold">{s.name}</div>
                <div className="text-xs text-ink-faint">{s.code}</div>
              </div>
              <RiskBadge tier={s.tier} />
            </div>
            <div className="text-3xl font-semibold mt-3 mb-2">{fmtPct(s.pct)}</div>
            <AttendanceBar pct={s.pct} tier={s.tier} />
            <p className="text-sm text-ink-soft mt-3">
              {s.attended} of {s.total} classes attended
              {s.exempted > 0 && `, ${s.exempted} excused for medical leave`}
            </p>
            <p className="text-sm mt-1 font-medium">
              {s.needed > 0
                ? `Attend the next ${s.needed} classes in a row to reach 75%.`
                : `You can miss ${s.bunksLeft} more and still stay above 75%.`}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
