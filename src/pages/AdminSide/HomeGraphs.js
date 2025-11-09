import React from 'react';
import RevenueWidget from '../../components/RevenueWidget';

// HomeGraphs — render the revenue graph (KPI tiles live elsewhere)
const HomeGraphs = ({ branch = null }) => {
  return (
    <div style={{ display: 'block', gap: 16 }}>
      <RevenueWidget branch={branch} period="daily" mode="graph" />
    </div>
  );
};

export default HomeGraphs;
