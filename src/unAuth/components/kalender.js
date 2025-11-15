import React from 'react';
import './kalender.css';

function Axis() {
  return (
    <section className="axis">
      <div className="axis-container">
        <div className="axis-card">
          <h2 className="axis-title">Det ligner en helt simpel system mens der ligger en helt speciel AI moter bag facaden</h2>
          
          <div className="axis-visual">
            <div className="axis-app-preview">
              <div className="axis-app-header">
                <div className="axis-app-logo"></div>
                <div className="axis-app-nav">
                  <span className="axis-nav-item">Kalendere</span>
                  <span className="axis-nav-item">måned</span>
                  <button className="axis-nav-btn">‹</button>
                  <button className="axis-nav-btn">›</button>
                  <button className="axis-nav-btn">i dag</button>
                  <span className="axis-nav-item">maj 2027</span>
                </div>
                <button className="axis-create-btn">+ Opret aftale</button>
              </div>
              
              <div className="axis-app-content">
                <div className="axis-sidebar">
                  <div className="axis-search">
                    <span className="axis-search-icon">🔍</span>
                    <span className="axis-search-text">Søg</span>
                  </div>
                  <div className="axis-sidebar-item">
                    <span className="axis-sidebar-icon">🔔</span>
                    <span>Notifikationer</span>
                  </div>
                  <div className="axis-sidebar-section">Klinik</div>
                  <div className="axis-sidebar-item active">
                    <span className="axis-sidebar-icon">📅</span>
                    <span>Kalender</span>
                  </div>
                  <div className="axis-sidebar-item">
                    <span className="axis-sidebar-icon">👤</span>
                    <span>Klienter</span>
                  </div>
                  <div className="axis-sidebar-item">
                    <span className="axis-sidebar-icon">🏷️</span>
                    <span>Ydelser</span>
                  </div>
                  <div className="axis-sidebar-item">
                    <span className="axis-sidebar-icon">📄</span>
                    <span>Fakturaer</span>
                  </div>
                  <div className="axis-sidebar-item">
                    <span className="axis-sidebar-icon">📊</span>
                    <span>Statistik</span>
                  </div>
                  <div className="axis-sidebar-item">
                    <span className="axis-sidebar-icon">⚙️</span>
                    <span>Indstillinger</span>
                  </div>
                  <div className="axis-sidebar-item">
                    <span className="axis-sidebar-icon">⊞</span>
                    <span>Apps</span>
                  </div>
                </div>
                
                <div className="axis-calendar">
                  <div className="axis-calendar-header">
                    <div className="axis-day-header">MAN 26/4</div>
                    <div className="axis-day-header">TIR 27/4</div>
                    <div className="axis-day-header">ONS 28/4</div>
                    <div className="axis-day-header">TOR 29/4</div>
                    <div className="axis-day-header">FRE 30/4</div>
                    <div className="axis-day-header">LØR 1/5</div>
                    <div className="axis-day-header">SØN 2/5</div>
                  </div>
                  <div className="axis-calendar-grid">
                    {[26, 27, 28, 29, 30, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30].map((day, index) => (
                      <div key={index} className="axis-calendar-day">
                        <span className="axis-day-number">{day}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Axis;

