// Admin account settings: resolve display name from user doc/email, provide password change (reauth + update) and sign out.
import React, { useEffect, useState, useContext } from 'react';
import { auth, db } from '../../firebase';
import { onAuthStateChanged, EmailAuthProvider, reauthenticateWithCredential, updatePassword, sendPasswordResetEmail } from 'firebase/auth';
import { doc, onSnapshot, collection, query, where, limit } from 'firebase/firestore';
import { AuthContext } from '../../context/AuthContext';

const styles = {
  page: { padding: 24, maxWidth: 840, margin: '0 auto', color: '#ffd54f', fontFamily: 'Inter, sans-serif' },
  card: { background: '#1e1e1e', borderRadius: 10, padding: 16, border: '1px solid rgba(255,255,255,0.04)', marginBottom: 18 },
  headerRow: { display: 'flex', gap: 12, alignItems: 'center' },
  avatar: { width: 64, height: 64, borderRadius: '50%', background: '#444', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700 },
  buttons: { marginTop: 12, display: 'flex', gap: 8 },
  btn: { padding: '8px 12px', borderRadius: 6, border: 'none', cursor: 'pointer' },
  btnSecondary: { background: '#333', color: '#ddd' },
  btnDanger: { background: '#d32f2f', color: '#fff' },
  activityBox: { background: '#171717', borderRadius: 8, padding: 12, border: '1px solid rgba(255,255,255,0.03)' },
  activityItem: { background: 'rgba(255,255,255,0.02)', padding: 10, borderRadius: 8, marginBottom: 8 }
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
  const resolvedAvatarUrl = auth?.currentUser?.photoURL || null;

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

  return (
    <div style={styles.page}>
      <h1 style={{ marginBottom: 12 }}>Account Settings</h1>

      <div style={styles.card}>
        <div style={{ ...styles.headerRow, flexDirection: isNarrow ? 'column' : 'row', alignItems: isNarrow ? 'flex-start' : 'center' }}>
          <div aria-hidden>
            {resolvedAvatarUrl ? (
              <img src={resolvedAvatarUrl} alt={displayName || 'Profile'} onError={(e) => { e.currentTarget.style.display = 'none'; }} style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.04)' }} />
            ) : (
              <div style={styles.avatar} aria-hidden>{avatarInitial}</div>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700 }}>{displayName}</div>
            <div style={{ color: '#ddd', marginTop: 6 }}>{shortenEmail(email)}</div>
          </div>
        </div>

        <div style={{ ...styles.buttons, flexWrap: 'wrap' }}>
          <button style={{ ...styles.btn, ...styles.btnSecondary, width: isNarrow ? '100%' : 'auto' }} onClick={() => setChangeMode('password')}>Change password</button>
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
            <div style={{ fontWeight: 700, marginBottom: 8, color: '#ffd54f' }}>Recent activity</div>
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
              <div style={{ fontWeight: 800, fontSize: 16, lineHeight: 1.2 }}>{displayName}</div>
              <div style={{ color: '#ddd', marginTop: 4, fontSize: 12 }}>{shortenEmail(email)}</div>
            </div>
            <div style={{ display: 'grid', gap: 8, maxWidth: 520 }}>
              <label style={{ color: '#ddd' }}>Current password</label>
              <input
                type="password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                style={{ width: isNarrow ? '100%' : 320, padding: 8, borderRadius: 6, border: '1px solid #333', background: '#121212', color: '#eee' }}
              />
              <label style={{ color: '#ddd' }}>New password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={{ width: isNarrow ? '100%' : 320, padding: 8, borderRadius: 6, border: '1px solid #333', background: '#121212', color: '#eee' }}
              />
              <label style={{ color: '#ddd' }}>Confirm password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={{ width: isNarrow ? '100%' : 320, padding: 8, borderRadius: 6, border: '1px solid #333', background: '#121212', color: '#eee' }}
              />

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                <button
                  style={{ ...styles.btn, ...styles.btnSecondary, width: isNarrow ? '100%' : 'auto' }}
                  disabled={loading}
                  onClick={async () => {
                    setStatus('');
                    if (!currentPw) return setStatus('Enter current password');
                    if (!newPassword) return setStatus('Enter a new password');
                    if (newPassword !== confirmPassword) return setStatus('Passwords do not match');
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
                    try { await sendPasswordResetEmail(auth, email); setStatus('Reset email sent'); } catch (e) { setStatus(e?.message || 'Failed to send reset email'); }
                  }}
                >
                  Forgot password? Email reset link
                </button>
                <button style={{ ...styles.btn, width: isNarrow ? '100%' : 'auto' }} onClick={() => setChangeMode(null)}>Cancel</button>
              </div>
              {status && <div style={{ marginTop: 8, color: '#ffd54f' }}>{status}</div>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
