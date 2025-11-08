import React, { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

const LowStockWidget = ({ branch = null }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const col = collection(db, 'inventory');
    const unsub = onSnapshot(col, snap => {
      let low = 0;
      snap.docs.forEach(d => {
        const it = d.data();
        const qty = Number(it.quantity || 0);
        const threshold = Number(it.reorderThreshold || 5);
        if (branch && it.branch && it.branch !== branch) return;
        if (qty <= threshold) low += 1;
      });
      setCount(low);
    }, err => console.warn('inventory snap failed', err));
    return () => unsub();
  }, [branch]);

  return (
    <div style={{ padding: 8, borderRadius: 8, border: '1px solid var(--border-main)', background: 'var(--surface)', minWidth: 100, textAlign: 'center' }}>
      <div style={{ fontSize: 12, color: 'var(--gold)', marginBottom: 4 }}>Low stock</div>
      <div style={{ fontSize: 16, fontWeight: 700 }}>{count}</div>
    </div>
  );
};

export default LowStockWidget;
