import React, { useState, useEffect } from 'react';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase';

const DeliveredOrders = ({ orders = [], loading = false, title = 'Delivered Orders' }) => {
  const PaymentCard = ({ order }) => {
    const items = Array.isArray(order.items) ? order.items : (order.purchasedProducts || []);
    const total = typeof order.total === 'number' ? order.total : (items.reduce((s, it) => s + (Number(it.price || 0) * (Number(it.quantity || it.qty || 1))), 0));
    const when = order.createdAt ? (new Date(order.createdAt.seconds ? order.createdAt.seconds * 1000 : order.createdAt).toLocaleString()) : (order.date || '');
    const [saving, setSaving] = useState(false);
    const [localStatus, setLocalStatus] = useState((order.status || order.state || 'delivered').toString().toLowerCase());
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

    React.useEffect(() => {
      try { setLocalStatus((order.status || order.state || 'delivered').toString().toLowerCase()); } catch (e) {}
    }, [order && (order.status || order.state)]);

    const updateStatus = async (newStatus) => {
      if (!order || !order.id) return;
      setLocalStatus(newStatus);
      setSaving(true);
      try {
        const ref = doc(db, 'payments', order.id);
        await updateDoc(ref, { status: newStatus });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Failed to update status', e);
      } finally {
        setSaving(false);
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
            <select
              value={localStatus}
              onChange={(e) => updateStatus(e.target.value)}
              disabled={saving}
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

  return (
    <div>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>{title} ({orders.length})</div>
      {loading ? <div>Loading…</div> : (orders.length === 0 ? <div style={{ color: 'var(--muted)' }}>No {title.toLowerCase()}</div> : orders.map(o => <PaymentCard key={o.id} order={o} />))}
    </div>
  );
};

export default DeliveredOrders;
