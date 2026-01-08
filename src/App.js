import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import LandingPage from './unAuth/landingpage';
import AgentPage from './features/agent/AgentPage';
import WebsiteBuilderPage from './unAuth/website-builder';
import IntelligentBookingPage from './unAuth/intelligent-booking';
import OperationsPage from './unAuth/operations';
import TranscriptionFactsrPage from './unAuth/transcription-factsr';
import SelmaCopilotPage from './unAuth/selma-copilot';
import BookingPage from './features/booking/bookingpage';
import Klientoversigt from './features/booking/Klienter/Klientoversigt';
import Ydelser from './features/booking/Ydelser/ydelser';
import Forloeb from './features/booking/forløb/forløb';
import Product from './features/booking/Product/product';
import JournalPage from './features/booking/Journal/JournalPage';
import FakturaerPage from './features/booking/faktura/faktura';
import Overview from './features/booking/overview/Overview';
import UserSettings from './features/booking/usersettings';
import TeamPage from './features/booking/team/team';
import SignUp from './SignUp/SignUp';
import SignInPageDemo from './components/ui/sign-in-demo';
import { useAuth } from './AuthContext';
import { LanguageProvider as UnAuthLanguageProvider } from './unAuth/language/LanguageProvider';
import './App.css';
import PostAuthRedirect from './PostAuthRedirect';
import CustomDashboardChoice from './costum';
import GettingStartedPlaceholder from './GettingStartedPlaceholder';
import NotEstablishedPage from './notestablished/notestablished';
import LaunchPlannerPage from './notestablished/start/start';
import DigitalFrontPage from './notestablished/digital-front/digital-front';

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

function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname, hash]);

  return null;
}

function App() {
  return (
    <UnAuthLanguageProvider>
      <Router>
        <ScrollToTop />
        <PostAuthRedirect />
        <div className="app-container">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/agent" element={<AgentPage />} />
            <Route path="/website-builder" element={<WebsiteBuilderPage />} />
            <Route path="/features" element={<IntelligentBookingPage />} />
            <Route path="/features/operations" element={<OperationsPage />} />
            <Route path="/intelligent-booking" element={<IntelligentBookingPage />} />
            <Route path="/transcription-factsr" element={<TranscriptionFactsrPage />} />
            <Route path="/selma-copilot" element={<SelmaCopilotPage />} />
            <Route path="/welcome" element={<CustomDashboardChoice />} />
            <Route path="/getting-started" element={<NotEstablishedPage />} />
            <Route path="/getting-started/start" element={<LaunchPlannerPage />} />
            <Route path="/getting-started/digital-front" element={<DigitalFrontPage />} />
            <Route path="/booking" element={<BookingPage />} />
            <Route path="/booking/overview" element={<Overview />} />
            <Route path="/journal" element={<JournalPage />} />
            <Route path="/booking/klienter" element={<Klientoversigt />} />
            <Route path="/booking/ydelser" element={<Ydelser />} />
            <Route path="/booking/forloeb" element={<Forloeb />} />
            <Route path="/booking/produkt" element={<Product />} />
            <Route path="/booking/fakturaer/*" element={<FakturaerPage />} />
            <Route path="/booking/team" element={<TeamPage />} />
            <Route path="/booking/settings" element={<UserSettings />} />
            <Route path="/settings/transfer" element={<UserSettings />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/sign-in-demo" element={<SignInPageDemo />} />
          </Routes>
        </div>
      </Router>
    </UnAuthLanguageProvider>
  );
}

export default App;
