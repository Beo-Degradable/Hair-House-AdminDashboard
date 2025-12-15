import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';

const emptyForm = { name: '', phone: '', type: 'maya' };

const PaymentProfilesPage = () => {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    const col = collection(db, 'profiles');
    const q = query(col, orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setProfiles(list);
      setLoading(false);
    }, err => {
      console.error('profiles listener error', err);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const openAdd = () => { setForm(emptyForm); setEditingId(null); setShowAdd(true); };

  const submit = async (e) => {
    e && e.preventDefault && e.preventDefault();
    try {
      const clean = {
        name: (form.name || '').trim(),
        phone: (form.phone || '').trim(),
        type: (form.type || 'maya').trim().toLowerCase(),
      };
      if (!clean.name) return alert('Please enter a name for the profile');

      if (editingId) {
        const ref = doc(db, 'profiles', editingId);
        await updateDoc(ref, { ...clean, updatedAt: serverTimestamp() });
        setEditingId(null);
        setShowAdd(false);
        return;
      }

      await addDoc(collection(db, 'profiles'), { ...clean, createdAt: serverTimestamp() });
      setShowAdd(false);
    } catch (err) {
      console.error('Failed to save profile', err);
      alert('Failed to save profile: ' + (err.message || err));
    }
  };

  const startEdit = (p) => {
    setForm({ name: p.name || '', phone: p.phone || '', type: p.type || 'maya' });
    setEditingId(p.id);
    setShowAdd(true);
  };

  const remove = async (id) => {
    if (!id) return;
    const ok = window.confirm('Delete this payment profile? This cannot be undone.');
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'profiles', id));
    } catch (err) {
      console.error('Failed to delete profile', err);
      alert('Failed to delete profile: ' + (err.message || err));
    }
  };

  return (
    <div style={{ padding: '8px 16px 24px' }}>
      {/* Containered layout: profiles sit inside a bordered card with header + Add button */}
      <div style={{ border: '1px solid var(--border-main)', borderRadius: 8, padding: 12, background: 'transparent' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}>Payment Profiles</h3>
          <div>
            <button onClick={openAdd} className="button-gold-dark" style={{ padding: '8px 14px', borderRadius: 8 }}>Add Profile</button>
          </div>
        </div>

        {loading ? <div style={{ marginTop: 6 }}>Loading…</div> : null}

        <div style={{ marginTop: 6, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {profiles.map(p => (
            <div key={p.id} style={{ border: '1px solid var(--border-main)', borderRadius: 8, padding: 12, background: 'var(--bg-drawer)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{p.name || 'Unnamed'}</div>
                  <div style={{ fontSize: 13, color: 'var(--muted)' }}>{p.phone || ''}</div>
                  <div style={{ marginTop: 8 }}><strong>Type:</strong> {(p.type || '').toUpperCase()}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button onClick={() => startEdit(p)} className="btn" style={{ padding: '6px 8px' }}>Update</button>
                  <button onClick={() => remove(p.id)} className="btn btn-danger" style={{ padding: '6px 8px' }}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div onClick={() => setShowAdd(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)' }} />
          <form onSubmit={submit} style={{ background: 'var(--bg-main)', padding: 18, borderRadius: 10, width: 520, maxWidth: '94%', boxShadow: '0 8px 40px rgba(0,0,0,0.35)', position: 'relative' }}>
            <h3 style={{ marginTop: 0 }}>{editingId ? 'Update Profile' : 'Add Profile'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 13 }}>Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Profile name" style={{ padding: 8, borderRadius: 6, border: '1px solid var(--border-main)' }} />
              <label style={{ fontSize: 13 }}>Phone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone number" style={{ padding: 8, borderRadius: 6, border: '1px solid var(--border-main)' }} />
              <label style={{ fontSize: 13 }}>Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} style={{ padding: 8, borderRadius: 6, border: '1px solid var(--border-main)' }}>
                <option value="maya">Maya</option>
                <option value="gcash">GCash</option>
                <option value="card">Card</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
              <button type="button" onClick={() => { setShowAdd(false); setEditingId(null); }} className="btn" style={{ padding: '8px 12px' }}>Cancel</button>
              <button type="submit" className="button-gold-dark" style={{ padding: '8px 12px', borderRadius: 8 }}>{editingId ? 'Save' : 'Add'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default PaymentProfilesPage;
