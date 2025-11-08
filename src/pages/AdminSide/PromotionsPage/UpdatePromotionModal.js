import React, { useEffect, useMemo, useState } from 'react';
import { doc, updateDoc, collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../../firebase';
import { logHistory } from '../../../utils/historyLogger';

// Props:
//  - fieldWidths: optional object mapping field keys to CSS width (e.g. { title: '60%', branch: '48%' })
//    supported keys: title, subtitle, service, type, start, end, branch, status
export default function UpdatePromotionModal({ open, data, onClose, fieldWidths = {} }) {
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [services, setServices] = useState([]);
  const [type, setType] = useState('');
  const [branch, setBranch] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [status, setStatus] = useState('active');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const col = collection(db, 'services');
    const unsub = onSnapshot(col, snap => {
      setServices(snap.docs.map(d => ({ id: d.id, name: d.data().name || 'Unnamed service' })));
    });
    return () => unsub();
  }, [open]);

  useEffect(() => {
    if (!open || !data) return;
    setTitle(data.title || '');
    setSubtitle(data.subtitle || '');
    setServiceId(data.serviceId || '');
    setType(data.type || '');
    setBranch(data.branch || '');
    const s = data.startDate?.toDate ? data.startDate.toDate() : (data.startDate instanceof Date ? data.startDate : (data.startDate ? new Date(data.startDate) : null));
    const e = data.endDate?.toDate ? data.endDate.toDate() : (data.endDate instanceof Date ? data.endDate : (data.endDate ? new Date(data.endDate) : null));
    setStart(s ? formatDateInput(s) : '');
    setEnd(e ? formatDateInput(e) : '');
    setStatus(data.status || 'active');
  }, [open, data]);

  const formatDateInput = (d) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!data?.id) return;
    if (!title.trim()) { alert('Title required'); return; }
    if (!branch) { alert('Select branch'); return; }
    if (!type) { alert('Select type'); return; }
    if (!start || !end) { alert('Provide start and end'); return; }
    try {
      setSaving(true);
      const startDate = new Date(start);
      const endDate = new Date(end);
      if (endDate < startDate) { alert('End must be after start'); setSaving(false); return; }
      const svc = services.find(s => s.id === serviceId);
      const updates = {
        title: title.trim(),
        subtitle: subtitle.trim() || null,
        serviceId: serviceId || null,
        serviceName: svc ? svc.name : (data.serviceName || null),
        branch,
        type,
        startDate,
        endDate,
        status,
      };
      await updateDoc(doc(db, 'promotions', data.id), updates);
      try { await logHistory({ action: 'update', collection: 'promotions', docId: data.id, before: data, after: updates }); } catch {}
      onClose && onClose();
    } catch (err) {
      console.error('update promotion failed', err);
      alert('Failed to update promotion: ' + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }}>
      <form onSubmit={handleSave} style={{ width: 'min(520px, 92%)', background: 'var(--bg-drawer)', color: 'var(--text-main)', border: '1px solid var(--border-main)', borderRadius: 12, padding: 20, boxShadow: '0 12px 38px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h3 style={{ margin: 0 }}>Update Promotion</h3>
        <label style={{ fontSize: 13, width: fieldWidths.title || '100%' }}>Title
          <input value={title} onChange={e => setTitle(e.target.value)} style={{ ...inputStyle, width: '94%' }} />
        </label>
        <label style={{ fontSize: 13, width: fieldWidths.subtitle || '100%' }}>Subtitle
          <input value={subtitle} onChange={e => setSubtitle(e.target.value)} style={{ ...inputStyle, width: '94%' }} />
        </label>
        <div style={{ display: 'flex', gap: 12 }}>
          <label style={{ fontSize: 13, flex: fieldWidths.service ? '0 0 auto' : 1, width: fieldWidths.service || undefined }}>Service
            <select value={serviceId} onChange={e => setServiceId(e.target.value)} style={{ ...inputStyle, width: '100%' }}>
              <option value=''>-- select service --</option>
              {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 13, flex: fieldWidths.type ? '0 0 auto' : 1, width: fieldWidths.type || undefined }}>Type
            <select value={type} onChange={e => setType(e.target.value)} style={{ ...inputStyle, width: '100%' }}>
              <option value=''>-- type --</option>
              <option value='Flash Offers'>Flash Offers</option>
              <option value='Promo'>Promo</option>
            </select>
          </label>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <label style={{ fontSize: 13, flex: fieldWidths.start ? '0 0 auto' : 1, width: fieldWidths.start || undefined }}>Start
            <input type='date' value={start} onChange={e => setStart(e.target.value)} style={{ ...inputStyle, width: '90%' }} />
          </label>
          <label style={{ fontSize: 13, flex: fieldWidths.end ? '0 0 auto' : 1, width: fieldWidths.end || undefined }}>End
            <input type='date' value={end} onChange={e => setEnd(e.target.value)} style={{ ...inputStyle, width: '90%' }} />
          </label>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <label style={{ fontSize: 13, flex: fieldWidths.branch ? '0 0 auto' : 1, width: fieldWidths.branch || undefined }}>Branch
            <input value={branch} onChange={e => setBranch(e.target.value)} style={{ ...inputStyle, width: '90%' }} />
          </label>
          <label style={{ fontSize: 13, flex: fieldWidths.status ? '0 0 auto' : 1, width: fieldWidths.status || undefined }}>Status
            <select value={status} onChange={e => setStatus(e.target.value)} style={{ ...inputStyle, width: '90%' }}>
              <option value='active'>Active</option>
              <option value='expired'>Expired</option>
            </select>
          </label>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
          <button type='button' onClick={onClose} style={btnMinorStyle} disabled={saving}>Cancel</button>
          <button type='submit' style={btnPrimaryStyle} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '8px 10px', marginTop: 4, borderRadius: 8, border: '1px solid var(--border-main)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: 14
};
const btnPrimaryStyle = { background: 'var(--text-main)', color: 'var(--bg-main)', border: 'none', padding: '8px 16px', fontWeight: 700, borderRadius: 8, cursor: 'pointer' };
const btnMinorStyle = { background: 'none', color: 'var(--text-main)', border: '1px solid var(--border-main)', padding: '8px 16px', fontWeight: 600, borderRadius: 8, cursor: 'pointer' };
