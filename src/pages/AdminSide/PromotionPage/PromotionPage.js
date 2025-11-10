// Promotions management: list active promotions and allow future CRUD expansion.
import React from 'react';

export default function PromotionPage() {
  return (
    <div style={{ padding: 24 }}>
      <h2>Promotions</h2>
      <p style={{ color: 'var(--icon-main)', fontSize: 14 }}>Manage service or product promotions here. (Placeholder)</p>
      <div style={{ marginTop: 16, padding: 16, border: '1px solid var(--border-main)', borderRadius: 8, background: 'var(--bg-drawer)' }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-main)' }}>No promotions yet.</p>
      </div>
    </div>
  );
}
