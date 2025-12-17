// AddInventoryModal: create per-branch inventory docs and upsert aggregate product.
import React, { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import ValidatedInput from '../../../components/ValidatedInput';
import { validateForm, sanitizeName } from '../../../utils/validators';
import uploadToCloudinary from '../../../utils/cloudinary';
import { logHistory } from '../../../utils/historyLogger';

const AddInventoryModal = ({ open, onClose, onAdded, products = [], branches = [] }) => {
  const branchMap = [
    { id: 'B001', name: 'Evangelista' },
    { id: 'B002', name: 'Lawas' },
    { id: 'B003', name: 'Lipa' },
    { id: 'B004', name: 'Tanauan' },
  ];

  const [branchQuantities, setBranchQuantities] = useState(() => {
    const init = {};
    branchMap.forEach(b => { init[b.id] = ''; });
    return init;
  });
  const [activeBranchId, setActiveBranchId] = useState(null);
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('');
  // image upload replaces cost field
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageName, setImageName] = useState('');
  const [price, setPrice] = useState('');
  const [unit, setUnit] = useState('');
  const [loading, setLoading] = useState(false);


  useEffect(() => { /* keep hook stable */ }, [products]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const v = validateForm(e.target);
    if (!v.ok) { alert(v.message || 'Invalid input'); return; }
    setLoading(true);
    try {
  // Require product name
      const nameInput = sanitizeName(name || '');
      const brandInput = sanitizeName(brand || '') || null;
      const categoryInput = sanitizeName(category || '') || null;
      if (!nameInput) throw new Error('Enter product name');
      // upload image once (if provided) and attach to inventory/product records
      let uploadedImageUrl = null;
      let uploadedPublicId = null;
      if (imageFile) {
        try {
          const resp = await uploadToCloudinary(imageFile, { cloudName: 'dlgq64gr6', uploadPreset: 'default' });
          uploadedImageUrl = resp?.secure_url || resp?.url || null;
          uploadedPublicId = resp?.public_id || null;
        } catch (ux) { console.warn('Cloudinary upload failed', ux); }
      }

      // build list of writes for branches with quantities
      const createdIds = [];
      for (const b of branchMap) {
        const raw = branchQuantities[b.id];
        const qty = Number(raw || 0);
        if (!isNaN(qty) && qty > 0) {
            const data = {
            productName: nameInput || null,
            brand: brandInput,
            category: categoryInput,
            unit: unit || null,
            imageUrl: uploadedImageUrl || null,
            imagePublicId: uploadedPublicId || null,
            price: price ? Number(price) : null,
            branchId: b.id,
            branchName: b.name,
            quantity: qty,
            lastUpdated: serverTimestamp(),
          };
          console.log('[AddInventoryModal] writing inventory record for', b.id, data);
          const ref = await addDoc(collection(db, 'inventory'), data);
          createdIds.push(ref.id);
          // history entry for inventory create
          try { await logHistory({ action: 'create', collection: 'inventory', docId: ref.id, before: null, after: data }); } catch (hh) { console.warn('Failed to write history for inventory create', hh); }
        }
      }

      if (createdIds.length === 0) throw new Error('Enter quantity for at least one branch');

  // Aggregate total quantity across branches just written
      const totalAdded = Object.values(branchQuantities).reduce((s, v) => s + (Number(v || 0) || 0), 0);
      try {
  // Try to find existing product by exact name/sku from provided products
        const existing = (products || []).find(p => (p.name && String(p.name).toLowerCase() === String(nameInput).toLowerCase()) || (p.sku && p.sku === nameInput));
          if (existing && existing.id) {
          // Update existing: increment quantity and merge fields
          const prodRef = doc(db, 'products', existing.id);
          const currentQty = Number(existing.quantity || 0);
          const newQty = currentQty + totalAdded;
          await updateDoc(prodRef, {
            name: nameInput,
            brand: brand || existing.brand || null,
            category: category || existing.category || null,
            unit: unit || existing.unit || null,
            imageUrl: uploadedImageUrl || existing.imageUrl || null,
            imagePublicId: uploadedPublicId || existing.imagePublicId || null,
            price: price ? Number(price) : (existing.price || null),
            quantity: newQty,
            lastUpdated: serverTimestamp(),
          });
          console.log('[AddInventoryModal] updated existing product', existing.id, 'newQty', newQty);
            // History for product update
            try {
              const prodRef = doc(db, 'products', existing.id);
              const prev = existing;
              try { await logHistory({ action: 'update', collection: 'products', docId: existing.id, before: prev, after: { ...prev, quantity: newQty } }); } catch (hh) { console.warn('Failed to write history for product update', hh); }
            } catch (hh) { console.warn('Failed to write history for product update', hh); }
          } else {
          // Create new product doc with aggregated quantity
          const prodData = {
            name: nameInput,
            brand: brand || null,
            category: category || null,
            unit: unit || null,
            imageUrl: uploadedImageUrl || null,
            imagePublicId: uploadedPublicId || null,
            price: price ? Number(price) : null,
            quantity: totalAdded,
            createdAt: serverTimestamp(),
            lastUpdated: serverTimestamp(),
          };
          const prodRef = await addDoc(collection(db, 'products'), prodData);
          console.log('[AddInventoryModal] created product', prodRef.id);
          try { await logHistory({ action: 'create', collection: 'products', docId: prodRef.id, before: null, after: prodData }); } catch (hh) { console.warn('Failed to write history for product create', hh); }
        }
      } catch (err) {
        console.error('Failed to upsert product document', err);
        // don't fail the whole operation — inventory docs were created; notify developer
      }

  // Callback onAdded
      onAdded && onAdded(createdIds);
      onClose && onClose();
    } catch (err) {
      console.error('add inventory error', err);
      alert('Failed to add inventory: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: open ? 'block' : 'none' }}>
      <div style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
  <form className="modal-form" onSubmit={handleSubmit} style={{ background: 'var(--surface, #232323)', color: 'var(--text-primary, #fff)', padding: 20, borderRadius: 8, width: 'min(360px, 92%)', border: '1px solid var(--border-main)' }}>
          <h3 style={{ marginTop: 0 }}>Add Inventory Record</h3>
          {/* Product dropdown removed - using Name input to find/create products */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12 }}>Name</label>
              <ValidatedInput value={name} onChange={v => setName(v)} style={{ width: '80%', padding: 8, background: 'var(--surface)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12 }}>Brand</label>
              <ValidatedInput value={brand} onChange={v => setBrand(v)} style={{ width: '80%', padding: 8, background: 'var(--surface)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12 }}>Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)} style={{ width: '80%', padding: 8, background: 'var(--surface)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }}>
                <option value=''>-- select category --</option>
                <option value='shampoo'>Shampoo</option>
                <option value='conditioner'>Conditioner</option>
                <option value='treatment'>Treatment</option>
                <option value='color'>Color</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12 }}>Unit</label>
              <select value={unit} onChange={e => setUnit(e.target.value)} style={{ width: '92%', padding: 8, background: 'var(--surface)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }}>
                <option value=''>-- select unit --</option>
                <option value='Bottle'>Bottle</option>
                <option value='Pouch'>Pouch</option>
                <option value='Box'>Box</option>
                <option value='Piece'>Piece</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12 }}>Image (optional)</label>
              <input type="file" accept="image/*" onChange={(e) => {
                const f = e.target.files && e.target.files[0];
                if (!f) return;
                setImageName(f.name || '');
                setImageFile(f);
                try {
                  const obj = URL.createObjectURL(f);
                  setImagePreview(obj);
                } catch (ex) { setImagePreview(null); }
              }} style={{ width: '80%' }} />
              {imagePreview ? (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{imageName}</div>
                  <img src={imagePreview} alt="preview" style={{ marginTop: 6, maxWidth: 240, maxHeight: 160, objectFit: 'cover', borderRadius: 6 }} />
                  <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                    <button type="button" onClick={() => { if (imagePreview && imagePreview.startsWith('blob:')) try { URL.revokeObjectURL(imagePreview); } catch(_){}; setImagePreview(null); setImageFile(null); setImageName(''); }} style={{ padding: '6px 10px', background: 'transparent', border: '1px solid var(--border-main)', color: 'var(--text-primary)', cursor: 'pointer', borderRadius: 6 }}>Remove</button>
                  </div>
                </div>
              ) : null}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12 }}>Price</label>
              <ValidatedInput type='number' integer={false} value={price} onChange={v => setPrice(v)} style={{ width: '80%', padding: 8, background: 'var(--surface)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }} />
            </div>
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={{ display: 'block', fontSize: 12 }}>Branch quantities</label>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              {branchMap.map(b => (
                <button
                  key={b.id}
                  type='button'
                  onClick={() => setActiveBranchId(b.id)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: activeBranchId === b.id ? '2px solid var(--btn-bg)' : '1px solid var(--border-main)',
                    background: activeBranchId === b.id ? 'var(--btn-bg)' : 'var(--surface)',
                    color: activeBranchId === b.id ? 'var(--white)' : 'var(--text-primary, inherit)'
                  }}
                >
                  {b.name}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 10 }}>
              {activeBranchId ? (
                <div>
                  <div style={{ fontSize: 13, marginBottom: 6 }}>Quantity for {branchMap.find(b => b.id === activeBranchId).name}</div>
                  <ValidatedInput type='number' integer={false} value={branchQuantities[activeBranchId]} onChange={v => setBranchQuantities(prev => ({ ...prev, [activeBranchId]: v }))} style={{ width: '100%', padding: 8, background: 'var(--surface)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }} />
                </div>
              ) : (
                <div style={{ color: '#6b7280', fontSize: 13 }}>Select a branch to enter quantity</div>
              )}
            </div>
          </div>
          <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" onClick={onClose} disabled={loading} style={{ padding: '8px 12px' }}>Cancel</button>
            <button type="submit" disabled={loading} className="button-gold-dark" style={{ padding: '8px 12px' }}>{loading ? 'Adding...' : 'Add'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddInventoryModal;
