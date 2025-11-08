import React, { useState } from "react";

// Note: responsive layout for the TopBar/nav/drawer is handled in `src/index.css`.
// Removed the old JS-injected styles that forced the nav to stack vertically on small screens
// so CSS media queries in `index.css` can control behavior consistently.
import { useNavigate } from "react-router-dom";

import TopBar from "./TopBar";
import HomeGraphs from './HomeGraphs';
import RecentActivityFeed from '../../components/RecentActivityFeed';
import KPIRow from '../../components/KPIRow';


const AdminDashboard = ({ onLogout, page }) => {
  const [darkMode, setDarkMode] = useState(() => {
    const stored = localStorage.getItem('darkMode');
    return stored === null ? false : stored === 'true';
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [branch, setBranch] = useState('');

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
      <div
      style={{
        minHeight: "100vh",
        width: "100%",
        position: "relative",
        color: "var(--text-main)",
        background: "var(--bg-main)",
        fontWeight: "var(--font-weight-main)",
        transition: "background 0.3s, color 0.3s, font-weight 0.3s",
        ...theme
      }}
    >
  <TopBar onLogout={onLogout} darkMode={darkMode} setDarkMode={setDarkMode} settingsOpen={settingsOpen} setSettingsOpen={setSettingsOpen} branch={branch} setBranch={setBranch} />
      <main className="admin-main-content container" style={{ marginLeft: 0, marginTop: 56, padding: 'clamp(16px, 2.5vw, 32px)', boxSizing: 'border-box' }}>
        {page ? page : (
          <>
            <h1>Admin Dashboard</h1>
            <div style={{ marginTop: 16 }} className="dashboard-grid">
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <KPIRow branch={branch} />
                </div>
                <div style={{ marginTop: 12 }}>
                  <HomeGraphs branch={branch} />
                </div>
              </div>

              <aside>
                <div style={{ position: 'sticky', top: 84 }}>
                  <RecentActivityFeed branch={branch} />
                </div>
              </aside>
            </div>
            {/* ...other dashboard content... */}
          </>
        )}
      </main>
    </div>
  );
}

export default AdminDashboard;


