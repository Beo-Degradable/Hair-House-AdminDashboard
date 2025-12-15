import { doc, collection, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

// Normalize user object to createdBy map
function normalizeUserForAudit(user) {
  if (!user) return null;
  // If it's an auth user object
  if (user.uid || user.email || user.displayName || user.photoURL) {
    return {
      uid: user.uid || null,
      name: user.displayName || user.name || null,
      email: user.email || null,
      avatar: user.photoURL || user.avatar || null,
    };
  }
  // If it's already a map-like createdBy
  if (user.name || user.email) return { name: user.name || null, email: user.email || null, avatar: user.avatar || null };
  return null;
}

// Update an inventory document (by doc id) atomically and write an inventoryAdjustments audit doc.
// inventoryDocId: id of the document in the `inventory` collection
// newQuantity: number
// reason: string
// user: auth user or createdBy map
export async function updateInventoryDocQuantity({ inventoryDocId, newQuantity, reason = 'Manual update', user = null }) {
  if (!inventoryDocId) throw new Error('inventoryDocId is required');
  if (typeof newQuantity !== 'number') throw new Error('newQuantity must be a number');

  const invRef = doc(db, 'inventory', inventoryDocId);
  const adjustmentsCol = collection(db, 'inventoryAdjustments');

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(invRef);
    if (!snap.exists()) throw new Error('Inventory document not found');
    const data = snap.data();
    const before = Number(data.quantity || 0);
    const after = Number(newQuantity);
    const delta = after - before;

    tx.update(invRef, { quantity: after, lastUpdated: serverTimestamp() });

    const adjRef = doc(adjustmentsCol);
    tx.set(adjRef, {
      productId: data.productId || null,
      branchId: data.branchId || data.branch || null,
      before,
      after,
      delta,
      reason: reason || null,
      createdBy: normalizeUserForAudit(user),
      createdAt: serverTimestamp(),
    });

    return { inventoryDocId, before, after, delta };
  });
}

export default { updateInventoryDocQuantity };
