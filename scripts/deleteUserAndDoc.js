/*
Admin helper: delete Auth user and users/{uid} Firestore document.

Usage (from repo root):
  1) Create a service account in GCP, download its JSON key file.
  2) Set env var (bash):
       export GOOGLE_APPLICATION_CREDENTIALS="C:/path/to/key.json"
  3) Install dependencies (you can run this in the scripts folder or repo root):
       npm install firebase-admin
  4) Run script (dry run):
       node scripts/deleteUserAndDoc.js user@example.com
     Run for real:
       node scripts/deleteUserAndDoc.js user@example.com --confirm

This script accepts either a uid or an email address as the first argument.
--confirm will actually perform deletions; without it the script is a dry-run.
*/

const admin = require('firebase-admin');

async function main() {
  const arg = process.argv[2];
  const confirm = process.argv.includes('--confirm');

  if (!arg) {
    console.error('Usage: node scripts/deleteUserAndDoc.js <uid-or-email> [--confirm]');
    process.exit(1);
  }

  // Initialize Admin SDK using GOOGLE_APPLICATION_CREDENTIALS
  try {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      // projectId: 'hair-house-salon-ef695' // optional
    });
  } catch (e) {
    // already initialized in some environments
  }

  const auth = admin.auth();
  const db = admin.firestore();

  try {
    // Resolve uid from email if needed
    let uid = arg;
    if (arg.includes('@')) {
      try {
        const user = await auth.getUserByEmail(arg);
        uid = user.uid;
      } catch (err) {
        console.error('Could not find user by email:', err.message || err);
        process.exit(2);
      }
    }

    console.log('Target UID:', uid);
    if (!confirm) {
      console.log('Dry run: no destructive actions. Re-run with --confirm to actually delete.');
      process.exit(0);
    }

    // Delete from Auth
    try {
      await auth.deleteUser(uid);
      console.log('Auth user deleted:', uid);
    } catch (err) {
      console.error('Failed to delete auth user:', err.message || err);
      // continue to attempt to delete Firestore doc
    }

    // Delete Firestore users/{uid} doc (best-effort)
    try {
      await db.doc(`users/${uid}`).delete();
      console.log('Firestore users/{uid} deleted');
    } catch (err) {
      console.warn('Failed to delete users doc (non-fatal):', err.message || err);
    }

    process.exit(0);
  } catch (err) {
    console.error('Error deleting user:', err);
    process.exit(3);
  }
}

main();
