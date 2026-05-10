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
import { motion, AnimatePresence } from 'framer-motion';

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
      {/* Background Animated Blobs for Layout */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#6366F1]/5 rounded-full blur-[120px] animate-blob" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-500/5 rounded-full blur-[120px] animate-blob animation-delay-4000" />
      </div>

      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-72 border-r border-white/10 bg-white/[0.02] backdrop-blur-3xl relative z-10 transition-all duration-500 ease-in-out">
        <div className="p-8 flex items-center gap-4">
          <div className="w-10 h-10 bg-white text-[#050505] rounded-xl flex items-center justify-center font-black text-xl shadow-[0_0_30px_rgba(255,255,255,0.2)] transform -rotate-3 hover:rotate-0 transition-transform cursor-pointer">D</div>
          <div className="flex flex-col">
            <h1 className="text-xl font-black italic tracking-tighter uppercase leading-none">Dakik</h1>
            <span className="text-[10px] font-bold text-white/40 uppercase tracking-[0.3em] mt-1 ml-0.5">Tabela</span>
          </div>
        </div>
        
        <nav className="flex-1 px-4 py-8 space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-300 group relative overflow-hidden",
                location.pathname === item.path 
                  ? "bg-white text-black font-bold shadow-[0_10px_30px_rgba(255,255,255,0.1)]" 
                  : "text-white/40 hover:text-white hover:bg-white/5"
              )}
            >
              <item.icon className={cn("w-5 h-5 transition-transform group-hover:scale-110", location.pathname === item.path ? "text-black" : "text-[#6366F1]")} />
              <span className="tracking-tight">{item.label}</span>
              {location.pathname === item.path && (
                <motion.div 
                  layoutId="navItemBg"
                  className="absolute left-0 w-1 h-6 bg-black rounded-r-full"
                  initial={false}
                />
              )}
            </Link>
          ))}
        </nav>

        <div className="p-6">
          <div className="flex flex-col gap-4 p-6 bg-white/[0.03] rounded-[2rem] border border-white/5 backdrop-blur-2xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#6366F1] to-purple-600 flex items-center justify-center overflow-hidden border border-white/10 p-0.5">
                {profile?.photoURL ? (
                  <img src={profile.photoURL} alt="" className="w-full h-full rounded-[14px] object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full rounded-[14px] bg-[#050505] flex items-center justify-center text-white/40 font-bold">
                    {profile?.displayName?.charAt(0) || profile?.email?.charAt(0)}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate tracking-tight">{profile?.displayName || profile?.email}</p>
                <div className="flex items-center gap-2 mt-0.5">
                   <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                   <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">{profile?.role}</p>
                </div>
              </div>
            </div>
            <button 
              onClick={() => logOut()}
              className="w-full py-3 bg-white/5 hover:bg-red-500/10 text-white/40 hover:text-red-500 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest border border-white/5"
            >
              <LogOut className="w-3.5 h-3.5" />
              Çıkış
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">
        {/* Dynamic Watermark Overlay */}
        <div className="fixed inset-0 pointer-events-none z-[100] opacity-[0.03] select-none overflow-hidden flex flex-wrap gap-24 p-20 content-start">
          {Array.from({ length: 40 }).map((_, i) => (
            <div key={i} className="text-3xl font-black uppercase tracking-[0.5em] -rotate-45 whitespace-nowrap">
              DAKİK TABELA KURUMSAL • GÜVENLİ TASARIM
            </div>
          ))}
        </div>
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
