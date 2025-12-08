// Stack notes: project is plain React (JS) with Tailwind config present; TypeScript is available via tsconfig but unused. shadcn/ui not installed—run `npx shadcn-ui@latest init` after adding Tailwind if you want those components.
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Rocket } from 'lucide-react';
import './costum.css';

function CustomDashboardChoice() {
  const navigate = useNavigate();

  const handleNotEstablished = () => {
    navigate('/getting-started');
  };

  const handleEstablished = () => {
    navigate('/booking');
  };

  // URL encode the space in the folder name for proper path resolution
  const backgroundImage = encodeURI('/hero 2/pexels-rdne-7755558.jpg');

  return (
    <div 
      className="custom-dashboard-root"
      style={{
        backgroundImage: `linear-gradient(rgba(244, 246, 251, 0.4), rgba(244, 246, 251, 0.4)), url('${backgroundImage}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <div className="custom-dashboard-shell">
        <div className="custom-dashboard-header">
          <h1 className="custom-dashboard-title">Hvor er din klinik i dag?</h1>
          <p className="custom-dashboard-subtitle">
            Vælg det der passer bedst – så tilpasser vi Selma+ til din hverdag.
          </p>
        </div>

        <div className="custom-dashboard-grid">
          <div className="custom-dashboard-card">
            <span className="custom-dashboard-icon" aria-hidden="true">
              <Rocket size={22} strokeWidth={2} />
            </span>
            <h2 className="custom-dashboard-card-title">Ikke etableret endnu</h2>
            <p className="custom-dashboard-card-text">
              Du er i gang med at starte op, teste koncepter og bygge dine første forløb.
            </p>
            <button
              type="button"
              className="custom-dashboard-card-button"
              onClick={handleNotEstablished}
            >
              Vælg denne
            </button>
          </div>

          <div className="custom-dashboard-card">
            <span className="custom-dashboard-icon" aria-hidden="true">
              <Building2 size={22} strokeWidth={2} />
            </span>
            <h2 className="custom-dashboard-card-title">Etableret klinik</h2>
            <p className="custom-dashboard-card-text">
              Du har allerede klienter og faste aftaler – klar til at samle alt i Selma+.
            </p>
            <button
              type="button"
              className="custom-dashboard-card-button"
              onClick={handleEstablished}
            >
              Vælg denne
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CustomDashboardChoice;
