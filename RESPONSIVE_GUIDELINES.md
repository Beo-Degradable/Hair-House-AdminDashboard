Responsive development guideline for Hair House Admin Dashboard

Purpose
- Ensure every code change that affects layout is responsive by default.

Rules (apply to UI code and PRs)
1. Mobile-first: write styles for narrow screens first, then layer up for larger breakpoints.
2. Use CSS variables for design tokens: colors, spacing, radii, sizes.
3. Prefer flexible layout primitives: CSS Grid and Flexbox with minmax(0, 1fr).
4. Avoid hard-coded widths; use max-width and min-width sparingly.
5. For tables, provide a responsive wrapper with overflow-x: auto and use table-layout: fixed on small screens to enable text-overflow.
6. For long text, use text-overflow: ellipsis + title attribute for full value.
7. All button sizes and input heights must use design tokens (e.g., --input-height).
8. Validate component in 3 sizes before merging: 360px (phone), 768px (tablet), 1366px (desktop).

Utility CSS classes (available in src/index.css)
- .container: centers content with sensible max-width and padding.
- .row / .col: flex helpers for quick layout.
- .truncate: apply ellipsis truncation.
- .users-table-wrap: responsive table wrapper with horizontal scroll.

Testing checklist for PRs
- Run the app and verify the affected pages at 360px, 768px, 1366px.
- Check keyboard-only interaction and basic focus states.
- Check overflow and truncation behavior for long values.

If you'd like, I can also add a small lint rule or pre-commit hook to remind contributors to run a responsive check.