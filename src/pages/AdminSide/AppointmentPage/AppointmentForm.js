// AppointmentForm: basic create/edit form (used internally; creation mostly external now).
import React, { useEffect } from 'react';
import { validateForm } from '../../../utils/validators';

const AppointmentForm = ({ editing, onCancel, onSubmit, branches = [] }) => {
  const startTimeDefault = editing?.startTime
    ? new Date(editing.startTime?.toDate ? editing.startTime.toDate() : editing.startTime).toISOString().slice(0,16)
    : '';

  useEffect(() => {
    const el = document.querySelector('.appointment-form input[name="clientName"]');
    if (el) el.focus();
  }, []);

  return (
    <div className="full-screen-form" onClick={onCancel}>
      <form className="appointment-form" onClick={(e) => e.stopPropagation()} onSubmit={(e) => {
        e.preventDefault();
        const v = validateForm(e.target);
        if (!v.ok) { alert(v.message || 'Invalid input'); return; }
        onSubmit && onSubmit(e);
      }}>
        <input name="clientName" placeholder="Client name" defaultValue={editing?.clientName || ''} />
        <input name="serviceName" placeholder="Service" defaultValue={editing?.serviceName || ''} />
        <input name="stylistName" placeholder="Stylist" defaultValue={editing?.stylistName || ''} />
        {branches && branches.length ? (
          <select name="branch" defaultValue={editing?.branch || branches[0]}>
            {branches.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        ) : (
          <input name="branch" placeholder="Branch" defaultValue={editing?.branch || ''} />
        )}
        <input name="startTime" type="datetime-local" defaultValue={startTimeDefault} />
        <select name="status" defaultValue={editing?.status || 'booked'}>
          <option value="booked">booked</option>
          <option value="confirmed">confirmed</option>
          <option value="completed">completed</option>
          <option value="cancelled">cancelled</option>
        </select>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" className="btn btn-primary">{editing ? 'Save' : 'Create'}</button>
          <button type="button" className="btn" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </div>
  );
};

export default AppointmentForm;
