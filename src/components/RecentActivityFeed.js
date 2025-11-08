import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, onSnapshot, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { logHistory } from '../utils/historyLogger';
import { timeAgo } from '../utils/formatters';

const RecentActivityFeed = ({ branch, limitItems = 20 }) => {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const col = collection(db, 'history');
    const q = query(col, orderBy('timestamp', 'desc'), limit(limitItems));
    const unsub = onSnapshot(q, snap => {
      const out = [];
      snap.forEach(d => out.push({ id: d.id, ...d.data() }));
      setItems(out);
    }, err => console.warn('history listener error', err));
    return () => unsub();
  }, [limitItems, branch]);

  const handleReorder = async (item) => {
    try {
      const prodId = item.docId || (item.after && item.after.productId) || null;
      const br = branch || (item.after && item.after.branch) || (item.before && item.before.branch) || 'All';
      if (!prodId) return alert('No product identified for reorder');
      const reorder = { productId: prodId, branch: br, qtyRequested: 10, status: 'requested', createdAt: new Date() };
      const ref = await addDoc(collection(db, 'reorders'), reorder);
      await logHistory({ action: 'reorder', collection: 'reorders', docId: ref.id, before: null, after: reorder });
      alert('Reorder created');
    } catch (e) {
      console.error('Reorder failed', e);
      alert('Reorder failed');
    }
  };

  return (
    <div style={{ marginTop: 18 }}>
      <h3 style={{ marginTop: 0 }}>Recent activity</h3>
      <div style={{ border: '1px solid var(--border-main)', borderRadius: 8, overflow: 'hidden', background: 'var(--surface)', maxHeight: 420, overflowY: 'auto' }}>
        {items.map(it => (
          <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', padding: 12, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{it.action} <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>{it.collection}</span></div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{it.actor ? (it.actor.email || it.actor.uid) : 'system'} • {timeAgo(it.timestamp)}</div>
              {it.before || it.after ? <div style={{ marginTop: 6, fontSize: 12, color: '#ddd' }}>{it.after && it.after.productName ? it.after.productName : (it.after && it.after.name) || ''}</div> : null}
            </div>
            <div style={{ marginLeft: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
              {it.action === 'low-stock' || (it.action === 'delete' && it.collection === 'inventory') ? <button onClick={() => handleReorder(it)} style={{ padding: '6px 8px', borderRadius: 6 }}>Reorder</button> : null}
            </div>
          </div>
        ))}
        {items.length === 0 ? <div style={{ padding: 12, color: 'var(--text-secondary)' }}>No recent activity</div> : null}
      </div>
    </div>
  );
};

export default RecentActivityFeed;
