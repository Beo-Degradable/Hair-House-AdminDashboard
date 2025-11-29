import React, { useState } from 'react';
import BookingWidget from '../../components/BookingWidget';
// KPIRow removed per request

// StylistHome — landing page with today's appointments and KPI snapshot
const StylistHome = ({ onLogout }) => {
  const [branch, setBranch] = useState('');

  return (
    <div style={{ minHeight: '100vh', width: '100%', position: 'relative', color: 'var(--text-main)', background: 'var(--bg-main)', fontWeight: 'var(--font-weight-main)', transition: 'background 0.3s, color 0.3s, font-weight 0.3s' }}>

      <main className="stylist-main container" style={{ marginLeft: 0, marginTop: 56, padding: 'clamp(12px, 2.5vw, 28px)', boxSizing: 'border-box' }}>
        <h1>Stylist Home</h1>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 18, alignItems: 'start', marginTop: 12 }}>
          <section>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ background: 'var(--bg-drawer)', border: '1px solid var(--border-main)', borderRadius: 10, padding: 12 }}>
                <h2 style={{ margin: 0, marginBottom: 8 }}>Today — Appointments</h2>
                <BookingWidget branch={branch} />
              </div>

              {/* Performance KPI row removed */}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default StylistHome;
