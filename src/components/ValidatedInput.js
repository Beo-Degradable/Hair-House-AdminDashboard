import React from 'react';

// A small controlled input that normalizes number and text input values
// Props:
// - type: 'text'|'number' (defaults to 'text')
// - value: string|number
// - onChange: receives the cleaned value (string for text/number inputs to keep callers consistent)
// - integer: boolean (if true, strips decimals)
// - allowNegative: boolean (if false, strips '-')
// - min, max: numeric bounds (applied when possible)
// - placeholder, style, className, ...rest
export default function ValidatedInput({
	type = 'text',
	value = '',
	onChange,
	integer = false,
	allowNegative = false,
	min,
	max,
	placeholder,
	style,
	className,
	...rest
}) {
	const handleChange = (e) => {
		let v = e.target.value;

		if (type === 'number') {
			// allow clearing
			if (v === '') {
				onChange && onChange('');
				return;
			}

			// remove any characters except digits, dot and minus
			v = String(v).replace(/[^0-9.\-]/g, '');
			if (!allowNegative) v = v.replace(/-/g, '');

			// if integer requested, drop decimals
			if (integer) {
				// keep leading minus if present
				const neg = v.startsWith('-') ? '-' : '';
				const digits = v.replace(/[^0-9]/g, '');
				v = (digits.length === 0) ? '' : (neg + digits);
			}

			// coerce to number for bounds checking
			const n = Number(v);
			if (!Number.isNaN(n)) {
				if (min !== undefined && n < min) {
					onChange && onChange(String(min));
					return;
				}
				if (max !== undefined && n > max) {
					onChange && onChange(String(max));
					return;
				}
			}

			onChange && onChange(String(v));
			return;
		}

		// default: text
		onChange && onChange(v);
	};

	// keep the value controlled as string for consistency with existing code
	const inputValue = value === null || value === undefined ? '' : String(value);

	return (
		<input
			{...rest}
			type={type === 'number' ? 'text' : type}
			value={inputValue}
			onChange={handleChange}
			placeholder={placeholder}
			style={style}
			className={className}
		/>
	);
}
