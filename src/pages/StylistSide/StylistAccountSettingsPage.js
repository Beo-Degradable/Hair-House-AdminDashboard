import React, { useContext, useState } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { updatePassword, updateEmail } from 'firebase/auth';
import { getAuth } from 'firebase/auth';

// StylistAccountSettingsPage (legacy) — superseded by unified StylistAccountPage.
// Keep temporarily for backward route compatibility; remove after link audit.
export default function StylistAccountSettingsPage() {
  const { user } = useContext(AuthContext);
  const auth = getAuth();
  const [email, setEmail] = useState(user?.email || '');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [errorEmail, setErrorEmail] = useState('');
  const [errorPw, setErrorPw] = useState('');
  const [doneEmail, setDoneEmail] = useState('');
  const [donePw, setDonePw] = useState('');

  const saveEmail = async () => {
    if (!auth.currentUser) return;
    setSavingEmail(true);
    setErrorEmail('');
    setDoneEmail('');
    try {
      if (!email) throw new Error('Email required');
      await updateEmail(auth.currentUser, email);
      setDoneEmail('Email updated');
      setTimeout(() => setDoneEmail(''), 3000);
    } catch (e) {
      setErrorEmail(e.message || 'Failed to update email');
    } finally {
      setSavingEmail(false);
    }
  };

  const savePassword = async () => {
    if (!auth.currentUser) return;
    setSavingPw(true);
    setErrorPw('');
    setDonePw('');
    try {
      if (!pw || pw.length < 6) throw new Error('Min 6 characters');
      if (pw !== pw2) throw new Error('Passwords do not match');
      await updatePassword(auth.currentUser, pw);
      setDonePw('Password updated');
      setPw('');
      setPw2('');
      setTimeout(() => setDonePw(''), 3000);
    } catch (e) {
      setErrorPw(e.message || 'Failed to update password');
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <div style={{ padding: 16, maxWidth: 560, margin: '0 auto' }}>
      <h2 style={{ marginTop: 0 }}>Account Settings</h2>
      <div style={{ display: 'grid', gap: 24 }}>
        <section>
          <h3 style={{ margin: '0 0 8px' }}>Email</h3>
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" type="email" style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border-main,#ddd)', background: 'var(--bg-drawer)' }} />
          <div style={{ marginTop: 8, display: 'flex', gap: 12 }}>
            <button onClick={saveEmail} disabled={savingEmail} style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid var(--border-main,#ddd)', background: 'var(--text-main,#222)', color: 'white', cursor: 'pointer' }}>{savingEmail ? 'Saving…' : 'Save Email'}</button>
            {errorEmail && <div style={{ color: 'var(--danger,#d32f2f)', fontSize: 12 }}>{errorEmail}</div>}
            {doneEmail && <div style={{ color: 'var(--success,#2e7d32)', fontSize: 12 }}>{doneEmail}</div>}
          </div>
        </section>
        <section>
          <h3 style={{ margin: '0 0 8px' }}>Change Password</h3>
          <input value={pw} onChange={e => setPw(e.target.value)} placeholder="New password" type="password" style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border-main,#ddd)', background: 'var(--bg-drawer)', marginBottom: 8 }} />
          <input value={pw2} onChange={e => setPw2(e.target.value)} placeholder="Confirm password" type="password" style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border-main,#ddd)', background: 'var(--bg-drawer)' }} />
          <div style={{ marginTop: 8, display: 'flex', gap: 12 }}>
            <button onClick={savePassword} disabled={savingPw} style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid var(--border-main,#ddd)', background: 'var(--text-main,#222)', color: 'white', cursor: 'pointer' }}>{savingPw ? 'Saving…' : 'Update Password'}</button>
            {errorPw && <div style={{ color: 'var(--danger,#d32f2f)', fontSize: 12 }}>{errorPw}</div>}
            {donePw && <div style={{ color: 'var(--success,#2e7d32)', fontSize: 12 }}>{donePw}</div>}
          </div>
          <p style={{ fontSize: 11, color: 'var(--icon-main,#444)', marginTop: 8 }}>Security note: For production, enforce recent re-auth before sensitive changes.</p>
        </section>
      </div>
    </div>
  );
}
