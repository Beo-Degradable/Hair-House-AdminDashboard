// Users listing: realtime table, search, delete with history, open Add modal.
import React, { useEffect, useState, useRef, useContext } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { collection, onSnapshot, doc, addDoc, serverTimestamp, getDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db, functions } from '../../../firebase';
import { httpsCallable } from 'firebase/functions';
import { logHistory } from '../../../utils/historyLogger';
import { sanitizeForSearch } from '../../../utils/validators';
import AddUserModal from './AddUserModal';
import UpdateUserModal from './UpdateUserModal';
import { AuthContext } from '../../../context/AuthContext';
import useMediaQuery from '../../../hooks/useMediaQuery';

const UsersPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [updateUser, setUpdateUser] = useState(null);
  const [highlightedId, setHighlightedId] = useState(null);
  const [initialRole, setInitialRole] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const rowRefs = useRef(new Map());
  const location = useLocation();
  const navigate = useNavigate();
  const isDesktop = useMediaQuery('(min-width: 900px)');
  const { role: currentRole, user: currentUser } = useContext(AuthContext);

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

      // Call server-side callable to delete auth user (server should also remove Firestore doc)
      try {
        const deleteUser = httpsCallable(functions, 'deleteAuthUser');
        await deleteUser({ uid: id });

        // Ensure Firestore users doc is removed as well (callable may or may not remove it).
        try {
          await deleteDoc(ref);
        } catch (delErr) {
          console.warn('Failed to delete users doc after callable; it may have been removed already', delErr);
        }

        try {
          const auth = getAuth();
          const user = auth.currentUser;
          const actor = user ? { uid: user.uid, email: user.email } : null;
          try { await logHistory({ action: 'delete', collection: 'users', docId: id, before, after: null }); } catch (e) { console.warn('history logger failed', e); }
        } catch (hx) { console.warn('Failed to write history for user delete', hx); }
      } catch (fnErr) {
        // If the callable fails, DO NOT delete the Firestore doc. Inform the operator to run the admin script or fix functions.
        console.error('Callable deleteAuthUser failed', fnErr);
        const code = fnErr && (fnErr.code || (fnErr.data && fnErr.data.code)) ? (fnErr.code || fnErr.data.code) : null;
        const message = fnErr && (fnErr.message || (fnErr.data && fnErr.data.message)) ? (fnErr.message || fnErr.data.message) : String(fnErr);
        const cmd = `node scripts/deleteUserAndDoc.js ${id} --confirm`;
        alert('Failed to delete Authentication user via server callable. The users document was NOT removed. Run the admin script to complete deletion or fix the server callable.\n\n' + (code || message) + '\n\nAdmin command:\n' + cmd);
      }
    } catch (err) {
      console.error('Failed to delete user', err);
      alert('Failed to delete user: ' + (err.message || err));
    }
  };

  const filtered = users.filter(u => {
    const q = query.trim().toLowerCase();
    if (q && !((u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q))) return false;
    return true;
  });

  const showBranchColumn = users.some(u => u.role === 'stylist');

  return (
    <div style={{ padding: '8px 16px 24px' }}>
      {/* page title is shown in the topbar; remove duplicate heading and tighten spacing */}

      <div>
        {/* Render users grouped by role using the services layout */}
        {(() => {
          const renderSection = (title, list, addRole) => {
            const total = list ? list.length : 0;
            const limit = isDesktop ? 6 : 4; // match services: desktop 6, mobile 4
            const displayList = (list || []).slice(0, limit); // preview slice
            const empty = total === 0;
            const viewRole = addRole || (title && title.toLowerCase() === 'users' ? 'user' : '');
            return (
              <section key={title} style={{ marginBottom: 20 }}>
                <div style={{ border: '1px solid var(--border-main)', borderRadius: 8, padding: 12, background: 'transparent' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <h3 style={{ margin: 0 }}>{title}</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <div style={{ fontSize: 13, color: 'var(--muted)' }}>{displayList.length === total ? `${total} ${total === 1 ? 'item' : 'items'}` : `Showing ${displayList.length} of ${total} items`}</div>
                          {addRole ? (
                            <button
                              onClick={() => { setAddOpen(true); setInitialRole(addRole); }}
                              style={{ padding: '8px 12px', borderRadius: 8, background: 'transparent', color: 'var(--text-main)', border: '1px solid rgba(184,136,11,0.35)', cursor: 'pointer' }}
                            >
                              {addRole === 'admin' ? 'Add Admin' : addRole === 'stylist' ? 'Add Stylist' : 'Add'}
                            </button>
                          ) : null}
                        </div>
                          {(viewRole && total > 6) ? (
                          <button
                            onClick={() => { navigate(`${location.pathname}/role/${viewRole}`); }}
                            style={{ background: 'transparent', border: 'none', padding: 0, color: 'rgba(184,136,11,0.65)', cursor: 'pointer', fontSize: 13, fontWeight: 600, textDecoration: 'underline' }}
                          >
                            {`View all ${viewRole === 'admin' ? 'admins' : viewRole === 'stylist' ? 'stylists' : 'users'} >>`}
                          </button>
                        ) : null}
                    </div>
                  </div>

                  {empty ? (
                    <div style={{ padding: 18, color: 'var(--muted)', borderRadius: 6, background: 'var(--surface)' }}>
                      No {title.toLowerCase()} yet. {addRole ? `Click "${addRole === 'admin' ? 'Add Admin' : 'Add Stylist'}" to create one.` : ''}
                    </div>
                  ) : (
                    (() => {
                      return (
                        <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)', gap: 12 }}>
                          {displayList.map(u => (
                            <div key={u.id} ref={(el) => { if (el) rowRefs.current.set(u.id, el); }} style={{ background: 'var(--bg-drawer)', border: '1px solid var(--border-main)', borderRadius: 10, padding: 12, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 8, width: '100%', wordBreak: 'break-word' }}>
                              <div style={{ fontWeight: 700, lineHeight: 1.1 }}>{(!isDesktop && u.name && u.name.length > 25) ? `${u.name.slice(0,22)}...` : u.name}</div>
                              <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{u.email}</div>
                              <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{u.role}{u.role === 'stylist' && u.branchName ? ` • ${u.branchName}` : ''}</div>
                              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                {/* Stylists get Update modal; Admins get Remove (delete) action */}
                                {((u.role || 'user').toLowerCase() === 'stylist') ? (
                                  <button onClick={() => { setUpdateUser(u); setUpdateOpen(true); }} className="btn">Update</button>
                                ) : ((u.role || 'user').toLowerCase() === 'admin') ? (
                                  <button onClick={() => handleDelete(u.id)} className="btn btn-danger">Remove</button>
                                ) : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()
                  )}
                </div>
              </section>
            );
          };

          const admins = filtered.filter(u => (u.role || 'user').toLowerCase() === 'admin');
          const stylists = filtered.filter(u => (u.role || 'user').toLowerCase() === 'stylist');
          const usersOnly = filtered.filter(u => ((u.role || 'user').toLowerCase() !== 'admin' && (u.role || 'user').toLowerCase() !== 'stylist'));

          return (
            <>
              {renderSection('Admins', admins, 'admin')}
              {renderSection('Stylists', stylists, 'stylist')}
              {renderSection('Users', usersOnly, '')}
            </>
          );
        })()}
      </div>

      <AddUserModal
        open={addOpen || editOpen}
        onClose={() => { setAddOpen(false); setEditOpen(false); setInitialRole(null); setEditingUser(null); }}
        initialRole={initialRole}
        editingUser={editingUser}
      />
      <UpdateUserModal
        open={updateOpen}
        user={updateUser}
        onClose={() => { setUpdateOpen(false); setUpdateUser(null); }}
      />
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
          // If disabling, also mark the users/{uid} doc as disabled so UI and other services can detect it.
          if (action === 'disable') {
            try {
              const uRef = doc(db, 'users', id);
              await updateDoc(uRef, { disabled: true });
            } catch (updErr) {
              console.warn('Failed to mark users doc as disabled', updErr);
            }
          }
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
