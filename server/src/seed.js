// Builds a demo dataset: 30 students, 5 subjects, 4 weeks of attendance.
// Run with `npm run seed`. It overwrites server/data/db.json.
import { pathToFileURL } from 'node:url';
import { replace, save, nextId, DB_PATH } from './db.js';
import { hashPassword } from './auth.js';

// small deterministic random generator so everyone gets the same demo data
function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NAMES = [
  'Aarav Sharma', 'Ananya Reddy', 'Vikram Singh', 'Priya Nair', 'Karthik Iyer',
  'Sneha Patil', 'Arjun Mehta', 'Rahul Verma', 'Divya Menon', 'Rohan Gupta',
  'Ishita Banerjee', 'Siddharth Rao', 'Neha Kulkarni', 'Aditya Joshi', 'Pooja Desai',
  'Manish Yadav', 'Kavya Krishnan', 'Harsh Agarwal', 'Tanvi Chopra', 'Varun Malhotra',
  'Meghana Shetty', 'Anil Kumar', 'Shreya Bhatt', 'Nikhil Pandey', 'Fatima Sheikh',
  'Gautam Naidu', 'Lakshmi Prasad', 'Imran Qureshi', 'Deepika Thakur', 'Yash Choudhary',
];

const SUBJECTS = [
  { code: 'CS201', name: 'Data Structures' },
  { code: 'CS202', name: 'Database Systems' },
  { code: 'CS203', name: 'Operating Systems' },
  { code: 'MA201', name: 'Discrete Mathematics' },
  { code: 'CS204', name: 'Computer Networks' },
];

const FACULTY = [
  'Prof. Suresh Nambiar', 'Dr. Lata Deshpande', 'Prof. Farhan Ali', 'Dr. Geeta Krishnamurthy', 'Prof. Anand Rathod',
];

// Hand-picked attendance (classes attended out of 16 per subject), keyed by student index.
// Order: DS, DBMS, OS, DM, CN. Anything not listed is drawn at random from the safe range.
const OVERRIDES = {
  // critical (<65%)
  7:  { 0: 10 },                // Rahul Verma, 62.5% in Data Structures -> needs 8 straight classes
  3:  { 2: 9, 1: 12 },
  12: { 3: 10, 4: 11 },
  18: { 4: 8, 0: 11 },
  24: { 1: 10, 2: 11 },
  // warning (65-74%)
  1:  { 1: 11 },
  5:  { 0: 11, 4: 12 },
  9:  { 2: 11 },
  14: { 3: 11 },                // has an approved medical certificate
  16: { 4: 11 },                // certificate still pending
  21: { 0: 11 },                // one more absence in Data Structures tips Anil Kumar into critical (demo)
  27: { 1: 11, 3: 12 },
  // sitting exactly on the line
  2:  { 0: 12, 1: 12 },
  10: { 2: 12 },
  20: { 4: 12, 3: 13 },
  28: { 0: 12 },
};

// For the two students with medical certificates, force their absences into the leave window
// (week index 0-3, day index 0-4 where 0 = Monday)
const LEAVE = {
  14: { subject: 3, week: 1, days: [0, 4] },
  16: { subject: 4, week: 2, days: [0, 2] },
};

const pad = (n) => String(n).padStart(2, '0');
const fmt = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

function dateFor(week, day) {
  const now = new Date();
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const sinceMonday = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - sinceMonday - 28 + week * 7 + day);
  return fmt(d);
}

export function buildSeed() {
  const db = { counters: {} };
  const rand = mulberry32(2024);
  const studentPw = hashPassword('student123');
  const facultyPw = hashPassword('faculty123');

  db.users = [{
    id: nextId(db, 'users'), name: 'Dr. Meera Iyer', email: 'mentor@college.edu',
    role: 'mentor', password: hashPassword('mentor123'),
  }];
  const facultyIds = FACULTY.map((name, i) => {
    const id = nextId(db, 'users');
    db.users.push({ id, name, email: `faculty${i + 1}@college.edu`, role: 'faculty', password: facultyPw });
    return id;
  });

  db.subjects = SUBJECTS.map((s, i) => ({ id: i + 1, ...s, facultyId: facultyIds[i] }));

  db.students = NAMES.map((name, i) => {
    const [first, last] = name.toLowerCase().split(' ');
    return {
      id: i + 1,
      name,
      rollNo: `22CSE${String(i + 1).padStart(3, '0')}`,
      email: `${first}.${last}@student.college.edu`,
      parentEmail: `parent.${last}${i + 1}@example.com`,
    };
  });
  db.students.forEach((st) => {
    db.users.push({
      id: nextId(db, 'users'), name: st.name, email: st.email,
      role: 'student', studentId: st.id, password: studentPw,
    });
  });

  // sessions: 4 weeks x 5 weekdays, every subject skips one weekday so each day has 4 periods
  db.sessions = [];
  db.subjects.forEach((sub, si) => {
    for (let w = 0; w < 4; w++) {
      for (let d = 0; d < 5; d++) {
        if (d === si) continue;
        db.sessions.push({
          id: nextId(db, 'sessions'), subjectId: sub.id, date: dateFor(w, d),
          week: w, day: d, createdBy: sub.facultyId,
        });
      }
    }
  });

  // records
  db.records = [];
  db.marks = [];
  db.students.forEach((st, idx) => {
    db.subjects.forEach((sub, si) => {
      const sessions = db.sessions.filter((s) => s.subjectId === sub.id);
      let attended = OVERRIDES[idx]?.[si];
      if (attended === undefined) attended = rand() < 0.12 ? 12 : 13 + Math.floor(rand() * 4);
      const absences = sessions.length - attended;

      // shuffle, then (for leave students) pull sessions inside the leave window to the front
      const order = sessions.map((s) => ({ s, k: rand() })).sort((a, b) => a.k - b.k).map((x) => x.s);
      const leave = LEAVE[idx];
      if (leave && leave.subject === si) {
        const inWindow = (s) => s.week === leave.week && s.day >= leave.days[0] && s.day <= leave.days[1];
        order.sort((a, b) => Number(inWindow(b)) - Number(inWindow(a)));
      }
      const absentIds = new Set(order.slice(0, absences).map((s) => s.id));

      sessions.forEach((s) => {
        let status = absentIds.has(s.id) ? 'Absent' : 'Present';
        if (status === 'Present' && rand() < 0.05) status = 'Late';
        db.records.push({ id: nextId(db, 'records'), sessionId: s.id, studentId: st.id, status });
      });

      // midterm marks loosely follow attendance, with some noise
      const frac = attended / sessions.length;
      const base = 50 * (0.2 + 0.75 * ((frac - 0.4) / 0.6));
      const marks = Math.max(8, Math.min(50, Math.round(base + (rand() - 0.5) * 12)));
      db.marks.push({ studentId: st.id, subjectId: sub.id, marks, outOf: 50 });
    });
  });
  db.sessions.forEach((s) => { delete s.week; delete s.day; });

  // medical certificates
  const leaveDates = (week, [d1, d2]) => [dateFor(week, d1), dateFor(week, d2)];
  const [f1, t1] = leaveDates(1, [0, 4]);
  const [f2, t2] = leaveDates(2, [0, 2]);
  db.medical = [
    {
      id: nextId(db, 'medical'), studentId: 15, fromDate: f1, toDate: t1, reason: 'Viral fever, advised bed rest',
      fileName: 'pooja_desai_medical_cert.pdf', status: 'approved',
      submittedAt: new Date(Date.now() - 12 * 864e5).toISOString(), reviewedBy: 1,
    },
    {
      id: nextId(db, 'medical'), studentId: 17, fromDate: f2, toDate: t2, reason: 'Dengue, hospitalised for observation',
      fileName: 'kavya_krishnan_discharge_summary.pdf', status: 'pending',
      submittedAt: new Date(Date.now() - 3 * 864e5).toISOString(), reviewedBy: null,
    },
  ];

  db.interventions = [{
    id: nextId(db, 'interventions'), studentId: 4, subjectId: 3,
    notes: 'Talked after class. Long commute on lab days. Agreed to attend all remaining OS labs and check in next Friday.',
    mentorId: 1, createdAt: new Date(Date.now() - 6 * 864e5).toISOString(),
  }];
  db.emails = [];
  return db;
}

export function seed() {
  replace(buildSeed());
  save();
  return DB_PATH;
}

// run directly: node src/seed.js
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const where = seed();
  console.log(`Seeded demo data -> ${where}`);
  console.log('Mentor login:  mentor@college.edu / mentor123');
  console.log('Faculty login: faculty1@college.edu / faculty123');
  console.log('Student login: rahul.verma@student.college.edu / student123');
}
