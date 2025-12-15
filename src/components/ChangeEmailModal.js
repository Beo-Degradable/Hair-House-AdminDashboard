import React, { useState } from 'react';

const ChangeEmailModal = ({ open, onClose, onSubmit }) => {
  const [newEmail, setNewEmail] = useState('');
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', zIndex: 9999 }}>
      <div style={{ width: 420, background: 'var(--bg-main)', padding: 16, borderRadius: 8 }}>
        <h3>Change email</h3>
        <p>Enter the new email address you want to use for your account.</p>
        <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="new.email@example.com" style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border-main)' }} />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <button onClick={onClose} style={{ padding: '8px 12px', borderRadius: 6 }}>Cancel</button>
          <button onClick={() => onSubmit(newEmail)} style={{ padding: '8px 12px', borderRadius: 6, background: 'var(--gold)', border: 'none' }}>Update</button>
        </div>
      </div>
    </div>
  );
};

export default ChangeEmailModal;
