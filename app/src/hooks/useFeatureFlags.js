import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  DEFAULT_FEATURE_FLAGS,
  countEnabledFeatureFlags,
  mergeFeatureFlags,
} from "@/lib/featureFlags";

export default function useFeatureFlags(user = null) {
  const userId = user?.uid || null;
  const [flags, setFlags] = useState(DEFAULT_FEATURE_FLAGS);
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId || !db) {
      setFlags(DEFAULT_FEATURE_FLAGS);
      setLoading(false);
      setError(null);
      return undefined;
    }

    setLoading(true);
    const featureFlagsRef = doc(db, "system", "feature_flags");

    return onSnapshot(
      featureFlagsRef,
      (snapshot) => {
        setFlags(mergeFeatureFlags(snapshot.data() || {}));
        setLoading(false);
        setError(null);
      },
      (nextError) => {
        console.error("Feature flags sync error:", nextError);
        setFlags(DEFAULT_FEATURE_FLAGS);
        setLoading(false);
        setError(nextError);
      }
    );
  }, [userId]);

  const enabledCount = useMemo(() => countEnabledFeatureFlags(flags), [flags]);

  return {
    flags,
    enabledCount,
    loading,
    error,
  };
}
