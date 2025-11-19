import React, { useContext, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

// Minimal modal — keeps styling consistent with app (inline styles)
export default function SessionAlert() {
  const { user, role, setRole } = useContext(AuthContext);
  const loc = useLocation();
  const prevUserRef = useRef(user);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Detect transition from signed-in -> signed-out while app role is present
    const prev = prevUserRef.current;
    if (prev && !user && role) {
      // store current location to return after login
      try { localStorage.setItem('postAuthRedirect', loc.pathname + loc.search); } catch (e) {}
      setVisible(true);
    }
    prevUserRef.current = user;
  }, [user, role, loc]);

  if (!visible) return null;

  return (
    <div style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)' }}>
      <div style={{ width: 480, maxWidth: '95%', borderRadius: 8, padding: 16, background: 'var(--bg-main)', border: '1px solid var(--border-main)', color: 'var(--text-main)' }}>
        <h3 style={{ marginTop: 0 }}>Session signed out</h3>
        <div style={{ marginBottom: 12 }}>Your session was signed out. You can re-login to return to where you left off.</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={() => { setVisible(false); }} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-main)', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer' }}>Dismiss</button>
          <button onClick={() => { try { localStorage.setItem('postAuthRedirect', loc.pathname + loc.search); } catch (e) {} setRole(''); }} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-main)', background: 'var(--text-main)', color: 'white', cursor: 'pointer' }}>Re-login</button>
        </div>
      </div>
    </div>
  );
}
