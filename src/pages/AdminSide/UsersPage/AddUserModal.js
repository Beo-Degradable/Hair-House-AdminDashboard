// AddUserModal: create user (admin/stylist) with basic validation + history log.
import React, { useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '../../../firebase';
import { isValidName, isValidEmail, isValidPassword, sanitizeName, stripSpecialExceptEmail } from '../../../utils/validators';
import { logHistory } from '../../../utils/historyLogger';

const AddUserModal = ({ open, onClose }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('stylist');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [branchName, setBranchName] = useState('');
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const reset = () => { setName(''); setEmail(''); setPassword(''); setShowPassword(false); setRole('stylist'); setBranchName(''); };

  const handleSave = async () => {
    // Validation
    if (!name || !email || !role) { alert('Please fill name, email and role'); return; }
    if (!isValidName(name)) { alert('Name should only contain letters, spaces, hyphen or apostrophe'); return; }
    if (!isValidEmail(email)) { alert('Please enter a valid email address'); return; }
    if (!password || !isValidPassword(password)) { alert('Please provide a password of at least 6 characters'); return; }
    if (role === 'stylist' && !branchName) { alert('Please select a branch for stylists'); return; }
    setSaving(true);
    try {
      const payload = { name: sanitizeName(name), email: email.trim(), role, password };
      if (role === 'stylist') payload.branchName = branchName;
      const ref = await addDoc(collection(db, 'users'), payload);
      // History log
      try {
        await logHistory({ action: 'create', collection: 'users', docId: ref.id, before: null, after: payload });
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

  return (
    <div style={{ display: open ? 'block' : 'none' }}>
      <div style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.64)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
        <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="modal-form" style={{ background: 'var(--surface, #232323)', color: 'var(--text-primary, #fff)', padding: 20, borderRadius: 8, width: 'min(520px, 94%)', border: '1px solid var(--border-main)', boxShadow: '0 8px 24px rgba(0,0,0,0.6)' }}>
          <h3 style={{ marginTop: 0 }}>Add User</h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12 }}>Name</label>
              <input value={name} onChange={e => setName(sanitizeName(e.target.value))} style={{ width: '80%', padding: 8, background: 'var(--surface)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12 }}>Email</label>
              <input value={email} onChange={e => setEmail(stripSpecialExceptEmail(e.target.value))} style={{ width: '80%', padding: 8, background: 'var(--surface)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12 }}>Password</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Min 6 characters"
                  style={{ width: 'calc(80% - 32px)', padding: 8, background: 'var(--surface)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }}
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

            <div>
              <label style={{ display: 'block', fontSize: 12 }}>Role</label>
              <select value={role} onChange={e => setRole(e.target.value)} style={{ width: '80%', padding: 8, background: 'var(--surface)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }}>
                <option value="stylist">Stylist</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            {role === 'stylist' ? (
              <div>
                <label style={{ display: 'block', fontSize: 12 }}>Branch</label>
                <select value={branchName} onChange={e => setBranchName(e.target.value)} style={{ width: '80%', padding: 8, background: 'var(--surface)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }}>
                  <option value="">Select branch</option>
                  <option value="Vergara">Vergara</option>
                  <option value="Lawas">Lawas</option>
                  <option value="Lipa">Lipa</option>
                  <option value="Tanauan">Tanauan</option>
                </select>
              </div>
            ) : null}
          </div>

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
