import React, { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

const toDate = (ts) => {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  if (ts.seconds) return new Date(ts.seconds * 1000);
  if (ts instanceof Date) return ts;
  return new Date(ts);
};

const buildBuckets = (period) => {
  const now = new Date();
  if (period === 'monthly') {
    const labels = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      labels.push({ start: new Date(d.getFullYear(), d.getMonth(), 1), end: new Date(d.getFullYear(), d.getMonth() + 1, 1), label: d.toLocaleString(undefined, { month: 'short', year: 'numeric' }) });
    }
    return labels;
  }
  if (period === 'weekly') {
    const labels = [];
    const day = now.getDay();
    const diffToMon = (day + 6) % 7;
    const thisMonday = new Date(now); thisMonday.setDate(now.getDate() - diffToMon); thisMonday.setHours(0,0,0,0);
    for (let i = 11; i >= 0; i--) {
      const start = new Date(thisMonday); start.setDate(thisMonday.getDate() - i * 7);
      const end = new Date(start); end.setDate(start.getDate() + 7);
      labels.push({ start, end, label: start.toLocaleDateString() });
    }
    return labels;
  }
  const labels = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(now.getDate() - i); d.setHours(0,0,0,0);
    const next = new Date(d); next.setDate(d.getDate() + 1);
    labels.push({ start: d, end: next, label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) });
  }
  return labels;
};

const BookingWidget = ({ branch = null, period = 'daily', compact = false }) => {
  const [labels, setLabels] = useState(() => buildBuckets(period));
  const [total, setTotal] = useState(0);

  useEffect(() => setLabels(buildBuckets(period)), [period]);

  useEffect(() => {
    const col = collection(db, 'appointments');
    const unsub = onSnapshot(col, snap => {
      const sums = labels.map(() => 0);
      snap.docs.forEach(d => {
        const a = d.data();
        if (branch && a.branch && a.branch !== branch) return;
        const ts = toDate(a.startTime || a.date || a.createdAt);
        if (!ts) return;
        for (let i = 0; i < labels.length; i++) {
          if (ts >= labels[i].start && ts < labels[i].end) { sums[i] += 1; break; }
        }
      });
      setTotal(sums.reduce((s, v) => s + v, 0));
    }, err => console.warn('appt snap failed', err));
    return () => unsub();
  }, [branch, labels.join && labels.join('-'), period]);

  // Render totals-only (no chart)
  if (compact) {
    return (
      <div style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border-main)', background: 'var(--surface)', minWidth: 120, textAlign: 'center' }}>
        <div style={{ fontSize: 12, color: 'var(--gold)', marginBottom: 4 }}>Bookings</div>
        <div style={{ fontSize: 16, fontWeight: 700 }}>{total}</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 12, borderRadius: 8, border: '1px solid var(--border-main)', background: 'var(--surface)' }}>
      <div style={{ fontSize: 13, color: 'var(--gold)', marginBottom: 6 }}>Bookings ({period})</div>
      <div style={{ fontSize: 16, fontWeight: 700 }}>{total}</div>
    </div>
  );
};

export default BookingWidget;
