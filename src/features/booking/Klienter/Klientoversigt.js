import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../bookingpage.css';
import './klientoversigt.css';

function Klientoversigt() {
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState('klienter');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');

  // Dummy data
  const [clients] = useState([
    {
      id: 1,
      navn: 'Jonas Yaich',
      status: 'Aktiv',
      email: 'Jona223j@gmail.com',
      telefon: '',
      cpr: '',
      adresse: 'Rugmarken 6',
      by: 'Rødekro',
      postnummer: '6230',
      land: 'Denmark'
    },
    {
      id: 2,
      navn: 'Anna Hansen',
      status: 'Aktiv',
      email: 'anna.hansen@email.com',
      telefon: '+45 12 34 56 78',
      cpr: '010190-1234',
      adresse: 'Hovedgaden 42',
      by: 'København',
      postnummer: '2100',
      land: 'Denmark'
    },
    {
      id: 3,
      navn: 'Peter Nielsen',
      status: 'Inaktiv',
      email: 'peter.n@email.com',
      telefon: '+45 98 76 54 32',
      cpr: '150285-5678',
      adresse: 'Skovvej 15',
      by: 'Aarhus',
      postnummer: '8000',
      land: 'Denmark'
    },
    {
      id: 4,
      navn: 'Maria Andersen',
      status: 'Aktiv',
      email: 'maria.a@email.com',
      telefon: '+45 11 22 33 44',
      cpr: '200392-9012',
      adresse: 'Strandvejen 88',
      by: 'Odense',
      postnummer: '5000',
      land: 'Denmark'
    }
  ]);

  const handleNavClick = (navItem) => {
    setActiveNav(navItem);
    if (navItem === 'kalender') {
      navigate('/booking');
    } else if (navItem === 'ydelser') {
      navigate('/booking/ydelser');
    }
  };

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const filteredClients = clients.filter(client =>
    client.navn.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.by.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="booking-page">
      {/* Top Navigation Bar */}
      <div className="booking-topbar">
        <div className="topbar-left">
          <button className="topbar-logo-btn" onClick={() => navigate('/')}>
            Forside
          </button>
        </div>
        <div className="topbar-right">
          <button className="create-appointment-btn">
            <span className="plus-icon">+</span>
            Opret aftale
          </button>
        </div>
      </div>

      <div className="booking-content">
        {/* Left Sidebar */}
        <div className="booking-sidebar">
          <div className="sidebar-search">
            <span className="search-icon">🔍</span>
            <input type="text" placeholder="Søg" className="search-input" />
          </div>

          <div className="sidebar-notifications">
            <span className="bell-icon">🔔</span>
            <span>Notifikationer</span>
          </div>

          <div className="sidebar-section">
            <div className="section-label">KLINIK</div>
            <nav className="sidebar-nav">
              <button 
                className={`nav-item ${activeNav === 'kalender' ? 'active' : ''}`}
                onClick={() => handleNavClick('kalender')}
              >
                <span className="nav-icon calendar-icon">📅</span>
                <span className="nav-text">Kalender</span>
              </button>
              <button 
                className={`nav-item ${activeNav === 'klienter' ? 'active' : ''}`}
                onClick={() => handleNavClick('klienter')}
              >
                <span className="nav-icon">👤</span>
                <span className="nav-text">Klienter</span>
              </button>
              <button 
                className={`nav-item ${activeNav === 'ydelser' ? 'active' : ''}`}
                onClick={() => handleNavClick('ydelser')}
              >
                <span className="nav-icon">🏷️</span>
                <span className="nav-text">Ydelser</span>
              </button>
              <button 
                className={`nav-item ${activeNav === 'fakturaer' ? 'active' : ''}`}
                onClick={() => handleNavClick('fakturaer')}
              >
                <span className="nav-icon">📄</span>
                <span className="nav-text">Fakturaer</span>
                <span className="nav-badge-launching">(launching soon)</span>
              </button>
              <button 
                className={`nav-item ${activeNav === 'statistik' ? 'active' : ''}`}
                onClick={() => handleNavClick('statistik')}
              >
                <span className="nav-icon">📊</span>
                <span className="nav-text">Statistik</span>
                <span className="nav-badge-launching">(launching soon)</span>
              </button>
              <button 
                className={`nav-item ${activeNav === 'indstillinger' ? 'active' : ''}`}
                onClick={() => handleNavClick('indstillinger')}
              >
                <span className="nav-icon">⚙️</span>
                <span className="nav-text">Indstillinger</span>
                <span className="nav-badge-launching">(launching soon)</span>
              </button>
              <button 
                className={`nav-item ${activeNav === 'apps' ? 'active' : ''}`}
                onClick={() => handleNavClick('apps')}
              >
                <span className="nav-icon">📱</span>
                <span className="nav-text">Apps</span>
                <span className="nav-badge-launching">(launching soon)</span>
              </button>
            </nav>
          </div>
        </div>

        {/* Main Content Area - Client Overview */}
        <div className="klientoversigt-main">
          {/* Page Header */}
          <div className="klientoversigt-header">
            <div className="header-left">
              <div className="header-title">
                <span className="title-arrows">««</span>
                <span className="title-arrow">‹</span>
                <h2 className="page-title">Klientoversigt</h2>
              </div>
            </div>
            <div className="header-right">
              <button className="export-btn">
                <span className="export-icon">⬇</span>
                Eksporter CSV
                <span className="dropdown-arrow">▼</span>
              </button>
              <button className="add-client-btn">
                <span className="add-icon">👤+</span>
                Tilføj klient
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="filter-bar">
            <button className="filter-btn">Filter</button>
            <button className="saved-filters-btn">
              <span className="bookmark-icon">🔖</span>
              Gemte Filtre
              <span className="dropdown-arrow">▼</span>
            </button>
            <button className="edit-columns-btn">
              Rediger kolonner
              <span className="dropdown-arrow">▼</span>
            </button>
            <div className="search-bar">
              <span className="search-icon-small">🔍</span>
              <input 
                type="text" 
                placeholder="Søg" 
                className="search-input-large"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Client Table */}
          <div className="table-container">
            <table className="clients-table">
              <thead>
                <tr>
                  <th className="checkbox-col">
                    <input type="checkbox" />
                  </th>
                  <th 
                    className="sortable" 
                    onClick={() => handleSort('navn')}
                  >
                    Navn
                    {sortColumn === 'navn' && (
                      <span className="sort-arrow">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th 
                    className="sortable" 
                    onClick={() => handleSort('status')}
                  >
                    Status
                    {sortColumn === 'status' && (
                      <span className="sort-arrow">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th 
                    className="sortable" 
                    onClick={() => handleSort('email')}
                  >
                    E-mail
                    {sortColumn === 'email' && (
                      <span className="sort-arrow">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th 
                    className="sortable" 
                    onClick={() => handleSort('telefon')}
                  >
                    Telefon
                    {sortColumn === 'telefon' && (
                      <span className="sort-arrow">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th 
                    className="sortable" 
                    onClick={() => handleSort('cpr')}
                  >
                    CPR
                    {sortColumn === 'cpr' && (
                      <span className="sort-arrow">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th 
                    className="sortable" 
                    onClick={() => handleSort('adresse')}
                  >
                    Adresse
                    {sortColumn === 'adresse' && (
                      <span className="sort-arrow">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th 
                    className="sortable" 
                    onClick={() => handleSort('by')}
                  >
                    By
                    {sortColumn === 'by' && (
                      <span className="sort-arrow">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th 
                    className="sortable" 
                    onClick={() => handleSort('postnummer')}
                  >
                    Postnummer
                    {sortColumn === 'postnummer' && (
                      <span className="sort-arrow">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th 
                    className="sortable" 
                    onClick={() => handleSort('land')}
                  >
                    Land
                    {sortColumn === 'land' && (
                      <span className="sort-arrow">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map((client) => (
                  <tr key={client.id}>
                    <td className="checkbox-col">
                      <input type="checkbox" />
                    </td>
                    <td>{client.navn}</td>
                    <td>
                      <span className={`status-badge ${client.status.toLowerCase()}`}>
                        {client.status}
                      </span>
                    </td>
                    <td>{client.email}</td>
                    <td>{client.telefon || '-'}</td>
                    <td>{client.cpr || '-'}</td>
                    <td>{client.adresse}</td>
                    <td>{client.by}</td>
                    <td>{client.postnummer}</td>
                    <td>{client.land}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Klientoversigt;
