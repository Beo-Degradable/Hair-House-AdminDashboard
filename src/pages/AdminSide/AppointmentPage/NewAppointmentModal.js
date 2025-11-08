import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query as q, orderBy } from 'firebase/firestore';
import { db } from '../../../firebase';
import useAppointments from '../../../hooks/useAppointments';
import { isValidName, isValidEmail, sanitizeName, stripSpecialExceptEmail } from '../../../utils/validators';

export default function NewAppointmentModal({ open = false, onClose = () => {}, defaultBranch = '', defaultStartAt = '' }) {
  const { createAppointment, appointments = [] } = useAppointments();
  const [services, setServices] = useState([]);
  const [stylists, setStylists] = useState([]);

  const [form, setForm] = useState({
    clientName: '',
    clientEmail: '',
    serviceName: '',
    stylistName: '',
    branch: defaultBranch || '',
    startDate: defaultStartAt || '',
    startTime: '',
    status: 'booked',
  });

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

  useEffect(() => {
    const col = collection(db, 'users');
    // user documents use `name` (see AddUserModal) so order by name for consistency
    const pq = q(col, orderBy('name'));
    const unsub = onSnapshot(pq, snap => {
      const arr = [];
      snap.forEach(d => { const data = { id: d.id, ...d.data() }; if (data.role === 'stylist') arr.push(data); });
      setStylists(arr);
    }, err => { console.warn('users listener', err); setStylists([]); });
    return () => unsub();
  }, []);

  useEffect(() => {
    setForm(f => ({ ...f, branch: defaultBranch || f.branch, startDate: defaultStartAt || f.startDate }));
  }, [defaultBranch, defaultStartAt]);

  // compute stylists to show based on selected branch; if 'all' show everyone
  const availableStylists = (form.branch && form.branch !== '' && form.branch !== 'all')
    ? stylists.filter(s => ((s.branchName || s.branch || '') === form.branch))
    : stylists;

  // generate allowed time slots from 08:00 to 16:00 (latest start so 1-hour appointment ends by 17:00)
  const timeSlots = [];
  for (let mins = 8 * 60; mins <= 16 * 60; mins += 15) {
    const hh = Math.floor(mins / 60);
    const mm = mins % 60;
    const value = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    const hr12 = ((hh + 11) % 12) + 1;
    const ampm = hh >= 12 ? 'PM' : 'AM';
    const display = `${hr12}:${String(mm).padStart(2, '0')} ${ampm}`;
    timeSlots.push({ value, display });
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
  // validate time is within business hours 08:00 - 17:00
    // appointments are 1 hour long, so the latest allowed start is 16:00
    if (!form.startTime) {
      alert('Please select a time between 08:00 and 17:00');
      return;
    }
    // validate name and email formats
    if (!form.clientName || !isValidName(form.clientName)) {
      alert('Please enter a valid client name (letters and spaces only)');
      return;
    }
    if (!form.clientEmail || !isValidEmail(form.clientEmail)) {
      alert('Please enter a valid client email');
      return;
    }
    const [hhStr, mmStr] = form.startTime.split(':');
    const hh = Number(hhStr);
    const mm = Number(mmStr || '0');
    if (isNaN(hh) || isNaN(mm)) {
      alert('Invalid time');
      return;
    }
    const startMinutes = hh * 60 + mm;
    const opening = 8 * 60; // 08:00
    const closing = 17 * 60; // 17:00
    const appointmentLength = 60; // minutes
    if (startMinutes < opening || (startMinutes + appointmentLength) > closing) {
      alert('Please choose a start time so the appointment falls between 08:00 and 17:00');
      return;
    }
    try {
      const start = new Date(`${form.startDate}T${form.startTime || '09:00'}`);
      // determine service duration (stored like '30m', '2h', '45s')
      let durationMinutes = 60; // default 1 hour
      if (form.serviceName) {
        const svc = services.find(s => s.name === form.serviceName);
        if (svc && svc.duration) {
          const m = String(svc.duration).match(/^(\d+)\s*([smh])$/i);
          if (m) {
            const v = Number(m[1]);
            const unit = m[2].toLowerCase();
            if (unit === 'h') durationMinutes = v * 60;
            else if (unit === 'm') durationMinutes = v;
            else if (unit === 's') durationMinutes = Math.ceil(v / 60);
          }
        }
      }
      const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

      // check overlaps: if stylist selected, ensure that stylist has no overlapping appt;
      // otherwise, ensure branch has no overlapping appt
      const toDate = (t) => (t && t.toDate ? t.toDate() : (t ? new Date(t) : null));
      const overlaps = (aStart, aEnd, bStart, bEnd) => (aStart < bEnd && bStart < aEnd);
      const conflict = (appointments || []).some(a => {
        const aStart = toDate(a.startTime);
        if (!aStart) return false;
        const aEnd = toDate(a.endTime) || new Date(aStart.getTime() + (a.durationMinutes ? a.durationMinutes * 60000 : 60 * 60000));
        // match by stylist if provided, else by branch
        if (form.stylistName) {
          if ((a.stylistName || '') !== form.stylistName) return false;
        } else if (form.branch && form.branch !== 'all') {
          if ((a.branch || '') !== form.branch) return false;
        }
        return overlaps(aStart, aEnd, start, end);
      });
      if (conflict) {
        alert('Selected time overlaps an existing appointment. Please choose another slot.');
        return;
      }
      // If 'All branches' is selected and a stylist is chosen, infer branch from stylist
      const chosenStylist = stylists.find(s => (s.displayName || s.name) === form.stylistName);
      const resolvedBranch = (form.branch === 'all' && chosenStylist)
        ? (chosenStylist.branchName || chosenStylist.branch || '')
        : form.branch;

      const payload = {
        clientName: sanitizeName(form.clientName),
        clientEmail: form.clientEmail.trim(),
        serviceName: form.serviceName,
        stylistName: form.stylistName,
        branch: resolvedBranch,
        startTime: start,
        endTime: end,
        // store computed durationMinutes for easier checks later
        durationMinutes,
        status: form.status,
      };
      await createAppointment(payload);
      onClose();
    } catch (err) {
      console.error('create appointment failed', err);
      alert('Failed to create appointment');
    }
  };

  // render as overlay matching AddInventoryModal layout
  return (
    <div style={{ display: open ? 'block' : 'none' }}>
      <div style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
        <form className="modal-form" onSubmit={handleSubmit} style={{ background: 'var(--surface, #232323)', color: 'var(--text-primary, #fff)', padding: 20, borderRadius: 8, width: 'min(540px, 92%)', border: '1px solid var(--border-main)' }} onClick={(e) => e.stopPropagation()}>
          <h3 style={{ marginTop: 0 }}>New appointment</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12 }}>Name</label>
              <input required type="text" value={form.clientName} onChange={(e) => setForm(f => ({ ...f, clientName: sanitizeName(e.target.value) }))} style={{ width: '92%', padding: 8, background: 'var(--surface)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12 }}>Email</label>
              <input required type="email" value={form.clientEmail} onChange={(e) => setForm(f => ({ ...f, clientEmail: stripSpecialExceptEmail(e.target.value) }))} style={{ width: '92%', padding: 8, background: 'var(--surface)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12 }}>Service</label>
              <select required value={form.serviceName} onChange={(e) => setForm(f => ({ ...f, serviceName: e.target.value }))} style={{ width: '92%', padding: 8, background: '#2b2b2b', border: '1px solid var(--border-main)', color: '#fff' }}>
                <option value="">Select service</option>
                {services.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12 }}>Branch</label>
              <select value={form.branch} onChange={(e) => setForm(f => {
                const newBranch = e.target.value;
                const avail = (newBranch && newBranch !== '' && newBranch !== 'all') ? stylists.filter(s => ((s.branchName || s.branch || '') === newBranch)) : stylists;
                const keep = avail.some(s => (s.displayName || s.name) === f.stylistName);
                return { ...f, branch: newBranch, stylistName: keep ? f.stylistName : '' };
              })} style={{ width: '92%', padding: 8, background: '#2b2b2b', border: '1px solid var(--border-main)', color: '#fff' }}>
                <option value="">Select branch</option>
                <option value="all">All branches</option>
                <option value="Vergara">Vergara</option>
                <option value="Lawas">Lawas</option>
                <option value="Lipa">Lipa</option>
                <option value="Tanauan">Tanauan</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12 }}>Stylist</label>
              <select value={form.stylistName} onChange={(e) => setForm(f => ({ ...f, stylistName: e.target.value }))} style={{ width: '92%', padding: 8, background: '#2b2b2b', border: '1px solid var(--border-main)', color: '#fff' }}>
                <option value="">Select a Stylist</option>
                {availableStylists.map(s => <option key={s.id} value={s.displayName || s.name}>{s.displayName || s.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12 }}>Date & Time</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input required type="date" value={form.startDate} onChange={(e) => setForm(f => ({ ...f, startDate: e.target.value }))} style={{ padding: 8, background: 'var(--surface)', border: '1px solid var(--border-main)', color: 'var(--text-primary)' }} />
                <select
                  required
                  value={form.startTime}
                  onChange={(e) => setForm(f => ({ ...f, startTime: e.target.value }))}
                  style={{ padding: 8, background: '#2b2b2b', border: '1px solid var(--border-main)', color: '#fff', width: 160 }}
                >
                  <option value="">Select time</option>
                  {timeSlots.map(ts => (
                    <option key={ts.value} value={ts.value}>{ts.display}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
            <button type="button" onClick={onClose} className="btn">Cancel</button>
            <button type="submit" className="button-gold-dark">Create</button>
          </div>
        </form>
      </div>
    </div>
  );
}
