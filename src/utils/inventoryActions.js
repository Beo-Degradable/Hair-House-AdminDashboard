import { doc, runTransaction, collection, serverTimestamp } from 'firebase/firestore';
// Utility: safely adjust branch qty and write an audit record in a transaction
export async function adjustBranchQty(db, productId, branchId, delta, user = null, reason = '') {
  const productRef = doc(db, 'products', productId);
  const adjustmentsCol = collection(db, 'inventoryAdjustments');

  return runTransaction(db, async (tx) => {
    const prodSnap = await tx.get(productRef);
    if (!prodSnap.exists()) throw new Error('Product not found');

    const prod = prodSnap.data();
    const branches = prod.branches ? { ...prod.branches } : {};
    const prevBranch = branches[branchId] || { qty: 0 };
    const prevBranchQty = Number(prevBranch.qty || 0);
    const newBranchQty = prevBranchQty + Number(delta || 0);

    branches[branchId] = { ...(branches[branchId] || {}), qty: newBranchQty, lastUpdated: serverTimestamp() };

    // compute new totalQty defensively
    const totalFromDoc = prod.totalQty ?? prod.qty ?? null;
    const computedTotal = totalFromDoc !== null ? Number(totalFromDoc) + Number(delta || 0) : Object.values(branches).reduce((s, b) => s + (Number(b.qty || 0)), 0);

    tx.update(productRef, { branches, totalQty: computedTotal });

    // create an audit doc with a generated id
    const adjRef = doc(adjustmentsCol);
    tx.set(adjRef, {
      productId,
      branchId,
      delta: Number(delta || 0),
      before: prevBranchQty,
      after: newBranchQty,
      reason: reason || null,
      createdBy: user ? user.uid || user : null,
      createdAt: serverTimestamp(),
    });

    return { productId, branchId, before: prevBranchQty, after: newBranchQty };
  });
}

export default { adjustBranchQty };

// New helper: adjust an `inventory` collection record (per-product, per-branch)
export async function adjustInventoryRecord(db, productId, branchKey, delta, user = null, reason = '') {
  const inventoryCol = collection(db, 'inventory');
  const adjustmentsCol = collection(db, 'inventoryAdjustments');

  // We'll run a transaction that finds an existing inventory doc for this product+branch
  return runTransaction(db, async (tx) => {
    // Read all inventory docs for this product (should be small per product)
    // We can't run a compound OR query easily here, so fetch product records and match
    const qSnap = await tx.get(inventoryCol);
    let targetDoc = null;
    qSnap.forEach(d => {
      const data = d.data();
      if (!data || data.productId !== productId) return;
      // match by explicit branch fields or by doc id pattern
      const branchVal = data.branch || data.branchId || '';
      if (String(branchVal).toLowerCase() === String(branchKey).toLowerCase()) {
        targetDoc = { id: d.id, ref: doc(db, 'inventory', d.id), data };
      }
    });

    // If not found, create a new doc id (let Firestore generate one) by using a direct set later via tx.set
    if (!targetDoc) {
      // create a new doc reference
      const newRef = doc(inventoryCol); // generate id
      const beforeQty = 0;
      const afterQty = Math.max(0, Number(delta || 0));
      tx.set(newRef, {
        productId,
        branch: branchKey,
        quantity: afterQty,
        lastUpdated: serverTimestamp(),
      });

      const adjRef = doc(adjustmentsCol);
      tx.set(adjRef, {
        productId,
        branchId: branchKey,
        delta: Number(delta || 0),
        before: beforeQty,
        after: afterQty,
        reason: reason || null,
        createdBy: user ? user.uid || user : null,
        createdAt: serverTimestamp(),
      });

      return { productId, branchId: branchKey, before: beforeQty, after: afterQty };
    }

    // If found, update the doc quantity
    const invRef = targetDoc.ref;
    const currentQty = Number(targetDoc.data.quantity || 0);
    const newQty = Math.max(0, currentQty + Number(delta || 0));
    tx.update(invRef, { quantity: newQty, lastUpdated: serverTimestamp() });

    // write audit
    const adjRef2 = doc(adjustmentsCol);
    tx.set(adjRef2, {
      productId,
      branchId: branchKey,
      delta: Number(delta || 0),
      before: currentQty,
      after: newQty,
      reason: reason || null,
      createdBy: user ? user.uid || user : null,
      createdAt: serverTimestamp(),
    });

    return { productId, branchId: branchKey, before: currentQty, after: newQty };
  });
}
