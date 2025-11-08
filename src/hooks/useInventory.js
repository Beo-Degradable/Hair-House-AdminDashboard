import { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, getDocs } from 'firebase/firestore';

// Firestore-backed hook that listens to `products` and `branches` collections.
// Returns: { items, branches, loading, error, refresh }
export default function useInventory() {
  const [items, setItems] = useState([]);
  const [branches, setBranches] = useState([]);
  const [inventoryMap, setInventoryMap] = useState({}); // { productId: { branchNameOrId: { quantity, lastUpdated, expiration } } }
  const [inventoryDocs, setInventoryDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // helper to map Firestore docs
  const mapDocs = (snapshot) => snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

  useEffect(() => {
    setLoading(true);
    setError(null);

    const productsRef = collection(db, 'products');
    const productsQuery = query(productsRef, orderBy('name'));
    const unsubscribeProducts = onSnapshot(productsQuery, (snap) => {
      setItems(mapDocs(snap));
      setLoading(false);
    }, (err) => {
      console.error('products onSnapshot error', err);
      setError(err);
      setLoading(false);
    });

    const branchesRef = collection(db, 'branches');
    const branchesQuery = query(branchesRef, orderBy('name'));
    const unsubscribeBranches = onSnapshot(branchesQuery, (snap) => {
      setBranches(mapDocs(snap));
    }, (err) => {
      console.error('branches onSnapshot error', err);
      setError(err);
    });

    // listen to inventory collection (per-branch records)
    const inventoryRef = collection(db, 'inventory');
    const unsubscribeInventory = onSnapshot(inventoryRef, (snap) => {
      const map = {};
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.forEach(d => {
        const data = d;
        const pid = data.productId;
        if (pid) {
          if (!map[pid]) map[pid] = {};
          // key by branch name if provided, otherwise by branch value
          const branchKey = data.branch || data.branchId || d.id.split('_')[1] || d.id;
          map[pid][branchKey] = {
            quantity: Number(data.quantity || 0),
            lastUpdated: data.lastUpdated || null,
            expiration: data.expiration || null,
          };
        }
      });
      setInventoryMap(map);
      setInventoryDocs(docs);
    }, (err) => {
      console.error('inventory onSnapshot error', err);
      setError(err);
    });

    return () => {
      unsubscribeProducts();
      unsubscribeBranches();
      unsubscribeInventory();
    };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const productsSnap = await getDocs(query(collection(db, 'products'), orderBy('name')));
      setItems(mapDocs(productsSnap));
      const branchesSnap = await getDocs(query(collection(db, 'branches'), orderBy('name')));
      setBranches(mapDocs(branchesSnap));
      const inventorySnap = await getDocs(collection(db, 'inventory'));
      const invMap = {};
      const invDocs = [];
      inventorySnap.forEach(d => {
        const data = d.data();
        invDocs.push({ id: d.id, ...data });
        const pid = data.productId;
        if (!pid) return;
        if (!invMap[pid]) invMap[pid] = {};
        const branchKey = data.branch || data.branchId || d.id.split('_')[1] || d.id;
        invMap[pid][branchKey] = {
          quantity: Number(data.quantity || 0),
          lastUpdated: data.lastUpdated || null,
          expiration: data.expiration || null,
        };
      });
      setInventoryMap(invMap);
      setInventoryDocs(invDocs);
      setError(null);
    } catch (err) {
      console.error('refresh error', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  return { items, branches, inventoryMap, inventoryDocs, loading, error, refresh };
}
