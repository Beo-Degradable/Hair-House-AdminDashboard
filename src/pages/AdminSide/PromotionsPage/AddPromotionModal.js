import React, { useEffect, useState } from 'react';
import { collection, addDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { db } from '../../../firebase';
import { logHistory } from '../../../utils/historyLogger';

// Modal to add a promotion document to Firestore 'promotions' collection.
// Expected fields: title, subtitle, service, branch, type, startDate, endDate, status
// startDate/endDate stored as JS Date (Firestore will convert) + createdAt timestamp.
// Props:
//  - fieldWidths: optional object mapping field keys to CSS width (e.g. { title: '60%', branch: '48%' })
//    supported keys: title, subtitle, service, branch, type, start, end, status
export default function AddPromotionModal({ open, onClose, onCreated, defaultBranch = '', fieldWidths = {} }) {
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [services, setServices] = useState([]);
  const [branch, setBranch] = useState(defaultBranch || '');
  const [type, setType] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [status, setStatus] = useState('active'); // active | expired
  const [loading, setLoading] = useState(false);

  const branches = ['Vergara', 'Lawas', 'Lipa', 'Tanauan'];

  useEffect(() => {
    if (!open) return;
    const col = collection(db, 'services');
    const unsub = onSnapshot(col, snap => {
      setServices(snap.docs.map(d => ({ id: d.id, name: d.data().name || 'Unnamed service' })));
    });
    return () => unsub();
  }, [open]);

  const reset = () => {
    setTitle('');
    setSubtitle('');
    setServiceId('');
    setBranch(defaultBranch || '');
    setType('');
    setStart('');
    setEnd('');
    setStatus('active');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) { alert('Title required'); return; }
    if (!branch) { alert('Select branch'); return; }
    if (!type) { alert('Select promo type'); return; }
    if (!start || !end) { alert('Provide start and end dates'); return; }
    try {
      const startDate = new Date(start);
      const endDate = new Date(end);
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) { alert('Invalid dates'); return; }
      if (endDate < startDate) { alert('End must be after start'); return; }
      setLoading(true);

      const svc = services.find(s => s.id === serviceId);
      const data = {
        title: title.trim(),
        subtitle: subtitle.trim() || null,
        serviceId: serviceId || null,
        serviceName: svc ? svc.name : null,
        branch,
        type,
        startDate,
        endDate,
        status,
        createdAt: serverTimestamp(),
      };

      const ref = await addDoc(collection(db, 'promotions'), data);
      try { await logHistory({ action: 'create', collection: 'promotions', docId: ref.id, before: null, after: data }); } catch {}
      onCreated && onCreated({ id: ref.id, ...data });
      reset();
      onClose && onClose();
    } catch (err) {
      console.error('Create promotion failed', err);
      alert('Failed to create promotion: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }}>
      <form onSubmit={handleSubmit} style={{ width: 'min(520px, 92%)', background: 'var(--bg-drawer)', color: 'var(--text-main)', border: '1px solid var(--border-main)', borderRadius: 12, padding: 20, boxShadow: '0 12px 38px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h3 style={{ margin: 0 }}>Add Promotion</h3>
        <label style={{ fontSize: 13, width: fieldWidths.title || '94%' }}>Title
          <input value={title} onChange={e => setTitle(e.target.value)} required style={{ ...inputStyle, width: '100%' }} placeholder='Summer Discount' />
        </label>
        <label style={{ fontSize: 13, width: fieldWidths.subtitle || '94%' }}>Subtitle
          <input value={subtitle} onChange={e => setSubtitle(e.target.value)} style={{ ...inputStyle, width: '100%' }} placeholder='Limited time only' />
        </label>
        <div style={{ display: 'flex', gap: 12 }}>
          <label style={{ fontSize: 13, flex: fieldWidths.service ? '0 0 auto' : 1, width: fieldWidths.service || undefined }}>Service
            <select value={serviceId} onChange={e => setServiceId(e.target.value)} style={{ ...inputStyle, width: '100%' }}>
              <option value=''>-- select service --</option>
              {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 13, flex: fieldWidths.type ? '0 0 auto' : 1, width: fieldWidths.type || undefined }}>Type
            <select value={type} onChange={e => setType(e.target.value)} required style={{ ...inputStyle, width: '100%' }}>
              <option value=''>-- select type --</option>
              <option value='Flash Offers'>Flash Offers</option>
              <option value='Promo'>Promo</option>
            </select>
          </label>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <label style={{ fontSize: 13, flex: fieldWidths.start ? '0 0 auto' : 1, width: fieldWidths.start || undefined }}>Start
            <input type='date' value={start} onChange={e => setStart(e.target.value)} required style={{ ...inputStyle, width: '90%' }} />
          </label>
          <label style={{ fontSize: 13, flex: fieldWidths.end ? '0 0 auto' : 1, width: fieldWidths.end || undefined }}>End
            <input type='date' value={end} onChange={e => setEnd(e.target.value)} required style={{ ...inputStyle, width: '90%' }} />
          </label>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <label style={{ fontSize: 13, flex: fieldWidths.branch ? '0 0 auto' : 1, width: fieldWidths.branch || undefined }}>Branch
            <select value={branch} onChange={e => setBranch(e.target.value)} required style={{ ...inputStyle, width: '100%' }}>
              <option value=''>-- select branch --</option>
              {branches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 13, flex: fieldWidths.status ? '0 0 auto' : 1, width: fieldWidths.status || undefined }}>Status
            <select value={status} onChange={e => setStatus(e.target.value)} style={{ ...inputStyle, width: '100%' }}>
              <option value='active'>Active</option>
              <option value='expired'>Expired</option>
            </select>
          </label>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
          <button type='button' onClick={() => { reset(); onClose && onClose(); }} style={btnMinorStyle} disabled={loading}>Cancel</button>
          <button type='submit' disabled={loading} style={btnPrimaryStyle}>{loading ? 'Creating...' : 'Create'}</button>
        </div>
      </form>
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '8px 10px', marginTop: 4, borderRadius: 8, border: '1px solid var(--border-main)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: 14
};

const btnPrimaryStyle = {
  background: 'var(--text-main)', color: 'var(--bg-main)', border: 'none', padding: '8px 16px', fontWeight: 700, borderRadius: 8, cursor: 'pointer'
};

const btnMinorStyle = {
  background: 'none', color: 'var(--text-main)', border: '1px solid var(--border-main)', padding: '8px 16px', fontWeight: 600, borderRadius: 8, cursor: 'pointer'
};
