import { test } from 'node:test';
import assert from 'node:assert/strict';
import { replace } from '../src/db.js';
import { buildSeed } from '../src/seed.js';
import * as svc from '../src/services.js';

const fresh = () => { const db = buildSeed(); replace(db); return db; };
const mentor = { id: 1, role: 'mentor' };

test('seed gives 5 critical students and Rahul needs 8 classes in Data Structures', () => {
  const db = fresh();
  const d = svc.dashboard(db);
  assert.equal(d.counts.critical, 5);
  const rahul = d.students.find((s) => s.name === 'Rahul Verma');
  assert.equal(rahul.worst.code, 'CS201');
  assert.equal(rahul.worst.needed, 8);
});

test('marking a warning student absent queues an email', () => {
  const db = fresh();
  const anil = db.students.find((s) => s.name === 'Anil Kumar');
  const ds = db.subjects[0];
  const sheet = svc.getSheet(db, ds.id, '2099-01-05');
  const records = sheet.students.map((s) => ({ studentId: s.studentId, status: s.studentId === anil.id ? 'Absent' : 'Present' }));
  const out = svc.saveSheet(db, mentor, { subjectId: ds.id, date: '2099-01-05', records });
  assert.ok(out.newlyCritical.some((n) => n.name === 'Anil Kumar'));
  assert.equal(db.emails.length, 1);
});

test('approved medical leave is excluded from the total', () => {
  const db = fresh();
  const pooja = db.students.find((s) => s.name === 'Pooja Desai');
  const dm = svc.studentSummary(db, pooja.id).subjects.find((s) => s.code === 'MA201');
  assert.equal(dm.exempted, 4);
  assert.equal(dm.total, 12);
  db.medical[0].status = 'rejected';
  const dm2 = svc.studentSummary(db, pooja.id).subjects.find((s) => s.code === 'MA201');
  assert.equal(dm2.total, 16);
  assert.equal(dm2.tier, 'warning');
});

test('csv import adds sessions and reports bad rows', () => {
  const db = fresh();
  const csv = 'date,subject_code,roll_no,status\n2099-02-02,CS201,22CSE001,P\n2099-02-02,CS201,22CSE008,A\n2099-02-02,CS201,NOPE,P\n';
  const out = svc.importCsv(db, mentor, csv);
  assert.equal(out.imported, 2);
  assert.equal(out.errorCount, 1);
});
