// Services list: filter by type/search, CRUD via modals, simple table layout.
import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
  const [addFixedType, setAddFixedType] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedType, setSelectedType] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const isDesktop = useMediaQuery('(min-width: 900px)');
  const [expandedSections, setExpandedSections] = useState({});
  const navigate = useNavigate();
  const [highlightedId, setHighlightedId] = useState(null);
  const rowRefs = useRef(new Map());
  const location = useLocation();

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

  // Highlight and scroll when ?id= is present
  useEffect(() => {
    if (!services || services.length === 0) return;
    try {
      const params = new URLSearchParams(location.search || '');
      const id = params.get('id');
      if (!id) return;
      const exists = services.find(s => s.id === id);
      if (!exists) return;
      setHighlightedId(id);
      const el = rowRefs.current.get(id);
      if (el && typeof el.scrollIntoView === 'function') {
        setTimeout(() => {
          try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { el.scrollIntoView(); }
        }, 60);
      }
      const clearId = setTimeout(() => setHighlightedId(null), 6000);
      return () => clearTimeout(clearId);
    } catch (e) {}
  }, [location.search, services]);

  // Branch definitions: map branch name -> allowed service types
  const BRANCH_MAP = {
    'Evangelista': ['hair', 'nails', 'skin', 'lashes'],
    'Lawas': ['hair', 'nails'],
    'Lipa': ['hair', 'nails', 'skin', 'lashes'],
    'Tanauan': ['hair', 'nails']
  };


  const filtered = services.filter(s => {
    const matchesQuery = (s.name || '').toLowerCase().includes(query.toLowerCase());
    const matchesType = selectedType ? (s.type === selectedType) : true;
    const svcType = (s.type || '').toLowerCase();
    const matchesBranch = selectedBranch ? (BRANCH_MAP[selectedBranch] || []).includes(svcType) : true;
    return matchesQuery && matchesType && matchesBranch;
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
    <div style={{ padding: '0px 12px', fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', color: 'var(--text-main)' }}>
      {loading ? <div style={{ marginBottom: 12 }}>Loading…</div> : null}

      {/* Branch selector buttons (horizontal) */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 0 }}>
        {['All branches', 'Evangelista', 'Lawas', 'Lipa', 'Tanauan'].map((b) => {
          const isAll = b === 'All branches';
          const key = isAll ? '' : b;
          const isActive = isAll ? (selectedBranch === '') : (selectedBranch === b);
              return (
            <button
              key={b}
              onClick={() => setSelectedBranch(isAll ? '' : b)}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                background: isActive ? 'rgba(184,136,11,0.12)' : 'transparent',
                color: 'var(--text-main)',
                border: `1px solid ${isActive ? 'rgba(184,136,11,0.45)' : 'rgba(184,136,11,0.35)'}`,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {b}
            </button>
          );
        })}
      </div>

      {/* Explicit type containers: Hair, Nails, Skin */}
      <div>
        {(() => {
          const byType = (typeMatch) => filtered.filter(s => {
            const t = (s.type || '').toLowerCase();
            const c = (s.category || '').toLowerCase();
            return t.includes(typeMatch) || c.includes(typeMatch);
          });

          const hairList = byType('hair');
          const nailsList = byType('nail');
          const skinList = byType('skin');
          const lashesList = byType('lash');

          // remaining others
          const consumed = new Set([...hairList.map(s => s.id), ...nailsList.map(s => s.id), ...skinList.map(s => s.id), ...lashesList.map(s => s.id)]);
          const others = filtered.filter(s => !consumed.has(s.id));

          const renderSection = (title, list, addType, alwaysShow=false) => {
            // show placeholder when empty if alwaysShow=true
            const empty = !list || list.length === 0;
            if (empty && !alwaysShow) return null;
            const expanded = !!expandedSections[title];
            // limit items: desktop 6 (3x2), mobile 4 (2x2)
            const limit = isDesktop ? 6 : 4;
            const displayList = expanded ? (list || []) : ((list || []).slice(0, limit));

            return (
              <section key={title} style={{ marginBottom: 20 }}>
                <div style={{ border: '1px solid var(--border-main)', borderRadius: 8, padding: 12, background: 'transparent' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <h3 style={{ margin: 0 }}>{title}</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <button onClick={() => { setAddFixedType(addType || ''); setAddOpen(true); }} style={{ padding: '8px 12px', borderRadius: 8, background: 'transparent', color: 'var(--text-main)', border: '1px solid rgba(184,136,11,0.35)', cursor: 'pointer' }}>Add Service</button>
                          {/* See-more removed per request: no toggle shown on any breakpoint */}
                        </div>
                        {addType ? (
                          <button
                              onClick={() => navigate(`/services/type/${addType}`)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                padding: 0,
                                margin: 0,
                                color: 'rgba(184,136,11,0.65)',
                                cursor: 'pointer',
                                fontSize: 13,
                                fontWeight: 600,
                                textDecoration: 'underline'
                              }}
                            >
                              {`View all ${addType}>>`}
                            </button>
                        ) : null}
                      </div>
                    </div>
                  {empty ? (
                    <div style={{ padding: 18, color: 'var(--muted)', borderRadius: 6, background: 'var(--surface)' }}>No services yet. Click "Add Service" to create one.</div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)', gap: 12 }}>
                      {displayList.map(s => (
                        <div key={s.id} ref={(el) => { if (el) rowRefs.current.set(s.id, el); }} style={{ background: 'var(--bg-drawer)', border: '1px solid var(--border-main)', borderRadius: 10, padding: 12, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontWeight: 700 }}>{(!isDesktop && s.name && s.name.length > 25) ? `${s.name.slice(0,22)}...` : s.name}</div>
                            <div style={{ width: 36, height: 36, borderRadius: 36, overflow: 'hidden', background: '#ddd', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {(s.imageUrl || s.imageBase64 || s.image) ? <img src={(s.imageUrl || s.imageBase64 || s.image)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ fontSize: 12, color: '#333' }}>Img</div>}
                            </div>
                          </div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{formatDuration(s)} {s.price != null ? `• ${formatPeso(s.price)}` : ''}</div>
                          <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                            <button onClick={() => { setEditingId(s.id); setEditOpen(true); }} style={{ padding: '6px 8px', background: 'transparent', color: 'var(--text-main)', border: '1px solid rgba(184,136,11,0.35)', borderRadius: 6, cursor: 'pointer' }}>Edit</button>
                            <button onClick={() => handleDelete(s.id)} className="btn btn-danger" style={{ padding: '6px 8px' }}>Delete</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            );
          };

          return (
            <>
              {renderSection('Hair Services', hairList, 'hair', true)}
              {renderSection('Nail & Hand Care', nailsList, 'nails', true)}
              {renderSection('Eyelash Services', lashesList, 'lashes', (selectedBranch === '' || (BRANCH_MAP[selectedBranch] || []).includes('lashes')))}
              {renderSection('Skin Services', skinList, 'skin', (selectedBranch === '' || (BRANCH_MAP[selectedBranch] || []).includes('skin')))}
              {others.length ? renderSection('Other Services', others, '') : null}
            </>
          );
        })()}
      </div>

      <AddServiceModal open={addOpen} fixedType={addFixedType} onClose={() => { setAddOpen(false); setAddFixedType(''); }} />
      <EditServiceModal open={editOpen} id={editingId} onClose={() => { setEditOpen(false); setEditingId(null); }} />
    </div>
  );
};

export default ServicePage;
