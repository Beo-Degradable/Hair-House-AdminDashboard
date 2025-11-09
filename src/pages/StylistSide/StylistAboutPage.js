import React, { useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import packageJson from '../../../package.json';

// StylistAboutPage — role-scoped about & diagnostics

const styles = {
  page: { padding: 24, maxWidth: 960, margin: '0 auto', color: 'var(--text-main)' },
  card: { marginBottom: 20, background: 'var(--bg-drawer)', padding: 16, borderRadius: 8, border: '1px solid var(--border-main)' },
  h1: { color: 'var(--text-main)', marginBottom: 12 },
  small: { color: 'var(--icon-main)', fontSize: 13 }
};

export default function StylistAboutPage() {
  const { user } = useContext(AuthContext);

  const version = packageJson.version || 'unknown';
  const commitHash = process.env.REACT_APP_COMMIT_HASH || 'unknown';
  const buildTime = process.env.REACT_APP_BUILD_TIME || 'unknown';

  const copyDiagnostics = async () => {
    const payload = {
      role: 'stylist',
      uid: user?.uid || null,
      email: user?.email || null,
      userAgent: navigator.userAgent,
      version,
      commitHash,
      buildTime,
      timestamp: new Date().toISOString()
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      alert('Diagnostics copied to clipboard');
    } catch (e) {
      console.error('copy failed', e);
      alert('Failed to copy diagnostics');
    }
  };

  return (
    <main style={styles.page}>
      <h1 style={styles.h1}>About Hair House — Stylist</h1>

      <section style={styles.card}>
        <h2>What this is</h2>
        <p>A focused portal for stylists: manage your day, view appointments, and update statuses quickly.</p>
      </section>

      <section style={styles.card}>
        <h2>How it helps</h2>
        <p>Keep your queue clear. When you mark appointments complete, revenue and inventory can update behind the scenes.</p>
      </section>

      <section style={styles.card}>
        <h2>Version & build</h2>
        <p>Version: {version}</p>
        <p>Build: {commitHash}</p>
        <p>Build time: {buildTime}</p>
        <p style={styles.small}>Commit and time can be injected at build time via environment variables.</p>
      </section>

      <section style={styles.card}>
        <h2>Support</h2>
        <p>If you’re reporting an issue, click <strong>Copy diagnostics</strong> and include it in your message to support.</p>
        <button onClick={copyDiagnostics}>Copy diagnostics</button>
      </section>
    </main>
  );
}
