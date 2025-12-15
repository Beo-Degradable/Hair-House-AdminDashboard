import React, { useState } from 'react';
import { validateForm, sanitizeName } from '../../../utils/validators';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase';

const InventoryModal = ({ open, onClose, onAdded }) => {
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [qty, setQty] = useState(0);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const v = validateForm(e.target);
    if (!v.ok) { alert(v.message || 'Invalid input'); return; }
    setLoading(true);
    try {
      const nameInput = sanitizeName(name || '') || 'Untitled';
      const ref = await addDoc(collection(db, 'products'), {
        name: nameInput,
        sku: sku || null,
        totalQty: Number(qty || 0),
        createdAt: serverTimestamp()
      });
      onAdded && onAdded(ref.id);
      onClose && onClose();
    } catch (err) {
      console.error('add product error', err);
      alert('Failed to add product: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <form onSubmit={handleSubmit} style={{ background: 'var(--bg-drawer, white)', color: 'var(--text-main, #181818)', padding: 20, borderRadius: 8, width: 420, border: '1px solid var(--border-main, #ddd)' }}>
        <h3 style={{ marginTop: 0 }}>Add Product</h3>
        <div style={{ marginBottom: 8 }}>
          <label style={{ display: 'block', fontSize: 12 }}>Name</label>
          <input value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', padding: 8 }} />
        </div>
        <div style={{ marginBottom: 8 }}>
          <label style={{ display: 'block', fontSize: 12 }}>SKU</label>
          <input value={sku} onChange={e => setSku(e.target.value)} style={{ width: '100%', padding: 8 }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 12 }}>Initial Quantity</label>
          <input type="number" value={qty} onChange={e => setQty(e.target.value)} style={{ width: '100%', padding: 8 }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={onClose} disabled={loading} style={{ padding: '8px 12px' }}>Cancel</button>
          <button type="submit" disabled={loading} style={{ padding: '8px 12px', background: 'var(--btn-bg)', color: 'white', border: 'none' }}>{loading ? 'Adding...' : 'Add'}</button>
        </div>
      </form>
    </div>
  );
};

export default InventoryModal;
