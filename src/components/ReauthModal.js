import React, { useState } from 'react';
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { auth } from '../firebase';

const ReauthModal = ({ open, onClose, onSuccess }) => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const submit = async () => {
    setError('');
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user || !user.email) throw new Error('No authenticated user');
      const cred = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, cred);
      onSuccess && onSuccess();
      onClose && onClose();
    } catch (e) {
      console.error('reauth failed', e);
      setError('Reauthentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', zIndex: 9999 }}>
      <div style={{ width: 360, background: 'var(--bg-main)', padding: 16, borderRadius: 8, boxShadow: '0 6px 24px rgba(0,0,0,0.4)' }}>
        <h3>Confirm your password</h3>
        <p>Please enter your current password to confirm this action.</p>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border-main)' }} />
        {error && <div style={{ color: '#f44336', marginTop: 8 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 12px', borderRadius: 6 }}>Cancel</button>
          <button onClick={submit} disabled={loading} style={{ padding: '8px 12px', borderRadius: 6, background: 'var(--gold)', border: 'none' }}>{loading ? '...' : 'Confirm'}</button>
        </div>
      </div>
    </div>
  );
};

export default ReauthModal;
