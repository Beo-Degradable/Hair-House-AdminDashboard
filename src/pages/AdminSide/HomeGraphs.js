import React from 'react';
import RevenueWidget from '../../components/RevenueWidget';

// HomeGraphs: show revenue graph only to avoid duplicating KPI tiles above.
const HomeGraphs = ({ branch = null }) => {
  return (
    <div style={{ display: 'block', gap: 16 }}>
      <RevenueWidget branch={branch} period="daily" mode="graph" />
    </div>
  );
};

export default HomeGraphs;
