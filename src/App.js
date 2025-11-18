import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './unAuth/landingpage';
import BookingPage from './features/booking/bookingpage';
import Klientoversigt from './features/booking/Klienter/Klientoversigt';
import Ydelser from './features/booking/Ydelser/ydelser';
import './App.css';

function App() {
  return (
    <Router>
    <div className="app-container">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/booking" element={<BookingPage />} />
          <Route path="/booking/klienter" element={<Klientoversigt />} />
          <Route path="/booking/ydelser" element={<Ydelser />} />
        </Routes>
    </div>
    </Router>
  );
}

export default App;
