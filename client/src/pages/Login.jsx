import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

const DEMO = [
  { label: 'Mentor', email: 'mentor@college.edu', password: 'mentor123' },
  { label: 'Faculty (Data Structures)', email: 'faculty1@college.edu', password: 'faculty123' },
  { label: 'Student (Rahul Verma)', email: 'rahul.verma@student.college.edu', password: 'student123' },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-1">AttendAlert</h1>
        <p className="text-sm text-ink-soft mb-6">Log in to see who is slipping under 75%.</p>
        <form onSubmit={submit} className="card p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="email">Email</label>
            <input id="email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="pw">Password</label>
            <input id="pw" className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <p className="text-sm text-crit" role="alert">{error}</p>}
          <button className="btn btn-primary w-full" disabled={busy}>{busy ? 'Logging in...' : 'Log in'}</button>
        </form>

        <div className="mt-6 text-sm">
          <p className="text-ink-soft mb-2">Demo accounts (click to fill in):</p>
          <div className="flex flex-col gap-1.5 items-start">
            {DEMO.map((d) => (
              <button key={d.email} type="button" className="underline text-board"
                onClick={() => { setEmail(d.email); setPassword(d.password); }}>
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
