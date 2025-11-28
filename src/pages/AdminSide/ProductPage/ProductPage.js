// Product listing: realtime table with simple search.
import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../../firebase';
import { sanitizeForSearch } from '../../../utils/validators';

const ProductCard = ({ p, cardFontSize = 14 }) => {
  const size = typeof cardFontSize === 'number' ? `${cardFontSize}px` : cardFontSize;
  return (
    <div className="hh-product-card" style={{ ['--card-font-size']: size }}>
      <div className="hh-product-card__title">{p.name}</div>
      <div className="hh-product-card__row">
        <div>Price</div>
        <div className="hh-product-card__value">₱{Number(p.price || 0).toFixed(2)}</div>
      </div>
      <div className="hh-product-card__row">
        <div>Quantity</div>
        <div className="hh-product-card__value">{p.quantity ?? 0}</div>
      </div>
    </div>
  );
};

const localStyles = `
.hh-product-page {}
.hh-product-header { text-align: left; }
.hh-product-header h2 { margin: 0; }
.hh-product-search { display: flex; gap: 12px; align-items: center; margin-bottom: 16px; }
.hh-product-search input { padding: 8px; border-radius: 8px; border: 1px solid var(--border-main); width: 360px; max-width: 100%; }
.hh-product-table { width: 100%; border-collapse: collapse; margin-top: 12px; }
.hh-product-table th, .hh-product-table td { padding: 10px 12px; border-bottom: 1px solid var(--border-main); text-align: left; }
.hh-product-table th { background: transparent; color: var(--muted); font-weight: 600; }
.hh-product-table tr:hover { background: rgba(0,0,0,0.02); }
.hh-product-no-results { color: #6b7280; padding: 24px 0; }
`;

const paddingToStyle = (pad) => {
  if (pad == null) return {};
  if (typeof pad === 'number' || typeof pad === 'string') return { padding: pad };
  const { top = 0, right = 0, bottom = 0, left = 0 } = pad;
  return { paddingTop: top, paddingRight: right, paddingBottom: bottom, paddingLeft: left };
};
const ProductPage = ({
  containerPadding = 24,
  headerPadding = { top: 8, right: 8, bottom: 24, left: 8 },
  headerPaddingTop,
  headerPaddingRight,
  headerPaddingBottom,
  headerPaddingLeft,
  headerFontSize = 26,
  cardFontSize = 14,
  collectionName = 'products',
  title
}) => {
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [highlightedId, setHighlightedId] = useState(null);
  const rowRefs = useRef(new Map());
  const location = useLocation();

  useEffect(() => {
    const col = collection(db, collectionName);
    const unsub = onSnapshot(col, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setProducts(list);
      setLoading(false);
    }, err => {
      console.error(`${collectionName} listener error`, err);
      setLoading(false);
    });
    return () => unsub();
  }, [collectionName]);

  // When route has ?id=..., highlight and scroll to that product
  useEffect(() => {
    if (!products || products.length === 0) return;
    try {
      const params = new URLSearchParams(location.search || '');
      const id = params.get('id');
      if (!id) return;
      const exists = products.find(p => p.id === id);
      if (!exists) return;
      setHighlightedId(id);
      // scroll into view (find the row element)
      const el = rowRefs.current.get(id);
      if (el && typeof el.scrollIntoView === 'function') {
        setTimeout(() => {
          try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { el.scrollIntoView(); }
        }, 60);
      }
      // remove highlight after a few seconds
      const clearTimeoutId = setTimeout(() => setHighlightedId(null), 6000);
      return () => clearTimeout(clearTimeoutId);
    } catch (e) {
      // ignore
    }
  }, [location.search, products]);

  const filtered = products.filter(p => (p.name || '').toLowerCase().includes(query.toLowerCase()));

  // allow per-side overrides; if any per-side prop is provided use those values
  const headerPadSource = (headerPaddingTop !== undefined || headerPaddingRight !== undefined || headerPaddingBottom !== undefined || headerPaddingLeft !== undefined)
    ? { top: headerPaddingTop ?? 0, right: headerPaddingRight ?? 0, bottom: headerPaddingBottom ?? 0, left: headerPaddingLeft ?? 0 }
    : headerPadding;

  const headerLabel = title ?? (typeof collectionName === 'string' ? collectionName.replace(/(^|\-|_)(\w)/g, s => s.toUpperCase()).replace(/[-_]/g, ' ') : 'Products');

  return (
    <>
      <style>{localStyles}</style>
      <div className="hh-product-page" style={{ padding: containerPadding }}>
        <div className="hh-product-header" style={{ ...paddingToStyle(headerPadSource) }}>
          <h2 style={{ fontSize: typeof headerFontSize === 'number' ? `${headerFontSize}px` : headerFontSize }}>Products</h2>
        </div>

        <div className="hh-product-search">
          <input value={query} onChange={(e) => setQuery(sanitizeForSearch(e.target.value))} placeholder="Search products" />
          <div style={{ marginLeft: 'auto', color: 'var(--muted)', fontSize: 13 }} />
          {loading ? <div style={{ marginLeft: 12 }}>Loading…</div> : null}
        </div>

        {(!loading && filtered.length === 0) ? (
          <div className="hh-product-no-results">No products found.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="hh-product-table">
              <thead>
                <tr>
                  <th style={{ minWidth: 220 }}>Name</th>
                  <th style={{ width: 160 }}>Brand</th>
                  <th style={{ width: 160 }}>Category</th>
                  <th style={{ width: 120 }}>Unit</th>
                  <th style={{ width: 120 }}>Price</th>
                  <th style={{ width: 120 }}>Quantity</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr
                    key={p.id}
                    ref={(el) => { if (el) rowRefs.current.set(p.id, el); }}
                    style={highlightedId === p.id ? { background: 'rgba(202,169,10,0.12)', boxShadow: 'inset 4px 0 0 0 rgba(202,169,10,0.9)' } : {}}
                  >
                    <td>{p.name}</td>
                    <td>{p.brand || p.manufacturer || '-'}</td>
                    <td>{p.category || p.type || '-'}</td>
                    <td>{p.unit || p.uom || '-'}</td>
                    <td>{typeof p.price === 'number' ? `₱${p.price.toFixed(2)}` : (p.price ? `₱${Number(p.price).toFixed(2)}` : '₱0.00')}</td>
                    <td>{p.quantity ?? p.qty ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
};

export default ProductPage;
