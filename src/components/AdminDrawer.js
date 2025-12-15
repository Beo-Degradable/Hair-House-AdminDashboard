import React, { useState } from 'react';

export default function AdminDrawer({
  drawerOpen,
  setDrawerOpen,
  computedDrawerWidth,
  darkMode,
  setDarkMode,
  settingsOpen,
  setSettingsOpen,
  navigate,
  navButtons,
  isActivePath,
  activeLinkStyle,
  avatarBroken,
  avatarUrl,
  handleAvatarError,
  fullName,
  fullEmail,
  getInitials,
  nameToDisplay,
  emailToDisplay,
  onLogout,
}) {
  const drawerBtnStyle = {
    width: '100%',
    background: 'transparent',
    color: 'var(--text-main)',
    border: 'none',
    padding: '10px 12px',
    textAlign: 'left',
    cursor: 'pointer',
    fontWeight: 400,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    alignSelf: 'stretch'
  };

  function DrawerButton({ children, onClick, active }) {
    const [hovered, setHovered] = useState(false);
    // Prefer the themed surface for button backgrounds so non-active options
    // match the page surface in light mode. Use CSS tokens unconditionally
    // to avoid showing hard-coded dark rectangles when theme variables are set.
    const baseBg = 'var(--bg-surface, transparent)';
    const hoverBg = 'var(--btn-hover, rgba(16,24,32,0.06))';
    const accentColor = 'var(--accent, #D7B77A)';
    const activeColor = active ? (activeLinkStyle && activeLinkStyle.color ? activeLinkStyle.color : accentColor) : undefined;

      // When the drawer is extended (drawerOpen === true) prefer the compact-like
      // active visual: a filled, rounded surface with a left accent bar — instead
      // of the previous border-only indicator. This copies the compact highlight
      // behavior into the expanded drawer per user request.
      const isExtendedActive = active && drawerOpen;
      // Active buttons show a left vertical accent and a matching border.
      const style = {
      ...drawerBtnStyle,
      background: isExtendedActive ? 'var(--bg-surface, rgba(255,255,255,0.04))' : (hovered ? hoverBg : baseBg),
      // show a prominent left accent bar for active items and a border matching the accent color
      borderLeft: active ? `4px solid ${accentColor}` : '4px solid transparent',
      border: active ? `1px solid ${accentColor}` : (hovered ? '1px solid var(--border-main, rgba(0,0,0,0.06))' : '1px solid transparent'),
      color: active ? (activeColor || 'var(--text-main)') : 'var(--text-main)',
      boxShadow: isExtendedActive ? 'none' : (hovered && !active ? (darkMode ? '0 6px 18px rgba(0,0,0,0.12)' : '0 8px 20px rgba(16,24,32,0.04)') : 'none'),
      transform: hovered && !active ? 'translateY(-1px)' : 'none',
      transition: 'background 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease, border 0.12s ease',
      justifyContent: 'flex-start'
    };

    return (
      <button
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={onClick}
        style={style}
      >
        {children}
      </button>
    );
  }

  return (
    <div
      className="admin-drawer"
      id="admin-drawer"
      style={{
        position: 'fixed',
        top: 56,
        left: 0,
        transform: drawerOpen ? 'translateX(0)' : 'translateX(-110%)',
        width: computedDrawerWidth,
        maxWidth: '100%',
        minWidth: '180px',
        height: 'calc(100vh - 56px)',
        paddingBottom: 88, /* reserve space so footer doesn't get cut off */
        background: 'var(--bg-drawer, rgba(35,35,35,0.96))',
        borderRight: '2px solid var(--border-main, rgba(201,184,106,0.9))',
        boxShadow: drawerOpen ? (darkMode ? '2px 0 16px #0008' : '2px 0 12px rgba(16,24,32,0.06)') : 'none',
        zIndex: 1300,
        transition: 'transform 0.32s cubic-bezier(.4,0,.2,1)',
        display: 'flex',
        flexDirection: 'column',
        willChange: 'transform'
      }}
    >
      <div style={{ padding: '18px 16px', borderBottom: '1px solid var(--border-faint)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 6, background: `linear-gradient(180deg,var(--accent,#D7B77A), #BFA86A)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 12 }}>GH</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-main)' }}>GLOWBOARD</div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>Admin</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 8px' }}>
        {navButtons.map((btn) => {
          const active = isActivePath(btn.path);
          const handleClick = () => {
            try {
              if (typeof navigate === 'function') navigate(btn.path);
              else if (typeof window !== 'undefined' && window.location) window.location.href = btn.path;
            } catch (e) {
              try { if (typeof window !== 'undefined' && window.location) window.location.href = btn.path; } catch (err) {}
            } finally {
              try { setDrawerOpen(false); } catch (e) {}
            }
          };

          return (
            <DrawerButton key={btn.label} onClick={handleClick} active={active}>
              {/* left spacer - actual active accent is rendered via borderLeft on the button */}
              <div style={{ width: 6, height: 28, borderRadius: 4, background: 'transparent', marginRight: 8 }} />
              <span style={{ fontSize: 14, fontWeight: 400, color: active ? (drawerOpen ? 'var(--text-main)' : 'var(--accent)') : 'var(--text-main)' }}>{btn.label}</span>
            </DrawerButton>
          );
        })}
      </div>

      <div style={{ position: 'absolute', bottom: 12, left: 0, right: 0, padding: '12px 16px', borderTop: '1px solid var(--border-faint)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: 'transparent' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* compact initials-only avatar */}
          <div style={{ width: 28, height: 28, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-main)', background: 'var(--bg-surface, transparent)', color: 'var(--text-main)', fontWeight: 700, fontSize: 12 }}>{getInitials(fullName)}</div>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div style={{ fontWeight: 400, fontSize: 13, color: 'var(--text-main)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={fullName}>{nameToDisplay}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={fullEmail}>{emailToDisplay}</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center' }}>
          <button
            onClick={() => { setDrawerOpen(false); if (onLogout) onLogout(); }}
            style={{
              background: 'var(--logout-bg, #d32f2f)',
              color: 'var(--logout-color, #ffffff)',
              border: '1px solid var(--logout-bg, #d32f2f)',
              padding: '6px 12px',
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ marginRight: 6 }}>
              <path d="M16 17v1a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="1.5" fill="none"/>
              <path d="M21 12H9m0 0l3-3m-3 3l3 3" stroke="currentColor" strokeWidth="1.5" fill="none"/>
            </svg>
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
