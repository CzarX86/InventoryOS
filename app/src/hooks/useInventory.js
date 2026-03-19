import { useState, useMemo, useEffect } from "react";
import { db } from "@/lib/firebase";
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  doc, 
  updateDoc, 
  deleteDoc,
  serverTimestamp 
} from "firebase/firestore";
import { recordAppError, toUserFacingError } from "@/lib/errorReporting";

export default function useInventory(user = null) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [syncError, setSyncError] = useState(null);

  useEffect(() => {
    if (!db) return;

    const q = query(collection(db, "inventory"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const inventoryData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Format date for display if it's a Firestore timestamp
        date: doc.data().createdAt?.toDate()?.toLocaleDateString('pt-BR') || "AGUARDANDO"
      }));
      setItems(inventoryData);
      setLoading(false);
      setSyncError(null);
    }, (error) => {
      console.error("Firebase sync error:", error);
      setLoading(false);
      recordAppError({
        error,
        source: "inventory-hook",
        action: "INVENTORY_SYNC",
        user,
        context: {
          errorContext: "inventory-sync",
          reproductionContext: {},
        },
      }).then(report => setSyncError(toUserFacingError(report)));
    });

    return () => unsubscribe();
  }, [user]);

  const updateItem = async (id, data) => {
    const itemRef = doc(db, "inventory", id);
    await updateDoc(itemRef, {
      ...data,
      updatedAt: serverTimestamp()
    });
  };

  const deleteItem = async (id) => {
    const itemRef = doc(db, "inventory", id);
    await deleteDoc(itemRef);
  };

  const filteredItems = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return items;

    return items.filter(item => {
      const match = (val) => val && val.toString().toLowerCase().includes(query);
      return (
        match(item.partNumber) ||
        match(item.model) ||
        match(item.brand) ||
        match(item.type)
      );
    });
  }, [items, searchQuery]);

  return {
    items,
    loading,
    searchQuery,
    setSearchQuery,
    filteredItems,
    syncError,
    updateItem,
    deleteItem
  };
}
