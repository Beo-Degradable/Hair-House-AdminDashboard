// Users listing: realtime table, search, delete with history, open Add modal.
import React, { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { collection, onSnapshot, doc, addDoc, serverTimestamp, getDoc, deleteDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db, functions } from '../../../firebase';
import { httpsCallable } from 'firebase/functions';
import { logHistory } from '../../../utils/historyLogger';
import { sanitizeForSearch } from '../../../utils/validators';
import AddUserModal from './AddUserModal';

const UsersPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [highlightedId, setHighlightedId] = useState(null);
  const rowRefs = useRef(new Map());
  const location = useLocation();

  useEffect(() => {
    const col = collection(db, 'users');
    const unsub = onSnapshot(col, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setUsers(list);
      setLoading(false);
    }, err => {
      console.error('users listener error', err);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!users || users.length === 0) return;
    try {
      const params = new URLSearchParams(location.search || '');
      const id = params.get('id');
      if (!id) return;
      const exists = users.find(u => u.id === id);
      if (!exists) return;
      setHighlightedId(id);
      const el = rowRefs.current.get(id);
      if (el && typeof el.scrollIntoView === 'function') {
        setTimeout(() => {
          try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { el.scrollIntoView(); }
        }, 60);
      }
      const clearId = setTimeout(() => setHighlightedId(null), 6000);
      return () => clearTimeout(clearId);
    } catch (e) {}
  }, [location.search, users]);

  const handleDelete = async (id) => {
    if (!id) return;
    const ok = window.confirm('Delete this user? This cannot be undone.');
    if (!ok) return;
    try {
      // Snapshot for history
      const ref = doc(db, 'users', id);
      const snap = await getDoc(ref);
      const before = snap.exists() ? snap.data() : null;

      // Call server-side callable to delete auth user and users doc
      try {
        const deleteUser = httpsCallable(functions, 'deleteAuthUser');
        await deleteUser({ uid: id });
        try {
          const auth = getAuth();
          const user = auth.currentUser;
          const actor = user ? { uid: user.uid, email: user.email } : null;
          try { await logHistory({ action: 'delete', collection: 'users', docId: id, before, after: null }); } catch (e) { console.warn('history logger failed', e); }
        } catch (hx) { console.warn('Failed to write history for user delete', hx); }
      } catch (fnErr) {
        // More helpful error handling: if the callable isn't available or fails due to deployment/billing,
        // fall back to deleting the users document locally and inform the operator that the Auth user
        // was NOT deleted and requires server-side action.
        console.error('Callable deleteAuthUser failed', fnErr);
        const code = fnErr && (fnErr.code || (fnErr.data && fnErr.data.code)) ? (fnErr.code || fnErr.data.code) : null;
        const message = fnErr && (fnErr.message || (fnErr.data && fnErr.data.message)) ? (fnErr.message || fnErr.data.message) : String(fnErr);
        // Attempt to delete the Firestore users doc as a best-effort fallback
        try {
          await deleteDoc(ref);
          try { await logHistory({ action: 'delete', collection: 'users', docId: id, before, after: null }); } catch (e) { console.warn('history logger failed', e); }
          alert('Deleted users document locally, but failed to delete Authentication user. Server error: ' + (code || message));
        } catch (delErr) {
          console.error('Fallback deleteDoc also failed', delErr);
          const delMsg = delErr && (delErr.code || delErr.message) ? (delErr.code || delErr.message) : String(delErr);
          alert('Failed to delete user (auth + firestore). Callable error: ' + (code || message) + ' — Firestore delete error: ' + delMsg);
        }
      }
    } catch (err) {
      console.error('Failed to delete user', err);
      alert('Failed to delete user: ' + (err.message || err));
    }
  };

  const filtered = users.filter(u => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
  });

  const showBranchColumn = users.some(u => u.role === 'stylist');

  return (
    <div style={{ padding: 24 }}>
      <h2>Users</h2>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
  <input value={query} onChange={(e) => setQuery(sanitizeForSearch(e.target.value))} placeholder="Search users by name or email" style={{ padding: 8, borderRadius: 8, border: '1px solid var(--border-main)', flex: 1 }} />
        <button onClick={() => setAddOpen(true)} className="button-gold-dark" style={{ padding: '8px 16px', borderRadius: 8 }}>Add User</button>
        {loading ? <div style={{ marginLeft: 12 }}>Loading…</div> : null}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-main)' }}>
              <th style={{ padding: '8px 6px' }}>Name</th>
              <th style={{ padding: '8px 6px' }}>Email</th>
              <th style={{ padding: '8px 6px' }}>Role</th>
              {showBranchColumn ? <th style={{ padding: '8px 6px' }}>Branch</th> : null}
              <th style={{ padding: '8px 6px' }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u.id} ref={(el) => { if (el) rowRefs.current.set(u.id, el); }} style={{ borderBottom: '1px solid var(--border-main)', ...(highlightedId === u.id ? { background: 'rgba(202,169,10,0.08)', boxShadow: 'inset 4px 0 0 0 rgba(202,169,10,0.9)' } : {}) }}>
                <td style={{ padding: '8px 6px' }}>{u.name}</td>
                <td style={{ padding: '8px 6px' }}>{u.email}</td>
                <td style={{ padding: '8px 6px', textTransform: 'capitalize' }}>{u.role}</td>
                {showBranchColumn ? <td style={{ padding: '8px 6px' }}>{u.role === 'stylist' ? (u.branchName || '') : ''}</td> : null}
                <td style={{ padding: '8px 6px' }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => handleAuthAction(u.id, 'disable')} className="btn" style={{ padding: '6px 8px' }}>Disable</button>
                    <button onClick={() => handleAuthAction(u.id, 'revoke')} className="btn" style={{ padding: '6px 8px' }}>Revoke</button>
                    <button onClick={() => handleDelete(u.id)} className="btn btn-danger" style={{ padding: '6px 8px' }}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AddUserModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
};

  const handleAuthAction = async (id, action) => {
    if (!id) return;
    const ok = window.confirm(`Proceed to ${action} this user's authentication?`);
    if (!ok) return;

    try {
      const fn = httpsCallable(functions, 'updateAuthUser');
      try {
        const res = await fn({ uid: id, action });
        console.log('updateAuthUser result', res);
        alert(`Success: ${action}`);
        try { await logHistory({ action: 'auth-'+action, collection: 'users', docId: id, before: null, after: null }); } catch (e) { console.warn('history logger failed', e); }
        return;
      } catch (fnErr) {
        console.warn('Callable updateAuthUser failed', fnErr);
        // Fallback: instruct admin to run local script with service account
        const cmd = `node scripts/modifyUserAuth.js ${id} --action ${action} --confirm`;
        alert(`Could not run server callable. Run this admin command from the project root (requires service account):\n\n${cmd}`);
        return;
      }
    } catch (err) {
      console.error('Failed to ${action} user', err);
      alert('Failed to ' + action + ' user: ' + (err.message || err));
    }
  };

export default UsersPage;
