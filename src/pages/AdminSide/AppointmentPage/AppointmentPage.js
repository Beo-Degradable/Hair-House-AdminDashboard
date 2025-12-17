// Appointment management: filter by date/branch, update status, handle cancel requests,
// and perform inventory + revenue side effects on completion.
import React, { useMemo, useState, useEffect, useContext } from 'react';
import { validateForm } from '../../../utils/validators';
import useAppointments from '../../../hooks/useAppointments';
import AppointmentForm from './AppointmentForm';
import ViewAppointmentModal from './ViewAppointmentModal';
import EditAppointmentModal from './EditAppointmentModal';
import CustomerHistoryModal from './CustomerHistoryModal';
import { parseDurationToMinutes } from '../../../utils/time';
import { formatStatus } from '../../../utils/formatters';
import { collection, query as q, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase';
import { adjustBranchQty, adjustInventoryRecord } from '../../../utils/inventoryActions';
import { AuthContext } from '../../../context/AuthContext';


function safeDateToISO(d) {
  if (!d) return '';
  const date = d?.toDate ? d.toDate() : new Date(d);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default function AppointmentPage() {
  const { appointments = [], loading, error, createAppointment, updateAppointment } = useAppointments();

  

  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const { user: authUser } = useContext(AuthContext);
  const [viewing, setViewing] = useState(null);
  // New appointments are now created from the external app; local creation disabled
  const [historyOpen, setHistoryOpen] = useState(false);

  const [filterDate, setFilterDate] = useState(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [filterBranch, setFilterBranch] = useState('all');

  const branches = useMemo(() => ['Evangelista', 'Lawas', 'Lipa', 'Tanauan'], []);

  const handleEdit = (a) => { setEditing(a); setShowForm(true); };

  const handleEditSubmit = async (payload) => {
    if (!editing) return;
    try {
      await updateAppointment(editing.id, payload, editing);
  // Cancellation request -> history entry
      try {
        const newStatusRaw = String(payload.status || '').toLowerCase();
        if (newStatusRaw === 'cancel_requested') {
          await addDoc(collection(db, 'history'), {
            collection: 'appointments',
            docId: editing.id,
            action: 'cancel_request',
            before: {
              status: editing.status,
              clientName: editing.clientName || editing.client || null,
              startTime: editing.startTime || null,
            },
            after: {
              status: 'cancel_requested'
            },
            actor: authUser ? { uid: authUser.uid || authUser, name: authUser.displayName || authUser.name || null, email: authUser.email || null } : null,
            timestamp: serverTimestamp()
          });
        }
      } catch (histErr) {
        console.warn('failed to write cancel_request history', histErr);
      }
    // Inventory deductions & revenue recording on completion
      try {
        const normalize = (s) => {
          const v = String(s || '').toLowerCase();
          return v === 'done' ? 'completed' : v;
        };
        const prevStatus = normalize(editing.status || '');
        const newStatus = normalize(payload.status || editing.status || '');
        if (prevStatus !== 'completed' && newStatus === 'completed') {
            const svcName = (
              editing.serviceName || editing.service ||
              (Array.isArray(editing.services) && editing.services.length ? (editing.services[0].name || editing.services[0].serviceName || editing.services[0].title) : null) ||
              payload.serviceName || payload.service ||
              (Array.isArray(payload.services) && payload.services.length ? (payload.services[0].name || payload.services[0].serviceName || payload.services[0].title) : null)
            );
          if (svcName) {
            const svcCol = collection(db, 'services');
            const svcQuery = q(svcCol, where('name', '==', svcName));
            const snap = await getDocs(svcQuery);
            if (!snap.empty) {
              const svc = snap.docs[0].data();
              const productsUsed = svc.productsUsed || [];

              // Product deduction intentionally disabled: inventory adjustments
              // are no longer performed automatically when appointments complete.
              // (Retained code below handles revenue recording only.)

              // Create payment record once
                  if (!editing.revenueRecorded) {
                try {
                  // compute total and deposit (reservation). deposit may be stored on the appointment
                  const totalPrice = Number(editing.price || svc.price || 0) || 0;
                  const deposit = Number(editing.reservationPaidAmount || editing.reservationFee || 0) || 0;

                  // prefer explicit payment amount provided by the caller (admin modal) — treat that as the amount collected now
                  let amountToRecord;
                  let finalPrice;
                  if (typeof payload.paymentAmount === 'number' && !Number.isNaN(payload.paymentAmount)) {
                    amountToRecord = payload.paymentAmount;
                    finalPrice = Math.round((deposit + amountToRecord) * 100) / 100;
                  } else {
                    // charge the remaining balance (total - deposit)
                    amountToRecord = Math.max(0, totalPrice - deposit);
                    finalPrice = totalPrice;
                  }

                  if (!Number.isNaN(amountToRecord) && amountToRecord > 0) {
                    await addDoc(collection(db, 'payments'), {
                      appointmentId: editing.id,
                      serviceName: svcName,
                      amount: amountToRecord,
                      branch: editing.branch || null,
                      createdBy: authUser ? (authUser.uid || authUser) : null,
                      createdAt: serverTimestamp(),
                      source: 'appointment'
                    });
                  }

                  // store revenueRecorded and finalPrice (total service price or deposit+collected)
                  await updateAppointment(editing.id, { revenueRecorded: true, finalPrice }, editing);
                } catch (payErr) {
                  console.warn('failed to record payment', payErr);
                }
              }
            }
          }
        }
      } catch (adjErr) {
        console.error('inventory adjustment error', adjErr);
      }

      setEditing(null);
      setShowForm(false);
    } catch (e) {
      console.error(e);
      alert('Save failed');
    }
  };

  // Deletion of appointments removed per request: function intentionally omitted.

  const handleApproveCancel = async (a) => {
    if (!window.confirm('Approve cancel request for this appointment?')) return;
    try {
      await updateAppointment(a.id, { status: 'cancelled' }, a);
    } catch (e) {
      console.error(e);
      alert('Failed to approve cancel');
    }
  };

  const handleView = (a) => setViewing(a);

  const handleSubmit = async (maybeEventOrPayload) => {
    let payload;
    if (maybeEventOrPayload && typeof maybeEventOrPayload.preventDefault === 'function') {
      const form = maybeEventOrPayload.target;
      maybeEventOrPayload.preventDefault();
      const v = validateForm(form);
      if (!v.ok) { alert(v.message || 'Invalid input'); return; }
      const data = Object.fromEntries(new FormData(form).entries());
      payload = {
        clientName: data.clientName,
        serviceName: data.serviceName,
        stylistName: data.stylistName,
        branch: data.branch,
        startTime: new Date(data.startTime),
        status: data.status || 'booked',
      };
    } else {
      payload = maybeEventOrPayload || {};
    }

    try {
      if (editing) {
        await updateAppointment(editing.id, payload, editing);
        setEditing(null);
      } else {
        await createAppointment(payload);
      }
      setShowForm(false);
    } catch (e) {
      console.error(e);
      alert('Save failed');
    }
  };

  const filtered = useMemo(() => {
    return (appointments || []).filter((a) => {
      if (filterDate) {
        const ds = safeDateToISO(a.startTime);
        if (ds !== filterDate) return false;
      }
      if (filterBranch && filterBranch !== 'all') {
        if ((a.branch || '') !== filterBranch) return false;
      }
      return true;
    });
  }, [appointments, filterDate, filterBranch]);

  const AppointmentRow = ({ a }) => (
    <tr key={a.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
      <td style={{ padding: 8 }}>{formatAppointmentRange(a)}</td>
      <td style={{ padding: 8 }}>{a.clientName}</td>
      <td style={{ padding: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.email || a.clientEmail || ''}>{a.email || a.clientEmail || ''}</td>
      <td style={{ padding: 8 }}>{
        a.serviceName || a.service || (Array.isArray(a.services) && a.services.length ? a.services.map(s => s.name || s.serviceName || s.title || '').filter(Boolean).join(', ') : '')
      }</td>
      <td style={{ padding: 8 }}>{a.stylistName}</td>
      <td style={{ padding: 8 }}>{a.branch}</td>
  <td style={{ padding: 8, textTransform: 'capitalize' }}>{formatStatus(String(a.status || '').toLowerCase() === 'done' ? 'completed' : a.status)}</td>
      <td style={{ padding: 8 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn" onClick={() => handleView(a)}>View</button>
          <button className="btn btn-ghost" onClick={() => handleEdit(a)}>Edit</button>
          {/* Delete action removed */}
          {a.status === 'cancel_requested' && (
            <button className="btn btn-warning" onClick={() => handleApproveCancel(a)}>Approve Cancel</button>
          )}
        </div>
      </td>
    </tr>
  );

  function formatAppointmentRange(a) {
    const s = a.startTime?.toDate ? a.startTime.toDate() : new Date(a.startTime);
    let e = a.endTime?.toDate ? a.endTime.toDate() : (a.endTime ? new Date(a.endTime) : null);
    if (!s || isNaN(s.getTime())) return '';
    // helper to format a Date as H:MM am/pm
    const fmtTime = (d) => {
      const hh = d.getHours();
      const mm = String(d.getMinutes()).padStart(2, '0');
      const ampm = hh >= 12 ? 'pm' : 'am';
      const h12 = ((hh + 11) % 12) + 1;
      return `${h12}:${mm} ${ampm}`;
    };

    const yyyy = s.getFullYear();
    const mm = String(s.getMonth() + 1).padStart(2, '0');
    const dd = String(s.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    // if end is missing, try to compute it from durationMinutes or legacy duration
    if ((!e || isNaN(e.getTime()))) {
      const dur = (a.durationMinutes !== undefined && a.durationMinutes !== null)
        ? Number(a.durationMinutes) || 60
        : (a.duration ? parseDurationToMinutes(a.duration) : 60);
      e = new Date(s.getTime() + dur * 60 * 1000);
    }

    if (e && !isNaN(e.getTime())) {
      // show full start - end with minutes and am/pm
      const startStr = fmtTime(s);
      const endStr = fmtTime(e);
      // if the date of end differs (spans midnight), include both dates
      const endDateDifferent = e.getFullYear() !== s.getFullYear() || e.getMonth() !== s.getMonth() || e.getDate() !== s.getDate();
      if (endDateDifferent) {
        const eY = e.getFullYear();
        const eM = String(e.getMonth() + 1).padStart(2, '0');
        const eD = String(e.getDate()).padStart(2, '0');
        return `${dateStr} ${startStr} - ${eY}-${eM}-${eD} ${endStr}`;
      }
      return `${dateStr} ${startStr} - ${endStr}`;
    }
    // fallback: show date + time
    const fallback = fmtTime(s);
    return `${dateStr} ${fallback}`;
  }

  return (
  <div style={{ padding: 24, width: '100%', boxSizing: 'border-box' }}>
      <div className="appointments-header" style={{ marginBottom: 20 }}>
        <h2 className="appointments-title" style={{ margin: 0 }}>Appointments</h2>
      </div>
      <div className="appointments-header-actions" style={{ marginBottom: 20 }}>
        <button className="btn history-btn" onClick={() => setHistoryOpen(true)}>History</button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <input title="Filter by date" style={{ height: 32 }} type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
        <select aria-label="Branch" value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)}>
          <option value="all">All branches</option>
          {branches.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>

      {loading && <div>Loading...</div>}
      {error && <div style={{ color: 'var(--danger)' }}>Error: {String(error)}</div>}

  <div style={{ background: 'var(--bg-drawer)', border: '1px solid var(--border-main)', borderRadius: 12, padding: 8, marginTop: 4, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, lineHeight: 1.25, tableLayout: 'fixed' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
              <th style={{ textAlign: 'left', padding: 8, width: 140 }}>When</th>
              <th style={{ textAlign: 'left', padding: 8, width: 120 }}>Name</th>
              <th style={{ textAlign: 'left', padding: 8, width: 160 }}>Email</th>
              <th style={{ textAlign: 'left', padding: 8, width: 110 }}>Service</th>
              <th style={{ textAlign: 'left', padding: 8, width: 110 }}>Stylist</th>
              <th style={{ textAlign: 'left', padding: 8, width: 90 }}>Branch</th>
              <th style={{ textAlign: 'left', padding: 8, width: 90 }}>Status</th>
              <th style={{ textAlign: 'left', padding: 8, width: 150 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <AppointmentRow key={a.id} a={a} />
            ))}
          </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <EditAppointmentModal
          appointment={editing}
          open={showForm}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSubmit={handleEditSubmit}
        />
      )}

      {viewing && (
        <ViewAppointmentModal
          appointment={viewing}
          open={Boolean(viewing)}
          onClose={() => setViewing(null)}
        />
      )}

      {/* CustomerHistoryModal removed (invoked only via per-row History previously) */}

      {historyOpen && (
        <CustomerHistoryModal
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
        />
      )}

      {/* NewAppointmentModal removed: appointments sourced externally */}
    </div>
  );
}
