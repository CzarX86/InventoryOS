import { useEffect, useState } from "react";
import { auth, db, googleProvider } from "@/lib/firebase";
import { onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut } from "firebase/auth";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { initializeAccessProfile } from "@/lib/accessControl";

const profileBootstrapPromises = new Map();
const localAuthBypass = process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_LOCAL_AUTH_BYPASS === "true";
const localDevUser = {
  uid: "local-dev-user",
  email: "dev@localhost",
  displayName: "Usuário local",
  workspaceId: "local-dev-workspace",
  defaultAccountId: "local-dev-workspace",
  accessStatus: "approved",
  role: "admin",
  isHiddenOwner: false,
  isLocalDev: true,
};

function getProfileBootstrap(firebaseUser) {
  if (!profileBootstrapPromises.has(firebaseUser.uid)) {
    profileBootstrapPromises.set(firebaseUser.uid, initializeAccessProfile());
  }
  return profileBootstrapPromises.get(firebaseUser.uid);
}

function mergeUserProfile(firebaseUser, profile = {}) {
  return {
    ...firebaseUser,
    ...profile,
    uid: firebaseUser.uid,
    email: profile.email || firebaseUser.email || null,
    displayName: profile.displayName || firebaseUser.displayName || null,
    photoURL: profile.photoURL || firebaseUser.photoURL || null,
    accessStatus: profile.accessStatus || "pending",
    role: profile.role || "user",
  };
}

export default function useAuth() {
  const [user, setUser] = useState(localAuthBypass ? localDevUser : null);
  const [loading, setLoading] = useState(!localAuthBypass);
  const [isAdmin, setIsAdmin] = useState(localAuthBypass);
  const [isApproved, setIsApproved] = useState(localAuthBypass);
  const [accessStatus, setAccessStatus] = useState("pending");
  const [accessError, setAccessError] = useState(null);

  useEffect(() => {
    if (localAuthBypass) {
      setUser(localDevUser);
      setIsAdmin(true);
      setIsApproved(true);
      setAccessStatus("approved");
      setLoading(false);
      return undefined;
    }

    if (!auth) {
      setLoading(false);
      return undefined;
    }

    let active = true;
    let unsubscribeProfile = () => undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        profileBootstrapPromises.clear();
        unsubscribeProfile();
        if (!active) return;
        setUser(null);
        setIsAdmin(false);
        setIsApproved(false);
        setAccessStatus("pending");
        setAccessError(null);
        setLoading(false);
        return;
      }

      if (!active) return;
      setLoading(true);
      setAccessError(null);
      setUser(mergeUserProfile(firebaseUser));

      try {
        const initialProfile = await getProfileBootstrap(firebaseUser);
        if (!active) return;

        const applyProfile = async (profile) => {
          const nextUser = mergeUserProfile(firebaseUser, profile);
          const nextStatus = nextUser.accessStatus || "pending";
          const nextIsAdmin = nextStatus === "approved" && nextUser.role === "admin";
          setUser(nextUser);
          setAccessStatus(nextStatus);
          setIsApproved(nextStatus === "approved");
          setIsAdmin(nextIsAdmin);

          if ((nextStatus === "approved" || nextStatus === "revoked") && firebaseUser.getIdToken) {
            try {
              await firebaseUser.getIdToken(true);
            } catch {
              // The Firestore profile remains authoritative for the gate while the token refresh retries.
            }
          }
        };

        await applyProfile(initialProfile);

        if (db) {
          unsubscribeProfile();
          unsubscribeProfile = onSnapshot(doc(db, "users", firebaseUser.uid), async (snapshot) => {
            if (!snapshot.exists()) return;
            await applyProfile({ uid: firebaseUser.uid, ...snapshot.data() });
          }, (error) => {
            if (active) setAccessError(error);
          });
        }
      } catch (error) {
        profileBootstrapPromises.delete(firebaseUser.uid);
        if (!active) return;
        setAccessError(error);
        setUser(mergeUserProfile(firebaseUser, { accessStatus: "pending", role: "user" }));
        setAccessStatus("pending");
        setIsApproved(false);
        setIsAdmin(false);
      } finally {
        if (active) setLoading(false);
      }
    });

    return () => {
      active = false;
      unsubscribeProfile();
      unsubscribeAuth();
    };
  }, []);

  const login = async () => {
    if (localAuthBypass) {
      setUser(localDevUser);
      setIsAdmin(true);
      setIsApproved(true);
      setAccessStatus("approved");
      return localDevUser;
    }

    if (!auth) throw new Error("Firebase Auth indisponível neste ambiente.");

    try {
      return await signInWithPopup(auth, googleProvider);
    } catch (error) {
      if (
        error?.code === "auth/popup-blocked" ||
        error?.code === "auth/operation-not-supported-in-this-environment"
      ) {
        return signInWithRedirect(auth, googleProvider);
      }

      throw error;
    }
  };

  const logout = () => {
    if (localAuthBypass) {
      setUser(null);
      setIsAdmin(false);
      setIsApproved(false);
      setAccessStatus("pending");
      return Promise.resolve();
    }

    if (!auth) return Promise.resolve();
    return signOut(auth);
  };

  const updateSettings = async (newSettings = {}) => {
    if (!user || !db) return;
    const safeSettings = Object.fromEntries(
      Object.entries(newSettings).filter(([key]) => key === "aiWorkflow"),
    );
    if (!Object.keys(safeSettings).length) return;
    const userRef = doc(db, "users", user.uid);
    await setDoc(userRef, safeSettings, { merge: true });
    setUser((previous) => ({ ...previous, ...safeSettings }));
  };

  return {
    user,
    loading,
    isAdmin,
    isApproved,
    accessStatus,
    accessError,
    isHiddenOwner: Boolean(user?.isHiddenOwner),
    login,
    logout,
    updateSettings,
    isLocalAuthBypass: localAuthBypass,
  };
}
