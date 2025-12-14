import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './unAuth/landingpage';
import BookingPage from './features/booking/bookingpage';
import Klientoversigt from './features/booking/Klienter/Klientoversigt';
import Ydelser from './features/booking/Ydelser/ydelser';
import Forloeb from './features/booking/forløb/forløb';
import JournalPage from './features/booking/Journal/JournalPage';
import InvoicesPage from './features/booking/faktura/faktura';
import UserSettings from './features/booking/usersettings';
import Statistik from './features/booking/statistik/statistik';
import SignUp from './SignUp/SignUp';
import SignInPageDemo from './components/ui/sign-in-demo';
import { useAuth } from './AuthContext';
import './App.css';
import PostAuthRedirect from './PostAuthRedirect';
import CustomDashboardChoice from './costum';
import GettingStartedPlaceholder from './GettingStartedPlaceholder';
import NotEstablishedPage from './notestablished/notestablished';
import LaunchPlannerPage from './notestablished/start/start';

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
      <PostAuthRedirect />
    <div className="app-container">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/welcome" element={<CustomDashboardChoice />} />
          <Route path="/getting-started" element={<NotEstablishedPage />} />
          <Route path="/getting-started/start" element={<LaunchPlannerPage />} />
          <Route path="/booking" element={<BookingPage />} />
          <Route path="/journal" element={<JournalPage />} />
          <Route path="/booking/klienter" element={<Klientoversigt />} />
          <Route path="/booking/ydelser" element={<Ydelser />} />
          <Route path="/booking/forloeb" element={<Forloeb />} />
          <Route path="/booking/fakturaer" element={<InvoicesPage />} />
          <Route path="/booking/statistik" element={<Statistik />} />
          <Route path="/booking/settings" element={<UserSettings />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/sign-in-demo" element={<SignInPageDemo />} />
        </Routes>
    </div>
    </Router>
  );
}

export default App;
