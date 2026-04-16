import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../App';
import { logOut } from '../firebase';
import { 
  LayoutDashboard, 
  Settings, 
  LogOut, 
  User as UserIcon,
  ChevronRight,
  Menu,
  X
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '../lib/utils';

export function Layout() {
  const { profile, isAdmin } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { label: 'Projeler', path: '/', icon: LayoutDashboard },
    ...(isAdmin ? [{ label: 'Yönetim', path: '/admin', icon: Settings }] : []),
  ];

  return (
    <div className="flex h-screen bg-[#050505] text-white overflow-hidden font-sans relative">
      {/* Background Glows */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#6366F1]/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#6366F1]/3 rounded-full blur-[120px]" />
      </div>

      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 border-r border-white/10 bg-white/[0.02] backdrop-blur-xl relative z-10">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-[#6366F1] rounded-lg flex items-center justify-center font-bold text-black shadow-[0_0_20px_rgba(99,102,241,0.2)]">D</div>
          <h1 className="text-xl font-semibold tracking-tight">DakikTabela</h1>
        </div>
        
        <nav className="flex-1 px-4 py-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                location.pathname === item.path 
                  ? "bg-[#6366F1] text-black font-medium shadow-[0_5px_15px_rgba(99,102,241,0.2)]" 
                  : "text-white/60 hover:text-white hover:bg-white/5"
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-4 py-3 bg-white/[0.03] rounded-2xl border border-white/5">
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center overflow-hidden border border-white/10">
              {profile?.photoURL ? (
                <img src={profile.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <UserIcon className="w-5 h-5 text-white/40" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{profile?.displayName || profile?.email}</p>
              <p className="text-xs text-white/40 capitalize">{profile?.role}</p>
            </div>
            <button 
              onClick={() => logOut()}
              className="p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 border-b border-white/10 bg-white/[0.02] backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[#6366F1] rounded flex items-center justify-center font-bold text-black text-xs shadow-[0_0_10px_rgba(99,102,241,0.2)]">D</div>
            <h1 className="font-semibold">DakikTabela</h1>
          </div>
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2">
            {isMobileMenuOpen ? <X /> : <Menu />}
          </button>
        </header>

        {/* Mobile Nav Overlay */}
        {isMobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-50 bg-[#050505]/95 backdrop-blur-2xl p-6 flex flex-col">
            <div className="flex justify-between items-center mb-8">
              <h1 className="text-2xl font-bold">Menü</h1>
              <button onClick={() => setIsMobileMenuOpen(false)}><X className="w-8 h-8" /></button>
            </div>
            <nav className="space-y-4">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-4 text-xl py-4 px-6 rounded-2xl transition-all",
                    location.pathname === item.path ? "bg-[#6366F1] text-black font-bold" : "text-white/60"
                  )}
                >
                  <item.icon className="w-6 h-6" />
                  {item.label}
                </Link>
              ))}
              <button 
                onClick={() => logOut()}
                className="flex items-center gap-4 text-xl py-4 px-6 rounded-2xl text-red-500 hover:bg-red-500/10 transition-all"
              >
                <LogOut className="w-6 h-6" />
                Çıkış Yap
              </button>
            </nav>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
