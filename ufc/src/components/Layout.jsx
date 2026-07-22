import { Outlet, Link, useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { LayoutDashboard, Plus, LogOut, Swords } from 'lucide-react';

const navItems = [
  { label: 'Breakdowns', path: '/', icon: LayoutDashboard },
  { label: 'New Breakdown', path: '/new', icon: Plus },
];

export default function Layout() {
  const location = useLocation();
  return (
    <div className="min-h-screen bg-[#0D1117] text-slate-200 md:flex">
      <aside className="md:w-60 md:min-h-screen bg-[#161B22] border-b md:border-b-0 md:border-r border-white/5 flex md:flex-col items-center md:items-stretch justify-between px-4 py-3 md:py-6 md:px-4">
        <div className="flex md:flex-col items-center md:items-stretch gap-4 md:gap-8 w-full">
          <Link to="/" className="flex items-center gap-2.5 md:px-2">
            <div className="w-8 h-8 rounded-lg bg-[#FF2D2D] flex items-center justify-center">
              <Swords className="w-5 h-5 text-white" />
            </div>
            <span className="font-heading font-bold text-lg tracking-tight text-white">Octagon<span className="text-[#FF2D2D]">IQ</span></span>
          </Link>
          <nav className="flex md:flex-col gap-1 md:w-full">
            {navItems.map(({ label, path, icon: Icon }) => (
              <Link
                key={path}
                to={path}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === path
                    ? 'bg-[#FF2D2D]/10 text-[#FF2D2D]'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            ))}
          </nav>
        </div>
        <button
          onClick={() => base44.auth.logout()}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-white hover:bg-white/5 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Log out</span>
        </button>
      </aside>
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
