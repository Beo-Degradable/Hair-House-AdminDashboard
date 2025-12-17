// EditInventoryModal: edit product-level info or unlinked inventory group; similar UI to AddInventoryModal
import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase';
import ValidatedInput from '../../../components/ValidatedInput';
import { validateForm, sanitizeName } from '../../../utils/validators';
import uploadToCloudinary from '../../../utils/cloudinary';
import { logHistory } from '../../../utils/historyLogger';

const EditInventoryModal = ({ open, onClose, targetId /* product id or unlinked:<name> */, onSaved }) => {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('');
  const [price, setPrice] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageName, setImageName] = useState('');
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

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      setLoading(true);
      try {
        if (!targetId) return;
        if (String(targetId).startsWith('unlinked:')) {
          const pname = targetId.replace('unlinked:', '');
          setName(pname);
          setBrand(''); setCategory(''); setUnit(''); setPrice('');
          setImagePreview(null); setImageFile(null); setImageName('');
          // load branch quantities from inventory docs that match productName
          const q = query(collection(db, 'inventory'), where('productName', '==', pname));
          const snaps = await getDocs(q);
          const qmap = {};
          branchMap.forEach(b => { qmap[b.id] = ''; });
          snaps.docs.forEach(s => {
            const d = s.data();
            const bk = d.branchId || d.branch || '';
            if (bk) qmap[bk] = String(d.quantity || '');
          });
          setBranchQuantities(qmap);
        } else {
          const snap = await getDoc(doc(db, 'products', targetId));
          if (snap.exists()) {
            const d = snap.data();
            setName(d.name || '');
            setBrand(d.brand || '');
            setCategory(d.category || '');
            setUnit(d.unit || '');
            setPrice(d.price != null ? String(d.price) : '');
            setImagePreview(d.imageUrl || null);
            setImageName('');
            setImageFile(null);
            // load inventory docs for this product to prefill branch quantities
            const q = query(collection(db, 'inventory'), where('productId', '==', targetId));
            const snaps = await getDocs(q);
            const qmap = {};
            branchMap.forEach(b => { qmap[b.id] = ''; });
            snaps.docs.forEach(s => {
              const d = s.data();
              const bk = d.branchId || d.branch || '';
              if (bk) qmap[bk] = String(d.quantity || '');
            });
            setBranchQuantities(qmap);
          } else {
            setName(''); setBrand(''); setCategory(''); setUnit(''); setPrice('');
          }
        }
      } catch (err) {
        console.error('Failed to load product for edit', err);
      } finally { setLoading(false); }
    };
    load();
  }, [open, targetId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const v = validateForm(e.target);
    if (!v.ok) { alert(v.message || 'Invalid input'); return; }
    setLoading(true);
    try {
      const cleanName = sanitizeName(name || '');
      // upload image if provided
      let uploadedUrl = null; let uploadedPublicId = null;
      if (imageFile) {
        try {
          const resp = await uploadToCloudinary(imageFile, { cloudName: 'dlgq64gr6', uploadPreset: 'default' });
          uploadedUrl = resp?.secure_url || resp?.url || null;
          uploadedPublicId = resp?.public_id || null;
        } catch (ux) { console.warn('Cloudinary upload failed', ux); }
      }
      // If unlinked group, update matching inventory docs' productName and image
      if (String(targetId).startsWith('unlinked:')) {
        const originalName = targetId.replace('unlinked:', '');
        // update any existing inventory docs' productName/image
        const q = query(collection(db, 'inventory'), where('productName', '==', originalName));
        const snaps = await getDocs(q);
        for (const s of snaps.docs) {
          const ref = doc(db, 'inventory', s.id);
          const update = { productName: cleanName, lastUpdated: serverTimestamp() };
          if (uploadedUrl) update.imageUrl = uploadedUrl;
          if (uploadedPublicId) update.imagePublicId = uploadedPublicId;
          await updateDoc(ref, update);
          try { await logHistory({ action: 'update', collection: 'inventory', docId: s.id, before: s.data(), after: update }); } catch (hh) { console.warn('history failed', hh); }
        }
      } else {
        // update product doc
        const pRef = doc(db, 'products', targetId);
        const beforeSnap = await getDoc(pRef);
        const before = beforeSnap.exists() ? beforeSnap.data() : null;
        const upd = {
          name: cleanName,
          brand: brand || null,
          category: category || null,
          unit: unit || null,
          price: price ? Number(price) : null,
          lastUpdated: serverTimestamp(),
        };
        if (uploadedUrl) upd.imageUrl = uploadedUrl;
        if (uploadedPublicId) upd.imagePublicId = uploadedPublicId;
        try { await updateDoc(pRef, upd); } catch (err) { console.warn('product update failed', err); }
        try { await logHistory({ action: 'update', collection: 'products', docId: targetId, before, after: { ...before, ...upd } }); } catch (hh) { console.warn('history failed', hh); }
      }

      // Update/create inventory docs per-branch according to branchQuantities
      for (const b of branchMap) {
        const qtyStr = branchQuantities[b.id];
        if (qtyStr === undefined || qtyStr === '') continue; // skip untouched
        const qty = Number(qtyStr) || 0;
        if (String(targetId).startsWith('unlinked:')) {
          // look for inventory docs matching productName (now cleanName) and branch
          const q = query(collection(db, 'inventory'), where('productName', '==', cleanName), where('branchId', '==', b.id));
          const snaps = await getDocs(q);
          if (snaps.docs.length) {
            for (const s of snaps.docs) {
              const ref = doc(db, 'inventory', s.id);
              const update = { quantity: qty, productName: cleanName, lastUpdated: serverTimestamp() };
              if (uploadedUrl) { update.imageUrl = uploadedUrl; update.imagePublicId = uploadedPublicId; }
              await updateDoc(ref, update);
              try { await logHistory({ action: 'update', collection: 'inventory', docId: s.id, before: s.data(), after: update }); } catch (hh) { console.warn('history failed', hh); }
            }
          } else {
            // create new inventory doc for this branch
            const newDoc = {
              productName: cleanName,
              productId: null,
              quantity: qty,
              branchId: b.id,
              imageUrl: uploadedUrl || null,
              imagePublicId: uploadedPublicId || null,
              createdAt: serverTimestamp(),
            };
            try { const nd = await addDoc(collection(db, 'inventory'), newDoc); try { await logHistory({ action: 'create', collection: 'inventory', docId: nd.id, after: newDoc }); } catch(e){}} catch(e){ console.warn('create inventory failed', e); }
          }
        } else {
          // linked product: look for inventory docs by productId and branch
          const q = query(collection(db, 'inventory'), where('productId', '==', targetId), where('branchId', '==', b.id));
          const snaps = await getDocs(q);
          if (snaps.docs.length) {
            for (const s of snaps.docs) {
              const ref = doc(db, 'inventory', s.id);
              const update = { quantity: qty, lastUpdated: serverTimestamp() };
              if (uploadedUrl) { update.imageUrl = uploadedUrl; update.imagePublicId = uploadedPublicId; }
              await updateDoc(ref, update);
              try { await logHistory({ action: 'update', collection: 'inventory', docId: s.id, before: s.data(), after: update }); } catch (hh) { console.warn('history failed', hh); }
            }
          } else {
            const newDoc = {
              productName: cleanName,
              productId: targetId,
              quantity: qty,
              branchId: b.id,
              imageUrl: uploadedUrl || null,
              imagePublicId: uploadedPublicId || null,
              createdAt: serverTimestamp(),
            };
            try { const nd = await addDoc(collection(db, 'inventory'), newDoc); try { await logHistory({ action: 'create', collection: 'inventory', docId: nd.id, after: newDoc }); } catch(e){} } catch(e){ console.warn('create inventory failed', e); }
          }
        }
      }

      onSaved && onSaved([targetId]);
      onClose && onClose();
    } catch (err) {
      console.error('Edit failed', err);
      alert('Failed to save: ' + (err.message || err));
    } finally { setLoading(false); }
  };

  if (!open) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.25)', zIndex: 1000 }}>
      <div onMouseDown={onClose} style={{ position: 'absolute', inset: 0 }} />
      <form onSubmit={handleSubmit} onClick={e => e.stopPropagation()} style={{ background: 'var(--surface, #fff)', color: 'var(--text-main)', padding: 16, borderRadius: 8, width: 'min(560px, 92%)', border: '1px solid var(--border-main)' }}>
        <h3 style={{ marginTop: 0 }}>Edit Item</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12 }}>Name</label>
            <ValidatedInput value={name} onChange={v => setName(v)} style={{ width: '80%', padding: 8 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12 }}>Brand</label>
            <ValidatedInput value={brand} onChange={v => setBrand(v)} style={{ width: '80%', padding: 8 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12 }}>Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)} style={{ width: '80%', padding: 8 }}>
              <option value=''>-- select category --</option>
              <option value='shampoo'>Shampoo</option>
              <option value='conditioner'>Conditioner</option>
              <option value='treatment'>Treatment</option>
              <option value='color'>Color</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12 }}>Unit</label>
            <select value={unit} onChange={e => setUnit(e.target.value)} style={{ width: '92%', padding: 8 }}>
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
              const f = e.target.files && e.target.files[0]; if (!f) return; setImageName(f.name||''); setImageFile(f); try { setImagePreview(URL.createObjectURL(f)); } catch(_) { setImagePreview(null); }
            }} />
            {imagePreview ? (<div style={{ marginTop: 8 }}><div style={{ fontSize: 12 }}>{imageName}</div><img src={imagePreview} alt="preview" style={{ marginTop:6, maxWidth:240, maxHeight:160, objectFit:'cover', borderRadius:6 }} /></div>) : null}
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12 }}>Price</label>
            <ValidatedInput type='number' integer={false} value={price} onChange={v => setPrice(v)} style={{ width: '80%', padding: 8 }} />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={{ display: 'block', fontSize: 12 }}>Branch Quantities</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            {branchMap.map(b => (
              <button key={b.id} type="button" onClick={() => setActiveBranchId(b.id)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-main)', background: activeBranchId === b.id ? 'var(--muted-accent)' : 'transparent' }}>{b.name}</button>
            ))}
          </div>
          {activeBranchId ? (
            <div style={{ marginTop: 8 }}>
              <label style={{ display: 'block', fontSize: 12 }}>Quantity for {branchMap.find(x => x.id === activeBranchId)?.name}</label>
              <ValidatedInput type='number' value={branchQuantities[activeBranchId] || ''} onChange={v => setBranchQuantities(prev => ({ ...prev, [activeBranchId]: v }))} style={{ width: '140px', padding: 8 }} />
            </div>
          ) : null}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <button type="button" onClick={onClose} style={{ padding: '8px 12px' }}>Cancel</button>
          <button type="submit" className="button-gold-dark" style={{ padding: '8px 12px' }}>{loading ? 'Saving...' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
};

export default EditInventoryModal;
