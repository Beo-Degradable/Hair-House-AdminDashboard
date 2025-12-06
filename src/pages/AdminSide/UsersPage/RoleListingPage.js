import React, { useEffect, useState, useRef, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, onSnapshot, doc, getDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db, functions } from '../../../firebase';
import { httpsCallable } from 'firebase/functions';
import { logHistory } from '../../../utils/historyLogger';
import useMediaQuery from '../../../hooks/useMediaQuery';
import { AuthContext } from '../../../context/AuthContext';
import AddUserModal from './AddUserModal';

const RoleListingPage = () => {
  const { role } = useParams();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const rowRefs = useRef(new Map());
  const isDesktop = useMediaQuery('(min-width: 900px)');
  const { role: currentRole } = useContext(AuthContext);
  const [editOpen, setEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  useEffect(() => {
    const col = collection(db, 'users');
    const unsub = onSnapshot(col, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setUsers(list);
    }, err => { console.error('users listener error', err); });
    return () => unsub();
  }, []);

  const roleLower = (role || '').toLowerCase();

  const filtered = users.filter(u => {
    const r = (u.role || 'user').toLowerCase();
    if (roleLower === 'user') {
      return r !== 'admin' && r !== 'stylist';
    }
    return r === roleLower;
  });

  const handleDelete = async (id) => {
    if (!id) return;
    const ok = window.confirm('Delete this user? This cannot be undone.');
    if (!ok) return;
    try {
      const ref = doc(db, 'users', id);
      const snap = await getDoc(ref);
      const before = snap.exists() ? snap.data() : null;

      try {
        const deleteUser = httpsCallable(functions, 'deleteAuthUser');
        await deleteUser({ uid: id });
        try { await deleteDoc(ref); } catch (delErr) { console.warn('Failed to delete users doc after callable', delErr); }
        try { await logHistory({ action: 'delete', collection: 'users', docId: id, before, after: null }); } catch (e) { console.warn('history logger failed', e); }
      } catch (fnErr) {
        console.error('Callable deleteAuthUser failed', fnErr);
        const cmd = `node scripts/deleteUserAndDoc.js ${id} --confirm`;
        alert('Failed to delete Authentication user via server callable. The users document was NOT removed. Run the admin script to complete deletion or fix the server callable.\n\nAdmin command:\n' + cmd);
      }
    } catch (err) {
      console.error('Failed to delete user', err);
      alert('Failed to delete user: ' + (err.message || err));
    }
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
        if (action === 'disable') {
          try {
            const uRef = doc(db, 'users', id);
            await updateDoc(uRef, { disabled: true });
          } catch (updErr) { console.warn('Failed to mark users doc as disabled', updErr); }
        }
        return;
      } catch (fnErr) {
        console.warn('Callable updateAuthUser failed', fnErr);
        const cmd = `node scripts/modifyUserAuth.js ${id} --action ${action} --confirm`;
        alert(`Could not run server callable. Run this admin command from the project root (requires service account):\n\n${cmd}`);
        return;
      }
    } catch (err) {
      console.error('Failed to ${action} user', err);
      alert('Failed to ' + action + ' user: ' + (err.message || err));
    }
  };

  const title = roleLower === 'admin' ? 'Admins' : roleLower === 'stylist' ? 'Stylists' : 'Users';

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button onClick={() => navigate(-1)} className="btn" style={{ padding: '6px 10px' }}>Back</button>
          <h2 style={{ margin: 0 }}>{`All ${title}`}</h2>
        </div>
        <div>
          {(roleLower === 'admin' || roleLower === 'stylist') && (
            <button onClick={() => navigate('/admin/users')} className="btn" style={{ padding: '8px 12px' }}>Add {roleLower === 'admin' ? 'Admin' : 'Stylist'}</button>
          )}
        </div>
      </div>

      <div style={{ border: '1px solid var(--border-main)', borderRadius: 8, padding: 12 }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 18, color: 'var(--muted)', borderRadius: 6, background: 'var(--surface)' }}>No {title.toLowerCase()} found.</div>
        ) : (
          (() => {
            return (
              <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)', gap: 12 }}>
                {filtered.map(u => (
                  <div key={u.id} ref={(el) => { if (el) rowRefs.current.set(u.id, el); }} style={{ background: 'var(--bg-drawer)', border: '1px solid var(--border-main)', borderRadius: 10, padding: 12, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 8, width: '100%', wordBreak: 'break-word' }}>
                    <div style={{ fontWeight: 700, lineHeight: 1.1 }}>{(!isDesktop && u.name && u.name.length > 25) ? `${u.name.slice(0,22)}...` : u.name}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{u.email}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{u.role}{u.role === 'stylist' && u.branchName ? ` • ${u.branchName}` : ''}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      {currentRole === 'admin' && u.role === 'stylist' ? (
                        <button onClick={() => { setEditingUser(u); setEditOpen(true); }} className="btn" style={{ padding: '6px 8px' }}>Update</button>
                      ) : null}
                      {/* Only show Disable/Delete for admin or stylist accounts, not plain users */}
                      {((u.role || 'user').toLowerCase() !== 'user') ? (
                        <>
                          <button onClick={() => handleAuthAction(u.id, 'disable')} className="btn" style={{ padding: '6px 8px' }}>Disable</button>
                          <button onClick={() => handleDelete(u.id)} className="btn btn-danger" style={{ padding: '6px 8px' }}>Delete</button>
                        </>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()
        )}
      </div>
      <AddUserModal
        open={editOpen}
        onClose={() => { setEditOpen(false); setEditingUser(null); }}
        editingUser={editingUser}
      />
    </div>
  );
};

export default RoleListingPage;
