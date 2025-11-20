import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../bookingpage.css';
import './klientoversigt.css';
import { clients as initialClients } from './clientsData';
import AddKlient from './addklient/addklient';
import { useAuth } from '../../../AuthContext';
import { ref, listAll, getDownloadURL } from 'firebase/storage';
import { storage } from '../../../firebase';

const sanitizeIdentifier = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const deriveUserIdentifier = (user) => {
  if (!user) {
    return 'unknown-user';
  }

  const baseIdentifier =
    (user.displayName && user.displayName.trim()) ||
    (user.email && user.email.trim()) ||
    user.uid ||
    'unknown-user';

  const sanitized = sanitizeIdentifier(baseIdentifier);
  if (sanitized) {
    return sanitized;
  }

  if (user.uid) {
    return sanitizeIdentifier(user.uid);
  }

  return 'unknown-user';
};

const mapStoredClientToRow = (storedClient) => ({
  id:
    storedClient.storagePath ||
    storedClient.id ||
    `${storedClient.navn || 'klient'}-${storedClient.createdAt || Date.now()}`,
  navn: storedClient.navn || 'Uden navn',
  status: storedClient.status || 'Aktiv',
  email: storedClient.email || '',
  telefon:
    storedClient.telefonKomplet ||
    storedClient.telefon ||
    '',
  cpr: storedClient.cpr || '',
  adresse: storedClient.adresse || '',
  by: storedClient.by || '',
  postnummer: storedClient.postnummer || '',
  land: storedClient.land || 'Danmark',
  createdAt: storedClient.createdAt || null,
});

function Klientoversigt() {
  const navigate = useNavigate();
  const { signOutUser, user } = useAuth();
  const [clients, setClients] = useState(initialClients);
  const [activeNav, setActiveNav] = useState('klienter');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');
  const [showAddClient, setShowAddClient] = useState(false);
  const [isLoadingClients, setIsLoadingClients] = useState(false);
  const [clientsLoadError, setClientsLoadError] = useState('');


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

  const handleAddClientSave = (newClient) => {
    const clientWithDefaults = {
      status: 'Aktiv',
      ...newClient,
      id: newClient.id || `client-${Date.now()}`,
    };

    setClients((prev) => [clientWithDefaults, ...prev]);
    setShowAddClient(false);
  };

  useEffect(() => {
    let isCancelled = false;

    const fetchClientsFromStorage = async () => {
      if (!user) {
        setClients(initialClients);
        setClientsLoadError('');
        setIsLoadingClients(false);
        return;
      }

      setIsLoadingClients(true);
      setClientsLoadError('');

      try {
        const identifier = deriveUserIdentifier(user);
        const folderCandidates = Array.from(
          new Set(
            [identifier, user.uid].filter(
              (candidate) =>
                typeof candidate === 'string' && candidate.trim().length > 0
            )
          )
        );

        const fetchedEntriesArrays = await Promise.all(
          folderCandidates.map(async (folderName) => {
            try {
              const folderRef = ref(storage, `klienter/${folderName}`);
              const listResult = await listAll(folderRef);

              const entries = await Promise.all(
                listResult.items.map(async (itemRef) => {
                  try {
                    const url = await getDownloadURL(itemRef);
                    const response = await fetch(url);
                    if (!response.ok) {
                      throw new Error(`Failed to fetch ${itemRef.fullPath}`);
                    }
                    const data = await response.json();
                    return mapStoredClientToRow({
                      ...data,
                      storagePath: itemRef.fullPath,
                    });
                  } catch (entryError) {
                    console.error('Failed to load client entry:', entryError);
                    return null;
                  }
                })
              );

              return entries.filter(Boolean);
            } catch (error) {
              if (error?.code === 'storage/object-not-found') {
                return [];
              }
              throw error;
            }
          })
        );

        const fetchedClients = fetchedEntriesArrays
          .flat()
          .sort((a, b) => {
            const first = new Date(a.createdAt || 0).getTime();
            const second = new Date(b.createdAt || 0).getTime();
            return second - first;
          });

        if (!isCancelled) {
          const fetchedMap = new Map(fetchedClients.map((c) => [c.id, c]));
          setClients((prev) => [
            ...fetchedClients,
            ...prev.filter((client) => !fetchedMap.has(client.id)),
          ]);
        }
      } catch (error) {
        console.error('Failed to load clients from storage:', error);
        if (!isCancelled) {
          setClientsLoadError('Kunne ikke hente klienter. Prøv igen senere.');
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingClients(false);
        }
      }
    };

    fetchClientsFromStorage();

    return () => {
      isCancelled = true;
    };
  }, [user]);

  return (
    <div className="booking-page">
      {/* Top Navigation Bar */}
      <div className="booking-topbar">
        <div className="topbar-left">
          <button className="topbar-logo-btn" onClick={async () => {
            await signOutUser();
            navigate('/');
          }}>
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
              <button 
                className="add-client-btn"
                onClick={() => setShowAddClient(true)}
              >
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

          {/* Client status */}
          {(isLoadingClients || clientsLoadError) && (
            <div
              className={`client-status-message${
                clientsLoadError ? ' error' : ''
              }`}
            >
              {clientsLoadError
                ? clientsLoadError
                : 'Henter klienter...'}
            </div>
          )}

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

      {/* Add Klient Modal */}
      {showAddClient && (
        <AddKlient
          onClose={() => setShowAddClient(false)}
          onSave={handleAddClientSave}
        />
      )}
    </div>
  );
}

export default Klientoversigt;
