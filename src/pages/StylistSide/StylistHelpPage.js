import React, { useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';

const styles = {
  page: { padding: 24, maxWidth: 960, margin: '0 auto', color: 'var(--text-main)' },
  section: { marginBottom: 20, background: 'var(--bg-drawer)', padding: 16, borderRadius: 8, border: '1px solid var(--border-main)' },
  h1: { color: 'var(--text-main)' },
  h2: { color: 'var(--text-main)', marginBottom: 8 },
  code: { background: 'var(--bg-main)', padding: 8, borderRadius: 6 }
};

// StylistHelpPage — support reference for stylist workflows
export default function StylistHelpPage() {
  const { user } = useContext(AuthContext);

  // Build mailto link with basic user context
  const supportMailto = () => {
    const subject = encodeURIComponent('Support request - Hair House Stylist');
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
        <p>Use <strong>Today</strong> for your current-day appointments and walk-ins. Use <strong>Appointments</strong> to view and update other dates. Mark finished services promptly so inventory and revenue are accurate.</p>
      </div>

      <div style={styles.section}>
        <h2 style={styles.h2}>Change password</h2>
        <ol>
          <li>Open <strong>My Account</strong> → Change Password</li>
          <li>Enter your <strong>current password</strong> to re-authenticate</li>
          <li>Enter the <strong>new password</strong> twice and click <em>Update Password</em></li>
        </ol>
        <p>Forgot your current password? Click <em>“Email me a reset link”</em> to receive a password reset email.</p>
      </div>

      <div style={styles.section}>
        <h2 style={styles.h2}>Change email</h2>
        <ol>
          <li>Open <strong>My Account</strong> → Change Email</li>
          <li>Enter the <strong>new email</strong> and click <em>Send verification link</em></li>
          <li>Open the email and click the link to confirm. Your sign-in email updates after the link is opened.</li>
        </ol>
      </div>

      <div style={styles.section}>
        <h2 style={styles.h2}>Name, Avatar & Profile</h2>
        <p>Your display name and avatar live in the <code style={styles.code}>users</code> document for your account. Update them on <strong>My Account</strong>. If your name/photo doesn't update, sign out and back in.</p>
      </div>

      <div style={styles.section}>
        <h2 style={styles.h2}>Troubleshooting / FAQ</h2>
        <h4>Appointments not updating</h4>
        <p>Refresh the page. Check your network connection. If you still see old data, try signing out and back in.</p>
        <h4>Avatar failed to upload</h4>
        <p>Allowed formats: JPG/PNG. Try a smaller file (&lt;2MB). Use an incognito window to rule out extensions.</p>
        <h4>Requires recent login</h4>
        <p>Some actions need fresh authentication. Re-login if prompted.</p>
      </div>

      <div style={styles.section}>
        <h2 style={styles.h2}>Contact support</h2>
        <p><a href={supportMailto()}>Email support</a> — include screenshots and what steps you tried.</p>
      </div>
    </main>
  );
}
