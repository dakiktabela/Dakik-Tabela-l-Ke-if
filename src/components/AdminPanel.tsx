import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, UserRole } from '../types';
import { Shield, User as UserIcon, Check, X, Search } from 'lucide-react';
import { cn } from '../lib/utils';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

export function AdminPanel() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map(doc => doc.data() as UserProfile);
      setUsers(usersData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return () => unsubscribe();
  }, []);

  const updateUserRole = async (uid: string, newRole: UserRole) => {
    try {
      await updateDoc(doc(db, 'users', uid), { role: newRole });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Yönetim Paneli</h1>
        <p className="text-white/40 mt-1">Kullanıcı yetkilerini ve rollerini yönetin</p>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20" />
        <input
          type="text"
          placeholder="Kullanıcı ara..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-[#0f0f0f] border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:border-[#6366F1] transition-colors"
        />
      </div>

      <div className="bg-[#0f0f0f] border border-white/10 rounded-3xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/5 bg-white/[0.02]">
              <th className="px-6 py-4 text-xs font-bold text-white/40 uppercase tracking-widest">Kullanıcı</th>
              <th className="px-6 py-4 text-xs font-bold text-white/40 uppercase tracking-widest">E-posta</th>
              <th className="px-6 py-4 text-xs font-bold text-white/40 uppercase tracking-widest">Mevcut Rol</th>
              <th className="px-6 py-4 text-xs font-bold text-white/40 uppercase tracking-widest text-right">İşlemler</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredUsers.map((user) => (
              <tr key={user.uid} className="hover:bg-white/[0.01] transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center overflow-hidden">
                      {user.photoURL ? <img src={user.photoURL} alt="" className="w-full h-full object-cover" /> : <UserIcon className="w-4 h-4 text-white/40" />}
                    </div>
                    <span className="font-medium">{user.displayName || 'İsimsiz'}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-white/60">{user.email}</td>
                <td className="px-6 py-4">
                  <span className={cn(
                    "px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider",
                    user.role === 'admin' ? "bg-red-500/10 text-red-500" : "bg-blue-500/10 text-blue-500"
                  )}>
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <select
                    value={user.role}
                    onChange={(e) => updateUserRole(user.uid, e.target.value as UserRole)}
                    className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#6366F1]"
                  >
                    <option value="admin">Admin</option>
                    <option value="designer">Grafiker</option>
                    <option value="surveyor">Keşif Personeli</option>
                    <option value="production">Üretim</option>
                    <option value="installer">Montaj</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
