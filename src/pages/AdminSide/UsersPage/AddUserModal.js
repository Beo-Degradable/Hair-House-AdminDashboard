// AddUserModal: create user (admin/stylist) with basic validation + history log.
import React, { useState, useEffect } from 'react';
import { setDoc, doc, serverTimestamp, collection, onSnapshot, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions, firebaseConfig } from '../../../firebase';
import { initializeApp as initializeAppClient, deleteApp as deleteAppClient } from 'firebase/app';
import { getAuth as getAuthClient, createUserWithEmailAndPassword, signOut as signOutClient } from 'firebase/auth';
import { isValidName, isValidEmail, isValidPassword, sanitizeName, stripSpecialExceptEmail } from '../../../utils/validators';
import { logHistory } from '../../../utils/historyLogger';

const AddUserModal = ({ open, onClose, initialRole, editingUser }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('stylist');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [branchName, setBranchName] = useState('');
  const [saving, setSaving] = useState(false);
  const [services, setServices] = useState([]);
  const [yearsOfExperience, setYearsOfExperience] = useState('');
  const [specializedServices, setSpecializedServices] = useState([]);
  const [selectedServiceToAdd, setSelectedServiceToAdd] = useState('');

  useEffect(() => {
    const col = collection(db, 'services');
    const unsub = onSnapshot(col, snap => {
      const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setServices(arr);
    }, err => { console.warn('services listener', err); setServices([]); });
    return () => unsub();
  }, []);

  // Clear branch when role is not stylist to avoid accidental submission
  useEffect(() => {
    if (role !== 'stylist') setBranchName('');
  }, [role]);

  // If initialRole is provided when opening, set the role accordingly
  useEffect(() => {
    if (open && initialRole) {
      setRole(initialRole);
    }
  }, [open, initialRole]);

  // If editingUser is provided, prefill fields for edit mode
  useEffect(() => {
    if (open && editingUser) {
      setName(editingUser.name || '');
      setEmail(editingUser.email || '');
      setRole(editingUser.role || 'stylist');
      setBranchName(editingUser.branchName || '');
      setYearsOfExperience(editingUser.yearsOfExperience || '');
      setSpecializedServices(editingUser.specializedServices ? editingUser.specializedServices.map(s => ({ id: s.id || s.id, name: s.name || s.name })) : []);
      // When editing we should not show or change password
      setPassword('');
    }
  }, [open, editingUser]);

  if (!open) return null;

  const reset = () => { setName(''); setEmail(''); setPassword(''); setShowPassword(false); setRole('stylist'); setBranchName(''); setYearsOfExperience(''); setSpecializedServices([]); setSelectedServiceToAdd(''); };

  const handleAddService = () => {
    if (!selectedServiceToAdd) return;
    const svc = services.find(s => s.id === selectedServiceToAdd);
    if (!svc) return;
    if (specializedServices.some(s => s.id === svc.id)) return; // avoid duplicates
    setSpecializedServices(prev => [...prev, svc]);
    setSelectedServiceToAdd('');
  };

  const handleRemoveService = (id) => {
    setSpecializedServices(prev => prev.filter(s => s.id !== id));
  };

  const handleSave = async () => {
    // Validation
    if (!name || !email || !role) { alert('Please fill name, email and role'); return; }
    if (!isValidName(name)) { alert('Name should only contain letters, spaces, hyphen or apostrophe'); return; }
    if (!isValidEmail(email)) { alert('Please enter a valid email address'); return; }
    // If not editing, password is required for new users. When editing, password is optional and not handled here.
    if (!editingUser && (!password || !isValidPassword(password))) { alert('Please provide a password of at least 6 characters'); return; }
    if (role === 'stylist' && !branchName) { alert('Please select a branch for stylists'); return; }
    if (role === 'stylist' && (!yearsOfExperience || isNaN(Number(yearsOfExperience)) || Number(yearsOfExperience) < 0)) { alert('Please enter valid years of experience for stylists'); return; }
    if (role === 'stylist' && specializedServices.length === 0) { alert('Please add at least one specialized service for stylists'); return; }
    setSaving(true);
    try {
      // If editingUser is present, update Firestore doc instead of creating a new auth user
      if (editingUser) {
        const uRef = doc(db, 'users', editingUser.id || editingUser.uid || editingUser.authUid || editingUser.docId);
        const before = { ...editingUser };
        const payload = {
          name: sanitizeName(name),
          email: email.trim(),
          role,
        };
        if (role === 'stylist') {
          payload.branchName = branchName;
          payload.yearsOfExperience = Number(yearsOfExperience);
          payload.specializedServices = specializedServices.map(s => ({ id: s.id, name: s.name }));
        } else {
          payload.branchName = '';
          payload.yearsOfExperience = null;
          payload.specializedServices = [];
        }
        try {
          await updateDoc(uRef, payload);
          try { await logHistory({ action: 'update', collection: 'users', docId: editingUser.id || editingUser.uid, before, after: payload }); } catch (hx) { console.warn('history logger failed', hx); }
          reset();
          onClose && onClose();
        } catch (updErr) {
          console.error('Failed to update users doc', updErr);
          alert('Failed to update user: ' + (updErr.message || updErr));
        } finally {
          setSaving(false);
        }
        return;
      }
      const createAuthUser = httpsCallable(functions, 'createAuthUser');
      // First create Auth user to get uid. Try server callable, fallback to client-side secondary app creation.
      let uid = null;
      try {
        const authResult = await createAuthUser({ email: email.trim(), password, name: sanitizeName(name), role, branchName });
        uid = authResult && authResult.data && authResult.data.uid;
      } catch (authErr) {
        // Callable may not be deployed (Artifact Registry / Blaze issue) or be restricted; fall back to client-side secondary app.
        console.warn('createAuthUser callable failed, falling back to client-side creation', authErr);
        try {
          const secondaryApp = initializeAppClient(firebaseConfig, 'secondary-' + Date.now());
          const secondaryAuth = getAuthClient(secondaryApp);
          const userCred = await createUserWithEmailAndPassword(secondaryAuth, email.trim(), password);
          uid = userCred.user && userCred.user.uid;
          // clean up secondary auth state
          try { await signOutClient(secondaryAuth); } catch (e) { /* ignore */ }
          try { await deleteAppClient(secondaryApp); } catch (e) { /* ignore */ }
        } catch (fbErr) {
          console.error('Fallback client-side auth creation failed', fbErr);
          // Handle common auth errors explicitly
          const code = fbErr && (fbErr.code || fbErr.code) ? fbErr.code : null;
          if (code === 'auth/email-already-in-use') {
            // The Authentication user already exists (created earlier via console or another flow).
            // We cannot obtain that user's UID from the client-side for security reasons.
            // Prompt the operator with clear next steps.
            alert(`This email is already registered in Authentication. To finish creating the user profile in Firestore, either:

- Use the Firebase Console to find the user and create a users/{uid} document manually, or
- Run an admin script (use a service account) to look up the UID by email and create the Firestore document.

If you want, I can add a small admin script to the repo that will create the users/{uid} doc for an existing auth user.`);
          } else {
            const msg = (fbErr && fbErr.message) ? fbErr.message : 'Failed creating auth user';
            alert(msg);
          }
          setSaving(false);
          return;
        }
      }
      if (!uid) {
        alert('Failed to obtain new user uid');
        setSaving(false);
        return;
      }
      // Build payload without undefined values (Firestore rejects undefined)
      const payload = {
        name: sanitizeName(name),
        email: email.trim(),
        role,
        createdAt: serverTimestamp(),
        authUid: uid,
        skipPasswordSetupEmail: true
      };
      if (role === 'stylist') {
        payload.branchName = branchName;
        payload.yearsOfExperience = Number(yearsOfExperience);
        payload.specializedServices = specializedServices.map(s => ({ id: s.id, name: s.name }));
      }
      try {
        await setDoc(doc(db, 'users', uid), payload);
      } catch (setErr) {
        console.error('Failed to write users doc', setErr);
        const msg = (setErr && (setErr.code || setErr.message)) ? (setErr.code || setErr.message) : JSON.stringify(setErr);
        alert('Failed to write users document: ' + msg);
        // Attempt to clean up created auth user if we created it client-side (best-effort)
        try {
          // If callable created the auth user, deletion should be handled server-side; otherwise attempt to remove via client secondary app is complex.
        } catch (cleanupErr) {
          console.warn('Failed cleanup after setDoc failure', cleanupErr);
        }
        setSaving(false);
        return;
      }
      try {
        await logHistory({ action: 'create', collection: 'users', docId: uid, before: null, after: payload });
      } catch (hx) { console.warn('Failed to write history for user create', hx); }
      reset();
      onClose && onClose();
    } catch (err) {
      console.error('Failed to add user', err);
      alert('Failed to add user: ' + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  const title = editingUser ? 'Edit User' : 'Add User';

  return (
    <div style={{ display: open ? 'block' : 'none' }}>
      <div style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.64)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
        <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="modal-form" style={{ background: 'var(--bg-surface, var(--surface))', color: 'var(--text-main)', padding: 20, borderRadius: 8, width: 'min(520px, 94%)', border: '1px solid var(--border-main)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
          <h3 style={{ marginTop: 0 }}>{title}</h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12 }}>Name</label>
              <input value={name} onChange={e => setName(e.target.value)} style={{ width: '80%', padding: 8, background: 'var(--bg-drawer)', border: '1px solid var(--border-main)', color: 'var(--text-main)' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12 }}>Email</label>
              <input value={email} onChange={e => setEmail(stripSpecialExceptEmail(e.target.value))} style={{ width: '80%', padding: 8, background: 'var(--bg-drawer)', border: '1px solid var(--border-main)', color: 'var(--text-main)' }} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12 }}>Role</label>
              <select value={role} onChange={e => setRole(e.target.value)} style={{ width: '80%', padding: 8, background: 'var(--bg-drawer)', border: '1px solid var(--border-main)', color: 'var(--text-main)' }}>
                <option value="stylist">Stylist</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            {role === 'stylist' ? (
              <div>
                <label style={{ display: 'block', fontSize: 12 }}>Branch</label>
                <select value={branchName} onChange={e => setBranchName(e.target.value)} style={{ width: '80%', padding: 8, background: 'var(--bg-drawer)', border: '1px solid var(--border-main)', color: 'var(--text-main)' }}>
                  <option value="">Select branch</option>
                  <option value="Vergara">Vergara</option>
                  <option value="Lawas">Lawas</option>
                  <option value="Lipa">Lipa</option>
                  <option value="Tanauan">Tanauan</option>
                </select>
              </div>
            ) : null}

            {!editingUser && (
              <div>
                <label style={{ display: 'block', fontSize: 12 }}>Password</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Min 6 characters"
                    style={{ width: 'calc(80% - 32px)', padding: 8, background: 'var(--bg-drawer)', border: '1px solid var(--border-main)', color: 'var(--text-main)' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    title={showPassword ? 'Hide password' : 'Show password'}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    {showPassword ? (
                      // eye-off / closed eye
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3 3L21 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M10.58 10.58a3 3 0 0 0 4.24 4.24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M9.88 5.08C11.04 5 12.37 5 14 6c2 1.2 3.5 3.3 4.1 4.9-.6 1.6-1.8 3.3-3.4 4.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M2 12s3.5-5.5 10-6c1.3-.2 2.8 0 4 .5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    ) : (
                      // eye / open eye
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            )}

            {role === 'stylist' ? (
              <div>
                <label style={{ display: 'block', fontSize: 12 }}>Years of Experience</label>
                <input type="number" value={yearsOfExperience} onChange={e => setYearsOfExperience(e.target.value)} placeholder="e.g. 5" style={{ width: '80%', padding: 8, background: 'var(--bg-drawer)', border: '1px solid var(--border-main)', color: 'var(--text-main)' }} />
              </div>
            ) : null}
          </div>

          {role === 'stylist' ? (
            <div style={{ marginTop: 16 }}>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 8 }}>Specialized Services</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <select value={selectedServiceToAdd} onChange={e => setSelectedServiceToAdd(e.target.value)} style={{ flex: 1, padding: 8, background: 'var(--surface)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }}>
                  <option value="">Select service to add</option>
                  {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <button type="button" onClick={handleAddService} style={{ padding: '8px 12px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 4 }}>Add</button>
              </div>
              <div style={{ border: '1px solid var(--border-main)', padding: 8, minHeight: 50, background: 'var(--surface)' }}>
                {specializedServices.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>No services added yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {specializedServices.map(s => (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--accent)', color: 'white', padding: '4px 8px', borderRadius: 4 }}>
                        <span>{s.name}</span>
                        <button type="button" onClick={() => handleRemoveService(s.id)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', fontSize: 12 }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}

          <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
            <button type="button" onClick={() => { reset(); onClose && onClose(); }} disabled={saving} style={{ padding: '8px 12px' }}>Cancel</button>
            <button type="submit" disabled={saving} className="button-gold-dark" style={{ padding: '8px 12px' }}>{saving ? 'Adding...' : 'Add User'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddUserModal;
