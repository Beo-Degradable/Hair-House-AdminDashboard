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
