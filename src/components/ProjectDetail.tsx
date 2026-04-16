import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, collection, query, addDoc, updateDoc, deleteDoc, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Project, Survey, ProjectStatus, SurveyType } from '../types';
import { 
  ArrowLeft, 
  Plus, 
  MapPin, 
  Calendar, 
  User as UserIcon, 
  Camera, 
  FileText, 
  MoreVertical,
  ChevronRight,
  Trash2,
  Edit2,
  CheckCircle2
} from 'lucide-react';
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

const SURVEY_TYPE_LABELS: Record<SurveyType, string> = {
  facade: 'Cephe',
  interior: 'İç Mekan',
  exterior: 'Dış Mekan',
  vehicle: 'Araç Giydirme',
  custom: 'Özel Üretim'
};

export function ProjectDetail() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [isNewSurveyModalOpen, setIsNewSurveyModalOpen] = useState(false);
  const [newSurvey, setNewSurvey] = useState({ title: '', type: 'facade' as SurveyType });

  useEffect(() => {
    if (!projectId) return;

    const projectUnsubscribe = onSnapshot(doc(db, 'projects', projectId), (doc) => {
      if (doc.exists()) {
        setProject({ id: doc.id, ...doc.data() } as Project);
      } else {
        navigate('/');
      }
    });

    const surveysQuery = query(
      collection(db, 'projects', projectId, 'surveys'),
      orderBy('createdAt', 'desc')
    );

    const surveysUnsubscribe = onSnapshot(surveysQuery, (snapshot) => {
      const surveysData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Survey[];
      setSurveys(surveysData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `projects/${projectId}/surveys`);
    });

    return () => {
      projectUnsubscribe();
      surveysUnsubscribe();
    };
  }, [projectId, navigate]);

  const handleCreateSurvey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !newSurvey.title.trim()) return;

    try {
      const surveyData = {
        projectId,
        title: newSurvey.title,
        type: newSurvey.type,
        createdBy: profile?.uid,
        createdAt: new Date().toISOString(),
      };
      const docRef = await addDoc(collection(db, 'projects', projectId, 'surveys'), surveyData);
      setIsNewSurveyModalOpen(false);
      navigate(`/projects/${projectId}/surveys/${docRef.id}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `projects/${projectId}/surveys`);
    }
  };

  const updateStatus = async (newStatus: ProjectStatus) => {
    if (!projectId) return;
    try {
      await updateDoc(doc(db, 'projects', projectId), {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `projects/${projectId}`);
    }
  };

  if (loading || !project) return null;

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="max-w-7xl mx-auto space-y-8"
    >
      <motion.div variants={itemVariants} className="flex items-center gap-4">
        <Link to="/" className="p-2 hover:bg-white/5 rounded-xl transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
          <div className="flex items-center gap-4 mt-1 text-white/40 text-sm">
            <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {project.address || 'Adres yok'}</span>
            <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {format(new Date(project.createdAt), 'd MMMM yyyy', { locale: tr })}</span>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Project Info & Status */}
        <motion.div variants={itemVariants} className="lg:col-span-1 space-y-6">
          <div className="bg-white/[0.03] backdrop-blur-md border border-white/10 rounded-3xl p-6">
            <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-6">Proje Durumu</h3>
            <div className="space-y-2">
              {(['draft', 'pending_survey', 'surveying', 'survey_completed', 'design_in_progress', 'revision', 'pending_approval', 'in_production', 'in_installation', 'completed'] as ProjectStatus[]).map((status) => (
                <button
                  key={status}
                  onClick={() => updateStatus(status)}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
                    project.status === status 
                      ? "bg-[#6366F1] text-black" 
                      : "text-white/40 hover:bg-white/5"
                  )}
                >
                  {status.replace(/_/g, ' ').toUpperCase()}
                  {project.status === status && <CheckCircle2 className="w-4 h-4" />}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white/[0.03] backdrop-blur-md border border-white/10 rounded-3xl p-6">
            <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4">Açıklama</h3>
            <p className="text-sm text-white/60 leading-relaxed">
              {project.description || 'Bu proje için henüz bir açıklama girilmemiş.'}
            </p>
          </div>
        </motion.div>

        {/* Right Column: Surveys */}
        <motion.div variants={itemVariants} className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Keşif Kayıtları</h2>
            <button
              onClick={() => setIsNewSurveyModalOpen(true)}
              className="flex items-center gap-2 bg-white text-black font-bold px-4 py-2 rounded-xl hover:scale-105 transition-transform"
            >
              <Plus className="w-4 h-4" />
              Yeni Keşif
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {surveys.map((survey) => (
              <Link
                key={survey.id}
                to={`/projects/${projectId}/surveys/${survey.id}`}
                className="group bg-white/[0.03] backdrop-blur-md border border-white/10 rounded-2xl p-4 hover:border-[#6366F1]/50 transition-all"
              >
                <div className="aspect-video bg-white/5 rounded-xl mb-4 overflow-hidden flex items-center justify-center relative">
                  {survey.mediaUrl ? (
                    <img src={survey.mediaUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <Camera className="w-8 h-8 text-white/10" />
                  )}
                  <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                    {SURVEY_TYPE_LABELS[survey.type]}
                  </div>
                </div>
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold group-hover:text-[#6366F1] transition-colors">{survey.title}</h4>
                    <p className="text-xs text-white/40 mt-1">
                      {format(new Date(survey.createdAt), 'd MMM HH:mm', { locale: tr })}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-[#6366F1] transition-colors" />
                </div>
              </Link>
            ))}

            {surveys.length === 0 && (
              <div className="col-span-full py-20 text-center bg-white/[0.03] backdrop-blur-md border border-dashed border-white/10 rounded-3xl">
                <Camera className="w-12 h-12 text-white/10 mx-auto mb-4" />
                <p className="text-white/40">Henüz keşif kaydı bulunmuyor.</p>
                <button 
                  onClick={() => setIsNewSurveyModalOpen(true)}
                  className="mt-4 text-[#6366F1] font-bold hover:underline"
                >
                  İlk keşfi oluşturun
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* New Survey Modal */}
      <AnimatePresence>
        {isNewSurveyModalOpen && (
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
              <h2 className="text-2xl font-bold mb-6">Yeni Keşif Sayfası</h2>
              <form onSubmit={handleCreateSurvey} className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2">Keşif Başlığı</label>
                  <input
                    autoFocus
                    type="text"
                    value={newSurvey.title}
                    onChange={(e) => setNewSurvey({ ...newSurvey, title: e.target.value })}
                    placeholder="Örn: Ön Cephe Ana Tabela"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-4 focus:outline-none focus:border-[#6366F1] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2">Keşif Tipi</label>
                  <select
                    value={newSurvey.type}
                    onChange={(e) => setNewSurvey({ ...newSurvey, type: e.target.value as SurveyType })}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-4 focus:outline-none focus:border-[#6366F1] transition-colors appearance-none"
                  >
                    {Object.entries(SURVEY_TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value} className="bg-[#0f0f0f]">{label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsNewSurveyModalOpen(false)}
                    className="flex-1 py-4 rounded-2xl bg-white/5 hover:bg-white/10 font-bold transition-colors"
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-4 rounded-2xl bg-[#6366F1] text-black font-bold hover:scale-105 transition-transform"
                  >
                    Başlat
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
