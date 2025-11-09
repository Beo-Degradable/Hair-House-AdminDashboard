import React, { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { db } from '../../firebase';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

// StylistProfilePage — update basic stylist fields (display name, phone, branch readonly)
// Avatar & richer account changes live in StylistAccountPage.
export default function StylistProfilePage() {
  const { user } = useContext(AuthContext);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ displayName: '', phone: '' });
  const [error, setError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');

  useEffect(() => {
    async function load() {
      if (!user?.uid) { setLoading(false); return; }
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
          const data = snap.data();
          setProfile(data);
          setForm({
            displayName: data.displayName || data.name || '',
            phone: data.phone || data.mobile || ''
          });
        }
      } catch (e) {
        setError('Failed to load profile');
        console.warn(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user?.uid]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };

  const onSave = async () => {
    if (!user?.uid) return;
    setSaving(true);
    setError('');
    setSavedMessage('');
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: form.displayName || null,
        phone: form.phone || null,
        updatedAt: serverTimestamp(),
      });
      setSavedMessage('Saved');
      setTimeout(() => setSavedMessage(''), 3000);
    } catch (e) {
      setError('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: 16 }}>Loading profile…</div>;

  return (
    <div style={{ padding: 16, maxWidth: 560, margin: '0 auto' }}>
  <h2 style={{ marginTop: 0 }}>Profile</h2>
      {error && <div style={{ color: 'var(--danger,#d32f2f)', marginBottom: 12 }}>{error}</div>}
      <div style={{ display: 'grid', gap: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Email</label>
          <div style={{ padding: 8, border: '1px solid var(--border-main,#ddd)', borderRadius: 6, background: 'var(--bg-drawer,#fff)' }}>{user?.email || '—'}</div>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Display name</label>
          <input name="displayName" value={form.displayName} onChange={onChange} placeholder="Display name" style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border-main,#ddd)', background: 'var(--bg-drawer,#fff)' }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Phone</label>
          <input name="phone" value={form.phone} onChange={onChange} placeholder="Phone" style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border-main,#ddd)', background: 'var(--bg-drawer,#fff)' }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Branch</label>
          <div style={{ padding: 8, border: '1px solid var(--border-main,#ddd)', borderRadius: 6, background: 'var(--bg-drawer,#fff)' }}>{profile?.branchName || profile?.branch || '—'}</div>
        </div>
      </div>
      <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
        <button onClick={onSave} disabled={saving} style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid var(--border-main,#ddd)', background: 'var(--text-main,#222)', color: 'white', cursor: 'pointer' }}>{saving ? 'Saving…' : 'Save'}</button>
        {savedMessage && <div style={{ alignSelf: 'center', color: 'var(--success,#2e7d32)', fontSize: 12 }}>{savedMessage}</div>}
      </div>
    </div>
  );
}
