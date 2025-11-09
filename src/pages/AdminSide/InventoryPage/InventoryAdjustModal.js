// InventoryAdjustModal: apply delta adjustment to a product for a branch.
import React, { useState } from 'react';
import { adjustInventoryRecord } from '../../../utils/inventoryActions';
import { db } from '../../../firebase';
import { getAuth } from 'firebase/auth';

export default function InventoryAdjustModal({ open, onClose, product = {}, branches = [], initialBranch = '', onDone }) {
  const [branch, setBranch] = useState(initialBranch || '');
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const submit = async () => {
    const d = Number(delta);
    if (Number.isNaN(d) || d === 0) {
      alert('Enter a non-zero number for change');
      return;
    }
    setLoading(true);
    try {
      const auth = getAuth();
      const user = auth.currentUser;
  // Branch fallback
      const branchKey = branch || initialBranch || (branches && branches[0] && (branches[0].id || branches[0].name)) || '';
      await adjustInventoryRecord(db, product.id, branchKey, d, user, reason);
      if (onDone) onDone();
      onClose();
    } catch (err) {
      console.error('adjust failed', err);
      alert('Failed to update inventory: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={() => onClose()}
      style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.25)', zIndex: 1000 }}
    >
  <div onClick={e => e.stopPropagation()} style={{ width: 'min(520px, 92%)', maxWidth: 520, background: 'var(--bg-drawer, #fff)', color: 'var(--text-main, #181818)', borderRadius: 8, padding: 14, boxShadow: '0 6px 18px rgba(0,0,0,0.12)', border: '1px solid var(--border-main, rgba(0,0,0,0.08))' }}>
        <h3 style={{ marginTop: 0, marginBottom: 8, fontSize: 18 }}>Adjust inventory for {product.name || product.title || product.id}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label>
            Branch (optional)
            <select value={branch} onChange={(e) => setBranch(e.target.value)} style={{ width: '100%', padding: 8, marginTop: 6 }}>
              <option value=''>-- select branch --</option>
              {branches && branches.length ? branches.map(b => <option key={b.id || b.name} value={b.id || b.name}>{b.name || b.id}</option>) : null}
            </select>
          </label>

          <label>
            Change (use negative to remove)
            <input type='number' value={delta} onChange={(e) => setDelta(e.target.value)} style={{ width: '100%', padding: 8, marginTop: 6 }} />
          </label>

          <label>
            Reason (optional)
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder='e.g. Received shipment' style={{ width: '100%', padding: 8, marginTop: 6 }} />
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
            <button onClick={onClose} disabled={loading} style={{ padding: '8px 12px' }}>Cancel</button>
            <button onClick={submit} disabled={loading} style={{ padding: '8px 12px', background: 'var(--btn-bg, #0ea5e9)', color: 'var(--text-primary, #fff)', border: 'none', borderRadius: 6 }}>{loading ? 'Saving...' : 'Submit'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
