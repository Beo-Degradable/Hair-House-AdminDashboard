// Lightweight validators used across the app
// Keep these small and deterministic so they can be used both onChange and onSubmit.

export function isValidName(value) {
  if (!value) return false;
  // allow unicode letters, spaces, hyphen and apostrophe
  return /^[\p{L}'\-\s]+$/u.test(String(value).trim());
}

export function sanitizeName(value) {
  if (!value) return '';
  return String(value).replace(/[^\p{L}'\-\s]/gu, '').trim();
}

export function isValidEmail(value) {
  if (!value) return false;
  const v = String(value).trim();
  // simple email regex allowing common characters including +._- and @
  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(v);
}

export function isValidNumeric(value) {
  if (value === undefined || value === null) return false;
  return /^\d+$/.test(String(value));
}

export function isValidPassword(value, minLen = 6) {
  if (!value) return false;
  return String(value).length >= minLen;
}

export function stripSpecialExceptEmail(value) {
  if (!value) return '';
  // allow characters used in typical emails
  return String(value).replace(/[^A-Za-z0-9@._%+\-]/g, '');
}

export function sanitizeForSearch(value) {
  if (!value) return '';
  // allow letters, numbers, spaces, hyphen and apostrophe for search queries
  return String(value).replace(/[^\p{L}0-9\s'\-]/gu, '').trim();
}

export default {
  isValidName,
  sanitizeName,
  isValidEmail,
  isValidNumeric,
  isValidPassword,
  stripSpecialExceptEmail,
  sanitizeForSearch,
};

// validateForm is exported where defined above

// Validate a whole form element based on heuristics from input names and types.
export function validateForm(formEl) {
  if (!formEl || typeof formEl.elements === 'undefined') return { ok: true };
  const els = Array.from(formEl.elements).filter(e => e.name || e.tagName === 'SELECT' || e.tagName === 'TEXTAREA');
  for (const el of els) {
    const name = (el.name || '').toLowerCase();
    const type = (el.type || '').toLowerCase();
    const val = el.value;
    if (type === 'hidden' || el.disabled) continue;
    // If element has data-validate attribute, skip heuristics (assume custom validation)
    if (el.getAttribute && el.getAttribute('data-validate') === 'false') continue;

    if (name.includes('email') || type === 'email') {
      if (!isValidEmail(val)) return { ok: false, field: el.name || name, message: 'Invalid email' };
      continue;
    }

    if (name.includes('password') || type === 'password') {
      if (!isValidPassword(val)) return { ok: false, field: el.name || name, message: 'Password too short' };
      continue;
    }

    if (name.includes('name')) {
      if (!isValidName(val)) return { ok: false, field: el.name || name, message: 'Invalid name' };
      continue;
    }

    if (name.includes('phone') || name.includes('tel') || name.includes('qty') || name.includes('count') || name.includes('number') || type === 'number') {
      if (!isValidNumeric(val)) return { ok: false, field: el.name || name, message: 'Must be a number' };
      continue;
    }

    // default: reject control characters and many special symbols, allow basic punctuation and spaces
    if (typeof val === 'string') {
      // allow @ . _ + - for emails (already handled), allow : / for urls, otherwise remove control chars
      const bad = /[<>\{\}\[\]~`$%^*\\|<>]/;
      if (bad.test(val)) return { ok: false, field: el.name || name, message: 'Invalid characters present' };
    }
  }
  return { ok: true };
}
