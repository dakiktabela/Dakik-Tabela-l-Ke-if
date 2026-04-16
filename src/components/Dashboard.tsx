import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Project, ProjectStatus } from '../types';
import { Link } from 'react-router-dom';
import { Plus, Search, Filter, ChevronRight, Clock, MapPin } from 'lucide-react';
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
      <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Hoş Geldiniz, {profile?.displayName?.split(' ')[0]}</h1>
          <p className="text-white/40 mt-1">Sistemde şu an {projects.length} aktif proje bulunuyor.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 bg-[#6366F1] text-black font-bold px-6 py-3 rounded-2xl hover:scale-105 transition-transform shadow-[0_10px_20px_rgba(99,102,241,0.2)]"
        >
          <Plus className="w-5 h-5" />
          Yeni Proje
        </button>
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Toplam Proje', value: projects.length, color: 'text-white' },
          { label: 'Keşif Bekleyen', value: projects.filter(p => p.status === 'pending_survey').length, color: 'text-yellow-500' },
          { label: 'Üretimde', value: projects.filter(p => p.status === 'in_production').length, color: 'text-cyan-500' },
          { label: 'Tamamlanan', value: projects.filter(p => p.status === 'completed').length, color: 'text-emerald-500' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white/[0.03] backdrop-blur-md border border-white/10 p-6 rounded-3xl">
            <p className="text-xs font-bold text-white/20 uppercase tracking-widest mb-1">{stat.label}</p>
            <p className={cn("text-3xl font-black", stat.color)}>{stat.value}</p>
          </div>
        ))}
      </motion.div>

      <motion.div variants={itemVariants} className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20" />
          <input
            type="text"
            placeholder="Proje veya adres ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white/[0.03] backdrop-blur-md border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:border-[#6366F1] transition-colors"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
          className="bg-white/[0.03] backdrop-blur-md border border-white/10 px-6 py-4 rounded-2xl text-white/60 hover:text-white transition-colors focus:outline-none focus:border-[#6366F1]"
        >
          <option value="all">Tüm Durumlar</option>
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <div className="flex bg-white/[0.03] backdrop-blur-md border border-white/10 rounded-2xl p-1">
          <button
            onClick={() => setViewMode('grid')}
            className={cn(
              "px-4 py-3 rounded-xl text-sm font-bold transition-colors",
              viewMode === 'grid' ? "bg-white/10 text-white" : "text-white/40 hover:text-white"
            )}
          >
            Grid
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={cn(
              "px-4 py-3 rounded-xl text-sm font-bold transition-colors",
              viewMode === 'table' ? "bg-white/10 text-white" : "text-white/40 hover:text-white"
            )}
          >
            Tablo
          </button>
        </div>
      </motion.div>

      <motion.div variants={itemVariants}>
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredProjects.map((project) => (
              <Link
                key={project.id}
                to={`/projects/${project.id}`}
                className="group block bg-white/[0.03] backdrop-blur-md border border-white/10 rounded-3xl p-6 hover:border-[#6366F1]/50 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1"
              >
                <div className="flex justify-between items-start mb-4">
                  <span className={cn("px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider", STATUS_COLORS[project.status])}>
                    {STATUS_LABELS[project.status]}
                  </span>
                  <ChevronRight className="w-5 h-5 text-white/20 group-hover:text-[#6366F1] transition-colors" />
                </div>
                
                <h3 className="text-xl font-bold mb-2 group-hover:text-[#6366F1] transition-colors">{project.name}</h3>
                
                <div className="space-y-3 mt-6">
                  <div className="flex items-center gap-2 text-sm text-white/40">
                    <MapPin className="w-4 h-4" />
                    <span className="truncate">{project.address || 'Adres belirtilmedi'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-white/40">
                    <Clock className="w-4 h-4" />
                    <span>{format(new Date(project.createdAt), 'd MMMM yyyy', { locale: tr })}</span>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-white/5 flex items-center justify-between">
                  <div className="flex -space-x-2">
                    {[1, 2].map((i) => (
                      <div key={i} className="w-8 h-8 rounded-full border-2 border-[#0f0f0f] bg-white/10 flex items-center justify-center text-[10px] font-bold">
                        {i}
                      </div>
                    ))}
                  </div>
                  <span className="text-xs font-bold text-white/20 uppercase tracking-widest">Detayları Gör</span>
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
