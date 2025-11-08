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

  // Resolve actor UIDs (strings) to human-friendly names by reading the users collection once per uid.
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
          // build a descriptive message for appointment updates when possible
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

          return (
            <div key={it.id} style={{ border: '1px solid var(--border-main)', borderRadius: 8, padding: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>{header}</div>
              <div style={{ marginTop: 8 }}>
                {isCancelRequest && it.collection === 'appointments' ? (
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
