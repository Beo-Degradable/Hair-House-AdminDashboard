import React, { useEffect, useState } from 'react';

// Digital-style duration picker that looks like a simple digital watch display.
// Props:
// - value: minutes (number)
// - onChange: function(minutes)
// The control shows HH:MM style large digits on a dark panel and +/- buttons
// to increase/decrease minutes (steps default to 15). Users can also type a
// custom minute value into the small input.
export default function DurationClock({ value = 30, onChange = () => {} }) {
  const clamp = (v) => Math.max(1, Math.round(v));

  // Local string input for HH:MM editing. We'll sync when `value` changes.
  const minsToHHMM = (m) => {
    const mm = Number(m) || 0;
    const hh = Math.floor(mm / 60);
    const rem = mm % 60;
    return `${String(hh).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  };

  const parseToMins = (str) => {
    if (!str) return null;
    const s = String(str).trim();
    if (s.includes(':')) {
      const parts = s.split(':').map(p => p.replace(/[^0-9]/g, ''));
      const hh = parseInt(parts[0] || '0', 10);
      const mm = parseInt(parts[1] || '0', 10);
      if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
      return hh * 60 + mm;
    }
    // plain number = minutes
    const n = parseInt(s.replace(/[^0-9]/g, ''), 10);
    if (Number.isNaN(n)) return null;
    return n;
  };

  const [input, setInput] = useState(minsToHHMM(value));

  useEffect(() => {
    // keep input in sync if value changes from parent
    setInput(minsToHHMM(value));
  }, [value]);

  const onInputChange = (e) => {
    const v = e.target.value;
    // allow 0-9 and colon while typing
    if (/^[0-9:]*$/.test(v)) {
      setInput(v);
      const parsed = parseToMins(v);
      if (parsed !== null) {
        onChange(clamp(parsed));
      }
    }
  };

  const onBlurNormalize = () => {
    const parsed = parseToMins(input);
    if (parsed === null) {
      // revert to current value
      setInput(minsToHHMM(value));
      return;
    }
    const c = clamp(parsed);
    setInput(minsToHHMM(c));
    onChange(c);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
      <input
        aria-label="duration hh:mm"
        value={input}
        onChange={onInputChange}
        onBlur={onBlurNormalize}
        placeholder="hh:mm or minutes"
        style={{
          width: '100%',
          maxWidth: 320,
          height: 40,
          padding: '6px 10px',
          borderRadius: 6,
          border: '2px solid #c79a26',
          background: '#000',
          color: '#c79a26',
          fontFamily: 'var(--font-family, Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif)',
          fontSize: 18,
          boxSizing: 'border-box'
        }}
      />
    </div>
  );
}
