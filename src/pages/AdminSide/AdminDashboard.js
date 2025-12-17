// Admin dashboard shell: global theme, topbar, KPI/graphs and recent activity layout.
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import TopBar from "./TopBar";
import useAppointments from '../../hooks/useAppointments';
import useInventory from '../../hooks/useInventory';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { formatCurrency, formatStatus } from '../../utils/formatters';
// RecentActivityFeed and KPIRow removed per request


const AdminDashboard = ({ onLogout, page }) => {
  const { items, inventoryMap, loading: invLoading } = useInventory();
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
        '--text-main': '#f6f6f6',
        '--text-secondary': '#fffbe6',
        '--border-main': 'rgba(255,215,0,0.18)',
        '--icon-main': '#FFD700',
        '--btn-bg': 'none',
        '--btn-hover': '#333',
        '--logout-bg': '#d32f2f',
        '--logout-color': '#fff',
        '--font-weight-main': 400,
      }
    : {
        /* Light mode design tokens mapped from provided spec */
        '--bg-main': '#F9F7F4', /* App Background */
        '--bg-drawer': '#F5F5F5', /* Card / Drawer Background */
        '--bg-surface': '#F5F5F5',
        '--text-main': '#2B2B2B', /* Primary Text */
        '--text-secondary': '#6F6F6F', /* Secondary Text */
        '--border-main': 'rgba(215,183,122,0.18)', /* gold-tinted border */
        '--border-faint': 'rgba(215,183,122,0.08)',
        '--accent': '#D7B77A', /* Accent gold */
        '--accent-weak': 'rgba(215,183,122,0.08)',
        '--icon-main': '#2B2B2B',
        '--btn-bg': 'var(--bg-main)', /* Primary button background now matches app background */
        '--btn-hover': 'rgba(16,24,32,0.06)',
        '--logout-bg': '#D32F2F',
        '--logout-color': '#FFFFFF',
        '--font-weight-main': 400,
      };

  // Persist darkMode and apply theme variables to the document root so portals
  // (modals, drawers rendered into document.body) inherit the selected theme.
  useEffect(() => {
    try {
      // write each CSS var to :root
      Object.entries(theme).forEach(([k, v]) => {
        if (typeof document !== 'undefined' && document.documentElement && typeof document.documentElement.style.setProperty === 'function') {
          document.documentElement.style.setProperty(k, v);
        }
      });
    } catch (e) {
      // ignore
    }
    try { localStorage.setItem('darkMode', darkMode ? 'true' : 'false'); } catch (e) {}
  }, [theme, darkMode]);

  return (
      <div
        style={{
          minHeight: "100vh",
          width: "100%",
          position: "relative",
          color: "var(--text-main)",
          background: "var(--bg-main)",
          fontWeight: "var(--font-weight-main)",
          fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          fontSize: '14px',
          transition: "background 0.3s, color 0.3s, font-weight 0.3s",
          ...theme
        }}
      >
  <TopBar onLogout={onLogout} darkMode={darkMode} setDarkMode={setDarkMode} settingsOpen={settingsOpen} setSettingsOpen={setSettingsOpen} branch={branch} setBranch={setBranch} />
      <main className="admin-main-content container" style={{ marginLeft: 'var(--drawer-offset, 0px)', marginTop: 56, padding: '0 clamp(16px, 2.5vw, 32px)', boxSizing: 'border-box', transition: 'margin-left 0.22s ease' }}>
        {page ? (
          page
        ) : (
          <>
            {/* Inline KPI tiles (responsive): use classes so cards shrink to fit side-by-side on small screens */}
            <style>{`
              /* KPI row - desktop */
              /* Let flexbox size the KPI row so there is no large reserved gap on the right. */
              .kpi-row{display:flex;gap:12px;align-items:stretch;flex-wrap:nowrap;flex:1 1 auto;max-width:none}
              .kpi-card{flex:1 1 calc((100% - 24px)/3);min-width:0;background:var(--bg-drawer);border:1px solid var(--border-main);border-radius:8px;padding:8px;color:var(--text-main);box-sizing:border-box}
              .kpi-card .kpi-value{font-size:26px;font-weight:800;line-height:1}
              .kpi-card .kpi-sub{font-size:12px;color:var(--text-secondary)}

              /* Tablet: slightly smaller and tighter spacing */
              @media (max-width:960px){
                .kpi-row{gap:10px}
                .kpi-card{padding:7px}
                .kpi-card .kpi-value{font-size:22px}
                .kpi-card .kpi-sub{font-size:11px}
              }
              /* On narrower screens remove the right-side reservation so KPIs can use full width */
              @media (max-width:1024px){
                .kpi-row{max-width:none}
              }

              /* Phone landscape / small tablets: keep three side-by-side but reduce sizes */
              @media (max-width:720px){
                .kpi-row{gap:8px}
                .kpi-card{flex:1 1 calc((100% - 16px)/3);padding:6px;border-radius:6px}
                .kpi-card .kpi-value{font-size:20px}
                .kpi-card .kpi-sub{font-size:10px}
              }

              /* Narrow phones: smallest readable sizes so content doesn't wrap or feel cramped */
              @media (max-width:420px){
                .kpi-row{gap:6px}
                .kpi-card{flex:1 1 calc((100% - 12px)/3);padding:5px;border-radius:6px}
                .kpi-card .kpi-value{font-size:18px}
                .kpi-card .kpi-sub{font-size:9px}
                .kpi-card .kpi-note{font-size:11px}
              }
            `}</style>

              <style>{`
                /* Hide the low-stock box on small screens to reduce clutter */
                @media (max-width:720px){
                  .lowstock-box{display:none}
                }
              `}</style>

            {/* hook into appointments to compute unique customers */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <KpiWithAppointments />
              </div>
              <div className="lowstock-box" style={{ width: 320 }}>
                <LowStockBox items={items} inventoryMap={inventoryMap} invLoading={invLoading} />
              </div>
            </div>

            {/* Recent sales chart (left) and Stylists on the right (LowStock moved above) */}
            <DashboardSummary branch={branch} />
            <SummaryAlignedBox />
          </>
        )}
      </main>
    </div>
  );
}

// Calendar UI intentionally removed. AdminCalendar function deleted to keep layout minimal.

export default AdminDashboard;

// Small inline component placed here to keep this file self-contained.
function KpiWithAppointments() {
  const { appointments, loading } = useAppointments();
  const navigate = useNavigate();
  const totalAppointments = appointments ? appointments.length : 0;
  const { items: productItems } = useInventory();
  const [payments, setPayments] = useState([]);

  useEffect(() => {
    try {
      const col = collection(db, 'payments');
      const unsub = onSnapshot(col, snap => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setPayments(list);
      }, err => {
        console.warn('payments listener failed', err);
        setPayments([]);
      });
      return () => unsub();
    } catch (e) {
      setPayments([]);
    }
  }, []);

  // compute total revenue from appointments with status 'completed'
  const totalRevenue = React.useMemo(() => {
    if (!appointments || !appointments.length) return 0;
    const parseNumber = (v) => {
      if (v == null) return 0;
      if (typeof v === 'number') return v;
      try {
        const s = v.toString().replace(/[^0-9.\-]/g, '');
        const n = parseFloat(s);
        return Number.isFinite(n) ? n : 0;
      } catch (e) { return 0; }
    };
      
    let sum = 0;
    for (const a of appointments) {
      const status = String(a.status || '').toLowerCase();
      if (status !== 'completed') continue;
      
      // prefer finalPrice, then price, then amount; fall back to service prices
      let amt = 0;
      if (a.finalPrice != null) amt = parseNumber(a.finalPrice);
      else if (a.price != null) amt = parseNumber(a.price);
      else if (a.amount != null) amt = parseNumber(a.amount);
      else if (Array.isArray(a.services) && a.services.length) {
        for (const s of a.services) {
          amt += parseNumber(s.price || s.amount || s.cost || s.total || 0);
        }
      }

      sum += (Number.isFinite(amt) ? amt : 0);
    }
    return sum;
  }, [appointments]);

  // include delivered product profits from payments
  const paymentsProfit = React.useMemo(() => {
    if (!payments || !payments.length) return 0;
    const isDelivered = (s) => {
      if (!s) return false;
      const st = s.toString().toLowerCase();
      return ['delivered', 'completed', 'received'].includes(st);
    };
    let pSum = 0;
    for (const p of payments) {
      if (!isDelivered(p.status || p.state)) continue;
      const itemsArr = Array.isArray(p.items) ? p.items : (p.purchasedProducts || []);
      for (const it of itemsArr) {
        const qty = Number(it.quantity || it.qty || 1) || 0;
        const price = Number(it.price || it.unitPrice || 0) || 0;
        let prod = null;
        if (it.productId && productItems && productItems.length) prod = productItems.find(x => x.id === it.productId);
        if (!prod && it.name && productItems && productItems.length) prod = productItems.find(x => ((x.name || x.title || '') + '').toString() === (it.name + '').toString());
        const cost = prod ? Number(prod.cost || prod.unitCost || prod.purchaseCost || 0) : Number(it.cost || it.unitCost || 0);
        pSum += (price - (cost || 0)) * qty;
      }
    }
    return pSum;
  }, [payments, productItems]);

  const totalRevenueWithProducts = (totalRevenue || 0) + (paymentsProfit || 0);

  // appointments that fall on today's date (local)
  const appointmentsToday = React.useMemo(() => {
    if (!appointments || !appointments.length) return 0;
    const isSameDay = (d1, d2) => d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
    const today = new Date();
    let cnt = 0;
    for (const a of appointments) {
      let st = a.startTime || a._start || a.start || null;
      if (!st) {
        // some payloads may store start as string or nested field
        st = a._start || null;
      }
      let dt = null;
      try {
        if (!st) dt = null;
        else if (st.toDate && typeof st.toDate === 'function') dt = st.toDate();
        else if (st instanceof Date) dt = st;
        else dt = new Date(st);
      } catch (e) { dt = null; }
      if (dt && isFinite(dt.getTime()) && isSameDay(dt, today)) cnt++;
    }
    return cnt;
  }, [appointments]);

  return (
    <div className="kpi-row" style={{ marginTop: 0 }}>
      <div className="kpi-card">
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Total Customer</div>
        <div className="kpi-value">{loading ? '…' : totalAppointments}</div>
      </div>

        <div className="kpi-card">
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Total Revenue</div>
          <div className="kpi-value">{loading ? '…' : formatCurrency(totalRevenueWithProducts)}</div>
        </div>

      <div className="kpi-card">
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Appointments Today</div>
        <div
          className="kpi-value"
          onClick={() => navigate(`/appointments?date=${new Date().toISOString().slice(0,10)}`)}
          role="button"
          title="View today's appointments"
          style={{ cursor: 'pointer' }}
        >
          {loading ? '…' : appointmentsToday}
        </div>
      </div>

      
    </div>
  );
}

// SummaryAlignedContainer removed per user request.

// Low stock box that will be rendered beside the KPI row so it lines up with the 3-container layout
function LowStockBox({ items, inventoryMap, invLoading }) {
  const lowThreshold = 5;
  const lowItems = React.useMemo(() => {
    if (!items || !items.length) return [];
    const out = [];
    for (const p of items) {
      const pid = p.id;
      const per = inventoryMap && inventoryMap[pid] ? inventoryMap[pid] : {};
      for (const [branchKey, data] of Object.entries(per || {})) {
        const qty = Number((data && data.quantity) || 0);
        if (qty <= lowThreshold) out.push({ product: p.name || p.title || pid, branch: branchKey, qty });
      }
    }
    return out.slice(0, 8);
  }, [items, inventoryMap]);

  return (
    <div style={{ background: 'var(--bg-drawer)', border: '1px solid var(--border-main)', borderRadius: 8, padding: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>Low Stock Items</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {lowItems && lowItems.length > 0 ? (
            <div style={{ background: '#d32f2f', color: '#fff', padding: '4px 8px', borderRadius: 12, fontSize: 12, fontWeight: 700 }}>{lowItems.length} low</div>
          ) : (
            <div className="no-alerts-text" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>No alerts</div>
          )}
        </div>
      </div>

      {invLoading ? <div>Loading…</div> : (
        lowItems.length ? (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {lowItems.map((li, i) => (
              <li key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 6px', borderBottom: '1px dashed rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize: 13 }}>{li.product}</div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{li.qty} <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>@{li.branch}</span></div>
              </li>
            ))}
          </ul>
        ) : <div style={{ color: 'var(--text-secondary)' }}>No low-stock items</div>
      )}
    </div>
  );
}

// Small summary area: recent sales chart on the left and low-stock list on the right
function DashboardSummary({ branch }) {
  const { appointments } = useAppointments();
  const { items, inventoryMap, loading: invLoading } = useInventory();
  const [adjustments, setAdjustments] = React.useState([]);
  const [stylists, setStylists] = React.useState([]);

  // subscribe to inventoryAdjustments collection
  React.useEffect(() => {
    const col = collection(db, 'inventoryAdjustments');
    const q = query(col, orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAdjustments(list);
    }, err => {
      console.error('inventoryAdjustments listener failed', err);
      setAdjustments([]);
    });
    return () => unsub();
  }, []);

  // subscribe to users collection and keep stylist-type users
  React.useEffect(() => {
    try {
      const col = collection(db, 'users');
      const q = query(col, orderBy('name'));
      const unsub = onSnapshot(q, snap => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const sty = list.filter(u => String(u.role || '').toLowerCase() === 'stylist');
        setStylists(sty);
      }, err => { console.error('users listener', err); setStylists([]); });
      return () => unsub();
    } catch (e) { console.error('users listener failed', e); setStylists([]); }
  }, []);
  const [branchFilter, setBranchFilter] = React.useState('');
  const [mode, setMode] = React.useState('net'); // 'net' or 'gross'
  const [period, setPeriod] = React.useState('monthly'); // 'monthly' or 'weekly'
  const chartRef = React.useRef(null);
  const [tooltip, setTooltip] = React.useState({ visible: false, x: 0, y: 0, label: '', value: 0 });
  const [showInspect, setShowInspect] = React.useState(false);

  // Helper parsers and gross/net calculators
  const parseNumber = React.useCallback((v) => {
    if (v == null) return 0;
    if (typeof v === 'number') return v;
    try {
      const s = v.toString().replace(/[^0-9.\-]/g, '');
      const n = parseFloat(s);
      return Number.isFinite(n) ? n : 0;
    } catch (e) { return 0; }
  }, []);

  const computeGross = React.useCallback((a) => {
    // Gross = list / catalog price before discounts/refunds
    // Prefer explicit list prices where available. Avoid using `finalPrice` for gross unless nothing else is present.
    if (!a) return 0;
    // appointment-level explicit list price (preferred)
    if (a.listPrice != null) return parseNumber(a.listPrice);
    // fallback to explicit price if it likely represents list price
    if (a.price != null) return parseNumber(a.price);
    // sum service-level list prices when present
    if (Array.isArray(a.services) && a.services.length) {
      return a.services.reduce((s, x) => s + parseNumber(x.listPrice || x.price || x.amount || x.total || 0), 0);
    }
    // as an absolute last resort use finalPrice/amount (may already include discounts)
    if (a.finalPrice != null) return parseNumber(a.finalPrice);
    if (a.amount != null) return parseNumber(a.amount);
    return 0;
  }, [parseNumber]);

  const computeNet = React.useCallback((a) => {
    // Net = actual collected amount. Prefer explicit payments array (sums receipts and refunds), then `finalPrice`, then reconstructed amount.
    if (!a) return 0;

    // payments array (if present) — sum payments and subtract refunds (most reliable)
    if (Array.isArray(a.payments) && a.payments.length) {
      let paid = 0;
      for (const p of a.payments) {
        const t = String(p.type || '').toLowerCase();
        const amt = parseNumber(p.amount || p.value || p.total || 0);
        // treat refunds as negative; other payment types add (including tips)
        if (t.includes('refund')) paid -= amt;
        else paid += amt;
      }
      return paid;
    }

    // prefer explicit finalPrice when payments not present
    if (a.finalPrice != null) return parseNumber(a.finalPrice);

    // fallback: price minus discounts plus taxes minus refunds
    if (a.price != null) {
      const base = parseNumber(a.price);
      const discount = parseNumber(a.discountAmount || a.discount || 0);
      const tax = parseNumber(a.tax || a.taxes || 0);
      const refunds = parseNumber(a.refunds || 0);
      return base - discount + tax - refunds;
    }

    // fallback to services sums minus service-level discounts
    if (Array.isArray(a.services) && a.services.length) {
      let total = 0;
      for (const s of a.services) {
        const price = parseNumber(s.finalPrice || s.price || s.amount || s.total || 0);
        const disc = parseNumber(s.discountAmount || s.discount || 0);
        total += price - disc;
      }
      return total;
    }

    return 0;
  }, [parseNumber]);

  const computeAmount = React.useCallback((a, mode) => {
    return mode === 'net' ? computeNet(a) : computeGross(a);
  }, [computeGross, computeNet]);

  // Compute COGS for an appointment: try multiple possible shapes
  const computeCogs = React.useCallback((a) => {
    if (!a) return 0;
    let total = 0;
    // helper to safely read qty and cost
    const qn = (x) => Number(x == null ? 1 : x);
    // appointment-level product lists
    if (Array.isArray(a.products) && a.products.length) {
      for (const p of a.products) {
        const qty = qn(p.qty || p.quantity || p.q || 1);
        const unit = parseNumber(p.unitCost || p.cost || p.unit_cost || p.purchaseCost || p.costPrice || p.price || 0);
        total += qty * unit;
      }
      return total;
    }
    // alternate field names
    if (Array.isArray(a.usedProducts) && a.usedProducts.length) {
      for (const p of a.usedProducts) {
        const qty = qn(p.qty || p.quantity || p.q || 1);
        const unit = parseNumber(p.unitCost || p.cost || p.unit_cost || p.purchaseCost || p.costPrice || p.price || 0);
        total += qty * unit;
      }
      return total;
    }
    if (Array.isArray(a.consumables) && a.consumables.length) {
      for (const p of a.consumables) {
        const qty = qn(p.qty || p.quantity || 1);
        const unit = parseNumber(p.unitCost || p.cost || 0);
        total += qty * unit;
      }
      return total;
    }

    // services may include product usage or service-level cost
    if (Array.isArray(a.services) && a.services.length) {
      for (const s of a.services) {
        // service-level products
        if (Array.isArray(s.products) && s.products.length) {
          for (const p of s.products) {
            const qty = qn(p.qty || p.quantity || 1);
            const unit = parseNumber(p.unitCost || p.cost || p.price || 0);
            total += qty * unit;
          }
        }
        // service-level cost field
        const svcCost = parseNumber(s.unitCost || s.cost || s.serviceCost || s.cogs || 0);
        if (svcCost) total += svcCost;
      }
      return total;
    }

    // fallback: some appointments may have a single cogs/cost field
    if (a.cogs != null || a.cost != null || a.totalCost != null) {
      return parseNumber(a.cogs || a.cost || a.totalCost);
    }

    return 0;
  }, [parseNumber]);

  // build monthly profit buckets (Jan..Dec): revenue from appointments, COGS from inventory adjustments
  const monthly = React.useMemo(() => {
    const revenueBuckets = new Array(12).fill(0);
    const cogsBuckets = new Array(12).fill(0);
    if (appointments && appointments.length) {
      for (const a of appointments) {
        if (String(a.status || '').toLowerCase() !== 'completed') continue;
        let dt = null;
        try {
          const st = a.startTime || a._start || a.start || a.createdAt || null;
          if (!st) continue;
          if (st.toDate && typeof st.toDate === 'function') dt = st.toDate();
          else dt = new Date(st);
        } catch (e) { dt = null; }
        if (!dt || !isFinite(dt.getTime())) continue;
        const m = dt.getMonth();
        revenueBuckets[m] += computeAmount(a, mode);
      }
    }

    if (adjustments && adjustments.length) {
      for (const adj of adjustments) {
        try {
          const ts = adj.createdAt && adj.createdAt.toDate ? adj.createdAt.toDate() : new Date(adj.createdAt);
          if (!ts || !isFinite(ts.getTime())) continue;
          const m = ts.getMonth();
          const delta = Number(adj.delta || 0);
          if (delta >= 0) continue; // only consumption
          const prod = items ? items.find(p => p.id === adj.productId) : null;
          const cost = Number((prod && (prod.cost || prod.unitCost)) || 0);
          if (!cost) continue;
          cogsBuckets[m] += Math.abs(delta) * cost;
        } catch (e) { /* ignore malformed */ }
      }
    }

    return revenueBuckets.map((r, i) => r - (cogsBuckets[i] || 0));
  }, [appointments, adjustments, items, mode]);

  // weekly: last 7 days (today included) buckets
  const weekly = React.useMemo(() => {
    // week: Monday .. Sunday for the current week containing today
    const days = new Array(7).fill(0);
    if (!appointments || !appointments.length) return days;
    const parseAmt = (a) => {
      const parseNumber = (v) => {
        if (v == null) return 0;
        if (typeof v === 'number') return v;
        try { const s = v.toString().replace(/[^0-9.\-\.]/g, ''); const n = parseFloat(s); return Number.isFinite(n) ? n : 0; } catch { return 0; }
      };
      if (mode === 'net') {
        if (a.finalPrice != null) return parseNumber(a.finalPrice);
        if (a.price != null) return parseNumber(a.price);
      } else {
        if (a.price != null) return parseNumber(a.price);
        if (a.finalPrice != null) return parseNumber(a.finalPrice);
      }
      if (a.amount != null) return parseNumber(a.amount);
      if (Array.isArray(a.services) && a.services.length) return a.services.reduce((s,x) => s + parseNumber(x.price || x.amount || x.cost || x.total || 0), 0);
      return 0;
    };
    // find Monday of current week (treat Monday as first day)
    const today = new Date();
    const dayIdx = (today.getDay() + 6) % 7; // Monday=0 .. Sunday=6
    const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dayIdx);
    const zeroDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());

    // build array of dates for Monday..Sunday
    const weekDates = Array.from({ length: 7 }).map((_, i) => {
      const dd = new Date(monday);
      dd.setDate(monday.getDate() + i);
      return zeroDay(dd);
    });

    if (appointments && appointments.length) {
      for (const a of appointments) {
        if (String(a.status || '').toLowerCase() !== 'completed') continue;
        let dt = null;
        try {
          const st = a.startTime || a._start || a.start || a.createdAt || null;
          if (!st) continue;
          if (st.toDate && typeof st.toDate === 'function') dt = st.toDate();
          else dt = new Date(st);
        } catch (e) { dt = null; }
        if (!dt || !isFinite(dt.getTime())) continue;
        const zd = zeroDay(dt).getTime();
        // find matching day index in weekDates
        for (let i = 0; i < 7; i++) {
          if (weekDates[i].getTime() === zd) {
            days[i] += computeAmount(a, mode);
            break;
          }
        }
      }
    }

    // subtract COGS from adjustments for each day
    if (adjustments && adjustments.length) {
      for (const adj of adjustments) {
        try {
          const ts = adj.createdAt && adj.createdAt.toDate ? adj.createdAt.toDate() : new Date(adj.createdAt);
          if (!ts || !isFinite(ts.getTime())) continue;
          const zd = zeroDay(ts).getTime();
          for (let i = 0; i < 7; i++) {
            if (weekDates[i].getTime() === zd) {
              const delta = Number(adj.delta || 0);
              if (delta >= 0) break; // only consumption
              const prod = items ? items.find(p => p.id === adj.productId) : null;
              const cost = Number((prod && (prod.cost || prod.unitCost)) || 0);
              if (!cost) break;
              days[i] -= Math.abs(delta) * cost;
              break;
            }
          }
        } catch (e) { /* ignore malformed */ }
      }
    }
    return days;
  }, [appointments, adjustments, items, mode]);

  // low-stock detection: find products with any branch qty <= threshold
  const lowThreshold = 5;
  const lowItems = React.useMemo(() => {
    if (!items || !items.length) return [];
    const out = [];
    for (const p of items) {
      const pid = p.id;
      const per = inventoryMap && inventoryMap[pid] ? inventoryMap[pid] : {};
      for (const [branchKey, data] of Object.entries(per || {})) {
        const qty = Number((data && data.quantity) || 0);
        if (qty <= lowThreshold) out.push({ product: p.name || p.title || pid, branch: branchKey, qty });
      }
    }
    return out.slice(0, 8);
  }, [items, inventoryMap]);

  // derive stylists list with booked/free flag for today
  const stylistsForDisplay = React.useMemo(() => {
    try {
      const isSameDay = (d1, d2) => d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
      const today = new Date();
      const fromAppointments = Array.isArray(appointments) ? appointments : [];

      const activeBranch = (branchFilter && branchFilter.trim() !== '') ? String(branchFilter).trim().toLowerCase() : '';
      return (stylists || []).filter(s => {
        if (!activeBranch) return true; // show all when selector = All
        const b1 = (s.branchName || s.branch || '').toString().toLowerCase();
        return b1.includes(activeBranch);
      }).slice(0, 10).map(s => {
        // count today's appointments for this stylist
        let count = 0;
        for (const a of fromAppointments) {
          const st = a.startTime || a._start || a.start || null;
          let dt = null;
          try {
            if (!st) continue;
            if (st.toDate && typeof st.toDate === 'function') dt = st.toDate();
            else dt = new Date(st);
          } catch (e) { continue; }
          if (!dt || !isFinite(dt.getTime())) continue;
          if (!isSameDay(dt, today)) continue;
          const stylistId = (a.stylistId || a.stylist || a.stylist_name || a.provider || '').toString();
          const sidMatch = stylistId && (String(s.id) === String(stylistId) || String(s.uid) === String(stylistId));
          const nameMatch = (String(s.name || s.displayName || s.fullName || '')).toLowerCase() === (String(a.stylistName || a.stylist || a.provider || '')).toLowerCase();
          if (sidMatch || nameMatch) count++;
        }
        return { ...s, bookedTodayCount: count };
      });
    } catch (e) { return []; }
  }, [stylists, appointments, branchFilter]);

  

  // simple SVG sparkline for monthly
  // unified chart data depending on period
  const chartData = React.useMemo(() => {
    const w = 560, h = 160, pad = 12;
    const vals = period === 'monthly' ? monthly : weekly;
    const max = Math.max(1, ...vals);
    const step = vals.length > 1 ? (w - pad * 2) / (vals.length - 1) : (w - pad * 2);
    const pointsArr = vals.map((v,i) => {
      const x = pad + i * step;
      const y = pad + (1 - (v / max)) * (h - pad * 2);
      let label = '';
      if (period === 'monthly') {
        const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        label = monthNames[i] || `M${i+1}`;
      } else {
        const dayNames = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
        label = dayNames[i] || `D${i+1}`;
      }
      return { x, y, v, label };
    });
    return { w, h, pad, pointsArr, vals };
  }, [monthly, weekly, period]);

  const css = `
    .dashboard-summary{display:flex;gap:12px;margin-top:16px;align-items:flex-start}
    .dashboard-summary .summary-left{flex:1}
    .dashboard-summary .calendar-row{display:flex;gap:12px}
    .hh-calendar{width:240px;border:1px solid var(--border-main);border-radius:8px;padding:8px;background:var(--bg-drawer);box-sizing:border-box}
    .hh-calendar .cal-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
    .hh-calendar .cal-grid{display:grid;grid-template-columns:repeat(7,28px);gap:4px;justify-content:center}
    .hh-calendar .cal-cell{width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:4px;cursor:pointer;font-size:12px}
    .hh-calendar .cal-cell:hover{background:rgba(255,255,255,0.03)}
    .hh-calendar .cal-cell.selected{background:var(--icon-main);color:#fff;font-weight:700}
    .hh-calendar .cal-cell.today{outline:1px solid var(--icon-main)}
    .hh-calendar .cal-weekdays{display:grid;grid-template-columns:repeat(7,28px);gap:4px;justify-content:center;margin-bottom:4px;font-size:10px;color:var(--text-secondary);text-align:center}
    .dashboard-summary .summary-right{width:320px}
    @media (max-width:720px){
      .dashboard-summary{flex-direction:column}
      /* slightly reduce the left chart width so it doesn't cause horizontal overflow on small screens */
      .dashboard-summary .summary-left{width:calc(95% - 12px)}
      /* stack calendar and appointments vertically on small screens */
      .dashboard-summary .calendar-row{flex-direction:column}
      .dashboard-summary .calendar-row .hh-calendar{flex:0 0 auto;width:100%}
      .dashboard-summary .calendar-row > div{width:100%}
      /* make the right column split into two cards side-by-side on narrow phones */
      .dashboard-summary .summary-right{width:100%;margin-top:8px;display:flex;flex-direction:row;gap:8px;align-items:flex-start}
      .dashboard-summary .summary-right > div{flex:1;min-width:0}
      /* hide quieter 'No alerts' label on narrow screens to save space */
      .dashboard-summary .summary-right .no-alerts-text{display:none}
      /* hide the period buttons on mobile and show branch select under the title */
      
      .dashboard-summary .summary-left svg{width:100%;height:auto}
    }
  `;

  return (
    <div className="dashboard-summary">
      <style>{css}</style>
      <div className="summary-left" style={{ background: 'var(--bg-drawer)', border: '1px solid var(--border-main)', borderRadius: 8, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ fontWeight: 700 }}>Recent Sales</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>({period === 'monthly' ? 'Monthly' : 'Weekly'})</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setPeriod(p => p === 'monthly' ? 'weekly' : 'monthly')} style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'transparent', border: '1px solid var(--border-main)', padding: '4px 8px', borderRadius: 6, cursor: 'pointer' }}>{period === 'monthly' ? 'Monthly' : 'Weekly'}</button>
                <button onClick={() => setMode(m => m === 'net' ? 'gross' : 'net')} style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'transparent', border: '1px solid var(--border-main)', padding: '4px 8px', borderRadius: 6, cursor: 'pointer' }}>{mode === 'net' ? 'Net' : 'Gross'}</button>
              </div>
            </div>
        <div ref={chartRef} style={{ position: 'relative' }}>
        <svg width="100%" viewBox={`0 0 ${chartData.w} ${chartData.h}`} preserveAspectRatio="none" style={{ width: '100%', height: 160 }}>
          <defs>
            <linearGradient id="g1" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(128,80,255,0.18)" />
              <stop offset="100%" stopColor="rgba(128,80,255,0.02)" />
            </linearGradient>
          </defs>
          {/* grid lines */}
          {period === 'weekly' && chartData.pointsArr.map((p, i) => (
            <line key={`g-${i}`} x1={p.x} x2={p.x} y1={6} y2={chartData.h - 6} stroke="rgba(255,255,255,0.04)" />
          ))}
          {period === 'monthly' && [0.25,0.5,0.75].map((f, i) => (
            <line key={`gm-${i}`} x1={chartData.pad + f*(chartData.w - chartData.pad*2)} x2={chartData.pad + f*(chartData.w - chartData.pad*2)} y1={6} y2={chartData.h - 6} stroke="rgba(255,255,255,0.04)" />
          ))}

          <polyline points={chartData.pointsArr.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke="#b085ff" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          <polygon points={`${chartData.pointsArr.map(p=>`${p.x},${p.y}`).join(' ')} ${chartData.w - 12},${chartData.h - 12} 12,${chartData.h - 12}`} fill="url(#g1)" opacity={0.9} />

          {/* interactive points */}
          {chartData.pointsArr.map((p, i) => (
            <g key={`pt-${i}`}>
              <circle cx={p.x} cy={p.y} r={4} fill="#b085ff" stroke="#fff" strokeWidth={0.6}
                onMouseEnter={(e) => {
                  const rect = chartRef.current?.getBoundingClientRect();
                  const left = rect ? rect.left + (p.x / chartData.w) * rect.width : p.x;
                  const top = rect ? rect.top + (p.y / chartData.h) * rect.height : p.y;
                  setTooltip({ visible: true, x: left, y: top, label: p.label, value: p.v });
                }}
                onMouseLeave={() => setTooltip(t => ({ ...t, visible: false }))}
                onClick={() => {
                  // toggle on mobile
                  setTooltip(t => t.visible ? { ...t, visible: false } : ({ visible: true, x: 0, y: 0, label: p.label, value: p.v }));
                }}
              />
            </g>
          ))}
        </svg>
        {tooltip.visible && (
          <div style={{ position: 'absolute', left: Math.max(8, tooltip.x - (chartRef.current?.getBoundingClientRect().left || 0) - 40), top: Math.max(8, tooltip.y - (chartRef.current?.getBoundingClientRect().top || 0) - 56), background: 'var(--bg-main)', color: 'var(--text-main)', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border-main)', pointerEvents: 'none' }}>
            <div style={{ fontSize: 12, fontWeight: 700 }}>{tooltip.label}</div>
            <div style={{ fontSize: 12 }}>{formatCurrency(Number(tooltip.value || 0))}</div>
          </div>
        )}
        </div>

        
        
      </div>

      <div className="summary-right">
        {/* Stylists: show stylist roster (desktop) backed by users + appointments */}
        <div className="stylists-card" style={{ background: 'var(--bg-drawer)', border: '1px solid var(--border-main)', borderRadius: 8, padding: 12, minWidth: 260, marginTop: 0 }}>
          <style>{`@media (min-width:721px){ .stylists-card{display:block} } @media (max-width:720px){ .stylists-card{display:none} }`}</style>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ fontWeight: 700 }}>Stylists</div>
              <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} style={{ fontSize: 12, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border-main)', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer' }}>
                <option value="">All</option>
                <option value="evangelista">Evangelista</option>
                <option value="lawas">Lawas</option>
                <option value="lipa">Lipa</option>
                <option value="tanauan">Tanauan</option>
              </select>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }} aria-hidden>{/* count removed, branch filter is used */}</div>
          </div>
          <div style={{ maxHeight: 240, overflow: 'auto' }}>
            {stylistsForDisplay.length ? (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {stylistsForDisplay.map(s => (
                  <li key={s.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 6px', borderBottom: '1px dashed rgba(0,0,0,0.04)' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 18, overflow: 'hidden', background: 'rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {s.photoURL || s.imageUrl || s.image ? (
                        <img src={s.photoURL || s.imageUrl || s.image} alt="a" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--text-secondary)' }}>{(s.name || (s.displayName||'')).slice(0,1).toUpperCase()}</div>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name || s.displayName || s.fullName || 'Stylist'}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s.branchName || s.branch || ''}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 6, background: (s.bookedTodayCount > 0 ? '#d32f2f' : '#4caf50'), boxShadow: '0 0 0 4px rgba(0,0,0,0.03)' }} aria-hidden="true" />
                      <div style={{ fontSize: 12, padding: '4px 8px', borderRadius: 12, background: (s.bookedTodayCount > 0 ? 'rgba(211,47,47,0.08)' : 'rgba(76,175,80,0.06)'), color: (s.bookedTodayCount > 0 ? '#d32f2f' : '#4caf50'), fontWeight: 700 }} title={s.bookedTodayCount > 0 ? `${s.bookedTodayCount} booked today` : 'Free'}>
                        {s.bookedTodayCount > 0 ? `Booked (${s.bookedTodayCount})` : 'Free'}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div style={{ color: 'var(--text-secondary)' }}>No stylists found</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


// A measured container that appears under Recent Sales and matches its left offset and width.
function SummaryAlignedBox() {
  const [box, setBox] = React.useState({ left: null, width: null });
  const { appointments } = useAppointments();
  const navigate = useNavigate();
  const [visibleMonth, setVisibleMonth] = React.useState(() => {
    const d = new Date(); d.setDate(1); return d;
  });
  const [selectedDate, setSelectedDate] = React.useState(() => new Date());

  React.useEffect(() => {
    const cardSelector = '.dashboard-summary .summary-left';
    const mainSelector = '.admin-main-content.container';

    const measure = () => {
      try {
        const card = document.querySelector(cardSelector);
        const main = document.querySelector(mainSelector);
        if (!card || !main) {
          setBox({ left: null, width: null });
          return;
        }

        const doMeasure = () => {
          try {
            const cardRect = card.getBoundingClientRect();
            const mainRect = main.getBoundingClientRect();
            // Align flush to the outer card border (no left gap). Use the card rect rather than inner svg.
            const targetRect = cardRect;

            let left = Math.round(targetRect.left - mainRect.left);
            let width = Math.round(targetRect.width);

            // small nudge to reduce the visible left gap; adjust this value if needed
            const LEFT_NUDGE = 30; // px (increased to move the box further left)
            left = Math.max(0, left - LEFT_NUDGE);

            if (left < 0) left = 0;
            const maxAllowed = Math.round(mainRect.width - 8);
            if (width > maxAllowed) width = maxAllowed;
            if (left + width > maxAllowed) width = Math.max(0, maxAllowed - left);

            setBox({ left, width });
          } catch (e) { /* ignore measurement errors */ }
        };

        // run measurement on next frame and shortly after (catch fonts/svg updates)
        const raf = window.requestAnimationFrame(doMeasure);
        const t = setTimeout(doMeasure, 160);

        // observe size changes of the card (handles responsive and svg redraws)
        let ro = null;
        try {
          ro = new ResizeObserver(() => doMeasure());
          ro.observe(card);
          ro.observe(document.querySelector(mainSelector));
        } catch (e) { ro = null; }

        // mutation observer as a fallback for svg point additions
        let mo = null;
        try {
          mo = new MutationObserver(() => doMeasure());
          mo.observe(card, { childList: true, subtree: true, attributes: true });
        } catch (e) { mo = null; }

        const onResize = () => doMeasure();
        window.addEventListener('resize', onResize);

        return () => {
          try { window.cancelAnimationFrame(raf); } catch (e) {}
          try { clearTimeout(t); } catch (e) {}
          try { window.removeEventListener('resize', onResize); } catch (e) {}
          try { if (ro) ro.disconnect(); } catch (e) {}
          try { if (mo) mo.disconnect(); } catch (e) {}
        };
      } catch (e) {
        setBox({ left: null, width: null });
      }
    };

    // initial measure and set up
    const cleanup = measure();
    return () => { if (cleanup && typeof cleanup === 'function') cleanup(); };
  }, []);

  const styleOuter = box.width != null ? { width: box.width, marginLeft: box.left, boxSizing: 'border-box' } : { width: '100%' };

  // helpers for calendar
  const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
  const daysInMonth = (y, m) => new Date(y, m+1, 0).getDate();
  const isSameDay = (d1, d2) => d1 && d2 && d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();

  const buildMonthGrid = (d) => {
    const year = d.getFullYear();
    const month = d.getMonth();
    const first = startOfMonth(d);
    const firstWeekday = first.getDay(); // 0=Sun..6
    const totalDays = daysInMonth(year, month);
    const out = [];
    // show 6 rows of 7 to keep layout stable
    const cells = 42;
    // start date for grid (may be previous month)
    const gridStart = new Date(year, month, 1 - firstWeekday);
    for (let i = 0; i < cells; i++) {
      const cur = new Date(gridStart);
      cur.setDate(gridStart.getDate() + i);
      out.push({ date: cur, inMonth: cur.getMonth() === month });
    }
    return out;
  };

  const parseAppointmentDate = (a) => {
    try {
      const st = a.startTime || a._start || a.start || a.createdAt || null;
      if (!st) return null;
      if (st.toDate && typeof st.toDate === 'function') return st.toDate();
      if (st instanceof Date) return st;
      return new Date(st);
    } catch (e) { return null; }
  };

  const appointmentsForDate = React.useMemo(() => {
    if (!appointments || !appointments.length) return [];
    return appointments.filter(a => {
      const dt = parseAppointmentDate(a);
      return dt && isSameDay(dt, selectedDate);
    }).sort((a,b) => {
      const da = parseAppointmentDate(a) || new Date(0);
      const db = parseAppointmentDate(b) || new Date(0);
      return da - db;
    });
  }, [appointments, selectedDate]);

  const monthGrid = buildMonthGrid(visibleMonth);

  const getCustomerName = (a) => {
    if (!a) return 'Unknown';

    const tryValue = (v) => {
      if (!v) return null;
      if (typeof v === 'string' && v.trim() !== '') return v.trim();
      if (typeof v === 'object') {
        if (v.name) return String(v.name).trim();
        if (v.displayName) return String(v.displayName).trim();
        if (v.fullName) return String(v.fullName).trim();
        const first = v.firstName || v.givenName || v.fname || '';
        const last = v.lastName || v.familyName || v.lname || '';
        if (first || last) return (String(first) + ' ' + String(last)).trim();
      }
      return null;
    };

    // check obvious fields first
    const common = ['customerName','clientName','client','name','fullName','displayName','customer','user','owner','customerInfo','contact'];
    for (const k of common) {
      if (k in a) {
        const v = tryValue(a[k]);
        if (v) return v;
      }
    }

    // scan top-level string fields and nested objects for plausible name-like values
    const candidates = [];
    for (const k of Object.keys(a)) {
      const v = a[k];
      if (typeof v === 'string' && v.trim().length > 1) candidates.push(v.trim());
      if (typeof v === 'object' && v) {
        for (const kk of Object.keys(v)) {
          const vv = v[kk];
          if (typeof vv === 'string' && vv.trim().length > 1) candidates.push(vv.trim());
        }
      }
    }

    // filter out emails, phone numbers
    const isNameLike = s => /^[A-Za-z][A-Za-z'\-\.]+(\s+[A-Za-z'\-\.]+)+$/.test(s);
    for (const c of candidates) {
      if (isNameLike(c)) return c;
    }

    // if nothing name-like, return first non-empty candidate
    if (candidates.length) return candidates[0];

    return 'Unknown';
  };

  return (
    <div className="summary-aligned" style={{ marginTop: 12, ...styleOuter }}>
      <style>{`@media (max-width:720px){ .summary-aligned .calendar-row{flex-direction:column} .summary-aligned .calendar-row .hh-calendar{flex:0 0 auto;width:100%} .summary-aligned .calendar-row > div{width:100%} }`}</style>
      <div style={{ background: 'var(--bg-drawer)', border: '1px solid var(--border-main)', borderRadius: 8, minHeight: 120, transition: 'width 200ms ease, margin-left 200ms ease', padding: 12, boxSizing: 'border-box' }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Appointments</div>
        <div className="calendar-row" style={{ display: 'flex', gap: 12 }}>
          {/* Calendar column */}
          <div className="hh-calendar" style={{ flex: '0 0 240px' }}>
            <div className="cal-header">
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button onClick={() => setVisibleMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border-main)', background: 'transparent', cursor: 'pointer' }}>{'<'}</button>
                <div style={{ fontWeight: 700 }}>{visibleMonth.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</div>
                <button onClick={() => setVisibleMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border-main)', background: 'transparent', cursor: 'pointer' }}>{'>'}</button>
              </div>
            </div>
            <div className="cal-weekdays" style={{ marginBottom: 6 }}>
              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((wd, i) => (
                <div key={i} style={{ textAlign: 'center' }}>{wd}</div>
              ))}
            </div>
            <div className="cal-grid" style={{ marginBottom: 6 }}>
              {monthGrid.map((cell, i) => {
                const today = new Date();
                const cls = ['cal-cell'];
                if (isSameDay(cell.date, selectedDate)) cls.push('selected');
                if (isSameDay(cell.date, today)) cls.push('today');
                if (!cell.inMonth) {
                  return <div key={i} className={cls.join(' ')} style={{ opacity: 0.35 }}>{cell.date.getDate()}</div>;
                }
                return (
                  <div key={i} className={cls.join(' ')} onClick={() => setSelectedDate(new Date(cell.date))} style={{ cursor: 'pointer' }}>{cell.date.getDate()}</div>
                );
              })}
            </div>
          </div>

          {/* Appointments column */}
          <div style={{ flex: 1, minHeight: 120, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Appointments — {selectedDate.toLocaleDateString()}</div>
            <div style={{ overflow: 'auto', maxHeight: 240 }}>
              {appointmentsForDate.length ? (
                <>
                <ol style={{ margin: 0, paddingLeft: 16 }}>
                  {appointmentsForDate.slice(0,3).map((a, i) => {
                      const dt = parseAppointmentDate(a);
                      const timeStr = dt && isFinite(dt.getTime()) ? dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                      const customer = getCustomerName(a);
                      const service = Array.isArray(a.services) && a.services.length ? (a.services.map(s => s.name || s.title).join(', ')) : (a.service || a.title || 'Service');
                      const stylist = (a.stylistName || a.stylist || a.provider || a.therapist || a.stylist_name || a.stylistId || '').toString() || 'Unassigned';
                      const status = (a.status || a.state || 'unknown').toString();
                      const statusKey = status.toLowerCase();
                      const statusColor = statusKey.includes('complete') || statusKey.includes('done') ? '#4caf50' : statusKey.includes('cancel') || statusKey.includes('void') ? '#d32f2f' : statusKey.includes('pending') || statusKey.includes('sched') || statusKey.includes('book') ? '#ffb74d' : '#9e9e9e';

                      return (
                        <li key={i} style={{ marginBottom: 8, padding: '8px', background: 'rgba(0,0,0,0.02)', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                            <div style={{ width: 10, height: 10, borderRadius: 10, background: statusColor, boxShadow: '0 0 0 2px rgba(0,0,0,0.06)' }} />
                            <div>
                              <div style={{ fontWeight: 700 }}>{customer}</div>
                              <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', gap: 8, alignItems: 'center' }}>
                                <span>{service}</span>
                                <span style={{ opacity: 0.7 }}>•</span>
                                <span>{stylist}</span>
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                            <div style={{ fontWeight: 700 }}>{timeStr}</div>
                            <div style={{ marginTop: 6, fontSize: 11, padding: '4px 6px', borderRadius: 6, background: 'rgba(0,0,0,0.03)', color: 'var(--text-secondary)' }}>{formatStatus(status)}</div>
                          </div>
                        </li>
                      );
                      })}
                  </ol>

                  {appointmentsForDate.length > 3 && (
                    <div style={{ marginTop: 8, display: 'flex', justifyContent: 'center' }}>
                      <button onClick={() => navigate(`/appointments?date=${selectedDate.toISOString().slice(0,10)}`)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-main)', background: 'transparent', cursor: 'pointer' }}>
                        See {appointmentsForDate.length - 3} more
                      </button>
                    </div>
                  )}
                  </>
              ) : (
                <div style={{ color: 'var(--text-secondary)' }}>No appointments for this date</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}



