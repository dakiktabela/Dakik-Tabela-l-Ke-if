import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Project, ProjectStatus } from '../types';
import { Link } from 'react-router-dom';
import { Plus, Search, Filter, ChevronRight, Clock, MapPin, Layout as LayoutIcon, GripVertical, Palette } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { cn } from '../lib/utils';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { useAuth } from '../App';
import { motion, AnimatePresence, Variants } from 'framer-motion';

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0, 
    transition: { 
      duration: 0.5, 
      ease: [0.22, 1, 0.36, 1] 
    } 
  }
};

const STATUS_LABELS: Record<ProjectStatus, string> = {
  draft: 'Taslak',
  pending_survey: 'Keşif Bekliyor',
  surveying: 'Keşifte',
  survey_completed: 'Ölçü Tamamlandı',
  design_in_progress: 'Grafik Çalışmada',
  revision: 'Revize',
  pending_approval: 'Onay Bekliyor',
  in_production: 'Üretimde',
  in_installation: 'Montajda',
  completed: 'Tamamlandı'
};

const STATUS_COLORS: Record<ProjectStatus, string> = {
  draft: 'bg-white/10 text-white/60',
  pending_survey: 'bg-yellow-500/10 text-yellow-500',
  surveying: 'bg-blue-500/10 text-blue-500',
  survey_completed: 'bg-green-500/10 text-green-500',
  design_in_progress: 'bg-purple-500/10 text-purple-500',
  revision: 'bg-red-500/10 text-red-500',
  pending_approval: 'bg-orange-500/10 text-orange-500',
  in_production: 'bg-cyan-500/10 text-cyan-500',
  in_installation: 'bg-indigo-500/10 text-indigo-500',
  completed: 'bg-emerald-500/10 text-emerald-500'
};

export function Dashboard() {
  const { profile } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [sortField, setSortField] = useState<'name' | 'createdAt' | 'status'>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [filterStatus, setFilterStatus] = useState<'all' | ProjectStatus>('all');

  useEffect(() => {
    const q = query(collection(db, 'projects'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const projectsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Project[];
      setProjects(projectsData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'projects');
    });

    return () => unsubscribe();
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    try {
      await addDoc(collection(db, 'projects'), {
        name: newProjectName,
        status: 'draft',
        assignedTo: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      setNewProjectName('');
      setIsModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'projects');
    }
  };

  const filteredProjects = projects
    .filter(p => filterStatus === 'all' || p.status === filterStatus)
    .filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.address?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      let comparison = 0;
      if (sortField === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortField === 'createdAt') {
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sortField === 'status') {
        comparison = STATUS_LABELS[a.status].localeCompare(STATUS_LABELS[b.status]);
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

  const handleSort = (field: 'name' | 'createdAt' | 'status') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="space-y-8"
    >
      <motion.div variants={itemVariants} className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-12">
        <div className="flex flex-col">
          <motion.h1 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-6xl font-black italic tracking-tighter uppercase leading-[0.8] mb-4"
          >
            PANEL
          </motion.h1>
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-[#6366F1] animate-pulse" />
            <p className="text-white/40 font-bold uppercase tracking-[0.3em] text-[10px]">
              Sistemde {projects.length} Aktif Proje Bulunuyor
            </p>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
          <div className="relative group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-[#6366F1] transition-all" />
            <input
              type="text"
              placeholder="Hızlı Proje Ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-white/[0.03] backdrop-blur-3xl border border-white/10 rounded-[2rem] py-5 pl-14 pr-8 w-full md:w-80 text-sm focus:outline-none focus:border-[#6366F1]/50 focus:bg-white/[0.06] transition-all"
            />
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-3 bg-white text-black font-black uppercase italic tracking-tighter px-8 py-5 rounded-[2rem] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_20px_40px_rgba(255,255,255,0.1)]"
          >
            <Plus className="w-5 h-5" />
            Yeni Proje
          </button>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'TOPLAM', value: projects.length, color: 'text-white' },
          { label: 'KEŞİF', value: projects.filter(p => p.status === 'pending_survey').length, color: 'text-yellow-400' },
          { label: 'ÜRETİM', value: projects.filter(p => p.status === 'in_production').length, color: 'text-cyan-400' },
          { label: 'BİTEN', value: projects.filter(p => p.status === 'completed').length, color: 'text-emerald-400' },
        ].map((stat, idx) => (
          <motion.div 
            key={stat.label}
            whileHover={{ y: -5 }}
            className="bg-white/[0.03] backdrop-blur-3xl border border-white/10 p-8 rounded-[2.5rem] relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-[#6366F1]/10 transition-colors" />
            <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em] mb-4 relative z-10">{stat.label}</p>
            <div className="flex items-baseline gap-2 relative z-10">
              <p className={cn("text-5xl font-black tracking-tighter", stat.color)}>{stat.value}</p>
              <div className="w-2 h-2 rounded-full bg-white/10" />
            </div>
            <div className="mt-4 w-full h-1 bg-white/5 rounded-full overflow-hidden">
               <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 1, delay: 0.2 + (idx * 0.1) }}
                  className={cn("h-full", stat.color.replace('text', 'bg'))} 
               />
            </div>
          </motion.div>
        ))}
      </motion.div>

      <motion.div variants={itemVariants} className="flex flex-col md:flex-row gap-6">
        <div className="flex bg-white/[0.03] backdrop-blur-3xl border border-white/10 rounded-[1.5rem] p-1.5 self-start">
          <button
            onClick={() => setViewMode('grid')}
            className={cn(
               "flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black uppercase italic transition-all",
              viewMode === 'grid' ? "bg-white text-black shadow-xl" : "text-white/40 hover:text-white"
            )}
          >
            <LayoutIcon className="w-3.5 h-3.5" />
            Izgara
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={cn(
               "flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black uppercase italic transition-all",
              viewMode === 'table' ? "bg-white text-black shadow-xl" : "text-white/40 hover:text-white"
            )}
          >
            <GripVertical className="w-3.5 h-3.5" rotate={90} />
            Liste
          </button>
        </div>

        <div className="flex items-center gap-3">
          <Palette className="w-4 h-4 text-white/20" />
          <div className="flex flex-wrap gap-2">
            {['all', ...Object.keys(STATUS_LABELS)].map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status as any)}
                className={cn(
                  "px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border",
                  filterStatus === status 
                    ? "bg-[#6366F1] border-[#6366F1] text-black shadow-[0_5px_15px_rgba(99,102,241,0.3)]" 
                    : "bg-white/5 border-white/5 text-white/40 hover:border-white/20"
                )}
              >
                {status === 'all' ? 'HEPSİ' : STATUS_LABELS[status as ProjectStatus]}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      <motion.div variants={itemVariants}>
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredProjects.map((project) => (
              <Link
                key={project.id}
                to={`/projects/${project.id}`}
                className="group block bg-white/[0.03] backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-8 hover:border-white/20 transition-all duration-500 hover:shadow-[0_30px_60px_rgba(0,0,0,0.5)] hover:-translate-y-2 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#6366F1]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-[#6366F1]/10 transition-colors" />
                
                <div className="flex justify-between items-start mb-8 relative z-10">
                  <div className={cn(
                    "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border shadow-sm",
                    STATUS_COLORS[project.status].replace('bg-', 'border-').replace('/10', '/30'),
                    STATUS_COLORS[project.status]
                  )}>
                    {STATUS_LABELS[project.status]}
                  </div>
                  <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-white group-hover:text-black transition-all">
                    <ChevronRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
                
                <h3 className="text-2xl font-black italic tracking-tighter uppercase mb-2 group-hover:text-[#6366F1] transition-colors relative z-10">{project.name}</h3>
                <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.3em] mb-4">Üretim Dosyası #{(project.id.slice(0, 4)).toUpperCase()}</p>
                
                <div className="space-y-4 mt-8 relative z-10">
                  <div className="flex items-center gap-3 text-xs font-bold text-white/40">
                    <div className="p-2 bg-white/5 rounded-xl border border-white/5">
                      <MapPin className="w-3.5 h-3.5" />
                    </div>
                    <span className="truncate tracking-tight">{project.address || 'ADRES BELİRTİLMEDİ'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-bold text-white/40">
                    <div className="p-2 bg-white/5 rounded-xl border border-white/5">
                      <Clock className="w-3.5 h-3.5" />
                    </div>
                    <span className="tracking-tight uppercase">{format(new Date(project.createdAt), 'd MMMM yyyy', { locale: tr })}</span>
                  </div>
                </div>

                <div className="mt-8 pt-8 border-t border-white/5 flex items-center justify-between relative z-10">
                  <div className="flex -space-x-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="w-10 h-10 rounded-2xl border-4 border-[#050505] bg-white/10 flex items-center justify-center text-[10px] font-black italic group-hover:border-[#050505]/50 transition-all overflow-hidden bg-gradient-to-br from-white/10 to-white/5">
                        {String.fromCharCode(64 + i)}
                      </div>
                    ))}
                  </div>
                  <div className="px-5 py-2.5 bg-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest text-white/20 group-hover:bg-white group-hover:text-black transition-all">
                    PROJEYİ AÇ
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-white/[0.03] backdrop-blur-md border border-white/10 rounded-3xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="p-4 text-xs font-bold text-white/40 uppercase tracking-widest cursor-pointer hover:text-white" onClick={() => handleSort('name')}>
                      Proje Adı {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="p-4 text-xs font-bold text-white/40 uppercase tracking-widest cursor-pointer hover:text-white" onClick={() => handleSort('status')}>
                      Durum {sortField === 'status' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="p-4 text-xs font-bold text-white/40 uppercase tracking-widest">Adres</th>
                    <th className="p-4 text-xs font-bold text-white/40 uppercase tracking-widest cursor-pointer hover:text-white" onClick={() => handleSort('createdAt')}>
                      Oluşturulma {sortField === 'createdAt' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="p-4 text-xs font-bold text-white/40 uppercase tracking-widest text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.map((project) => (
                    <tr key={project.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="p-4 font-bold">{project.name}</td>
                      <td className="p-4">
                        <span className={cn("px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider", STATUS_COLORS[project.status])}>
                          {STATUS_LABELS[project.status]}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-white/60">{project.address || '-'}</td>
                      <td className="p-4 text-sm text-white/60">{format(new Date(project.createdAt), 'd MMM yyyy', { locale: tr })}</td>
                      <td className="p-4 text-right">
                        <Link to={`/projects/${project.id}`} className="text-[#6366F1] hover:text-white text-sm font-bold">
                          Detaylar
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </motion.div>

      {/* New Project Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white/[0.03] backdrop-blur-xl border border-white/10 w-full max-w-md rounded-3xl p-8 shadow-2xl"
            >
              <h2 className="text-2xl font-bold mb-6">Yeni Proje Oluştur</h2>
              <form onSubmit={handleCreateProject} className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2">Proje Adı</label>
                  <input
                    autoFocus
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="Örn: Merkez Şube Tabela Yenileme"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-4 focus:outline-none focus:border-[#6366F1] transition-colors"
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-4 rounded-2xl bg-white/5 hover:bg-white/10 font-bold transition-colors"
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-4 rounded-2xl bg-[#6366F1] text-black font-bold hover:scale-105 transition-transform"
                  >
                    Oluştur
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
