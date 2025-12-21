import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../bookingpage.css';
import { BookingSidebarLayout } from '../../../components/ui/BookingSidebarLayout';
import { useAuth } from '../../../AuthContext';
import { useUserClients } from '../Klienter/hooks/useUserClients';

const statusLabels = {
  pending: 'Afventer betaling',
  paid: 'Betalt',
  overdue: 'Forsinket',
  cancelled: 'Annulleret',
};

function StatusPill({ status }) {
  const base =
    'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium';

  switch (status) {
    case 'paid':
      return (
        <span className={`${base} bg-emerald-50 text-emerald-700`}>
          • {statusLabels[status]}
        </span>
      );
    case 'overdue':
      return (
        <span className={`${base} bg-red-50 text-red-700`}>
          • {statusLabels[status]}
        </span>
      );
    case 'cancelled':
      return (
        <span className={`${base} bg-slate-100 text-slate-600`}>
          • {statusLabels[status]}
        </span>
      );
    default:
      return (
        <span className={`${base} bg-amber-50 text-amber-700`}>
          • {statusLabels[status] || status}
        </span>
      );
  }
}

function InvoicesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { clients, loading: clientsLoading } = useUserClients();
  const [invoices] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showNewInvoiceModal, setShowNewInvoiceModal] = useState(false);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [invoiceLines, setInvoiceLines] = useState([
    { id: 'line-1', qty: 1, description: '', price: 100, vat: 0 },
  ]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const matchStatus = statusFilter === 'all' ? true : inv.status === statusFilter;
      const query = search.trim().toLowerCase();
      const matchSearch =
        !query ||
        inv.id.toLowerCase().includes(query) ||
        inv.clientName.toLowerCase().includes(query) ||
        inv.clientEmail.toLowerCase().includes(query);
      return matchStatus && matchSearch;
    });
  }, [statusFilter, search, invoices]);

  const handleNewInvoice = () => {
    setShowNewInvoiceModal(true);
  };

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => {
      const name = c.navn?.toLowerCase?.() || '';
      const email = c.email?.toLowerCase?.() || '';
      const phone = c.telefon?.toLowerCase?.() || '';
      return name.includes(q) || email.includes(q) || phone.includes(q);
    });
  }, [clientSearch, clients]);

  const handleSelectClient = (client) => {
    setSelectedClient(client);
    setClientSearch(client.navn || client.email || '');
  };

  const closeModal = () => {
    setShowNewInvoiceModal(false);
    setShowInvoiceForm(false);
    setClientSearch('');
    setSelectedClient(null);
  };

  const handleLineChange = (lineId, key, value) => {
    setInvoiceLines((prev) =>
      prev.map((line) =>
        line.id === lineId
          ? {
              ...line,
              [key]: key === 'description' ? value : Number(value) || 0,
            }
          : line
      )
    );
  };

  const handleAddLine = () => {
    setInvoiceLines((prev) => [
      ...prev,
      { id: `line-${prev.length + 1}-${Date.now()}`, qty: 1, description: '', price: 0, vat: 0 },
    ]);
  };

  const handleDeleteLine = (lineId) => {
    setInvoiceLines((prev) => (prev.length === 1 ? prev : prev.filter((l) => l.id !== lineId)));
  };

  const totals = useMemo(() => {
    const subtotal = invoiceLines.reduce((sum, line) => sum + (line.qty || 0) * (line.price || 0), 0);
    const vatAmount = invoiceLines.reduce(
      (sum, line) => sum + (line.qty || 0) * (line.price || 0) * ((line.vat || 0) / 100),
      0
    );
    const total = subtotal + vatAmount;
    return { subtotal, vatAmount, total };
  }, [invoiceLines]);

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
        <div className="booking-content">
          <div className="booking-main">
          <div className="flex h-full flex-col gap-4 rounded-2xl bg-slate-50/60 p-4 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-lg font-semibold tracking-tight text-slate-900 md:text-xl">
                  Fakturaer
                </h1>
                <p className="text-xs text-slate-500 md:text-sm">
                  Hold styr på betalinger fra dine patienter og forsikringer.
                </p>
              </div>
              <button
                onClick={handleNewInvoice}
                className="inline-flex items-center rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
              >
                + Ny faktura
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3 rounded-xl bg-white/80 p-3 shadow-sm">
              <div className="flex items-center gap-2">
                <label
                  htmlFor="status-filter"
                  className="text-xs font-medium text-slate-600"
                >
                  Status
                </label>
                <select
                  id="status-filter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="all">Alle</option>
                  <option value="pending">Afventer betaling</option>
                  <option value="paid">Betalt</option>
                  <option value="overdue">Forsinket</option>
                  <option value="cancelled">Annulleret</option>
                </select>
              </div>

              <div className="relative flex-1 min-w-[180px] md:min-w-[260px]">
                <input
                  type="text"
                  placeholder="Søg på klient, e-mail eller fakturanr."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-3 pr-3 text-xs text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 md:text-sm"
                />
              </div>
            </div>

            <div className="flex-1 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
              <div className="max-h-[520px] overflow-auto">
                <table className="min-w-full border-collapse text-left text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-50 text-xs text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Faktura</th>
                      <th className="px-4 py-3 font-medium">Dato</th>
                      <th className="px-4 py-3 font-medium">Klient</th>
                      <th className="px-4 py-3 font-medium text-right">Beløb</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium text-right">Handling</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInvoices.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-8 text-center text-xs text-slate-400"
                        >
                          Ingen fakturaer matcher dine filtre endnu.
                        </td>
                      </tr>
                    )}
                    {filteredInvoices.map((inv) => (
                      <tr
                        key={inv.id}
                        className="border-t border-slate-100 hover:bg-slate-50/70"
                      >
                        <td className="px-4 py-3 align-middle text-xs font-medium text-slate-800 md:text-sm">
                          {inv.id}
                        </td>
                        <td className="px-4 py-3 align-middle text-xs text-slate-600">
                          {inv.date}
                        </td>
                        <td className="px-4 py-3 align-middle text-xs text-slate-700">
                          <div className="flex flex-col">
                            <span>{inv.clientName}</span>
                            <span className="text-[11px] text-slate-400">
                              {inv.clientEmail}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 align-middle text-right text-xs font-medium text-slate-800 md:text-sm">
                          {inv.currency}{' '}
                          {inv.amount.toLocaleString('da-DK', {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <StatusPill status={inv.status} />
                        </td>
                        <td className="px-4 py-3 align-middle text-right">
                          <button
                            className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            onClick={() => console.log('Open invoice', inv.id)}
                          >
                            Detaljer
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2">
                <p className="text-[11px] text-slate-400">
                  Viser {filteredInvoices.length} af {invoices.length} fakturaer.
                </p>
              </div>
            </div>
          </div>
          {showNewInvoiceModal && (
            <div
              className="booking-modal-overlay"
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.32)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 999,
              }}
            >
              <div
                className="booking-modal"
                style={{
                  width: 'min(960px, 92vw)',
                  background: '#fff',
                  borderRadius: '16px',
                  boxShadow: '0 20px 45px rgba(15,23,42,0.12)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    padding: '18px 20px',
                    borderBottom: '1px solid #e5e7eb',
                    fontSize: '16px',
                    fontWeight: 600,
                  }}
                >
                  Ny faktura
                </div>
                <div style={{ padding: '20px', display: 'flex', gap: '12px', flexDirection: 'column' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', marginBottom: '6px' }}>
                      Modtager
                    </div>
                    <div
                      style={{
                        border: '1px solid #e5e7eb',
                        borderRadius: '10px',
                        padding: '10px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        background: '#f8fafc',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="text"
                          placeholder="Søg efter klient..."
                          value={clientSearch}
                          onChange={(e) => {
                            setClientSearch(e.target.value);
                            setSelectedClient(null);
                          }}
                          style={{
                            flex: 1,
                            border: '1px solid #dfe3eb',
                            borderRadius: '8px',
                            padding: '8px 10px',
                            fontSize: '14px',
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => navigate('/booking/klienter')}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: '#2563eb',
                            fontSize: '13px',
                            cursor: 'pointer',
                            textDecoration: 'underline',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Ny klient
                        </button>
                      </div>
                      {clientsLoading ? (
                        <div style={{ fontSize: '13px', color: '#64748b' }}>Henter klienter...</div>
                      ) : (
                        <>
                          {selectedClient && (
                            <div
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: '#e0f2fe',
                                color: '#0ea5e9',
                                padding: '6px 10px',
                                borderRadius: '999px',
                                fontSize: '13px',
                                maxWidth: '100%',
                              }}
                            >
                              {selectedClient.navn || selectedClient.email || 'Valgt klient'}
                              <button
                                type="button"
                                onClick={() => setSelectedClient(null)}
                                style={{
                                  border: 'none',
                                  background: 'transparent',
                                  color: '#0ea5e9',
                                  cursor: 'pointer',
                                  fontWeight: 700,
                                  lineHeight: 1,
                                }}
                              >
                                ×
                              </button>
                            </div>
                          )}
                          <div
                            style={{
                              maxHeight: '180px',
                              overflowY: 'auto',
                              border: '1px solid #e5e7eb',
                              borderRadius: '8px',
                              background: '#fff',
                            }}
                          >
                            {filteredClients.length === 0 ? (
                              <div style={{ padding: '10px 12px', fontSize: '13px', color: '#94a3b8' }}>
                                Ingen klienter fundet.
                              </div>
                            ) : (
                              filteredClients.map((client) => (
                                <button
                                  key={client.id}
                                  type="button"
                                  onClick={() => handleSelectClient(client)}
                                  style={{
                                    width: '100%',
                                    textAlign: 'left',
                                    padding: '10px 12px',
                                    border: 'none',
                                    background: selectedClient?.id === client.id ? '#e2e8f0' : 'transparent',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '4px',
                                  }}
                                >
                                  <span style={{ fontSize: '14px', color: '#0f172a', fontWeight: 600 }}>
                                    {client.navn || 'Uden navn'}
                                  </span>
                                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                                    {client.email || 'Ingen e-mail'} · {client.telefon || 'Ingen tlf.'}
                                  </span>
                                </button>
                              ))
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    borderTop: '1px solid #e5e7eb',
                    padding: '12px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '13px' }}>
                    {/* Placeholder icons/labels to mirror screenshot */}
                    <span role="img" aria-label="payment">💳</span>
                    <span>Betalingsform</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={closeModal}
                      style={{
                        border: '1px solid #e2e8f0',
                        background: '#fff',
                        color: '#0f172a',
                        borderRadius: '10px',
                        padding: '10px 14px',
                        fontSize: '14px',
                        cursor: 'pointer',
                      }}
                    >
                      Luk
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowInvoiceForm(true)}
                      style={{
                        border: 'none',
                        background: '#4f46e5',
                        color: '#fff',
                        borderRadius: '10px',
                        padding: '10px 16px',
                        fontSize: '14px',
                        cursor: 'pointer',
                        boxShadow: '0 6px 18px rgba(79,70,229,0.35)',
                      }}
                      disabled={!selectedClient}
                    >
                      Afregn
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          {showNewInvoiceModal && showInvoiceForm && (
            <div
              className="booking-modal-overlay"
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.32)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
              }}
            >
              <div
                className="booking-modal"
                style={{
                  width: 'min(980px, 94vw)',
                  background: '#fff',
                  borderRadius: '14px',
                  boxShadow: '0 22px 48px rgba(15,23,42,0.16)',
                  overflow: 'hidden',
                  maxHeight: '94vh',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div style={{ padding: '18px 20px', borderBottom: '1px solid #e5e7eb', fontSize: 16, fontWeight: 600 }}>
                  Ny faktura
                </div>
                <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div
                    style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: '10px',
                      padding: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      background: '#f8fafc',
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>Modtager</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <div
                        style={{
                          flex: 1,
                          minWidth: 260,
                          border: '1px solid #dce1ea',
                          borderRadius: '8px',
                          padding: '9px 10px',
                          background: '#fff',
                          fontSize: 14,
                          color: '#0f172a',
                        }}
                      >
                        {selectedClient
                          ? `${selectedClient.navn || ''} <${selectedClient.email || ''}>, ${selectedClient.telefon || ''}`
                          : 'Vælg en klient ovenfor'}
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate('/booking/klienter')}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: '#2563eb',
                          fontSize: 13,
                          textDecoration: 'underline',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Hop til klient
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 220 }}>
                        <label style={{ fontSize: 12, color: '#0f172a', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                          Send faktura via:
                        </label>
                        <select
                          style={{
                            width: '100%',
                            border: '1px solid #dfe3eb',
                            borderRadius: '8px',
                            padding: '8px 10px',
                            fontSize: 14,
                          }}
                          value={selectedClient?.email || ''}
                          onChange={() => {}}
                        >
                          <option>{selectedClient?.email || 'Ingen e-mail valgt'}</option>
                        </select>
                      </div>
                      <div style={{ width: 220 }}>
                        <label style={{ fontSize: 12, color: '#0f172a', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                          Forfaldsdato:
                        </label>
                        <input
                          type="date"
                          value={dueDate}
                          onChange={(e) => setDueDate(e.target.value)}
                          style={{
                            width: '100%',
                            border: '1px solid #dfe3eb',
                            borderRadius: '8px',
                            padding: '8px 10px',
                            fontSize: 14,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: '10px',
                      padding: '12px',
                      background: '#fff',
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', marginBottom: 10 }}>
                      Linjer på fakturaen
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '90px 1fr 140px 160px 60px',
                        gap: '8px',
                        alignItems: 'center',
                        marginBottom: 8,
                        color: '#475569',
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      <span>Antal</span>
                      <span>Beskrivelse</span>
                      <span>Pris uden moms</span>
                      <span>Moms-takst</span>
                      <span style={{ textAlign: 'center' }}>Slet</span>
                    </div>
                    {invoiceLines.map((line) => (
                      <div
                        key={line.id}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '90px 1fr 140px 160px 60px',
                          gap: '8px',
                          alignItems: 'center',
                          marginBottom: 8,
                        }}
                      >
                        <input
                          type="number"
                          min="0"
                          value={line.qty}
                          onChange={(e) => handleLineChange(line.id, 'qty', e.target.value)}
                          style={{
                            border: '1px solid #dfe3eb',
                            borderRadius: '8px',
                            padding: '8px 10px',
                            fontSize: 14,
                          }}
                        />
                        <input
                          type="text"
                          value={line.description}
                          onChange={(e) => handleLineChange(line.id, 'description', e.target.value)}
                          placeholder="Beskrivelse"
                          style={{
                            border: '1px solid #dfe3eb',
                            borderRadius: '8px',
                            padding: '8px 10px',
                            fontSize: 14,
                          }}
                        />
                        <input
                          type="number"
                          min="0"
                          value={line.price}
                          onChange={(e) => handleLineChange(line.id, 'price', e.target.value)}
                          style={{
                            border: '1px solid #dfe3eb',
                            borderRadius: '8px',
                            padding: '8px 10px',
                            fontSize: 14,
                          }}
                        />
                        <select
                          value={line.vat}
                          onChange={(e) => handleLineChange(line.id, 'vat', e.target.value)}
                          style={{
                            border: '1px solid #dfe3eb',
                            borderRadius: '8px',
                            padding: '8px 10px',
                            fontSize: 14,
                          }}
                        >
                          <option value={0}>Brug standardindstill.</option>
                          <option value={25}>25%</option>
                          <option value={12}>12%</option>
                          <option value={6}>6%</option>
                          <option value={0}>0%</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => handleDeleteLine(line.id)}
                          style={{
                            border: '1px solid #e2e8f0',
                            background: '#fff',
                            borderRadius: '8px',
                            padding: '8px',
                            cursor: 'pointer',
                          }}
                        >
                          🗑
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={handleAddLine}
                      style={{
                        marginTop: 6,
                        border: '1px solid #e2e8f0',
                        background: '#fff',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        cursor: 'pointer',
                        fontSize: 14,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      + Tilføj
                    </button>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                    Total: DKK {totals.total.toLocaleString('da-DK', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div
                  style={{
                    borderTop: '1px solid #e5e7eb',
                    padding: '12px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '13px' }}>
                    <span role="img" aria-label="payment">💳</span>
                    <span>Betalingsform</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={closeModal}
                      style={{
                        border: '1px solid #e2e8f0',
                        background: '#fff',
                        color: '#0f172a',
                        borderRadius: '10px',
                        padding: '10px 14px',
                        fontSize: '14px',
                        cursor: 'pointer',
                      }}
                    >
                      Luk
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        console.log('Gem faktura stub', { selectedClient, dueDate, invoiceLines });
                        closeModal();
                      }}
                      style={{
                        border: 'none',
                        background: '#4f46e5',
                        color: '#fff',
                        borderRadius: '10px',
                        padding: '10px 16px',
                        fontSize: '14px',
                        cursor: 'pointer',
                        boxShadow: '0 6px 18px rgba(79,70,229,0.35)',
                      }}
                      disabled={!selectedClient}
                    >
                      Afregn
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </BookingSidebarLayout>
  );
}

export default InvoicesPage;
