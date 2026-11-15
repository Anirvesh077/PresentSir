# AttendAlert

Attendance tracker and early-warning dashboard for mentors. Built for the PresentSir "AttendAlert Hack" problem brief.

The idea is simple: most colleges only find out who is short of 75% when hall tickets are about to be withheld. AttendAlert keeps the percentages live, flags students while there is still time to do something, and tells the mentor exactly how many classes a student has to attend in a row to get back to safe.

## Running it

You need Node 18 or newer (tested on Node 22).

```bash
npm run install:all     # installs root, server and client dependencies
npm run dev             # API on :4000, React app on :5173
```

Open http://localhost:5173.

The first time the server starts it creates `server/data/db.json` and fills it with demo data. To wipe your changes and go back to the demo state, run `npm run seed` (or use the reset endpoint while logged in as mentor).

If you would rather use two terminals: `npm run dev --prefix server` and `npm run dev --prefix client`.

## Logins

| Role | Email | Password |
|------|-------|----------|
| Mentor | mentor@college.edu | mentor123 |
| Faculty (Data Structures) | faculty1@college.edu | faculty123 |
| Student (Rahul Verma) | rahul.verma@student.college.edu | student123 |

Faculty 1 to 5 each teach one subject. Every student has `firstname.lastname@student.college.edu` with password `student123`.

## What is in the box

Must-haves from the brief:

- **Attendance marking**: pick subject and date, everybody starts as present, tap A or L for the exceptions. "Mark all present" resets the sheet. Saved sheets can be reopened and edited.
- **Percentage calculator**: per student and per subject, always computed from the raw records, nothing is cached.
- **Risk tiers**: Safe 75% and above, Warning 65 to 74.x%, Critical below 65%. A student's overall tier is their worst subject.
- **Recovery estimator**: `ceil((0.75 * total - attended) / 0.25)` classes in a row. Also shows how many classes a safe student can still miss.
- **Mentor hub**: dashboard banner, filterable at-risk table (tier, subject, search), an alerts page, and a form to log mentoring interventions.
- **Student portal**: students only see their own numbers. The API enforces this, it is not just hidden in the UI.

Stretch features, all done:

- **Simulated emails**: when a student falls into Critical in a subject, an email to the student and the parent address is queued. Nothing is sent for real, they show up under Alerts > Email outbox and in the server console.
- **Medical leave**: students submit dates and a certificate, the mentor approves or rejects. Approved leave removes the missed classes from that student's total, so the percentages change right away.
- **Marks vs attendance**: scatter plot per subject with the Pearson r. Drawn with plain SVG, no chart library.
- **CSV importer**: columns `date, subject_code, roll_no, status`. Good for biometric dumps (a row with no status counts as present). Bad rows are reported by line number instead of failing the whole file.

## Demo script (about 2 minutes)

1. Log in as the mentor. The red banner says 5 students are in critical shortage.
2. Click "Show critical students", then open **Rahul Verma**. Data Structures is 10 of 16 (62.5%), so he must attend the next 8 classes in a row.
3. Write a note and press "Log mentoring intervention".
4. Go to Mark attendance, pick Data Structures, leave today's date, mark **Anil Kumar** absent and save. He was at 11/16 (68.8%), now 11/17 (64.7%), so he drops into Critical and a warning email is queued.
5. Open Alerts > Email outbox to read it.
6. Medical leave: approve Kavya Krishnan's pending certificate and watch Computer Networks go from 68.8% to 84.6%.
7. Log in as Rahul in another browser to show the student view.

## How the numbers work

- Present and Late both count as attended. Absent does not. If your college counts late differently, there is one function for it: `attendedWeight()` in `server/src/logic.js`.
- Classes missed during an approved medical leave are removed from the total (not counted as attended), which is the usual condonation rule.
- When the "classes needed" figure is calculated, every class attended adds 1 to both attended and total, which is where the formula comes from. There is a test that checks it by brute force for every attended/total pair up to 60.

## Project layout

```
server/
  src/index.js      express routes
  src/services.js   attendance maths glue, sheets, csv import, emails, medical, correlation
  src/logic.js      thresholds, tiers, recovery formula, csv parser
  src/seed.js       30 students, 5 subjects, 4 weeks of attendance, edge cases near 75%
  src/db.js         JSON file store
  src/auth.js       login + sessions (scrypt, tokens kept in memory)
  test/             node:test tests (npm test)
client/
  src/pages/        Dashboard, StudentDetail, Attendance, Alerts, Medical, Correlation, ImportCsv, MyAttendance
  src/components/   Layout, RiskBadge, AttendanceBar
```

## API quick reference

All routes except login need `Authorization: Bearer <token>`.

| Method | Route | Who |
|--------|-------|-----|
| POST | /api/login | anyone |
| GET | /api/dashboard | mentor |
| GET | /api/students/:id/summary | mentor, or the student themself |
| GET / POST | /api/attendance/sheet | mentor, faculty (own subjects) |
| POST | /api/attendance/import | mentor, faculty (own subjects) |
| GET / POST | /api/interventions | mentor |
| GET | /api/emails | mentor |
| GET / POST / PATCH | /api/medical | student submits, mentor reviews |
| GET | /api/correlation?subjectId= | mentor |

## Known shortcuts

- The JSON store rewrites the whole file on every save. Fine for 30 students, not for a whole university. Swapping in SQLite would only touch `db.js` and `services.js`.
- Login sessions are in memory, so restarting the server logs everyone out.
- The medical certificate upload stores the file name only, not the file.
- Seeded dates are relative to the day you seed, so the "last 4 weeks" always looks recent.
- Demo passwords are in this file on purpose. Change them before anything real.

## Tests

```bash
npm test
```

Covers the tier boundaries, the recovery formula, the seeded demo numbers, the email trigger, medical leave and the CSV importer.
