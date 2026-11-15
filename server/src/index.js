import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import { load, save, DB_PATH } from './db.js';
import { seed } from './seed.js';
import { checkPassword, createSession, requireAuth, requireRole } from './auth.js';
import * as svc from './services.js';

// first run: no data file yet, so build the demo dataset
if (!fs.existsSync(DB_PATH)) {
  console.log('No database found, seeding demo data...');
  seed();
}

const db = () => load();
const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' })); // CSV roster dumps can be biggish

const auth = requireAuth(db);
const staff = requireRole('mentor', 'faculty');
const mentorOnly = requireRole('mentor');

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, studentId: u.studentId || null });

// wrap handlers so thrown errors (svc.httpError) become JSON responses
const wrap = (fn) => (req, res, next) => {
  try {
    const out = fn(req, res);
    if (out !== undefined) res.json(out);
  } catch (err) { next(err); }
};

/* ---- auth ---- */
app.post('/api/login', wrap((req) => {
  const { email, password } = req.body || {};
  const user = db().users.find((u) => u.email.toLowerCase() === String(email || '').toLowerCase());
  if (!user || !checkPassword(String(password || ''), user.password)) {
    throw svc.httpError(401, 'Email or password is wrong.');
  }
  return { token: createSession(user), user: publicUser(user) };
}));

app.get('/api/me', auth, wrap((req) => publicUser(req.user)));

/* ---- reference data ---- */
app.get('/api/subjects', auth, wrap((req) => {
  const subjects = db().subjects.map((s) => ({
    ...s, facultyName: db().users.find((u) => u.id === s.facultyId)?.name,
  }));
  if (req.user.role === 'faculty') return subjects.map((s) => ({ ...s, mine: s.facultyId === req.user.id }));
  return subjects.map((s) => ({ ...s, mine: true }));
}));

/* ---- mentor dashboard ---- */
app.get('/api/dashboard', auth, mentorOnly, wrap(() => svc.dashboard(db())));

// one student's numbers. Staff can open anyone; a student can only open themselves.
app.get('/api/students/:id/summary', auth, wrap((req) => {
  const id = Number(req.params.id);
  const isOwn = req.user.role === 'student' && req.user.studentId === id;
  if (!isOwn && req.user.role !== 'mentor') throw svc.httpError(403, 'You do not have access to this student.');
  const student = db().students.find((s) => s.id === id);
  if (!student) throw svc.httpError(404, 'Student not found.');
  return { student: { id: student.id, name: student.name, rollNo: student.rollNo }, ...svc.studentSummary(db(), id) };
}));

/* ---- attendance marking ---- */
app.get('/api/attendance/sheet', auth, staff, wrap((req) => {
  const subjectId = Number(req.query.subjectId);
  const date = String(req.query.date || '');
  return svc.getSheet(db(), subjectId, date);
}));

app.post('/api/attendance/sheet', auth, staff, wrap((req) => {
  const result = svc.saveSheet(db(), req.user, {
    subjectId: Number(req.body.subjectId), date: req.body.date, records: req.body.records,
  });
  save();
  return result;
}));

app.post('/api/attendance/import', auth, staff, wrap((req) => {
  const result = svc.importCsv(db(), req.user, String(req.body.csv || ''));
  save();
  return result;
}));

/* ---- mentoring ---- */
app.get('/api/interventions', auth, mentorOnly, wrap((req) => {
  const studentId = Number(req.query.studentId);
  return db().interventions
    .filter((i) => i.studentId === studentId)
    .map((i) => ({ ...i, mentorName: db().users.find((u) => u.id === i.mentorId)?.name }))
    .reverse();
}));

app.post('/api/interventions', auth, mentorOnly, wrap((req) => {
  const item = svc.addIntervention(db(), req.user, {
    studentId: Number(req.body.studentId),
    subjectId: req.body.subjectId ? Number(req.body.subjectId) : null,
    notes: req.body.notes,
  });
  save();
  return item;
}));

app.get('/api/emails', auth, mentorOnly, wrap(() => {
  return db().emails.map((e) => ({
    ...e, studentName: db().students.find((s) => s.id === e.studentId)?.name,
  })).reverse();
}));

/* ---- medical leave ---- */
app.get('/api/medical', auth, wrap((req) => {
  const list = db().medical.map((m) => ({
    ...m, studentName: db().students.find((s) => s.id === m.studentId)?.name,
  }));
  if (req.user.role === 'student') return list.filter((m) => m.studentId === req.user.studentId).reverse();
  if (req.user.role === 'mentor') return list.reverse();
  throw svc.httpError(403, 'You do not have access to this.');
}));

app.post('/api/medical', auth, wrap((req) => {
  if (req.user.role !== 'student') throw svc.httpError(403, 'Students submit their own certificates.');
  const cert = svc.submitMedical(db(), { ...req.body, studentId: req.user.studentId });
  save();
  return cert;
}));

app.patch('/api/medical/:id', auth, mentorOnly, wrap((req) => {
  const cert = svc.reviewMedical(db(), req.user, Number(req.params.id), req.body.status);
  save();
  return cert;
}));

/* ---- analytics ---- */
app.get('/api/correlation', auth, mentorOnly, wrap((req) => svc.correlation(db(), Number(req.query.subjectId))));

/* ---- dev helper: put the demo data back ---- */
app.post('/api/reset-demo', auth, mentorOnly, wrap(() => {
  seed();
  return { ok: true };
}));

app.use((req, res) => res.status(404).json({ error: 'Not found.' }));
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (!err.status) console.error(err);
  res.status(err.status || 500).json({ error: err.status ? err.message : 'Something broke on the server.' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`AttendAlert API on http://localhost:${PORT}`));
