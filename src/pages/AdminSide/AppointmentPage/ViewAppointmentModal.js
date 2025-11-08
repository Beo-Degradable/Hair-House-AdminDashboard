import React from 'react';

export default function ViewAppointmentModal({ appointment, open = false, onClose = () => {} }) {
  if (!open || !appointment) return null;
  return (
    <div style={{ display: 'block' }}>
      <div style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
        <div style={{ background: 'var(--surface)', color: 'var(--text-primary)', padding: 20, borderRadius: 8, width: 420, border: '1px solid var(--border-main)' }} onClick={(e) => e.stopPropagation()}>
          <h3 style={{ marginTop: 0 }}>Appointment details</h3>
          <div><strong>Client:</strong> {appointment.clientName} {appointment.clientEmail ? `(${appointment.clientEmail})` : ''}</div>
          <div><strong>Service:</strong> {appointment.serviceName}</div>
          <div><strong>Stylist:</strong> {appointment.stylistName}</div>
          <div><strong>When:</strong> {new Date(appointment.startTime?.toDate ? appointment.startTime.toDate() : appointment.startTime).toLocaleString()}</div>
          <div><strong>Status:</strong> {appointment.status}</div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
