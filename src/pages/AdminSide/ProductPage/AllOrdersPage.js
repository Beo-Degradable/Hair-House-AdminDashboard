import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { useLocation, useNavigate } from 'react-router-dom';

const parseQuery = (search) => {
  try { return Object.fromEntries(new URLSearchParams(search)); } catch (e) { return {}; }
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

  const PaymentCard = ({ order }) => {
  const items = Array.isArray(order.items) ? order.items : (order.purchasedProducts || []);
  const total = typeof order.total === 'number' ? order.total : (items.reduce((s, it) => s + (Number(it.price || 0) * (Number(it.quantity || it.qty || 1))), 0));
  const when = order.createdAt ? (new Date(order.createdAt.seconds ? order.createdAt.seconds * 1000 : order.createdAt).toLocaleString()) : (order.date || '');
  const [localStatus, setLocalStatus] = useState((order.status || order.state || 'pending').toString().toLowerCase());
  const [updating, setUpdating] = useState(false);
  const [displayName, setDisplayName] = useState(null);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      const cand = (order.customerName || order.customer || order.buyer || order.clientName || order.client || order.contactName || order.name || '').toString();
      if (cand && cand.trim()) { if (mounted) { setDisplayName(cand); return; } }
      const apptId = order.appointmentId || (order.appointment && (order.appointment.id || order.appointment)) || null;
      const userId = order.customerId || order.userId || order.createdBy || null;
      try {
        if (apptId) {
          const s = await getDoc(doc(db, 'appointments', apptId));
          if (s && s.exists()) {
            const d = s.data();
            const n = (d.customerName || d.customer || d.clientName || d.client || d.displayName || d.name || '').toString();
            if (n && n.trim()) { if (mounted) { setDisplayName(n); return; } }
          }
        }
        if (userId) {
          const s = await getDoc(doc(db, 'users', userId));
          if (s && s.exists()) {
            const d = s.data();
            const n = (d.name || d.displayName || d.fullName || d.email || '').toString();
            if (n && n.trim()) { if (mounted) { setDisplayName(n); return; } }
          }
        }
      } catch (e) {}
      if (mounted) setDisplayName('Unknown');
    };
    init();
    return () => { mounted = false; };
  }, [order]);

  useEffect(() => { try { setLocalStatus((order.status || order.state || 'pending').toString().toLowerCase()); } catch (e) {} }, [order && (order.status || order.state)]);

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
          <select value={localStatus} onChange={(e) => updateStatus(e.target.value)} disabled={updating} aria-label="Change order status" style={{ padding: '6px 10px', borderRadius: 6, background: 'transparent', color: 'var(--text-main)', border: '1px solid var(--border-main)', cursor: 'pointer' }}>
            <option value="pending">pending</option>
            <option value="delivered">delivered</option>
            {(localStatus === 'delivered' || localStatus === 'refund' || localStatus === 'refunded') && <option value="refund">refund</option>}
          </select>
        </div>
      </div>
    </div>
  );
};

const AllOrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  const q = parseQuery(location.search || '');
  const branch = (q.branch || '').toString().toLowerCase();

  useEffect(() => {
    const col = collection(db, 'payments');
    const unsub = onSnapshot(col, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setOrders(list);
      setLoading(false);
    }, err => {
      console.error('payments listener error', err);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filtered = orders.filter(o => {
    if (!branch) return true;
    const b = (o.branch || o.location || '').toString().toLowerCase();
    return b === branch;
  });

  const pending = filtered.filter(o => !isDeliveredStatus(o.status || o.state) && !isRefundStatus(o.status || o.state));
  const delivered = filtered.filter(o => isDeliveredStatus(o.status || o.state));
  const refunds = filtered.filter(o => isRefundStatus(o.status || o.state));

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontWeight: 700 }}>All Orders {branch ? `(branch: ${branch})` : ''}</div>
        <div><button onClick={() => navigate('/products')} style={{ background: 'transparent', border: 'none', color: 'var(--accent)', textDecoration: 'underline', cursor: 'pointer' }}>Back</button></div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Pending ({pending.length})</div>
        {loading ? <div>Loading…</div> : (pending.length === 0 ? <div style={{ color: 'var(--muted)' }}>No pending orders</div> : pending.map(o => <PaymentCard key={o.id} order={o} />))}
      </div>

      <div style={{ marginBottom: 18 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Delivered ({delivered.length})</div>
        {loading ? <div>Loading…</div> : (delivered.length === 0 ? <div style={{ color: 'var(--muted)' }}>No delivered orders</div> : delivered.map(o => <PaymentCard key={o.id} order={o} />))}
      </div>

      <div style={{ marginBottom: 18 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Refunds ({refunds.length})</div>
        {loading ? <div>Loading…</div> : (refunds.length === 0 ? <div style={{ color: 'var(--muted)' }}>No refunds</div> : refunds.map(o => <PaymentCard key={o.id} order={o} />))}
      </div>
    </div>
  );
};

export default AllOrdersPage;
