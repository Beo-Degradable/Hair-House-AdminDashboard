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
        /* Light mode tokens per design spec */
        '--bg-main': '#F9F7F4',
        '--bg-drawer': '#F5F5F5',
        '--bg-surface': '#F5F5F5',
        '--text-main': '#2B2B2B',
        '--text-secondary': '#6F6F6F',
        '--border-main': 'rgba(215,183,122,0.18)',
        '--border-faint': 'rgba(215,183,122,0.08)',
        '--icon-main': '#2B2B2B',
        '--btn-bg': 'var(--bg-main)',
        '--btn-hover': 'rgba(16,24,32,0.06)',
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
