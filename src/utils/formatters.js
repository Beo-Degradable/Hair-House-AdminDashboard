export function timeAgo(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export function formatCurrency(n) {
  if (typeof n !== 'number') return '-';
  // Display Philippine Peso symbol
  return '₱' + n.toFixed(2);
}

export function formatStatus(status) {
  if (status == null) return '';
  const s = String(status).trim();
  if (!s) return '';
  // normalize common internal keys by replacing underscores with spaces
  const low = s.replace(/_/g, ' ').toLowerCase();

  // known mappings
  const map = {
    'pending cancel': 'pending cancellation',
    'pending_cancel': 'pending cancellation',
    'cancel requested': 'cancellation requested',
    'cancel_requested': 'cancellation requested',
    'in progress': 'in progress',
    'in-progress': 'in progress'
  };
  if (map[low]) return map[low];

  // fallback: title case the words
  return low.split(' ').filter(Boolean).map(w => w[0]?.toUpperCase() + w.slice(1)).join(' ');
}

export default { timeAgo, formatCurrency };
