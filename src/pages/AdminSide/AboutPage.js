// About page: surfaces product summary, version/build diagnostics, and reference links.
import React, { useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import packageJson from '../../../package.json';

const styles = {
  page: { padding: 24, maxWidth: 960, margin: '0 auto', color: '#ddd', fontFamily: 'Inter, sans-serif' },
  card: { marginBottom: 20, background: '#151515', padding: 16, borderRadius: 8, border: '1px solid rgba(255,255,255,0.03)' },
  h1: { color: '#ffd54f', marginBottom: 12 },
  small: { color: '#bbb', fontSize: 13 }
};

export default function AboutPage() {
  const { user } = useContext(AuthContext);

  const version = packageJson.version || 'unknown';
  const commitHash = process.env.REACT_APP_COMMIT_HASH || 'unknown';
  const buildTime = process.env.REACT_APP_BUILD_TIME || 'unknown';

  const copyDiagnostics = async () => {
    const payload = {
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
      <h1 style={styles.h1}>About Hair House Admin</h1>

      <section style={styles.card}>
        <h2>Title & one-line summary</h2>
        <p><strong>About Hair House Admin</strong></p>
        <p style={styles.small}>Admin dashboard for managing stylists, appointments, inventory and users.</p>
      </section>

      <section style={styles.card}>
        <h2>Product description</h2>
        <p>Hair House Admin is an internal dashboard built to manage salon operations: appointment schedules, stylist availability, product inventory, and user accounts. It’s built to be fast, mobile-friendly, and easy for salon staff to use.</p>
      </section>

      <section style={styles.card}>
        <h2>Who it’s for / Audience</h2>
        <p>Intended audience: salon admins and stylists with assigned admin or stylist roles. Admins can manage inventory, users and appointments; stylists can view schedules and their assigned appointments.</p>
      </section>

      <section style={styles.card}>
        <h2>Version & build info</h2>
        <p>Version: {version}</p>
        <p>Build: {commitHash}</p>
        <p>Build time: {buildTime}</p>
        <p style={styles.small}>Note: {"{version} comes from package.json; commitHash and buildTime are optional and can be injected at build time via REACT_APP_COMMIT_HASH and REACT_APP_BUILD_TIME."}</p>
      </section>

      <section style={styles.card}>
        <h2>Authors / Maintainers</h2>
        <p>Developed by: [Your Team Name]</p>
        <p>Support: support@yourdomain.example</p>
        <p>Primary contact: [Name] — email</p>
      </section>

      <section style={styles.card}>
        <h2>Partner / Client credit (Castone)</h2>
        <p>Short option: <em>Built for Castone</em></p>
        <p>Longer option: <em>Built for Castone by [Your Company].</em></p>
        <p style={styles.small}>Placement: below the Authors block (or as a small badge next to the title). Check your contract before adding public attributions.</p>
      </section>

      <section style={styles.card}>
        <h2>Data & Privacy summary</h2>
        <p>We store minimal personal data required to operate: email, display name and profile picture (stored in Firestore <code>users</code> collection and Cloud Storage). Activity logs (collection <code>history</code>) keep recent actions for auditing. We do not sell personal data. For more details see the full Privacy Policy at <a href="/privacy">/privacy</a>.</p>
      </section>

      <section style={styles.card}>
        <h2>License & legal</h2>
        <p>License: MIT — see <code>/LICENSE</code></p>
        <p>Or if proprietary: © 2025 Hair House. All rights reserved.</p>
      </section>

      <section style={styles.card}>
        <h2>Diagnostics / Support tools</h2>
        <p>If you’re reporting an issue, click <strong>Copy diagnostics</strong> to copy a short payload (UID, email, userAgent, app version) to include in support tickets.</p>
        <p><em>Only information you authorize will be sent to support.</em></p>
        <button onClick={copyDiagnostics}>Copy diagnostics</button>
      </section>

      <section style={styles.card}>
        <h2>Links & resources</h2>
        <ul>
          <li><a href="/help">Help page</a> — password, email verification & profile docs</li>
          <li><a href="/privacy">Privacy policy</a></li>
          <li><a href="/LICENSE">License</a></li>
          <li><a href="/changelog">Changelog</a> (if available)</li>
        </ul>
      </section>
    </main>
  );
}

