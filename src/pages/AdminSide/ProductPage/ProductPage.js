// Payments-based listing: show purchased products grouped by status (Pending / Delivered)
import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { collection, onSnapshot, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { sanitizeForSearch } from '../../../utils/validators';
import DeliveredOrders from './DeliveredOrders';
import useInventory from '../../../hooks/useInventory';
import NewOrderModal from './NewOrderModal';

const PaymentCard = ({ order }) => {
  const [derivedNameCache] = useState(new Map());
  const items = Array.isArray(order.items) ? order.items : (order.purchasedProducts || []);
    const [displayName, setDisplayName] = useState(null);
  const total = typeof order.total === 'number' ? order.total : (items.reduce((s, it) => s + (Number(it.price || 0) * (Number(it.quantity || it.qty || 1))), 0));
  const when = order.createdAt ? (new Date(order.createdAt.seconds ? order.createdAt.seconds * 1000 : order.createdAt).toLocaleString()) : (order.date || '');
  const [updating, setUpdating] = useState(false);
  const [localStatus, setLocalStatus] = useState((order.status || order.state || 'pending').toString().toLowerCase());

  useEffect(() => {
    try { setLocalStatus((order.status || order.state || 'pending').toString().toLowerCase()); } catch (e) {}
  }, [order && (order.status || order.state)]);

  const updateStatus = async (newStatus) => {
    if (!order || !order.id) return;
    setLocalStatus(newStatus);
    setUpdating(true);
    try {
      const ref = doc(db, 'payments', order.id);
      await updateDoc(ref, { status: newStatus });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to update status', e);
    } finally {
      setUpdating(false);
    }
  };
  useEffect(() => {
    let mounted = true;
    try {
      const cand = (order.customerName || order.customer || order.buyer || order.clientName || order.client || order.contactName || order.name || '').toString();
      if (cand && cand.trim()) {
        setDisplayName(cand);
        return;
      }
      // if appointment reference present, try to resolve appointment's customer
      const apptId = order.appointmentId || (order.appointment && (order.appointment.id || order.appointment)) || null;
      const userId = order.customerId || order.userId || order.createdBy || null;
      const fetchName = async () => {
        if (apptId) {
          try {
            const snap = await getDoc(doc(db, 'appointments', apptId));
            if (snap && snap.exists()) {
              const data = snap.data();
              const n = (data.customerName || data.customer || data.clientName || data.client || data.displayName || data.name || '').toString();
              if (n && n.trim()) { if (mounted) setDisplayName(n); return; }
            }
          } catch (e) { /* ignore */ }
        }
        if (userId) {
          try {
            const snap = await getDoc(doc(db, 'users', userId));
            if (snap && snap.exists()) {
              const data = snap.data();
              const n = (data.name || data.displayName || data.fullName || data.email || '').toString();
              if (n && n.trim()) { if (mounted) setDisplayName(n); return; }
            }
          } catch (e) { /* ignore */ }
        }
        if (mounted) setDisplayName('Unknown');
      };
      fetchName();
    } catch (e) { if (mounted) setDisplayName('Unknown'); }
    return () => { mounted = false; };
  }, [order]);

  return (
    <div style={{ border: '1px solid var(--border-main)', background: 'var(--bg-drawer)', padding: 12, borderRadius: 8, marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontWeight: 700 }}>{displayName || order.customerName || order.customer || order.buyer || 'Unknown'}</div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{when}</div>
      </div>
      <div style={{ marginBottom: 8 }}>
        {items && items.length ? items.map((it, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '2px 0' }}>
            <div>{it.name || it.title || it.productName || 'Item'}</div>
            <div style={{ color: 'var(--muted)' }}>{(it.quantity ?? it.qty ?? 1)} × ₱{Number(it.price || it.unitPrice || 0).toFixed(2)}</div>
          </div>
        )) : <div style={{ color: 'var(--muted)' }}>No items</div>}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 700 }}>Total: ₱{Number(total || 0).toFixed(2)}</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            value={localStatus}
            onChange={(e) => updateStatus(e.target.value)}
            disabled={updating}
            aria-label="Change order status"
            style={{ padding: '6px 10px', borderRadius: 6, background: 'transparent', color: 'var(--text-main)', border: '1px solid var(--border-main)', cursor: 'pointer' }}
          >
            <option value="pending">pending</option>
            <option value="delivered">delivered</option>
            {(localStatus === 'delivered' || localStatus === 'refund' || localStatus === 'refunded') && <option value="refund">refund</option>}
          </select>
        </div>
      </div>
    </div>
  );
};

const localStyles = `
.hh-product-page {}
.hh-card { background: var(--bg-drawer); border: 1px solid var(--border-main); border-radius: 10px; padding: 16px; }
.hh-product-header { text-align: left; }
.hh-product-header h2 { margin: 0; }
.hh-product-search { display: flex; gap: 12px; align-items: center; margin-bottom: 16px; }
.hh-product-search input { padding: 8px; border-radius: 8px; border: 1px solid var(--border-main); width: 360px; max-width: 100%; background: var(--bg-surface); color: var(--text-main); }
.hh-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.hh-column-title { font-weight: 700; margin-bottom: 8px; }
/* Branch filter buttons: ensure dark text in light mode and active shows border only */
.branch-btn { padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-main); background: transparent; color: var(--text-main); cursor: pointer; font-family: sans-serif; font-size: 14px; font-weight: 400; }
.branch-btn.active { border: 1px solid var(--accent); }
.branch-btn:hover { background: var(--btn-hover); }
.date-filter { padding: 8px 10px; border-radius: 8px; border: 1px solid var(--border-main); background: transparent; color: var(--text-main); width: 140px; }
@media (max-width: 560px) { .date-filter { width: 100px; } }
@media (max-width: 900px) { .hh-columns { grid-template-columns: 1fr; } }
`;

const paddingToStyle = (pad) => {
  if (pad == null) return {};
  if (typeof pad === 'number' || typeof pad === 'string') return { padding: pad };
  const { top = 0, right = 0, bottom = 0, left = 0 } = pad;
  return { paddingTop: top, paddingRight: right, paddingBottom: bottom, paddingLeft: left };
};

const ProductPage = ({
  containerPadding = 24,
  headerPadding = { top: 8, right: 8, bottom: 24, left: 8 },
  headerPaddingTop,
  headerPaddingRight,
  headerPaddingBottom,
  headerPaddingLeft,
  headerFontSize = 26,
  collectionName = 'payments',
  title
}) => {
  const [query, setQuery] = useState('');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const { items: inventoryItems, branches: inventoryBranches, loading: invLoading } = useInventory();
  const [selectedBranch, setSelectedBranch] = useState(''); // empty = all branches
  const [selectedDate, setSelectedDate] = useState(''); // ISO date string YYYY-MM-DD
  const [showNewOrder, setShowNewOrder] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const col = collection(db, collectionName);
    const unsub = onSnapshot(col, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setOrders(list);
      setLoading(false);
    }, err => {
      console.error(`${collectionName} listener error`, err);
      setLoading(false);
    });
    return () => unsub();
  }, [collectionName]);

  const q = (query || '').trim().toLowerCase();
  const matchesQuery = (order) => {
    if (!q) return true;
    if ((order.id || '') === query) return true;
    const name = (order.customerName || order.customer || order.user || '').toString().toLowerCase();
    if (name.includes(q)) return true;
    const items = Array.isArray(order.items) ? order.items : (order.purchasedProducts || []);
    for (const it of items) {
      const n = (it.name || it.title || it.productName || '').toString().toLowerCase();
      if (n.includes(q)) return true;
    }
    return false;
  };

  const isDeliveredStatus = (s) => {
    if (!s) return false;
    const st = s.toString().toLowerCase();
    return ['delivered', 'completed', 'received'].includes(st);
  };

  const isRefundStatus = (s) => {
    if (!s) return false;
    const st = s.toString().toLowerCase();
    return ['refund', 'refunded'].includes(st);
  };

  // helper: compare order date to selected ISO date (YYYY-MM-DD)
  const orderMatchesDate = (order, isoDate) => {
    if (!isoDate) return true;
    try {
      const src = order.createdAt || order.date || null;
      if (!src) return false;
      const d = src && src.seconds ? new Date(src.seconds * 1000) : new Date(src);
      if (!d || Number.isNaN(d.getTime())) return false;
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}` === isoDate;
    } catch (e) { return false; }
  };

  // filter by query, selected branch (if set) and selected date (if set)
  const filtered = orders.filter(matchesQuery).filter(o => {
    if (selectedBranch) {
      const b = (o.branch || o.location || '').toString().toLowerCase();
      if (b !== (selectedBranch || '').toString().toLowerCase()) return false;
    }
    if (selectedDate) {
      if (!orderMatchesDate(o, selectedDate)) return false;
    }
    return true;
  });
  const delivered = filtered.filter(o => isDeliveredStatus(o.status || o.state));
  const refunds = filtered.filter(o => isRefundStatus(o.status || o.state));
  const pending = filtered.filter(o => !isDeliveredStatus(o.status || o.state) && !isRefundStatus(o.status || o.state));

  const headerPadSource = (headerPaddingTop !== undefined || headerPaddingRight !== undefined || headerPaddingBottom !== undefined || headerPaddingLeft !== undefined)
    ? { top: headerPaddingTop ?? 0, right: headerPaddingRight ?? 0, bottom: headerPaddingBottom ?? 0, left: headerPaddingLeft ?? 0 }
    : headerPadding;

  const headerLabel = title ?? 'Purchased Products (Payments)';

  return (
    <>
      <style>{localStyles}</style>
      <div className="hh-product-page" style={{ padding: containerPadding, paddingTop: 0 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select value={selectedBranch || ''} onChange={(e) => setSelectedBranch(e.target.value)} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-main)', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer' }}>
              <option value="">All branches</option>
              {(inventoryBranches && inventoryBranches.length > 0 ? inventoryBranches : [
                { id: 'evangelista', name: 'Evangelista' },
                { id: 'lawas', name: 'Lawas' },
                { id: 'lipa', name: 'Lipa' },
                { id: 'tanauan', name: 'Tanauan' },
              ]).map(b => (
                <option key={(b.id || b.name)} value={(b.id || b.name).toString().toLowerCase()}>{b.name || b.id}</option>
              ))}
            </select>

            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="date-filter" />
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <button onClick={() => setShowNewOrder(true)} style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--accent)', color: 'var(--accent-foreground)', border: 'none', cursor: 'pointer' }}>New Order</button>
          </div>
        </div>
        <div className="hh-card">

          <div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontWeight: 700 }}>New / Pending Orders ({pending.length})</div>
                <div>
                  {pending.length > 6 && (
                    <button onClick={() => navigate(`/products/all?branch=${encodeURIComponent(selectedBranch || '')}`)} style={{ background: 'transparent', border: 'none', color: 'var(--accent)', textDecoration: 'underline', cursor: 'pointer' }}>View all</button>
                  )}
                </div>
              </div>
              {loading ? <div>Loading…</div> : (pending.length === 0 ? <div style={{ color: 'var(--muted)' }}>No pending orders</div> : pending.slice(0,6).map(o => <PaymentCard key={o.id} order={o} />))}
            </div>
          </div>
        </div>
        {/* Delivered orders shown in a separate card outside the main pending card */}
        <div className="hh-card" style={{ marginTop: 16 }}>
          <DeliveredOrders orders={delivered} loading={loading} />
        </div>
        {/* Refunds shown in a separate card */}
        <div className="hh-card" style={{ marginTop: 16 }}>
          <DeliveredOrders orders={refunds} loading={loading} title="Refunds" />
        </div>
        {showNewOrder && (
          <NewOrderModal
            onClose={() => setShowNewOrder(false)}
            defaultBranch={selectedBranch}
            inventoryItems={inventoryItems}
            inventoryBranches={inventoryBranches}
          />
        )}
      </div>
    </>
  );
};

export default ProductPage;
