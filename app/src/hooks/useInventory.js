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

export default function useInventory() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

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
    }, (error) => {
      console.error("Firebase sync error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

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
    return items.filter(item => 
      item.partNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.model?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.brand?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.type?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [items, searchQuery]);

  return {
    items,
    loading,
    searchQuery,
    setSearchQuery,
    filteredItems,
    updateItem,
    deleteItem
  };
}
