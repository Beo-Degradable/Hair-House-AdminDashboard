import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase';

const modalRoot = typeof document !== 'undefined' ? document.body : null;

const NewOrderModal = ({ onClose, defaultBranch = 'evengelista', inventoryItems = [], inventoryBranches = [] }) => {
  const [clientName, setClientName] = useState('');
  const [branch, setBranch] = useState(defaultBranch || (inventoryBranches && inventoryBranches[0] && (inventoryBranches[0].id || inventoryBranches[0].name) ? (inventoryBranches[0].id || inventoryBranches[0].name).toString().toLowerCase() : 'evangelista'));
  const [staff, setStaff] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedItems, setSelectedItems] = useState([]); // { id, name, qty, price }
  const [saving, setSaving] = useState(false);
  const items = inventoryItems || [];

  const addSelectedItem = () => {
    if (!selectedItemId) return;
    const it = items.find(i => i.id === selectedItemId);
    if (!it) return;
    // avoid duplicates: increment qty if already there
    setSelectedItems(prev => {
      const existing = prev.find(p => p.id === it.id);
      if (existing) {
        return prev.map(p => p.id === it.id ? { ...p, qty: (p.qty || 1) + 1 } : p);
      }
      return [...prev, { id: it.id, name: it.name || it.title || it.productName || 'Item', qty: 1, price: Number(it.price || it.unitPrice || 0) }];
    });
    setSelectedItemId('');
  };

  const updateQty = (id, qty) => {
    setSelectedItems(prev => prev.map(p => p.id === id ? { ...p, qty: Number(qty) } : p));
  };

  const removeItem = (id) => setSelectedItems(prev => prev.filter(p => p.id !== id));

  const total = selectedItems.reduce((s, it) => s + (Number(it.price || 0) * (Number(it.qty || 1))), 0);

  const submit = async () => {
    if (!clientName || !branch || !staff || selectedItems.length === 0) return;
    setSaving(true);
    try {
      const docRef = await addDoc(collection(db, 'payments'), {
        customerName: clientName,
        branch,
        staff,
        items: selectedItems.map(i => ({ productId: i.id, name: i.name, quantity: i.qty, price: i.price })),
        total,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      // close after save
      onClose && onClose();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to create order', e);
    } finally {
      setSaving(false);
    }
  };

  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    const check = () => setIsNarrow(typeof window !== 'undefined' ? window.innerWidth < 560 : false);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const body = (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.25)', zIndex: 1000 }}>
      <div onMouseDown={onClose} style={{ position: 'absolute', inset: 0, zIndex: 1000 }} />
      <div
        onClick={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
        onTouchStart={e => e.stopPropagation()}
        onPointerDown={e => e.stopPropagation()}
        onPointerUp={e => e.stopPropagation()}
        style={{ zIndex: 1001, pointerEvents: 'auto', width: isNarrow ? 'min(520px, 96%)' : 'min(640px, 92%)', maxWidth: isNarrow ? 520 : 640, background: 'var(--bg-drawer, #fff)', color: 'var(--text-main, #181818)', borderRadius: 8, padding: 16, boxShadow: '0 6px 18px rgba(0,0,0,0.12)', border: '1px solid var(--border-main, rgba(0,0,0,0.08))' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontWeight: 700 }}>Create New Order</div>
          <div><button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>✕</button></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>Client name</label>
            <input value={clientName} onChange={(e) => setClientName(e.target.value)} style={{ width: '95%', padding: 8, borderRadius: 6, border: '1px solid var(--border-main)', background: 'var(--bg-drawer)', color: 'var(--text-main)' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>Branch</label>
            <select value={branch} onChange={(e) => setBranch(e.target.value)} style={{ width: '95%', padding: 8, borderRadius: 6, border: '1px solid var(--border-main)', background: 'var(--bg-drawer)', color: 'var(--text-main)' }}>
              {/* prefer inventoryBranches if provided */}
              {(inventoryBranches && inventoryBranches.length > 0 ? inventoryBranches : [
                { id: 'evangelista', name: 'Evangelista' },
                { id: 'lawas', name: 'Lawas' },
                { id: 'lipa', name: 'Lipa' },
                { id: 'tanauan', name: 'Tanauan' },
              ]).map(b => <option key={b.id || b.name} value={(b.id || b.name).toString().toLowerCase()}>{b.name || b.id}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>Staff (sold by)</label>
            <input value={staff} onChange={(e) => setStaff(e.target.value)} style={{ width: '95%', padding: 8, borderRadius: 6, border: '1px solid var(--border-main)', background: 'var(--bg-drawer)', color: 'var(--text-main)' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>Select item to add</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={selectedItemId} onChange={(e) => setSelectedItemId(e.target.value)} style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid var(--border-main)', background: 'var(--bg-drawer)', color: 'var(--text-main)' }}>
                <option value="">-- pick an item --</option>
                {items.map(it => <option key={it.id} value={it.id}>{it.name || it.title || it.productName}</option>)}
              </select>
              <button onClick={addSelectedItem} style={{ padding: '8px 12px', borderRadius: 6, background: 'var(--accent)', color: 'var(--accent-foreground)', border: 'none', cursor: 'pointer' }}>Add</button>
            </div>
          </div>
        </div>

          {selectedItems.length > 0 && (
            <div style={{ border: '1px dashed var(--border-main)', padding: 12, borderRadius: 8, marginBottom: 12, background: 'rgba(0,0,0,0.02)' }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Selected Items</div>
            {selectedItems.map(it => (
              <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <div style={{ flex: 1 }}>{it.name}</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="number" min={1} value={it.qty} onChange={(e) => updateQty(it.id, e.target.value)} style={{ width: 80, padding: 6, borderRadius: 6, border: '1px solid var(--border-main)', background: 'var(--bg-surface, #fff)', color: 'var(--text-main, #111)' }} />
                  <div style={{ color: 'var(--muted)' }}>₱{Number(it.price || 0).toFixed(2)}</div>
                  <button onClick={() => removeItem(it.id)} style={{ padding: '6px 10px', borderRadius: 6, background: 'transparent', border: '1px solid var(--border-main)', cursor: 'pointer' }}>Remove</button>
                </div>
              </div>
            ))}
            <div style={{ fontWeight: 700, marginTop: 8 }}>Total: ₱{Number(total).toFixed(2)}</div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '8px 12px', borderRadius: 6, background: 'transparent', border: '1px solid var(--border-main)', cursor: 'pointer' }}>Cancel</button>
          <button onClick={submit} disabled={saving || selectedItems.length === 0 || !clientName || !staff} style={{ padding: '8px 12px', borderRadius: 6, background: 'var(--accent)', color: 'var(--accent-foreground)', border: 'none', cursor: 'pointer' }}>{saving ? 'Saving…' : 'Create Order'}</button>
        </div>
      </div>
    </div>
  );

  return modalRoot ? createPortal(body, modalRoot) : body;
};

export default NewOrderModal;
