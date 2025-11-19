import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import useAppointments from '../../../hooks/useAppointments';
import { AuthContext } from '../../../context/AuthContext';
import { formatCurrency } from '../../../utils/formatters';
import { collection, onSnapshot, query as q, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase';
import { adjustBranchQty, adjustInventoryRecord } from '../../../utils/inventoryActions';

// Small, dependency-free calendar helpers
const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1);
const isSameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

function buildMonthMatrix(baseDate) {
  const start = startOfMonth(baseDate);
  const matrix = [];
  const firstDayIdx = start.getDay();
  let cur = new Date(start);
  cur.setDate(cur.getDate() - firstDayIdx);
  for (let week = 0; week < 6; week++) {
    const row = [];
    for (let i = 0; i < 7; i++) {
      row.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    matrix.push(row);
  }
  return matrix;
}

const StylistAppointmentPage = () => {
  const { appointments, updateAppointment, createAppointment } = useAppointments();
  const { user } = useContext(AuthContext);

  const myAppointments = useMemo(() => {
    if (!appointments || !user) return [];
    return appointments
      .filter(a => !a.stylistId || String(a.stylistId) === String(user.uid) || a.stylistId === user.uid)
      .map(a => ({ ...a, _start: a.startTime && a.startTime.toDate ? a.startTime.toDate() : (a.startTime ? new Date(a.startTime) : null) }))
      .sort((a,b) => (a._start ? a._start.getTime() : 0) - (b._start ? b._start.getTime() : 0));
  }, [appointments, user]);

  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(null);
  const [showDateModal, setShowDateModal] = useState(false);
  const [showWalkinModal, setShowWalkinModal] = useState(false);
  const [walkinForm, setWalkinForm] = useState({ customerName: '', serviceId: '' });
  const [stylistBranch, setStylistBranch] = useState('');
  const [creatingWalkin, setCreatingWalkin] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState({});
  const [services, setServices] = useState([]);

  const monthMatrix = useMemo(() => buildMonthMatrix(currentMonth), [currentMonth]);

  const appointmentsForDate = useMemo(() => {
    if (!selectedDate) return [];
    return myAppointments.filter(a => a._start && isSameDay(a._start, selectedDate));
  }, [myAppointments, selectedDate]);

  const openDate = (date) => {
    setSelectedDate(date);
    setShowDateModal(true);
  };

  useEffect(() => {
    const col = collection(db, 'services');
    const pq = q(col, orderBy('name'));
    const unsub = onSnapshot(pq, snap => {
      const arr = [];
      snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
      setServices(arr);
    }, err => { console.warn('services listener', err); setServices([]); });
    return () => unsub();
  }, []);

  // Track processed appointments to avoid duplicating updates in one session
  const processedAutoComplete = useRef(new Set());
  const processedRevenue = useRef(new Set());

  // Helper: find matching service doc for an appointment
  const resolveServiceForAppointment = (a) => {
    if (!a) return null;
    const sid = a.serviceId || a.serviceID || a.service_id || null;
    if (sid) {
      const byId = services.find(s => String(s.id) === String(sid));
      if (byId) return byId;
    }
    if (Array.isArray(a.services) && a.services.length) {
      for (const s of a.services) {
        const found = services.find(x => String(x.id) === String(s.id || s.serviceId));
        if (found) return found;
      }
      // fallback match by name
      for (const s of a.services) {
        const foundByName = services.find(x => String(x.name || x.title || '').toLowerCase() === String(s.name || s.title || '').toLowerCase());
        if (foundByName) return foundByName;
      }
    }
    if (a.service) {
      const byName = services.find(s => String(s.name || s.title || '').toLowerCase() === String(a.service).toLowerCase());
      if (byName) return byName;
    }
    return null;
  };

  // Helper: extract products used from a service doc
  const extractProductsUsed = (svc) => {
    if (!svc) return [];
    const list = svc.productsUsed || svc.products || svc.materials || [];
    const out = [];
    (Array.isArray(list) ? list : []).forEach(it => {
      const productId = it.productId || it.id || it.product || it.productID;
      const qty = Number(it.qty ?? it.quantity ?? it.units ?? 0);
      if (productId && qty) out.push({ productId, qty });
    });
    return out;
  };

  // Deduct inventory for an appointment based on its service definition
  const deductProductsForAppointment = async (a, svc) => {
    try {
      const branchKey = a.branch || a.branchName || a.location || '';
      if (!branchKey) return false;
      const lines = extractProductsUsed(svc);
      if (!lines.length) return false;
      for (const line of lines) {
        try {
          await adjustBranchQty(db, line.productId, branchKey, -Math.abs(line.qty), user || null, `Appointment ${a.id} completed`);
        } catch (err1) {
          try {
            await adjustInventoryRecord(db, line.productId, branchKey, -Math.abs(line.qty), user || null, `Appointment ${a.id} completed`);
          } catch (err2) {
            console.warn('Inventory adjust failed for product', line.productId, err2);
          }
        }
      }
      // NOTE: automatic inventory deduction for services was removed.
      // Keep this helper available for manual/explicit deductions if needed.
      return true;
    } catch (e) {
      console.warn('deductProductsForAppointment error', e);
      return false;
    }
  };

  // Ensure revenue and inventory deduction when an appointment becomes completed
  const ensureRevenueAndDeduct = async (a) => {
    const svc = resolveServiceForAppointment(a);
    // Revenue
    if (!a.revenueRecorded) {
      try {
        // compute total and deposit (reservation) if present on the appointment
        const totalPrice = Number(a.price || (svc && svc.price) || 0) || 0;
        const deposit = Number(a.reservationPaidAmount || a.reservationFee || 0) || 0;

        // for auto flows, charge the remaining balance (total - deposit)
        const amountToRecord = Math.max(0, totalPrice - deposit);
        if (!Number.isNaN(amountToRecord) && amountToRecord > 0) {
          await addDoc(collection(db, 'payments'), {
            appointmentId: a.id,
            serviceName: a.service || (svc ? svc.name : null) || null,
            amount: amountToRecord,
            branch: a.branch || a.branchName || null,
            createdBy: user ? (user.uid || null) : null,
            createdAt: serverTimestamp(),
            source: a.isWalkIn ? 'walkin' : 'auto'
          });
        }
        // store finalPrice as the total service price for audit (deposit + collected = total)
        try { await updateAppointment(a.id, { revenueRecorded: true, finalPrice: totalPrice }, a); } catch (e) {}
      } catch (e) {
        console.warn('payments write failed', e);
      }
    }
    // Inventory deduction
    // Inventory deduction intentionally omitted for services.
    // Use manual/product flows to adjust inventory when necessary.
  };

  // Auto-complete past appointments and trigger side-effects for completed ones
  useEffect(() => {
    if (!myAppointments || !myAppointments.length) return;
    const now = Date.now();
    myAppointments.forEach((a) => {
      const id = a.id;
      const startMs = a._start ? a._start.getTime() : (a.startTime && a.startTime.toDate ? a.startTime.toDate().getTime() : null);
      const status = String(a.status || '').toLowerCase();

      // If past and not completed/cancelled, auto-mark completed (once per session)
      if (startMs && startMs < now && status !== 'completed' && status !== 'cancelled' && !processedAutoComplete.current.has(id)) {
        processedAutoComplete.current.add(id);
        (async () => {
          try {
            await updateAppointment(id, { status: 'completed' }, a);
          } catch (e) {
            console.warn('auto-complete update failed', e);
          }
          // After status change, ensure revenue/deduction
          try { await ensureRevenueAndDeduct({ ...a, status: 'completed' }); } catch (_) {}
        })();
        return; // skip next checks in this iteration
      }

      // If already completed, ensure revenue (once per session)
      if (status === 'completed') {
        if (!processedRevenue.current.has(id)) {
          processedRevenue.current.add(id);
          (async () => { try { await ensureRevenueAndDeduct(a); } catch (_) {} })();
        }
      }
    });
  }, [myAppointments, services, user]);

  // Load stylist profile to determine branch automatically for walk-ins
  useEffect(() => {
    if (!user?.uid) return;
    try {
      const unsub = onSnapshot(collection(db, 'users'), (snap) => {
        const doc = snap.docs.find(d => d.id === user.uid);
        if (doc) {
          const d = doc.data();
          setStylistBranch(d.branchName || d.branch || '');
        }
      }, (err) => { console.warn('stylist profile listener', err); });
      return () => unsub();
    } catch (e) { console.warn('stylist profile fetch failed', e); }
  }, [user && user.uid]);

  return (
    <div style={{ padding: 12, height: 'calc(100vh - 96px)', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0, color: '#fff' }}>Calendar</h2>
        <div>
          <button onClick={() => setShowWalkinModal(true)} style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border-main)', background: 'var(--gold, #f6c85f)', cursor: 'pointer' }}>New Walk-in</button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
  <div style={{ width: '97%', maxWidth: 540, margin: '0 auto', background: 'var(--bg-drawer)', border: '1px solid var(--border-main)', borderRadius: 6, padding: 8, display: 'flex', flexDirection: 'column', height: '90%', color: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{currentMonth.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => { setCurrentMonth(m => addMonths(m, -1)); setSelectedDate(null); }} style={{ padding: '3px 5px', borderRadius: 5, border: '1px solid var(--border-main)', background: 'none', cursor: 'pointer', color: '#fff', fontSize: 11 }}>{'‹'}</button>
              <button onClick={() => { setCurrentMonth(startOfMonth(new Date())); setSelectedDate(null); }} style={{ padding: '3px 5px', borderRadius: 5, border: '1px solid var(--border-main)', background: 'none', cursor: 'pointer', color: '#fff', fontSize: 11 }}>Today</button>
              <button onClick={() => { setCurrentMonth(m => addMonths(m, 1)); setSelectedDate(null); }} style={{ padding: '3px 5px', borderRadius: 5, border: '1px solid var(--border-main)', background: 'none', cursor: 'pointer', color: '#fff', fontSize: 11 }}>{'›'}</button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, textAlign: 'center', marginBottom: 3 }}>
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
              <div key={d} style={{ fontSize: 10, color: '#fff', fontWeight: 700 }}>{d}</div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridTemplateRows: 'repeat(6, 1fr)', gap: 3, flex: 1, height: '100%' }}>
            {monthMatrix.map((week, wi) => week.map((day, di) => {
              const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
              const isSelected = selectedDate && isSameDay(day, selectedDate);
              const hasAppts = myAppointments.some(a => a._start && isSameDay(a._start, day));
              return (
                <button key={`${wi}-${di}`} onClick={() => openDate(new Date(day))} style={{
                  padding: 5,
                  borderRadius: 5,
                  background: isSelected ? 'var(--text-main)' : 'transparent',
                  color: isSelected ? 'white' : '#fff',
                  border: 'none',
                  cursor: 'pointer',
                  position: 'relative',
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700 }}>{day.getDate()}</div>
                  {hasAppts && <div style={{ position: 'absolute', left: 6, bottom: 5, width: 5, height: 5, borderRadius: 5, background: 'var(--gold, #f6c85f)' }} />}
                </button>
              );
            }))}
          </div>
        </div>

        {/* Date modal */}
        {showDateModal && selectedDate && (
          <div style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, zIndex: 2100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)' }}>
            <div style={{ width: 820, maxWidth: '98%', maxHeight: '90vh', overflow: 'auto', background: 'var(--bg-main)', border: '1px solid var(--border-main)', borderRadius: 8, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontWeight: 800 }}>{selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ color: 'var(--icon-main)', fontSize: 13 }}>{appointmentsForDate.length} {appointmentsForDate.length === 1 ? 'appointment' : 'appointments'}</div>
                  <button onClick={() => { setShowDateModal(false); setSelectedDate(null); }} style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border-main)', background: 'rgba(27, 26, 26, 0.35)', color: 'white', cursor: 'pointer' }}>Close</button>
                </div>
              </div>

              <div style={{ display: 'grid', gap: 8, color: 'var(--text-main)' }}>
                {appointmentsForDate.length === 0 && (
                  <div style={{ padding: 12, borderRadius: 6, border: '1px dashed var(--border-main)', color: 'var(--icon-main)' }}>No appointments for this date.</div>
                )}

                {appointmentsForDate.map(a => {
                  const statusLower = String((a.status || '').toLowerCase());
                  const isCompleted = statusLower === 'completed';
                  const isCancelled = statusLower === 'cancelled';
                  const isUpdating = Boolean(updatingStatus[a.id]);
                  const isPast = a._start ? (a._start.getTime() < Date.now()) : false;
                  return (
                    <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: 10, borderRadius: 8, background: 'var(--bg-drawer)', border: '1px solid var(--border-main)', alignItems: 'center', color: 'var(--text-main)' }}>
                      <div style={{ minWidth: 120 }}>
                        <div style={{ fontWeight: 800 }}>{a._start ? a._start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</div>
                        <div style={{ fontSize: 12, color: 'var(--icon-main)' }}>{a.branch || a.location || 'Branch'}</div>
                      </div>

                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <div style={{ fontWeight: 800 }}>{a.customerName || (a.customer && a.customer.name) || 'Client'}</div>
                          {a.isWalkIn && <div style={{ fontSize: 12, padding: '2px 6px', borderRadius: 6, background: '#e8f5e9', color: 'var(--success, #388e3c)', border: '1px solid rgba(56,142,60,0.12)' }}>Walk-in</div>}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--icon-main)' }}>{a.service || (a.services && a.services.map(s=>s.name).join(', ')) || 'Service'}</div>
                      </div>

                      <div style={{ textAlign: 'right', minWidth: 140 }}>
                        <div style={{ fontWeight: 800 }}>{a.status || 'booked'}</div>
                        {typeof a.price === 'number' && <div style={{ fontSize: 13, color: 'var(--icon-main)' }}>{formatCurrency(a.price)}</div>}
                        {!isCompleted && !isCancelled && !isPast ? (
                          <div style={{ marginTop: 8 }}>
                            <button disabled={isUpdating} onClick={async () => {
                              try {
                                setUpdatingStatus(prev => ({ ...prev, [a.id]: true }));
                                await updateAppointment(a.id, { status: 'completed' }, a);
                              } catch (err) {
                                console.error('failed to update status', err);
                              } finally {
                                setUpdatingStatus(prev => ({ ...prev, [a.id]: false }));
                              }
                            }} style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border-main)', background: 'var(--text-main)', color: 'white', cursor: 'pointer' }}>
                              {isUpdating ? 'Updating…' : 'Mark completed'}
                            </button>
                          </div>
                        ) : (
                          <div style={{ marginTop: 8, fontSize: 13, color: 'var(--icon-main)' }}>
                            {isCompleted ? 'Already completed' : isCancelled ? 'Cancelled — cannot update' : (isPast ? 'Appointment date passed — cannot update' : '')}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Walk-in modal */}
        {showWalkinModal && (
          <div style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)' }}>
            <div style={{ width: 480, maxWidth: '95%', background: 'var(--bg-main)', border: '1px solid var(--border-main)', borderRadius: 8, padding: 16, color: 'var(--text-main)' }}>
              <h3 style={{ marginTop: 0 }}>New Walk-in</h3>
              <div style={{ display: 'grid', gap: 8 }}>
                <input placeholder="Client name" value={walkinForm.customerName} onChange={e => setWalkinForm(f => ({ ...f, customerName: e.target.value }))} style={{ padding: 8, borderRadius: 6, border: '1px solid var(--border-main)', background: 'var(--bg-drawer)', color: 'var(--text-main)' }} />

                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--icon-main)' }}>Service</label>
                  <select value={walkinForm.serviceId} onChange={e => setWalkinForm(f => ({ ...f, serviceId: e.target.value }))} style={{ padding: 8, borderRadius: 6, border: '1px solid var(--border-main)', width: '100%', background: 'var(--bg-drawer)', color: 'var(--text-main)' }}>
                    <option value="">Select service</option>
                    {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                {/* Branch is inferred from stylist profile; no manual selection */}
                {stylistBranch ? (
                  <div style={{ fontSize: 12, color: 'var(--icon-main)' }}>Branch: {stylistBranch}</div>
                ) : null}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button onClick={() => { setShowWalkinModal(false); setWalkinForm({ customerName: '', serviceId: '' }); }} style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border-main)', background: 'none', color: 'var(--text-main)', cursor: 'pointer' }}>Cancel</button>
                  <button disabled={creatingWalkin} onClick={async () => {
                    if (!walkinForm.customerName || !walkinForm.serviceId) {
                      // minimal validation
                      return;
                    }
                    try {
                      setCreatingWalkin(true);
                      const svc = services.find(s => s.id === walkinForm.serviceId);
                      const payload = {
                        startTime: new Date(),
                        stylistId: user?.uid || null,
                        customerName: walkinForm.customerName,
                        service: svc ? svc.name : undefined,
                        services: svc ? [{ id: svc.id, name: svc.name }] : [],
                        branch: stylistBranch || undefined,
                        status: 'in-progress',
                        isWalkIn: true,
                      };
                      const apptId = await createAppointment(payload);

                      // record payment (revenue) if service has price
                      try {
                        if (svc && svc.price) {
                          const amount = Number(svc.price) || 0;
                            if (amount > 0) {
                            await addDoc(collection(db, 'payments'), {
                              appointmentId: apptId,
                              serviceName: svc.name,
                              amount,
                              branch: payload.branch || null,
                              createdBy: user ? (user.uid || null) : null,
                              createdAt: serverTimestamp(),
                              source: 'walkin'
                            });
                            // mark appointment as having revenue recorded and store final price
                            await updateAppointment(apptId, { revenueRecorded: true, finalPrice: amount }, payload);
                          }
                        }
                      } catch (payErr) {
                        console.warn('failed to record walkin payment', payErr);
                      }

                      // show the selected date (today) and close modal
                      const today = new Date();
                      setCurrentMonth(startOfMonth(today));
                      setSelectedDate(today);
                      setShowWalkinModal(false);
                      setWalkinForm({ customerName: '', serviceId: '' });
                    } catch (err) {
                      console.error('create walkin failed', err);
                    } finally {
                      setCreatingWalkin(false);
                    }
                  }} style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border-main)', background: 'var(--text-main)', color: 'white', cursor: 'pointer' }}>{creatingWalkin ? 'Creating…' : 'Create Walk-in'}</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StylistAppointmentPage;
