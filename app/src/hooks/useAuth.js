import { useState, useEffect } from 'react';
import { auth, db, googleProvider } from '@/lib/firebase';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { buildDefaultAccountId } from '@/lib/ownership';

export default function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!auth) return;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Get user profile from Firestore
        const userRef = doc(db, "users", firebaseUser.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const userData = userSnap.data();
          setUser({ ...firebaseUser, ...userData });
          setIsAdmin(userData.role === 'admin');
        } else {
          // If profile doesn't exist, create a default 'user' profile
          const ownerId = firebaseUser.uid;
          const initialData = {
            email: firebaseUser.email,
            ownerId,
            defaultAccountId: buildDefaultAccountId(ownerId),
            role: 'user', 
            aiWorkflow: 'real-time',
            createdAt: new Date().toISOString()
          };
          await setDoc(userRef, initialData);
          setUser({ ...firebaseUser, ...initialData });
          setIsAdmin(false);
        }
      } else {
        setUser(null);
        setIsAdmin(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = () => signInWithPopup(auth, googleProvider);
  const logout = () => signOut(auth);

  const updateSettings = async (newSettings) => {
    if (!user) return;
    const userRef = doc(db, "users", user.uid);
    await setDoc(userRef, newSettings, { merge: true });
    setUser(prev => ({ ...prev, ...newSettings }));
  };

  return { user, loading, isAdmin, login, logout, updateSettings };
}
