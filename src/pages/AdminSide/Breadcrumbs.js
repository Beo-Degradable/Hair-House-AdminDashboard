// Breadcrumbs component: renders navigation trail from items [{label,to}] with truncation.
import React from 'react';
import { Link } from 'react-router-dom';
const Breadcrumbs = ({ items = [] }) => {
	if (!items.length) return null;
	return (
		<nav aria-label="Breadcrumb" style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
			<ol style={{ display: 'flex', gap: 8, listStyle: 'none', padding: 0, margin: 0, alignItems: 'center', flexWrap: 'nowrap', overflow: 'hidden' }}>
				{items.map((it, idx) => (
					<li key={idx} style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
						{idx !== 0 && <span style={{ margin: '0 6px', opacity: 0.6 }}>›</span>}
						{it.to ? (
							<Link to={it.to} style={{ color: 'var(--text-secondary)', textDecoration: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }}>
								{it.label}
							</Link>
						) : (
							<span style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }}>{it.label}</span>
						)}
					</li>
				))}
			</ol>
		</nav>
	);
};

export default Breadcrumbs;
