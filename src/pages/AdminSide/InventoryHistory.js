import React, { useEffect, useMemo, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { formatCurrency } from '../../utils/formatters';

const FILTERS = { WEEK: 'week', MONTH: 'month', ALL: 'all' };

export default function InventoryHistory({ branchId = null, onClose = null }) {
  const [filter, setFilter] = useState(FILTERS.WEEK);
  const [adjustments, setAdjustments] = useState([]);
  const [productsMap, setProductsMap] = useState({});
  const [search, setSearch] = useState('');

  useEffect(() => {
    // products map
    const prodCol = collection(db, 'products');
    const unsub = onSnapshot(prodCol, snap => {
      const m = {};
      snap.forEach(d => m[d.id] = d.data());
      setProductsMap(m);
    }, err => { console.warn('products listener failed', err); setProductsMap({}); });
    return () => unsub();
  }, []);

  const startTs = useMemo(() => {
    const now = new Date();
    if (filter === FILTERS.WEEK) return new Date(now.getTime() - 7 * 24 * 3600 * 1000);
    if (filter === FILTERS.MONTH) return new Date(now.getTime() - 30 * 24 * 3600 * 1000);
    return null;
  }, [filter]);

  useEffect(() => {
    const col = collection(db, 'inventoryAdjustments');
    let q = null;
    if (branchId && startTs) q = query(col, where('branchId', '==', branchId), where('createdAt', '>=', startTs), orderBy('createdAt', 'desc'));
    else if (branchId) q = query(col, where('branchId', '==', branchId), orderBy('createdAt', 'desc'));
    else if (startTs) q = query(col, where('createdAt', '>=', startTs), orderBy('createdAt', 'desc'));
    else q = query(col, orderBy('createdAt', 'desc'));

    const unsub = onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAdjustments(list);
    }, err => { console.error('adjustments listener error', err); setAdjustments([]); });
    return () => unsub();
  }, [branchId, startTs]);

  const visible = useMemo(() => {
    if (!search) return adjustments;
    const q = search.trim().toLowerCase();
    return adjustments.filter(a => {
      const prod = productsMap[a.productId] || {};
      const name = (prod && (prod.productName || prod.name || prod.title)) || '';
      if (name.toLowerCase().includes(q)) return true;
      if ((a.reason || '').toLowerCase().includes(q)) return true;
      return false;
    });
  }, [adjustments, productsMap, search]);

  const totalProductCost = useMemo(() => {
    let sum = 0;
    for (const a of visible) {
      const delta = Number(a.delta || 0);
      if (delta >= 0) continue;
      const prod = productsMap[a.productId] || {};
      const cost = Number(prod.cost || 0);
      if (!cost) continue;
      sum += Math.abs(delta) * cost;
    }
    return sum;
  }, [visible, productsMap]);

  const formatTime = (ts) => {
    if (!ts) return '';
    try {
      if (ts.toDate) return ts.toDate().toLocaleString();
      return new Date(ts).toLocaleString();
    } catch (e) {
      return '';
    }
  };

  return (
    <div style={{ padding: 12, width: '95vw', maxWidth: 980, color: 'var(--text-main)', background: 'var(--bg-surface, #1f1f1f)', border: '2px solid var(--accent, #c59b16)', borderRadius: 8, boxSizing: 'border-box', maxHeight: '90vh', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, color: 'var(--text-main)' }}>Inventory History</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => setFilter(FILTERS.WEEK)} style={{ background: filter === FILTERS.WEEK ? 'var(--accent, #c59b16)' : 'transparent', color: filter === FILTERS.WEEK ? 'var(--accent-contrast, #1f1f1f)' : 'var(--text-main)', border: '1px solid var(--accent, #c59b16)', padding: '6px 10px', borderRadius: 4 }}>Weekly</button>
          <button onClick={() => setFilter(FILTERS.MONTH)} style={{ background: filter === FILTERS.MONTH ? 'var(--accent, #c59b16)' : 'transparent', color: filter === FILTERS.MONTH ? 'var(--accent-contrast, #1f1f1f)' : 'var(--text-main)', border: '1px solid var(--accent, #c59b16)', padding: '6px 10px', borderRadius: 4 }}>Monthly</button>
          <button onClick={() => setFilter(FILTERS.ALL)} style={{ background: filter === FILTERS.ALL ? 'var(--accent, #c59b16)' : 'transparent', color: filter === FILTERS.ALL ? 'var(--accent-contrast, #1f1f1f)' : 'var(--text-main)', border: '1px solid var(--accent, #c59b16)', padding: '6px 10px', borderRadius: 4 }}>All</button>
          {onClose && <button onClick={onClose} style={{ marginLeft: 8, background: 'transparent', color: 'var(--text-main)', border: '1px solid var(--accent, #c59b16)', padding: '6px 10px', borderRadius: 4 }}>Close</button>}
        </div>
      </div>

      <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input placeholder="Search product or reason" value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 120, padding: 8, background: 'transparent', border: '1px solid var(--accent, #c59b16)', color: 'var(--text-main)', borderRadius: 4 }} />
        <div style={{ minWidth: 180, textAlign: 'right' }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Total product cost (used):</div>
          <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{formatCurrency(totalProductCost)}</div>
        </div>
      </div>

      <div style={{ marginTop: 12, overflow: 'auto', maxHeight: '68vh', paddingRight: 8 }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: 8, color: 'var(--text-main)', borderBottom: '2px solid var(--accent, #c59b16)' }}>Product</th>
                <th style={{ textAlign: 'left', padding: 8, color: 'var(--text-main)', borderBottom: '2px solid var(--accent, #c59b16)' }}>Delta</th>
                <th style={{ textAlign: 'left', padding: 8, color: 'var(--text-main)', borderBottom: '2px solid var(--accent, #c59b16)' }}>Reason</th>
                <th style={{ textAlign: 'left', padding: 8, color: 'var(--text-main)', borderBottom: '2px solid var(--accent, #c59b16)' }}>Updated By</th>
                <th style={{ textAlign: 'left', padding: 8, color: 'var(--text-main)', borderBottom: '2px solid var(--accent, #c59b16)' }}>Cost</th>
                <th style={{ textAlign: 'left', padding: 8, color: 'var(--text-main)', borderBottom: '2px solid var(--accent, #c59b16)' }}>Time</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(a => {
                const prod = productsMap[a.productId] || {};
                const prodName = prod.productName || prod.name || '—';
                const cost = Number(prod.cost || 0);
                const costForAdj = a.delta < 0 ? (Math.abs(Number(a.delta || 0)) * cost) : 0;
                return (
                  <tr key={a.id} style={{ borderBottom: '1px solid rgba(197,155,22,0.18)' }}>
                    <td style={{ padding: 8, color: 'var(--text-main)', verticalAlign: 'top' }}>{prodName}</td>
                    <td style={{ padding: 8, color: 'var(--text-main)', verticalAlign: 'top' }}>{Number(a.delta) > 0 ? `+${a.delta}` : a.delta}</td>
                    <td style={{ padding: 8, color: 'var(--text-main)', verticalAlign: 'top' }}>{a.reason}</td>
                    <td style={{ padding: 8, color: 'var(--text-main)', verticalAlign: 'top' }}>{(a.createdBy && (a.createdBy.name || a.createdBy.email)) || 'System'}</td>
                    <td style={{ padding: 8, color: 'var(--text-main)', verticalAlign: 'top' }}>{formatCurrency(costForAdj)}</td>
                    <td style={{ padding: 8, color: 'var(--text-main)', verticalAlign: 'top' }}>{formatTime(a.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
