import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updatePassword,
  deleteUser,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../firebase';

const AuthContext = createContext<any>({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children?: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null);       // Firebase Auth user
  const [profile, setProfile] = useState<any>(null); // Firestore user doc
  const [loading, setLoading] = useState(true);

  // True while register() is mid-flight, so the auth listener doesn't
  // race against the in-progress setDoc and sign the user out.
  const registeringRef = useRef(false); // Prevent race condition during signup

  const fetchProfile = async (uid: string) => {
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) {
        const data: any = { id: snap.id, ...snap.data() };
        setProfile(data);
        return data;
      }
      return null;
    } catch (err) {
      console.error('fetchProfile error:', err);
      return null;
    }
  };

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      if (registeringRef.current) {
        // Signup in progress, let it finish
        setLoading(false);
        return;
      }

      const data = await fetchProfile(firebaseUser.uid);

      if (!data) {
        // Orphan auth account with no profile doc. Sign out to clear it.
        await signOut(auth);
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      if (data.isActive === false) {
        await signOut(auth);
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      setUser(firebaseUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // ── Register ──────────────────────────────────────────────
  const register = async ({ name, email, password, role = 'cashier' }: any) => {
    registeringRef.current = true;
    let cred;
    try {
      cred = await createUserWithEmailAndPassword(auth, email, password);
      const uid = cred.user.uid;

      const userDoc = {
        uid,
        name,
        email,
        role,
        avatarUrl: '',
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      try {
        await setDoc(doc(db, 'users', uid), userDoc);
      } catch (writeErr) {
        // Rollback the auth account if profile creation fails
        try { await deleteUser(cred.user); } catch {}
        throw writeErr;
      }

      setUser(cred.user);
      setProfile({ id: uid, uid, name, email, role, avatarUrl: '', isActive: true });
      setLoading(false);
      return cred.user;
    } finally {
      registeringRef.current = false;
    }
  };

  // ── Login ─────────────────────────────────────────────────
  const login = async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const data = await fetchProfile(cred.user.uid);

    if (!data) {
      await signOut(auth);
      setProfile(null);
      const err: any = new Error(
        'No profile found for this account. Please register again or contact an administrator.'
      );
      err.code = 'auth/no-profile';
      throw err;
    }

    if (data.isActive === false) {
      await signOut(auth);
      setProfile(null);
      const err: any = new Error('Your account has been deactivated. Please contact an administrator.');
      err.code = 'auth/user-disabled';
      throw err;
    }

    setUser(cred.user);
    setLoading(false);
    return cred.user;
  };

  // ── Logout ────────────────────────────────────────────────
  const logout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('logout error:', err);
    } finally {
      // Clear UI immediately even if Firebase takes a moment
      setUser(null);
      setProfile(null);
    }
  };

  const refreshProfile = () => user && fetchProfile(user.uid);

  const sendResetEmail = (email: string) => sendPasswordResetEmail(auth, email);

  const changeOwnPassword = (newPassword: string) => {
    if (!auth.currentUser) throw new Error('Not signed in');
    return updatePassword(auth.currentUser, newPassword);
  };

  return (
    <AuthContext.Provider
      value={{
        user, profile, loading,
        register, login, logout, refreshProfile,
        sendResetEmail, changeOwnPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
