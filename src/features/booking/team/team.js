import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { deleteApp, initializeApp } from 'firebase/app';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { createUserWithEmailAndPassword, getAuth, signOut as signOutAuth } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { BookingSidebarLayout } from '../../../components/ui/BookingSidebarLayout';
import { useAuth } from '../../../AuthContext';
import { auth, db } from '../../../firebase';
import { getIdToken } from '../../../utils/auth';
import { resolveUserWorkspace } from '../../../utils/employeeWorkspace';
import { buildApiUrl } from '../../../utils/runtimeUrls';
import {
  buildBaseUsername,
  buildTeamLoginEmail,
  generateUniqueSummerPassword,
  normalizeTeamLoginUsername,
  withUsernameSuffix,
} from '../../../utils/teamLogin';
import './team.css';

const navSections = [
  {
    heading: 'Personligt',
    items: [{ key: 'Profil', label: 'Profil' }],
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

const resolveTimestamp = (value) => {
  if (!value) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (typeof value.toDate === 'function') {
    return value.toDate().getTime();
  }
  if (typeof value.seconds === 'number') {
    return value.seconds * 1000;
  }
  return null;
};

const mapDocToMember = (docSnap, options = {}) => {
  const ownerUid = `${options.ownerUid || ''}`.trim();
  const ownerName = `${options.ownerName || ''}`.trim();
  const data = docSnap.data() || {};
  const role = `${data.role || ''}`.trim().toLowerCase() === 'owner' || data.isOwner === true
    ? 'owner'
    : 'member';
  const rawName =
    (typeof data.name === 'string' && data.name.trim()) ||
    `${data.firstName || ''}${data.lastName ? ` ${data.lastName}` : ''}`.trim() ||
    'Medarbejder';
  const isOwnerRecord =
    role === 'owner' || `${docSnap.id || ''}`.trim() === ownerUid || `${data.memberUid || ''}`.trim() === ownerUid;
  const name =
    isOwnerRecord &&
    ownerName &&
    rawName.trim().toLowerCase() === 'medarbejder' &&
    ownerName.toLowerCase() !== 'medarbejder'
      ? ownerName
      : rawName;
  const avatarText =
    (typeof data.avatarText === 'string' && data.avatarText.trim()) ||
    name.charAt(0).toUpperCase() ||
    '?';
  const createdAtMs = resolveTimestamp(data.createdAt);

  return {
    id: docSnap.id,
    name,
    firstName: data.firstName || '',
    lastName: data.lastName || '',
    email: data.contactEmail || data.email || '',
    authEmail: data.email || data.authEmail || '',
    phone: data.phone || '',
    phoneCountry: data.phoneCountry || '+45',
    phoneLocal: data.phoneLocal || '',
    country: data.country || 'Danmark',
    calendarColor: data.calendarColor || data.avatarColor || colorOptions[0],
    avatarColor: data.avatarColor || data.calendarColor || '#0ea5e9',
    avatarText,
    avatarUrl: data.avatarUrl || '',
    isOwner: role === 'owner',
    memberUid: data.memberUid || docSnap.id || null,
    role,
    createdAtMs,
    loginUsername: data.loginUsername || '',
    loginPasswordHash: data.loginPasswordHash || '',
    loginEnabled: data.loginEnabled === true,
  };
};

const provisionMemberAuthAccount = async ({ email, password }) => {
  const options = auth?.app?.options;
  if (!options) {
    throw new Error('Firebase auth config missing.');
  }

  const appName = `team-provision-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const secondaryApp = initializeApp(options, appName);
  const secondaryAuth = getAuth(secondaryApp);

  try {
    const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    await signOutAuth(secondaryAuth);
    return credential;
  } finally {
    await deleteApp(secondaryApp).catch(() => {});
  }
};

const parseJsonSafely = async (response) => {
  try {
    return await response.json();
  } catch (_error) {
    return null;
  }
};

const sendMemberLoginByEmail = async ({
  clinicId,
  memberUid,
  memberName,
  username,
  password,
  contactEmail,
}) => {
  const recipient = `${contactEmail || ''}`.trim();
  if (!recipient) {
    return {
      sent: false,
      to: '',
      error: 'Kontakt-email mangler, så login kunne ikke sendes.',
    };
  }

  try {
    const token = await getIdToken();
    const response = await fetch(buildApiUrl('/api/team/send-member-login'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clinicId,
        memberUid,
        memberName,
        username,
        password,
        contactEmail: recipient,
      }),
    });
    const payload = await parseJsonSafely(response);
    if (!response.ok) {
      return {
        sent: false,
        to: '',
        error: payload?.error || 'Kunne ikke sende login-oplysninger via e-mail.',
      };
    }
    return {
      sent: payload?.sent === true,
      to: payload?.to || recipient,
      error: payload?.error || null,
    };
  } catch (error) {
    return {
      sent: false,
      to: '',
      error: error?.message || 'Uventet fejl ved afsendelse af e-mail.',
    };
  }
};

const provisionMemberAuthAccountViaApi = async ({
  clinicId,
  authEmail,
  password,
  memberName,
}) => {
  const token = await getIdToken();
  const response = await fetch(buildApiUrl('/api/team/provision-member-auth'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      clinicId,
      authEmail,
      password,
      memberName,
    }),
  });

  const payload = await parseJsonSafely(response);
  if (!response.ok) {
    const err = new Error(payload?.error || 'Kunne ikke oprette medarbejder-login.');
    err.code = payload?.code || payload?.errorCode || `http-${response.status}`;
    throw err;
  }

  return {
    uid: `${payload?.uid || ''}`.trim(),
    email: `${payload?.email || authEmail || ''}`.trim(),
  };
};

const removeTeamMemberViaApi = async ({ clinicId, memberUid }) => {
  const safeClinicId = `${clinicId || ''}`.trim();
  const safeMemberUid = `${memberUid || ''}`.trim();
  if (!safeClinicId || !safeMemberUid) {
    throw new Error('Mangler klinik-id eller medarbejder-id.');
  }

  const token = await getIdToken();
  const response = await fetch(buildApiUrl('/api/team/remove-member'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      clinicId: safeClinicId,
      memberUid: safeMemberUid,
    }),
  });

  const payload = await parseJsonSafely(response);
  if (!response.ok) {
    throw new Error(payload?.error || 'Kunne ikke fjerne medarbejderen.');
  }
};

const toSubmitErrorMessage = (error) => {
  const code = `${error?.code || ''}`.toLowerCase();
  if (code === 'permission-denied' || code.includes('permission')) {
    return 'Du har ikke adgang til at oprette medarbejdere i denne klinik.';
  }
  if (code.includes('operation-not-allowed')) {
    return 'Email/password-login er ikke aktiveret i Firebase Auth.';
  }
  if (code.includes('invalid-email')) {
    return 'Det auto-genererede login kunne ikke oprettes (ugyldig e-mail).';
  }
  if (code.includes('weak-password') || code.includes('invalid-password')) {
    return 'Auto-genereret adgangskode blev afvist. Prøv igen.';
  }
  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message.trim();
  }
  return 'Kunne ikke tilføje medarbejderen. Prøv igen.';
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

  const isValid = form.firstName.trim().length > 0;

  const handleSubmit = async () => {
    if (!isValid || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError('');
    try {
      await onSubmit(form);
    } catch (error) {
      console.error('[Team] Failed to save team member', error);
      setSubmitError(toSubmitErrorMessage(error));
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
                    {typeof item.count === 'number' ? <span className="team-add-nav-count">{item.count}</span> : null}
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

          {mode === 'create' ? (
            <div className="team-login-hint">
              Brugernavn og adgangskode oprettes automatisk ved tilføj.
            </div>
          ) : null}

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
              <label>E-mail (kontakt)</label>
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
  const { user, userDoc, loading, workspaceUid } = useAuth();
  const sessionUid = user?.uid || null;
  const ownerUid = `${workspaceUid || sessionUid || ''}`.trim();
  const isWorkspaceOwner = Boolean(sessionUid && ownerUid && sessionUid === ownerUid);

  const [activeClinicId, setActiveClinicId] = useState(null);
  const [clinicName, setClinicName] = useState('Klinik');

  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [membersError, setMembersError] = useState('');
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState('custom');

  const [formMode, setFormMode] = useState(null); // null | 'create' | 'edit'
  const [editingMember, setEditingMember] = useState(null);
  const [generatedCredentials, setGeneratedCredentials] = useState(null);
  const [removingMemberId, setRemovingMemberId] = useState('');
  const seedAttemptedRef = useRef(false);

  const ensureClinicDocument = useCallback(
    async (clinicId) => {
      const resolvedClinicId = `${clinicId || ''}`.trim();
      if (!resolvedClinicId) return null;
      if (!isWorkspaceOwner) {
        return resolvedClinicId;
      }

      try {
        const clinicRef = doc(db, 'clinics', resolvedClinicId);
        const clinicSnap = await getDoc(clinicRef);
        if (!clinicSnap.exists()) {
          const fallbackName =
            `${userDoc?.clinicName || user?.displayName || user?.email || ''}`.trim() || 'Klinik';
          await setDoc(
            clinicRef,
            {
              ownerUid: sessionUid,
              clinicType: userDoc?.accountType === 'team' ? 'team' : 'solo',
              name: fallbackName,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        }

        await setDoc(
          doc(db, 'users', sessionUid),
          {
            activeClinicId: resolvedClinicId,
            clinicId: resolvedClinicId,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (error) {
        console.error('[TeamPage] Failed to ensure clinic document', error);
      }

      return resolvedClinicId;
    },
    [
      isWorkspaceOwner,
      sessionUid,
      user?.displayName,
      user?.email,
      userDoc?.accountType,
      userDoc?.clinicName,
    ]
  );

  useEffect(() => {
    if (loading) return;
    if (!sessionUid) {
      navigate('/signup', { replace: true });
      return;
    }

    const unsubscribe = onSnapshot(
      doc(db, 'users', sessionUid),
      (snap) => {
        const data = snap.exists() ? snap.data() : null;
        const resolvedClinicId = `${data?.activeClinicId || ''}`.trim() || null;
        setActiveClinicId(resolvedClinicId);
        if (!resolvedClinicId) {
          void resolveUserWorkspace(sessionUid).catch((workspaceError) => {
            console.error('[TeamPage] Failed to resolve workspace', workspaceError);
          });
        }
      },
      (err) => {
        console.error('[TeamPage] Failed to load account type', err);
        setActiveClinicId(null);
      }
    );

    return () => unsubscribe();
  }, [loading, navigate, sessionUid]);

  useEffect(() => {
    if (!activeClinicId) {
      setClinicName(userDoc?.clinicName || 'Klinik');
      return;
    }

    const unsubscribe = onSnapshot(
      doc(db, 'clinics', activeClinicId),
      (snap) => {
        const data = snap.exists() ? snap.data() : null;
        const resolved =
          `${data?.name || data?.clinicName || userDoc?.clinicName || ''}`.trim() || 'Klinik';
        setClinicName(resolved);
      },
      () => {
        setClinicName(userDoc?.clinicName || 'Klinik');
      }
    );

    return () => unsubscribe();
  }, [activeClinicId, userDoc?.clinicName]);

  useEffect(() => {
    if (!sessionUid || !activeClinicId) {
      setMembers([]);
      setMembersLoading(false);
      setMembersError('');
      return;
    }

    setMembersLoading(true);
    setMembersError('');
    seedAttemptedRef.current = false;

    const ownerUidFromWorkspace = workspaceUid || sessionUid;
    let unsubscribePrimary = () => {};
    let cancelled = false;

    const startSubscription = async () => {
      const resolvedClinicId = await ensureClinicDocument(activeClinicId);
      if (cancelled || !resolvedClinicId) {
        return;
      }

      const membersRef = collection(db, 'clinics', resolvedClinicId, 'members');
      const source = query(membersRef, orderBy('createdAt', 'asc'));

      unsubscribePrimary = onSnapshot(
        source,
        async (snapshot) => {
          if (cancelled) return;
          const ownerDoc = snapshot.docs.find((docSnap) => {
            const data = docSnap.data() || {};
            return (
              docSnap.id === ownerUidFromWorkspace ||
              `${data.memberUid || ''}`.trim() === ownerUidFromWorkspace ||
              `${data.role || ''}`.trim().toLowerCase() === 'owner' ||
              data.isOwner === true
            );
          });
          const ownerData = ownerDoc?.data() || {};
          const ownerDisplayName =
            `${ownerData.name || ownerData.displayName || ''}`.trim() ||
            (isWorkspaceOwner ? `${user?.displayName || user?.email || ''}`.trim() : 'Ejer');

          const loadedMembers = snapshot.docs.map((docSnap) =>
            mapDocToMember(docSnap, {
              ownerUid: ownerUidFromWorkspace,
              ownerName: ownerDisplayName,
            })
          );
          setMembers(loadedMembers);
          setMembersLoading(false);
          setMembersError('');

          if (!seedAttemptedRef.current && isWorkspaceOwner && ownerUidFromWorkspace) {
            const hasOwner = snapshot.docs.some((docSnap) => {
              const docData = docSnap.data();
              return (
                docSnap.id === ownerUidFromWorkspace ||
                docData?.memberUid === ownerUidFromWorkspace ||
                docData?.isOwner === true
              );
            });

            if (!hasOwner) {
              seedAttemptedRef.current = true;
              const displayName = user?.displayName || '';
              const [firstName, ...rest] = displayName.split(' ').filter(Boolean);
              const lastName = rest.join(' ');
              const name = displayName || user?.email || 'Medarbejder';
              const avatarText = name.charAt(0).toUpperCase() || 'S';
              const ownerPayload = {
                name,
                firstName: firstName || '',
                lastName,
                email: user?.email || '',
                contactEmail: user?.email || '',
                phone: '',
                phoneCountry: '+45',
                phoneLocal: '',
                country: 'Danmark',
                calendarColor: '#7c3aed',
                avatarColor: '#7c3aed',
                avatarText,
                role: 'owner',
                isOwner: true,
                memberUid: ownerUidFromWorkspace,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              };

              try {
                await setDoc(doc(db, 'clinics', resolvedClinicId, 'members', ownerUidFromWorkspace), ownerPayload, {
                  merge: true,
                });
              } catch (error) {
                console.error('[TeamPage] Failed to seed owner team member', error);
              }
            }
          }
        },
        (error) => {
          if (cancelled) return;
          console.error('[TeamPage] Error loading members', error);
          setMembers([]);
          setMembersLoading(false);
          setMembersError('Kunne ikke hente medarbejdere. Prøv igen senere.');
        }
      );
    };

    void startSubscription();

    return () => {
      cancelled = true;
      unsubscribePrimary();
    };
  }, [
    activeClinicId,
    ensureClinicDocument,
    isWorkspaceOwner,
    sessionUid,
    user?.displayName,
    user?.email,
    workspaceUid,
  ]);

  const filteredMembers = useMemo(() => {
    const term = search.trim().toLowerCase();
    const base = term
      ? members.filter(
          (m) =>
            (m.name || '').toLowerCase().includes(term) ||
            (m.email || '').toLowerCase().includes(term) ||
            (m.loginUsername || '').toLowerCase().includes(term)
        )
      : members.slice();

    if (sortMode === 'newest') {
      return base
        .map((member, index) => ({ member, index }))
        .sort((a, b) => {
          const ownerDiff = Number(a.member.isOwner) - Number(b.member.isOwner);
          if (ownerDiff !== 0) return ownerDiff;
          const aTime = a.member.createdAtMs ?? Number.NEGATIVE_INFINITY;
          const bTime = b.member.createdAtMs ?? Number.NEGATIVE_INFINITY;
          if (aTime !== bTime) return bTime - aTime;
          return a.index - b.index;
        })
        .map(({ member }) => member);
    }

    if (sortMode === 'ownerTop') {
      return base
        .map((member, index) => ({ member, index }))
        .sort((a, b) => {
          const ownerDiff = Number(b.member.isOwner) - Number(a.member.isOwner);
          if (ownerDiff !== 0) return ownerDiff;
          const aTime = a.member.createdAtMs ?? Number.POSITIVE_INFINITY;
          const bTime = b.member.createdAtMs ?? Number.POSITIVE_INFINITY;
          if (aTime !== bTime) return aTime - bTime;
          return a.index - b.index;
        })
        .map(({ member }) => member);
    }

    return base;
  }, [members, search, sortMode]);

  const openCreate = () => {
    setEditingMember(null);
    setGeneratedCredentials(null);
    setFormMode('create');
  };

  const openEdit = (member) => {
    setEditingMember(member);
    setGeneratedCredentials(null);
    setFormMode('edit');
  };

  const closeForm = () => {
    setEditingMember(null);
    setFormMode(null);
  };

  const handleCreateMember = async (form) => {
    if (!sessionUid || !ownerUid) return;
    const targetClinicId = `${activeClinicId || ''}`.trim();
    if (!targetClinicId) {
      throw new Error('Mangler klinik-id.');
    }

    await ensureClinicDocument(targetClinicId);

    const name = `${form.firstName}${form.lastName ? ` ${form.lastName}` : ''}`.trim();
    const initials = (form.firstName?.charAt(0) || '?').toUpperCase();
    const phoneComplete = form.phone ? `${form.phoneCountry} ${form.phone}`.trim() : '';

    const usedClinicUsernames = new Set(
      members
        .map((member) => normalizeTeamLoginUsername(member.loginUsername || ''))
        .filter(Boolean)
    );
    const usedPasswordHashes = new Set(
      members
        .map((member) => String(member.loginPasswordHash || '').trim())
        .filter(Boolean)
    );

    const { password, hash: passwordHash } = generateUniqueSummerPassword({
      usedHashes: usedPasswordHashes,
    });

    const baseUsername = buildBaseUsername({
      clinicName,
      firstName: form.firstName,
      lastName: form.lastName,
      fallbackName: name,
    });

    let allocatedUsername = '';
    let allocatedAuthEmail = '';
    let memberUid = '';

    for (let attempt = 0; attempt < 100; attempt += 1) {
      const candidate = withUsernameSuffix(baseUsername, attempt === 0 ? 0 : attempt);
      if (usedClinicUsernames.has(candidate)) {
        continue;
      }

      const authEmail = buildTeamLoginEmail(candidate);
      if (!authEmail) {
        continue;
      }

      try {
        const credential = await provisionMemberAuthAccount({
          email: authEmail,
          password,
        });
        allocatedUsername = candidate;
        allocatedAuthEmail = authEmail;
        memberUid = credential?.user?.uid || '';
        break;
      } catch (error) {
        if (error?.code === 'auth/email-already-in-use') {
          usedClinicUsernames.add(candidate);
          continue;
        }
        try {
          const provisioned = await provisionMemberAuthAccountViaApi({
            clinicId: targetClinicId,
            authEmail,
            password,
            memberName: name || candidate,
          });
          allocatedUsername = candidate;
          allocatedAuthEmail = provisioned.email || authEmail;
          memberUid = provisioned.uid;
          break;
        } catch (apiError) {
          const apiCode = `${apiError?.code || ''}`.toLowerCase();
          if (apiCode.includes('email-already-exists')) {
            usedClinicUsernames.add(candidate);
            continue;
          }
          throw apiError;
        }
      }
    }

    if (!memberUid || !allocatedUsername || !allocatedAuthEmail) {
      throw new Error('Kunne ikke generere et unikt brugernavn.');
    }

    const memberPayload = {
      name,
      firstName: form.firstName,
      lastName: form.lastName,
      email: allocatedAuthEmail,
      contactEmail: form.email || '',
      phone: phoneComplete,
      phoneCountry: form.phoneCountry,
      phoneLocal: form.phone,
      country: form.country,
      calendarColor: form.calendarColor,
      avatarColor: form.calendarColor,
      avatarText: initials,
      role: 'member',
      isOwner: false,
      memberUid,
      uid: memberUid,
      loginUsername: allocatedUsername,
      loginPasswordHash: passwordHash,
      loginEnabled: true,
      loginGeneratedByUid: sessionUid,
      loginGeneratedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, 'clinics', targetClinicId, 'members', memberUid), memberPayload, {
        merge: true,
      });
    } catch (error) {
      console.error('[TeamPage] Failed to write member into clinic members', error);
      throw error || new Error('Kunne ikke gemme medarbejderen.');
    }

    try {
      await setDoc(
        doc(db, 'users', ownerUid),
        {
          hasTeam: true,
          activeClinicId: targetClinicId,
          clinicId: targetClinicId,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (error) {
      console.error('[TeamPage] Failed to update owner team metadata', error);
    }

    const emailDelivery = await sendMemberLoginByEmail({
      clinicId: targetClinicId,
      memberUid,
      memberName: name || allocatedUsername,
      username: allocatedUsername,
      password,
      contactEmail: form.email || '',
    });

    setGeneratedCredentials({
      memberName: name || allocatedUsername,
      username: allocatedUsername,
      password,
      emailDelivery,
    });

    closeForm();
  };

  const handleUpdateMember = async (memberId, form) => {
    if (!memberId || !activeClinicId || !ownerUid) return;

    const name = `${form.firstName}${form.lastName ? ` ${form.lastName}` : ''}`.trim();
    const initials = (form.firstName?.charAt(0) || '?').toUpperCase();
    const phoneComplete = form.phone ? `${form.phoneCountry} ${form.phone}`.trim() : '';

    const payload = {
      name,
      firstName: form.firstName,
      lastName: form.lastName,
      contactEmail: form.email,
      phone: phoneComplete,
      phoneCountry: form.phoneCountry,
      phoneLocal: form.phone,
      country: form.country,
      calendarColor: form.calendarColor,
      avatarColor: form.calendarColor,
      avatarText: initials,
      updatedAt: serverTimestamp(),
    };

    await setDoc(doc(db, 'clinics', activeClinicId, 'members', memberId), payload, { merge: true });

    closeForm();
  };

  const handleRemoveMember = async (member) => {
    if (!member || member.isOwner) return;
    const targetClinicId = `${activeClinicId || ''}`.trim();
    const targetMemberUid = `${member.memberUid || member.id || ''}`.trim();
    if (!targetClinicId || !targetMemberUid) {
      setMembersError('Kunne ikke identificere medarbejderen.');
      return;
    }

    const confirmed = window.confirm(
      `Er du sikker på, at du vil fjerne ${member.name || 'denne medarbejder'} fra klinikken?`
    );
    if (!confirmed) return;

    setRemovingMemberId(member.id);
    setMembersError('');
    try {
      await removeTeamMemberViaApi({
        clinicId: targetClinicId,
        memberUid: targetMemberUid,
      });
    } catch (error) {
      console.error('[TeamPage] Failed to remove member', error);
      setMembersError(error?.message || 'Kunne ikke fjerne medarbejderen.');
    } finally {
      setRemovingMemberId('');
    }
  };

  const copyLatestCredentials = async () => {
    if (!generatedCredentials || !navigator?.clipboard) return;
    const content = `Brugernavn: ${generatedCredentials.username}\nAdgangskode: ${generatedCredentials.password}`;
    try {
      await navigator.clipboard.writeText(content);
    } catch (error) {
      console.error('[TeamPage] Failed to copy credentials', error);
    }
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

        {generatedCredentials ? (
          <div className="team-login-banner">
            <div className="team-login-banner-title">Nyt medarbejder-login er klar</div>
            <div className="team-login-banner-row">
              <span>Medarbejder: {generatedCredentials.memberName}</span>
              <span>
                Brugernavn: <code>{generatedCredentials.username}</code>
              </span>
              <span>
                Adgangskode: <code>{generatedCredentials.password}</code>
              </span>
            </div>
            {generatedCredentials.emailDelivery ? (
              <div
                className={`team-login-email-status ${
                  generatedCredentials.emailDelivery.sent ? 'success' : 'warning'
                }`}
              >
                {generatedCredentials.emailDelivery.sent
                  ? `Login-oplysninger er sendt til ${generatedCredentials.emailDelivery.to || 'medarbejderens e-mail'}.`
                  : `Login-oplysninger blev ikke sendt på e-mail. ${generatedCredentials.emailDelivery.error || ''}`}
              </div>
            ) : null}
            <div className="team-login-banner-actions">
              <button type="button" className="team-btn ghost small" onClick={copyLatestCredentials}>
                Kopiér login
              </button>
              <button
                type="button"
                className="team-btn ghost small"
                onClick={() => setGeneratedCredentials(null)}
              >
                Skjul
              </button>
            </div>
          </div>
        ) : null}

        {membersError ? <div className="team-error-banner">{membersError}</div> : null}

        <div className="team-controls">
          <div className="team-search">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Søg i medarbejdere" />
          </div>
          <div className="team-controls-right">
            <select className="team-select" value={sortMode} onChange={(e) => setSortMode(e.target.value)}>
              <option value="custom">Tilpasset ordre</option>
              <option value="newest">Nyeste tilføjet</option>
              <option value="ownerTop">Ejer øverst</option>
            </select>
          </div>
        </div>

        <div className="team-table">
          <div className="team-row head">
            <div className="team-cell">Navn</div>
            <div className="team-cell">Kontakt</div>
            <div className="team-cell actions">Handlinger</div>
          </div>

          {filteredMembers.map((member) => (
            <div key={member.id} className="team-row">
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
                  {member.email ? (
                    <a className="contact-link" href={`mailto:${member.email}`}>
                      {member.email}
                    </a>
                  ) : (
                    <span className="contact-muted">Ingen e-mail</span>
                  )}
                  {member.phone ? <span className="contact-phone">{member.phone}</span> : null}
                  {member.loginUsername ? (
                    <span className="contact-muted">
                      Login: <strong>{member.loginUsername}</strong>
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="team-cell actions">
                <button type="button" className="team-btn ghost small" onClick={() => openEdit(member)}>
                  Rediger
                </button>
                {!member.isOwner ? (
                  <button
                    type="button"
                    className="team-btn danger small"
                    onClick={() => handleRemoveMember(member)}
                    disabled={removingMemberId === member.id}
                  >
                    {removingMemberId === member.id ? 'Fjerner…' : 'Fjern'}
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </BookingSidebarLayout>
  );
}

export default TeamPage;
