import { useEffect, useState, useContext } from 'react';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, query as q, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { AuthContext } from '../context/AuthContext';
import { logHistory } from '../utils/historyLogger';

export default function useAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user: authUser } = useContext(AuthContext);

  useEffect(() => {
    setLoading(true);
    const col = collection(db, 'appointments');
    const pq = q(col, orderBy('startTime'));
    const unsub = onSnapshot(pq, (snap) => {
      const arr = [];
      snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
      setAppointments(arr);
      setLoading(false);
    }, (e) => {
      console.error('appointments listener error', e);
      setError(e.message || String(e));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const createAppointment = async (payload) => {
    const ref = await addDoc(collection(db, 'appointments'), { ...payload, createdAt: serverTimestamp() });
    try { await logHistory({ action: 'create', collection: 'appointments', docId: ref.id, before: null, after: payload }); } catch (e) { console.warn('history logger failed', e); }
    return ref.id;
  };

  const updateAppointment = async (id, updates, before = null) => {
    const apptRef = doc(db, 'appointments', id);
    await updateDoc(apptRef, { ...updates, updatedAt: serverTimestamp() });
    try { await logHistory({ action: 'update', collection: 'appointments', docId: id, before, after: updates }); } catch (e) { console.warn('history logger failed', e); }
  };

  const deleteAppointment = async (id, before = null) => {
    await deleteDoc(doc(db, 'appointments', id));
    try { await logHistory({ action: 'delete', collection: 'appointments', docId: id, before, after: null }); } catch (e) { console.warn('history logger failed', e); }
  };

  return { appointments, loading, error, createAppointment, updateAppointment, deleteAppointment };
}
