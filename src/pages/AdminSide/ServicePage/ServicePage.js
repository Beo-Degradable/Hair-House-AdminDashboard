// Services list: filter by type/search, CRUD via modals, simple table layout.
import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { sanitizeForSearch } from '../../../utils/validators';
import { db } from '../../../firebase';
import AddServiceModal from './AddServiceModal';
import EditServiceModal from './EditServiceModal';
import useMediaQuery from '../../../hooks/useMediaQuery';

const formatPeso = (v) => {
  const n = Number(v || 0);
  return `₱${n.toFixed(2)}`;
};

// Compact card (unused in table view; kept for future use)
const ServiceCard = ({ s, onEdit, onDelete }) => (
  <div style={{ border: '1px solid var(--border-main)', borderRadius: 8, padding: 12, background: 'var(--bg-drawer)', boxSizing: 'border-box', width: '100%' }}>
    <div style={{ fontWeight: 700, marginBottom: 6 }}>{s.name}</div>
    <div style={{ color: 'var(--muted)' }}>Duration: {s.duration}</div>
    <div style={{ color: 'var(--muted)' }}>Price: {formatPeso(s.price)}</div>
    <div style={{ marginTop: 8 }}>
      <button onClick={() => onEdit && onEdit(s.id)} className="button-gold-dark" style={{ padding: '6px 8px', marginRight: 8 }}>Edit</button>
      <button onClick={() => onDelete && onDelete(s.id)} className="btn btn-danger" style={{ padding: '6px 8px' }}>Delete</button>
    </div>
  </div>
);

const ServicePage = () => {
  const [query, setQuery] = useState('');
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedType, setSelectedType] = useState('');
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

  const filtered = services.filter(s => {
    const matchesQuery = (s.name || '').toLowerCase().includes(query.toLowerCase());
    const matchesType = selectedType ? (s.type === selectedType) : true;
    return matchesQuery && matchesType;
  });

  const formatDuration = (s) => {
    // prefer durationMinutes if present, else use duration string
    if (s.durationMinutes !== undefined && s.durationMinutes !== null) {
      const m = Number(s.durationMinutes) || 0;
      if (m % 60 === 0) return `${m/60} hr${m/60 > 1 ? 's' : ''}`;
      if (m > 60) return `${Math.floor(m/60)} hr ${m%60} min`;
      return `${m} min`;
    }
    return s.duration || '';
  };

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
    <div style={{ padding: 24 }}>
      <h2>Services</h2>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
  <input value={query} onChange={(e) => setQuery(sanitizeForSearch(e.target.value))} placeholder="Search services" style={{ padding: 8, borderRadius: 8, border: '1px solid var(--border-main)' }} />
        {/* On desktop show dropdown next to search, on mobile show Add button here and the pill buttons below */}
        {isDesktop ? (
          <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} style={{ marginLeft: 8, padding: 8, borderRadius: 8, border: '1px solid var(--border-main)', background: 'var(--surface)', color: 'var(--text-primary)' }}>
            <option value="">All types</option>
            <option value="hair">Hair</option>
            <option value="skin">Skin</option>
            <option value="nails">Nails</option>
          </select>
        ) : null}

        <button onClick={() => setAddOpen(true)} className="button-gold-dark" style={{ padding: '8px 16px', borderRadius: 999 }}>Add Service</button>
        {loading ? <div style={{ marginLeft: 12 }}>Loading…</div> : null}
      </div>

      {/* On mobile show the pill buttons row; hide on desktop since dropdown is used there */}
      {!isDesktop ? (
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          {['hair','skin','nails'].map(t => {
            const isActive = selectedType === t;
            return (
              <button key={t} onClick={() => setSelectedType(isActive ? '' : t)} style={{
                padding: '9px 14px',
                minWidth: 96,
                borderRadius: 7,
                background: isActive ? '#b8860b' : 'var(--dark-grey)',
                color: isActive ? 'var(--black)' : 'var(--text-primary)',
                border: `1px solid ${isActive ? 'var(--dark-grey)' : 'var(--gold)'}`,
                fontWeight: 600,
              }}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
            );
          })}
        </div>
      ) : null}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-main)', background: 'var(--table-head-bg, transparent)' }}>
              <th style={{ padding: '12px 16px' }}>Name</th>
              <th style={{ padding: '12px 16px' }}>Duration</th>
              <th style={{ padding: '12px 16px' }}>Price</th>
              <th style={{ padding: '12px 16px' }}>Type</th>
              <th style={{ padding: '12px 16px', width: 160 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => (
              <tr key={s.id} style={{ borderBottom: '1px solid var(--border-main)' }}>
                <td style={{ padding: '12px 16px' }}>{s.name}</td>
                <td style={{ padding: '12px 16px' }}>{formatDuration(s)}</td>
                <td style={{ padding: '12px 16px' }}>{formatPeso(s.price)}</td>
                <td style={{ padding: '12px 16px', textTransform: 'capitalize' }}>{s.type}</td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => { setEditingId(s.id); setEditOpen(true); }} className="button-gold-dark" style={{ padding: '6px 8px' }}>Edit</button>
                    <button onClick={() => handleDelete(s.id)} className="btn btn-danger" style={{ padding: '6px 8px' }}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AddServiceModal open={addOpen} onClose={() => setAddOpen(false)} />
      <EditServiceModal open={editOpen} id={editingId} onClose={() => { setEditOpen(false); setEditingId(null); }} />
    </div>
  );
};

export default ServicePage;
