import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import LandingPage from './unAuth/landingpage';
import { useAuth } from './AuthContext';
import { LanguageProvider } from './LanguageContext';
import { LanguageProvider as UnAuthLanguageProvider } from './unAuth/language/LanguageProvider';
import './App.css';
import PostAuthRedirect from './PostAuthRedirect';

const AgentPage = lazy(() => import('./features/agent/AgentPage'));
const WebsiteBuilderPage = lazy(() => import('./unAuth/website-builder'));
const IntelligentBookingPage = lazy(() => import('./unAuth/intelligent-booking'));
const OperationsPage = lazy(() => import('./unAuth/operations'));
const TranscriptionFactsrPage = lazy(() => import('./unAuth/transcription-factsr'));
const SelmaCopilotPage = lazy(() => import('./unAuth/selma-copilot'));
const BookingPage = lazy(() => import('./features/booking/bookingpage'));
const Klientoversigt = lazy(() => import('./features/booking/Klienter/Klientoversigt'));
const Ydelser = lazy(() => import('./features/booking/Ydelser/ydelser'));
const Forloeb = lazy(() => import('./features/booking/forløb/forløb'));
const Product = lazy(() => import('./features/booking/Product/product'));
const JournalPage = lazy(() => import('./features/booking/Journal/JournalPage'));
const FakturaerPage = lazy(() => import('./features/booking/faktura/faktura'));
const Overview = lazy(() => import('./features/booking/overview/Overview'));
const UserSettings = lazy(() => import('./features/booking/usersettings'));
const TeamPage = lazy(() => import('./features/booking/team/team'));
const SignUp = lazy(() => import('./SignUp/SignUp'));
const SignInPageDemo = lazy(() => import('./components/ui/sign-in-demo'));
const PaymentReceiptPage = lazy(() => import('./unAuth/components/PaymentReceiptPage'));
const CustomDashboardChoice = lazy(() => import('./costum'));
const NotEstablishedPage = lazy(() => import('./notestablished/notestablished'));
const LaunchPlannerPage = lazy(() => import('./notestablished/start/start'));
const DigitalFrontPage = lazy(() => import('./notestablished/digital-front/digital-front'));

function RouteLoader() {
  return <div className="route-loader">Loading...</div>;
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <RouteLoader />;
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
    <LanguageProvider>
      <UnAuthLanguageProvider>
        <Router>
          <ScrollToTop />
          <PostAuthRedirect />
          <div className="app-container">
            <Suspense fallback={<RouteLoader />}>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/agent" element={<AgentPage />} />
                <Route path="/website-builder" element={<WebsiteBuilderPage />} />
                <Route path="/features" element={<IntelligentBookingPage />} />
                <Route path="/features/operations" element={<OperationsPage />} />
                <Route path="/intelligent-booking" element={<IntelligentBookingPage />} />
                <Route path="/transcription-factsr" element={<TranscriptionFactsrPage />} />
                <Route path="/selma-copilot" element={<SelmaCopilotPage />} />
                <Route path="/welcome" element={<ProtectedRoute><CustomDashboardChoice /></ProtectedRoute>} />
                <Route path="/getting-started" element={<ProtectedRoute><NotEstablishedPage /></ProtectedRoute>} />
                <Route path="/getting-started/start" element={<ProtectedRoute><LaunchPlannerPage /></ProtectedRoute>} />
                <Route path="/getting-started/digital-front" element={<ProtectedRoute><DigitalFrontPage /></ProtectedRoute>} />
                <Route path="/booking" element={<ProtectedRoute><BookingPage /></ProtectedRoute>} />
                <Route path="/booking/overview" element={<ProtectedRoute><Overview /></ProtectedRoute>} />
                <Route path="/journal" element={<ProtectedRoute><JournalPage /></ProtectedRoute>} />
                <Route path="/booking/klienter" element={<ProtectedRoute><Klientoversigt /></ProtectedRoute>} />
                <Route path="/booking/ydelser" element={<ProtectedRoute><Ydelser /></ProtectedRoute>} />
                <Route path="/booking/forloeb" element={<ProtectedRoute><Forloeb /></ProtectedRoute>} />
                <Route path="/booking/produkt" element={<ProtectedRoute><Product /></ProtectedRoute>} />
                <Route path="/booking/fakturaer/*" element={<ProtectedRoute><FakturaerPage /></ProtectedRoute>} />
                <Route path="/booking/team" element={<ProtectedRoute><TeamPage /></ProtectedRoute>} />
                <Route path="/booking/settings" element={<ProtectedRoute><UserSettings /></ProtectedRoute>} />
                <Route path="/settings/transfer" element={<ProtectedRoute><Navigate to="/booking/settings" replace /></ProtectedRoute>} />
                <Route path="/signup" element={<SignUp />} />
                <Route path="/sign-in-demo" element={<SignInPageDemo />} />
                <Route path="/betaling/kvittering" element={<PaymentReceiptPage />} />
              </Routes>
            </Suspense>
          </div>
        </Router>
      </UnAuthLanguageProvider>
    </LanguageProvider>
  );
}

export default App;
