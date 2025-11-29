import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../../firebase';
import useMediaQuery from '../../../hooks/useMediaQuery';
import EditServiceModal from './EditServiceModal';

const formatPeso = (v) => {
  const n = Number(v || 0);
  return `₱${n.toFixed(2)}`;
};

const formatDuration = (s) => {
  if (s.durationMinutes !== undefined && s.durationMinutes !== null) {
    const m = Number(s.durationMinutes) || 0;
    if (m % 60 === 0) return `${m/60} hr${m/60 > 1 ? 's' : ''}`;
    if (m > 60) return `${Math.floor(m/60)} hr ${m%60} min`;
    return `${m} min`;
  }
  return s.duration || '';
};

const ServiceTypePage = () => {
  const { type } = useParams();
  const navigate = useNavigate();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const isDesktop = useMediaQuery('(min-width: 900px)');

  useEffect(() => {
    const col = collection(db, 'services');
    const unsub = onSnapshot(col, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setServices(list);
      setLoading(false);
    }, err => {
      console.error('services listener error', err);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const typeLower = (type || '').toLowerCase();
  const filtered = services.filter(s => {
    const t = (s.type || '').toLowerCase();
    const c = (s.category || '').toLowerCase();
    return t.includes(typeLower) || c.includes(typeLower);
  });

  const handleDelete = async (id) => {
    if (!id) return;
    const ok = window.confirm('Delete this service? This cannot be undone.');
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'services', id));
    } catch (err) {
      console.error('Failed to delete service', err);
      alert('Failed to delete service: ' + (err.message || err));
    }
  };

  return (
    <div style={{ padding: '12px 24px', fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', color: '#fbfbfb' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button className="btn" onClick={() => navigate(-1)} style={{ padding: '6px 10px' }}>Back</button>
          <h2 style={{ margin: 0, textTransform: 'capitalize' }}>{type || 'Services'}</h2>
        </div>
      </div>

      {loading ? <div>Loading…</div> : (
        <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)', gap: 12 }}>
          {filtered.map(s => (
            <div key={s.id} style={{ background: 'var(--bg-drawer)', border: '1px solid var(--border-main)', borderRadius: 10, padding: 12, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 700 }}>{s.name}</div>
                <div style={{ width: 36, height: 36, borderRadius: 36, overflow: 'hidden', background: '#ddd', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {s.imageUrl ? <img src={s.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ fontSize: 12, color: '#333' }}>Img</div>}
                </div>
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{formatDuration(s)} {s.price != null ? `• ${formatPeso(s.price)}` : ''}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setEditingId(s.id); setEditOpen(true); }} className="button-gold-dark" style={{ padding: '6px 8px' }}>Edit</button>
                <button onClick={() => handleDelete(s.id)} className="btn btn-danger" style={{ padding: '6px 8px' }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <EditServiceModal open={editOpen} id={editingId} onClose={() => { setEditOpen(false); setEditingId(null); }} />
    </div>
  );
};

export default ServiceTypePage;
