import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookingSidebarLayout } from '../../../components/ui/BookingSidebarLayout';
import { useAuth } from '../../../AuthContext';
import { db } from '../../../firebase';
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import './team.css';

const navSections = [
  {
    heading: 'Personligt',
    items: [
      { key: 'Profil', label: 'Profil' },
      { key: 'Adresser', label: 'Adresser' },
      { key: 'Nødkontakter', label: 'Nødkontakter' },
    ],
  },
  {
    heading: 'Arbejdsområde',
    items: [
      { key: 'Tjenester', label: 'Tjenester', count: 3 },
      { key: 'Placeringer', label: 'Placeringer', count: 1 },
      { key: 'Indstillinger', label: 'Indstillinger' },
    ],
  },
  {
    heading: 'Betal',
    items: [
      { key: 'Lønninger', label: 'Lønninger og timesedler' },
      { key: 'Provisioner', label: 'Provisioner' },
      { key: 'Lønkørsler', label: 'Lønkørsler' },
    ],
  },
];

const colorOptions = [
  '#7c3aed',
  '#60a5fa',
  '#93c5fd',
  '#a5b4fc',
  '#c4b5fd',
  '#d8b4fe',
  '#f0abfc',
  '#f9a8d4',
  '#fca5a5',
  '#fdba74',
  '#fbbf24',
  '#fde047',
  '#d9f99d',
  '#86efac',
  '#5eead4',
  '#67e8f9',
];

const mapDocToMember = (docSnap) => {
  const data = docSnap.data() || {};
  const name =
    (typeof data.name === 'string' && data.name.trim()) ||
    `${data.firstName || ''}${data.lastName ? ` ${data.lastName}` : ''}`.trim() ||
    'Medarbejder';
  const avatarText =
    (typeof data.avatarText === 'string' && data.avatarText.trim()) ||
    name.charAt(0).toUpperCase() ||
    '?';

  return {
    id: docSnap.id,
    name,
    firstName: data.firstName || '',
    lastName: data.lastName || '',
    email: data.email || '',
    phone: data.phone || '',
    phoneCountry: data.phoneCountry || '+45',
    phoneLocal: data.phoneLocal || '',
    country: data.country || 'Danmark',
    calendarColor: data.calendarColor || data.avatarColor || colorOptions[0],
    avatarColor: data.avatarColor || data.calendarColor || '#0ea5e9',
    avatarText,
    avatarUrl: data.avatarUrl || '',
    isOwner: data.isOwner === true,
    memberUid: data.memberUid || null,
    role: data.role || '',
  };
};

function TeamMemberForm({ onClose, onSubmit, mode = 'create', initialValues }) {
  const [activeNav, setActiveNav] = useState('Profil');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [form, setForm] = useState(() => ({
    firstName: initialValues?.firstName || '',
    lastName: initialValues?.lastName || '',
    email: initialValues?.email || '',
    phoneCountry: initialValues?.phoneCountry || '+45',
    phone: initialValues?.phone || '',
    country: initialValues?.country || 'Danmark',
    calendarColor: initialValues?.calendarColor || colorOptions[0],
  }));

  const isValid = form.firstName.trim().length > 0 && form.email.trim().length > 3;

  const handleSubmit = async () => {
    if (!isValid || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError('');
    try {
      await onSubmit(form);
    } catch (error) {
      console.error('[Team] Failed to save team member', error);
      setSubmitError('Kunne ikke gemme medarbejderen. Prøv igen.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="team-add-page">
      <div className="team-add-topbar">
        <button type="button" className="team-btn ghost" onClick={onClose}>
          Luk
        </button>
        <button
          type="button"
          className="team-btn primary"
          onClick={handleSubmit}
          disabled={!isValid || isSubmitting}
        >
          {isSubmitting ? (mode === 'edit' ? 'Gemmer…' : 'Tilføjer…') : mode === 'edit' ? 'Gem' : 'Tilføj'}
        </button>
      </div>

      <h1 className="team-add-title">{mode === 'edit' ? 'Rediger medarbejder' : 'Tilføj medarbejder'}</h1>
      {submitError ? <div className="team-add-error">{submitError}</div> : null}

      <div className="team-add-grid">
        <aside className="team-add-sidebar">
          {navSections.map((section) => (
            <div key={section.heading} className="team-add-nav-section">
              <div className="team-add-nav-heading">{section.heading}</div>
              <div className="team-add-nav-items">
                {section.items.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={`team-add-nav-item ${activeNav === item.key ? 'active' : ''}`}
                    onClick={() => setActiveNav(item.key)}
                  >
                    <span>{item.label}</span>
                    {typeof item.count === 'number' ? (
                      <span className="team-add-nav-count">{item.count}</span>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </aside>

        <main className="team-add-main">
          <div className="team-add-section-header">
            <div className="team-add-section-title">Profil</div>
            <div className="team-add-section-subtitle">Administrer dit teammedlems personlige profil</div>
          </div>

          <div className="team-add-avatar">
            <div className="team-add-avatar-circle" style={{ borderColor: form.calendarColor }}>
              <div className="team-add-avatar-icon">👤</div>
            </div>
            <button type="button" className="team-add-avatar-edit" aria-label="Rediger billede">
              ✎
            </button>
          </div>

          <div className="team-form-grid">
            <div className="team-field">
              <label>
                Fornavn <span className="required">*</span>
              </label>
              <input
                value={form.firstName}
                onChange={(e) => setForm((prev) => ({ ...prev, firstName: e.target.value }))}
              />
            </div>
            <div className="team-field">
              <label>Efternavn</label>
              <input
                value={form.lastName}
                onChange={(e) => setForm((prev) => ({ ...prev, lastName: e.target.value }))}
              />
            </div>

            <div className="team-field">
              <label>
                E-mail <span className="required">*</span>
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              />
            </div>

            <div className="team-field">
              <label>Telefonnummer</label>
              <div className="team-phone-row">
                <select
                  value={form.phoneCountry}
                  onChange={(e) => setForm((prev) => ({ ...prev, phoneCountry: e.target.value }))}
                >
                  <option value="+45">+45</option>
                  <option value="+46">+46</option>
                  <option value="+47">+47</option>
                  <option value="+49">+49</option>
                </select>
                <input
                  value={form.phone}
                  onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                />
              </div>
            </div>

            <div className="team-field">
              <label>Land</label>
              <select
                value={form.country}
                onChange={(e) => setForm((prev) => ({ ...prev, country: e.target.value }))}
              >
                <option>Danmark</option>
                <option>Sverige</option>
                <option>Norge</option>
                <option>Tyskland</option>
              </select>
            </div>
          </div>

          <div className="team-color-picker">
            <div className="team-color-title">Kalenderfarve</div>
            <div className="team-color-grid">
              {colorOptions.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`team-color-swatch ${form.calendarColor === color ? 'selected' : ''}`}
                  style={{ backgroundColor: color }}
                  onClick={() => setForm((prev) => ({ ...prev, calendarColor: color }))}
                  aria-label={`Vælg farve ${color}`}
                />
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function TeamPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [teamAccessLoading, setTeamAccessLoading] = useState(true);
  const [hasTeamAccess, setHasTeamAccess] = useState(false);

  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [membersError, setMembersError] = useState('');
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState('name');

  const [formMode, setFormMode] = useState(null); // null | 'create' | 'edit'
  const [editingMember, setEditingMember] = useState(null);
  const seedAttemptedRef = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (!user?.uid) {
      navigate('/signup', { replace: true });
      return;
    }

    let unsub = () => {};
    setTeamAccessLoading(true);

    unsub = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        const data = snap.exists() ? snap.data() : null;
        const allowed = data?.accountType === 'team' || data?.hasTeam === true;
        setHasTeamAccess(allowed);
        setTeamAccessLoading(false);
        if (!allowed) {
          navigate('/booking', { replace: true });
        }
      },
      (err) => {
        console.error('[TeamPage] Failed to load account type', err);
        setHasTeamAccess(false);
        setTeamAccessLoading(false);
        navigate('/booking', { replace: true });
      }
    );

    return () => unsub();
  }, [loading, navigate, user?.uid]);

  useEffect(() => {
    if (teamAccessLoading || !hasTeamAccess || !user?.uid) {
      setMembers([]);
      setMembersLoading(false);
      setMembersError('');
      return;
    }

    setMembersLoading(true);
    setMembersError('');
    seedAttemptedRef.current = false;

    const membersRef = collection(db, 'users', user.uid, 'team');
    const source = query(membersRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(
      source,
      async (snapshot) => {
        const loadedMembers = snapshot.docs.map(mapDocToMember);
        setMembers(loadedMembers);
        setMembersLoading(false);

        if (!seedAttemptedRef.current) {
          const hasOwner = snapshot.docs.some((docSnap) => {
            const docData = docSnap.data();
            return docSnap.id === user.uid || docData?.memberUid === user.uid || docData?.isOwner === true;
          });

          if (!hasOwner) {
            seedAttemptedRef.current = true;
            const displayName = user.displayName || '';
            const [firstName, ...rest] = displayName.split(' ').filter(Boolean);
            const lastName = rest.join(' ');
            const name = displayName || user.email || 'Medarbejder';
            const avatarText = name.charAt(0).toUpperCase() || 'S';
            const ownerPayload = {
              name,
              firstName: firstName || '',
              lastName,
              email: user.email || '',
              phone: '',
              phoneCountry: '+45',
              phoneLocal: '',
              country: 'Danmark',
              calendarColor: '#7c3aed',
              avatarColor: '#7c3aed',
              avatarText,
              role: 'S',
              isOwner: true,
              memberUid: user.uid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            };

            try {
              await setDoc(doc(db, 'users', user.uid, 'team', user.uid), ownerPayload, { merge: true });
            } catch (error) {
              console.error('[TeamPage] Failed to seed owner team member', error);
            }
          }
        }
      },
      (error) => {
        console.error('[TeamPage] Error loading members', error);
        setMembers([]);
        setMembersLoading(false);
        setMembersError('Kunne ikke hente medarbejdere. Prøv igen senere.');
      }
    );

    return () => unsubscribe();
  }, [hasTeamAccess, teamAccessLoading, user?.displayName, user?.email, user?.uid]);

  const filteredMembers = useMemo(() => {
    const term = search.trim().toLowerCase();
    const base = term
      ? members.filter((m) => (m.name || '').toLowerCase().includes(term) || (m.email || '').toLowerCase().includes(term))
      : members.slice();
    if (sortMode === 'name') return base.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    return base;
  }, [members, search, sortMode]);

  const openCreate = () => {
    setEditingMember(null);
    setFormMode('create');
  };

  const openEdit = (member) => {
    setEditingMember(member);
    setFormMode('edit');
  };

  const closeForm = () => {
    setEditingMember(null);
    setFormMode(null);
  };

  const handleCreateMember = async (form) => {
    if (!user?.uid) return;
    const name = `${form.firstName}${form.lastName ? ` ${form.lastName}` : ''}`.trim();
    const initials = (form.firstName?.charAt(0) || '?').toUpperCase();
    const phoneComplete = form.phone ? `${form.phoneCountry} ${form.phone}`.trim() : '';

    const payload = {
      name,
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      phone: phoneComplete,
      phoneCountry: form.phoneCountry,
      phoneLocal: form.phone,
      country: form.country,
      calendarColor: form.calendarColor,
      avatarColor: form.calendarColor,
      avatarText: initials,
      role: 'S',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await addDoc(collection(db, 'users', user.uid, 'team'), payload);
    closeForm();
  };

  const handleUpdateMember = async (memberId, form) => {
    if (!user?.uid || !memberId) return;
    const name = `${form.firstName}${form.lastName ? ` ${form.lastName}` : ''}`.trim();
    const initials = (form.firstName?.charAt(0) || '?').toUpperCase();
    const phoneComplete = form.phone ? `${form.phoneCountry} ${form.phone}`.trim() : '';

    await updateDoc(doc(db, 'users', user.uid, 'team', memberId), {
      name,
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      phone: phoneComplete,
      phoneCountry: form.phoneCountry,
      phoneLocal: form.phone,
      country: form.country,
      calendarColor: form.calendarColor,
      avatarColor: form.calendarColor,
      avatarText: initials,
      updatedAt: serverTimestamp(),
    });
    closeForm();
  };

  if (formMode) {
    const initialValues = editingMember
      ? {
          firstName: editingMember.firstName,
          lastName: editingMember.lastName,
          email: editingMember.email,
          phoneCountry: editingMember.phoneCountry || '+45',
          phone: editingMember.phoneLocal || '',
          country: editingMember.country || 'Danmark',
          calendarColor: editingMember.calendarColor || colorOptions[0],
        }
      : null;

    return (
      <BookingSidebarLayout>
        <TeamMemberForm
          mode={formMode === 'edit' ? 'edit' : 'create'}
          initialValues={initialValues}
          onClose={closeForm}
          onSubmit={(form) =>
            formMode === 'edit' ? handleUpdateMember(editingMember?.id, form) : handleCreateMember(form)
          }
        />
      </BookingSidebarLayout>
    );
  }

  return (
    <BookingSidebarLayout>
      <div className="team-page">
        <div className="team-header">
          <div className="team-title">
            Medarbejdere <span className="team-count">{filteredMembers.length}</span>
            {membersLoading ? <span className="team-loading-pill">Henter…</span> : null}
          </div>
          <div className="team-actions">
            <button type="button" className="team-btn primary" onClick={openCreate}>
              Tilføj
            </button>
          </div>
        </div>

        {membersError ? <div className="team-error-banner">{membersError}</div> : null}

        <div className="team-controls">
          <div className="team-search">
            <span>🔍</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Søg i medarbejdere" />
          </div>
          <div className="team-controls-right">
            <select className="team-select" value={sortMode} onChange={(e) => setSortMode(e.target.value)}>
              <option value="name">Tilpasset ordre</option>
            </select>
          </div>
        </div>

        <div className="team-table">
          <div className="team-row head">
            <div className="team-cell checkbox">
              <input type="checkbox" disabled />
            </div>
            <div className="team-cell">Navn</div>
            <div className="team-cell">Kontakt</div>
            <div className="team-cell">Bedømmelse</div>
            <div className="team-cell">Handling…</div>
          </div>

          {filteredMembers.map((member) => (
            <div key={member.id} className="team-row">
              <div className="team-cell checkbox">
                <input type="checkbox" />
              </div>
              <div className="team-cell name">
                <span className="avatar" style={{ background: member.avatarColor || '#0ea5e9' }}>
                  {member.avatarUrl ? <img src={member.avatarUrl} alt={member.name} /> : member.avatarText}
                </span>
                <span className="name-info">
                  <span className="name-text">{member.name}</span>
                  <span className="name-role">{member.isOwner ? 'Ejer' : 'Medarbejder'}</span>
                </span>
              </div>
              <div className="team-cell">
                <div className="name-info">
                  <span className="contact-link">{member.email}</span>
                  <span className="contact-phone">{member.phone}</span>
                </div>
              </div>
              <div className="team-cell">
                <span className="rating-text">Ingen anmeldelser endnu</span>
              </div>
              <div className="team-cell">
                <button type="button" className="team-btn ghost small" onClick={() => openEdit(member)}>
                  Rediger
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </BookingSidebarLayout>
  );
}

export default TeamPage;
