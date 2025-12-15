// UpdateUserModal: show detailed info about a user/stylist including counts of products sold and services completed.
import React, { useEffect, useState } from 'react';
import { collection, query as q, where, getDocs, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../../firebase';
import { logHistory } from '../../../utils/historyLogger';

export default function UpdateUserModal({ open = false, user = null, onClose = () => {} }) {
  const [loading, setLoading] = useState(false);
  const [productsSold, setProductsSold] = useState(0);
  const [servicesCompleted, setServicesCompleted] = useState(0);
  const [specialized, setSpecialized] = useState([]);
  const [servicesOptions, setServicesOptions] = useState([]);
  const [selectedService, setSelectedService] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [years, setYears] = useState('');
  const [disabled, setDisabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [snack, setSnack] = useState({ open: false, message: '', type: 'info' });

  // helper to toggle disabled state
  const handleToggleDisabled = async () => {
    const action = disabled ? 'enable' : 'disable';
    const ok = window.confirm(`${disabled ? 'Reactivate' : 'Deactivate'} this user's authentication?`);
    if (!ok) return;
    try {
      setSaving(true);
      const fn = httpsCallable(functions, 'updateAuthUser');
      await fn({ uid: user.id, action });
      const uRef = doc(db, 'users', user.id);
      await updateDoc(uRef, { disabled: !disabled, updatedAt: serverTimestamp() });
      try { await logHistory({ action: action === 'disable' ? 'auth-disable' : 'auth-enable', collection: 'users', docId: user.id, before: null, after: null }); } catch (e) { /* ignore */ }
      setDisabled(!disabled);
      setSnack({ open: true, message: disabled ? 'Account reactivated' : 'Account deactivated', type: 'success' });
    } catch (err) {
      setSnack({ open: true, message: 'Failed to update account status', type: 'error' });
    } finally { setSaving(false); }
  };

  // helper to remove user (auth + firestore)
  const handleRemoveUser = async () => {
    const ok = window.confirm('Delete this user? This will remove their Authentication account and Firestore document.');
    if (!ok) return;
    try {
      setSaving(true);
      const delFn = httpsCallable(functions, 'deleteAuthUser');
      await delFn({ uid: user.id });
      try { await deleteDoc(doc(db, 'users', user.id)); } catch (e) { /* ignore */ }
      try { await logHistory({ action: 'delete', collection: 'users', docId: user.id, before: null, after: null }); } catch (e) { /* ignore */ }
      setSnack({ open: true, message: 'Removed', type: 'success' });
      onClose();
    } catch (err) {
      setSnack({ open: true, message: 'Failed to delete user', type: 'error' });
    } finally { setSaving(false); }
  };

  useEffect(() => {
    if (!open || !user) return;
    let mounted = true;
    const loadCounts = async () => {
      setLoading(true);
      try {
        const email = (user.email || '').toString();
        const name = (user.name || '').toString();

        // Query payments by stylist email and stylist name
        const paymentsCol = collection(db, 'payments');
        const results = new Set();
        try {
          if (email) {
            const q1 = q(paymentsCol, where('stylistEmail', '==', email));
            const snap1 = await getDocs(q1);
            snap1.forEach(d => results.add(d.id));
          }
        } catch (e) { /* ignore */ }
        try {
          if (name) {
            const q2 = q(paymentsCol, where('stylistName', '==', name));
            const snap2 = await getDocs(q2);
            snap2.forEach(d => results.add(d.id));
          }
        } catch (e) { /* ignore */ }
        // Fallback: also try payments where createdBy email matches (some payloads store createdBy)
        try {
          if (email) {
            const q3 = q(paymentsCol, where('createdByEmail', '==', email));
            const snap3 = await getDocs(q3);
            snap3.forEach(d => results.add(d.id));
          }
        } catch (e) { /* ignore */ }

        const soldCount = results.size;
        if (mounted) setProductsSold(soldCount);

        // Count completed services from appointments collection
        const apptCol = collection(db, 'appointments');
        const svcIds = new Set();
        try {
          if (email) {
            const qa = q(apptCol, where('stylistEmail', '==', email));
            const sa = await getDocs(qa);
            sa.forEach(d => {
              const data = d.data();
              const status = (data.status || '').toString().toLowerCase();
              if (status === 'completed' || status === 'done') svcIds.add(d.id);
            });
          }
        } catch (e) { /* ignore */ }
        try {
          if (name) {
            const qb = q(apptCol, where('stylistName', '==', name));
            const sb = await getDocs(qb);
            sb.forEach(d => {
              const data = d.data();
              const status = (data.status || '').toString().toLowerCase();
              if (status === 'completed' || status === 'done') svcIds.add(d.id);
            });
          }
        } catch (e) { /* ignore */ }

        if (mounted) setServicesCompleted(svcIds.size);

        // Specialized services come from the user document (user.specializedServices)
        if (mounted) {
          // normalize specialized services to array of strings
          const specArr = Array.isArray(user.specializedServices) ? user.specializedServices.map(s => (s && s.name) ? s.name : String(s)) : (user.specializedServices || []);
          setSpecialized(specArr);
          setName(user.name || '');
          setEmail(user.email || '');
          setYears(user.yearsOfExperience != null ? String(user.yearsOfExperience) : '');
          
          setDisabled(Boolean(user.disabled));
        }

      } catch (err) {
        // failure to load counts is non-fatal; show snack
        setSnack({ open: true, message: 'Failed to load some user data', type: 'error' });
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadCounts();
    // load services options for specialized-services dropdown
    (async () => {
      try {
        const sCol = collection(db, 'services');
        const snap = await getDocs(sCol);
        const opts = snap.docs.map(d => {
          const data = d.data();
          return data && (data.name || data.serviceName) ? (data.name || data.serviceName) : d.id;
        }).filter(Boolean);
        if (mounted) setServicesOptions(opts);
      } catch (e) {
        // ignore load failure
      }
    })();
    return () => { mounted = false; };
  }, [open, user]);

  // auto-hide snack
  useEffect(() => {
    if (!snack.open) return;
    const t = setTimeout(() => setSnack(s => ({ ...s, open: false })), 3000);
    return () => clearTimeout(t);
  }, [snack.open]);

  if (!open || !user) return null;

  return (
    <div style={{ position: 'fixed', left:0, top:0, right:0, bottom:0, background: 'var(--modal-overlay, rgba(0,0,0,0.4))', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300 }} onClick={onClose}>
      <div style={{ width: 'min(720px, 96%)', maxHeight: '86vh', overflowY: 'auto', background: 'var(--bg-drawer)', color: 'var(--text-main)', padding: 18, borderRadius: 8, border: '1px solid var(--border-main)' }} onClick={(e) => e.stopPropagation()}>
        {/* header removed: title and duplicate Close button were redundant */}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Name</div>
            <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border-main)', background: 'var(--bg-surface)', color: 'var(--text-main)' }} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Email</div>
            <input value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border-main)', background: 'var(--bg-surface)', color: 'var(--text-main)' }} />
          </div>

          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Years of experience</div>
            <input value={years} onChange={(e) => setYears(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border-main)', background: 'var(--bg-surface)', color: 'var(--text-main)' }} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Products sold</div>
            <input value={String(productsSold)} onChange={(e) => setProductsSold(Number(e.target.value || 0))} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border-main)', background: 'var(--bg-surface)', color: 'var(--text-main)' }} />
          </div>

          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Services completed</div>
            <div style={{ fontWeight: 700 }}>{loading ? '…' : String(servicesCompleted)}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Account status</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <div style={{ fontWeight: 700 }}>{disabled ? 'Deactivated' : 'Active'}</div>
              <button className="btn" onClick={handleToggleDisabled} style={{ padding: '6px 8px' }}>{disabled ? 'Reactivate' : 'Deactivate'}</button>
              <button className="btn btn-danger" onClick={handleRemoveUser} style={{ padding: '6px 8px' }}>Remove</button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>{disabled ? 'Deactivated accounts cannot sign in until reactivated.' : 'Active accounts can sign in.'}</div>
          </div>
        </div>

        {/* Specialized services container (interactive chips + add) */}
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Specialized services</div>
          <div style={{ border: '1px solid var(--border-main)', borderRadius: 8, padding: 10, background: 'var(--bg-surface)' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              {specialized && specialized.length ? specialized.map((s, idx) => (
                <div key={s + '-' + idx} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 16, background: 'var(--chip-bg, rgba(0,0,0,0.04))', color: 'var(--text-main)' }}>
                  <span style={{ fontSize: 13 }}>{s}</span>
                  <button onClick={() => { setSpecialized(prev => prev.filter(x => x !== s)); }} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}>✕</button>
                </div>
              )) : (<div style={{ color: 'var(--text-secondary)' }}>No specialized services</div>)}
            </div>
          </div>

          {/* select + add button moved outside the bordered container per UI request */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
            <select
              value={selectedService}
              onChange={(e) => setSelectedService(e.target.value)}
              style={{
                flex: 1,
                padding: 8,
                borderRadius: 6,
                border: '1px solid var(--border-main)',
                background: 'var(--bg-surface, #2b2b2b)',
                color: 'var(--text-main, #fff)',
                WebkitAppearance: 'none',
                MozAppearance: 'none',
                appearance: 'none'
              }}
            >
              <option value="" style={{ background: 'var(--bg-drawer, #2b2b2b)', color: 'var(--text-main, #fff)' }}>Select a service…</option>
              {servicesOptions.map(s => (<option key={s} value={s} style={{ background: 'var(--bg-drawer, #2b2b2b)', color: 'var(--text-main, #fff)' }}>{s}</option>))}
            </select>
            <button onClick={() => {
              if (!selectedService) return;
              setSpecialized(prev => (prev.includes(selectedService) ? prev : [...prev, selectedService]));
              setSelectedService('');
            }} className="btn" style={{ padding: '8px 10px' }}>Add</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose} style={{ padding: '6px 10px' }}>Cancel</button>

          <button className="btn" onClick={async () => {
            // Save edits to user doc (including email change)
            const ok = window.confirm('Save changes to this user?');
            if (!ok) return;
            try {
              setSaving(true);
              // handle email change via callable if changed
              if ((email || '') !== (user.email || '')) {
                try {
                  const fn = httpsCallable(functions, 'updateAuthUser');
                  await fn({ uid: user.id, action: 'changeEmail', email });
                } catch (err) {
                  setSnack({ open: true, message: 'Failed to change email in Authentication', type: 'error' });
                  setSaving(false);
                  return;
                }
              }

              const uRef = doc(db, 'users', user.id);
              const specArr = specialized.map(s => ({ name: s }));
              const payload = { name: name || user.name || '', email: email || user.email || '', yearsOfExperience: years !== '' ? Number(years) : null, specializedServices: specArr, productsSold: Number(productsSold || 0), updatedAt: serverTimestamp() };
              await updateDoc(uRef, payload);
              try { await logHistory({ action: 'update', collection: 'users', docId: user.id, before: null, after: payload }); } catch (e) { /* ignore */ }
              setSnack({ open: true, message: 'Saved', type: 'success' });
            } catch (err) {
              setSnack({ open: true, message: 'Failed to save user', type: 'error' });
            } finally { setSaving(false); }
          }} style={{ padding: '6px 10px' }}>{saving ? 'Saving…' : 'Save'}</button>
        </div>

        {/* snack bar */}
        {snack.open ? (
          <div style={{ position: 'absolute', right: 18, bottom: 18, padding: '10px 14px', borderRadius: 8, background: snack.type === 'success' ? 'var(--snack-success-bg, rgba(46,125,50,0.12))' : snack.type === 'error' ? 'var(--snack-error-bg, rgba(183,28,28,0.12))' : 'var(--snack-bg, rgba(0,0,0,0.1))', border: '1px solid var(--border-main)', color: 'var(--text-main)' }}>
            {snack.message}
          </div>
        ) : null}

      </div>
    </div>
  );
}
