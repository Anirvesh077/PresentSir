import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

const NAV = {
  mentor: [
    { to: '/', label: 'Dashboard', end: true },
    { to: '/alerts', label: 'Alerts' },
    { to: '/attendance', label: 'Mark attendance' },
    { to: '/import', label: 'Import CSV' },
    { to: '/medical', label: 'Medical leave' },
    { to: '/correlation', label: 'Marks vs attendance' },
  ],
  faculty: [
    { to: '/attendance', label: 'Mark attendance' },
    { to: '/import', label: 'Import CSV' },
  ],
  student: [
    { to: '/', label: 'My attendance', end: true },
    { to: '/medical', label: 'Medical leave' },
  ],
};

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const links = NAV[user.role];

  const leave = () => { logout(); navigate('/login'); };

  return (
    <div className="min-h-screen md:flex">
      <aside className="bg-board text-white md:w-60 md:min-h-screen md:flex md:flex-col shrink-0">
        <div className="px-5 py-5">
          <div className="text-lg font-bold tracking-tight">AttendAlert</div>
          <div className="text-xs text-slate-300">75% rule, tracked early</div>
        </div>
        <nav className="flex md:block overflow-x-auto px-2 pb-2 md:pb-0">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `block whitespace-nowrap rounded-md px-3 py-2 text-sm md:mb-0.5 ${
                  isActive ? 'bg-white/15 font-semibold' : 'text-slate-200 hover:bg-white/10'
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden md:block mt-auto px-5 py-4 border-t border-white/10 text-sm">
          <div className="font-medium">{user.name}</div>
          <div className="text-xs text-slate-300 capitalize mb-2">{user.role}</div>
          <button className="text-xs underline text-slate-200 hover:text-white" onClick={leave}>Log out</button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 p-4 md:p-8 max-w-6xl">
        <div className="md:hidden flex justify-between items-center text-sm mb-4">
          <span>{user.name}</span>
          <button className="underline" onClick={leave}>Log out</button>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
