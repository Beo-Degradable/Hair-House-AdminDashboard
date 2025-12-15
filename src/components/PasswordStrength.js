import React from 'react';

const scorePassword = (pw) => {
  let score = 0;
  if (!pw) return 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score;
};

const PasswordStrength = ({ password }) => {
  const score = scorePassword(password);
  const pct = Math.min(100, (score / 4) * 100);
  const color = score <= 1 ? '#d32f2f' : score === 2 ? '#f59e0b' : '#16a34a';

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ height: 6, background: '#222', borderRadius: 6, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color }} />
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
        {password ? (score <= 1 ? 'Weak' : score === 2 ? 'Fair' : 'Strong') : 'Enter a password to test strength'}
      </div>
    </div>
  );
};

export default PasswordStrength;
