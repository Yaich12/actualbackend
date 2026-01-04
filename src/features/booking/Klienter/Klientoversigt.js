import React, { useMemo, useState } from 'react';
import '../bookingpage.css';
import './klientoversigt.css';
import AddKlient from './addklient/addklient';
import { BookingSidebarLayout } from '../../../components/ui/BookingSidebarLayout';
import { useAuth } from '../../../AuthContext';
import { useLanguage } from '../../../LanguageContext';
import { useUserClients } from './hooks/useUserClients';
import { ChevronDown } from 'lucide-react';

function Klientoversigt() {
  const { user } = useAuth();
  const { t, locale } = useLanguage();
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
  const [editView, setEditView] = useState('forloeb'); // 'personal' or 'forloeb'
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [sortOption, setSortOption] = useState('alphabetical'); // 'newest', 'oldest', 'alphabetical'
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [clientMenuPosition, setClientMenuPosition] = useState({ x: 0, y: 0 });

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
    let result = clients;
    
    if (queryValue) {
      result = clients.filter((client) => {
        const name = client.navn?.toLowerCase?.() || '';
        const email = client.email?.toLowerCase?.() || '';
        const city = client.by?.toLowerCase?.() || '';
        return (
          name.includes(queryValue) ||
          email.includes(queryValue) ||
          city.includes(queryValue)
        );
      });
    }

    // Apply sorting based on sortOption
    return [...result].sort((a, b) => {
      if (sortOption === 'alphabetical') {
        const nameA = (a.navn || '').toLowerCase();
        const nameB = (b.navn || '').toLowerCase();
        return nameA.localeCompare(nameB, locale);
      } else if (sortOption === 'newest') {
        const dateA = a.createdAt?.toDate?.() || a.createdAt || new Date(0);
        const dateB = b.createdAt?.toDate?.() || b.createdAt || new Date(0);
        return dateB - dateA;
      } else if (sortOption === 'oldest') {
        const dateA = a.createdAt?.toDate?.() || a.createdAt || new Date(0);
        const dateB = b.createdAt?.toDate?.() || b.createdAt || new Date(0);
        return dateA - dateB;
      }
      return 0;
    });
  }, [clients, searchQuery, sortOption]);

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

  const handleSortOptionSelect = (option) => {
    setSortOption(option);
    setShowSortDropdown(false);
  };

  const getSortLabel = () => {
    switch (sortOption) {
      case 'newest':
        return t('booking.clients.sort.newest', 'Nyeste');
      case 'oldest':
        return t('booking.clients.sort.oldest', 'Ældste');
      case 'alphabetical':
        return t('booking.clients.sort.alphabetical', 'Alfabetisk');
      default:
        return t('booking.clients.sort.label', 'Sortér');
    }
  };

  const handleClientRowClick = (e, client) => {
    // Ignore clicks on checkbox
    if (e.target.type === 'checkbox') {
      return;
    }

    // Get position for menu
    const rect = e.currentTarget.getBoundingClientRect();
    setClientMenuPosition({
      x: rect.left + rect.width / 2,
      y: rect.bottom + 4,
    });
    setSelectedClientId(client.id);
  };

  const handleEditClientInfo = (client) => {
    setEditView('personal');
    openEditClient(client);
    setSelectedClientId(null);
  };

  const handleAddForloebInfo = (client) => {
    setEditView('forloeb');
    openEditClient(client);
    setSelectedClientId(null);
  };

  const handleCloseMenu = () => {
    setSelectedClientId(null);
  };

  const userIdentity = useMemo(() => {
    if (!user) {
      return {
        name: t('booking.calendar.notLoggedIn', 'Ikke logget ind'),
        email: t('booking.calendar.loginToContinue', 'Log ind for at fortsætte'),
        initials: '?',
        photoURL: null,
      };
    }

    const name =
      user.displayName ||
      user.email ||
      t('booking.topbar.defaultUser', 'Selma bruger');
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
        <div className="booking-content">
          {/* Main Content Area - Client Overview */}
          <div className="klientoversigt-main">
          {/* Page Header */}
          <div className="klientoversigt-header">
            <div className="header-left">
              <div className="header-title">
                <h2 className="page-title">
                  {t('booking.clients.title', 'Klientoversigt')}
                </h2>
              </div>
            </div>
            <div className="header-right">
              <button
                type="button"
                className="toolbar-pill toolbar-primary"
                onClick={openCreateClient}
              >
                {t('booking.clients.actions.add', 'Tilføj klient')}
                <ChevronDown className="toolbar-caret" />
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="filter-bar">
            <div className="sort-dropdown-container">
              <button 
                className="edit-columns-btn"
                onClick={() => setShowSortDropdown(!showSortDropdown)}
              >
                {t('booking.clients.sort.label', 'Sortér')}: {getSortLabel()}
                <span className="dropdown-arrow">{showSortDropdown ? '▲' : '▼'}</span>
              </button>
              {showSortDropdown && (
                <div className="sort-dropdown-menu">
                  <button 
                    className={`sort-dropdown-item ${sortOption === 'newest' ? 'active' : ''}`}
                    onClick={() => handleSortOptionSelect('newest')}
                  >
                    {t('booking.clients.sort.newest', 'Nyeste')}
                  </button>
                  <button 
                    className={`sort-dropdown-item ${sortOption === 'oldest' ? 'active' : ''}`}
                    onClick={() => handleSortOptionSelect('oldest')}
                  >
                    {t('booking.clients.sort.oldest', 'Ældste')}
                  </button>
                  <button 
                    className={`sort-dropdown-item ${sortOption === 'alphabetical' ? 'active' : ''}`}
                    onClick={() => handleSortOptionSelect('alphabetical')}
                  >
                    {t('booking.clients.sort.alphabetical', 'Alfabetisk')}
                  </button>
                </div>
              )}
            </div>
            <div className="search-bar">
              <span className="search-icon-small">🔍</span>
              <input 
                type="text" 
                placeholder={t('booking.clients.search.placeholder', 'Søg')}
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
                : t('booking.clients.loading', 'Henter klienter...')}
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
                    {t('booking.clients.columns.name', 'Navn')}
                    {sortColumn === 'navn' && (
                      <span className="sort-arrow">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th 
                    className="sortable" 
                    onClick={() => handleSort('status')}
                  >
                    {t('booking.clients.columns.status', 'Status')}
                    {sortColumn === 'status' && (
                      <span className="sort-arrow">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th 
                    className="sortable" 
                    onClick={() => handleSort('email')}
                  >
                    {t('booking.clients.columns.email', 'E-mail')}
                    {sortColumn === 'email' && (
                      <span className="sort-arrow">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th 
                    className="sortable" 
                    onClick={() => handleSort('telefon')}
                  >
                    {t('booking.clients.columns.phone', 'Telefon')}
                    {sortColumn === 'telefon' && (
                      <span className="sort-arrow">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th 
                    className="sortable" 
                    onClick={() => handleSort('cpr')}
                  >
                    {t('booking.clients.columns.cpr', 'CPR')}
                    {sortColumn === 'cpr' && (
                      <span className="sort-arrow">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th 
                    className="sortable" 
                    onClick={() => handleSort('adresse')}
                  >
                    {t('booking.clients.columns.address', 'Adresse')}
                    {sortColumn === 'adresse' && (
                      <span className="sort-arrow">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th 
                    className="sortable" 
                    onClick={() => handleSort('by')}
                  >
                    {t('booking.clients.columns.city', 'By')}
                    {sortColumn === 'by' && (
                      <span className="sort-arrow">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th 
                    className="sortable" 
                    onClick={() => handleSort('postnummer')}
                  >
                    {t('booking.clients.columns.postalCode', 'Postnummer')}
                    {sortColumn === 'postnummer' && (
                      <span className="sort-arrow">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th 
                    className="sortable" 
                    onClick={() => handleSort('land')}
                  >
                    {t('booking.clients.columns.country', 'Land')}
                    {sortColumn === 'land' && (
                      <span className="sort-arrow">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map((client) => (
                  <tr 
                    key={client.id}
                    onClick={(e) => handleClientRowClick(e, client)}
                    className={selectedClientId === client.id ? 'row-selected' : ''}
                    style={{ cursor: 'pointer' }}
                  >
                    <td className="checkbox-col" onClick={(e) => e.stopPropagation()}>
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

      {/* Client Action Menu */}
      {selectedClientId && (() => {
        const client = filteredClients.find((c) => c.id === selectedClientId);
        if (!client) return null;
        
        return (
          <>
            <div 
              className="client-menu-overlay" 
              onClick={handleCloseMenu}
            />
            <div 
              className="client-menu"
              style={{
                left: `${clientMenuPosition.x}px`,
                top: `${clientMenuPosition.y}px`,
              }}
            >
              <button
                className="client-menu-item"
                onClick={() => handleEditClientInfo(client)}
              >
                {t('booking.clients.actions.edit', 'Ændre klientoplysninger')}
              </button>
              <button
                className="client-menu-item"
                onClick={() => handleAddForloebInfo(client)}
              >
                {t('booking.clients.actions.addProgram', 'Tilføj forløbsoplysninger')}
              </button>
            </div>
          </>
        );
      })()}

      {/* Add Klient Modal */}
      {showAddClient && (
        <AddKlient
          isOpen={showAddClient}
          mode={editingClient ? 'edit' : 'create'}
          clientId={editingClient?.id || null}
          initialClient={editingClient || null}
          editView={editView}
          onClose={() => {
            setShowAddClient(false);
            setEditingClient(null);
            setEditView('forloeb');
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
