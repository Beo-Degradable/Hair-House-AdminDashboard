import React, { useEffect, useState } from 'react';
import { parseDurationToMinutes } from '../../../utils/time';

// EditAppointmentModal now uses the same overlay/layout as NewAppointmentModal
// but prefills values from the `appointment` prop. It performs the same
// duration parsing and overlap checks and then calls onSubmit(payload).
export default function EditAppointmentModal({ appointment = null, open = false, onClose = () => {}, onSubmit = () => {} }) {
  // This modal only allows updating the appointment status. Other fields are shown read-only.
  const [form, setForm] = useState({ status: 'booked' });

  useEffect(() => {
    if (!appointment) return;
    const s = String(appointment.status || '').toLowerCase();
    setForm({ status: s === 'done' ? 'completed' : (s || 'booked') });
  }, [appointment]);

  if (!open || !appointment) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // If user selected 'cancelled', treat this as a cancellation request
      // that requires admin approval. We send status 'cancel_requested'
      // instead so admins can approve it from their UI.
      if (String(form.status).toLowerCase() === 'cancelled') {
        const ok = window.confirm('Send cancellation request for admin approval?');
        if (!ok) return;
        await onSubmit({ status: 'cancel_requested' });
      } else {
        await onSubmit({ status: form.status });
      }
      onClose();
    } catch (err) {
      console.error('update status failed', err);
      alert('Failed to update appointment status');
    }
  };

  // derive simple start-end string for display
  const toDate = (t) => (t && t.toDate ? t.toDate() : (t ? new Date(t) : null));
  const s = toDate(appointment.startTime);
  let e = toDate(appointment.endTime);
  if ((!e || isNaN(e?.getTime())) && s) {
    const dur = (appointment.durationMinutes !== undefined && appointment.durationMinutes !== null)
      ? Number(appointment.durationMinutes) || 60
      : (appointment.duration ? parseDurationToMinutes(appointment.duration) : 60);
    e = new Date(s.getTime() + dur * 60 * 1000);
  }

  const fmtTime = (d) => {
    if (!d) return '';
    const hh = d.getHours(); const mm = String(d.getMinutes()).padStart(2, '0');
    const ampm = hh >= 12 ? 'pm' : 'am'; const h12 = ((hh + 11) % 12) + 1;
    return `${h12}:${mm} ${ampm}`;
  };

  return (
    <div style={{ display: open ? 'block' : 'none' }}>
      <div style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
        <form className="modal-form" onSubmit={handleSubmit} style={{ background: 'var(--surface, #232323)', color: 'var(--text-primary, #fff)', padding: 20, borderRadius: 8, width: 'min(540px, 92%)', border: '1px solid var(--border-main)' }} onClick={(e) => e.stopPropagation()}>
          <h3 style={{ marginTop: 0 }}>Update appointment status</h3>

          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Client</div>
            <div style={{ fontWeight: 600 }}>{appointment.clientName || appointment.client || ''}</div>
            <div style={{ fontSize: 13 }}>{appointment.clientEmail || appointment.email || ''}</div>
          </div>

          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Service</div>
            <div style={{ fontWeight: 600 }}>{appointment.serviceName || ''}</div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Stylist: {appointment.stylistName || ''} • Branch: {appointment.branch || ''}</div>
          </div>

          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>When</div>
            <div style={{ fontWeight: 600 }}>{s ? `${s.toISOString().slice(0,10)} ${fmtTime(s)} - ${fmtTime(e)}` : ''}</div>
          </div>

          <div style={{ marginTop: 8 }}>
            <label style={{ display: 'block', fontSize: 12 }}>Status</label>
            <select value={form.status} onChange={(e) => setForm(f => ({ ...f, status: e.target.value }))} style={{ width: '100%', padding: 8, background: '#2b2b2b', border: '1px solid var(--border-main)', color: '#fff' }}>
              <option value="booked">Booked</option>
              <option value="confirmed">Confirmed</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
            <button type="button" onClick={onClose} className="btn">Close</button>
            <button type="submit" className="button-gold-dark">Update</button>
          </div>
        </form>
      </div>
    </div>
  );
}
