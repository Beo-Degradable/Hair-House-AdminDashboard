// AddServiceModal: create a service with name/price/duration and optional product usage.
import React, { useState, useEffect } from 'react';
import { validateForm, sanitizeName, sanitizeForSearch } from '../../../utils/validators';
import DurationClock from '../../../components/DurationClock';
import { parseDurationToMinutes, formatMinutes } from '../../../utils/time';
import { addDoc, collection, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '../../../firebase';
import { logHistory } from '../../../utils/historyLogger';

const AddServiceModal = ({ open, onClose }) => {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  // canonical duration in minutes
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [type, setType] = useState('hair');
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedQty, setSelectedQty] = useState(1);

  useEffect(() => {
    const col = collection(db, 'products');
    const unsub = onSnapshot(col, snap => setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() }))), () => {});
    return () => unsub();
  }, []);

  const addItem = () => setItems(prev => [...prev, { id: Date.now(), productId: '', productName: '', qty: 1 }]);
  const updateItem = (id, key, value) => setItems(prev => prev.map(it => it.id === id ? { ...it, [key]: value } : it));
  const removeItem = (id) => setItems(prev => prev.filter(it => it.id !== id));
  const updateItemByProductId = (id, productId) => {
    const prod = products.find(p => p.id === productId);
    setItems(prev => prev.map(it => it.id === id ? { ...it, productId, productName: prod ? prod.name : '' } : it));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const v = validateForm(e.target);
    if (!v.ok) { alert(v.message || 'Invalid input'); return; }
    try {
      const ref = await addDoc(collection(db, 'services'), {
        name,
        price: Number(price) || 0,
        duration: durationMinutes ? `${durationMinutes}m` : '',
        durationMinutes: Number(durationMinutes) || 0,
        type,
        productsUsed: items.map(i => ({ productId: i.productId || null, productName: i.productName || '', qty: Number(i.qty) || 0 })),
        createdAt: serverTimestamp()
      });

  // History log
      try { await logHistory({ action: 'create', collection: 'services', docId: ref.id, before: null, after: { name, price: Number(price) || 0, duration: durationMinutes ? `${durationMinutes}m` : '', durationMinutes: Number(durationMinutes) || 0, type } }); } catch (e) { console.warn('history logger failed', e); }
      onClose();
    } catch (err) {
      console.error('Add service error', err);
      alert('Failed to add service');
    }
  };

  return (
    <div style={{ display: open ? 'block' : 'none' }}>
      <div style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <form onSubmit={onSubmit} style={{ background: 'var(--surface, #232323)', color: 'var(--text-primary, #fff)', padding: 16, borderRadius: 8, width: 'min(560px, 92%)', maxHeight: '80vh', overflow: 'auto', border: '1px solid var(--border-main)' }}>
          <h3 style={{ marginTop: 0 }}>Add Service</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{ gridColumn: '1 / 2' }}>
              <label style={{ display: 'block', fontSize: 5, marginBottom: 6 }}>Name</label>
              <input required value={name} onChange={e => setName(sanitizeName(e.target.value))} style={{ width: '80%', padding: 8, background: 'var(--surface)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }} />
            </div>
            <div style={{ gridColumn: '2 / 3' }}>
              <label style={{ display: 'block', fontSize: 5, marginBottom: 6 }}>Type</label>
              <select value={type} onChange={e => setType(e.target.value)} style={{ width: '70%', padding: 8, background: 'var(--surface)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }}>
                <option value="hair">Hair</option>
                <option value="skin">Skin</option>
                <option value="nails">Nails</option>
              </select>
            </div>
            <div style={{ gridColumn: '1 / 2' }}>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 6 }}>Price</label>
              <input required value={price} onChange={e => setPrice(e.target.value)} type="number" step="0.01" style={{ width: '80%', padding: 8, background: 'var(--surface)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }} />
            </div>
            <div style={{ gridColumn: '2 / 3' }}>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 6 }}>Duration</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                  <DurationClock value={durationMinutes} onChange={m => setDurationMinutes(m)} />
                </div>
              </div>
              <div style={{ marginTop: 8, color: 'var(--muted)' }}>Selected: {formatMinutes(durationMinutes)}</div>
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Products used</div>

              {/* Selection row */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <select value={selectedProductId} onChange={e => {
                  const val = e.target.value;
                  setSelectedProductId(val);
                  if (!val) return;
                  const prod = products.find(p => p.id === val);
                  setItems(prev => [...prev, { id: Date.now(), productId: prod.id, productName: prod.name, qty: 1 }]);
                  setSelectedProductId(''); setProductSearch('');
                }} style={{ flex: 1, padding: 8, background: 'var(--surface)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }}>
                  <option value="">-- select product --</option>
                  {products.filter(p => p.name?.toLowerCase().includes(productSearch.toLowerCase())).map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <input placeholder="Search" value={productSearch} onChange={e => setProductSearch(sanitizeForSearch(e.target.value))} style={{ width: 160, padding: 8, background: 'var(--surface)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }} />
              </div>

              {/* Search results list */}
              {productSearch ? (
                <div style={{ maxHeight: 160, overflow: 'auto', border: '1px solid var(--border-main)', borderRadius: 6, padding: 8, marginBottom: 8, background: 'var(--surface)' }}>
                  {products.filter(p => p.name?.toLowerCase().includes(productSearch.toLowerCase())).map(p => (
                    <div key={p.id} style={{ padding: 6, cursor: 'pointer' }} onClick={() => {
                      setItems(prev => [...prev, { id: Date.now(), productId: p.id, productName: p.name, qty: 1 }]);
                      setProductSearch(''); setSelectedProductId('');
                    }}>{p.name}</div>
                  ))}
                  {products.filter(p => p.name?.toLowerCase().includes(productSearch.toLowerCase())).length === 0 ? <div style={{ color: '#666' }}>No products</div> : null}
                </div>
              ) : null}

              {/* Selected items */}
              {items.length > 0 ? (
                <div style={{ border: '1px solid var(--border-main)', borderRadius: 6, padding: 8, display: 'grid', gap: 8, background: 'var(--surface)' }}>
                  {items.map(it => (
                    <div key={it.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <div style={{ flex: 1 }}>{it.productName || '—'}</div>
                      <input placeholder="Qty" value={it.qty} onChange={e => updateItem(it.id, 'qty', e.target.value)} type="number" style={{ width: 80, padding: 6, background: 'var(--surface)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }} />
                      <button type="button" onClick={() => removeItem(it.id)} style={{ padding: '6px 8px' }}>Delete</button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={onClose} style={{ padding: '8px 12px' }}>Cancel</button>
              <button type="submit" className="button-gold-dark" style={{ padding: '8px 12px' }}>{'Create'}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddServiceModal;
