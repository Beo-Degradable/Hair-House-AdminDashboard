import React, { useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';

const styles = {
  page: { padding: 24, maxWidth: 960, margin: '0 auto', color: '#ddd', fontFamily: 'Inter, sans-serif' },
  section: { marginBottom: 20, background: '#151515', padding: 16, borderRadius: 8, border: '1px solid rgba(255,255,255,0.03)' },
  h1: { color: '#ffd54f' },
  h2: { color: '#ffd54f', marginBottom: 8 },
  code: { background: '#0f0f0f', padding: 8, borderRadius: 6 }
};

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
        <h2 style={styles.h2}>Change password (OTP)</h2>
        <ol>
          <li>Open Account Settings → Change password</li>
          <li>Enter new password and confirm</li>
          <li>Click <em>Send OTP</em>. A single-use code will be emailed to your registered address.</li>
          <li>Enter the OTP and click <em>Verify & Save</em>.</li>
        </ol>
        <p>If you do not receive the OTP: check Spam/Junk, confirm the email shown on Account Settings, wait 60s then resend. If problems persist, contact support below.</p>
      </div>

      <div style={styles.section}>
        <h2 style={styles.h2}>Name & Profile</h2>
        <p>Your account name is read from the <code style={styles.code}>users</code> collection in Firestore (field <code style={styles.code}>name</code>). If your account data uses a different document structure the app will try to find your record by email as a fallback.</p>
        <p>If the name is wrong, update the <code style={styles.code}>name</code> field in Firestore (or ask support to help merge accounts).</p>
      </div>

      <div style={styles.section}>
        <h2 style={styles.h2}>Troubleshooting / FAQ</h2>
        <h4>OTP not received</h4>
        <p>Check Spam/Junk. Confirm the email shown on your Account Settings page. Wait 60 seconds then resend the OTP. Include a screenshot and time when contacting support.</p>
        <h4>Avatar failed to upload</h4>
        <p>Allowed formats: JPG/PNG. Max size: 2MB. If the upload fails repeatedly, try an incognito window and check the browser console for errors to include in your report.</p>
        <h4>Requires recent login</h4>
        <p>This means a sensitive action needs fresh authentication. Re-login or use the Reauthenticate flow when prompted.</p>
      </div>
    </main>
  );
}

