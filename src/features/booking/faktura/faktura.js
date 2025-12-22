import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import '../bookingpage.css';
import FakturaerLayout from './FakturaerLayout';
import DailySalesOverview from './DailySalesOverview';
import Appointments from './Appointments';
import Sales from './Sales';
import Payments from './Payments';

function FakturaerPage() {
  return (
    <FakturaerLayout>
      <Routes>
        <Route index element={<DailySalesOverview />} />
        <Route path="aftaler" element={<Appointments />} />
        <Route path="salg" element={<Sales />} />
        <Route path="betalinger" element={<Payments />} />
        <Route path="*" element={<Navigate to="/booking/fakturaer" replace />} />
      </Routes>
    </FakturaerLayout>
  );
}

export default FakturaerPage;
