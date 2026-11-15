import { useState } from 'react';
import { api } from '../api.js';

const SAMPLE = `date,subject_code,roll_no,status
2026-11-16,CS201,22CSE001,P
2026-11-16,CS201,22CSE002,A
2026-11-16,CS201,22CSE008,A
2026-11-16,CS201,22CSE022,L
`;

export default function ImportCsv() {
  const [fileName, setFileName] = useState('');
  const [csv, setCsv] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  function pick(e) {
    const file = e.target.files[0];
    setResult(null);
    setError('');
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setCsv(String(reader.result));
    reader.readAsText(file);
  }

  async function upload() {
    setBusy(true);
    setError('');
    try {
      setResult(await api('/attendance/import', { method: 'POST', body: { csv } }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function downloadSample() {
    const url = URL.createObjectURL(new Blob([SAMPLE], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'attendance-sample.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <h1>Import attendance from CSV</h1>
      <div className="card p-5 text-sm space-y-2">
        <p>Upload a class roster or a biometric log dump. The file needs these columns, in any order:</p>
        <p><code className="bg-slate-100 px-1.5 py-0.5 rounded">date</code> as YYYY-MM-DD, <code className="bg-slate-100 px-1.5 py-0.5 rounded">subject_code</code>, <code className="bg-slate-100 px-1.5 py-0.5 rounded">roll_no</code>, and optionally <code className="bg-slate-100 px-1.5 py-0.5 rounded">status</code> (P, A or L).</p>
        <p className="text-ink-soft">A row with no status is treated as present, since a biometric punch means the student was there. Rows for a date that already has a sheet overwrite that student's mark.</p>
        <button className="btn" onClick={downloadSample}>Download sample file</button>
      </div>

      <div className="card p-5 space-y-3">
        <input type="file" accept=".csv,text/csv" onChange={pick} className="text-sm" aria-label="CSV file" />
        {fileName && <p className="text-sm text-ink-soft">{fileName}, {csv ? csv.split('\n').length - 1 : 0} lines</p>}
        <button className="btn btn-primary" onClick={upload} disabled={!csv || busy}>{busy ? 'Importing...' : 'Import attendance'}</button>
        {error && <p className="text-crit text-sm" role="alert">{error}</p>}
      </div>

      {result && (
        <div className="card p-5 text-sm space-y-2" role="status">
          <p className="font-semibold">
            Imported {result.imported} of {result.rows} rows across {result.sessionsTouched} class sessions.
          </p>
          {result.newlyCritical.length > 0 && (
            <p className="text-crit">{result.newlyCritical.length} new critical shortage(s). Warning emails were queued.</p>
          )}
          {result.errorCount > 0 && (
            <div>
              <p className="text-warn font-medium">{result.errorCount} rows were skipped:</p>
              <ul className="list-disc ml-5 text-ink-soft">
                {result.errors.map((er) => <li key={er}>{er}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
