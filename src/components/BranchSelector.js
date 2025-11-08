import React from 'react';

const BranchSelector = ({ branches = [], value, onChange }) => {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{ padding: 8, borderRadius: 8 }}>
      <option value=''>All branches</option>
      {(branches && branches.length > 0 ? branches : [{ id: 'B001', name: 'Vergara' }, { id: 'B002', name: 'Lawas' }]).map(b => (
        <option key={b.id} value={b.name}>{b.name}</option>
      ))}
    </select>
  );
};

export default BranchSelector;
