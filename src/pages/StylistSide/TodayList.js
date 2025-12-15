import React from 'react';
import BookingWidget from '../../components/BookingWidget';

const TodayList = () => {
  return (
    <div style={{ padding: 16 }}>
      <h2>Today's Appointments</h2>
      <p style={{ color: 'var(--muted, #666)' }}>A quick view of today's bookings. Use the BookingWidget for interactive controls.</p>
      <div style={{ marginTop: 12 }}>
        <BookingWidget />
      </div>
    </div>
  );
};

export default TodayList;
