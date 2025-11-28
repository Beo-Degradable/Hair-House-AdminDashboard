

// Admin top navigation bar: responsive nav buttons, notifications indicator,
// avatar/profile menu, drawer with settings & dark mode toggle.
import React, { useState, useEffect, useRef, useContext } from "react";
import { AuthContext } from "../../context/AuthContext";
import { auth, db } from "../../firebase";
import { useNavigate, useLocation } from "react-router-dom";
import { collection, query as q, orderBy, limit, onSnapshot, doc as docRef, getDoc, where, startAt, endAt, getDocs } from 'firebase/firestore';
import AdminDrawer from '../../components/AdminDrawer';

// Standard admin navigation buttons (used by the topbar). The drawer
// rendering below intentionally omits printing these entries so the
// drawer remains minimal while the topbar provides primary navigation.
const navButtons = [
  { label: 'Home', path: '/' },
  { label: 'Appointments', path: '/appointments' },
  { label: 'Products', path: '/products' },
  { label: 'Services', path: '/services' },
  { label: 'Promotions', path: '/promotions' },
  { label: 'Inventory', path: '/inventory' },
  { label: 'Profiles', path: '/profiles' },
  { label: 'Users', path: '/users' },
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
  const [showProfileMenu, setShowProfileMenu] = useState(false); // deprecated; dropdown removed
  const profileBtnRef = useRef(null); // deprecated
  const profileMenuRef = useRef(null); // deprecated
  const [showNav, setShowNav] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const moreBtnRef = useRef(null);
  const moreMenuRef = useRef(null);
  const [paymentProfile, setPaymentProfile] = useState(null);

  // Notification indicator (simple state for now; can be wired to Firestore)
  const [hasNewNotifications, setHasNewNotifications] = useState(false);
  // Quick search state
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const searchRef = useRef(null);
  const [searchSelected, setSearchSelected] = useState(-1);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchCache = useRef(new Map());

  const HISTORY_KEY = 'hh_search_history_v1';

  const loadHistory = () => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed;
    } catch (e) { return []; }
  };

  const saveToHistory = (item) => {
    try {
      if (!item || !item.label) return;
      const raw = localStorage.getItem(HISTORY_KEY);
      let arr = [];
      if (raw) {
        arr = JSON.parse(raw) || [];
      }
      // dedupe by type+id or label
      const key = `${item.type || 'q'}:${item.id || item.label}`;
      arr = arr.filter(x => `${x.type || 'q'}:${x.id || x.label}` !== key);
      arr.unshift(item);
      arr = arr.slice(0, 8);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(arr));
    } catch (e) {}
  };

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
    if (trimmed.length <= max) return trimmed;
    const parts = trimmed.split(/\s+/);
    if (parts.length > 1) {
      const first = parts[0];
      const lastInitial = parts[parts.length - 1][0] || '';
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

  // Compact display helpers: prefer short "First L." and truncated local-part emails
  function compactNameForUI(name) {
    if (!name) return '';
    const trimmed = name.trim();
    const parts = trimmed.split(/\s+/);
    if (parts.length === 1) {
      return trimmed.length <= 12 ? trimmed : `${trimmed.slice(0, 9)}...`;
    }
    const first = parts[0];
    const last = parts[parts.length - 1] || '';
    const lastInitial = last ? `${last[0]}.` : '';
    const candidate = `${first} ${lastInitial}`;
    if (candidate.length <= 14) return candidate;
    // fallback to first name truncated
    return `${first.slice(0, Math.max(3, 11))}...`;
  }

  function compactEmailForUI(email) {
    if (!email) return '';
    const parts = email.split('@');
    const local = parts[0] || '';
    const domain = parts[1] || '';
    if (!domain) {
      return local.length <= 12 ? local : `${local.slice(0, 9)}...`;
    }
    if (local.length <= 8) return `${local}@${domain}`;
    return `${local.slice(0, 8)}...@${domain}`;
  }

  // md5Hex: compute MD5 hex digest (SubtleCrypto first, JS fallback)
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
        // fall through to JS fallback
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

  // If the resolved avatar URL changes, clear the "broken" flag so we attempt to load it again.
  useEffect(() => {
    setAvatarBroken(false);
  }, [avatarUrl]);

  // Track broken avatar to show initials
  const [avatarBroken, setAvatarBroken] = useState(false);

  // Display-shorten helpers used in the topbar and drawer footer (compact by default)
  const nameToDisplay = compactNameForUI(fullName) || shortenName(fullName, 20) || shorten(fullName, 12);
  const emailToDisplay = compactEmailForUI(fullEmail) || shortenEmail(fullEmail, 14);

  // Compute drawer width based on viewport (keeps a sensible min/max)
  const computedDrawerWidth = Math.min(drawerWidth, Math.max(180, Math.floor(viewportWidth * 0.85)));

  // Search expansion: expand the input when there are results to show
  const searchExpanded = showSearch && Array.isArray(searchResults) && searchResults.length > 0;
  // Fixed search bar width (does not change when results appear)
  const searchBarWidth = Math.min(420, Math.max(240, Math.floor(viewportWidth * 0.28)));

  const getInitials = (name) => {
    // Return a single deterministic initial (first letter of first name).
    // Fallback to email local-part first letter, or 'U'.
    if (!name || !name.trim()) {
      if (fullEmail) {
        const local = (fullEmail.split('@')[0] || '').trim();
        return (local.slice(0, 1) || 'U').toUpperCase();
      }
      return 'U';
    }
    const parts = name.trim().split(/\s+/);
    return (parts[0] && parts[0][0] ? parts[0][0].toUpperCase() : 'U');
  };

  // Safe navigation helper: try React Router `navigate`, fall back to `window.location`.
  const safeNavigate = (path) => {
    try {
      if (typeof navigate === 'function') {
        navigate(path);
        return;
      }
    } catch (e) {
      // fall back to window navigation below
    }
    try {
      if (typeof window !== 'undefined' && window.location) window.location.href = path;
    } catch (e) {
      // give up silently
    }
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

  // Close search dropdown on outside click
  useEffect(() => {
    if (!showSearch) return;
    const onDown = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSearch(false);
      }
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [showSearch]);

  // Debounced search effect with parallel fetch, caching, and faster response
  useEffect(() => {
    const term = searchTerm && searchTerm.trim();
    // allow single-character searches (show results even for first letter)
    if (!term || term.length < 1) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    let mounted = true;
    const qTerm = term.toLowerCase();

    // If cached, use immediately
    const cached = searchCache.current.get(qTerm);
    if (cached) {
      setSearchResults(cached.slice(0, 8));
      setSearchSelected(-1);
      setSearchLoading(false);
      setShowSearch(true);
      return;
    }

    // show dropdown and spinner immediately to improve perceived speed
    setShowSearch(true);
    setSearchLoading(true);

    // reduce per-collection fetch size for single-letter queries to keep reads light
    const maxPerCollection = (qTerm.length === 1) ? 40 : 80; // smaller page to make reads faster
    const collectionsToSearch = [
      { name: 'products', type: 'product', fields: ['name', 'title'] },
      { name: 'services', type: 'service', fields: ['name', 'title'] },
      { name: 'users', type: 'user', fields: ['name', 'email'] }
    ];

    const delay = 140; // shorter debounce for snappier feel
    const timeout = setTimeout(async () => {
      try {
        const results = [];
        const seen = new Set();

        // fetch in parallel
        const fetches = collectionsToSearch.map(async (col) => {
          try {
            const ref = collection(db, col.name);
            const snap = await getDocs(q(ref, limit(maxPerCollection)));
            snap.forEach(d => {
              if (seen.has(d.id)) return;
              const data = d.data() || {};
              let label = '';
              for (const f of col.fields) {
                if (data[f]) { label = data[f]; break; }
              }
              const lower = (label || '').toLowerCase();
              if (lower.indexOf(qTerm) !== -1) {
                seen.add(d.id);
                results.push({ type: col.type, id: d.id, label: label || (col.type === 'user' ? (data.email || 'User') : (data.title || data.name || col.type)) });
              }
            });
          } catch (e) {
            // ignore single collection errors
          }
        });

        await Promise.all(fetches);

        if (!mounted) return;
        // cache results for identical query to speed up repeat typing
        searchCache.current.set(qTerm, results.slice(0, 12));
        setSearchResults(results.slice(0, 8));
        setSearchSelected(-1);
      } catch (err) {
        // ignore
      } finally {
        if (!mounted) return;
        setSearchLoading(false);
        setShowSearch(true);
      }
    }, delay);

    return () => { mounted = false; clearTimeout(timeout); };
  }, [searchTerm]);

  // keyboard navigation for search
  const onSearchKey = (e) => {
    if (!showSearch) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSearchSelected(i => Math.min((searchResults.length - 1), (i + 1 < 0 ? 0 : i + 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSearchSelected(i => Math.max(0, (i - 1)));
    } else if (e.key === 'Enter') {
      e.preventDefault();
        if (searchSelected >= 0 && searchSelected < searchResults.length) {
        const r = searchResults[searchSelected];
        setShowSearch(false);
        setSearchTerm('');
        saveToHistory(r);
        if (r.type === 'product') safeNavigate(`/products?id=${encodeURIComponent(r.id)}`);
        else if (r.type === 'service') safeNavigate(`/services?id=${encodeURIComponent(r.id)}`);
        else if (r.type === 'user') safeNavigate(`/users?id=${encodeURIComponent(r.id)}`);
      }
      else if (searchTerm && searchTerm.trim().length) {
        // fallback: if user pressed enter with free text, save the query as a generic entry
        const qItem = { type: 'query', id: searchTerm.trim(), label: searchTerm.trim() };
        saveToHistory(qItem);
        setShowSearch(false);
      }
    } else if (e.key === 'Escape') {
      setShowSearch(false);
    } else if (e.key === 'Tab') {
      // Tab fills the input with the currently selected suggestion (like Google)
      if (searchSelected >= 0 && searchSelected < searchResults.length) {
        e.preventDefault();
        const r = searchResults[searchSelected];
        setSearchTerm(r.label);
        setShowSearch(false);
        setSearchSelected(-1);
        // keep focus on input; user can press Enter to navigate
      }
    }
  };

  const renderHighlighted = (label) => {
    if (!searchTerm) return label;
    const s = searchTerm.trim().toLowerCase();
    const lower = (label || '').toLowerCase();
    const idx = lower.indexOf(s);
    if (idx === -1) return label;
    const before = label.slice(0, idx);
    const match = label.slice(idx, idx + s.length);
    const after = label.slice(idx + s.length);
    return (
      <span>
        {before}<span style={{ color: '#b794f4', fontWeight: 700 }}>{match}</span>{after}
      </span>
    );
  };

  

  

  useEffect(() => {
    let mounted = true;
    async function loadProfile() {
      try {
        const uid = auth?.currentUser?.uid || user?.uid || user?.authUid;
        if (!uid) return;
        const ref = docRef(db, 'users', uid);
        const snap = await getDoc(ref);
        if (!mounted) return;
        if (snap.exists()) {
          const data = snap.data();
          setPaymentProfile(data.paymentProfile || null);
        } else {
          setPaymentProfile(null);
        }
      } catch (e) {
        console.warn('Failed to load payment profile', e);
        setPaymentProfile(null);
      }
    }
    loadProfile();
    return () => { mounted = false; };
  }, [user && user.uid, auth && auth.currentUser && auth.currentUser.uid]);

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
          {/* Topbar navigation removed per request: keep drawer toggle only for opening the sidebar. */}
        </div>
        {/* Right side: on Windows or wide screens show full nav here; otherwise leave it blank */}
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginRight: 16 }}>
          {/* Topbar: keep only notifications and profile avatar */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginRight: 6 }}>
            {/* Quick search: input nested inside a bordered container that expands downward and displays results inside it */}
            <div ref={searchRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                width: searchBarWidth,
                transition: 'width 0.22s ease',
                borderRadius: 8,
                background: 'var(--bg-drawer)',
                border: '1px solid var(--border-main)',
                boxShadow: showSearch ? '0 6px 18px rgba(0,0,0,0.18)' : 'none',
                padding: '4px 6px'
              }}>
                <input
                  value={searchTerm}
                  onChange={(e) => { const v = e.target.value; setSearchTerm(v); if (v && v.trim().length >= 1) { setShowSearch(true); setSearchLoading(true); } }}
                  onFocus={() => { setIsSearchFocused(true); if (!searchTerm || !searchTerm.trim()) { const hist = loadHistory(); if (hist && hist.length) { setSearchResults(hist); setShowSearch(true); } } else if (searchResults.length) setShowSearch(true); }}
                  onBlur={() => { setIsSearchFocused(false); /* dropdown closing handled by outside click effect */ }}
                  onKeyDown={onSearchKey}
                  placeholder="Search services, products, users"
                  aria-label="Search"
                  style={{ height: 24, padding: '4px 6px', borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--text-main)', width: '100%', outline: 'none', fontSize: 13 }}
                />
              </div>

              {/* Absolutely positioned results dropdown below the searchbar so the input remains visible */}
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: 8,
                width: searchBarWidth,
                zIndex: 1402,
                borderRadius: 8,
                background: 'var(--bg-drawer)',
                border: '1px solid #caa90a',
                boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                overflow: 'hidden',
                maxHeight: (showSearch ? Math.min(320, 56 + (Array.isArray(searchResults) ? searchResults.length * 56 : 0)) : 0),
                transition: 'max-height 0.18s ease, opacity 0.12s ease',
                opacity: (showSearch ? 1 : 0),
                overflowY: 'auto'
              }}>
                {showSearch && searchLoading && (
                  <div style={{ padding: 10, color: 'var(--muted)' }}>Searching…</div>
                )}

                {showSearch && !searchLoading && searchResults.map((r, idx) => (
                  <button type="button" key={`${r.type}-${r.id}-${idx}`} onMouseDown={(e) => { e.preventDefault(); }} onClick={() => {
                    setShowSearch(false);
                    setSearchTerm('');
                    // Navigate to the collection list page and include the item id as a query param
                    if (r.type === 'product') safeNavigate(`/products?id=${encodeURIComponent(r.id)}`);
                    else if (r.type === 'service') safeNavigate(`/services?id=${encodeURIComponent(r.id)}`);
                    else if (r.type === 'user') safeNavigate(`/users?id=${encodeURIComponent(r.id)}`);
                  }} style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%', padding: '10px 12px', background: searchSelected === idx ? 'rgba(202,169,10,0.08)' : 'transparent', border: 'none', textAlign: 'left', color: 'var(--text-main)', cursor: 'pointer' }} onMouseEnter={() => setSearchSelected(idx)} onMouseLeave={() => setSearchSelected(-1)}>
                    <div style={{ width: 8 }} />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <div style={{ fontWeight: 700, color: '#ffd14d' }}>{renderHighlighted(r.label)}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{r.type}</div>
                    </div>
                  </button>
                ))}

                {showSearch && !searchLoading && searchResults.length === 0 && (
                  <div style={{ padding: 10, color: 'var(--muted)' }}>No results</div>
                )}
              </div>
            </div>
            <button onClick={() => { safeNavigate('/notifications'); setDrawerOpen(false); }} title="Notifications" style={{ background: 'none', border: 'none', cursor: 'pointer', position: 'relative', padding: 6 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0 1 18 14.158V11a6 6 0 0 0-5-5.917V4a1 1 0 1 0-2 0v1.083A6 6 0 0 0 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5" stroke="var(--icon-main)" strokeWidth="1.4" fill="none" />
              </svg>
              {hasNewNotifications && (
                <span style={{ position: 'absolute', right: 2, top: 2, width: 10, height: 10, borderRadius: 10, background: 'var(--danger, #d32f2f)', boxShadow: '0 0 0 2px rgba(0,0,0,0.06)' }} />
              )}
            </button>

            {/* Dark mode toggle */}
            <button onClick={() => { if (typeof setDarkMode === 'function') setDarkMode(!darkMode); }} title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, display: 'flex', alignItems: 'center' }} aria-label="Toggle dark mode">
              {darkMode ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M12 3v2" stroke="var(--icon-main)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M12 19v2" stroke="var(--icon-main)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M4.22 4.22l1.42 1.42" stroke="var(--icon-main)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M18.36 18.36l1.42 1.42" stroke="var(--icon-main)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M1 12h2" stroke="var(--icon-main)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M21 12h2" stroke="var(--icon-main)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M4.22 19.78l1.42-1.42" stroke="var(--icon-main)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M18.36 5.64l1.42-1.42" stroke="var(--icon-main)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="12" r="3" stroke="var(--icon-main)" strokeWidth="1.6" fill="var(--bg-drawer)" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="var(--icon-main)" strokeWidth="1.4" fill="none" />
                </svg>
              )}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                ref={profileBtnRef}
                onClick={(e) => { if (e.altKey || e.ctrlKey) { showAvatarDebug(); return; } safeNavigate('/account-settings'); }}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                title={fullEmail || fullName || 'Account Settings'}
                aria-label={fullEmail || fullName || 'Account Settings'}
              >
                <div
                  title={fullName || 'Profile'}
                  aria-label={fullName || 'Profile'}
                  style={{ width: 26, height: 26, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--border-main)', color: 'var(--text-main)', fontSize: 12, fontWeight: 700, border: '1px solid var(--border-main)' }}
                >
                  {getInitials(fullName)}
                </div>
              </button>

              <button onClick={() => safeNavigate('/account-settings')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }} title={fullName} aria-label={fullName}>
                <span style={{ color: 'var(--text-main)', fontWeight: 400, fontSize: 14, maxWidth: 220, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nameToDisplay}</span>
              </button>
            </div>
          </div>
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
        <span style={{ marginLeft: 24, fontWeight: "var(--font-weight-main)", fontSize: 18, color: "var(--text-main)", display: "inline-block", marginBottom: 12 }}>Hair House</span>
        {/* Render primary navigation from topbar here (vertical list) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 8px' }}>
          {navButtons.map((btn) => {
            const active = isActivePath(btn.path);
            return (
              <button
                key={btn.label}
                onClick={() => { navigate(btn.path); setDrawerOpen(false); }}
                style={{
                  ...drawerBtnStyle,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  justifyContent: 'flex-start',
                  ...(active ? { color: activeLinkStyle.color, fontWeight: activeLinkStyle.fontWeight } : {})
                }}
              >
                <span style={{ width: 18, display: 'inline-block' }} />
                {btn.label}
              </button>
            );
          })}
        </div>
        <div style={{ marginTop: "auto", padding: "1rem 1rem 1.25rem 1rem", borderTop: "1px solid var(--border-main)", display: "flex", alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Use a compact initials avatar in the drawer footer (deterministic, no external images) */}
              <div style={{ width: 28, height: 28, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-main)', background: 'var(--border-main)', color: 'var(--text-main)', fontWeight: 700, fontSize: 12 }}>{getInitials(fullName)}</div>
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <div style={{ fontWeight: 400, fontSize: 14, color: 'var(--text-main)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={fullName}>{nameToDisplay}</div>
                  <div style={{ fontWeight: 400, fontSize: 12, color: 'var(--muted)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={fullEmail}>{emailToDisplay}</div>
              </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button
              onClick={() => { setDrawerOpen(false); if (onLogout) onLogout(); }}
              style={{
                background: 'transparent',
                color: 'var(--logout-color, #d32f2f)',
                border: '1px solid var(--logout-color, #d32f2f)',
                padding: '4px 10px',
                borderRadius: 6,
                fontWeight: 700,
                fontSize: 12,
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
    </>
  );
};

export default TopBar;
