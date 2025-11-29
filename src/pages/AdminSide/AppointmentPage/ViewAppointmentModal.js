// ViewAppointmentModal: read-only details view.
import React from 'react';

export default function ViewAppointmentModal({ appointment, open = false, onClose = () => {} }) {
  if (!open || !appointment) return null;
  const payment = appointment.payment || {};
  const amountPaid = Number(payment.amountPaid || 0) || Number(appointment.amountPaid || 0) || 0;
  const paymentConfirmed = Boolean(payment.confirmed) || Boolean(payment.paymentConfirmedAt) || Boolean(appointment.paymentConfirmedAt) || Boolean(appointment.reservationPaid);
  const reservationPaid = Boolean(appointment.reservationPaid) || Boolean(payment.reservationPaid);
  const paymentMethod = (payment.details && payment.details.method) || payment.method || (payment.details && payment.details.name) || '';

  const paymentStatusLabel = paymentConfirmed ? 'Paid' : (amountPaid > 0 || reservationPaid ? 'Partial / Pending' : 'Unpaid');

  return (
    <div style={{ display: 'block' }}>
      <div style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, background: '#1f1f1f', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }} onClick={onClose}>
        <div style={{ background: '#2b2b2b', color: '#fff', padding: 20, borderRadius: 8, width: 'min(520px, 96%)', border: '1px solid rgba(197,155,22,0.18)', boxSizing: 'border-box' }} onClick={(e) => e.stopPropagation()}>
          <h3 style={{ marginTop: 0 }}>Appointment details</h3>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 60%' }}><strong>Client:</strong> {appointment.clientName} {appointment.clientEmail ? `(${appointment.clientEmail})` : ''}</div>
            <div style={{ flex: '1 1 40%', textAlign: 'right' }}>
              <div style={{ display: 'inline-block', padding: '6px 10px', borderRadius: 12, background: paymentConfirmed ? '#16a34a' : (amountPaid > 0 || reservationPaid ? '#f59e0b' : '#ef4444'), color: '#fff', fontWeight: 700 }}>{paymentStatusLabel}</div>
            </div>
          </div>

          <div style={{ marginTop: 8 }}><strong>Service:</strong> {appointment.serviceName || appointment.service || (Array.isArray(appointment.services) && appointment.services.length ? appointment.services.map(s => s.name || s.serviceName || s.title || '').filter(Boolean).join(', ') : '')}</div>
          <div><strong>Stylist:</strong> {appointment.stylistName}</div>
          <div><strong>When:</strong> {new Date(appointment.startTime?.toDate ? appointment.startTime.toDate() : appointment.startTime).toLocaleString()}</div>
          <div><strong>Status:</strong> {appointment.status}</div>

          <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: '#232323', border: '1px solid rgba(255,255,255,0.03)' }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Payment</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 160 }}><strong>Amount paid:</strong> {amountPaid ? `₱${amountPaid}` : '—'}</div>
              <div style={{ minWidth: 160 }}><strong>Method:</strong> {paymentMethod || (payment.details && payment.details.method) || '—'}</div>
              <div style={{ minWidth: 160 }}><strong>Reservation fee:</strong> {appointment.reservationFee ? `₱${appointment.reservationFee}` : (payment.details && payment.details.amount ? `₱${payment.details.amount}` : '—')}</div>
            </div>
            {payment.details && (
              <div style={{ marginTop: 8, color: '#ddd', fontSize: 13 }}>
                <div><strong>Payer:</strong> {payment.details.name || '—'}</div>
                <div><strong>Number:</strong> {payment.details.number || '—'}</div>
              </div>
            )}
          </div>

          <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn" onClick={onClose} style={{ background: 'transparent', border: '1px solid rgba(197,155,22,0.18)', color: '#fff' }}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
