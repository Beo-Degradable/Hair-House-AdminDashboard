import React, { useContext, useEffect, useMemo, useState } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { db } from '../../firebase';
import { doc, getDoc, updateDoc, serverTimestamp, addDoc, collection } from 'firebase/firestore';
import { getAuth, EmailAuthProvider, reauthenticateWithCredential, updatePassword, verifyBeforeUpdateEmail, sendPasswordResetEmail } from 'firebase/auth';

// Convert image file -> base64 payload for inline avatar storage
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const dataUrl = reader.result; // data:image/...;base64,XXXX
      const [meta, b64] = String(dataUrl).split(',');
      const mimeMatch = /^data:(.*?);base64$/i.exec(meta || '');
      resolve({ base64: b64 || '', mimeType: (mimeMatch && mimeMatch[1]) || (file.type || 'application/octet-stream') });
    };
    reader.readAsDataURL(file);
  });
}

// Component: Manage stylist avatar + email & password changes using Firebase built-in flows
export default function StylistAccountPage() {
  const { user } = useContext(AuthContext);
  const auth = getAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showEmailBox, setShowEmailBox] = useState(false);
  const [showPasswordBox, setShowPasswordBox] = useState(false);

  // Display fields
  const name = useMemo(() => (profile?.displayName || profile?.name || user?.displayName || user?.email || 'Stylist'), [profile, user]);
  const email = useMemo(() => (user?.email || profile?.email || ''), [user?.email, profile]);
  const avatar = profile?.avatar; // { base64, mimeType }

  // Email change state
  const [newEmail, setNewEmail] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailMsg, setEmailMsg] = useState('');

  // Password change state
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');
  const [currentPw, setCurrentPw] = useState('');
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState('');

  // Load Firestore profile document once user is available
  useEffect(() => {
    (async () => {
      if (!user?.uid) { setLoading(false); return; }
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) setProfile(snap.data());
      } catch (e) {
        setError('Failed to load account');
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.uid]);

  const initials = (name || '')
    .split(/\s+/)
    .filter(Boolean)
    .map(s => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  // Append an audit entry to users/<uid>/accountChanges
  const logAccountChange = async (action, details = {}) => {
    if (!user?.uid) return;
    try {
      await addDoc(collection(db, 'users', user.uid, 'accountChanges'), {
        action,
        details,
        at: serverTimestamp(),
      });
    } catch (_) {}
  };

  // Handle avatar upload and persistence in Firestore
  const saveAvatar = async (file) => {
    if (!file || !user?.uid) return;
    try {
      const { base64, mimeType } = await fileToBase64(file);
      await updateDoc(doc(db, 'users', user.uid), {
        avatar: { base64, mimeType },
        updatedAt: serverTimestamp(),
      });
      setProfile(p => ({ ...(p || {}), avatar: { base64, mimeType } }));
      await logAccountChange('updateAvatar', { mimeType, size: file.size || null });
    } catch (e) {
      setError('Failed to upload avatar');
    }
  };

  // Send email verification link for pending email change
  const sendEmailVerificationLink = async () => {
    if (!user?.uid) return;
    if (!newEmail) { setEmailMsg('Enter new email'); return; }
    setSavingEmail(true);
    setEmailMsg('');
    try {
      // Sends a verification link to the new email. After the user clicks the link, their email is updated.
      await verifyBeforeUpdateEmail(auth.currentUser, newEmail);
      await logAccountChange('requestEmailChange', { from: email, to: newEmail });
      setEmailMsg('We sent a verification link to the new email. Open it to confirm and finish the change.');
    } catch (e) {
      setEmailMsg(e?.message || 'Failed to send verification link');
    } finally {
      setSavingEmail(false);
    }
  };

  // Reauthenticate with current password then update to new password
  const reauthAndUpdatePassword = async () => {
    if (!user?.uid) return;
    if (!newPw || newPw.length < 6 || newPw !== newPw2) { setPwMsg('Passwords must match and be at least 6 characters'); return; }
    if (!currentPw) { setPwMsg('Enter your current password to continue'); return; }
    setSavingPw(true);
    setPwMsg('');
    try {
      const cred = EmailAuthProvider.credential(email, currentPw);
      await reauthenticateWithCredential(auth.currentUser, cred);
      await updatePassword(auth.currentUser, newPw);
      await logAccountChange('updatePassword', { length: newPw.length });
      setPwMsg('Password updated successfully');
      setNewPw(''); setNewPw2(''); setCurrentPw('');
    } catch (e) {
      setPwMsg(e?.message || 'Reauthentication failed or password update error');
    } finally {
      setSavingPw(false);
    }
  };

  // Trigger Firebase password reset email
  const sendResetEmail = async () => {
    if (!email) { setPwMsg('No email found on account'); return; }
    setPwMsg('');
    try {
      await sendPasswordResetEmail(auth, email);
      setPwMsg('Password reset email sent. Check your inbox.');
    } catch (e) {
      setPwMsg(e?.message || 'Failed to send password reset email');
    }
  };

  if (loading) return <div style={{ padding: 16 }}>Loading…</div>;

  return (
    <div style={{ padding: 16, maxWidth: 820, margin: '0 auto', color: 'var(--text-main)' }}>
      <h2 style={{ marginTop: 0 }}>My Account</h2>

      {/* Header card */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', background: 'var(--bg-drawer)', border: '1px solid var(--border-main)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
        <div style={{ width: 72, height: 72, borderRadius: 999, background: 'var(--border-main)', color: 'var(--text-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, overflow: 'hidden' }}>
          {avatar?.base64 ? (
            <img src={`data:${avatar.mimeType};base64,${avatar.base64}`} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span>{initials || 'ST'}</span>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-main)' }}>{name}</div>
          <div style={{ color: 'var(--icon-main)' }}>{email}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { setShowEmailBox(v => !v); setShowPasswordBox(false); }} className="btn" style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-main)', background: 'var(--btn-bg,none)', cursor: 'pointer', color: 'var(--text-main)' }}>Change Email</button>
          <button onClick={() => { setShowPasswordBox(v => !v); setShowEmailBox(false); }} className="btn" style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-main)', background: 'var(--btn-bg,none)', cursor: 'pointer', color: 'var(--text-main)' }}>Change Password</button>
          <label style={{ display: 'inline-flex', alignItems: 'center' }}>
            <input type="file" accept="image/*" onChange={async (e) => { const f = e.target.files?.[0]; if (f) await saveAvatar(f); e.target.value=''; }} style={{ display: 'none' }} />
            <span role="button" tabIndex={0} style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-main)', background: 'var(--btn-bg,none)', cursor: 'pointer', color: 'var(--text-main)' }}>Upload Avatar</span>
          </label>
        </div>
      </div>

      {/* Change Email Box */}
      {showEmailBox && (
        <div style={{ background: 'var(--bg-drawer)', border: '1px solid var(--border-main)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <h3 style={{ margin: '0 0 8px' }}>Change Email</h3>
          <div style={{ display: 'grid', gap: 8 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>New Email</label>
              <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="name@example.com" type="email" style={{ padding: 8, borderRadius: 6, border: '1px solid var(--border-main)', width: 320, background: 'var(--bg-main)' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button disabled={savingEmail} onClick={sendEmailVerificationLink} className="btn" style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-main)', background: 'var(--text-main)', color: 'white', cursor: 'pointer' }}>{savingEmail ? 'Sending…' : 'Send verification link'}</button>
              {emailMsg && <span style={{ color: 'var(--icon-main)' }}>{emailMsg}</span>}
            </div>
            <div style={{ color: 'var(--icon-main)', fontSize: 12 }}>After clicking the link in your inbox, your sign-in email will be updated.</div>
          </div>
        </div>
      )}

      {/* Change Password Box */}
      {showPasswordBox && (
        <div style={{ background: 'var(--bg-drawer)', border: '1px solid var(--border-main)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <h3 style={{ margin: '0 0 8px' }}>Change Password</h3>
          <div style={{ display: 'grid', gap: 8 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Current Password</label>
              <input value={currentPw} onChange={e => setCurrentPw(e.target.value)} placeholder="Current password" type="password" style={{ padding: 8, borderRadius: 6, border: '1px solid var(--border-main)', width: 320, background: 'var(--bg-main)' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>New Password</label>
              <input value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="New password" type="password" style={{ padding: 8, borderRadius: 6, border: '1px solid var(--border-main)', width: 320, background: 'var(--bg-main)', marginBottom: 6 }} />
              <input value={newPw2} onChange={e => setNewPw2(e.target.value)} placeholder="Re-enter password" type="password" style={{ padding: 8, borderRadius: 6, border: '1px solid var(--border-main)', width: 320, background: 'var(--bg-main)' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button disabled={savingPw} onClick={reauthAndUpdatePassword} className="btn" style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-main)', background: 'var(--text-main)', color: 'white', cursor: 'pointer' }}>{savingPw ? 'Saving…' : 'Update Password'}</button>
              <button onClick={sendResetEmail} className="btn" style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-main)', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer' }}>Forgot password? Email me a reset link</button>
              {pwMsg && <span style={{ color: 'var(--icon-main)' }}>{pwMsg}</span>}
            </div>
          </div>
        </div>
      )}

      {error && <div style={{ color: 'var(--danger,#d32f2f)' }}>{error}</div>}
    </div>
  );
}
