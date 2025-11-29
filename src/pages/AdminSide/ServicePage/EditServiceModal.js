// EditServiceModal: load service, adjust fields/duration/products, write update + history.
import React, { useState, useEffect, useRef } from 'react';
import { validateForm, sanitizeName } from '../../../utils/validators';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { parseDurationToMinutes, formatMinutes } from '../../../utils/time';
import { getAuth } from 'firebase/auth';
import { db } from '../../../firebase';
import { logHistory } from '../../../utils/historyLogger';

const EditServiceModal = ({ open, id, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [localDurationMinutes, setLocalDurationMinutes] = useState(60);
  const [localHours, setLocalHours] = useState(0);
  const [localMinutesVal, setLocalMinutesVal] = useState(0);
  const [durationInput, setDurationInput] = useState('01:00');
  const [imageBase64, setImageBase64] = useState(null);
  const [imageName, setImageName] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!open || !id) return;
    setLoading(true);
    const load = async () => {
      const d = await getDoc(doc(db, 'services', id));
      const loaded = d.exists() ? { id: d.id, ...d.data() } : null;
      if (loaded) {
        let minutes = 60;
        if (loaded.durationMinutes !== undefined && loaded.durationMinutes !== null) {
          minutes = Number(loaded.durationMinutes) || 60;
        } else if (loaded.duration) {
          minutes = parseDurationToMinutes(loaded.duration);
        }
        setLocalDurationMinutes(minutes);
        setLocalHours(Math.floor(minutes / 60));
        setLocalMinutesVal(minutes % 60);
        setDurationInput(`${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`);
        // load existing image if present
        if (loaded.imageUrl) {
          setImageBase64(loaded.imageUrl);
          setImageName((loaded.imageName || '').toString());
        }
      }
      setData(loaded);
      setLoading(false);
    };
    load();
  }, [open, id]);

  // products UI removed per request

  const onChange = (key, value) => setData(prev => ({ ...prev, [key]: value }));

  // keep hours/minutes in sync when duration minutes changes
  useEffect(() => {
    const h = Math.floor((Number(localDurationMinutes) || 0) / 60);
    const m = (Number(localDurationMinutes) || 0) % 60;
    setLocalHours(h);
    setLocalMinutesVal(m);
    setDurationInput(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }, [localDurationMinutes]);

  const parseDurationString = (v) => {
    const raw = (v || '').trim();
    let h = 0, m = 0;
    if (raw.includes(':')) {
      const parts = raw.split(':').map(p => p.replace(/[^0-9]/g, ''));
      h = Number(parts[0]) || 0;
      m = Number(parts[1]) || 0;
    } else {
      // treat plain numbers as hours (e.g. "2" -> 2 hours)
      const n = Number(raw.replace(/[^0-9]/g, ''));
      if (!Number.isNaN(n)) {
        h = n;
        m = 0;
      }
    }
    m = Math.max(0, Math.min(59, m));
    h = Math.max(0, h);
    return { h, m, total: h * 60 + m };
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const v = validateForm(e.target);
    if (!v.ok) { alert(v.message || 'Invalid input'); return; }
    try {
      // close modal immediately on save click; continue saving in background
      onClose();
      // ensure we parse the duration input before saving (in case user didn't blur)
      const parsedForSave = parseDurationString(durationInput);
      setLocalDurationMinutes(parsedForSave.total);
      const ref = doc(db, 'services', id);
      const beforeSnap = await getDoc(ref);
      const before = beforeSnap.exists() ? beforeSnap.data() : null;

      const cleanName = sanitizeName(data.name || '');

      await updateDoc(ref, {
        name: cleanName,
        price: Number(data.price) || 0,
        duration: parsedForSave.total ? `${parsedForSave.total}m` : (data.duration || ''),
        durationMinutes: Number(parsedForSave.total) || 0,
        type: data.type,
        imageBase64: imageBase64 || null,
        imageUrl: imageBase64 || null,
        imageName: imageName || null
      });

      // History record
      try {
        const auth = getAuth();
        const user = auth.currentUser;
        const actor = user ? { uid: user.uid, email: user.email } : null;
          try { await logHistory({ action: 'update', collection: 'services', docId: id, before, after: { name: cleanName, price: Number(data.price) || 0, duration: parsedForSave.total ? `${parsedForSave.total}m` : (data.duration || ''), durationMinutes: Number(parsedForSave.total) || 0, type: data.type, imageUrl: imageBase64 || null } }); } catch (e) { console.warn('history logger failed', e); }
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
        <form onSubmit={onSubmit} style={{ background: 'var(--surface, #232323)', color: '#fbfbfb', fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', padding: 16, borderRadius: 8, width: 'min(560px, 92%)', maxHeight: '80vh', overflow: 'auto', border: '1px solid rgba(184,136,11,0.25)' }}>
          <h3 style={{ marginTop: 0 }}>Edit Service</h3>
          {loading || !data ? <div>Loading…</div> : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{ gridColumn: '1 / 2' }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 400, marginBottom: 6, fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>Name</label>
                <input required value={data.name || ''} onChange={e => onChange('name', e.target.value)} style={{ width: '80%', padding: 8, background: 'var(--surface)', border: '1px solid var(--border-main)', color: 'var(--text-primary)', fontSize: 14, fontWeight: 400, fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }} />
              </div>
              <div style={{ gridColumn: '2 / 3' }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 400, marginBottom: 6, fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>Type</label>
                <select value={data.type || 'hair'} onChange={e => onChange('type', e.target.value)} style={{ width: '80%', padding: 8, background: 'var(--surface)', border: '1px solid var(--border-main)', color: 'var(--text-primary)', fontSize: 14, fontWeight: 400, fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>
                  <option value="hair">Hair</option>
                  <option value="skin">Skin</option>
                  <option value="nails">Nails</option>
                </select>
              </div>
              <div style={{ gridColumn: '1 / 2' }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 400, marginBottom: 6, fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>Price</label>
                <input required value={data.price || ''} onChange={e => onChange('price', e.target.value)} type="number" step="0.01" style={{ width: '80%', padding: 8, background: 'var(--surface)', border: '1px solid var(--border-main)', color: 'var(--text-primary)', fontSize: 14, fontWeight: 400, fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }} />
              </div>
              <div style={{ gridColumn: '2 / 3' }}>
                <label style={{ display: 'block', fontSize: 12, marginBottom: 6 }}>Duration (HH:MM)</label>
                <input
                  value={durationInput}
                  onChange={e => setDurationInput(e.target.value)}
                  onBlur={e => {
                    const parsed = parseDurationString(e.target.value);
                    setLocalHours(parsed.h);
                    setLocalMinutesVal(parsed.m);
                    setLocalDurationMinutes(parsed.total);
                    setDurationInput(`${String(parsed.h).padStart(2, '0')}:${String(parsed.m).padStart(2, '0')}`);
                  }}
                  placeholder="00:00"
                  style={{ width: '80%', padding: 8, background: 'var(--surface)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }}
                />
                <div style={{ marginTop: 8, color: 'var(--muted)' }}>Selected: {formatMinutes(localDurationMinutes)}</div>
              </div>

              {/* Products used removed per request */}

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 400, marginBottom: 6, fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>Image (optional)</label>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={async (e) => {
                  const f = e.target.files && e.target.files[0];
                  if (!f) return;
                  setImageName(f.name || '');
                  const reader = new FileReader();
                  reader.onload = () => { const result = reader.result; setImageBase64(result); };
                  reader.onerror = () => { console.error('Failed to read image file'); setImageBase64(null); };
                  reader.readAsDataURL(f);
                }} style={{ width: '100%' }} />
                {imageBase64 ? (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{imageName}</div>
                    <img src={imageBase64} alt="preview" style={{ marginTop: 6, maxWidth: 240, maxHeight: 160, objectFit: 'cover', borderRadius: 6 }} />
                    <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                      <button type="button" onClick={() => { if (fileInputRef.current) fileInputRef.current.click(); }} style={{ padding: '6px 10px', background: 'transparent', border: '1px solid rgba(184,136,11,0.35)', color: '#fbfbfb', cursor: 'pointer', borderRadius: 6 }}>Reupload</button>
                      <button type="button" onClick={() => { setImageBase64(null); setImageName(''); if (fileInputRef.current) fileInputRef.current.value = null; }} style={{ padding: '6px 10px', background: 'transparent', border: '1px solid rgba(255,255,255,0.06)', color: '#fbfbfb', cursor: 'pointer', borderRadius: 6 }}>Remove</button>
                    </div>
                  </div>
                ) : null}
              </div>

              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={onClose} style={{ padding: '8px 12px', background: 'transparent', border: '1px solid rgba(255,255,255,0.06)', color: '#fbfbfb' }}>Cancel</button>
                <button type="submit" className="button-gold-dark" style={{ padding: '8px 12px', background: 'transparent', border: '1px solid rgba(184,136,11,0.35)', color: '#fbfbfb' }}>Save</button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default EditServiceModal;
