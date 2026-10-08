import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { db } from "@/lib/firebase";
import { 
  collection, 
  getCountFromServer,
  getDocs,
  onSnapshot, 
  query, 
  orderBy, 
  doc, 
  limit,
  startAfter,
  updateDoc, 
  deleteDoc,
  where,
  serverTimestamp 
} from "firebase/firestore";
import { recordAppError, toUserFacingError } from "@/lib/errorReporting";

const INVENTORY_PAGE_SIZE = 100;
const EMPTY_STATS = { total: 0, inStock: 0, sold: 0 };

export default function useInventory(user = null, enabled = true) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [lastDoc, setLastDoc] = useState(null);
  const [inventoryStats, setInventoryStats] = useState(EMPTY_STATS);
  const [searchQuery, setSearchQuery] = useState("");
  const [syncError, setSyncError] = useState(null);
  const loadedTailIds = useRef(new Set());

  const refreshInventoryStats = useCallback(async () => {
    if (!db || !enabled) return false;
    const inventoryCollection = collection(db, "inventory");
    try {
      const [total, inStock, sold] = await Promise.all([
        getCountFromServer(query(inventoryCollection)),
        getCountFromServer(query(inventoryCollection, where("status", "==", "IN STOCK"))),
        getCountFromServer(query(inventoryCollection, where("status", "==", "SOLD"))),
      ]);
      setInventoryStats({ total: total.data().count, inStock: inStock.data().count, sold: sold.data().count });
      return true;
    } catch {
      // The visible first page remains a safe fallback if aggregation is unavailable.
      return false;
    }
  }, [enabled]);

  useEffect(() => {
    if (!db || !enabled) {
      setItems([]);
      setInventoryStats(EMPTY_STATS);
      setLastDoc(null);
      setHasMore(false);
      loadedTailIds.current = new Set();
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    let latestInventoryData = [];
    loadedTailIds.current = new Set();
    const q = query(collection(db, "inventory"), orderBy("createdAt", "desc"), limit(INVENTORY_PAGE_SIZE));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const inventoryData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Format date for display if it's a Firestore timestamp
        date: doc.data().createdAt?.toDate()?.toLocaleDateString('pt-BR') || "AGUARDANDO"
      }));
      if (cancelled) return;
      latestInventoryData = inventoryData;
      const firstPageIds = new Set(inventoryData.map(item => item.id));
      setItems(current => [
        ...inventoryData,
        ...current.filter(item => loadedTailIds.current.has(item.id) && !firstPageIds.has(item.id)),
      ]);
      setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
      setHasMore(snapshot.size === INVENTORY_PAGE_SIZE);
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

    void refreshInventoryStats().then((statsLoaded) => {
      if (cancelled) return;
      if (!statsLoaded && latestInventoryData.length > 0) {
        setInventoryStats({
          total: latestInventoryData.length,
          inStock: latestInventoryData.filter(item => item.status === "IN STOCK").length,
          sold: latestInventoryData.filter(item => item.status === "SOLD").length,
        });
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [user, enabled, refreshInventoryStats]);

  const loadMore = async () => {
    if (!db || !enabled || !hasMore || !lastDoc || loadingMore) return;
    setLoadingMore(true);
    try {
      const nextQuery = query(
        collection(db, "inventory"),
        orderBy("createdAt", "desc"),
        startAfter(lastDoc),
        limit(INVENTORY_PAGE_SIZE),
      );
      const snapshot = await getDocs(nextQuery);
      const nextItems = snapshot.docs.map(item => ({
        id: item.id,
        ...item.data(),
        date: item.data().createdAt?.toDate()?.toLocaleDateString("pt-BR") || "AGUARDANDO",
      }));
      setItems(current => {
        const existingIds = new Set(current.map(item => item.id));
        return [...current, ...nextItems.filter(item => !existingIds.has(item.id))];
      });
      nextItems.forEach(item => loadedTailIds.current.add(item.id));
      setLastDoc(snapshot.docs[snapshot.docs.length - 1] || lastDoc);
      setHasMore(snapshot.size === INVENTORY_PAGE_SIZE);
    } catch (error) {
      console.error("Failed to load more inventory items:", error);
    } finally {
      setLoadingMore(false);
    }
  };

  const updateItem = async (id, data) => {
    const itemRef = doc(db, "inventory", id);
    const currentItem = items.find(item => item.id === id);
    await updateDoc(itemRef, {
      ...data,
      updatedAt: serverTimestamp()
    });
    if (currentItem && data.status && data.status !== currentItem.status) {
      setInventoryStats((current) => ({
        ...current,
        inStock: current.inStock + (data.status === "IN STOCK" ? 1 : currentItem.status === "IN STOCK" ? -1 : 0),
        sold: current.sold + (data.status === "SOLD" ? 1 : currentItem.status === "SOLD" ? -1 : 0),
      }));
    }
  };

  const deleteItem = async (id) => {
    const itemRef = doc(db, "inventory", id);
    const deletedItem = items.find(item => item.id === id);
    await deleteDoc(itemRef);
    setItems(current => current.filter(item => item.id !== id));
    if (deletedItem) {
      setInventoryStats((current) => ({
        total: Math.max(0, current.total - 1),
        inStock: Math.max(0, current.inStock - (deletedItem.status === "IN STOCK" ? 1 : 0)),
        sold: Math.max(0, current.sold - (deletedItem.status === "SOLD" ? 1 : 0)),
      }));
    }
  };

  const filteredItems = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return items;

    return items.filter(item => {
      const match = (val) => val && val.toString().toLowerCase().includes(query);
      return (
        match(item.partNumber) ||
        match(item.gtin) ||
        match(item.model) ||
        match(item.brand) ||
        match(item.type)
      );
    });
  }, [items, searchQuery]);

  return {
    items: enabled ? items : [],
    loading: enabled ? loading : false,
    loadingMore: enabled ? loadingMore : false,
    hasMore: enabled ? hasMore : false,
    loadMore,
    refreshInventoryStats,
    inventoryStats: enabled ? inventoryStats : EMPTY_STATS,
    searchQuery,
    setSearchQuery,
    filteredItems,
    syncError: enabled ? syncError : null,
    updateItem,
    deleteItem
  };
}
