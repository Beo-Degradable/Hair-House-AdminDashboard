import React, { useContext, useEffect, useMemo, useState } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { db } from '../../firebase';
import { doc, getDoc, serverTimestamp, addDoc, collection } from 'firebase/firestore';
import { getAuth, EmailAuthProvider, reauthenticateWithCredential, updatePassword, verifyBeforeUpdateEmail, sendPasswordResetEmail } from 'firebase/auth';
import useMediaQuery from '../../hooks/useMediaQuery';

// Build a display name from email when profile/displayName is missing
function nameFromEmail(em) {
  if (!em) return '';
  const local = String(em).split('@')[0] || '';
  return local
    .replace(/[._-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(w => (w[0] ? w[0].toUpperCase() + w.slice(1) : ''))
    .join(' ');
}

// Component: Manage stylist email & password changes using Firebase built-in flows (avatar upload removed per spec)
export default function StylistAccountPage() {
  const { user } = useContext(AuthContext);
  const auth = getAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showEmailBox, setShowEmailBox] = useState(false);
  const [showPasswordBox, setShowPasswordBox] = useState(false);

  // Display fields
  const email = useMemo(() => (user?.email || profile?.email || ''), [user?.email, profile]);
  const rawName = useMemo(() => (profile?.displayName || profile?.name || user?.displayName || ''), [profile, user]);
  const name = useMemo(() => {
    const rn = String(rawName || '').trim();
    const em = String(email || '').trim();
    if (!rn || rn.toLowerCase() === em.toLowerCase()) {
      return nameFromEmail(em) || 'Stylist';
    }
    return rn;
  }, [rawName, email]);
  // Avatar upload functionality removed per request; we display initials only.

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

  // Wide layout breakpoint (desktop)
  const isWide = useMediaQuery('(min-width: 900px)');

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
      showSnack('Password reset email sent. Check your inbox.', 'success');
    } catch (e) {
      setPwMsg(e?.message || 'Failed to send password reset email');
      showSnack(e?.message || 'Failed to send password reset email', 'error');
    }
  };

  // Mobile behavior: send reset email for both Change Email and Change Password buttons
  const sendResetForMobile = async () => {
    if (!email) { setEmailMsg('No email found on account'); setPwMsg('No email found on account'); return; }
    setEmailMsg(''); setPwMsg('');
    try {
      await sendPasswordResetEmail(auth, email);
      const msg = 'Password reset email sent. Check your inbox.';
      setPwMsg(msg);
      setEmailMsg(msg);
      await logAccountChange('sendResetEmail', { to: email });
      showSnack(msg, 'success');
    } catch (e) {
      const m = e?.message || 'Failed to send password reset email';
      setPwMsg(m);
      setEmailMsg(m);
      showSnack(m, 'error');
    }
  };

  // Snackbar for lightweight user feedback
  const [snack, setSnack] = useState({ open: false, message: '', type: 'info' });
  const showSnack = (message, type = 'info', timeout = 4000) => {
    setSnack({ open: true, message, type });
    setTimeout(() => setSnack({ open: false, message: '', type }), timeout);
  };

  if (loading) return <div style={{ padding: 16 }}>Loading…</div>;

  return (
    <div style={{ padding: 16, maxWidth: 820, margin: '0 auto', color: 'var(--text-main)' }}>
      <h2 style={{ marginTop: 0 }}>My Account</h2>

      {/* Header card */}
      <ResponsiveHeader
        name={name}
        email={email}
        initials={initials}
        showButtons={!isWide}
        onToggleEmail={() => {
          if (!isWide) return sendResetForMobile();
          setShowEmailBox(v => !v); setShowPasswordBox(false);
        }}
        onTogglePassword={() => {
          if (!isWide) return sendResetForMobile();
          setShowPasswordBox(v => !v); setShowEmailBox(false);
        }}
      />

      {/* Info + actions card for wide screens (Account ID removed) */}
      {isWide && (
        <div style={{ background: 'var(--bg-drawer)', border: '1px solid var(--border-main)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(160px, 1fr))', gap: 12 }}>
            <InfoRow label="Created" value={auth?.currentUser?.metadata?.creationTime || '—'} />
            <InfoRow label="Last sign-in" value={auth?.currentUser?.metadata?.lastSignInTime || '—'} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <button onClick={() => { setShowEmailBox(v => !v); setShowPasswordBox(false); }} className="btn" style={{ padding: '6px 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border-main)', background: 'var(--btn-bg,none)', cursor: 'pointer', color: 'var(--text-main)' }}>Change Email</button>
            <button onClick={() => { setShowPasswordBox(v => !v); setShowEmailBox(false); }} className="btn" style={{ padding: '6px 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border-main)', background: 'var(--btn-bg,none)', cursor: 'pointer', color: 'var(--text-main)' }}>Change Password</button>
          </div>
        </div>
      )}

      {/* Change Email Box */}
      {showEmailBox && (
        <div style={{ background: 'var(--bg-drawer)', border: '1px solid var(--border-main)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <h3 style={{ margin: '0 0 8px' }}>Change Email</h3>
          <div style={{ display: 'grid', gap: 8 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>New Email</label>
              <ResponsiveInput value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="name@example.com" type="email" />
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
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
              <ResponsiveInput value={currentPw} onChange={e => setCurrentPw(e.target.value)} placeholder="Current password" type="password" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>New Password</label>
              <ResponsiveInput value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="New password" type="password" style={{ marginBottom: 6 }} />
              <ResponsiveInput value={newPw2} onChange={e => setNewPw2(e.target.value)} placeholder="Re-enter password" type="password" />
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
      {/* Snackbar */}
      {snack.open && (
        <div style={{ position: 'fixed', left: '50%', bottom: 24, transform: 'translateX(-50%)', zIndex: 20000 }}>
          <div style={{ minWidth: 240, maxWidth: '90vw', background: snack.type === 'error' ? '#b91c1c' : (snack.type === 'success' ? '#166534' : '#333'), color: '#fff', padding: '10px 16px', borderRadius: 8, boxShadow: '0 6px 24px rgba(0,0,0,0.4)', textAlign: 'center' }}>
            {snack.message}
          </div>
        </div>
      )}
    </div>
  );
}

// Responsive header section (avatar + name + actions) that stacks on narrow screens
function ResponsiveHeader({ name, email, initials, showButtons = true, onToggleEmail, onTogglePassword }) {
  const isNarrow = useMediaQuery('(max-width: 560px)');
  return (
    <div style={{ background: 'var(--bg-drawer)', border: '1px solid var(--border-main)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
      {/* Top row: avatar + name/email */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', overflow: 'hidden', background: 'var(--border-main)', flex: '0 0 72px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-main)', fontWeight: 800, fontSize: 20 }}>
          {initials || 'ST'}
        </div>
        <div style={{ minWidth: 0, flex: '1 1 auto' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-main)', lineHeight: 1.2, wordBreak: 'break-word' }}>{name}</div>
          <div style={{ color: 'var(--icon-main)', fontSize: 12, marginTop: 4, wordBreak: 'break-word' }}>{email}</div>
        </div>
      </div>

      {/* Buttons row below (mobile only) */}
      {showButtons && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
          <button onClick={onToggleEmail} className="btn" style={{ padding: '8px 12px', fontSize: 14, borderRadius: 6, border: '1px solid var(--border-main)', background: 'var(--btn-bg,none)', cursor: 'pointer', color: 'var(--text-main)', flex: '1 1 auto', minWidth: 140 }}>Change Email</button>
          <button onClick={onTogglePassword} className="btn" style={{ padding: '8px 12px', fontSize: 14, borderRadius: 6, border: '1px solid var(--border-main)', background: 'var(--btn-bg,none)', cursor: 'pointer', color: 'var(--text-main)', flex: '1 1 auto', minWidth: 140 }}>Change Password</button>
        </div>
      )}
    </div>
  );
}

// Input that uses full width on mobile, fixed comfortable width on larger screens
function ResponsiveInput(props) {
  const isNarrow = useMediaQuery('(max-width: 560px)');
  const { style, ...rest } = props;
  return (
    <input {...rest} style={{ padding: 8, borderRadius: 6, border: '1px solid var(--border-main)', width: isNarrow ? '100%' : 320, background: 'var(--bg-main)', ...(style || {}) }} />
  );
}

// Small labeled info item
function InfoRow({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--icon-main)' }}>{label}</div>
      <div style={{ fontSize: 12, color: 'var(--text-main)', marginTop: 2 }}>{value}</div>
    </div>
  );
}
