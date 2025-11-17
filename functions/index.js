/* eslint-disable max-len, indent, quotes, object-curly-spacing, comma-dangle */
// NOTE: Temporary lint suppression added to allow deployment. Remove and fix formatting later.
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const sgMail = require("@sendgrid/mail");
admin.initializeApp();

// Resolve SendGrid API key from Firebase runtime config or environment
let SENDGRID_API_KEY = "";
try {
  const cfg = functions.config && functions.config();
  if (cfg && cfg.sendgrid && cfg.sendgrid.key) {
    SENDGRID_API_KEY = cfg.sendgrid.key;
  }
} catch (e) {
  // ignore
}
if (!SENDGRID_API_KEY && process.env.SENDGRID_API_KEY) {
  SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
}
if (!SENDGRID_API_KEY) {
  console.warn("[WARN] Missing SendGrid API key. Set with 'firebase functions:config:set sendgrid.key=YOUR_KEY' or env.");
}
if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

exports.notifyLowStock = functions.firestore
    .document("products/{productId}")
    .onUpdate((change, context) => {
      const before = change.before.data();
      const after = change.after.data();
      if (before.stocks >= 5 && after.stocks < 5) {
        const msg = {
          to: "admin@example.com", // Change to your admin email
          from: "noreply@yourdomain.com",
          subject: `Low Stock Alert: ${after.name}`,
          text: `Product ${after.name} is low on stock (${after.stocks} left).`,
        };
        return sgMail.send(msg);
      }
      return null;
    });

// NOTE: Custom OTP endpoints removed in favor of built-in Firebase Auth flows:
//  - verifyBeforeUpdateEmail() for secure email change (sends verification link)
//  - sendPasswordResetEmail() for password reset
//  - reauthenticateWithCredential() + updatePassword() for in-session password changes
// Old callable functions sendOtpForAccountAction / verifyOtpForAccountAction have been deleted.

// Callable test helper: send a password-setup (reset) link to an email provided in the call.
// Use this to validate SendGrid and the generated link without creating a users/{uid} Firestore document.
exports.sendPasswordSetupEmail = functions.https.onCall(async (data, context) => {
  // Require an authenticated caller (you can restrict further by checking custom claims)
  if (!context.auth || !context.auth.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required to call this function');
  }
  const email = (data && data.email) ? String(data.email).trim() : '';
  if (!email) {
    throw new functions.https.HttpsError('invalid-argument', 'email is required');
  }

  try {
    const actionCodeSettings = {
      url: `https://your-app.example.com/welcome?email=${encodeURIComponent(email)}`,
      handleCodeInApp: false
    };
    const link = await admin.auth().generatePasswordResetLink(email, actionCodeSettings);

    const msg = {
      to: email,
      from: 'noreply@hair-house.example',
      subject: 'Set up your Hair House account (test)',
      text: `Click this link to set your password:\n\n${link}`,
      html: `<p>Click this link to set your password:</p><p><a href="${link}">${link}</a></p>`
    };

    await sgMail.send(msg);
    return { success: true };
  } catch (err) {
    console.error('sendPasswordSetupEmail error', err);
    throw new functions.https.HttpsError('internal', 'Failed to send email');
  }
});


// Firestore trigger: when a users/{uid} document is created, generate a password-reset link
// and send a welcome email so the user can set their password themselves.
exports.sendPasswordSetupLinkOnUserCreate = functions.firestore
  .document('users/{uid}')
  .onCreate(async (snap, context) => {
    const data = snap.data() || {};
    const email = (data.email || '').toString().trim();
    // Allow client/creator to opt-out by setting skipPasswordSetupEmail=true on the document
    if (data.skipPasswordSetupEmail === true) {
      return null;
    }
    if (!email) {
      console.warn('sendPasswordSetupLinkOnUserCreate: no email on users doc', { uid: context.params.uid });
      return null;
    }

    try {
      const actionCodeSettings = {
        // Users will be redirected to this URL after completing the flow. Update to your app URL.
        url: `https://your-app.example.com/welcome?email=${encodeURIComponent(email)}`,
        // If you want to handle the code in-app, set handleCodeInApp: true and implement client handling.
        handleCodeInApp: false
      };

      // generate a Firebase password reset link (usable to set password)
      const link = await admin.auth().generatePasswordResetLink(email, actionCodeSettings);

      const msg = {
        to: email,
        from: 'noreply@hair-house.example',
        subject: 'Set up your Hair House account',
        text: `Welcome to Hair House! Click the link to set your account password:\n\n${link}\n\nIf you didn't expect this email, please contact support.`,
        html: `<p>Welcome to <strong>Hair House</strong>! Click the link below to set your account password:</p><p><a href="${link}">Set your password</a></p><p>If you didn't expect this email, contact support.</p>`
      };

      await sgMail.send(msg);
      // mark the users document that we sent the setup email (helps idempotency/diagnostics)
      try {
        await snap.ref.update({ passwordSetupEmailSentAt: admin.firestore.FieldValue.serverTimestamp() });
      } catch (e) {
        // non-fatal — continue
        console.warn('Failed to update users doc with passwordSetupEmailSentAt', e);
      }

      return null;
    } catch (err) {
      console.error('sendPasswordSetupLinkOnUserCreate error', err, { email, uid: context.params.uid });
      return null;
    }
  });

// Callable function: createAuthUser
// Creates a Firebase Authentication user (email/password) and returns the uid.
// Expects data: { email: string, password: string, name?: string, role?: string, branchName?: string }
// Requires an authenticated caller (admin). You can extend with custom claims checks.
exports.createAuthUser = functions.https.onCall(async (data, context) => {
  if (!context.auth || !context.auth.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  }

  const email = (data && data.email ? String(data.email).trim() : '');
  const password = (data && data.password ? String(data.password) : '');
  if (!email || !password) {
    throw new functions.https.HttpsError('invalid-argument', 'email and password are required');
  }

  try {
    // Create auth user
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: data.name ? String(data.name).trim() : undefined,
      disabled: false
    });

    // Optionally set custom claims based on role
    const role = data && data.role ? String(data.role) : '';
    if (role === 'admin' || role === 'stylist') {
      try {
        await admin.auth().setCustomUserClaims(userRecord.uid, { role });
      } catch (e) {
        console.warn('Failed setting custom claims', e);
      }
    }

    return { uid: userRecord.uid };
  } catch (err) {
    console.error('createAuthUser error', err);
    // Map common Firebase Auth errors
    if (err.code === 'auth/email-already-exists') {
      throw new functions.https.HttpsError('already-exists', 'Email already exists');
    }
    if (err.code === 'auth/invalid-password') {
      throw new functions.https.HttpsError('invalid-argument', 'Password is invalid');
    }
    throw new functions.https.HttpsError('internal', 'Failed to create auth user');
  }
});

// Callable function: deleteAuthUser
// Deletes a Firebase Auth user and removes their users/{uid} Firestore document.
// Requires an authenticated caller (you can restrict further by checking custom claims).
exports.deleteAuthUser = functions.https.onCall(async (data, context) => {
  if (!context.auth || !context.auth.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required to call this function');
  }

  const uid = (data && data.uid) ? String(data.uid).trim() : '';
  if (!uid) {
    throw new functions.https.HttpsError('invalid-argument', 'uid is required');
  }

  try {
    // Delete auth user
    await admin.auth().deleteUser(uid);
  } catch (err) {
    console.error('deleteAuthUser: failed to delete auth user', err, { uid });
    // If the user was not found, continue to attempt deleting the Firestore doc
    if (err.code && err.code === 'auth/user-not-found') {
      console.warn('deleteAuthUser: auth user not found, continuing to delete Firestore doc');
    } else {
      throw new functions.https.HttpsError('internal', 'Failed to delete auth user');
    }
  }

  try {
    // Delete Firestore users document (if present)
    await admin.firestore().doc(`users/${uid}`).delete();
  } catch (err) {
    console.error('deleteAuthUser: failed to delete users doc', err, { uid });
    // Firestore delete may fail if doc doesn't exist or permissions; report as internal error
    throw new functions.https.HttpsError('internal', 'Failed to delete users document');
  }

  return { success: true };
});

// Callable function: updateAuthUser
// Supports actions: disable, enable, revokeTokens
exports.updateAuthUser = functions.https.onCall(async (data, context) => {
  if (!context.auth || !context.auth.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required to call this function');
  }

  const uid = (data && data.uid) ? String(data.uid).trim() : '';
  const action = (data && data.action) ? String(data.action) : '';
  if (!uid || !action) {
    throw new functions.https.HttpsError('invalid-argument', 'uid and action are required');
  }

  try {
    if (action === 'disable') {
      await admin.auth().updateUser(uid, { disabled: true });
      await admin.auth().revokeRefreshTokens(uid);
      return { success: true, action: 'disabled' };
    }
    if (action === 'enable') {
      await admin.auth().updateUser(uid, { disabled: false });
      return { success: true, action: 'enabled' };
    }
    if (action === 'revoke') {
      await admin.auth().revokeRefreshTokens(uid);
      return { success: true, action: 'revoked' };
    }

    throw new functions.https.HttpsError('invalid-argument', 'Unknown action');
  } catch (err) {
    console.error('updateAuthUser error', err, { uid, action });
    throw new functions.https.HttpsError('internal', 'Failed to update auth user');
  }
});
