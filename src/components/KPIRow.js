import React, { useState } from 'react';
import RevenueWidget from './RevenueWidget';
import BookingWidget from './BookingWidget';
import LowStockWidget from './LowStockWidget';

// Compact KPI row: three tiles side-by-side on wide screens, stacked on narrow screens.
const KPIRow = ({ branch }) => {
  const [period, setPeriod] = useState('daily'); // shared period for revenue & bookings
  const [revenueMode, setRevenueMode] = useState('total');

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'stretch', marginBottom: 12, flexWrap: 'wrap' }}>
  <div style={{ flex: '1 1 380px', minWidth: 220 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gold)' }}>Revenue ({period})</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select aria-label="Period" value={period} onChange={e => setPeriod(e.target.value)} style={{ padding: '4px 6px', borderRadius: 6, fontSize: 13 }}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
            <select aria-label="View" value={revenueMode} onChange={e => setRevenueMode(e.target.value)} style={{ padding: '4px 6px', borderRadius: 6, fontSize: 13 }}>
              <option value="total">Total</option>
              <option value="graph">Graph</option>
            </select>
          </div>
        </div>
        <RevenueWidget branch={branch} period={period} mode={revenueMode} />
      </div>

      <div style={{ display: 'flex', gap: 12, flex: '0 0 auto', alignItems: 'center' }}>
        <BookingWidget branch={branch} period={period} compact />
        <LowStockWidget branch={branch} />
      </div>
    </div>
  );
};

export default KPIRow;
