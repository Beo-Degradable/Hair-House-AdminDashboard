import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '../firebase';

/**
 * logHistory helper
 * Params:
 *  - action: string
 *  - collection: string (name of collection affected)
 *  - docId: string
 *  - before, after: objects (optional)
 *  - meta: object (optional additional metadata)
 */
export async function logHistory({ action, collection: collName, docId, before = null, after = null, meta = {} }) {
  try {
    const auth = getAuth();
    const user = auth.currentUser;
    const actor = user ? { uid: user.uid, email: user.email } : null;
    await addDoc(collection(db, 'history'), {
      action,
      collection: collName,
      docId,
      actor,
      before,
      after,
      meta,
      timestamp: serverTimestamp(),
    });
  } catch (e) {
    // Non-fatal: we don't want history failures to break primary flows
    // but we log for local debugging.
    // eslint-disable-next-line no-console
    console.warn('History write failed', e);
  }
}

export default logHistory;
