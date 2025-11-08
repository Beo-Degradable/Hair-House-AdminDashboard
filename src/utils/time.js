export function parseDurationToMinutes(s) {
  if (!s) return 60;
  const str = String(s).trim().toLowerCase();
  // common forms: '30m', '1h', '90', '1 hr 30 min'
  let m = str.match(/^(\d+)\s*([smh])$/i);
  if (m) {
    const v = Number(m[1]);
    const unit = m[2].toLowerCase();
    if (unit === 'h') return v * 60;
    if (unit === 'm') return v;
    if (unit === 's') return Math.ceil(v / 60);
  }
  m = str.match(/^(\d+)$/);
  if (m) return Number(m[1]);
  // fallback: try extract numbers
  const num = str.match(/(\d+)/);
  if (num) return Number(num[1]);
  return 60;
}

export function formatMinutes(mins) {
  const m = Number(mins) || 0;
  if (m % 60 === 0) return `${m / 60} hr${m / 60 > 1 ? 's' : ''}`;
  if (m > 60) return `${Math.floor(m / 60)} hr ${m % 60} min`;
  return `${m} min`;
}
