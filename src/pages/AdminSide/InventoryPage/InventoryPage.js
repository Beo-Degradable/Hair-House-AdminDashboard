// Inventory management UI: list products (linked + unlinked), filter by branch/search,
// and allow inline quantity edits with audit/history.
import React, { useState, useMemo } from 'react';
import useMediaQuery from '../../../hooks/useMediaQuery';
import useInventory from '../../../hooks/useInventory';
import ValidatedInput from '../../../components/ValidatedInput';
import { deleteDoc, doc, updateDoc, serverTimestamp, addDoc, collection, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { getAuth } from 'firebase/auth';
import { logHistory } from '../../../utils/historyLogger';
import { sanitizeForSearch } from '../../../utils/validators';
import { adjustInventoryRecord } from '../../../utils/inventoryActions';
import InventoryModal from './InventoryModal';
import AddInventoryModal from './AddInventoryModal';

const InventoryRow = ({ it, qty }) => {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: 8, borderBottom: '1px solid var(--border-main)' }}>
      <div>{it.name}</div>
      <div>{qty}</div>
    </div>
  );
};

const InventoryPage = () => {
  const { items = [], branches = [], inventoryMap = {}, inventoryDocs = [], loading, refresh } = useInventory();
  const isMobile = useMediaQuery('(max-width: 640px)');
  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [addInvOpen, setAddInvOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [editingLoading, setEditingLoading] = useState(false);
  const [editingRawId, setEditingRawId] = useState(null);
  const [editRawValue, setEditRawValue] = useState('');
  const [editingRawLoading, setEditingRawLoading] = useState(false);
  const defaultBranchMap = [
    { id: 'B001', name: 'Vergara' },
    { id: 'B002', name: 'Lawas' },
    { id: 'B003', name: 'Lipa' },
    { id: 'B004', name: 'Tanauan' },
  ];
  const branchKeyMatches = (key) => {
    if (!selectedBranch) return true;
    if (!key) return false;
    if (key === selectedBranch) return true;
    const branchList = (branches && branches.length > 0) ? branches : defaultBranchMap;
    const mapped = branchList.find(br => br.id === key || br.name === key);
    if (mapped && mapped.name === selectedBranch) return true;
    return false;
  };
  

  const filtered = useMemo(() => {
    // Build display list: linked products via inventoryMap, then group unlinked docs by name.
    const displayItems = (() => {
      const invKeys = Object.keys(inventoryMap || {});
      const itemsOut = [];

      invKeys.forEach(pid => {
        const prod = items.find(p => p.id === pid || p.sku === pid) || {};
        const invDoc = inventoryDocs.find(d => d.productId === pid) || {};
        itemsOut.push({ id: pid, name: invDoc.productName || prod.name || pid });
      });

      // Include unlinked inventory docs grouped by productName
      const unlinked = inventoryDocs.filter(d => {
        const notLinked = !d.productId || !items.find(p => p.id === d.productId || p.sku === d.productId);
        return notLinked && d.productName;
      }).reduce((acc, d) => {
        const key = String(d.productName).trim();
        if (!acc[key]) acc[key] = [];
        acc[key].push(d);
        return acc;
      }, {});
      Object.keys(unlinked).forEach(name => {
        const sid = `unlinked:${name}`;
        itemsOut.push({ id: sid, name });
      });

      return itemsOut;
    })();

    let list = displayItems.slice();

    if (query) {
      const q = query.toLowerCase();
      list = list.filter(i => (i.name || '').toLowerCase().includes(q));
    }

    // If a branch is selected, only keep items with positive qty for that branch
    if (selectedBranch) {
      const branchList = (branches && branches.length > 0) ? branches : defaultBranchMap;
      const branchKeyMatches = (key) => {
        if (!key) return false;
        if (key === selectedBranch) return true;
        const mapped = branchList.find(br => br.id === key || br.name === key);
        if (mapped && mapped.name === selectedBranch) return true;
        return false;
      };

      list = list.filter(item => {
        if (!item) return false;
        const pid = item.id;
        const invForProduct = inventoryMap[pid] || {};
        const keys = Object.keys(invForProduct || {});
        for (const k of keys) {
          if (branchKeyMatches(k) && Number(invForProduct[k].quantity || 0) > 0) return true;
        }
        let docs = [];
        if (String(pid).startsWith('unlinked:')) {
          const pname = pid.replace('unlinked:', '');
          docs = (inventoryDocs || []).filter(d => !d.productId && String(d.productName || '') === pname);
        } else {
          docs = (inventoryDocs || []).filter(d => d.productId === pid);
        }
        const matched = docs.find(d => {
          if (!d) return false;
          if (d.branchName === selectedBranch) return true;
          if (d.branch === selectedBranch) return true;
          if (branchKeyMatches(d.branchId)) return true;
          return false;
        });
        return !!matched;
      });
    }

    return list;
  }, [items, query, selectedBranch, inventoryMap, inventoryDocs, branches]);

  // Prepare raw unlinked inventory docs once so we can render them without duplicating grouped entries
  const rawUnlinkedDocs = (() => {
    if (!inventoryDocs || inventoryDocs.length === 0) return [];
    const groupedNames = new Set((inventoryDocs || []).filter(d => {
      const notLinked = !d.productId || !items.find(p => p.id === d.productId || p.sku === d.productId);
      return notLinked && d.productName;
    }).map(d => String(d.productName).trim()));
    return inventoryDocs.filter(d => {
      const notLinked = !d.productId || !items.find(p => p.id === d.productId || p.sku === d.productId);
      const isGrouped = d.productName && groupedNames.has(String(d.productName).trim());
      return notLinked && !isGrouped;
    });
  })();

  return (
    <div style={{ padding: '0px 15px 16px 15px' }}>
      <div style={{ padding: '0px 0 4px 0' }}>
        <h2 style={{ margin: 0, marginTop: 0, marginBottom: isMobile ? 12 : 50 }}>Inventory</h2>
      </div>

      {/* Controls */}
      {!isMobile ? (
        <div style={{ padding: '6px 0 12px 0', display: 'flex', gap: 12, alignItems: 'center' }}>
          <ValidatedInput
            value={query}
            onChange={(v) => setQuery(sanitizeForSearch(v))}
            placeholder="Search inventory"
            style={{ padding: 8, borderRadius: 8, border: '1px solid var(--border-main)', minWidth: 200 }}
          />
          <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)} style={{ padding: 8, borderRadius: 8 }}>
            <option value=''>All branches</option>
            {(branches && branches.length > 0 ? branches : defaultBranchMap).map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
          </select>
          <div style={{ marginLeft: 'auto' }}>
            <button onClick={() => setAddInvOpen(true)} style={{ padding: '8px 12px', marginRight: 8, borderRadius: 8, border: '1px solid var(--border-main)', background: 'transparent', color: 'var(--white)' }}>Add Item</button>
            <button onClick={() => { console.log('[InventoryPage] manual refresh'); refresh && refresh(); }} style={{ padding: '8px 12px', marginLeft: 8, borderRadius: 8 }}>Refresh</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 12 }}>
          <div>
            <ValidatedInput
              value={query}
              onChange={(v) => setQuery(sanitizeForSearch(v))}
              placeholder="Search inventory"
              style={{ padding: 8, borderRadius: 8, border: '1px solid var(--border-main)', width: '100%' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)} style={{ padding: 8, borderRadius: 8 }}>
              <option value=''>All branches</option>
              {(branches && branches.length > 0 ? branches : defaultBranchMap).map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
            </select>
            <button onClick={() => setAddInvOpen(true)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-main)', background: 'transparent', color: 'var(--white)' }}>Add Item</button>
            <button onClick={() => { console.log('[InventoryPage] manual refresh'); refresh && refresh(); }} style={{ padding: '8px 12px', borderRadius: 8 }}>Refresh</button>
          </div>
        </div>
      )}

      <div style={{ marginBottom: 8, color: '#6b7280' }}>Inventory docs: {inventoryDocs ? inventoryDocs.length : 0}</div>
      <div style={{ border: '1px solid var(--border-main)', borderRadius: 8, overflowX: 'auto' }}>
        {(() => {
          if (loading) return <div style={{ padding: 12 }}>Loading inventory...</div>;

          return (
            <table style={{ minWidth: 720, width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-main)', background: 'var(--table-head-bg, transparent)' }}>
                  <th style={{ padding: '12px 16px' }}>Name</th>
                  <th style={{ padding: '12px 16px', width: 120 }}>Quantity</th>
                  <th style={{ padding: '12px 16px', width: 140 }}>Status</th>
                  <th style={{ padding: '12px 16px', width: 120 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(it => {
                  const pid = it.id;

                  // Inventory records for this product
                  let invForProduct = inventoryMap[pid] || {};
                  let perBranchEntries = Object.entries(invForProduct);

                  // If synthetic unlinked id, build per-branch entries from inventoryDocs
                  if (String(pid).startsWith('unlinked:')) {
                    const pname = pid.replace('unlinked:', '');
                    const docs = (inventoryDocs || []).filter(d => !d.productId && String(d.productName || '') === pname);
                    const map = {};
                    docs.forEach(d => {
                      const bk = d.branchId || d.branch || d.id;
                      map[bk] = { quantity: Number(d.quantity || 0), lastUpdated: d.lastUpdated || null, expiration: d.expiration || null };
                    });
                    invForProduct = map;
                    perBranchEntries = Object.entries(map);
                  }

                  // Quantity calculation
                  let qty = 0;
                  if (selectedBranch) {
                    const branchList = (branches && branches.length > 0) ? branches : defaultBranchMap;
                    const branchKeyMatches = (key) => {
                      if (!key) return false;
                      if (key === selectedBranch) return true;
                      const mapped = branchList.find(br => br.id === key || br.name === key);
                      if (mapped && mapped.name === selectedBranch) return true;
                      return false;
                    };

                    qty = Object.entries(invForProduct).reduce((s, [bk, rec]) => {
                      return s + ((branchKeyMatches(bk) ? Number(rec.quantity || 0) : 0));
                    }, 0);
                  } else {
                    if (perBranchEntries.length > 0) {
                      qty = perBranchEntries.reduce((s, [bk, rec]) => s + (Number(rec.quantity || 0)), 0);
                    } else {
                      qty = 0;
                    }
                  }

                  let status = 'In stock';
                  if (qty === 0) status = 'No stock';
                  else if (qty > 0 && qty <= 5) status = 'Low stock';

                  // For unlinked group, find a matching raw doc for the selected branch (if any)
                  const isUnlinkedGroup = String(pid).startsWith('unlinked:');
                  let rawForGroup = null;
                  if (isUnlinkedGroup) {
                    const pname = pid.replace('unlinked:', '');
                    rawForGroup = (inventoryDocs || []).find(d => !d.productId && String(d.productName || '') === pname && (d.branchName === selectedBranch || d.branch === selectedBranch || branchKeyMatches(d.branchId || d.branch || d.id)));
                  }

                  return (
                    <tr key={pid} style={{ borderBottom: '1px solid var(--border-main)' }}>
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ fontWeight: 600 }}>{it.name}</div>
                        <div style={{ marginTop: 6 }}>
                          {perBranchEntries.length > 0 ? (
                            !selectedBranch ? (
                              <div style={{ color: '#6b7280', fontSize: 13 }}>Total across {perBranchEntries.length} branch(es)</div>
                            ) : null
                          ) : (
                            <div style={{ color: '#6b7280', fontSize: 13 }}>No per-branch records</div>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '10px 16px' }}>{qty}</td>
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{ padding: '4px 8px', borderRadius: 12, fontSize: 12, color: '#fff', background: status === 'In stock' ? '#16a34a' : status === 'Low stock' ? '#f59e0b' : '#ef4444' }}>{status}</span>
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          {/* Inline update */}
                          {selectedBranch ? (
                            isUnlinkedGroup ? (
                              rawForGroup ? (
                                editingRawId === rawForGroup.id ? (
                                  <>
                                    <input type="number" value={editRawValue} onChange={e => setEditRawValue(e.target.value)} style={{ width: 80, padding: 6, borderRadius: 6 }} />
                                    <button disabled={editingRawLoading} onClick={async () => {
                                      const newQty = Number(editRawValue);
                                      if (Number.isNaN(newQty)) { alert('Enter a valid number'); return; }
                                      setEditingRawLoading(true);
                                      try {
                                        const invRef = doc(db, 'inventory', rawForGroup.id);
                                        const before = Number(rawForGroup.quantity || 0);
                                        await updateDoc(invRef, { quantity: newQty, lastUpdated: serverTimestamp() });
                                        const adjustmentsCol = collection(db, 'inventoryAdjustments');
                                        await addDoc(adjustmentsCol, {
                                          productId: rawForGroup.productId || null,
                                          branchId: rawForGroup.branchId || rawForGroup.branch || null,
                                          delta: Number(newQty - before),
                                          before,
                                          after: newQty,
                                          reason: 'Inline raw update',
                                          createdBy: null,
                                          createdAt: serverTimestamp(),
                                        });
                                        // history entry (include actor)
                                        try {
                                          const auth = getAuth();
                                          const user = auth.currentUser;
                                          const actor = user ? { uid: user.uid, email: user.email } : null;
                                          try { await logHistory({ action: 'update', collection: 'inventory', docId: rawForGroup.id, before: { quantity: before }, after: { quantity: newQty } }); } catch (hh) { console.warn('Failed to write history for inventory raw update', hh); }
                                        } catch (hh) { console.warn('Failed to write history for inventory raw update', hh); }
                                        refresh && refresh();
                                        setEditingRawId(null);
                                        setEditRawValue('');
                                      } catch (err) {
                                        console.error('Failed to update raw inventory doc', err);
                                        alert('Failed to update: ' + (err.message || err));
                                      } finally {
                                        setEditingRawLoading(false);
                                      }
                                    }} style={{ padding: '6px 10px', borderRadius: 6, background: '#16a34a', color: '#fff', border: 'none' }}>{editingRawLoading ? 'Saving...' : 'Confirm'}</button>
                                    <button disabled={editingRawLoading} onClick={() => { setEditingRawId(null); setEditRawValue(''); }} style={{ padding: '6px 10px', borderRadius: 6 }}>Cancel</button>
                                  </>
                                ) : (
                                  <button onClick={() => { setEditingRawId(rawForGroup.id); setEditRawValue(String(rawForGroup.quantity || 0)); }} style={{ padding: '6px 10px', borderRadius: 6 }}>Update</button>
                                )
                              ) : (
                                <button onClick={() => { alert('No editable unlinked inventory record found for the selected branch.'); }} style={{ padding: '6px 10px', borderRadius: 6 }}>Update</button>
                              )
                            ) : (
                              editingId === pid ? (
                                <>
                                  <input type="number" value={editValue} onChange={e => setEditValue(e.target.value)} style={{ width: 80, padding: 6, borderRadius: 6 }} />
                                  <button disabled={editingLoading} onClick={async () => {
                                    const newQty = Number(editValue);
                                    if (Number.isNaN(newQty)) { alert('Enter a valid number'); return; }
                                    const delta = newQty - qty;
                                    if (delta === 0) { setEditingId(null); return; }
                                    setEditingLoading(true);
                                    try {
                                      const auth = getAuth();
                                      const user = auth.currentUser;
                                      await adjustInventoryRecord(db, pid, selectedBranch, delta, user, 'Inline update');
                                      refresh && refresh();
                                      setEditingId(null);
                                    } catch (err) {
                                      console.error('Inline update failed', err);
                                      alert('Failed to update inventory: ' + (err.message || err));
                                    } finally {
                                      setEditingLoading(false);
                                    }
                                  }} style={{ padding: '6px 10px', borderRadius: 6, background: '#16a34a', color: '#fff', border: 'none' }}>{editingLoading ? 'Saving...' : 'Confirm'}</button>
                                  <button disabled={editingLoading} onClick={() => { setEditingId(null); setEditValue(''); }} style={{ padding: '6px 10px', borderRadius: 6 }}>Cancel</button>
                                </>
                              ) : (
                                <button onClick={() => { setEditingId(pid); setEditValue(String(qty)); }} style={{ padding: '6px 10px', borderRadius: 6 }}>Update</button>
                              )
                            )
                          ) : (
                            // No branch selected: show Update (opens inline editor) and allow deleting across branches
                            editingId === pid ? (
                              <>
                                <input type="number" value={editValue} onChange={e => setEditValue(e.target.value)} style={{ width: 80, padding: 6, borderRadius: 6 }} />
                                <button disabled={editingLoading} onClick={async () => {
                                  const newQty = Number(editValue);
                                  if (Number.isNaN(newQty)) { alert('Enter a valid number'); return; }
                                  const delta = newQty - qty;
                                  if (delta === 0) { setEditingId(null); return; }
                                  setEditingLoading(true);
                                  try {
                                    const auth = getAuth();
                                    const user = auth.currentUser;
                                    await adjustInventoryRecord(db, pid, selectedBranch, delta, user, 'Inline update');
                                    refresh && refresh();
                                    setEditingId(null);
                                  } catch (err) {
                                    console.error('Inline update failed', err);
                                    alert('Failed to update inventory: ' + (err.message || err));
                                  } finally {
                                    setEditingLoading(false);
                                  }
                                }} style={{ padding: '6px 10px', borderRadius: 6, background: '#16a34a', color: '#fff', border: 'none' }}>{editingLoading ? 'Saving...' : 'Confirm'}</button>
                                <button disabled={editingLoading} onClick={() => { setEditingId(null); setEditValue(''); }} style={{ padding: '6px 10px', borderRadius: 6 }}>Cancel</button>
                              </>
                            ) : (
                              <button onClick={() => { setEditingId(pid); setEditValue(String(qty)); }} style={{ padding: '6px 10px', borderRadius: 6 }}>Update</button>
                            )
                          )}

                          {/* Delete */}
                          <button onClick={async () => {
                            const confirmMsg = selectedBranch ? `Delete inventory records for "${it.name}" in ${selectedBranch}? This cannot be undone.` : `Delete all inventory documents for "${it.name}"? This cannot be undone.`;
                            if (!window.confirm(confirmMsg)) return;
                            try {
                              if (selectedBranch) {
                                // Delete docs only for the selected branch
                                if (isUnlinkedGroup) {
                                  const pname = pid.replace('unlinked:', '');
                                  const docsToDelete = (inventoryDocs || []).filter(d => !d.productId && String(d.productName || '') === pname && (d.branchName === selectedBranch || d.branch === selectedBranch || (d.branchId && branchKeyMatches(d.branchId)))).map(d => d.id).filter(Boolean);
                                  if (docsToDelete.length === 0) { alert('No matching inventory documents found to delete for this product and branch.'); return; }
                                  await Promise.all(docsToDelete.map(async id => {
                                    try {
                                      const snap = await getDoc(doc(db, 'inventory', id));
                                      const before = snap.exists() ? snap.data() : null;
                                      await deleteDoc(doc(db, 'inventory', id));
                                      try { await logHistory({ action: 'delete', collection: 'inventory', docId: id, before, after: null }); } catch (hh) { console.warn('History write failed', hh); }
                                    } catch (e) { console.warn('failed deleting doc', id, e); }
                                  }));
                                } else {
                                  const docsToDelete = (inventoryDocs || []).filter(d => d.productId === pid && (d.branchName === selectedBranch || d.branch === selectedBranch || (d.branchId && branchKeyMatches(d.branchId)))).map(d => d.id).filter(Boolean);
                                  if (docsToDelete.length === 0) { alert('No matching inventory documents found to delete for this product and branch.'); return; }
                                  await Promise.all(docsToDelete.map(async id => {
                                    try {
                                      const snap = await getDoc(doc(db, 'inventory', id));
                                      const before = snap.exists() ? snap.data() : null;
                                      await deleteDoc(doc(db, 'inventory', id));
                                      try { await logHistory({ action: 'delete', collection: 'inventory', docId: id, before, after: null }); } catch (hh) { console.warn('History write failed', hh); }
                                    } catch (e) { console.warn('failed deleting doc', id, e); }
                                  }));
                                }
                              } else {
                                // Delete across branches
                                if (isUnlinkedGroup) {
                                  const pname = pid.replace('unlinked:', '');
                                  const docsToDelete = (inventoryDocs || []).filter(d => !d.productId && String(d.productName || '') === pname).map(d => d.id).filter(Boolean);
                                  if (docsToDelete.length === 0) { alert('No matching inventory documents found to delete.'); return; }
                                  await Promise.all(docsToDelete.map(async id => {
                                    try {
                                      const snap = await getDoc(doc(db, 'inventory', id));
                                      const before = snap.exists() ? snap.data() : null;
                                      await deleteDoc(doc(db, 'inventory', id));
                                      try { await logHistory({ action: 'delete', collection: 'inventory', docId: id, before, after: null }); } catch (hh) { console.warn('History write failed', hh); }
                                    } catch (e) { console.warn('failed deleting doc', id, e); }
                                  }));
                                } else {
                                  const docsToDelete = (inventoryDocs || []).filter(d => d.productId === pid).map(d => d.id).filter(Boolean);
                                  if (docsToDelete.length === 0) { alert('No matching inventory documents found to delete for this product.'); return; }
                                  await Promise.all(docsToDelete.map(async id => {
                                    try {
                                      const snap = await getDoc(doc(db, 'inventory', id));
                                      const before = snap.exists() ? snap.data() : null;
                                      await deleteDoc(doc(db, 'inventory', id));
                                      try { await logHistory({ action: 'delete', collection: 'inventory', docId: id, before, after: null }); } catch (hh) { console.warn('History write failed', hh); }
                                    } catch (e) { console.warn('failed deleting doc', id, e); }
                                  }));
                                }
                              }
                              refresh && refresh();
                            } catch (err) {
                              console.error('Failed to delete inventory docs', err);
                              alert('Failed to delete: ' + (err.message || err));
                            }
                          }} style={{ padding: '6px 10px', borderRadius: 6, background: '#dc2626', color: '#fff', border: 'none' }}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {rawUnlinkedDocs && rawUnlinkedDocs.length > 0 ? (
                  rawUnlinkedDocs.map(d => (
                    <tr key={`inv-${d.id}`} style={{ borderBottom: '1px solid var(--border-main)', background: '#fff7ed' }}>
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ fontWeight: 600 }}>{d.productName || `Unlinked inventory (${d.id})`}</div>
                        <div style={{ marginTop: 6, color: '#6b7280', fontSize: 13 }}>
                          Branch: {d.branch || d.branchId || '—'}
                          {d.expiration ? ` • Exp: ${typeof d.expiration === 'object' && d.expiration.seconds ? new Date(d.expiration.seconds * 1000).toLocaleDateString() : String(d.expiration)}` : ''}
                        </div>
                      </td>
                      <td style={{ padding: '10px 16px' }}>{d.quantity ?? '—'}</td>
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{ padding: '4px 8px', borderRadius: 12, fontSize: 12, background: '#f97316', color: '#fff' }}>Unlinked</span>
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <button onClick={() => { navigator.clipboard && navigator.clipboard.writeText(d.id); }} style={{ padding: '6px 10px', borderRadius: 6 }}>Copy ID</button>
                          {branchKeyMatches(d.branchId || d.branch || d.id) && editingRawId === d.id ? (
                            <>
                              <input type="number" value={editRawValue} onChange={e => setEditRawValue(e.target.value)} style={{ width: 80, padding: 6, borderRadius: 6 }} />
                              <button disabled={editingRawLoading} onClick={async () => {
                                const newQty = Number(editRawValue);
                                if (Number.isNaN(newQty)) { alert('Enter a valid number'); return; }
                                setEditingRawLoading(true);
                                try {
                                  // update the inventory doc directly
                                  const invRef = doc(db, 'inventory', d.id);
                                  const before = Number(d.quantity || 0);
                                  await updateDoc(invRef, { quantity: newQty, lastUpdated: serverTimestamp() });
                                  // audit record
                                  const adjustmentsCol = collection(db, 'inventoryAdjustments');
                                  await addDoc(adjustmentsCol, {
                                    productId: d.productId || null,
                                    branchId: d.branchId || d.branch || null,
                                    delta: Number(newQty - before),
                                    before,
                                    after: newQty,
                                    reason: 'Inline raw update',
                                    createdBy: null,
                                    createdAt: serverTimestamp(),
                                  });
                                  // history
                                  try {
                                    try { await logHistory({ action: 'update', collection: 'inventory', docId: d.id, before: { quantity: before }, after: { quantity: newQty } }); } catch (e) { console.warn('history logger failed', e); }
                                  } catch (hh) { console.warn('Failed to write history for inventory raw update', hh); }
                                  refresh && refresh();
                                  setEditingRawId(null);
                                  setEditRawValue('');
                                } catch (err) {
                                  console.error('Failed to update raw inventory doc', err);
                                  alert('Failed to update: ' + (err.message || err));
                                } finally {
                                  setEditingRawLoading(false);
                                }
                              }} style={{ padding: '6px 10px', borderRadius: 6, background: '#16a34a', color: '#fff', border: 'none' }}>{editingRawLoading ? 'Saving...' : 'Confirm'}</button>
                              <button disabled={editingRawLoading} onClick={() => { setEditingRawId(null); setEditRawValue(''); }} style={{ padding: '6px 10px', borderRadius: 6 }}>Cancel</button>
                            </>
                          ) : (
                            <>
                              {branchKeyMatches(d.branchId || d.branch || d.id) ? (
                                <button onClick={() => { setEditingRawId(d.id); setEditRawValue(String(d.quantity || 0)); }} style={{ padding: '6px 10px', borderRadius: 6 }}>Update</button>
                              ) : null}
                              <button onClick={async () => {
                                if (!window.confirm('Delete inventory document "' + (d.id || '') + '"? This cannot be undone.')) return;
                                try {
                                    await deleteDoc(doc(db, 'inventory', d.id));
                                    try {
                                      try { await logHistory({ action: 'delete', collection: 'inventory', docId: d.id, before: d, after: null }); } catch (e) { console.warn('history logger failed', e); }
                                    } catch (hh) { console.warn('Failed to write history for inventory delete', hh); }
                                    refresh && refresh();
                                } catch (err) {
                                  console.error('Failed to delete inventory doc', err);
                                  alert('Failed to delete: ' + (err.message || err));
                                }
                              }} style={{ padding: '6px 10px', borderRadius: 6, background: '#ef4444', color: '#fff', border: 'none' }}>Delete</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : null}
              </tbody>
            </table>
          );
        })()}
      </div>

  <InventoryModal open={modalOpen} onClose={() => setModalOpen(false)} onAdded={() => { refresh && refresh(); setModalOpen(false); }} />
  <AddInventoryModal products={items} branches={branches} open={addInvOpen} onClose={() => setAddInvOpen(false)} onAdded={() => { refresh && refresh(); setAddInvOpen(false); }} />
    </div>
  );
};

export default InventoryPage;
