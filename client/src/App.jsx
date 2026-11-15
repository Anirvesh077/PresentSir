import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import StudentDetail from './pages/StudentDetail.jsx';
import Attendance from './pages/Attendance.jsx';
import Alerts from './pages/Alerts.jsx';
import Medical from './pages/Medical.jsx';
import Correlation from './pages/Correlation.jsx';
import ImportCsv from './pages/ImportCsv.jsx';
import MyAttendance from './pages/MyAttendance.jsx';

// the page you land on after login depends on who you are
function Home() {
  const { user } = useAuth();
  if (user.role === 'mentor') return <Dashboard />;
  if (user.role === 'student') return <MyAttendance />;
  return <Navigate to="/attendance" replace />;
}

// only let the listed roles see a page; everyone else goes home
function Only({ roles, children }) {
  const { user } = useAuth();
  return roles.includes(user.role) ? children : <Navigate to="/" replace />;
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <p className="p-8 text-ink-soft">Loading...</p>;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route element={user ? <Layout /> : <Navigate to="/login" replace />}>
        <Route path="/" element={<Home />} />
        <Route path="/students/:id" element={<Only roles={['mentor']}><StudentDetail /></Only>} />
        <Route path="/alerts" element={<Only roles={['mentor']}><Alerts /></Only>} />
        <Route path="/correlation" element={<Only roles={['mentor']}><Correlation /></Only>} />
        <Route path="/attendance" element={<Only roles={['mentor', 'faculty']}><Attendance /></Only>} />
        <Route path="/import" element={<Only roles={['mentor', 'faculty']}><ImportCsv /></Only>} />
        <Route path="/medical" element={<Only roles={['mentor', 'student']}><Medical /></Only>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
