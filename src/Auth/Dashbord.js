import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import './Dashbord.css';

function Dashbord() {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    navigate('/booking', { replace: true });
  }, [navigate]);

  return (
    <div className="dashboard-redirect">
      <p>Logger ind{user?.displayName ? `, ${user.displayName}` : ''}…</p>
      <p>Sender dig videre til bookingoversigten.</p>
    </div>
  );
}

export default Dashbord;
