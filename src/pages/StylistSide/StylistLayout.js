import React, { useMemo, useState } from 'react';
import { Outlet } from 'react-router-dom';
import TopBar from './TopBar';
import { StylistUIProvider } from '../../context/StylistUIContext';

const StylistLayout = ({ onLogout }) => {
  const [darkMode, setDarkMode] = useState(() => {
    const stored = localStorage.getItem('darkMode');
    return stored === null ? false : stored === 'true';
  });
  const [settingsOpen, setSettingsOpen] = useState(false);

  const theme = darkMode
    ? {
        '--bg-main': '#181818',
        '--bg-drawer': '#232323',
        '--text-main': '#FFD700',
        '--text-secondary': '#fffbe6',
        '--border-main': '#bfa14a',
        '--icon-main': '#FFD700',
        '--btn-bg': 'none',
        '--btn-hover': '#333',
        '--logout-bg': '#d32f2f',
        '--logout-color': '#fff',
        '--font-weight-main': 600,
      }
    : {
        '--bg-main': '#F3F4F6',
        '--bg-drawer': '#F7F8F9',
        '--bg-surface': '#F6F7F8',
        '--text-main': '#111827',
        '--text-secondary': '#6B7280',
        '--border-main': 'rgba(16,24,32,0.04)',
        '--border-faint': 'rgba(16,24,32,0.02)',
        '--icon-main': '#374151',
        '--btn-bg': 'none',
        '--btn-hover': '#F5F6F7',
        '--logout-bg': '#d32f2f',
        '--logout-color': '#fff',
        '--font-weight-main': 700,
      };

  return (
    <StylistUIProvider value={{
      darkMode,
      setDarkMode: (v) => { try { localStorage.setItem('darkMode', String(typeof v === 'boolean' ? v : !darkMode)); } catch (e) {} setDarkMode(typeof v === 'boolean' ? v : !darkMode); },
      preferences: {},
      savePreferences: async () => {},
    }}>
      <div style={{ minHeight: '100vh', width: '100%', background: 'var(--bg-main)', ...theme }}>
        <TopBar onLogout={onLogout} darkMode={darkMode} setDarkMode={setDarkMode} settingsOpen={settingsOpen} setSettingsOpen={setSettingsOpen} />
        <main style={{ marginTop: 56 }}>
          <Outlet />
        </main>
      </div>
    </StylistUIProvider>
  );
};

export default StylistLayout;
