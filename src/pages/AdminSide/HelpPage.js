// Admin help & support reference: account flows (reauth/reset), troubleshooting, and support link.
import React, { useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';

const styles = {
  page: { padding: 24, maxWidth: 960, margin: '0 auto', color: '#ddd', fontFamily: 'Inter, sans-serif' },
  section: { marginBottom: 20, background: '#151515', padding: 16, borderRadius: 8, border: '1px solid rgba(255,255,255,0.03)' },
  h1: { color: '#ffd54f' },
  h2: { color: '#ffd54f', marginBottom: 8 },
  code: { background: '#0f0f0f', padding: 8, borderRadius: 6 }
};

// Component: Admin help & support reference
export default function HelpPage() {
  const { user } = useContext(AuthContext);

  const supportMailto = () => {
    const subject = encodeURIComponent('Support request - Hair House Admin');
    const bodyLines = [
      `User: ${user?.email || 'unknown'}`,
      `UID: ${user?.uid || 'unknown'}`,
      '',
      'Describe the issue here...'
    ];
    return `mailto:support@hair-house.example?subject=${subject}&body=${encodeURIComponent(bodyLines.join('\n'))}`;
  };

  return (
    <main style={styles.page}>
      <h1 style={styles.h1}>Help & Support</h1>

      <div style={styles.section}>
        <h2 style={styles.h2}>Quick start</h2>
        <p>This dashboard manages stylists, appointments, products and inventory. Use the left navigation to jump to pages. For account actions visit <strong>Account Settings</strong>.</p>
      </div>

      <div style={styles.section}>
        <h2 style={styles.h2}>Change password</h2>
        <ol>
          <li>Open <strong>Account Settings</strong> → Change password</li>
          <li>Enter your <strong>current password</strong> (required for sensitive changes)</li>
          <li>Enter the <strong>new password</strong> twice and click <em>Update password</em></li>
        </ol>
        <p>Forgot the current password? Use <em>“Email reset link”</em> to send a Firebase password reset email to your address.</p>
      </div>

      <div style={styles.section}>
        <h2 style={styles.h2}>Change email</h2>
        <ol>
          <li>Open <strong>My Account</strong> (or Account Settings if separate)</li>
          <li>Enter the new email and click <em>Send verification link</em></li>
          <li>Open the received email and click the link to finalize the change</li>
        </ol>
        <p>If the link expires, resend the verification.</p>
      </div>

      <div style={styles.section}>
        <h2 style={styles.h2}>Name & Profile</h2>
        <p>Your account name is read from the <code style={styles.code}>users</code> collection in Firestore (field <code style={styles.code}>name</code>). If your account data uses a different document structure the app will try to find your record by email as a fallback.</p>
        <p>If the name is wrong, update the <code style={styles.code}>name</code> field in Firestore (or ask support to help merge accounts).</p>
      </div>

      <div style={styles.section}>
        <h2 style={styles.h2}>Troubleshooting / FAQ</h2>
  <h4>Password reset email not received</h4>
  <p>Check Spam/Junk. Confirm the email shown on your Account Settings page. If still missing after a few minutes, resend the reset and verify your network connectivity.</p>
        <h4>Avatar failed to upload</h4>
        <p>Allowed formats: JPG/PNG. Max size: 2MB. If the upload fails repeatedly, try an incognito window and check the browser console for errors to include in your report.</p>
        <h4>Requires recent login</h4>
        <p>This means a sensitive action needs fresh authentication. Re-login or use the Reauthenticate flow when prompted.</p>
      </div>
    </main>
  );
}

