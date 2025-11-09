import React, { useState, useEffect, useRef, useContext } from "react";
import { AuthContext } from "../../context/AuthContext";
import { auth, db } from "../../firebase";
import useAppointments from "../../hooks/useAppointments";
import { useNavigate, useLocation } from "react-router-dom";
import { collection, query as q, orderBy, limit, onSnapshot } from 'firebase/firestore';

// Simplified stylist TopBar — keeps the admin look & tokens but presents a smaller,
// stylist-focused navigation (Home, Appointments, Today), notifications indicator,
// dark-mode toggle, and profile/logout. This file is intentionally smaller and
// independent so stylist-specific UX can evolve.

const NAV = [
  { label: 'Home', path: '/stylist' },
  { label: 'Appointments', path: '/stylist/appointments' },
];

const TopBar = ({ onLogout, darkMode, setDarkMode, settingsOpen, setSettingsOpen }) => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  // Drawer removed for stylist layout: topbar-only navigation
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileRef = useRef(null);
  const profileMenuRef = useRef(null);

  const [isWide, setIsWide] = useState(() => typeof window !== 'undefined' ? window.matchMedia && window.matchMedia('(min-width:900px)').matches : true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width:900px)');
    const handler = (e) => setIsWide(e.matches);
    if (mq.addEventListener) mq.addEventListener('change', handler); else mq.addListener(handler);
    return () => { if (mq.removeEventListener) mq.removeEventListener('change', handler); else mq.removeListener(handler); };
  }, []);

  // Close profile menu on outside click or Escape
  useEffect(() => {
    if (!showProfileMenu) return undefined;
    const onDown = (e) => {
      const target = e.target;
      if (profileMenuRef.current && profileRef.current && (profileMenuRef.current.contains(target) || profileRef.current.contains(target))) return;
      setShowProfileMenu(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setShowProfileMenu(false); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey); };
  }, [showProfileMenu]);

  // Notifications dropdown state
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [hasNewNotifications, setHasNewNotifications] = useState(false);
  const notificationsRef = useRef(null);

  // Build notifications from the same appointments data source used by the calendar
  const { appointments = [] } = useAppointments();
  useEffect(() => {
    if (!user?.uid) {
      setHasNewNotifications(false);
      setNotifications([]);
      return;
    }
    const uid = user.uid;
    const displayName = user.displayName || user.name || user.fullName || '';
    const email = user.email || '';

    const arr = [];
    let latestMillis = 0;
    (appointments || []).forEach(a => {
      const stylistId = a?.stylistId || a?.stylistUID || a?.stylistUid || a?.assignedStylistId || a?.stylist?.id || a?.stylist?.uid;
      const stylistName = a?.stylistName || a?.stylist?.name || a?.stylist?.displayName || '';
      const stylistEmail = a?.stylistEmail || a?.stylist?.email || '';
      const noStylistFields = !stylistId && !stylistName && !stylistEmail;
      const matches = noStylistFields || (
        stylistId === uid || stylistId === String(uid) ||
        (stylistEmail && email && String(stylistEmail).toLowerCase() === String(email).toLowerCase()) ||
        (stylistName && displayName && String(stylistName).toLowerCase() === String(displayName).toLowerCase())
      );
      if (!matches) return;

      const tsObj = a.updatedAt || a.createdAt || a.startTime;
      const tsMillis = tsObj?.toMillis ? tsObj.toMillis() : (tsObj ? new Date(tsObj).getTime() : 0);
      const start = a.startTime;
      const startDate = start?.toDate ? start.toDate() : (start ? new Date(start) : null);
      const client = a.clientName || a.client || 'Customer';
      const service = a.serviceName || a.service || '';
      const status = (a.status || '').toString();

      arr.push({
        id: a.id,
        title: service ? `${service}` : 'Appointment',
        message: `${client}${startDate ? ` • ${startDate.toLocaleString()}` : ''}${status ? ` • ${status}` : ''}`,
        _tsMillis: tsMillis,
        _tsDate: tsMillis ? new Date(tsMillis) : (startDate || new Date()),
      });
      if (tsMillis && tsMillis > latestMillis) latestMillis = tsMillis;
    });
    arr.sort((x, y) => (y._tsMillis || 0) - (x._tsMillis || 0));
    setNotifications(arr);
    if (latestMillis) {
      const lastSeen = parseInt(localStorage.getItem('lastSeenNotifications') || '0', 10) || 0;
      setHasNewNotifications(latestMillis > lastSeen);
    } else {
      setHasNewNotifications(false);
    }
  }, [appointments, user?.uid]);

  // Close notifications dropdown on outside click
  useEffect(() => {
    if (!showNotifications) return undefined;
    const onDown = (e) => {
      const target = e.target;
      if (notificationsRef.current && notificationsRef.current.contains(target)) return;
      setShowNotifications(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setShowNotifications(false); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey); };
  }, [showNotifications]);

  // Mark notifications as seen when dropdown is opened
  useEffect(() => {
    if (showNotifications && notifications.length > 0) {
      const ts = notifications[0]?._tsMillis || 0;
      if (ts) {
        try {
          localStorage.setItem('lastSeenNotifications', String(ts));
          setHasNewNotifications(false);
        } catch (e) {
          console.warn('Failed to update last seen notifications', e);
        }
      }
    }
  }, [showNotifications, notifications]);

  const name = user?.name || user?.displayName || user?.fullName || user?.email || 'Stylist';
  const getInitials = (n) => (n ? n.split(/\s+/).map(s => s[0]).slice(0,2).join('').toUpperCase() : 'ST');

  const isActive = (path) => {
    // Use exact pathname match so parent paths (e.g. `/stylist`) are not active
    // when a child route is open (e.g. `/stylist/appointments`).
    if (!path) return false;
    const cur = location?.pathname || '/';
    return cur === path;
  };

  return (
    <>
      <div className="stylist-topbar" style={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', gap: 12, background: 'var(--bg-drawer)', color: 'var(--icon-main)', position: 'sticky', top: 0, zIndex: 1400 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {NAV.map(n => {
              const active = isActive(n.path);
              return (
                <button
                  key={n.path}
                  onClick={(e) => { navigate(n.path); try { e.currentTarget.blur(); } catch (er) {} }}
                  style={{
                    background: 'none',
                    border: 'none',
                    outline: 'none',
                    boxShadow: 'none',
                    WebkitAppearance: 'none',
                    color: active ? 'var(--text-main)' : 'var(--icon-main)',
                    fontWeight: active ? 700 : 500,
                    padding: '6px 8px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    transition: 'color 160ms, border-bottom 160ms, box-shadow 160ms',
                    borderBottom: active ? '2px solid var(--text-main)' : 'none',
                    paddingBottom: active ? 4 : 6,
                  }}
                >
                  {n.label}
                </button>
              );
            })}
          </div>
  </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Notifications Bell Icon */}
          <div style={{ position: 'relative' }}>
            <button 
              title="Notifications" 
              onClick={() => setShowNotifications(!showNotifications)} 
              style={{ 
                background: 'none', 
                border: 'none', 
                position: 'relative', 
                color: 'var(--icon-main)', 
                cursor: 'pointer',
                padding: '8px'
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 22c1.1 0 2-.9 2-2h-4a2 2 0 0 0 2 2zm6-6V11c0-3.07-1.63-5.64-5-6.32V4a1 1 0 1 0-2 0v.68C7.63 5.36 6 7.92 6 11v5l-1.29 1.29A1 1 0 0 0 6 19h12a1 1 0 0 0 .71-1.71L18 16z" stroke="currentColor" strokeWidth="1.4" fill="none"/>
              </svg>
              {hasNewNotifications && (
                <span style={{ 
                  position: 'absolute', 
                  right: 2, 
                  top: 2, 
                  width: 9, 
                  height: 9, 
                  borderRadius: 9, 
                  background: 'var(--danger, #d32f2f)', 
                  border: '2px solid var(--bg-drawer)' 
                }} />
              )}
            </button>

            {/* Notifications Dropdown */}
            {showNotifications && (
              <div 
                ref={notificationsRef}
                style={{ 
                  position: 'absolute', 
                  right: 0, 
                  top: 48, 
                  minWidth: 320, 
                  maxWidth: 400,
                  maxHeight: 400,
                  background: 'var(--bg-drawer)', 
                  border: '1px solid var(--border-main)', 
                  borderRadius: 8, 
                  boxShadow: '0 8px 30px rgba(0,0,0,0.25)', 
                  zIndex: 1700,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <div style={{ 
                  padding: '12px 16px', 
                  borderBottom: '1px solid var(--border-main)',
                  fontWeight: 700,
                  fontSize: 14
                }}>
                  Notifications
                </div>
                <div style={{ 
                  maxHeight: 300, 
                  overflowY: 'auto',
                  padding: '8px 0'
                }}>
                  {notifications.length === 0 ? (
                    <div style={{ 
                      padding: '16px', 
                      color: 'var(--muted)', 
                      textAlign: 'center',
                      fontSize: 14
                    }}>
                      No notifications
                    </div>
                  ) : (
                    notifications.map(notif => (
                      <div 
                        key={notif.id} 
                        style={{ 
                          padding: '12px 16px', 
                          borderBottom: '1px solid var(--border-main)',
                          cursor: 'pointer',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.background = 'var(--btn-hover)'}
                        onMouseLeave={(e) => e.target.style.background = 'transparent'}
                      >
                        <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 13 }}>
                          {notif.title || 'Appointment Update'}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>
                          {notif.message || 'You have a new appointment notification'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                          {notif._tsDate ? notif._tsDate.toLocaleString() : 'Just now'}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={darkMode} onChange={() => { try { localStorage.setItem('darkMode', String(!darkMode)); } catch (e) {} setDarkMode(!darkMode); }} style={{ display: 'none' }} />
            <button onClick={() => { try { localStorage.setItem('darkMode', String(!darkMode)); } catch (e) {} setDarkMode(!darkMode); }} style={{ background: 'none', border: '1px solid var(--border-main)', padding: '6px', borderRadius: 8, color: 'var(--icon-main)', cursor: 'pointer' }}>{darkMode ? '🌙' : '☀️'}</button>
          </label>

          <div style={{ position: 'relative' }}>
            <button ref={profileRef} onClick={() => setShowProfileMenu(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--icon-main)' }}>
              <div style={{ width: 36, height: 36, borderRadius: 999, background: 'var(--border-main)', color: 'var(--text-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{getInitials(name)}</div>
              {isWide && <div style={{ fontSize: 13, color: 'var(--text-main)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={name}>{name}</div>}
            </button>

          {showProfileMenu && (
                <div ref={profileMenuRef} role="menu" style={{ position: 'absolute', right: 0, top: 46, minWidth: 160, background: 'var(--bg-drawer)', border: '1px solid var(--border-main)', borderRadius: 8, padding: 8, boxShadow: '0 8px 30px rgba(0,0,0,0.25)', zIndex: 1700 }}>
                <button role="menuitem" onClick={() => { navigate('/profile'); setShowProfileMenu(false); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', background: 'none', border: 'none', color: 'var(--icon-main)', cursor: 'pointer' }}>Profile</button>
                <button role="menuitem" onClick={() => { navigate('/account-settings'); setShowProfileMenu(false); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', background: 'none', border: 'none', color: 'var(--icon-main)', cursor: 'pointer' }}>Account</button>
                <div style={{ height: 1, background: 'var(--border-main)', margin: '8px 0' }} />
                <button role="menuitem" onClick={() => { setShowProfileMenu(false); if (onLogout) onLogout(); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', background: 'none', border: 'none', color: 'var(--logout-color, #d32f2f)', cursor: 'pointer', fontWeight: 700 }}>Logout</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Drawer removed: topbar navigation only for stylist */}
    </>
  );
};

export default TopBar;
