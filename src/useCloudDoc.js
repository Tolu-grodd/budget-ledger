import { useEffect, useRef, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "./firebase.js";

// One Firestore document per signed-in user, holding the whole app state.
// - onSnapshot gives realtime updates from other devices (and from Firestore's
//   own offline cache when there's no connection).
// - Writes are debounced so fast edits (typing an amount) don't spam Firestore.
export function useCloudDoc(uid, defaults) {
  const [data, setData] = useState(defaults);
  const [ready, setReady] = useState(false);
  const writeTimer = useRef(null);
  const localEditCount = useRef(0);

  useEffect(() => {
    if (!uid) return;
    setReady(false);
    localEditCount.current = 0;
    const ref = doc(db, "users", uid, "budgetData", "main");

    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          // Ignore snapshots that just echo back our own pending local write —
          // otherwise a debounced write can clobber keystrokes made in between.
          if (snap.metadata.hasPendingWrites && localEditCount.current > 0) {
            setReady(true);
            return;
          }
          const { updatedAt, ...rest } = snap.data();
          setData((prev) => ({ ...prev, ...rest }));
        } else {
          setDoc(ref, { ...defaults, updatedAt: Date.now() }).catch(() => {});
        }
        setReady(true);
      },
      () => setReady(true)
    );
    return () => unsub();
  }, [uid]);

  const update = (patch) => {
    setData((prev) => {
      const next = typeof patch === "function" ? patch(prev) : { ...prev, ...patch };
      if (uid) {
        localEditCount.current += 1;
        clearTimeout(writeTimer.current);
        writeTimer.current = setTimeout(() => {
          const ref = doc(db, "users", uid, "budgetData", "main");
          setDoc(ref, { ...next, updatedAt: Date.now() }, { merge: true })
            .catch(() => {})
            .finally(() => { localEditCount.current = 0; });
        }, 450);
      }
      return next;
    });
  };

  return [data, update, ready];
}
