/*
Diagnostic helper: find an Auth user by email or uid and report Firestore users/{uid} doc status.

Usage:
  export GOOGLE_APPLICATION_CREDENTIALS="C:/path/to/key.json"
  node scripts/findUserAndDoc.js user@example.com
  or pass uid:
  node scripts/findUserAndDoc.js <uid>
*/

const admin = require('firebase-admin');

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: node scripts/findUserAndDoc.js <email-or-uid>');
    process.exit(1);
  }

  try {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  } catch (e) {
    // ignore if already initialized
  }

  const auth = admin.auth();
  const db = admin.firestore();

  try {
    let uid = arg;
    let userRecord = null;

    if (arg.includes('@')) {
      try {
        userRecord = await auth.getUserByEmail(arg);
        uid = userRecord.uid;
      } catch (err) {
        console.log('No Auth user found for that email:', err.message || err);
        process.exit(0);
      }
    } else {
      try {
        userRecord = await auth.getUser(arg);
        uid = userRecord.uid;
      } catch (err) {
        console.log('No Auth user found for that uid:', err.message || err);
        process.exit(0);
      }
    }

    console.log('Auth user found:');
    console.log('  uid:', uid);
    console.log('  email:', userRecord.email);
    console.log('  disabled:', userRecord.disabled);
    console.log('  providers:', (userRecord.providerData || []).map(p => p.providerId).join(', ') || '(none)');

    // Check Firestore users doc
    try {
      const snap = await db.doc(`users/${uid}`).get();
      if (snap.exists) {
        console.log('Firestore users doc exists:', snap.id);
        console.log('Document data preview:', snap.data());
      } else {
        console.log('No Firestore users doc found at users/' + uid);
      }
    } catch (err) {
      console.warn('Failed to read users doc:', err.message || err);
    }

    process.exit(0);
  } catch (err) {
    console.error('Error checking user:', err);
    process.exit(2);
  }
}

main();
