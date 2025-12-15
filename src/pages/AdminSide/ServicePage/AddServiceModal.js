// AddServiceModal: create a service with name/price/duration and optional product usage.
import React, { useState, useEffect, useRef } from 'react';
import { validateForm, sanitizeName } from '../../../utils/validators';
import DurationClock from '../../../components/DurationClock';
import { parseDurationToMinutes, formatMinutes } from '../../../utils/time';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase';
import { logHistory } from '../../../utils/historyLogger';

const AddServiceModal = ({ open, onClose, fixedType = '' }) => {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  // canonical duration in minutes
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [localHours, setLocalHours] = useState(Math.floor(30 / 60));
  const [localMinutesVal, setLocalMinutesVal] = useState(30 % 60);
  const [durationInput, setDurationInput] = useState('00:30');
  const [type, setType] = useState(fixedType || 'hair');
  const [imageBase64, setImageBase64] = useState(null);
  const [imageName, setImageName] = useState('');
  const fileInputRef = useRef(null);
  // tags removed per request

  // no products listener needed: productsUsed removed, replaced by tags

  // tags handlers removed

  // Ensure local `type` follows `fixedType` when the modal opens or fixedType changes
  useEffect(() => {
    if (open) {
      setType(fixedType || 'hair');
    }
  }, [open, fixedType]);

  const onSubmit = async (e) => {
    e.preventDefault();
    const v = validateForm(e.target);
    if (!v.ok) { alert(v.message || 'Invalid input'); return; }
    // close modal immediately on save click; continue saving in background
    try {
      onClose();
      // parse durationInput in case user didn't blur
      const parseDurationString = (v) => {
        const raw = (v || '').trim();
        let h = 0, m = 0;
        if (raw.includes(':')) {
          const parts = raw.split(':').map(p => p.replace(/[^0-9]/g, ''));
          h = Number(parts[0]) || 0;
          m = Number(parts[1]) || 0;
        } else {
          const n = Number(raw.replace(/[^0-9]/g, ''));
          if (!Number.isNaN(n)) { h = n; m = 0; }
        }
        m = Math.max(0, Math.min(59, m));
        h = Math.max(0, h);
        return { h, m, total: h * 60 + m };
      };
      const parsedForSave = parseDurationString(durationInput);
      const cleanName = sanitizeName(name || '');
      const ref = await addDoc(collection(db, 'services'), {
        name: cleanName,
        price: Number(price) || 0,
        duration: parsedForSave.total ? `${parsedForSave.total}m` : '',
        durationMinutes: Number(parsedForSave.total) || 0,
        type,
        imageBase64: imageBase64 || null,
        imageUrl: imageBase64 || null,
        createdAt: serverTimestamp()
      });

  // History log
      try { await logHistory({ action: 'create', collection: 'services', docId: ref.id, before: null, after: { name: cleanName, price: Number(price) || 0, duration: parsedForSave.total ? `${parsedForSave.total}m` : '', durationMinutes: Number(parsedForSave.total) || 0, type } }); } catch (e) { console.warn('history logger failed', e); }
    } catch (err) {
      console.error('Add service error', err);
      alert('Failed to add service');
    }
  };

  if (!open) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.25)', zIndex: 1000 }}>
      <div onMouseDown={onClose} style={{ position: 'absolute', inset: 0, zIndex: 1000 }} />
      <form
        onSubmit={onSubmit}
        onClick={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
        onTouchStart={e => e.stopPropagation()}
        onPointerDown={e => e.stopPropagation()}
        onPointerUp={e => e.stopPropagation()}
        style={{ background: 'var(--bg-drawer, #fff)', color: 'var(--text-main)', fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', padding: 16, borderRadius: 8, width: 'min(560px, 92%)', maxHeight: '80vh', overflow: 'auto', border: '1px solid var(--border-main)' }}
      >
        <h3 style={{ marginTop: 0 }}>Add Service</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{ gridColumn: '1 / 2' }}>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 400, marginBottom: 6, fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>Name</label>
                <input required value={name} onChange={e => setName(e.target.value)} style={{ width: '80%', padding: 8, background: 'var(--bg-surface)', border: '1px solid var(--border-main)', color: 'var(--text-main)', fontSize: 14, fontWeight: 400 }} />
            </div>
            
            <div style={{ gridColumn: '2 / 3' }}>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 400, marginBottom: 6, fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>Type</label>
              {fixedType ? (
                <div style={{ width: '70%', padding: 8, background: 'var(--bg-surface)', border: '1px solid var(--border-main)', color: 'var(--text-main)', fontSize: 14, fontWeight: 400 }}>{fixedType}</div>
              ) : (
                <select value={type} onChange={e => setType(e.target.value)} style={{ width: '70%', padding: 8, background: 'var(--bg-surface)', border: '1px solid var(--border-main)', color: 'var(--text-main)', fontSize: 14, fontWeight: 400 }}>
                  <option value="hair">Hair</option>
                  <option value="skin">Skin</option>
                  <option value="nails">Nails</option>
                </select>
              )}
            </div>
            <div style={{ gridColumn: '1 / 2' }}>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 400, marginBottom: 6, fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>Price</label>
                <input required value={price} onChange={e => setPrice(e.target.value)} type="number" step="0.01" style={{ width: '80%', padding: 8, background: 'var(--bg-surface)', border: '1px solid var(--border-main)', color: 'var(--text-main)', fontSize: 14, fontWeight: 400 }} />
            </div>
            <div style={{ gridColumn: '2 / 3' }}>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 400, marginBottom: 6, fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>Duration (HH:MM)</label>
              <input
                value={durationInput}
                onChange={e => setDurationInput(e.target.value)}
                onBlur={e => {
                  const raw = (e.target.value || '').trim();
                  let h = 0, m = 0;
                  if (raw.includes(':')) {
                    const parts = raw.split(':').map(p => p.replace(/[^0-9]/g, ''));
                    h = Number(parts[0]) || 0;
                    m = Number(parts[1]) || 0;
                  } else {
                    const n = Number(raw.replace(/[^0-9]/g, ''));
                    if (!Number.isNaN(n)) { h = n; m = 0; }
                  }
                  m = Math.max(0, Math.min(59, m));
                  h = Math.max(0, h);
                  setLocalHours(h);
                  setLocalMinutesVal(m);
                  setDurationMinutes(h * 60 + m);
                  setDurationInput(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
                }}
                placeholder="00:00"
                    style={{ width: '80%', padding: 8, background: 'var(--bg-surface)', border: '1px solid var(--border-main)', color: 'var(--text-main)', fontSize: 14, fontWeight: 400 }}
              />
              <div style={{ marginTop: 8, color: 'var(--muted)' }}>Selected: {formatMinutes(durationMinutes)}</div>
            </div>

              {/* tags removed */}

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 400, marginBottom: 6, fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>Image (optional)</label>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={async (e) => {
                const f = e.target.files && e.target.files[0];
                if (!f) return;
                setImageName(f.name || '');
                const reader = new FileReader();
                reader.onload = () => {
                  const result = reader.result;
                  setImageBase64(result);
                };
                reader.onerror = () => {
                  console.error('Failed to read image file');
                  setImageBase64(null);
                };
                reader.readAsDataURL(f);
              }} style={{ width: '100%' }} />
              {imageBase64 ? (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{imageName}</div>
                  <img src={imageBase64} alt="preview" style={{ marginTop: 6, maxWidth: 240, maxHeight: 160, objectFit: 'cover', borderRadius: 6 }} />
                    <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                      <button type="button" onClick={() => { if (fileInputRef.current) fileInputRef.current.click(); }} style={{ padding: '6px 10px', background: 'transparent', border: '1px solid var(--border-main)', color: 'var(--text-main)', cursor: 'pointer', borderRadius: 6 }}>Reupload</button>
                      <button type="button" onClick={() => { setImageBase64(null); setImageName(''); if (fileInputRef.current) fileInputRef.current.value = null; }} style={{ padding: '6px 10px', background: 'transparent', border: '1px solid var(--border-main)', color: 'var(--text-main)', cursor: 'pointer', borderRadius: 6 }}>Remove</button>
                    </div>
                </div>
              ) : null}
            </div>

            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={onClose} style={{ padding: '8px 12px', background: 'transparent', border: '1px solid var(--border-main)', color: 'var(--text-main)' }}>Cancel</button>
                <button type="submit" className="button-gold-dark" style={{ padding: '8px 12px', background: 'var(--accent)', border: '1px solid var(--accent)', color: 'var(--accent-foreground)' }}>{'Create'}</button>
            </div>
          </div>
        </form>
    </div>
  );
};

export default AddServiceModal;
