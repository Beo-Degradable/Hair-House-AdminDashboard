import React from 'react';
import { useStylistUI } from '../../context/StylistUIContext';
import { useNavigate } from 'react-router-dom';

// StylistSettingsPage — basic appearance toggle + quick links
export default function StylistSettingsPage() {
  const { darkMode, setDarkMode } = useStylistUI();
  const navigate = useNavigate();

  return (
    <div style={{ padding: 16, maxWidth: 820, margin: '0 auto', color: 'var(--text-main)' }}>
      <h2 style={{ marginTop: 0 }}>Settings</h2>

      {/* Theme section */}
      <section style={{ background: 'var(--bg-drawer)', border: '1px solid var(--border-main)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
        <h3 style={{ margin: '0 0 8px' }}>Appearance</h3>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={!!darkMode} onChange={() => setDarkMode(!darkMode)} />
          <span>Dark mode</span>
        </label>
      </section>

      {/* Quick links */}
      <section style={{ background: 'var(--bg-drawer)', border: '1px solid var(--border-main)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
        <h3 style={{ margin: '0 0 8px' }}>More</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/stylist/help')} style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-main)', background: 'none', color: 'var(--text-main)', cursor: 'pointer' }}>Open Help</button>
          <button onClick={() => navigate('/stylist/about')} style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-main)', background: 'none', color: 'var(--text-main)', cursor: 'pointer' }}>Open About</button>
        </div>
      </section>
    </div>
  );
}
