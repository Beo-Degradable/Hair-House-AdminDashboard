// Notifications page: lists recent history entries, formats appointment/promotion/user changes.
import React, { useEffect, useState } from "react";
import { collection, query as q, orderBy, onSnapshot, getDocs, deleteDoc, getDoc, doc as docRef } from 'firebase/firestore';
import { db } from '../../firebase';
import { timeAgo } from '../../utils/formatters';

const NotificationsPage = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [clearing, setClearing] = useState(false);
  const [actorNames, setActorNames] = useState({});

  useEffect(() => {
    setLoading(true);
    const coll = collection(db, 'history');
    const histQ = q(coll, orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(histQ, (snap) => {
      const arr = [];
      snap.forEach(doc => arr.push({ id: doc.id, ...doc.data() }));
      setItems(arr);
      setLoading(false);
    }, (err) => {
      console.error('history onSnapshot', err);
      setError(err.message || String(err));
      setLoading(false);
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    const uids = Array.from(new Set(items.map(it => (typeof it.actor === 'string' ? it.actor : null)).filter(Boolean)));
    if (uids.length === 0) return;
    let mounted = true;
    (async () => {
      const updates = {};
      for (const uid of uids) {
        if (actorNames[uid]) continue; // cached
        try {
          const udoc = await getDoc(docRef(db, 'users', uid));
          if (!mounted) return;
          if (udoc.exists()) {
            const d = udoc.data();
            updates[uid] = d.name || d.displayName || d.fullName || d.email || uid;
          } else {
            updates[uid] = uid;
          }
        } catch (err) {
          console.warn('failed to fetch actor name for', uid, err);
          updates[uid] = uid;
        }
      }
      if (mounted && Object.keys(updates).length) setActorNames(prev => ({ ...prev, ...updates }));
    })();
    return () => { mounted = false; };
  }, [items]);

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <h2 style={{ margin: 0 }}>Notifications</h2>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="btn" onClick={async () => {
            if (clearing) return;
            if (!window.confirm('Clear all notifications? This will permanently delete notification/history entries.')) return;
            setClearing(true);
            try {
              const coll = collection(db, 'history');
              const snap = await getDocs(coll);
              await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
              setItems([]);
            } catch (err) {
              console.error('failed to clear notifications', err);
              alert('Failed to clear notifications. See console for details.');
            } finally {
              setClearing(false);
            }
          }} disabled={clearing}>{clearing ? 'Clearing...' : 'Clear'}</button>
        </div>
      </div>
      {loading && <div style={{ color: 'var(--muted)' }}>Loading notifications…</div>}
      {error && <div style={{ color: 'var(--danger)' }}>Error: {error}</div>}
      {!loading && items.length === 0 && <div style={{ color: 'var(--muted)' }}>No notifications yet.</div>}
      <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
        {items.map(it => {
          const isCancelRequest = (it.action === 'cancel_request' || it.action === 'cancel-request' || it.action === 'cancelRequest');
          const header = isCancelRequest ? 'CANCEL_REQUEST' : ((it.action === 'update' ? 'Updated' : (it.action || 'ACTION')).toString().toUpperCase());
          const actorObj = it.actor;
          const actorLabel = (typeof actorObj === 'string') ? (actorNames[actorObj] || actorObj) : (actorObj?.name || actorObj?.displayName || actorObj?.email || actorObj?.uid || actorObj);
          const formatAppointmentUpdate = (before, after) => {
            if (!before || !after) return null;
            const bStatus = String(before.status || '').toLowerCase();
            const aStatus = String(after.status || '').toLowerCase();
            if (bStatus && aStatus && bStatus !== aStatus) {
              return `The appointment for "${after.clientName || after.client || before.clientName || before.client || it.docId}" changed status from "${bStatus.charAt(0).toUpperCase() + bStatus.slice(1)}" to "${aStatus.charAt(0).toUpperCase() + aStatus.slice(1)}".`;
            }
            if (before.serviceName !== after.serviceName) {
              return `The appointment for "${after.clientName || after.client || before.clientName || before.client || it.docId}" changed service from "${before.serviceName || ''}" to "${after.serviceName || ''}".`;
            }
            if (before.stylistName !== after.stylistName) {
              return `The appointment for "${after.clientName || after.client || before.clientName || before.client || it.docId}" changed stylist from "${before.stylistName || ''}" to "${after.stylistName || ''}".`;
            }
            return null;
          };

          const fmtDate = (d) => {
            if (!d) return '';
            const date = d?.toDate ? d.toDate() : (d instanceof Date ? d : new Date(d));
            if (!date || isNaN(date.getTime())) return '';
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
          };

          const formatPromotionCreate = (after) => {
            if (!after) return null;
            return `New promotion "${after.title || it.docId}" (${after.type || 'Type'}) for ${after.branch || 'branch'}${after.serviceName ? ` • Service: ${after.serviceName}` : ''} (${fmtDate(after.startDate)} → ${fmtDate(after.endDate)}) status: ${after.status || 'active'}.`;
          };
          const formatPromotionUpdate = (before, after) => {
            if (!before || !after) return null;
            const changes = [];
            if (before.title !== after.title) changes.push(`title: "${before.title || ''}" → "${after.title || ''}"`);
            if (before.serviceName !== after.serviceName) changes.push(`service: ${before.serviceName || 'none'} → ${after.serviceName || 'none'}`);
            if (before.branch !== after.branch) changes.push(`branch: ${before.branch || ''} → ${after.branch || ''}`);
            if (before.type !== after.type) changes.push(`type: ${before.type || ''} → ${after.type || ''}`);
            const bStart = fmtDate(before.startDate); const aStart = fmtDate(after.startDate);
            const bEnd = fmtDate(before.endDate); const aEnd = fmtDate(after.endDate);
            if (bStart !== aStart || bEnd !== aEnd) changes.push(`dates: ${bStart}-${bEnd} → ${aStart}-${aEnd}`);
            if (before.status !== after.status) changes.push(`status: ${before.status || ''} → ${after.status || ''}`);
            if (changes.length === 0) return `Promotion "${after.title || before.title || it.docId}" updated.`;
            return `Promotion "${after.title || before.title || it.docId}" updated: ${changes.join('; ')}.`;
          };

          const promotionMessage = (() => {
            if (it.collection !== 'promotions') return null;
            if (it.action === 'create') return formatPromotionCreate(it.after);
            if (it.action === 'update') return formatPromotionUpdate(it.before, it.after);
            if (it.action === 'delete') return `Promotion "${it.before?.title || it.docId}" was removed.`;
            return `Promotion activity on "${it.after?.title || it.before?.title || it.docId}".`;
          })();

          return (
            <div key={it.id} style={{ border: '1px solid var(--border-main)', borderRadius: 8, padding: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>{header}</div>
              <div style={{ marginTop: 8 }}>
                {promotionMessage ? (
                  promotionMessage
                ) : isCancelRequest && it.collection === 'appointments' ? (
                  (() => {
                    const custName = it.after?.clientName || it.after?.client || it.before?.clientName || it.before?.client || it.docId;
                    const reason = it.reason || it.after?.reason || it.data?.reason || it.meta?.reason || '';
                    return (
                      <div>
                        The customer <strong>"{custName}"</strong> wants to cancel the appointment{reason ? ` due to "${reason}"` : ''}.
                      </div>
                    );
                  })()
                ) : it.collection === 'appointments' && it.action === 'update' && it.before && it.after ? (
                  (formatAppointmentUpdate(it.before, it.after) || `The appointment for "${it.after?.clientName || it.after?.client || it.docId}" was updated.`)
                ) : (
                  it.action === 'delete'
                    ? `The user "${it.before?.name || it.before?.email || it.docId}" is removed.`
                    : it.action === 'create'
                      ? `The user "${it.after?.name || it.after?.email || it.docId}" was added.`
                      : `The user "${it.after?.name || it.after?.email || it.docId}" was updated.`
                )}
              </div>
              {(function(){
                if (!actorLabel || actorLabel === 'unknown') return null;
                return <div style={{ marginTop: 8, color: 'var(--muted)', fontSize: 12 }}>By: {actorLabel}{it.timestamp ? ` • ${timeAgo(it.timestamp)}` : ''}</div>;
              })()}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default NotificationsPage;
