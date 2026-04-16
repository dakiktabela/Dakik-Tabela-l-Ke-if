/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile } from './types';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { ProjectDetail } from './components/ProjectDetail';
import { SurveyCanvas } from './components/SurveyCanvas';
import { Login } from './components/Login';
import { AdminPanel } from './components/AdminPanel';
import { Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Lenis from 'lenis';
import { CustomCursor } from './components/CustomCursor';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isDesigner: boolean;
  isSurveyor: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  isDesigner: false,
  isSurveyor: false,
});

export const useAuth = () => useContext(AuthContext);

const PageTransition = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Lenis Smooth Scroll
    const lenis = new Lenis({
      lerp: 0.08,
      smoothWheel: true,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          setProfile(userDoc.data() as UserProfile);
        } else {
          // Create default profile for new users
          const newProfile: UserProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || '',
            photoURL: firebaseUser.photoURL || '',
            role: firebaseUser.email === 'info@dakiktabela.com' ? 'admin' : 'surveyor',
            createdAt: new Date().toISOString(),
          };
          await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);
          setProfile(newProfile);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0a0a] text-white">
        <Loader2 className="h-8 w-8 animate-spin text-[#6366F1]" />
      </div>
    );
  }

  const authValue: AuthContextType = {
    user,
    profile,
    loading,
    isAdmin: profile?.role === 'admin',
    isDesigner: profile?.role === 'designer',
    isSurveyor: profile?.role === 'surveyor',
  };

  return (
    <AuthContext.Provider value={authValue}>
      <CustomCursor />
      <BrowserRouter>
        <PageTransition>
          <Routes>
            <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
            <Route
              path="/"
              element={user ? <Layout /> : <Navigate to="/login" />}
            >
              <Route index element={<Dashboard />} />
              <Route path="projects/:projectId" element={<ProjectDetail />} />
              <Route path="projects/:projectId/surveys/:surveyId" element={<SurveyCanvas />} />
              <Route path="admin" element={authValue.isAdmin ? <AdminPanel /> : <Navigate to="/" />} />
            </Route>
          </Routes>
        </PageTransition>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}

