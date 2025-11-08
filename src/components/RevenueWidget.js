import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { formatCurrency } from '../utils/formatters';

// Utility: normalize firestore timestamp or Date to JS Date
const toDate = (ts) => {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  if (ts.seconds) return new Date(ts.seconds * 1000);
  if (ts instanceof Date) return ts;
  return new Date(ts);
};

// Build buckets and labels depending on period
const buildBuckets = (period) => {
  const now = new Date();
  if (period === 'monthly') {
    // last 12 months
    const labels = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      labels.push({ key: `${d.getFullYear()}-${d.getMonth() + 1}`, label: d.toLocaleString(undefined, { month: 'short', year: 'numeric' }), start: new Date(d.getFullYear(), d.getMonth(), 1), end: new Date(d.getFullYear(), d.getMonth() + 1, 1) });
    }
    return labels;
  }

  if (period === 'weekly') {
    // last 12 weeks (week starts Monday)
    const labels = [];
    const day = now.getDay();
    const diffToMon = (day + 6) % 7; // days since Monday
    const thisMonday = new Date(now);
    thisMonday.setDate(now.getDate() - diffToMon);
    thisMonday.setHours(0,0,0,0);
    for (let i = 11; i >= 0; i--) {
      const start = new Date(thisMonday);
      start.setDate(thisMonday.getDate() - i * 7);
      const end = new Date(start);
      end.setDate(start.getDate() + 7);
      labels.push({ key: `${start.toISOString().slice(0,10)}`, label: `${start.toLocaleDateString()}`, start, end });
    }
    return labels;
  }

  // default = daily: last 7 days
  const labels = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(now.getDate() - i); d.setHours(0,0,0,0);
    const next = new Date(d); next.setDate(d.getDate() + 1);
    labels.push({ key: d.toISOString().slice(0,10), label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), start: d, end: next });
  }
  return labels;
};

const LineChartInteractive = ({ points = [], labels = [], height = 80, color = '#f59e0b', onHoverIndex, onSelectIndex }) => {
  if (!points || points.length === 0) return <div style={{ height }} />;
  const max = Math.max(...points, 1);
  // Use viewBox width so SVG can scale responsively to container width
  const w = Math.max(180, points.length * 32);
  const step = w / Math.max(1, points.length - 1);
  const path = points.map((v, i) => `${i === 0 ? 'M' : 'L'} ${i * step} ${height - (v / max) * (height - 12)}`).join(' ');

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none">
        <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {points.map((v, i) => (
          <g key={i}>
            <circle cx={i * step} cy={height - (v / max) * (height - 12)} r={4} fill={color}
              onMouseEnter={() => onHoverIndex && onHoverIndex(i)}
              onMouseLeave={() => onHoverIndex && onHoverIndex(null)}
              onClick={() => onSelectIndex && onSelectIndex(i)}
              style={{ cursor: 'pointer' }}
            />
            {/* invisible hit area */}
            <rect x={Math.max(0, i * step - step / 2)} y={0} width={step} height={height} fill="transparent"
              onMouseEnter={() => onHoverIndex && onHoverIndex(i)}
              onMouseLeave={() => onHoverIndex && onHoverIndex(null)}
              onClick={() => onSelectIndex && onSelectIndex(i)}
            />
          </g>
        ))}
      </svg>
    </div>
  );
};

const RevenueWidget = ({ branch = null, period = 'daily', mode = 'total', onLoaded }) => {
  const [labels, setLabels] = useState(() => buildBuckets(period));
  const [points, setPoints] = useState([]);
  const [total, setTotal] = useState(0);
  const [hoverIndex, setHoverIndex] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(null);

  useEffect(() => setLabels(buildBuckets(period)), [period]);

  useEffect(() => {
    let unsub = () => {};
    const paymentsCol = collection(db, 'payments');
    // start with getDocs to decide if payments exist real-time; but we'll just subscribe to payments
    unsub = onSnapshot(paymentsCol, snap => {
      const sums = labels.map(() => 0);
      snap.docs.forEach(d => {
        const p = d.data();
        if (branch && p.branch && p.branch !== branch) return;
        const ts = toDate(p.createdAt || p.created_at || p.date || p.time);
        if (!ts) return;
        for (let i = 0; i < labels.length; i++) {
          const lb = labels[i];
          if (ts >= lb.start && ts < lb.end) {
            sums[i] += Number(p.amount || p.total || 0);
            break;
          }
        }
      });
      setPoints(sums);
      setTotal(sums.reduce((s, v) => s + v, 0));
      onLoaded && onLoaded({ total: sums.reduce((s, v) => s + v, 0), points: sums, labels });
    }, err => {
      console.warn('payments snap failed', err);
    });

    return () => unsub();
  // depend on branch, period and the labels keys so we resubscribe when the bucket boundaries change
  }, [branch, period, labels.map(l => l.key).join('-')]);

  // If the points array changes (new data / different buckets), make sure the selected index is still valid
  useEffect(() => {
    if (selectedIndex !== null) {
      if (!points || selectedIndex >= points.length) {
        setSelectedIndex(null);
      }
    }
  }, [points, selectedIndex]);

  return (
    <div style={{ padding: 8, borderRadius: 8, border: '1px solid var(--border-main)', background: 'var(--surface)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ fontSize: 12, color: 'var(--gold)' }}>
          Revenue {mode === 'total' ? `(${period})` : ''}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{mode === 'total' ? 'Total' : 'Graph'}</div>
      </div>

      {mode === 'total' ? (
        <div style={{ fontSize: 16, fontWeight: 700 }}>{formatCurrency(total)}</div>
      ) : (
        <div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <LineChartInteractive points={points} labels={labels.map(l => l.label)} height={80} color="#f59e0b" onHoverIndex={setHoverIndex} onSelectIndex={(i) => setSelectedIndex(prev => prev === i ? null : i)} />
              <div style={{ display: 'flex', gap: 6, marginTop: 6, fontSize: 11, color: 'var(--text-secondary)', justifyContent: 'space-between' }}>
                {labels.map((l, i) => <div key={l.key} style={{ textAlign: 'center', flex: 1 }}>{l.label}</div>)}
              </div>
            </div>
          </div>

          {/* Selected-date revenue shown in a separate full-width container below the graph */}
          {selectedIndex !== null && labels[selectedIndex] && (
            <div style={{ marginTop: 10, padding: 10, borderRadius: 8, border: '1px solid var(--border-main)', background: 'var(--surface)' }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Revenue</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{labels[selectedIndex].label}: {formatCurrency(points[selectedIndex] || 0)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RevenueWidget;
