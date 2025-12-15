// Admin account settings: resolve display name from user doc/email, provide password change (reauth + update) and sign out.
import React, { useEffect, useState, useContext } from 'react';
import { auth, db } from '../../firebase';
import { onAuthStateChanged, EmailAuthProvider, reauthenticateWithCredential, updatePassword, sendPasswordResetEmail, GoogleAuthProvider, linkWithPopup, updateProfile } from 'firebase/auth';
import { doc, onSnapshot, collection, query, where, limit } from 'firebase/firestore';
import { AuthContext } from '../../context/AuthContext';

const styles = {
  // use CSS variables so theme (light/dark) controls colors
  page: { padding: 24, maxWidth: 840, margin: '0 auto', color: 'var(--text-main)', fontFamily: 'Inter, sans-serif' },
  card: { background: 'var(--bg-drawer, #1e1e1e)', borderRadius: 10, padding: 16, border: '1px solid var(--border-main, rgba(255,255,255,0.04))', marginBottom: 18 },
  headerRow: { display: 'flex', gap: 12, alignItems: 'center' },
  avatar: { width: 64, height: 64, borderRadius: '50%', background: '#444', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700 },
  buttons: { marginTop: 12, display: 'flex', gap: 8 },
  btn: { padding: '8px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', color: 'var(--btn-foreground)' },
  // make secondary actions clearly readable — use variables so light theme shows dark text
  btnSecondary: { background: 'transparent', border: '1px solid var(--border-main, rgba(0,0,0,0.06))', color: 'var(--text-main)' },
  btnDanger: { background: '#d32f2f', color: '#fff' },
  activityBox: { background: 'var(--bg-surface, #171717)', borderRadius: 8, padding: 12, border: '1px solid var(--border-main, rgba(255,255,255,0.03))' },
  activityItem: { background: 'var(--activity-item-bg, rgba(0,0,0,0.02))', padding: 10, borderRadius: 8, marginBottom: 8 }
};

// Component: Admin account data & password management
export default function AccountSettingsPage() {
  const { setRole } = useContext(AuthContext);
  const [displayName, setDisplayName] = useState('—');
  const [email, setEmail] = useState('');
  const [changeMode, setChangeMode] = useState(null); // null | 'password'
  const [currentPw, setCurrentPw] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);
  const [errors, setErrors] = useState({ currentPw: '', newPassword: '', confirmPassword: '', email: '' });
  const [snack, setSnack] = useState({ open: false, message: '', type: 'info' });
  const showSnack = (message, type = 'info', timeout = 4000) => {
    try {
      setSnack({ open: true, message, type });
      setTimeout(() => setSnack({ open: false, message: '', type }), timeout);
    } catch (e) {
      // noop
    }
  };

  const nameFromEmail = (em) => {
    if (!em) return '';
    const local = em.split('@')[0] || '';
    return local
      .replace(/[._]+/g, ' ')
      .split(' ')
      .filter(Boolean)
      .map((w) => w[0]?.toUpperCase() + w.slice(1))
      .join(' ');
  };

  useEffect(() => {
    let unsubUserDoc = null;
    let unsubQuery = null;
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      if (u) {
        setEmail(u.email || '');
        const userDocRef = doc(db, 'users', u.uid);
        unsubUserDoc = onSnapshot(userDocRef, (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            if (data.name && String(data.name).trim()) {
              setDisplayName(String(data.name).trim());
            } else {
              const name = data.displayName || u.displayName || '';
              setDisplayName(name || nameFromEmail(u.email) || '—');
            }
          } else {
            try {
              const q = query(collection(db, 'users'), where('email', '==', u.email || ''), limit(1));
              unsubQuery = onSnapshot(q, (qsnap) => {
                if (qsnap.docs.length > 0) {
                  const d = qsnap.docs[0].data();
                  if (d.name && String(d.name).trim()) setDisplayName(String(d.name).trim());
                  else setDisplayName(d.displayName || u.displayName || nameFromEmail(u.email) || '—');
                } else {
                  setDisplayName(u.displayName || nameFromEmail(u.email) || '—');
                }
              }, (err) => {
                console.warn('users query listen failed', err);
                setDisplayName(u.displayName || nameFromEmail(u.email) || '—');
              });
            } catch (e) {
              console.warn('users query failed', e);
              setDisplayName(u.displayName || nameFromEmail(u.email) || '—');
            }
          }
        }, (err) => {
          console.warn('users doc listen failed', err);
          setDisplayName(u.displayName || '—');
        });
      } else {
        setEmail('');
        setDisplayName('—');
      }
    });

    return () => {
      if (unsubUserDoc) unsubUserDoc();
      if (unsubQuery) unsubQuery();
      if (unsubAuth) unsubAuth();
    };
  }, []);

  const activities = [
    { id: 1, action: 'update', collection: 'users', timestamp: 'Sun Oct 19 2025 09:14:01 GMT+0800' },
    { id: 2, action: 'update', collection: 'users', timestamp: 'Sat Oct 18 2025 21:55:13 GMT+0800' }
  ];

  const avatarInitial = (displayName && displayName[0]) || 'A';
  // Prefer Google/provider photo, then auth photoURL
  const providerPhoto = auth?.currentUser?.providerData?.[0]?.photoURL || null;
  const resolvedAvatarUrl = auth?.currentUser?.photoURL || providerPhoto || null;
  const [avatarBroken, setAvatarBroken] = useState(false);
  useEffect(() => { setAvatarBroken(false); }, [resolvedAvatarUrl]);
  const hasGoogleProvider = !!(auth?.currentUser?.providerData || []).some(p => p?.providerId === 'google.com');

  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    const check = () => setIsNarrow(window.innerWidth < 560);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const shortenEmail = (em) => {
    if (!em) return '';
    if (!isNarrow) return em;
    const [local, domain] = em.split('@');
    if (!domain) return em;
    if (local.length <= 8) return em;
    const head = local.slice(0, 5);
    const tail = local.slice(-3);
    return `${head}...${tail}@${domain}`;
  };

  // Responsive form sizing (shorter on mobile, spaced on desktop)
  const formGap = isNarrow ? 10 : 14;
  const formMaxWidth = isNarrow ? '92%' : 680;
  const formStyle = { display: 'grid', gap: formGap, maxWidth: formMaxWidth };
  const inputStyle = { width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border-main)', background: 'var(--bg-surface, #fff)', color: 'var(--text-main)' };

  // validate inputs live
  useEffect(() => {
    const errs = { currentPw: '', newPassword: '', confirmPassword: '', email: '' };
    if (currentPw && currentPw.length < 1) errs.currentPw = 'Enter your current password';
    if (newPassword && newPassword.length > 0 && newPassword.length < 8) errs.newPassword = 'Password must be at least 8 characters';
    if (confirmPassword && newPassword !== confirmPassword) errs.confirmPassword = 'Passwords do not match';
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Invalid email address';
    setErrors(prev => ({ ...prev, ...errs }));
  }, [currentPw, newPassword, confirmPassword, email]);

  return (
    <div style={styles.page}>
      <h1 style={{ marginBottom: 12, color: 'var(--accent)' }}>Account Settings</h1>

      <div style={styles.card}>
        <div style={{ ...styles.headerRow, flexDirection: isNarrow ? 'column' : 'row', alignItems: isNarrow ? 'flex-start' : 'center' }}>
          <div aria-hidden>
            {!avatarBroken && resolvedAvatarUrl ? (
              <img
                src={resolvedAvatarUrl}
                alt={displayName || 'Profile'}
                onError={() => setAvatarBroken(true)}
                style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.04)' }}
              />
            ) : (
              <div style={styles.avatar} aria-hidden>{avatarInitial}</div>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{displayName}</div>
            <div style={{ color: 'var(--text-secondary)', marginTop: 6 }}>{shortenEmail(email)}</div>
          </div>
        </div>

        <div style={{ ...styles.buttons, flexWrap: 'wrap' }}>
          {!hasGoogleProvider && (
            <button
              style={{ ...styles.btn, ...styles.btnSecondary, width: isNarrow ? '100%' : 'auto' }}
              disabled={linking}
              onClick={async () => {
                setStatus('');
                setLinking(true);
                try {
                  const provider = new GoogleAuthProvider();
                  const result = await linkWithPopup(auth.currentUser, provider);
                  const newPhoto = result.user?.photoURL || result.user?.providerData?.[0]?.photoURL || null;
                  if (newPhoto) {
                    try { await updateProfile(auth.currentUser, { photoURL: newPhoto }); } catch {}
                    setStatus('Google linked. Photo updated.');
                  } else {
                    setStatus('Google linked. No photo found on provider.');
                  }
                } catch (e) {
                  console.error('Google link failed', e);
                  setStatus(e?.message || 'Failed to link Google account');
                } finally {
                  setLinking(false);
                }
              }}
            >
              {linking ? 'Linking…' : 'Use Google photo'}
            </button>
          )}

          <button
            style={{ ...styles.btn, ...styles.btnSecondary, width: isNarrow ? '100%' : 'auto' }}
            onClick={async () => {
              setStatus('');
              const emailErr = !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
              if (emailErr) { setErrors(prev => ({ ...prev, email: 'Invalid email address' })); setStatus('Enter a valid email to send reset'); return; }
              try {
                await sendPasswordResetEmail(auth, email);
                setStatus('Password reset email sent to ' + email);
                showSnack('Password reset email sent to ' + email, 'success');
              } catch (e) {
                console.error('sendPasswordResetEmail failed', e);
                setStatus(e?.message || 'Failed to send reset email');
                showSnack(e?.message || 'Failed to send reset email', 'error');
              }
            }}
          >
            Change password
          </button>

          <button
            style={{ ...styles.btn, ...styles.btnDanger, width: isNarrow ? '100%' : 'auto' }}
            onClick={async () => {
              try {
                await auth.signOut();
              } catch (e) {
                console.error('signOut failed', e);
              }
              // inform app-level role state so the login view is shown
              try { setRole(''); } catch (e) { /* noop if not available */ }
            }}
          >
            Sign out
          </button>
        </div>
      </div>

      <div style={styles.card}>
        {changeMode !== 'password' ? (
          <>
            <div style={{ fontWeight: 700, marginBottom: 8, color: 'var(--accent)' }}>Recent activity</div>
            <div style={styles.activityBox}>
              {activities.map((a) => (
                <div key={a.id} style={styles.activityItem}>
                  <div style={{ fontWeight: 700 }}>{a.action}</div>
                  <div style={{ color: '#ccc', marginTop: 6 }}>{a.collection} • {a.timestamp}</div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 16, lineHeight: 1.2, color: 'var(--text-main)' }}>{displayName}</div>
                <div style={{ color: 'var(--text-secondary)', marginTop: 4, fontSize: 12 }}>{shortenEmail(email)}</div>
            </div>
            <div style={formStyle}>
              <label style={{ color: 'var(--text-secondary)' }}>Current password</label>
              <input
                type="password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                style={inputStyle}
              />
              {errors.currentPw ? <div style={{ color: '#f87171', fontSize: 12 }}>{errors.currentPw}</div> : null}

              <label style={{ color: 'var(--text-secondary)' }}>New password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={inputStyle}
              />
              {errors.newPassword ? <div style={{ color: '#f87171', fontSize: 12 }}>{errors.newPassword}</div> : null}

              <label style={{ color: 'var(--text-secondary)' }}>Confirm password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={inputStyle}
              />
              {errors.confirmPassword ? <div style={{ color: '#f87171', fontSize: 12 }}>{errors.confirmPassword}</div> : null}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                <button
                  style={{ ...styles.btn, ...styles.btnSecondary, width: isNarrow ? '100%' : 'auto' }}
                  disabled={loading}
                  onClick={async () => {
                    setStatus('');
                    // run validation on submit as well
                    const errs = { currentPw: '', newPassword: '', confirmPassword: '' };
                    if (!currentPw) errs.currentPw = 'Enter current password';
                    if (!newPassword) errs.newPassword = 'Enter a new password';
                    else if (newPassword.length < 8) errs.newPassword = 'Password must be at least 8 characters';
                    if (newPassword !== confirmPassword) errs.confirmPassword = 'Passwords do not match';
                    setErrors(prev => ({ ...prev, ...errs }));
                    if (errs.currentPw || errs.newPassword || errs.confirmPassword) return setStatus('Fix validation errors');
                    setLoading(true);
                    try {
                      const cred = EmailAuthProvider.credential(email, currentPw);
                      await reauthenticateWithCredential(auth.currentUser, cred);
                      await updatePassword(auth.currentUser, newPassword);
                      setStatus('Password updated successfully');
                      setCurrentPw(''); setNewPassword(''); setConfirmPassword(''); setChangeMode(null);
                    } catch (e) {
                      console.error('password update error', e);
                      setStatus(e?.message || 'Failed to update password');
                    } finally { setLoading(false); }
                  }}
                >
                  {loading ? 'Saving…' : 'Update password'}
                </button>

                <button
                  style={{ ...styles.btn, ...styles.btnSecondary, width: isNarrow ? '100%' : 'auto' }}
                  onClick={async () => {
                    setStatus('');
                    try { await sendPasswordResetEmail(auth, email); setStatus('Reset email sent'); showSnack('Password reset email sent to ' + email, 'success'); } catch (e) { setStatus(e?.message || 'Failed to send reset email'); showSnack(e?.message || 'Failed to send reset email', 'error'); }
                  }}
                >
                  Forgot password? Email reset link
                </button>

                <button style={{ ...styles.btn, width: isNarrow ? '100%' : 'auto' }} onClick={() => setChangeMode(null)}>Cancel</button>
              </div>
                  {status && <div style={{ marginTop: 8, color: 'var(--accent)' }}>{status}</div>}
            </div>
          </>
        )}
      </div>

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
