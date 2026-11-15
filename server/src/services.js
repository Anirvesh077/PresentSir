import { nextId } from './db.js';
import {
  attendedWeight, percent, tierFor, worstTier, classesNeeded, bunksLeft, parseCsv,
} from './logic.js';

const round1 = (n) => (n === null ? null : Math.round(n * 10) / 10);

/* ---------- attendance numbers ---------- */

// One pass over the records gives us attended/total for every student x subject.
export function computeAll(db) {
  const sessionById = new Map(db.sessions.map((s) => [s.id, s]));
  const certsByStudent = new Map();
  for (const m of db.medical) {
    if (m.status !== 'approved') continue;
    if (!certsByStudent.has(m.studentId)) certsByStudent.set(m.studentId, []);
    certsByStudent.get(m.studentId).push(m);
  }

  const table = new Map(); // studentId -> Map(subjectId -> counts)
  for (const st of db.students) {
    table.set(st.id, new Map(db.subjects.map((s) => [s.id, { attended: 0, total: 0, exempted: 0, late: 0, absent: 0 }])));
  }

  for (const r of db.records) {
    const session = sessionById.get(r.sessionId);
    const row = table.get(r.studentId);
    if (!session || !row) continue;
    const c = row.get(session.subjectId);
    if (!c) continue;
    const certs = certsByStudent.get(r.studentId) || [];
    const covered = certs.some((m) => session.date >= m.fromDate && session.date <= m.toDate);
    if (r.status === 'Absent' && covered) { c.exempted++; continue; } // approved medical leave: class does not count against them
    c.total++;
    const w = attendedWeight(r.status);
    c.attended += w;
    if (w === 0) c.absent++;
    if (r.status === 'Late') c.late++;
  }
  return table;
}

function buildSummary(db, studentId, table) {
  const row = table.get(studentId);
  const subjects = db.subjects.map((sub) => {
    const c = row.get(sub.id);
    const raw = percent(c.attended, c.total);
    return {
      subjectId: sub.id,
      code: sub.code,
      name: sub.name,
      ...c,
      pct: round1(raw),
      rawPct: raw,
      tier: tierFor(raw),
      needed: classesNeeded(c.attended, c.total),
      bunksLeft: bunksLeft(c.attended, c.total),
    };
  });
  const attended = subjects.reduce((n, s) => n + s.attended, 0);
  const total = subjects.reduce((n, s) => n + s.total, 0);
  const overallRaw = percent(attended, total);
  const risk = worstTier(subjects.map((s) => s.tier));
  const counted = subjects.filter((s) => s.total > 0);
  const worst = counted.length ? counted.reduce((a, b) => (b.rawPct < a.rawPct ? b : a)) : null;
  return {
    subjects,
    overall: { attended, total, pct: round1(overallRaw), tier: tierFor(overallRaw) },
    risk,
    worst,
  };
}

export function studentSummary(db, studentId) {
  return buildSummary(db, studentId, computeAll(db));
}

export function dashboard(db) {
  const table = computeAll(db);
  const rows = db.students.map((st) => {
    const sum = buildSummary(db, st.id, table);
    const notes = db.interventions.filter((i) => i.studentId === st.id);
    return {
      id: st.id,
      name: st.name,
      rollNo: st.rollNo,
      risk: sum.risk,
      overallPct: sum.overall.pct,
      worst: sum.worst && {
        subjectId: sum.worst.subjectId, code: sum.worst.code, name: sum.worst.name,
        pct: sum.worst.pct, needed: sum.worst.needed, attended: sum.worst.attended, total: sum.worst.total,
      },
      subjects: sum.subjects.map((s) => ({
        subjectId: s.subjectId, code: s.code, pct: s.pct, tier: s.tier, needed: s.needed,
      })),
      interventionCount: notes.length,
      lastIntervention: notes.length ? notes[notes.length - 1].createdAt : null,
    };
  });
  const counts = { safe: 0, warning: 0, critical: 0 };
  rows.forEach((r) => counts[r.risk]++);
  return { counts, total: rows.length, students: rows };
}

/* ---------- risk snapshots + simulated emails ---------- */

function snapshotTiers(db) {
  const table = computeAll(db);
  const snap = new Map();
  for (const [studentId, row] of table) {
    for (const [subjectId, c] of row) {
      snap.set(`${studentId}:${subjectId}`, { tier: tierFor(percent(c.attended, c.total)), ...c });
    }
  }
  return snap;
}

// Compare before/after and queue an email for anyone who just fell into Critical.
function queueCriticalEmails(db, before, after, trigger) {
  const fresh = [];
  for (const [key, now] of after) {
    const was = before.get(key);
    if (now.tier !== 'critical' || (was && was.tier === 'critical')) continue;
    const [studentId, subjectId] = key.split(':').map(Number);
    const student = db.students.find((s) => s.id === studentId);
    const subject = db.subjects.find((s) => s.id === subjectId);
    const pct = round1(percent(now.attended, now.total));
    const needed = classesNeeded(now.attended, now.total);
    const email = {
      id: nextId(db, 'emails'),
      studentId,
      subjectId,
      to: [student.email, student.parentEmail],
      subject: `Attendance shortage: ${subject.name} (${pct}%)`,
      body:
        `Dear ${student.name} / Parent,\n\n` +
        `Attendance in ${subject.name} is now ${pct}% (${now.attended} of ${now.total} classes), ` +
        `below the 65% critical mark. The minimum for exam eligibility is 75%.\n\n` +
        `To get back above 75% the student has to attend the next ${needed} classes in a row without a miss.\n` +
        `Please contact the mentor as soon as possible.\n\n- AttendAlert (simulated email, not actually sent)`,
      trigger,
      createdAt: new Date().toISOString(),
    };
    db.emails.push(email);
    console.log(`[email] to ${email.to.join(', ')} :: ${email.subject}`);
    fresh.push({ studentId, name: student.name, subject: subject.name, pct, needed });
  }
  return fresh;
}

/* ---------- attendance sheet ---------- */

export const STATUSES = ['Present', 'Absent', 'Late'];

export function getSheet(db, subjectId, date) {
  const session = db.sessions.find((s) => s.subjectId === subjectId && s.date === date);
  const existing = new Map();
  if (session) db.records.filter((r) => r.sessionId === session.id).forEach((r) => existing.set(r.studentId, r.status));
  return {
    exists: !!session,
    students: db.students.map((st) => ({
      studentId: st.id,
      name: st.name,
      rollNo: st.rollNo,
      // default for a brand new sheet is everyone present; teacher only unticks absentees
      status: existing.get(st.id) || 'Present',
    })),
  };
}

function upsertRecord(db, sessionId, studentId, status) {
  const rec = db.records.find((r) => r.sessionId === sessionId && r.studentId === studentId);
  if (rec) rec.status = status;
  else db.records.push({ id: nextId(db, 'records'), sessionId, studentId, status });
}

function upsertSession(db, subjectId, date, createdBy) {
  let session = db.sessions.find((s) => s.subjectId === subjectId && s.date === date);
  if (!session) {
    session = { id: nextId(db, 'sessions'), subjectId, date, createdBy };
    db.sessions.push(session);
  }
  return session;
}

export function saveSheet(db, user, { subjectId, date, records }) {
  const subject = db.subjects.find((s) => s.id === subjectId);
  if (!subject) throw httpError(400, 'Unknown subject.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) throw httpError(400, 'Pick a valid date.');
  if (!Array.isArray(records) || records.length === 0) throw httpError(400, 'No attendance rows received.');
  if (user.role === 'faculty' && subject.facultyId !== user.id) {
    throw httpError(403, 'You can only mark attendance for your own subjects.');
  }

  const before = snapshotTiers(db);
  const session = upsertSession(db, subjectId, date, user.id);
  for (const r of records) {
    if (!STATUSES.includes(r.status)) continue;
    if (!db.students.some((s) => s.id === r.studentId)) continue;
    upsertRecord(db, session.id, r.studentId, r.status);
  }
  const newlyCritical = queueCriticalEmails(db, before, snapshotTiers(db), 'attendance-marked');
  return { sessionId: session.id, saved: records.length, newlyCritical };
}

/* ---------- CSV import ---------- */

function normaliseStatus(raw) {
  const v = String(raw ?? '').trim().toLowerCase();
  if (v === '' || ['p', 'present', '1', 'y', 'yes', 'in'].includes(v)) return 'Present'; // a biometric punch with no status = present
  if (['a', 'absent', '0', 'n', 'no'].includes(v)) return 'Absent';
  if (['l', 'late'].includes(v)) return 'Late';
  return null;
}

// Expected columns (any order): date, subject_code, roll_no, status
export function importCsv(db, user, text) {
  const rows = parseCsv(text);
  if (rows.length < 2) throw httpError(400, 'The file has no data rows.');
  const header = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const col = (...names) => header.findIndex((h) => names.includes(h));
  const iDate = col('date');
  const iSubject = col('subject_code', 'subject', 'code');
  const iRoll = col('roll_no', 'roll', 'rollno', 'student');
  const iStatus = col('status', 'attendance');
  if (iDate < 0 || iSubject < 0 || iRoll < 0) {
    throw httpError(400, 'Header must contain: date, subject_code, roll_no (status is optional).');
  }

  const before = snapshotTiers(db);
  const errors = [];
  let imported = 0;
  const touched = new Set();

  rows.slice(1).forEach((row, idx) => {
    const line = idx + 2;
    const date = (row[iDate] || '').trim();
    const code = (row[iSubject] || '').trim().toLowerCase();
    const roll = (row[iRoll] || '').trim().toLowerCase();
    const status = normaliseStatus(iStatus >= 0 ? row[iStatus] : '');
    const subject = db.subjects.find((s) => s.code.toLowerCase() === code);
    const student = db.students.find((s) => s.rollNo.toLowerCase() === roll);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return errors.push(`Line ${line}: date "${date}" should look like 2026-11-03`);
    if (!subject) return errors.push(`Line ${line}: unknown subject "${row[iSubject]}"`);
    if (!student) return errors.push(`Line ${line}: unknown roll number "${row[iRoll]}"`);
    if (!status) return errors.push(`Line ${line}: status "${row[iStatus]}" not understood`);
    if (user.role === 'faculty' && subject.facultyId !== user.id) {
      return errors.push(`Line ${line}: ${subject.code} is not one of your subjects`);
    }
    const session = upsertSession(db, subject.id, date, user.id);
    upsertRecord(db, session.id, student.id, status);
    touched.add(session.id);
    imported++;
  });

  const newlyCritical = queueCriticalEmails(db, before, snapshotTiers(db), 'csv-import');
  return {
    rows: rows.length - 1,
    imported,
    sessionsTouched: touched.size,
    errors: errors.slice(0, 25),
    errorCount: errors.length,
    newlyCritical,
  };
}

/* ---------- correlation (attendance vs midterm marks) ---------- */

export function correlation(db, subjectId) {
  const table = computeAll(db);
  const points = [];
  for (const st of db.students) {
    const mark = db.marks.find((m) => m.studentId === st.id && m.subjectId === subjectId);
    const c = table.get(st.id).get(subjectId);
    if (!mark || c.total === 0) continue;
    points.push({
      studentId: st.id, name: st.name, rollNo: st.rollNo,
      attendance: round1(percent(c.attended, c.total)), marks: mark.marks, outOf: mark.outOf,
    });
  }
  const n = points.length;
  let r = null;
  if (n > 2) {
    const mx = points.reduce((a, p) => a + p.attendance, 0) / n;
    const my = points.reduce((a, p) => a + p.marks, 0) / n;
    let sxy = 0, sxx = 0, syy = 0;
    points.forEach((p) => {
      sxy += (p.attendance - mx) * (p.marks - my);
      sxx += (p.attendance - mx) ** 2;
      syy += (p.marks - my) ** 2;
    });
    r = sxx && syy ? Math.round((sxy / Math.sqrt(sxx * syy)) * 100) / 100 : null;
  }
  return { points, r };
}

/* ---------- medical leave + interventions ---------- */

export function submitMedical(db, { studentId, fromDate, toDate, reason, fileName }) {
  if (!db.students.some((s) => s.id === studentId)) throw httpError(400, 'Unknown student.');
  if (!fromDate || !toDate || fromDate > toDate) throw httpError(400, 'Check the leave dates.');
  const cert = {
    id: nextId(db, 'medical'), studentId, fromDate, toDate,
    reason: reason || '', fileName: fileName || 'certificate (not attached)',
    status: 'pending', submittedAt: new Date().toISOString(), reviewedBy: null,
  };
  db.medical.push(cert);
  return cert;
}

export function reviewMedical(db, user, id, status) {
  const cert = db.medical.find((m) => m.id === id);
  if (!cert) throw httpError(404, 'Certificate not found.');
  if (!['approved', 'rejected'].includes(status)) throw httpError(400, 'Status must be approved or rejected.');
  const before = snapshotTiers(db);
  cert.status = status;
  cert.reviewedBy = user.id;
  cert.reviewedAt = new Date().toISOString();
  queueCriticalEmails(db, before, snapshotTiers(db), 'medical-review');
  return cert;
}

export function addIntervention(db, user, { studentId, subjectId, notes }) {
  if (!db.students.some((s) => s.id === studentId)) throw httpError(400, 'Unknown student.');
  if (!notes || !notes.trim()) throw httpError(400, 'Write a short note first.');
  const item = {
    id: nextId(db, 'interventions'), studentId, subjectId: subjectId || null,
    notes: notes.trim(), mentorId: user.id, createdAt: new Date().toISOString(),
  };
  db.interventions.push(item);
  return item;
}

export function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}
