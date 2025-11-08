import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import TopBar from './TopBar';

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
        '--bg-main': '#fffbe6',
        '--bg-drawer': '#fff',
        '--text-main': '#181818',
        '--text-secondary': '#FFD700',
        '--border-main': '#FFD700',
        '--icon-main': '#181818',
        '--btn-bg': 'none',
        '--btn-hover': '#f5e9b7',
        '--logout-bg': '#d32f2f',
        '--logout-color': '#fff',
        '--font-weight-main': 700,
      };

  return (
    <div style={{ minHeight: '100vh', width: '100%', background: 'var(--bg-main, #fffbe6)', ...theme }}>
      <TopBar onLogout={onLogout} darkMode={darkMode} setDarkMode={setDarkMode} settingsOpen={settingsOpen} setSettingsOpen={setSettingsOpen} />
      <main style={{ marginTop: 56 }}>
        <Outlet />
      </main>
    </div>
  );
};

export default StylistLayout;
