// EditServiceModal: load service, adjust fields/duration/products, write update + history.
import React, { useState, useEffect } from 'react';
import { validateForm, sanitizeName, sanitizeForSearch } from '../../../utils/validators';
import { doc, updateDoc, getDoc, collection, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import DurationClock from '../../../components/DurationClock';
import { parseDurationToMinutes, formatMinutes } from '../../../utils/time';
import { getAuth } from 'firebase/auth';
import { db } from '../../../firebase';
import { logHistory } from '../../../utils/historyLogger';

const EditServiceModal = ({ open, id, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [localDurationMinutes, setLocalDurationMinutes] = useState(60);

  useEffect(() => {
    if (!open || !id) return;
    setLoading(true);
    const load = async () => {
      const d = await getDoc(doc(db, 'services', id));
      const loaded = d.exists() ? { id: d.id, ...d.data() } : null;
      if (loaded) {
        if (loaded.durationMinutes !== undefined && loaded.durationMinutes !== null) {
          setLocalDurationMinutes(Number(loaded.durationMinutes) || 60);
        } else if (loaded.duration) {
          setLocalDurationMinutes(parseDurationToMinutes(loaded.duration));
        }
      }
      setData(loaded);
      setLoading(false);
    };
    load();
  }, [open, id]);

  const [products, setProducts] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  useEffect(() => {
    const col = collection(db, 'products');
    const unsub = onSnapshot(col, snap => setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() }))), () => {});
    return () => unsub();
  }, []);

  if (!open) return null;

  const onChange = (key, value) => setData(prev => ({ ...prev, [key]: value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    const v = validateForm(e.target);
    if (!v.ok) { alert(v.message || 'Invalid input'); return; }
    try {
      const ref = doc(db, 'services', id);
      const beforeSnap = await getDoc(ref);
      const before = beforeSnap.exists() ? beforeSnap.data() : null;

      await updateDoc(ref, {
        name: data.name,
        price: Number(data.price) || 0,
        duration: localDurationMinutes ? `${localDurationMinutes}m` : (data.duration || ''),
        durationMinutes: Number(localDurationMinutes) || 0,
        type: data.type,
        productsUsed: data.productsUsed || []
      });

      // History record
      try {
        const auth = getAuth();
        const user = auth.currentUser;
        const actor = user ? { uid: user.uid, email: user.email } : null;
          try { await logHistory({ action: 'update', collection: 'services', docId: id, before, after: { name: data.name, price: Number(data.price) || 0, duration: localDurationMinutes ? `${localDurationMinutes}m` : (data.duration || ''), durationMinutes: Number(localDurationMinutes) || 0, type: data.type } }); } catch (e) { console.warn('history logger failed', e); }
      } catch (hx) { console.warn('Failed to write history for service update', hx); }
      onClose();
    } catch (err) {
      console.error('Update service failed', err);
      alert('Update failed');
    }
  };

  return (
    <div style={{ display: open ? 'block' : 'none' }}>
      <div style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <form onSubmit={onSubmit} style={{ background: 'var(--surface, #232323)', color: 'var(--text-primary, #fff)', padding: 16, borderRadius: 8, width: 'min(560px, 92%)', maxHeight: '80vh', overflow: 'auto', border: '1px solid var(--border-main)' }}>
          <h3 style={{ marginTop: 0 }}>Edit Service</h3>
          {loading || !data ? <div>Loading…</div> : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{ gridColumn: '1 / 2' }}>
                <label style={{ display: 'block', fontSize: 12, marginBottom: 6 }}>Name</label>
                <input required value={data.name || ''} onChange={e => onChange('name', sanitizeName(e.target.value))} style={{ width: '80%', padding: 8, background: 'var(--surface)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }} />
              </div>
              <div style={{ gridColumn: '2 / 3' }}>
                <label style={{ display: 'block', fontSize: 12, marginBottom: 6 }}>Type</label>
                <select value={data.type || 'hair'} onChange={e => onChange('type', e.target.value)} style={{ width: '80%', padding: 8, background: 'var(--surface)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }}>
                  <option value="hair">Hair</option>
                  <option value="skin">Skin</option>
                  <option value="nails">Nails</option>
                </select>
              </div>
              <div style={{ gridColumn: '1 / 2' }}>
                <label style={{ display: 'block', fontSize: 12, marginBottom: 6 }}>Price</label>
                <input required value={data.price || ''} onChange={e => onChange('price', e.target.value)} type="number" step="0.01" style={{ width: '80%', padding: 8, background: 'var(--surface)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }} />
              </div>
              <div style={{ gridColumn: '2 / 3' }}>
                <label style={{ display: 'block', fontSize: 12, marginBottom: 6 }}>Duration</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                    <DurationClock value={localDurationMinutes} onChange={m => setLocalDurationMinutes(m)} />
                  </div>
                </div>
                <div style={{ marginTop: 8, color: 'var(--muted)' }}>Selected: {formatMinutes(localDurationMinutes)}</div>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Products used</div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {data.productsUsed && data.productsUsed.length > 0 ? (
                      <div style={{ border: '1px solid var(--border-main)', borderRadius: 6, padding: 8, display: 'grid', gap: 8, background: 'var(--surface)' }}>
                        {(data.productsUsed || []).map((it, idx) => (
                          <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <div style={{ flex: 1 }}>{it.productName || '—'}</div>
                            <input placeholder="Qty" value={it.qty || ''} onChange={e => {
                              const arr = [...(data.productsUsed || [])]; arr[idx] = { ...arr[idx], qty: e.target.value }; onChange('productsUsed', arr);
                            }} type="number" style={{ width: 80, padding: 6, background: 'var(--surface)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }} />
                            <button type="button" onClick={() => {
                              const arr = [...(data.productsUsed || [])].filter((_, i) => i !== idx); onChange('productsUsed', arr);
                            }} style={{ padding: '6px 8px' }}>Delete</button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ color: '#666', marginBottom: 8 }}>No products added yet. Use the search below to add.</div>
                    )}

                    <div style={{ marginTop: 8 }}>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                        <select value={productSearch ? products.find(p => p.name?.toLowerCase().includes(productSearch.toLowerCase()))?.id || '' : ''} onChange={e => {
                          const prod = products.find(p => p.id === e.target.value);
                          if (!prod) return;
                          onChange('productsUsed', [...(data.productsUsed || []), { productId: prod.id, productName: prod.name, qty: 1 }]);
                        }} style={{ flex: 1, padding: 8, background: 'var(--surface)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }}>
                          <option value="">-- select product --</option>
                          {products.filter(p => p.name?.toLowerCase().includes(productSearch.toLowerCase())).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <input placeholder="Search" value={productSearch} onChange={e => setProductSearch(sanitizeForSearch(e.target.value))} style={{ width: 160, padding: 8, background: 'var(--surface)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }} />
                      </div>
                      {productSearch ? (
                        <div style={{ maxHeight: 160, overflow: 'auto', border: '1px solid var(--border-main)', borderRadius: 6, padding: 8, background: 'var(--surface)' }}>
                          {products.filter(p => p.name?.toLowerCase().includes(productSearch.toLowerCase())).map(p => (
                            <div key={p.id} style={{ padding: 6, cursor: 'pointer' }} onClick={() => {
                              onChange('productsUsed', [...(data.productsUsed || []), { productId: p.id, productName: p.name, qty: 1 }]);
                              setProductSearch('');
                            }}>{p.name}</div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
              </div>

              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={onClose} style={{ padding: '8px 12px' }}>Cancel</button>
                <button type="submit" className="button-gold-dark" style={{ padding: '8px 12px' }}>Save</button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default EditServiceModal;
