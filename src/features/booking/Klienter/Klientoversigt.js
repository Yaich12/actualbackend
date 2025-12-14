import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../bookingpage.css';
import './klientoversigt.css';
import AddKlient from './addklient/addklient';
import { BookingSidebarLayout } from '../../../components/ui/BookingSidebarLayout';
import { useAuth } from '../../../AuthContext';
import { useUserClients } from './hooks/useUserClients';

function Klientoversigt() {
  const navigate = useNavigate();
  const { user, signOutUser } = useAuth();
  const {
    clients,
    loading: isLoadingClients,
    error: clientsLoadError,
  } = useUserClients();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');
  const [showAddClient, setShowAddClient] = useState(false);
  const [editingClient, setEditingClient] = useState(null);

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const filteredClients = useMemo(() => {
    const queryValue = searchQuery.trim().toLowerCase();
    if (!queryValue) {
      return clients;
    }
    return clients.filter((client) => {
      const name = client.navn?.toLowerCase?.() || '';
      const email = client.email?.toLowerCase?.() || '';
      const city = client.by?.toLowerCase?.() || '';
      return (
        name.includes(queryValue) ||
        email.includes(queryValue) ||
        city.includes(queryValue)
      );
    });
  }, [clients, searchQuery]);

  const openCreateClient = () => {
    setEditingClient(null);
    setShowAddClient(true);
  };

  const openEditClient = (client) => {
    setEditingClient(client);
    setShowAddClient(true);
  };

  const handleAddClientSave = () => {
    setShowAddClient(false);
    setEditingClient(null);
  };

  const handleDeleteClient = () => {
    setShowAddClient(false);
    setEditingClient(null);
  };

  const userIdentity = useMemo(() => {
    if (!user) {
      return {
        name: 'Ikke logget ind',
        email: 'Log ind for at fortsætte',
        initials: '?',
        photoURL: null,
      };
    }

    const name = user.displayName || user.email || 'Selma bruger';
    const email = user.email || '—';
    const initialsSource = (user.displayName || user.email || '?').trim();
    const initials = initialsSource
      .split(/\s+/)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

    return {
      name,
      email,
      initials,
      photoURL: user.photoURL || null,
    };
  }, [user]);

  return (
    <BookingSidebarLayout>
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
          <div className="topbar-right" />
        </div>

        <div className="booking-content">
          {/* Main Content Area - Client Overview */}
          <div className="klientoversigt-main">
          {/* Page Header */}
          <div className="klientoversigt-header">
            <div className="header-left">
              <div className="header-title">
                <h2 className="page-title">Klientoversigt</h2>
              </div>
            </div>
            <div className="header-right">
              <button 
                className="add-client-btn"
                onClick={openCreateClient}
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
                      <input
                        type="checkbox"
                        checked={false}
                        readOnly
                        onChange={() => openEditClient(client)}
                      />
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
          isOpen={showAddClient}
          mode={editingClient ? 'edit' : 'create'}
          clientId={editingClient?.id || null}
          initialClient={editingClient || null}
          onClose={() => {
            setShowAddClient(false);
            setEditingClient(null);
          }}
          onSave={handleAddClientSave}
          onDelete={handleDeleteClient}
        />
      )}
    </div>
    </BookingSidebarLayout>
  );
}

export default Klientoversigt;
