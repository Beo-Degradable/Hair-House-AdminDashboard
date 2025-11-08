import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query as q, orderBy, where, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../../../firebase';

export default function CustomerHistoryModal({ open = false, onClose = () => {} }) {
	const [appointments, setAppointments] = useState([]);
	const [history, setHistory] = useState([]);
	const [statusFilter, setStatusFilter] = useState('all');
	const [actionFilter, setActionFilter] = useState('all');
	const [clearing, setClearing] = useState(false);

	useEffect(() => {
		const col = collection(db, 'appointments');
		const pq = q(col, orderBy('startTime'));
		const unsub = onSnapshot(pq, snap => {
			const arr = [];
			snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
			setAppointments(arr);
		}, err => { console.warn('appointments listener', err); setAppointments([]); });
		return () => unsub();
	}, []);

	useEffect(() => {
		const col = collection(db, 'history');
		const pq = q(col, orderBy('timestamp'));
		const unsub = onSnapshot(pq, snap => {
			const arr = [];
			snap.forEach(d => {
				const data = { id: d.id, ...d.data() };
				// only gather history for appointments and skip generic 'update' actions
				if (data.collection === 'appointments' && String(data.action || '').toLowerCase() !== 'update') arr.push(data);
			});
			setHistory(arr);
		}, err => { console.warn('history listener', err); setHistory([]); });
		return () => unsub();
	}, []);

	const combined = useMemo(() => {
		// only show these canonical statuses (normalize legacy 'done' -> 'completed')
		const allowed = new Set(['booked','completed','cancelled']);

		const cur = (appointments || []).map(a => ({
			id: a.id,
			when: a.startTime?.toDate ? a.startTime.toDate() : (a.startTime ? new Date(a.startTime) : null),
			end: a.endTime?.toDate ? a.endTime.toDate() : (a.endTime ? new Date(a.endTime) : null),
			serviceName: a.serviceName,
			stylistName: a.stylistName,
			status: (String(a.status || '').toLowerCase() === 'done' ? 'completed' : String(a.status || '').toLowerCase()),
			source: 'current',
			raw: a,
		})).filter(it => {
			const s = String(it.status || '').toLowerCase();
			// exclude create/delete history actions (these are noisy duplicates)
			const act = String(it.action || '').toLowerCase();
			if (act === 'create' || act === 'delete' || act === 'insert' || act === 'add' || act === 'remove') return false;
			return allowed.has(s);
		});

		const hist = (history || []).map(h => ({
			id: h.id,
			when: h.after?.startTime?.toDate ? h.after.startTime.toDate() : (h.before?.startTime?.toDate ? h.before.startTime.toDate() : null),
			end: h.after?.endTime?.toDate ? h.after.endTime.toDate() : (h.before?.endTime?.toDate ? h.before.endTime.toDate() : null),
			serviceName: h.after?.serviceName || h.before?.serviceName,
			stylistName: h.after?.stylistName || h.before?.stylistName,
			status: (String(h.after?.status || h.before?.status || h.action || '').toLowerCase() === 'done' ? 'completed' : String(h.after?.status || h.before?.status || h.action || '').toLowerCase()),
			action: h.action,
			source: `history:${h.action}`,
			raw: h,
		})).filter(it => allowed.has(String(it.status || '').toLowerCase()));

		return [...cur, ...hist].sort((a,b) => {
			const ta = a.when ? a.when.getTime() : 0;
			const tb = b.when ? b.when.getTime() : 0;
			return ta - tb;
		});
	}, [appointments, history]);

	const historyRows = useMemo(() => {
		return (history || []).map(h => ({
			id: h.id,
			when: h.after?.startTime?.toDate ? h.after.startTime.toDate() : (h.before?.startTime?.toDate ? h.before.startTime.toDate() : null),
			end: h.after?.endTime?.toDate ? h.after.endTime.toDate() : (h.before?.endTime?.toDate ? h.before.endTime.toDate() : null),
			serviceName: h.after?.serviceName || h.before?.serviceName,
			stylistName: h.after?.stylistName || h.before?.stylistName,
			status: h.after?.status || h.before?.status || h.action,
			action: h.action,
			source: `history:${h.action}`,
			raw: h,
		})).filter(it => {
			const s = String(it.status || '').toLowerCase();
			return ['booked','completed','cancelled'].includes(s);
		});
	}, [history]);

		const matchesAction = (item, action) => {
			if (!action || action === 'all') return true;
			const act = (item.action || '').toString().toLowerCase();
			if (act) {
				if (action === 'update') return act.includes('update');
				if (action === 'delete') return act.includes('delete') || act.includes('remove');
				if (action === 'create') return act.includes('create') || act.includes('add') || act.includes('insert');
				return false;
			}
			// current (non-history) items have no action, so only include them when action === 'all'
			return false;
		};

		const filtered = useMemo(() => {
			const source = combined; // combined contains current + history
			return (source || []).filter(item => {
				if (statusFilter && statusFilter !== 'all') return (item.status || '').toLowerCase() === statusFilter.toLowerCase();
				// if actionFilter is 'all' include everything, otherwise only history items matching action
				if (actionFilter === 'all') return true;
				return matchesAction(item, actionFilter);
			});
		}, [combined, statusFilter, actionFilter]);

	const openPrintWindow = () => {
		const w = window.open('', '_blank');
		if (!w) return;
		const rows = filtered.map(it => {
			const date = it.when ? it.when.toLocaleString() : '';
			const action = it.action ? ` (${it.action})` : '';
			return `<tr><td>${date}</td><td>${it.serviceName || ''}</td><td>${it.stylistName || ''}</td><td>${it.status || ''}${action}</td><td>${it.source || ''}</td></tr>`;
		}).join('');
		const html = `
			<html>
				<head>
					<title>History</title>
				</head>
				<body>
					<h2>Booking history</h2>
					<table border="1" cellpadding="6" cellspacing="0">
						<thead><tr><th>When</th><th>Service</th><th>Stylist</th><th>Status</th><th>Source</th></tr></thead>
						<tbody>${rows}</tbody>
					</table>
				</body>
			</html>
		`;
		w.document.write(html);
		w.document.close();
		setTimeout(() => { w.print(); }, 500);
	};

	if (!open) return null;
	return (
			<div style={{ position: 'fixed', left:0, top:0, right:0, bottom:0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={onClose}>
				<div style={{ background: 'var(--bg-drawer, white)', color: 'var(--text-main, #181818)', padding: 20, borderRadius: 8, width: '95%', maxWidth: 1000, maxHeight: '85vh', overflow: 'hidden', border: '1px solid var(--border-main, #ddd)' }} onClick={(e) => e.stopPropagation()}>
						<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
							<h3 style={{ margin: 0, textAlign: 'left' }}>Booking history</h3>
																				{/* Action dropdown moved next to status filter below */}
						</div>

						<div style={{ display: 'flex', gap: 8, marginTop: 12, marginBottom: 12, alignItems: 'center', color: 'var(--text-secondary, #fffbe6)' }}>
							<label style={{ display: 'block' }}>Filter status</label>
							<select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
								<option value="all">All</option>
								<option value="booked">booked</option>
								<option value="completed">completed</option>
								<option value="cancelled">cancelled</option>
							</select>
							<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
								<label style={{ margin: 0 }}>Action</label>
								<select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} style={{ padding: 6 }}>
									<option value="all">All</option>
									<option value="update">Update</option>
									<option value="delete">Delete</option>
									<option value="create">Create</option>
								</select>
							</div>
							<div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
								<button className="btn" onClick={openPrintWindow}>Export / Print</button>
								<button className="btn" onClick={async () => {
									if (clearing) return;
									if (!window.confirm('Clear all appointment history? This will permanently delete appointment history entries.')) return;
									setClearing(true);
									try {
										const col = collection(db, 'history');
										const pq = q(col, where('collection', '==', 'appointments'));
										const snap = await getDocs(pq);
										await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
										setHistory([]);
									} catch (err) {
										console.error('failed to clear history', err);
										alert('Failed to clear history. See console for details.');
									} finally {
										setClearing(false);
									}
								}} disabled={clearing}>
									{clearing ? 'Clearing...' : 'Clear'}
								</button>
								<button className="btn" onClick={onClose}>Close</button>
							</div>
						</div>

				<div style={{ overflowX: 'auto', overflowY: 'auto' }}>
					<table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
						<thead>
							<tr style={{ borderBottom: '1px solid #ddd' }}>
								<th style={{ textAlign: 'left', padding: 8 }}>When</th>
								<th style={{ textAlign: 'left', padding: 8 }}>Service</th>
								<th style={{ textAlign: 'left', padding: 8 }}>Stylist</th>
								<th style={{ textAlign: 'left', padding: 8 }}>Status</th>
								<th style={{ textAlign: 'left', padding: 8 }}>Source</th>
							</tr>
						</thead>
						<tbody>
							{filtered.map(it => (
								<tr key={`${it.source}-${it.id}`} style={{ borderBottom: '1px solid #eee' }}>
									<td style={{ padding: 8 }}>{it.when ? it.when.toLocaleString() : ''}</td>
									<td style={{ padding: 8 }}>{it.serviceName}</td>
									<td style={{ padding: 8 }}>{it.stylistName}</td>
									<td style={{ padding: 8 }}>{it.status}{it.action ? ` (${it.action})` : ''}</td>
									<td style={{ padding: 8 }}>{it.source}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}

