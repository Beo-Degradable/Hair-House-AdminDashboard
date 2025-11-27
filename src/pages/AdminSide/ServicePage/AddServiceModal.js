// AddServiceModal: create a service with name/price/duration and optional product usage.
import React, { useState, useEffect } from 'react';
import { validateForm, sanitizeName } from '../../../utils/validators';
import DurationClock from '../../../components/DurationClock';
import { parseDurationToMinutes, formatMinutes } from '../../../utils/time';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase';
import { logHistory } from '../../../utils/historyLogger';

const AddServiceModal = ({ open, onClose }) => {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  // canonical duration in minutes
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [type, setType] = useState('hair');
  // tags removed per request

  // no products listener needed: productsUsed removed, replaced by tags

  // tags handlers removed

  const onSubmit = async (e) => {
    e.preventDefault();
    const v = validateForm(e.target);
    if (!v.ok) { alert(v.message || 'Invalid input'); return; }
    try {
      const cleanName = sanitizeName(name || '');
      const ref = await addDoc(collection(db, 'services'), {
        name: cleanName,
        price: Number(price) || 0,
        duration: durationMinutes ? `${durationMinutes}m` : '',
        durationMinutes: Number(durationMinutes) || 0,
        type,
        createdAt: serverTimestamp()
      });

  // History log
      try { await logHistory({ action: 'create', collection: 'services', docId: ref.id, before: null, after: { name: cleanName, price: Number(price) || 0, duration: durationMinutes ? `${durationMinutes}m` : '', durationMinutes: Number(durationMinutes) || 0, type } }); } catch (e) { console.warn('history logger failed', e); }
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
              <input required value={name} onChange={e => setName(e.target.value)} style={{ width: '80%', padding: 8, background: 'var(--surface)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }} />
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

              {/* tags removed */}

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
