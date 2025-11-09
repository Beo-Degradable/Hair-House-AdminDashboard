

// Admin top navigation bar: responsive nav buttons, notifications indicator,
// avatar/profile menu, drawer with settings & dark mode toggle.
import React, { useState, useEffect, useRef, useContext } from "react";
import { AuthContext } from "../../context/AuthContext";
import { auth, db } from "../../firebase";
import { useNavigate, useLocation } from "react-router-dom";
import { collection, query as q, orderBy, limit, onSnapshot } from 'firebase/firestore';

const navButtons = [
  { label: "Home", path: "/" },
  { label: "Appointments", path: "/appointments" },
  { label: "Products", path: "/products" },
  { label: "Services", path: "/services" },
  { label: "Inventory", path: "/inventory" },
  { label: "Users", path: "/users" },
];

const drawerWidth = 260;
const drawerBtnStyle = {
  width: "100%",
  background: "var(--btn-bg)",
  color: "var(--text-main)",
  border: "none",
  padding: "1rem 1.5rem",
  textAlign: "left",
  cursor: "pointer",
  fontWeight: "var(--font-weight-main)",
};

const TopBar = ({ onLogout, darkMode, setDarkMode, settingsOpen, setSettingsOpen }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useContext(AuthContext);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileBtnRef = useRef(null);
  const profileMenuRef = useRef(null);
  const [showNav, setShowNav] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const moreBtnRef = useRef(null);
  const moreMenuRef = useRef(null);

  // Responsive nav breakpoint detection
const [isWide, setIsWide] = useState(() => {
  if (typeof window === 'undefined') return true;
  try { return window.matchMedia('(min-width: 900px)').matches; } catch { return window.innerWidth >= 900; }
});
const [isWindows, setIsWindows] = useState(() => typeof navigator !== 'undefined' ? /Win/i.test(navigator.userAgent) : false);

  // Track viewport width for drawer sizing
const [viewportWidth, setViewportWidth] = useState(() => typeof window !== 'undefined' ? window.innerWidth : 1200);

useEffect(() => {
  if (typeof window === 'undefined') return;
  const mq = window.matchMedia ? window.matchMedia('(min-width: 900px)') : null;
  const handleMq = (ev) => setIsWide(ev.matches);
  if (mq && mq.addEventListener) mq.addEventListener('change', handleMq);
  else if (mq && mq.addListener) mq.addListener(handleMq);

  const onResize = () => setViewportWidth(window.innerWidth);
  window.addEventListener('resize', onResize);

  setViewportWidth(window.innerWidth);

  return () => {
    if (mq && mq.removeEventListener) mq.removeEventListener('change', handleMq);
    else if (mq && mq.removeListener) mq.removeListener(handleMq);
    window.removeEventListener('resize', onResize);
  };
}, []);

  const shorten = (str, max = 12) => {
    if (!str) return "";
    return str.length > max ? `${str.slice(0, max).trim()}...` : str;
  };

  const fullName = user?.name || user?.displayName || user?.fullName || 'Admin';
  const fullEmail = user?.email || user?.mail || '';

  function shortenName(name, max = 12) {
    if (!name) return '';
    const trimmed = name.trim();
    if (trimmed.length <= max) return trimmed;
    const parts = trimmed.split(/\s+/);
    if (parts.length > 1) {
      const first = parts[0];
      const lastInitial = parts[parts.length - 1][0] || '';
      // prefer 'First L...' style when truncating multi-part names
      const candidate = `${first} ${lastInitial}...`;
      return candidate.length <= max ? candidate : `${first.slice(0, Math.max(3, max - 5))}...`;
    }
    return `${trimmed.slice(0, max).trim()}...`;
  }

  function shortenEmail(email, max = 14) {
    if (!email) return '';
    const local = email.split('@')[0] || email;
    if (local.length <= max) return local;
    return `${local.slice(0, max).trim()}...`;
  }

  // Compute drawer width (fixed on wide screens, dynamic on small)
  const computedDrawerWidth = isWide
    ? `${drawerWidth}px`
    : `${Math.min(360, Math.max(220, Math.floor(viewportWidth * 0.86)))}px`;

  const [hasNewNotifications, setHasNewNotifications] = useState(false);
  const [latestNotifTs, setLatestNotifTs] = useState(null);

  useEffect(() => {
    try {
      const histCol = collection(db, 'history');
      const histQ = q(histCol, orderBy('timestamp', 'desc'), limit(1));
      const unsub = onSnapshot(histQ, (snap) => {
        if (snap.empty) {
          setLatestNotifTs(null);
          setHasNewNotifications(false);
          return;
        }
        const doc = snap.docs[0];
        const data = doc.data();
        const ts = data?.timestamp ? (data.timestamp.toMillis ? data.timestamp.toMillis() : (new Date(data.timestamp)).getTime()) : null;
        setLatestNotifTs(ts);
        const lastSeen = parseInt(localStorage.getItem('lastSeenNotifications') || '0', 10) || 0;
        if (!ts) {
          setHasNewNotifications(false);
        } else {
          setHasNewNotifications(ts > lastSeen);
        }
      }, (err) => {
        // ignore for UI indicator
        console.warn('history indicator error', err);
      });
      return () => unsub();
    } catch (e) {
      console.warn('failed to subscribe history indicator', e);
    }
  }, []);

  // Mark notifications seen when visiting /notifications
  useEffect(() => {
    if (location?.pathname === '/notifications') {
      try {
        if (latestNotifTs) {
          localStorage.setItem('lastSeenNotifications', String(latestNotifTs));
        } else {
          // mark current time
          localStorage.setItem('lastSeenNotifications', String(Date.now()));
        }
      } catch (e) {}
      setHasNewNotifications(false);
    }
  }, [location && location.pathname, latestNotifTs]);

  const nameToDisplay = shortenName(fullName, 12);
  const emailToDisplay = shortenEmail(fullEmail, 14);

  // Resolve avatar URL; MD5 email hash for gravatar fallback
  const md5Hex = async (str) => {
    if (!str) return '';
    // try SubtleCrypto first (modern browsers)
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle && window.TextEncoder) {
      try {
        const data = new TextEncoder().encode(str.trim().toLowerCase());
        const hashBuffer = await window.crypto.subtle.digest('MD5', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      } catch (e) {
        // fall through to small JS implementation below
      }
    }
  // Fallback MD5 implementation (minimal) when SubtleCrypto unavailable
    function cmn(q, a, b, x, s, t) { a = (a + q + x + t) & 0xffffffff; return ((a << s) | (a >>> (32 - s))) + b; }
    function ff(a, b, c, d, x, s, t) { return cmn((b & c) | (~b & d), a, b, x, s, t); }
    function gg(a, b, c, d, x, s, t) { return cmn((b & d) | (c & ~d), a, b, x, s, t); }
    function hh(a, b, c, d, x, s, t) { return cmn(b ^ c ^ d, a, b, x, s, t); }
    function ii(a, b, c, d, x, s, t) { return cmn(c ^ (b | ~d), a, b, x, s, t); }
    function toWords(input) {
      const msg = unescape(encodeURIComponent(input));
      const l = msg.length;
      const words = [];
      for (let i = 0; i < l; i += 4) {
        words[i >> 2] = msg.charCodeAt(i) | (msg.charCodeAt(i + 1) << 8) | (msg.charCodeAt(i + 2) << 16) | (msg.charCodeAt(i + 3) << 24);
      }
      return words;
    }
    function toHex(num) { let s = '', v; for (let i = 0; i < 4; i++) { v = (num >>> (i * 8)) & 255; s += ('0' + v.toString(16)).slice(-2); } return s; }
    let x = toWords(str.trim().toLowerCase());
    const bitLen = str.length * 8;
    x[bitLen >> 5] |= 0x80 << (bitLen % 32);
    x[(((bitLen + 64) >>> 9) << 4) + 14] = bitLen;
    let a = 1732584193, b = -271733879, c = -1732584194, d = 271733878;
    for (let i = 0; i < x.length; i += 16) {
      const olda = a, oldb = b, oldc = c, oldd = d;
      a = ff(a, b, c, d, x[i + 0], 7, -680876936);
      d = ff(d, a, b, c, x[i + 1], 12, -389564586);
      c = ff(c, d, a, b, x[i + 2], 17, 606105819);
      b = ff(b, c, d, a, x[i + 3], 22, -1044525330);
      a = ff(a, b, c, d, x[i + 4], 7, -176418897);
      d = ff(d, a, b, c, x[i + 5], 12, 1200080426);
      c = ff(c, d, a, b, x[i + 6], 17, -1473231341);
      b = ff(b, c, d, a, x[i + 7], 22, -45705983);
      a = ff(a, b, c, d, x[i + 8], 7, 1770035416);
      d = ff(d, a, b, c, x[i + 9], 12, -1958414417);
      c = ff(c, d, a, b, x[i + 10], 17, -42063);
      b = ff(b, c, d, a, x[i + 11], 22, -1990404162);
      a = ff(a, b, c, d, x[i + 12], 7, 1804603682);
      d = ff(d, a, b, c, x[i + 13], 12, -40341101);
      c = ff(c, d, a, b, x[i + 14], 17, -1502002290);
      b = ff(b, c, d, a, x[i + 15], 22, 1236535329);
      a = gg(a, b, c, d, x[i + 1], 5, -165796510);
      d = gg(d, a, b, c, x[i + 6], 9, -1069501632);
      c = gg(c, d, a, b, x[i + 11], 14, 643717713);
      b = gg(b, c, d, a, x[i + 0], 20, -373897302);
      a = gg(a, b, c, d, x[i + 5], 5, -701558691);
      d = gg(d, a, b, c, x[i + 10], 9, 38016083);
      c = gg(c, d, a, b, x[i + 15], 14, -660478335);
      b = gg(b, c, d, a, x[i + 4], 20, -405537848);
      a = gg(a, b, c, d, x[i + 9], 5, 568446438);
      d = gg(d, a, b, c, x[i + 14], 9, -1019803690);
      c = gg(c, d, a, b, x[i + 3], 14, -187363961);
      b = gg(b, c, d, a, x[i + 8], 20, 1163531501);
      a = gg(a, b, c, d, x[i + 13], 5, -1444681467);
      d = gg(d, a, b, c, x[i + 2], 9, -51403784);
      c = gg(c, d, a, b, x[i + 7], 14, 1735328473);
      b = gg(b, c, d, a, x[i + 12], 20, -1926607734);
      a = hh(a, b, c, d, x[i + 5], 4, -378558);
      d = hh(d, a, b, c, x[i + 8], 11, -2022574463);
      c = hh(c, d, a, b, x[i + 11], 16, 1839030562);
      b = hh(b, c, d, a, x[i + 14], 23, -35309556);
      a = hh(a, b, c, d, x[i + 1], 4, -1530992060);
      d = hh(d, a, b, c, x[i + 4], 11, 1272893353);
      c = hh(c, d, a, b, x[i + 7], 16, -155497632);
      b = hh(b, c, d, a, x[i + 10], 23, -1094730640);
      a = hh(a, b, c, d, x[i + 13], 4, 681279174);
      d = hh(d, a, b, c, x[i + 0], 11, -358537222);
      c = hh(c, d, a, b, x[i + 3], 16, -722521979);
      b = hh(b, c, d, a, x[i + 6], 23, 76029189);
      a = hh(a, b, c, d, x[i + 9], 4, -640364487);
      d = hh(d, a, b, c, x[i + 12], 11, -421815835);
      c = hh(c, d, a, b, x[i + 15], 16, 530742520);
      b = hh(b, c, d, a, x[i + 2], 23, -995338651);
      a = ii(a, b, c, d, x[i + 0], 6, -198630844);
      d = ii(d, a, b, c, x[i + 7], 10, 1126891415);
      c = ii(c, d, a, b, x[i + 14], 15, -1416354905);
      b = ii(b, c, d, a, x[i + 5], 21, -57434055);
      a = ii(a, b, c, d, x[i + 12], 6, 1700485571);
      d = ii(d, a, b, c, x[i + 3], 10, -1894986606);
      c = ii(c, d, a, b, x[i + 10], 15, -1051523);
      b = ii(b, c, d, a, x[i + 1], 21, -2054922799);
      a = ii(a, b, c, d, x[i + 8], 6, 1873313359);
      d = ii(d, a, b, c, x[i + 15], 10, -30611744);
      c = ii(c, d, a, b, x[i + 6], 15, -1560198380);
      b = ii(b, c, d, a, x[i + 13], 21, 1309151649);
      a = ii(a, b, c, d, x[i + 4], 6, -145523070);
      d = ii(d, a, b, c, x[i + 11], 10, -1120210379);
      c = ii(c, d, a, b, x[i + 2], 15, 718787259);
      b = ii(b, c, d, a, x[i + 9], 21, -343485551);
      a = (a + olda) & 0xffffffff;
      b = (b + oldb) & 0xffffffff;
      c = (c + oldc) & 0xffffffff;
      d = (d + oldd) & 0xffffffff;
    }
    return toHex(a) + toHex(b) + toHex(c) + toHex(d);
  };

  const [gravatarUrl, setGravatarUrl] = React.useState('');
  React.useEffect(() => {
    let mounted = true;
    const email = (user?.email || auth?.currentUser?.email || '').trim().toLowerCase();
    if (!email) { setGravatarUrl(''); return; }
    md5Hex(email).then(hash => {
      if (!mounted) return;
      if (hash) setGravatarUrl(`https://www.gravatar.com/avatar/${hash}?d=identicon&s=256`);
    }).catch(() => {
      if (!mounted) return;
      setGravatarUrl('');
    });
    return () => { mounted = false; };
  }, [user && user.email, auth && auth.currentUser && auth.currentUser.email]);

  // Photo preference order: provider photo -> user.photoURL -> stored avatar -> gravatar
  const avatarUrl = auth?.currentUser?.photoURL
    || (auth?.currentUser?.providerData && auth.currentUser.providerData[0] && auth.currentUser.providerData[0].photoURL)
    || user?.photoURL
    || user?.providerData?.[0]?.photoURL
    || user?.avatar
    || gravatarUrl
    || '';

  // Debug avatar resolution (dev aid)
  useEffect(() => {
    try {
      // eslint-disable-next-line no-console
      console.debug('TopBar debug:', { avatarUrl, user, authCurrent: auth && auth.currentUser });
    } catch (e) {}
  }, [avatarUrl, user]);

  // Track broken avatar to show initials
  const [avatarBroken, setAvatarBroken] = useState(false);

  const getInitials = (name) => {
    if (!name) return '';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + (parts[parts.length - 1][0] || '')).toUpperCase();
  };

  // Log avatar load failures (diagnostic)
  const handleAvatarError = (url, ev) => {
    try {
      // eslint-disable-next-line no-console
      console.warn('TopBar: avatar failed to load', { url, ev, user, authCurrent: auth && auth.currentUser });
    } catch (e) {}
    setAvatarBroken(true);
  };

  // Alt-click avatar to show debug info
  const showAvatarDebug = () => {
    const info = {
      email: fullEmail,
      displayName: fullName,
      userPhotoURL: user?.photoURL || null,
      providerPhotoURL: user?.providerData?.[0]?.photoURL || null,
      authCurrentPhotoURL: auth?.currentUser?.photoURL || null,
      gravatarUrl,
      resolvedAvatarUrl: avatarUrl,
    };
    try {
      // eslint-disable-next-line no-console
      console.debug('Avatar debug:', info);
    } catch (e) {}
    // friendly alert so you see it immediately in the UI when testing
    try {
      alert('Avatar debug (alt-click):\n' + JSON.stringify(info, null, 2));
    } catch (e) {}
  };

  // Close More menu on outside click
  useEffect(() => {
    if (!showMore) return;
    const onDown = (e) => {
      if (
        moreMenuRef.current && moreBtnRef.current &&
        !moreMenuRef.current.contains(e.target) && !moreBtnRef.current.contains(e.target)
      ) {
        setShowMore(false);
      }
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [showMore]);

  // Primary inline nav order
  const primaryOrder = ["Home", "Appointments", "Inventory"];
  const primaryNav = primaryOrder.map(label => navButtons.find(b => b.label === label)).filter(Boolean);
  const moreNav = navButtons.filter(b => !primaryOrder.includes(b.label));

  // Active path check (exact or nested)
  const isActivePath = (path) => {
    try {
      const current = location?.pathname || '/';
      if (!path) return false;
      if (path === '/') return current === '/';
      return current === path || current.startsWith(path + '/') || current.startsWith(path + '?');
    } catch (e) { return false; }
  };

  const activeLinkStyle = {
    color: 'var(--text-main)',
    borderBottom: '2px solid var(--text-main)',
    paddingBottom: 4,
    fontWeight: 700
  };

  return (
    <>
      <div
        className="admin-topbar"
        style={{
          width: "100%",
          height: 56,
          background: "var(--bg-drawer)",
          color: "var(--icon-main)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 0px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          position: "sticky",
          top: 0,
          zIndex: 1400,
          fontWeight: "var(--font-weight-main)",
          fontFamily: 'inherit',
          transition: "background 0.3s, color 0.3s, font-weight 0.3s"
        }}
      >
  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => setDrawerOpen((v) => !v)}
            aria-expanded={drawerOpen}
            aria-controls="admin-drawer"
            className="admin-topbar-drawer-btn"
            style={{
              background: "none",
              border: "none",
              color: "var(--icon-main)",
              fontSize: 20,
              cursor: "pointer",
              marginRight: 10,
              display: "flex",
              alignItems: "center"
            }}
            aria-label="Open drawer"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <rect x="4" y="6" width="16" height="2" rx="1" fill="var(--icon-main)" />
              <rect x="4" y="11" width="16" height="2" rx="1" fill="var(--icon-main)" />
              <rect x="4" y="16" width="16" height="2" rx="1" fill="var(--icon-main)" />
            </svg>
          </button>
          {/* Nav buttons moved to left, horizontally aligned */}
          {/* left: compact nav (shown on narrow/non-Windows) */}
          {!(isWindows || isWide) && (
            <div className={`admin-topbar-nav${showNav ? ' show' : ''}`} style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: 8, position: 'relative' }}>
              {primaryNav.map(btn => {
                const active = isActivePath(btn.path);
                return (
                  <button
                    key={btn.label}
                    onClick={() => { navigate(btn.path); setShowNav(false); setShowMore(false); }}
                    style={{
                        background: "none",
                        border: "none",
                        color: active ? activeLinkStyle.color : "var(--icon-main)",
                        fontWeight: active ? activeLinkStyle.fontWeight : "var(--font-weight-main)",
                        fontSize: 13,
                        cursor: "pointer",
                        padding: "4px 8px",
                        borderRadius: 4,
                        transition: "background 0.2s, color 0.2s",
                        borderBottom: active ? activeLinkStyle.borderBottom : 'none',
                        paddingBottom: active ? activeLinkStyle.paddingBottom : 0,
                        textDecoration: 'none'
                      }}
                  >
                    {btn.label}
                  </button>
                );
              })}

              {moreNav.length > 0 && (
                <div style={{ position: 'relative' }}>
                  <button
                    ref={moreBtnRef}
                    onClick={() => setShowMore((v) => !v)}
                    aria-haspopup="true"
                    aria-expanded={showMore}
                    aria-controls="topbar-more-menu"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--icon-main)',
                      cursor: 'pointer',
                      padding: '4px 6px',
                      borderRadius: 6,
                    }}
                    title="More"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <circle cx="5" cy="12" r="1.5" fill="var(--icon-main)" />
                      <circle cx="12" cy="12" r="1.5" fill="var(--icon-main)" />
                      <circle cx="19" cy="12" r="1.5" fill="var(--icon-main)" />
                    </svg>
                  </button>

                  {showMore && (
                    <div
                      id="topbar-more-menu"
                      ref={moreMenuRef}
                      role="menu"
                      style={{
                        position: 'absolute',
                        top: '40px',
                        right: 0,
                        background: 'var(--bg-drawer)',
                        border: '1px solid var(--border-main)',
                        borderRadius: 8,
                        padding: 8,
                        boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
                        zIndex: 1600,
                        minWidth: 160,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                      }}
                    >
                      {moreNav.map(btn => {
                        const active = isActivePath(btn.path);
                        return (
                          <button
                            key={btn.label}
                            role="menuitem"
                            onClick={() => { navigate(btn.path); setShowMore(false); setShowNav(false); }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: active ? activeLinkStyle.color : 'var(--icon-main)',
                              fontWeight: active ? activeLinkStyle.fontWeight : 'normal',
                              textAlign: 'left',
                              padding: '6px 10px',
                              borderRadius: 6,
                              cursor: 'pointer'
                            }}
                          >
                            {btn.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        {/* Right side: on Windows or wide screens show full nav here; otherwise leave it blank */}
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginRight: 100 }}>
          {(isWindows || isWide) ? (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {navButtons.map((btn) => {
                const active = isActivePath(btn.path);
                return (
                  <div key={btn.label} style={{ display: 'flex', alignItems: 'center' }}>
                    <button
                      onClick={() => navigate(btn.path)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: active ? activeLinkStyle.color : 'var(--icon-main)',
                        fontSize: 13,
                        padding: '4px 8px',
                        cursor: 'pointer',
                        fontWeight: active ? activeLinkStyle.fontWeight : 'inherit',
                        borderBottom: active ? activeLinkStyle.borderBottom : 'none',
                        paddingBottom: active ? activeLinkStyle.paddingBottom : 0,
                        textDecoration: 'none'
                      }}
                    >
                      {btn.label}
                    </button>
                    {/* Notifications bell, profile avatar, and user display */}
                    {btn.label === 'Users' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 6 }}>
                        {/* Profile / Avatar button */}
                        {avatarUrl ? (
                          <button
                            ref={profileBtnRef}
                            onClick={(e) => {
                              if (e.altKey || e.ctrlKey) {
                                showAvatarDebug();
                                return;
                              }
                              setShowProfileMenu(v => !v);
                            }}
                            aria-haspopup="true"
                            aria-expanded={showProfileMenu}
                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                            title={fullEmail || fullName || 'Profile'}
                            aria-label={fullEmail || fullName || 'Profile'}
                          >
                            {!avatarBroken && avatarUrl ? (
                              <img src={avatarUrl} alt={fullName || 'Profile'} onError={(ev) => handleAvatarError(avatarUrl, ev)} style={{ width: 26, height: 26, borderRadius: 999, objectFit: 'cover', border: '1px solid var(--border-main)' }} />
                            ) : (
                              <div title={fullName || 'Profile'} aria-label={fullName || 'Profile'} style={{ width: 26, height: 26, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--border-main)', color: 'var(--text-main)', fontSize: 12, fontWeight: 700 }}>{getInitials(fullName)}</div>
                            )}
                          </button>
                        ) : (
                          <button ref={profileBtnRef} onClick={(e) => { if (e.altKey || e.ctrlKey) { showAvatarDebug(); return; } setShowProfileMenu(v => !v); }} aria-haspopup="true" aria-expanded={showProfileMenu} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }} title="Profile" aria-label="Profile">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                              <circle cx="12" cy="8" r="3" stroke="var(--icon-main)" strokeWidth="1.2" fill="none" />
                              <path d="M4 20c0-3.3 4-5 8-5s8 1.7 8 5" stroke="var(--icon-main)" strokeWidth="1.2" fill="none" />
                            </svg>
                          </button>
                        )}

                        {/* Notification bell (sibling to profile) */}
                        <button onClick={() => { navigate('/notifications'); setDrawerOpen(false); }} title="Notifications" style={{ background: 'none', border: 'none', cursor: 'pointer', position: 'relative', padding: 6 }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                            <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0 1 18 14.158V11a6 6 0 0 0-5-5.917V4a1 1 0 1 0-2 0v1.083A6 6 0 0 0 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5" stroke="var(--icon-main)" strokeWidth="1.4" fill="none" />
                          </svg>
                          {hasNewNotifications && (
                            <span style={{ position: 'absolute', right: 2, top: 2, width: 10, height: 10, borderRadius: 10, background: 'var(--danger, #d32f2f)', boxShadow: '0 0 0 2px rgba(0,0,0,0.06)' }} />
                          )}
                        </button>

                        { (isWindows || isWide) && (
                          <div style={{ marginLeft: 6, fontSize: 13, color: 'var(--text-main)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={fullName}>{shortenName(fullName, 18)}</div>
                        )}

                        {showProfileMenu && (
                          <div ref={profileMenuRef} role="menu" style={{ position: 'absolute', right: 20, top: 56, background: 'var(--bg-drawer)', border: '1px solid var(--border-main)', borderRadius: 8, padding: 8, boxShadow: '0 6px 20px rgba(0,0,0,.4)', zIndex: 1700 }}>
                            <button role="menuitem" onClick={() => { navigate('/profile'); setShowProfileMenu(false); }} style={{ background: 'none', border: 'none', color: 'var(--icon-main)', padding: '8px 12px', width: '100%', textAlign: 'left' }}>Profile</button>
                            <button role="menuitem" onClick={() => { navigate('/account-settings'); setShowProfileMenu(false); }} style={{ background: 'none', border: 'none', color: 'var(--icon-main)', padding: '8px 12px', width: '100%', textAlign: 'left' }}>Settings</button>
                            <button role="menuitem" onClick={() => { setShowProfileMenu(false); if (onLogout) onLogout(); }} style={{ background: 'none', border: 'none', color: 'var(--icon-main)', padding: '8px 12px', width: '100%', textAlign: 'left' }}>Logout</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ width: 8 }} />
          )}
        </div>
      </div>
      {/* Drawer overlay */}
      {drawerOpen && (
        <div onClick={() => setDrawerOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", zIndex: 1200, transition: "opacity 0.3s" }} />
      )}
      {/* Drawer */}
      <div
        className="admin-drawer"
        id="admin-drawer"
        style={{
          position: "fixed",
          top: 56,
          left: 0,
          transform: drawerOpen ? 'translateX(0)' : 'translateX(-110%)',
          width: computedDrawerWidth,
          maxWidth: '100%',
          minWidth: '180px',
          height: "calc(100vh - 56px)",
          background: "var(--bg-drawer)",
          borderRight: "2px solid var(--border-main)",
          boxShadow: drawerOpen ? (darkMode ? "2px 0 16px #0008" : "2px 0 16px rgba(255,215,0,0.2)") : "none",
          zIndex: 1300,
          transition: "transform 0.32s cubic-bezier(.4,0,.2,1)",
          display: "flex",
          flexDirection: "column",
          willChange: "transform"
        }}
      >
        <span style={{ marginLeft: 24, fontWeight: "var(--font-weight-main)", fontSize: 18, color: "var(--text-main)", display: "inline-block", marginBottom: 24 }} />
        <button
          style={{ ...drawerBtnStyle, display: "flex", alignItems: "center", gap: 10, ...(isActivePath('/notifications') ? { color: activeLinkStyle.color, fontWeight: activeLinkStyle.fontWeight } : {}) }}
          onClick={() => { navigate("/notifications"); setDrawerOpen(false); }}
        >
          <span>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 22c1.1 0 2-.9 2-2h-4a2 2 0 0 0 2 2zm6-6V11c0-3.07-1.63-5.64-5-6.32V4a1 1 0 1 0-2 0v.68C7.63 5.36 6 7.92 6 11v5l-1.29 1.29A1 1 0 0 0 6 19h12a1 1 0 0 0 .71-1.71L18 16z" stroke="var(--icon-main)" strokeWidth="1.5" fill="none"/>
            </svg>
          </span>
          Notifications
        </button>
        <div style={{ width: "100%" }}>
          <button
            style={{ ...drawerBtnStyle, display: "flex", alignItems: "center", gap: 10, width: "100%", justifyContent: "space-between", ...(isActivePath('/account-settings') ? { color: activeLinkStyle.color, fontWeight: activeLinkStyle.fontWeight } : {}) }}
            onClick={() => setSettingsOpen((v) => !v)}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="3" stroke="var(--icon-main)" strokeWidth="1.5" fill="none"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09A1.65 1.65 0 0 0 11 3.09V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09c.36.13.7.3 1 .51a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="var(--icon-main)" strokeWidth="1.5" fill="none"/>
              </svg>
              Settings
            </span>
            <span style={{ transition: "transform 0.2s", transform: settingsOpen ? "rotate(90deg)" : "rotate(0deg)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M8 10l4 4 4-4" stroke="var(--icon-main)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
          </button>
          {settingsOpen && (
            <div style={{ paddingLeft: 36, paddingTop: 4, paddingBottom: 4 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button onClick={() => { navigate('/account-settings'); setDrawerOpen(false); setSettingsOpen(false); }} style={{ background: 'none', border: 'none', color: 'var(--icon-main)', textAlign: 'left', padding: '6px 8px', borderRadius: 6, cursor: 'pointer' }}>Account Settings</button>
                <label style={{ color: "var(--icon-main)", fontWeight: 500, display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="checkbox" checked={darkMode} onChange={() => setDarkMode((prev) => { localStorage.setItem('darkMode', !prev); return !prev; })} style={{ accentColor: "var(--icon-main)" }} />
                  Dark Mode
                </label>
              </div>
            </div>
          )}
        </div>
        <button
          style={{ ...drawerBtnStyle, display: "flex", alignItems: "center", gap: 10, ...(isActivePath('/help') ? { color: activeLinkStyle.color, fontWeight: activeLinkStyle.fontWeight } : {}) }}
          onClick={() => { navigate("/help"); setDrawerOpen(false); }}
        >
          <span>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="var(--icon-main)" strokeWidth="1.5" fill="none"/>
              <path d="M12 16v-1c0-1.1.9-2 2-2s2-.9 2-2-.9-2-2-2-2 .9-2 2" stroke="var(--icon-main)" strokeWidth="1.5" fill="none"/>
              <circle cx="12" cy="18" r="1" fill="var(--icon-main)"/>
            </svg>
          </span>
          Help
        </button>
        <button
          style={{ ...drawerBtnStyle, display: "flex", alignItems: "center", gap: 10, ...(isActivePath('/about') ? { color: activeLinkStyle.color, fontWeight: activeLinkStyle.fontWeight } : {}) }}
          onClick={() => { navigate("/about"); setDrawerOpen(false); }}
        >
          <span>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="var(--icon-main)" strokeWidth="1.5" fill="none"/>
              <path d="M12 8v4" stroke="var(--icon-main)" strokeWidth="1.5" fill="none"/>
              <circle cx="12" cy="16" r="1" fill="var(--icon-main)"/>
            </svg>
          </span>
          About
        </button>
        <div style={{ marginTop: "auto", padding: "1rem 1rem 1.25rem 1rem", borderTop: "1px solid var(--border-main)", display: "flex", alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {(!avatarBroken && avatarUrl) ? (
                <img src={avatarUrl} alt={fullName || 'Profile'} title={fullEmail || fullName || 'Profile'} onError={(ev) => handleAvatarError(avatarUrl, ev)} onClick={(e) => { if (e.altKey || e.ctrlKey) { showAvatarDebug(); } }} style={{ width: 44, height: 44, borderRadius: 999, objectFit: 'cover', border: '2px solid var(--border-main)' }} />
              ) : (
                <div style={{ width: 44, height: 44, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--border-main)', background: 'var(--border-main)', color: 'var(--text-main)', fontWeight: 700 }}>{getInitials(fullName)}</div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: 'var(--text-main)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={fullName}>{nameToDisplay}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={fullEmail}>{emailToDisplay}</div>
              </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button
              onClick={() => { setDrawerOpen(false); if (onLogout) onLogout(); }}
              style={{
                background: 'transparent',
                color: 'var(--logout-color, #d32f2f)',
                border: '2px solid var(--logout-color, #d32f2f)',
                padding: '6px 12px',
                borderRadius: 6,
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ marginRight: 8 }}>
                <path d="M16 17v1a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                <path d="M21 12H9m0 0l3-3m-3 3l3 3" stroke="currentColor" strokeWidth="1.5" fill="none"/>
              </svg>
              Logout
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default TopBar;
