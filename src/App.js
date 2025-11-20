import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './unAuth/landingpage';
import BookingPage from './features/booking/bookingpage';
import Klientoversigt from './features/booking/Klienter/Klientoversigt';
import Ydelser from './features/booking/Ydelser/ydelser';
import SignUp from './SignUp';
import { useAuth } from './AuthContext';
import './App.css';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="route-loader">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/signup" replace />;
  }

  return children;
}

function App() {
  return (
    <Router>
    <div className="app-container">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/booking" element={<BookingPage />} />
          <Route path="/booking/klienter" element={<Klientoversigt />} />
          <Route path="/booking/ydelser" element={<Ydelser />} />
          <Route path="/signup" element={<SignUp />} />
        </Routes>
    </div>
    </Router>
  );
}

export default App;
