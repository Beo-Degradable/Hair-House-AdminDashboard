import React, { useMemo, useState, useEffect } from 'react';
import BranchSelector from '../../../components/BranchSelector';
import AddPromotionModal from './AddPromotionModal';
import UpdatePromotionModal from './UpdatePromotionModal';
import { formatCurrency } from '../../../utils/formatters';
import { db } from '../../../firebase';
import { collection, onSnapshot, query, where, orderBy, updateDoc, doc } from 'firebase/firestore';

// Promotions page with Branch selector and Promo-type filter dropdown
export default function PromotionsPage() {
  // Static branches as requested
  const branches = useMemo(() => ([
    { id: 'B001', name: 'Evangelista' },
    { id: 'B002', name: 'Lawas' },
    { id: 'B003', name: 'Lipa' },
    { id: 'B004', name: 'Tanauan' },
  ]), []);

  const [selectedBranch, setSelectedBranch] = useState('');
  const [promoType, setPromoType] = useState(''); // '' | 'Flash Offers' | 'Promo'
  const [showAdd, setShowAdd] = useState(false);
  const [promotions, setPromotions] = useState([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Subscribe to promotions realtime with filters. We build a base query and then client-filter if combos not all indexed.
  useEffect(() => {
    setLoading(true);
    try {
      const col = collection(db, 'promotions');
      // Basic ordering by startDate (if present) then createdAt fallback
      let qRef = query(col, orderBy('startDate'));
      // Firestore composite indexes might not exist for branch+type+startDate; so we fetch ordered list then client filter.
      const unsub = onSnapshot(qRef, (snap) => {
        const rows = [];
        snap.forEach(doc => rows.push({ id: doc.id, ...doc.data() }));
        const filtered = rows.filter(r => {
          if (selectedBranch && r.branch !== selectedBranch) return false;
          if (promoType && r.type !== promoType) return false;
          return true;
        });
        setPromotions(filtered);

        // Auto-expire promotions whose end date is today or earlier
        try {
          const now = new Date();
          const nowMid = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
          rows.forEach(async (r) => {
            try {
              if (!r.endDate) return;
              const e = r.endDate?.toDate ? r.endDate.toDate() : (r.endDate instanceof Date ? r.endDate : new Date(r.endDate));
              if (isNaN(e.getTime())) return;
              const endMid = new Date(e.getFullYear(), e.getMonth(), e.getDate()).getTime();
              if (nowMid >= endMid && String((r.status || '')).toLowerCase() !== 'expired') {
                // mark expired
                await updateDoc(doc(db, 'promotions', r.id), { status: 'expired' });
              }
            } catch (err) {
              console.warn('failed to auto-expire promotion', r.id, err);
            }
          });
        } catch (err) {
          console.warn('auto-expire check failed', err);
        }
        setLoading(false);
      }, (e) => { setError(e.message || String(e)); setLoading(false); });
      return () => unsub();
    } catch (e) {
      console.error('promotions listener failed', e);
      setError(e.message || String(e));
      setLoading(false);
    }
  }, [selectedBranch, promoType]);

  const formatDate = (d) => {
    if (!d) return '-';
    const dateObj = d.toDate ? d.toDate() : (d instanceof Date ? d : new Date(d));
    if (isNaN(dateObj.getTime())) return '-';
    return dateObj.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <div style={{ padding: '8px 16px 24px' }}>
      {/* Containered layout: promotions inside a bordered card with header + Add button */}
      <div style={{ border: '1px solid var(--border-main)', borderRadius: 10, padding: 12, background: 'transparent' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ minWidth: 150 }}>
              <BranchSelector size="sm" branches={branches} value={selectedBranch} onChange={setSelectedBranch} />
            </div>
            <div style={{ minWidth: 140 }}>
              <select value={promoType} onChange={(e) => setPromoType(e.target.value)} style={{ padding: 6, borderRadius: 6, width: '100%', fontSize: 13, height: 32 }}>
                <option value="">All types</option>
                <option value="Flash Offers">Flash Offers</option>
                <option value="Promo">Promo</option>
              </select>
            </div>
            <div>
              <button onClick={() => setShowAdd(true)} style={addBtnStyle}>Add</button>
            </div>
          </div>
        </div>

        <div style={{
          background: 'var(--bg-drawer)',
          border: '1px solid var(--border-main)',
          borderRadius: 10,
          padding: 16,
          overflowX: 'auto'
        }}>
        {error && <div style={{ color: 'var(--danger, #d32f2f)', marginBottom: 12 }}>Error: {error}</div>}
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', fontSize: 14 }}>Loading promotions...</div>
        ) : promotions.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', fontSize: 14, opacity: 0.7 }}>No promotions found.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={theadRowStyle}>
                <th style={thStyle}>Title</th>
                <th style={thStyle}>Subtitle</th>
                <th style={thStyle}>Service</th>
                <th style={thStyle}>Value</th>
                <th style={thStyle}>Start</th>
                <th style={thStyle}>End</th>
                <th style={thStyle}>Status</th>
                <th style={{ ...thStyle, width: 110 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {promotions.map(p => (
                <tr key={p.id} style={tbodyRowStyle}>
                  <td style={tdStyle}>{p.title || '-'}</td>
                  <td style={tdStyle}>{p.subtitle || '-'}</td>
                  <td style={tdStyle}>{p.serviceName || p.service || '-'}</td>
                  <td style={tdStyle}>{(p.discountType === 'percent' && p.discountValue != null) ? `${p.discountValue}` : (p.discountType === 'amount' && p.discountValue != null) ? formatCurrency(Number(p.discountValue)) : '-'}</td>
                  <td style={tdStyle}>{formatDate(p.startDate)}</td>
                  <td style={tdStyle}>{formatDate(p.endDate)}</td>
                  <td style={{ ...tdStyle, fontWeight: 600, color: statusColor(p.status) }}>{p.status || '-'}</td>
                  <td style={tdStyle}>
                    <button
                      onClick={() => { setEditing(p); setEditOpen(true); }}
                      style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-main)', cursor: 'pointer' }}
                    >Update</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <AddPromotionModal
        open={showAdd}
        defaultBranch={selectedBranch}
        onClose={() => setShowAdd(false)}
        onCreated={(p) => { /* optionally optimistic update; rely on listener */ }}
      />
      {editOpen && editing && (
        <UpdatePromotionModal
          open={editOpen}
          data={editing}
          onClose={() => { setEditOpen(false); setEditing(null); }}
        />
      )}
    </div>
  </div>
  );
}

const addBtnStyle = {
  padding: '10px 20px',
  borderRadius: 8,
  border: '1px solid var(--border-main)',
  background: 'var(--text-main)',
  color: 'var(--bg-main)',
  fontWeight: 700,
  cursor: 'pointer'
};

const thStyle = { textAlign: 'left', padding: '10px 8px', borderBottom: '1px solid var(--border-main)', background: 'var(--bg-main)', position: 'sticky', top: 0 };
const tdStyle = { padding: '8px 8px', borderBottom: '1px solid var(--border-main)' };
const theadRowStyle = { background: 'var(--bg-main)', color: 'var(--text-main)' };
const tbodyRowStyle = { background: 'var(--bg-drawer)' };
const statusColor = (s) => {
  switch (String(s || '').toLowerCase()) {
    case 'active': return '#2e7d32';
    case 'expired': return '#d32f2f';
    default: return 'var(--text-main)';
  }
};
