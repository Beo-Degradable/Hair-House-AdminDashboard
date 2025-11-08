const functions = require("firebase-functions");
const admin = require("firebase-admin");
const sgMail = require("@sendgrid/mail");
admin.initializeApp();
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

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

  // Callable function to send OTP for account-sensitive actions (e.g., password change)
  exports.sendOtpForAccountAction = functions.https.onCall(async (data, context) => {
    const uid = context.auth && context.auth.uid;
    if (!uid) throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    const action = data.action || 'updatePassword';
    const db = admin.firestore();
    const usersRef = db.collection('users').doc(uid);
    const userDoc = await usersRef.get();
    const user = userDoc.exists ? userDoc.data() : null;
    const email = (user && user.email) || (context.auth.token && context.auth.token.email);
    if (!email) throw new functions.https.HttpsError('failed-precondition', 'User has no email');

    // generate 6-digit code
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(code).digest('hex');
    const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + 5 * 60 * 1000); // 5 minutes

    const otpDocRef = db.collection('accountOtps').doc(`${uid}_${action}`);
    await otpDocRef.set({ codeHash: hash, expiresAt, action, uid, createdAt: admin.firestore.FieldValue.serverTimestamp() });

    // send email with code
    const msg = {
      to: email,
      from: 'noreply@hair-house.example',
      subject: `Your verification code for ${action}`,
      text: `Your verification code is ${code}. It expires in 5 minutes. Do not share this code.`,
      html: `<p>Your verification code is <strong>${code}</strong>. It expires in 5 minutes.</p>`
    };
    try {
      await sgMail.send(msg);
      return { success: true };
    } catch (e) {
      console.error('sendOtp error', e);
      throw new functions.https.HttpsError('internal', 'Failed to send verification email');
    }
  });

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

  // Callable function to verify OTP and perform the requested account action (password update)
  exports.verifyOtpForAccountAction = functions.https.onCall(async (data, context) => {
    const uid = context.auth && context.auth.uid;
    if (!uid) throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    const action = data.action || 'updatePassword';
    const code = String(data.code || '');
    const newPassword = data.newPassword || null;
    if (!code) throw new functions.https.HttpsError('invalid-argument', 'Code required');
    const db = admin.firestore();
    const otpDocRef = db.collection('accountOtps').doc(`${uid}_${action}`);
    const otpSnap = await otpDocRef.get();
    if (!otpSnap.exists) throw new functions.https.HttpsError('not-found', 'No OTP found');
    const otp = otpSnap.data();
    if (otp.expiresAt && otp.expiresAt.toMillis && otp.expiresAt.toMillis() < Date.now()) {
      await otpDocRef.delete();
      throw new functions.https.HttpsError('deadline-exceeded', 'OTP expired');
    }
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(code).digest('hex');
    if (hash !== otp.codeHash) {
      throw new functions.https.HttpsError('permission-denied', 'Invalid code');
    }

    // OTP valid; perform action
    if (action === 'updatePassword') {
      if (!newPassword) throw new functions.https.HttpsError('invalid-argument', 'newPassword required');
      try {
        await admin.auth().updateUser(uid, { password: newPassword });
        // log history
        await db.collection('history').add({ action: 'update', collection: 'users', docId: uid, before: null, after: { passwordChanged: true }, actor: { uid }, timestamp: admin.firestore.FieldValue.serverTimestamp() });
        await otpDocRef.delete();
        return { success: true };
      } catch (e) {
        console.error('verifyOtp updateUser error', e);
        throw new functions.https.HttpsError('internal', 'Failed to update password');
      }
    }

    // unsupported action
    throw new functions.https.HttpsError('invalid-argument', 'Unsupported action');
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
