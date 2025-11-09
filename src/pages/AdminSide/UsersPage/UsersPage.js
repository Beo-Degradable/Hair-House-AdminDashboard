// Users listing: realtime table, search, delete with history, open Add modal.
import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, deleteDoc, doc, addDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '../../../firebase';
import { logHistory } from '../../../utils/historyLogger';
import { sanitizeForSearch } from '../../../utils/validators';
import AddUserModal from './AddUserModal';

const UsersPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [addOpen, setAddOpen] = useState(false);

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

  const handleDelete = async (id) => {
    if (!id) return;
    const ok = window.confirm('Delete this user? This cannot be undone.');
    if (!ok) return;
    try {
  // Snapshot for history
      const ref = doc(db, 'users', id);
      const snap = await getDoc(ref);
      const before = snap.exists() ? snap.data() : null;
      await deleteDoc(ref);
  try {
        const auth = getAuth();
        const user = auth.currentUser;
        const actor = user ? { uid: user.uid, email: user.email } : null;
  try { await logHistory({ action: 'delete', collection: 'users', docId: id, before, after: null }); } catch (e) { console.warn('history logger failed', e); }
      } catch (hx) { console.warn('Failed to write history for user delete', hx); }
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
              <tr key={u.id} style={{ borderBottom: '1px solid var(--border-main)' }}>
                <td style={{ padding: '8px 6px' }}>{u.name}</td>
                <td style={{ padding: '8px 6px' }}>{u.email}</td>
                <td style={{ padding: '8px 6px', textTransform: 'capitalize' }}>{u.role}</td>
                {showBranchColumn ? <td style={{ padding: '8px 6px' }}>{u.role === 'stylist' ? (u.branchName || '') : ''}</td> : null}
                <td style={{ padding: '8px 6px' }}>
                  <button onClick={() => handleDelete(u.id)} className="btn btn-danger" style={{ padding: '6px 8px' }}>Delete</button>
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

export default UsersPage;
