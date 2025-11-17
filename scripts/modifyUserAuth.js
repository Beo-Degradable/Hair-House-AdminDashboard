/*
Admin helper: modify an Auth user (disable/enable/revoke tokens)

Usage:
  export GOOGLE_APPLICATION_CREDENTIALS="C:/path/to/key.json"
  node scripts/modifyUserAuth.js <email-or-uid> --action disable|enable|revoke [--confirm]

Example:
  node scripts/modifyUserAuth.js user@example.com --action disable --confirm
*/

const admin = require('firebase-admin');

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: node scripts/modifyUserAuth.js <email-or-uid> --action disable|enable|revoke [--confirm]');
    process.exit(1);
  }

  const target = args[0];
  const actionFlagIndex = args.indexOf('--action');
  const confirm = args.includes('--confirm');
  if (actionFlagIndex === -1 || !args[actionFlagIndex + 1]) {
    console.error('Missing --action flag');
    process.exit(1);
  }
  const action = args[actionFlagIndex + 1];
  if (!['disable', 'enable', 'revoke'].includes(action)) {
    console.error('Unknown action:', action);
    process.exit(1);
  }

  try {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  } catch (e) {}

  const auth = admin.auth();

  try {
    let uid = target;
    if (target.includes('@')) {
      try {
        const user = await auth.getUserByEmail(target);
        uid = user.uid;
      } catch (err) {
        console.error('Could not find user by email:', err.message || err);
        process.exit(2);
      }
    }

    console.log('Target UID:', uid);
    if (!confirm) {
      console.log('Dry run: no destructive actions. Re-run with --confirm to perform the action.');
      process.exit(0);
    }

    if (action === 'disable') {
      await auth.updateUser(uid, { disabled: true });
      await auth.revokeRefreshTokens(uid);
      console.log('User disabled and tokens revoked');
    } else if (action === 'enable') {
      await auth.updateUser(uid, { disabled: false });
      console.log('User enabled');
    } else if (action === 'revoke') {
      await auth.revokeRefreshTokens(uid);
      console.log('Refresh tokens revoked for user');
    }

    process.exit(0);
  } catch (err) {
    console.error('Error modifying user:', err);
    process.exit(3);
  }
}

main();
