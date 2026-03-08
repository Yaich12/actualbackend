import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDoc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { useLocation, useNavigate } from 'react-router-dom';
import './usersettings.css';
import './bookingpage.css';
import { BookingSidebarLayout } from '../../components/ui/BookingSidebarLayout';
import { auth, db, storage } from '../../firebase';
import { useAuth } from '../../AuthContext';
import { useLanguage } from '../../LanguageContext';
import { updateProfile } from 'firebase/auth';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import {
  dedupeClinicMembers,
  isOwnerMemberForUid,
  mapClinicMemberDoc,
} from './team/clinicMembers';
import {
  WORK_HOURS_DAYS,
  buildWorkHoursExceptionsPayload,
  buildWorkHoursPayload,
  createDefaultWorkHours,
  getWorkHoursValidation,
  parseDateInput,
  parseTimeToMinutes,
  resolveWorkHours,
  resolveWorkHoursExceptions,
} from '../../utils/workHours';
import { CORTI_LANGS, getCortiLanguageLabel } from '../../utils/cortiLanguages';

const CURRENCY_OPTIONS = [
  { value: 'DKK', label: 'DKK' },
  { value: 'EUR', label: 'EURO' },
  { value: 'USD', label: 'USD' },
  { value: 'NOK', label: 'NOK' },
  { value: 'SEK', label: 'SEK' },
  { value: 'AED', label: 'AED' },
];
const PUBLIC_BOOKING_BASE_URL = (
  process.env.REACT_APP_PUBLIC_BOOKING_BASE_URL || 'https://booking.selmaplus.tech'
).replace(/\/+$/, '');

const buildPublicBookingAbsoluteUrl = (bookingPath) => {
  const raw = String(bookingPath || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  const normalizedPath = raw.startsWith('/') ? raw : `/${raw}`;
  return `${PUBLIC_BOOKING_BASE_URL}${normalizedPath}`;
};

const formatDateForInput = (inputDate) => {
  const date = new Date(inputDate);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const createWorkHourExceptionPreview = (overrides = {}) => ({
  id: `exception-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
  date: formatDateForInput(new Date()),
  start: '08:00',
  end: '16:00',
  closed: false,
  ...overrides,
});

const createInitialWorkHourExceptionPreviews = () => {
  return [];
};

const resolveWorkHourExceptionPreviews = (data) =>
  resolveWorkHoursExceptions(data).map((entry) =>
    createWorkHourExceptionPreview({
      date: entry.date,
      start: entry.closed ? '' : entry.start || '08:00',
      end: entry.closed ? '' : entry.end || '16:00',
      closed: Boolean(entry.closed),
    })
  );

const reorderSelectOptions = (options, selectedValue, valueKey = 'value') => {
  const selected = String(selectedValue ?? '').trim();
  if (!selected) return options;
  const selectedOption = options.find(
    (option) => String(option?.[valueKey] ?? '').trim() === selected
  );
  if (!selectedOption) return options;
  return [
    selectedOption,
    ...options.filter((option) => String(option?.[valueKey] ?? '').trim() !== selected),
  ];
};

const mapTeamDocToScheduleMember = (docSnap, fallbackLabel) => {
  const member = mapClinicMemberDoc(docSnap, fallbackLabel);
  return {
    id: member.id,
    name: member.name,
    memberUid: member.memberUid || null,
    isOwner: member.isOwner === true,
  };
};

function UserSettings() {
  const { user, updateUserProfile, activeClinicId: authClinicId } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { language, preferredLanguage, setPreferredLanguage, languageOptions, t } = useLanguage();
  const resolveSectionFromPath = () => 'profile';
  const [activeSection, setActiveSection] = useState(() =>
    resolveSectionFromPath(location.pathname)
  ); // profile | account | booking | workHours | language | ai
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [publicClinicName, setPublicClinicName] = useState('');
  const [publicClinicSlug, setPublicClinicSlug] = useState('');
  const [website, setWebsite] = useState('');
  const [category, setCategory] = useState('');
  const [address, setAddress] = useState('');
  const [cvr, setCvr] = useState('');
  const [currency, setCurrency] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState('');
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [workHours, setWorkHours] = useState(() => createDefaultWorkHours());
  const [audioRetention, setAudioRetention] = useState('30d');
  const [transcriptRetention, setTranscriptRetention] = useState('30d');
  const [agentCommsRetention, setAgentCommsRetention] = useState('30d');
  const [dictationLanguage, setDictationLanguage] = useState('auto');
  const [settingsSnapshot, setSettingsSnapshot] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [isAvatarUploading, setIsAvatarUploading] = useState(false);
  const [isClaimingSlug, setIsClaimingSlug] = useState(false);
  const [slugStatus, setSlugStatus] = useState(null);
  const [bookingLinkCopied, setBookingLinkCopied] = useState(false);
  const [workHoursExceptionPreviews, setWorkHoursExceptionPreviews] = useState(() =>
    createInitialWorkHourExceptionPreviews()
  );
  const [showWorkHoursExceptionsPreview, setShowWorkHoursExceptionsPreview] = useState(false);
  const [hasTeamAccess, setHasTeamAccess] = useState(false);
  const [activeClinicId, setActiveClinicId] = useState('');
  const [scheduleMembers, setScheduleMembers] = useState([]);
  const [selectedScheduleMemberId, setSelectedScheduleMemberId] = useState('');
  const [isScheduleLoading, setIsScheduleLoading] = useState(false);

  const sanitizeSlug = (value) => {
    if (!value) return '';
    const normalized = String(value)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return normalized.slice(0, 40);
  };

  const previewSlug = useMemo(() => sanitizeSlug(clinicName), [clinicName]);

  const previewUrl = previewSlug ? `/book/${previewSlug}` : '';
  const activeBookingUrl = publicClinicSlug ? `/book/${publicClinicSlug}` : '';
  const suggestedBookingUrl = previewUrl;
  const resolvedBookingUrl = activeBookingUrl || suggestedBookingUrl;
  const resolvedBookingAbsoluteUrl = useMemo(
    () => buildPublicBookingAbsoluteUrl(resolvedBookingUrl),
    [resolvedBookingUrl]
  );
  const bookingIsActive = Boolean(activeBookingUrl);
  const ownerScheduleMember = useMemo(() => {
    const ownerId = user?.uid || '';
    const fallbackName =
      fullName ||
      user?.displayName ||
      user?.email ||
      t('settings.publicBooking.scheduleMemberOwner', 'Klinikejer');
    return {
      id: ownerId,
      name: fallbackName,
      memberUid: ownerId || null,
      isOwner: true,
    };
  }, [fullName, t, user?.displayName, user?.email, user?.uid]);
  const selectedScheduleMember = useMemo(
    () =>
      scheduleMembers.find((member) => member.id === selectedScheduleMemberId) ||
      scheduleMembers[0] ||
      ownerScheduleMember,
    [ownerScheduleMember, scheduleMembers, selectedScheduleMemberId]
  );
  const defaultWorkHours = useMemo(() => createDefaultWorkHours(), []);
  const workHoursErrors = useMemo(
    () => getWorkHoursValidation(workHours),
    [workHours]
  );
  const hasWorkHoursErrors = Object.keys(workHoursErrors).length > 0;
  const workHoursDayLabels = useMemo(
    () => ({
      monday: t('settings.workHours.days.monday', 'Mandag'),
      tuesday: t('settings.workHours.days.tuesday', 'Tirsdag'),
      wednesday: t('settings.workHours.days.wednesday', 'Onsdag'),
      thursday: t('settings.workHours.days.thursday', 'Torsdag'),
      friday: t('settings.workHours.days.friday', 'Fredag'),
      saturday: t('settings.workHours.days.saturday', 'Lørdag'),
      sunday: t('settings.workHours.days.sunday', 'Søndag'),
    }),
    [t]
  );
  const workHoursErrorMessages = useMemo(
    () => ({
      missing: t('settings.workHours.errors.missing', 'Angiv start og slut'),
      order: t('settings.workHours.errors.order', 'Starttid skal være før sluttid'),
    }),
    [t]
  );
  const workHoursExceptionErrors = useMemo(() => {
    const errors = {};

    workHoursExceptionPreviews.forEach((item) => {
      const itemErrors = {};
      const normalizedDate = parseDateInput(item?.date);
      if (!normalizedDate) {
        itemErrors.date = 'invalidDate';
      }

      if (!item?.closed) {
        const startMinutes = parseTimeToMinutes(item?.start);
        const endMinutes = parseTimeToMinutes(item?.end);
        if (startMinutes === null || endMinutes === null) {
          itemErrors.time = 'missing';
        } else if (startMinutes >= endMinutes) {
          itemErrors.time = 'order';
        }
      }

      if (Object.keys(itemErrors).length > 0) {
        errors[item.id] = itemErrors;
      }
    });

    return errors;
  }, [workHoursExceptionPreviews]);
  const hasWorkHoursExceptionErrors = Object.keys(workHoursExceptionErrors).length > 0;
  const workHoursExceptionErrorMessages = useMemo(
    () => ({
      invalidDate: t(
        'settings.publicBooking.workHours.exceptionsErrors.invalidDate',
        'Vælg en gyldig dato.'
      ),
      missing: t(
        'settings.publicBooking.workHours.exceptionsErrors.missing',
        'Angiv start og slut.'
      ),
      order: t(
        'settings.publicBooking.workHours.exceptionsErrors.order',
        'Starttid skal være før sluttid.'
      ),
    }),
    [t]
  );
  const dictationLanguageOptions = useMemo(
    () => CORTI_LANGS.map((locale) => ({ value: locale, label: getCortiLanguageLabel(locale) })),
    []
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light');
    try {
      localStorage.removeItem('selma_theme_mode');
    } catch (_error) {
      // Ignore storage failures.
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    const loadProfile = async () => {
      try {
        const ref = doc(db, 'users', user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          const resolvedClinicId = String(data?.activeClinicId || authClinicId || '').trim();
          const teamAllowed =
            data?.accountType === 'team' ||
            data?.hasTeam === true ||
            data?.role === 'member' ||
            data?.role === 'owner' ||
            Boolean(resolvedClinicId);
          let clinicSettingsData = null;
          if (resolvedClinicId) {
            try {
              const clinicSettingsSnap = await getDoc(
                doc(db, 'clinics', resolvedClinicId, 'settings', 'general')
              );
              clinicSettingsData = clinicSettingsSnap.exists()
                ? clinicSettingsSnap.data() || {}
                : null;
            } catch (clinicSettingsError) {
              console.error('[UserSettings] Failed to load clinic settings', clinicSettingsError);
            }
          }
          setHasTeamAccess(teamAllowed);
          setActiveClinicId(resolvedClinicId);
          setSettingsSnapshot(data.settings || {});
          setFullName(data.displayName || user.displayName || '');
          setEmail(data.email || user.email || '');
          setClinicName(clinicSettingsData?.clinicName || data.clinicName || '');
          setPublicClinicName(
            clinicSettingsData?.publicClinicName ||
              data.publicClinicName ||
              clinicSettingsData?.clinicName ||
              data.clinicName ||
              ''
          );
          setPublicClinicSlug(clinicSettingsData?.publicClinicSlug || data.publicClinicSlug || '');
          setWebsite(clinicSettingsData?.website || data.website || '');
          setPhotoURL(data.photoURL || user.photoURL || '');
          setAvatarPreviewUrl('');
          setAvatarFile(null);
          setRemoveAvatar(false);
          const loadedCategory =
            (Array.isArray(clinicSettingsData?.categories) && clinicSettingsData.categories[0]) ||
            (Array.isArray(data.categories) && data.categories[0]) ||
            data.category ||
            '';
          setCategory(loadedCategory || '');
          setAddress(clinicSettingsData?.address || data.address || '');
          setCvr(
            String(clinicSettingsData?.cvr || data.cvr || data.CVR || '')
              .replace(/\D+/g, '')
              .slice(0, 8)
          );
          const loadedCurrency =
            (typeof clinicSettingsData?.currency === 'string' && clinicSettingsData.currency.trim()) ||
            (typeof data.currency === 'string' && data.currency.trim()) ||
            (typeof data.settings?.currency === 'string' && data.settings.currency.trim()) ||
            '';
          setCurrency(loadedCurrency);
          setWorkHours(resolveWorkHours(data));
          setWorkHoursExceptionPreviews(resolveWorkHourExceptionPreviews(data));
          const storedDictationLanguage =
            typeof data.settings?.dictationLanguage === 'string' && data.settings.dictationLanguage.trim()
              ? data.settings.dictationLanguage.trim()
              : 'auto';
          setDictationLanguage(storedDictationLanguage);
        } else {
          setHasTeamAccess(false);
          setActiveClinicId(String(authClinicId || '').trim());
          setSettingsSnapshot({});
          setFullName(user.displayName || '');
          setEmail(user.email || '');
          setClinicName('');
          setPublicClinicName('');
          setPublicClinicSlug('');
          setWebsite('');
          setPhotoURL(user.photoURL || '');
          setAvatarPreviewUrl('');
          setAvatarFile(null);
          setRemoveAvatar(false);
          setCategory('');
          setAddress('');
          setCvr('');
          setCurrency('');
          setWorkHours(createDefaultWorkHours());
          setWorkHoursExceptionPreviews([]);
          setDictationLanguage('auto');
        }
      } catch (error) {
        console.error('[UserSettings] Failed to load profile', error);
        setHasTeamAccess(false);
        setActiveClinicId('');
      }
    };

    loadProfile();
  }, [authClinicId, user]);

  useEffect(() => {
    if (!ownerScheduleMember.id) {
      setScheduleMembers([]);
      setSelectedScheduleMemberId('');
      return;
    }

    setScheduleMembers((prev) => {
      if (hasTeamAccess && prev.length > 1) {
        return prev;
      }
      if (
        prev.length === 1 &&
        prev[0]?.id === ownerScheduleMember.id &&
        prev[0]?.name === ownerScheduleMember.name
      ) {
        return prev;
      }
      return [ownerScheduleMember];
    });

    setSelectedScheduleMemberId((prev) => prev || ownerScheduleMember.id);
  }, [hasTeamAccess, ownerScheduleMember]);

  useEffect(() => {
    if (!user?.uid || !hasTeamAccess || !activeClinicId) {
      return undefined;
    }

    const teamRef = collection(db, 'clinics', activeClinicId, 'members');
    const unsubscribe = onSnapshot(
      teamRef,
      (snap) => {
        const fallbackLabel = t('settings.publicBooking.scheduleMemberFallback', 'Behandler');
        const loaded = dedupeClinicMembers(
          snap.docs.map((docSnap) => mapTeamDocToScheduleMember(docSnap, fallbackLabel))
        );
        const hasOwnerOption = loaded.some(
          (member) => isOwnerMemberForUid(member, user.uid)
        );

        let nextMembers = loaded;
        if (!hasOwnerOption) {
          nextMembers = [ownerScheduleMember, ...loaded];
        }

        const seen = new Set();
        const dedupedMembers = [];
        nextMembers.forEach((member) => {
          const memberId = String(member?.id || '').trim();
          if (!memberId || seen.has(memberId)) return;
          seen.add(memberId);
          dedupedMembers.push(
            memberId === user.uid || member.memberUid === user.uid || member.isOwner === true
              ? {
                  ...member,
                  id: user.uid,
                  name: member.name || ownerScheduleMember.name,
                  memberUid: member.memberUid || user.uid,
                  isOwner: true,
                }
              : member
          );
        });

        const resolvedMembers = dedupedMembers.length ? dedupedMembers : [ownerScheduleMember];
        setScheduleMembers(resolvedMembers);
        setSelectedScheduleMemberId((prev) => {
          if (prev && resolvedMembers.some((member) => member.id === prev)) {
            return prev;
          }
          return resolvedMembers[0].id;
        });
      },
      (error) => {
        console.error('[UserSettings] Failed to load team members for schedules', error);
        setScheduleMembers([ownerScheduleMember]);
        setSelectedScheduleMemberId(ownerScheduleMember.id);
      }
    );

    return () => unsubscribe();
  }, [activeClinicId, hasTeamAccess, ownerScheduleMember, t, user?.uid]);

  useEffect(() => {
    const selectedMemberId = selectedScheduleMember?.id || '';
    const selectedMemberUid = selectedScheduleMember?.memberUid || '';
    if (!user?.uid || !selectedMemberId) return;
    if (selectedMemberId !== user.uid && !activeClinicId) return;

    let isCancelled = false;
    const loadSelectedSchedule = async () => {
      setIsScheduleLoading(true);
      setShowWorkHoursExceptionsPreview(false);
      try {
        let sourceData = {};

        if (selectedMemberId === user.uid || selectedMemberUid === user.uid) {
          const ownerSnap = await getDoc(doc(db, 'users', user.uid));
          const ownerData = ownerSnap.exists() ? ownerSnap.data() || {} : {};
          sourceData = ownerData;

          if (activeClinicId) {
            try {
              const ownerMemberSnap = await getDoc(
                doc(db, 'clinics', activeClinicId, 'members', user.uid)
              );
              if (ownerMemberSnap.exists()) {
                const ownerMemberData = ownerMemberSnap.data() || {};
                sourceData = {
                  ...ownerData,
                  ...ownerMemberData,
                  workHours: ownerMemberData.workHours || ownerData.workHours,
                  workHoursExceptions:
                    ownerMemberData.workHoursExceptions || ownerData.workHoursExceptions,
                  workingHours: ownerMemberData.workingHours || ownerData.workingHours,
                };
              }
            } catch (ownerMemberError) {
              console.error('[UserSettings] Failed to load clinic owner schedule', ownerMemberError);
            }
          }
        } else {
          const teamSnap = await getDoc(
            doc(db, 'clinics', activeClinicId, 'members', selectedMemberId)
          );
          const teamData = teamSnap.exists() ? teamSnap.data() || {} : {};
          sourceData = teamData;
        }

        if (!isCancelled) {
          setWorkHours(resolveWorkHours(sourceData));
          setWorkHoursExceptionPreviews(resolveWorkHourExceptionPreviews(sourceData));
        }
      } catch (error) {
        console.error('[UserSettings] Failed to load selected schedule', error);
        if (!isCancelled) {
          setWorkHours(createDefaultWorkHours());
          setWorkHoursExceptionPreviews([]);
        }
      } finally {
        if (!isCancelled) {
          setIsScheduleLoading(false);
        }
      }
    };

    loadSelectedSchedule();

    return () => {
      isCancelled = true;
    };
  }, [activeClinicId, selectedScheduleMember?.id, selectedScheduleMember?.memberUid, user?.uid]);

  useEffect(() => {
    if (!user?.uid) {
      setAudioRetention('30d');
      setTranscriptRetention('30d');
      setAgentCommsRetention('30d');
      return;
    }

    const loadAiSettings = async () => {
      try {
        const settingsRef = doc(db, 'users', user.uid, 'settings', 'aiSettings');
        const snap = await getDoc(settingsRef);
        if (snap.exists()) {
          const data = snap.data() || {};
          setAudioRetention(data.audioRetention || '30d');
          setTranscriptRetention(data.transcriptRetention || '30d');
          setAgentCommsRetention(data.agentCommsRetention || '30d');
          return;
        }
        setAudioRetention('30d');
        setTranscriptRetention('30d');
        setAgentCommsRetention('30d');
      } catch (error) {
        console.error('[UserSettings] Failed to load AI settings', error);
      }
    };

    loadAiSettings();
  }, [user?.uid]);

  useEffect(() => {
    setSettingsSnapshot((prev) => ({ ...prev, dictationLanguage }));
  }, [dictationLanguage]);

  const handleSaveAiSettings = async () => {
    if (!user?.uid) return;
    const settingsRef = doc(db, 'users', user.uid, 'settings', 'aiSettings');
    const payload = {
      audioRetention: audioRetention || '30d',
      transcriptRetention: transcriptRetention || '30d',
      agentCommsRetention: agentCommsRetention || '30d',
      updatedAt: serverTimestamp(),
    };
    await setDoc(settingsRef, payload, { merge: true });
  };

  useEffect(() => {
    if (location.pathname.startsWith('/settings/transfer')) {
      navigate('/booking/settings', { replace: true });
    }
  }, [location.pathname, navigate]);

  const handleSectionChange = (section) => {
    setActiveSection(section);
    if (location.pathname.startsWith('/settings/transfer')) {
      navigate('/booking/settings');
    }
  };

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl) {
        URL.revokeObjectURL(avatarPreviewUrl);
      }
    };
  }, [avatarPreviewUrl]);

  const handleSaveProfile = async () => {
    if (!user) return;
    if (hasWorkHoursErrors || hasWorkHoursExceptionErrors) {
      return;
    }
    setIsSaving(true);
    try {
      const isBookingTeamScheduleSave =
        activeSection === 'booking' &&
        hasTeamAccess &&
        activeClinicId &&
        selectedScheduleMemberId &&
        selectedScheduleMemberId !== user.uid;

      if (isBookingTeamScheduleSave) {
        const teamMemberRef = doc(
          db,
          'clinics',
          activeClinicId,
          'members',
          selectedScheduleMemberId
        );
        await setDoc(
          teamMemberRef,
          {
            workHours: buildWorkHoursPayload(workHours),
            workHoursExceptions: buildWorkHoursExceptionsPayload(workHoursExceptionPreviews),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
        return;
      }

      const jobTitleForSave = category || '';
      const normalizedCvr = String(cvr || '').replace(/\D+/g, '').slice(0, 8);
      const ref = doc(db, 'users', user.uid);

      let resolvedPhotoURL = photoURL || '';
      if (removeAvatar) {
        resolvedPhotoURL = '';
      }

      if (avatarFile) {
        setIsAvatarUploading(true);
        const ext = avatarFile.name?.split('.').pop() || 'jpg';
        const path = `userprofilepictures/${user.uid}/avatar-${Date.now()}.${ext}`;
        const uploadRef = storageRef(storage, path);
        await uploadBytes(uploadRef, avatarFile, { contentType: avatarFile.type || 'image/jpeg' });
        resolvedPhotoURL = await getDownloadURL(uploadRef);
        setIsAvatarUploading(false);
        setAvatarFile(null);
        setRemoveAvatar(false);
        setAvatarPreviewUrl('');
        setPhotoURL(resolvedPhotoURL);
      }

      if (auth.currentUser) {
        await updateProfile(auth.currentUser, {
          displayName: fullName || auth.currentUser.displayName || null,
          photoURL: resolvedPhotoURL || null,
        });
      }

      // Best-effort sync with legacy helper (keeps other parts of the app consistent).
      try {
        await updateUserProfile({ fullName, jobTitle: jobTitleForSave });
      } catch (error) {
        console.error('[UserSettings] Failed to sync auth profile helper', error);
      }

      const updatePayload = {
        themeMode: 'light',
        displayName: fullName,
        photoURL: resolvedPhotoURL || null,
        jobTitle: jobTitleForSave,
        workHours: buildWorkHoursPayload(workHours),
        workHoursExceptions: buildWorkHoursExceptionsPayload(workHoursExceptionPreviews),
        preferredLanguage: preferredLanguage || language,
        settings: {
          ...settingsSnapshot,
          dictationLanguage: dictationLanguage || 'auto',
        },
        updatedAt: serverTimestamp(),
      };

      if (currency) {
        updatePayload.currency = currency;
      }

      if (activeClinicId) {
        await Promise.all([
          setDoc(
            doc(db, 'clinics', activeClinicId, 'settings', 'general'),
            {
              clinicName: clinicName || '',
              website: website || '',
              categories: category ? [category] : [],
              address: address || '',
              cvr: normalizedCvr,
              currency: currency || '',
              publicClinicSlug: publicClinicSlug || '',
              publicClinicName: publicClinicName || clinicName || '',
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          ),
          setDoc(
            doc(db, 'clinics', activeClinicId),
            {
              name: clinicName || '',
              clinicName: clinicName || '',
              website: website || '',
              address: address || '',
              cvr: normalizedCvr,
              currency: currency || '',
              publicClinicSlug: publicClinicSlug || '',
              publicClinicName: publicClinicName || clinicName || '',
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          ),
        ]);
      }

      await setDoc(ref, updatePayload, { merge: true });

      if (activeSection === 'ai') {
        await handleSaveAiSettings();
      }
    } catch (error) {
      console.error('[UserSettings] Failed to save profile', error);
    } finally {
      setIsAvatarUploading(false);
      setIsSaving(false);
    }
  };

  const handleClaimSlug = async () => {
    if (!user?.uid) return;
    const nameValue = (clinicName || '').trim();
    const sanitizedSlug = sanitizeSlug(clinicName);

    if (!nameValue) {
      setSlugStatus({
        tone: 'error',
        message: t('settings.publicBooking.errors.missingName', 'Angiv et kliniknavn.'),
      });
      return;
    }

    if (!sanitizedSlug) {
      setSlugStatus({
        tone: 'error',
        message: t(
          'settings.publicBooking.errors.missingSlug',
          'Kunne ikke generere et clinic slug.'
        ),
      });
      return;
    }

    setIsClaimingSlug(true);
    setSlugStatus(null);

    try {
      let clinicOwnerUid = user.uid;
      if (activeClinicId) {
        try {
          const clinicSnap = await getDoc(doc(db, 'clinics', activeClinicId));
          if (clinicSnap.exists()) {
            const clinicData = clinicSnap.data() || {};
            clinicOwnerUid = String(clinicData?.ownerUid || clinicOwnerUid).trim() || clinicOwnerUid;
          }
        } catch (clinicOwnerError) {
          console.error('[UserSettings] Failed to resolve clinic owner for public slug', clinicOwnerError);
        }
      }

      const clinicRef = doc(db, 'publicClinics', sanitizedSlug);
      const clinicSnap = await getDoc(clinicRef);
      if (clinicSnap.exists()) {
        const data = clinicSnap.data() || {};
        if (data.ownerUid && data.ownerUid !== clinicOwnerUid) {
          setSlugStatus({
            tone: 'error',
            message: t('settings.publicBooking.errors.slugTaken', 'Slug er optaget. Prøv en anden.'),
          });
          return;
        }
      }

      const clinicPayload = {
        ownerUid: clinicOwnerUid,
        clinicId: activeClinicId || null,
        clinicSlug: sanitizedSlug,
        clinicName: nameValue,
        isActive: true,
        updatedAt: serverTimestamp(),
      };

      if (!clinicSnap.exists()) {
        clinicPayload.createdAt = serverTimestamp();
      }

      await setDoc(clinicRef, clinicPayload, { merge: true });

      const generatedUrl = `/book/${sanitizedSlug}`;
      const generatedAbsoluteUrl = buildPublicBookingAbsoluteUrl(generatedUrl);

      await setDoc(
        doc(db, 'users', user.uid),
        {
          publicClinicSlug: sanitizedSlug,
          publicClinicName: nameValue,
          website: generatedUrl,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      if (activeClinicId) {
        await setDoc(
          doc(db, 'clinics', activeClinicId, 'settings', 'general'),
          {
            clinicSlug: sanitizedSlug,
            publicClinicSlug: sanitizedSlug,
            clinicName: nameValue,
            publicClinicName: nameValue,
            website: generatedUrl,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }

      const refreshedUserSnap = await getDoc(doc(db, 'users', user.uid));
      if (refreshedUserSnap.exists()) {
        const refreshedUser = refreshedUserSnap.data() || {};
        setPublicClinicSlug(refreshedUser.publicClinicSlug || sanitizedSlug);
        setPublicClinicName(refreshedUser.publicClinicName || nameValue);
        setWebsite(refreshedUser.website || generatedUrl);
      } else {
        setPublicClinicSlug(sanitizedSlug);
        setPublicClinicName(nameValue);
        setWebsite(generatedUrl);
      }
      setSlugStatus({
        tone: 'success',
        message: t(
          'settings.publicBooking.success',
          'Booking page is active: {url}',
          { url: generatedAbsoluteUrl || generatedUrl }
        ),
      });
    } catch (error) {
      console.error('[UserSettings] Failed to claim clinic slug', error);
      setSlugStatus({
        tone: 'error',
        message: t('settings.publicBooking.errors.generic', 'Kunne ikke gemme bookingsiden. Prøv igen.'),
      });
    } finally {
      setIsClaimingSlug(false);
    }
  };

  const handleCopyBookingLink = async () => {
    if (!resolvedBookingAbsoluteUrl || typeof navigator === 'undefined' || !navigator.clipboard) {
      return;
    }
    try {
      await navigator.clipboard.writeText(resolvedBookingAbsoluteUrl);
      setBookingLinkCopied(true);
      setTimeout(() => setBookingLinkCopied(false), 2200);
    } catch (error) {
      console.error('[UserSettings] Failed to copy booking link', error);
      setSlugStatus({
        tone: 'error',
        message: t('settings.publicBooking.errors.copyFailed', 'Kunne ikke kopiere linket.'),
      });
    }
  };

  const handleOpenBookingPage = () => {
    if (!resolvedBookingAbsoluteUrl || typeof window === 'undefined') return;
    window.open(resolvedBookingAbsoluteUrl, '_blank', 'noopener,noreferrer');
  };

  const updateWorkHoursField = (dayKey, field, value) => {
    setWorkHours((prev) => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        [field]: value,
      },
    }));
  };

  const toggleWorkHoursDay = (dayKey) => {
    setWorkHours((prev) => {
      const current = prev[dayKey] || {};
      const nextEnabled = !current.enabled;
      const defaultDay = defaultWorkHours[dayKey] || {};
      const nextStart = nextEnabled ? current.start || defaultDay.start || '' : current.start;
      const nextEnd = nextEnabled ? current.end || defaultDay.end || '' : current.end;
      return {
        ...prev,
        [dayKey]: {
          ...current,
          enabled: nextEnabled,
          start: nextStart,
          end: nextEnd,
        },
      };
    });
  };

  const addWorkHoursExceptionPreview = () => {
    setWorkHoursExceptionPreviews((prev) => [...prev, createWorkHourExceptionPreview()]);
  };

  const removeWorkHoursExceptionPreview = (id) => {
    setWorkHoursExceptionPreviews((prev) => prev.filter((item) => item.id !== id));
  };

  const updateWorkHoursExceptionPreview = (id, field, value) => {
    setWorkHoursExceptionPreviews((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        if (field === 'closed') {
          const isClosed = Boolean(value);
          return {
            ...item,
            closed: isClosed,
            start: isClosed ? '' : item.start || '08:00',
            end: isClosed ? '' : item.end || '16:00',
          };
        }
        return {
          ...item,
          [field]: value,
        };
      })
    );
  };

  const isExpandedSettingsSection =
    activeSection === 'booking' ||
    activeSection === 'profile' ||
    activeSection === 'language' ||
    activeSection === 'ai';

  return (
    <BookingSidebarLayout>
      <div className="booking-page">
        <div className="booking-content">
          {/* Main Content */}
          <div className="usersettings-main">
          <div className={`usersettings-page ${isExpandedSettingsSection ? 'usersettings-page-expanded' : ''}`}>
            <div className={`usersettings-card ${isExpandedSettingsSection ? 'usersettings-card-expanded' : ''}`}>
              <div
                className={`usersettings-layout ${
                  isExpandedSettingsSection ? 'usersettings-layout-expanded' : ''
                }`}
              >
                <aside className="usersettings-nav">
                  <button
                    type="button"
                    className={`usersettings-nav-item ${activeSection === 'profile' ? 'active' : ''}`}
                    onClick={() => handleSectionChange('profile')}
                  >
                    {t('settings.sections.profile', 'Profil')}
                  </button>
                  <button
                    type="button"
                    className={`usersettings-nav-item ${activeSection === 'booking' ? 'active' : ''}`}
                    onClick={() => handleSectionChange('booking')}
                  >
                    {t('settings.sections.booking', 'Bookingside')}
                  </button>
                  <button
                    type="button"
                    className={`usersettings-nav-item ${activeSection === 'language' ? 'active' : ''}`}
                    onClick={() => handleSectionChange('language')}
                  >
                    {t('settings.sections.language', 'Sprog')}
                  </button>
                  <button
                    type="button"
                    className={`usersettings-nav-item ${activeSection === 'ai' ? 'active' : ''}`}
                    onClick={() => handleSectionChange('ai')}
                  >
                    {t('settings.sections.ai', 'AI indstillinger')}
                  </button>
                </aside>

                <main className="usersettings-panel">
                  {activeSection === 'profile' && (
                    <>
                      <div className="usersettings-content-shell">
                        <section className="usersettings-surface-card">
                          <div className="usersettings-section-head">
                            <h3 className="usersettings-section-title">
                              {t('settings.profile.title', 'Redigere din virksomhedsoplysninger')}
                            </h3>
                          </div>
                          <div className="usersettings-profile-grid">
                            <div className="usersettings-section">
                              <label className="usersettings-label">
                                {t('settings.profile.fullName', 'Fulde navn')}
                              </label>
                              <input
                                className="usersettings-input"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder={t(
                                  'settings.profile.fullNamePlaceholder',
                                  'Indtast dit fulde navn'
                                )}
                              />
                            </div>

                            <div className="usersettings-section">
                              <label className="usersettings-label">
                                {t('settings.profile.email', 'E-mail')}
                              </label>
                              <input className="usersettings-input" value={email} readOnly />
                            </div>

                            <div className="usersettings-section">
                              <label className="usersettings-label">
                                {t('settings.profile.clinicName', 'Kliniknavn')}
                              </label>
                              <input
                                className="usersettings-input"
                                value={clinicName}
                                onChange={(e) => setClinicName(e.target.value)}
                                placeholder={t(
                                  'settings.profile.clinicPlaceholder',
                                  'Angiv navnet på klinikken'
                                )}
                              />
                            </div>

                            <div className="usersettings-section">
                              <label className="usersettings-label">
                                {t('settings.profile.cvr', 'CVR')}
                              </label>
                              <input
                                className="usersettings-input"
                                value={cvr}
                                onChange={(e) =>
                                  setCvr(e.target.value.replace(/\D+/g, '').slice(0, 8))
                                }
                                inputMode="numeric"
                                maxLength={8}
                                placeholder={t('settings.profile.cvrPlaceholder', 'Indtast CVR-nummer')}
                              />
                            </div>

                            <div className="usersettings-section usersettings-section-span-full">
                              <label className="usersettings-label">
                                {t('settings.account.address', 'Adresse')}
                              </label>
                              <input
                                className="usersettings-input"
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                placeholder={t('settings.account.addressPlaceholder', 'Indtast adresse')}
                              />
                            </div>
                          </div>
                        </section>
                      </div>
                    </>
                  )}

                  {activeSection === 'booking' && (
                    <>
                      <div className="usersettings-booking-shell">
                        <section className="usersettings-booking-hero">
                          <div className="usersettings-booking-hero-head">
                            <div className="usersettings-booking-hero-copy">
                              <p className="usersettings-booking-eyebrow">
                                {t('settings.publicBooking.visibilityLabel', 'Offentlig booking')}
                              </p>
                              <h3 className="usersettings-booking-hero-title">
                                {publicClinicName || clinicName || t('settings.publicBooking.title', 'Bookingside')}
                              </h3>
                              <p className="usersettings-booking-note">
                                {bookingIsActive
                                  ? t(
                                      'settings.publicBooking.activeDescription',
                                      'Din side er live. Del linket med patienter via hjemmeside, mail eller sociale medier.'
                                    )
                                  : t(
                                      'settings.publicBooking.inactiveDescription',
                                      'Vælg kliniknavn og aktivér siden for at få et offentligt bookinglink.'
                                    )}
                              </p>
                            </div>
                            <span
                              className={`usersettings-booking-state ${
                                bookingIsActive ? 'active' : 'inactive'
                              }`}
                            >
                              {bookingIsActive
                                ? t('settings.publicBooking.stateActive', 'Aktiv')
                                : t('settings.publicBooking.stateInactive', 'Ikke aktiv')}
                            </span>
                          </div>

                          <div className="usersettings-booking-link-block">
                            <label className="usersettings-label">
                              {t('settings.publicBooking.publicLinkLabel', 'Offentlig bookingside URL')}
                            </label>
                            <div className="usersettings-booking-link-row">
                              <input
                                className="usersettings-input"
                                value={resolvedBookingAbsoluteUrl}
                                readOnly
                                placeholder={t(
                                  'settings.publicBooking.urlPlaceholder',
                                  '{baseUrl}/book/your-clinic',
                                  { baseUrl: PUBLIC_BOOKING_BASE_URL }
                                )}
                              />
                              <button
                                type="button"
                                className="usersettings-claim-btn usersettings-claim-btn-primary usersettings-booking-activate-btn"
                                onClick={handleClaimSlug}
                                disabled={isClaimingSlug || !clinicName.trim()}
                              >
                                {isClaimingSlug
                                  ? t('settings.publicBooking.claiming', 'Aktiverer...')
                                  : bookingIsActive
                                    ? t('settings.publicBooking.update', 'Opdater bookingside')
                                    : t('settings.publicBooking.activate', 'Aktiver bookingside')}
                              </button>
                            </div>
                            <div className="usersettings-booking-link-actions">
                              <button
                                type="button"
                                className="usersettings-booking-link-btn"
                                onClick={handleCopyBookingLink}
                                disabled={!resolvedBookingAbsoluteUrl}
                              >
                                {bookingLinkCopied
                                  ? t('settings.publicBooking.copied', 'Kopieret')
                                  : t('settings.publicBooking.copy', 'Kopiér link')}
                              </button>
                              <button
                                type="button"
                                className="usersettings-booking-link-btn"
                                onClick={handleOpenBookingPage}
                                disabled={!resolvedBookingAbsoluteUrl}
                              >
                                {t('settings.publicBooking.openPage', 'Åbn side')}
                              </button>
                            </div>
                          </div>

                          {slugStatus?.tone === 'error' && slugStatus?.message ? (
                            <div className="usersettings-status error">{slugStatus.message}</div>
                          ) : null}
                        </section>

                        <section className="usersettings-booking-hours-card usersettings-booking-hours-card-expanded">
                          {showWorkHoursExceptionsPreview ? (
                            <>
                              <div className="usersettings-booking-hours-head usersettings-booking-hours-head-exceptions">
                                <div className="usersettings-booking-hours-copy">
                                  <h4 className="usersettings-booking-hours-title">
                                    {t(
                                      'settings.publicBooking.workHours.exceptionsTitle',
                                      'Særlige datoer (engang)'
                                    )}
                                  </h4>
                                  <p className="usersettings-booking-hours-note">
                                    {t(
                                      'settings.publicBooking.workHours.exceptionsNote',
                                      'Bruges til enkeltstående lukkedage eller justerede tider.'
                                    )}
                                  </p>
                                  {hasTeamAccess && scheduleMembers.length > 1 ? (
                                    <p className="usersettings-booking-hours-note">
                                      {t('settings.publicBooking.workHours.forMember', 'Viser arbejdstider for')}:{' '}
                                      {selectedScheduleMember?.name || ''}
                                    </p>
                                  ) : null}
                                  {isScheduleLoading ? (
                                    <p className="usersettings-booking-hours-note">
                                      {t('settings.publicBooking.workHours.loading', 'Henter arbejdstider...')}
                                    </p>
                                  ) : null}
                                </div>
                                <button
                                  type="button"
                                  className="usersettings-booking-link-btn usersettings-booking-exceptions-back-btn"
                                  onClick={() => setShowWorkHoursExceptionsPreview(false)}
                                  disabled={isScheduleLoading}
                                >
                                  {t('settings.back', 'Tilbage')}
                                </button>
                              </div>

                              <div className="usersettings-booking-exceptions">
                                <div className="usersettings-booking-exceptions-head">
                                  <div className="usersettings-booking-exceptions-copy">
                                    <h5 className="usersettings-booking-exceptions-title">
                                      {t(
                                        'settings.publicBooking.workHours.exceptionsListTitle',
                                        'Undtagelser'
                                      )}
                                    </h5>
                                    <p className="usersettings-booking-exceptions-note">
                                      {t(
                                        'settings.publicBooking.workHours.exceptionsListNote',
                                        'Tilføj datoer hvor tider afviger fra standard arbejdstider.'
                                      )}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    className="usersettings-booking-link-btn usersettings-booking-exceptions-add-btn"
                                    onClick={addWorkHoursExceptionPreview}
                                    disabled={isScheduleLoading}
                                  >
                                    {t(
                                      'settings.publicBooking.workHours.addException',
                                      'Tilføj undtagelse'
                                    )}
                                  </button>
                                </div>
                                <div className="usersettings-booking-exceptions-list">
                                  {workHoursExceptionPreviews.map((item) => {
                                    const itemErrors = workHoursExceptionErrors[item.id] || {};
                                    const itemErrorCode = itemErrors.date || itemErrors.time || '';
                                    const itemErrorMessage = itemErrorCode
                                      ? workHoursExceptionErrorMessages[itemErrorCode]
                                      : '';

                                    return (
                                      <div
                                        key={item.id}
                                        className={`usersettings-booking-exceptions-row ${
                                          item.closed ? 'is-closed' : ''
                                        } ${itemErrorCode ? 'has-error' : ''}`}
                                      >
                                        <input
                                          type="date"
                                          className="usersettings-booking-exceptions-date"
                                          value={item.date}
                                          onChange={(e) =>
                                            updateWorkHoursExceptionPreview(
                                              item.id,
                                              'date',
                                              e.target.value
                                            )
                                          }
                                          disabled={isScheduleLoading}
                                        />
                                        <label className="usersettings-booking-exceptions-toggle">
                                          <input
                                            type="checkbox"
                                            checked={Boolean(item.closed)}
                                            onChange={(e) =>
                                              updateWorkHoursExceptionPreview(
                                                item.id,
                                                'closed',
                                                e.target.checked
                                              )
                                            }
                                            disabled={isScheduleLoading}
                                          />
                                          <span>{t('settings.workHours.closed', 'Lukket')}</span>
                                        </label>
                                        <input
                                          type="time"
                                          className="usersettings-booking-hours-time-input"
                                          value={item.start}
                                          onChange={(e) =>
                                            updateWorkHoursExceptionPreview(
                                              item.id,
                                              'start',
                                              e.target.value
                                            )
                                          }
                                          disabled={Boolean(item.closed) || isScheduleLoading}
                                        />
                                        <span className="usersettings-booking-hours-separator">–</span>
                                        <input
                                          type="time"
                                          className="usersettings-booking-hours-time-input"
                                          value={item.end}
                                          onChange={(e) =>
                                            updateWorkHoursExceptionPreview(item.id, 'end', e.target.value)
                                          }
                                          disabled={Boolean(item.closed) || isScheduleLoading}
                                        />
                                        <button
                                          type="button"
                                          className="usersettings-booking-exceptions-remove-btn"
                                          onClick={() => removeWorkHoursExceptionPreview(item.id)}
                                          disabled={isScheduleLoading}
                                        >
                                          {t('settings.publicBooking.workHours.removeException', 'Fjern')}
                                        </button>
                                        {itemErrorMessage ? (
                                          <div
                                            className="usersettings-booking-exceptions-error"
                                            role="alert"
                                          >
                                            {itemErrorMessage}
                                          </div>
                                        ) : null}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              <div className="usersettings-booking-hours-actions usersettings-booking-hours-actions-standalone">
                                <button
                                  type="button"
                                  className="usersettings-top-btn primary"
                                  onClick={handleSaveProfile}
                                  disabled={
                                    isSaving ||
                                    isAvatarUploading ||
                                    isScheduleLoading ||
                                    hasWorkHoursErrors ||
                                    hasWorkHoursExceptionErrors
                                  }
                                  aria-busy={isSaving || isAvatarUploading}
                                >
                                  {isSaving || isAvatarUploading
                                    ? t('settings.saving', 'Gemmer…')
                                    : t('settings.save', 'Gem')}
                                </button>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="usersettings-booking-hours-head">
                                <div className="usersettings-booking-hours-copy">
                                  <h4 className="usersettings-booking-hours-title">
                                    {t('settings.publicBooking.workHours.title', 'Arbejdstider')}
                                  </h4>
                                  <p className="usersettings-booking-hours-note">
                                    {t(
                                      'settings.publicBooking.workHours.subtitle',
                                      'Juster start/slut for hver dag.'
                                    )}
                                  </p>
                                  {hasTeamAccess && scheduleMembers.length > 1 ? (
                                    <p className="usersettings-booking-hours-note">
                                      {t('settings.publicBooking.workHours.forMember', 'Viser arbejdstider for')}:{' '}
                                      {selectedScheduleMember?.name || ''}
                                    </p>
                                  ) : null}
                                </div>
                                <div className="usersettings-booking-hours-head-actions">
                                  {hasTeamAccess && scheduleMembers.length > 1 ? (
                                    <div className="usersettings-booking-schedule-member">
                                      <label
                                        htmlFor="booking-schedule-member-select"
                                        className="usersettings-booking-schedule-member-label"
                                      >
                                        {t(
                                          'settings.publicBooking.workHours.memberLabel',
                                          'Vælg behandler'
                                        )}
                                      </label>
                                      <select
                                        id="booking-schedule-member-select"
                                        className="usersettings-booking-schedule-member-select"
                                        value={selectedScheduleMemberId}
                                        onChange={(e) => setSelectedScheduleMemberId(e.target.value)}
                                        disabled={isScheduleLoading}
                                      >
                                        {scheduleMembers.map((member) => (
                                          <option key={member.id} value={member.id}>
                                            {member.name}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  ) : null}
                                  <button
                                    type="button"
                                    className="usersettings-booking-link-btn usersettings-booking-exceptions-open-btn"
                                    onClick={() => setShowWorkHoursExceptionsPreview(true)}
                                    disabled={isScheduleLoading}
                                  >
                                    {t(
                                      'settings.publicBooking.workHours.addExceptions',
                                      'Tilføj undtagelser'
                                    )}
                                  </button>
                                </div>
                              </div>

                              <div className="usersettings-booking-hours-list">
                                {WORK_HOURS_DAYS.map((day) => {
                                  const dayData = workHours[day.key] || {};
                                  const errorCode = workHoursErrors[day.key];
                                  const errorMessage = errorCode
                                    ? workHoursErrorMessages[errorCode]
                                    : '';
                                  const isEnabled = Boolean(dayData.enabled);
                                  return (
                                    <div
                                      key={day.key}
                                      className={`usersettings-booking-hours-row ${
                                        !isEnabled ? 'is-closed' : ''
                                      } ${errorCode ? 'has-error' : ''}`}
                                    >
                                      <span className="usersettings-booking-hours-day-name">
                                        {workHoursDayLabels[day.key] || day.key}
                                      </span>

                                      <div className="usersettings-booking-hours-row-time">
                                        <input
                                          type="time"
                                          className={`usersettings-booking-hours-time-input ${
                                            errorCode ? 'is-error' : ''
                                          }`}
                                          value={dayData.start || ''}
                                          onChange={(e) =>
                                            updateWorkHoursField(day.key, 'start', e.target.value)
                                          }
                                          disabled={!isEnabled || isScheduleLoading}
                                          aria-invalid={Boolean(errorCode)}
                                        />
                                        <span className="usersettings-booking-hours-separator">–</span>
                                        <input
                                          type="time"
                                          className={`usersettings-booking-hours-time-input ${
                                            errorCode ? 'is-error' : ''
                                          }`}
                                          value={dayData.end || ''}
                                          onChange={(e) =>
                                            updateWorkHoursField(day.key, 'end', e.target.value)
                                          }
                                          disabled={!isEnabled || isScheduleLoading}
                                          aria-invalid={Boolean(errorCode)}
                                        />
                                        {!isEnabled ? (
                                          <span className="usersettings-booking-hours-closed-pill">
                                            {t('settings.workHours.closed', 'Lukket')}
                                          </span>
                                        ) : null}
                                      </div>

                                      <button
                                        type="button"
                                        className={`usersettings-booking-hours-close-btn ${
                                          !isEnabled ? 'closed' : ''
                                        }`}
                                        onClick={() => toggleWorkHoursDay(day.key)}
                                        disabled={isScheduleLoading}
                                        aria-label={
                                          isEnabled
                                            ? t('settings.workHours.markClosed', 'Markér som lukket')
                                            : t('settings.workHours.markOpen', 'Åbn dag')
                                        }
                                        title={
                                          isEnabled
                                            ? t('settings.workHours.markClosed', 'Markér som lukket')
                                            : t('settings.workHours.markOpen', 'Åbn dag')
                                        }
                                      >
                                        ×
                                      </button>

                                      {errorMessage ? (
                                        <div
                                          className="usersettings-booking-hours-error"
                                          role="alert"
                                        >
                                          {errorMessage}
                                        </div>
                                      ) : null}
                                    </div>
                                  );
                                })}
                                <div className="usersettings-booking-hours-actions">
                                  <button
                                    type="button"
                                    className="usersettings-top-btn primary"
                                    onClick={handleSaveProfile}
                                    disabled={
                                      isSaving ||
                                      isAvatarUploading ||
                                      isScheduleLoading ||
                                      hasWorkHoursErrors ||
                                      hasWorkHoursExceptionErrors
                                    }
                                    aria-busy={isSaving || isAvatarUploading}
                                  >
                                    {isSaving || isAvatarUploading
                                      ? t('settings.saving', 'Gemmer…')
                                      : t('settings.save', 'Gem')}
                                  </button>
                                </div>
                              </div>
                            </>
                          )}
                        </section>
                      </div>
                    </>
                  )}

                  {activeSection === 'workHours' && (
                    <>
                      <div className="usersettings-header">
                        <div className="usersettings-title">
                          {t('settings.workHours.title', 'Arbejdstid')}
                        </div>
                        <div className="usersettings-subtitle">
                          {t(
                            'settings.workHours.subtitle',
                            'Angiv hvornår du kan bookes. Du kan justere tiderne når som helst.'
                          )}
                        </div>
                      </div>

                      <div className="usersettings-profile-fields">
                        <div className="usersettings-workhours">
                          {WORK_HOURS_DAYS.map((day) => {
                            const dayData = workHours[day.key] || {};
                            const errorCode = workHoursErrors[day.key];
                            const errorMessage = errorCode ? workHoursErrorMessages[errorCode] : '';
                            const isEnabled = Boolean(dayData.enabled);
                            return (
                              <div
                                key={day.key}
                                className={`usersettings-workhours-row ${
                                  errorCode ? 'has-error' : ''
                                }`}
                              >
                                <div className="usersettings-workhours-day">
                                  <span className="usersettings-workhours-label">
                                    {workHoursDayLabels[day.key] || day.key}
                                  </span>
                                  <label className="usersettings-workhours-toggle">
                                    <input
                                      type="checkbox"
                                      checked={isEnabled}
                                      onChange={() => toggleWorkHoursDay(day.key)}
                                    />
                                    <span>
                                      {isEnabled
                                        ? t('settings.workHours.open', 'Åben')
                                        : t('settings.workHours.closed', 'Lukket')}
                                    </span>
                                  </label>
                                </div>
                                <div className="usersettings-workhours-time">
                                  <input
                                    type="time"
                                    className={`usersettings-workhours-input ${
                                      errorCode ? 'is-error' : ''
                                    }`}
                                    value={dayData.start || ''}
                                    onChange={(e) =>
                                      updateWorkHoursField(day.key, 'start', e.target.value)
                                    }
                                    disabled={!isEnabled}
                                    aria-invalid={Boolean(errorCode)}
                                  />
                                  <span className="usersettings-workhours-separator">–</span>
                                  <input
                                    type="time"
                                    className={`usersettings-workhours-input ${
                                      errorCode ? 'is-error' : ''
                                    }`}
                                    value={dayData.end || ''}
                                    onChange={(e) =>
                                      updateWorkHoursField(day.key, 'end', e.target.value)
                                    }
                                    disabled={!isEnabled}
                                    aria-invalid={Boolean(errorCode)}
                                  />
                                </div>
                                {errorMessage ? (
                                  <div className="usersettings-workhours-error" role="alert">
                                    {errorMessage}
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}

                  {activeSection === 'language' && (
                    <>
                      <div className="usersettings-content-shell">
                        <section className="usersettings-surface-card">
                          <div className="usersettings-section-head">
                            <h3 className="usersettings-section-title">
                              {t('settings.language.title', 'Sprog')}
                            </h3>
                            <p className="usersettings-section-description">
                              {t(
                                'settings.language.description',
                                'Vælg standardsprog, dikteringssprog og valuta for din klinik.'
                              )}
                            </p>
                          </div>

                          <div className="usersettings-settings-grid">
                            <div className="usersettings-option-card">
                              <label className="usersettings-label">
                                {t('settings.language.label', 'Foretrukket sprog')}
                              </label>
                              <select
                                className="usersettings-input usersettings-select"
                                value={language}
                                onChange={(e) => {
                                  void setPreferredLanguage(e.target.value, { persist: false });
                                }}
                              >
                                {reorderSelectOptions(languageOptions, language, 'code').map((option) => (
                                  <option key={option.code} value={option.code}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="usersettings-option-card">
                              <label className="usersettings-label">
                                {t('settings.language.dictationLabel', 'Dictation language')}
                              </label>
                              <select
                                className="usersettings-input usersettings-select"
                                value={dictationLanguage}
                                onChange={(e) => setDictationLanguage(e.target.value)}
                              >
                                {reorderSelectOptions(
                                  [
                                    {
                                      value: 'auto',
                                      label: t('settings.language.dictationAuto', 'Auto (recommended)'),
                                    },
                                    ...dictationLanguageOptions,
                                  ],
                                  dictationLanguage
                                ).map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="usersettings-option-card">
                              <label className="usersettings-label">
                                {t('settings.currency.label', 'Valuta')}
                              </label>
                              <select
                                className="usersettings-input usersettings-select"
                                value={currency}
                                onChange={(e) => setCurrency(e.target.value)}
                              >
                                <option value="" disabled hidden>
                                  {t('settings.currency.placeholder', 'Vælg valuta')}
                                </option>
                                {reorderSelectOptions(CURRENCY_OPTIONS, currency).map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </section>
                      </div>
                    </>
                  )}

                  {activeSection === 'ai' && (
                    <>
                      <div className="usersettings-content-shell">
                        <section className="usersettings-surface-card">
                          <div className="usersettings-section-head">
                            <h3 className="usersettings-section-title">
                              {t('settings.ai.title', 'AI indstillinger')}
                            </h3>
                            <p className="usersettings-section-description">
                              {t(
                                'settings.ai.description',
                                'Administrer hvor længe lyd, transkription og AI-genereret kommunikation gemmes.'
                              )}
                            </p>
                          </div>

                          <div className="usersettings-ai-grid">
                            <div className="usersettings-ai-card">
                              <label className="usersettings-label">
                                {t('settings.ai.audio.title', 'Lydoptagelse')}
                              </label>
                              <p className="usersettings-subtitle">
                                {t(
                                  'settings.ai.audio.description',
                                  'Den originale lydoptagelse fra sessionen. Bruges til kvalitetssikring og fejlfinding ved uklarheder i ord, udtale eller dialekt.'
                                )}
                              </p>
                              <select
                                className="usersettings-input usersettings-select"
                                value={audioRetention}
                                onChange={(e) => setAudioRetention(e.target.value)}
                              >
                                <option value="immediate">
                                  {t('settings.ai.retention.immediate', 'Slet med det samme')}
                                </option>
                                <option value="30d">
                                  {t('settings.ai.retention.30d', 'Gem 30 dage')}
                                </option>
                              </select>
                            </div>

                            <div className="usersettings-ai-card">
                              <label className="usersettings-label">
                                {t('settings.ai.transcript.title', 'Transkription')}
                              </label>
                              <p className="usersettings-subtitle">
                                {t(
                                  'settings.ai.transcript.description',
                                  'Tekstversionen af lydoptagelsen. Bruges til gendannelse og teknisk support, hvis en optagelse afbrydes eller der opstår fejl.'
                                )}
                              </p>
                              <select
                                className="usersettings-input usersettings-select"
                                value={transcriptRetention}
                                onChange={(e) => setTranscriptRetention(e.target.value)}
                              >
                                <option value="immediate">
                                  {t('settings.ai.retention.immediate', 'Slet med det samme')}
                                </option>
                                <option value="30d">
                                  {t('settings.ai.retention.30d', 'Gem 30 dage')}
                                </option>
                              </select>
                            </div>

                            <div className="usersettings-ai-card">
                              <label className="usersettings-label">
                                {t('settings.ai.agentComms.title', 'AI-genereret kommunikation')}
                              </label>
                              <p className="usersettings-subtitle">
                                {t(
                                  'settings.ai.agentComms.description',
                                  'Tekst og svar der bliver genereret i dialogen med vores AI-agenter (fx forslag til journalnotat, opsummeringer og anbefalinger). Gemning kan være nyttig, hvis du vil kunne genfinde tidligere samtaler, dokumentere beslutningsgrundlag eller fortsætte et igangværende forløb.'
                                )}
                              </p>
                              <select
                                className="usersettings-input usersettings-select"
                                value={agentCommsRetention}
                                onChange={(e) => setAgentCommsRetention(e.target.value)}
                              >
                                <option value="immediate">
                                  {t('settings.ai.retention.immediate', 'Slet med det samme')}
                                </option>
                                <option value="30d">
                                  {t('settings.ai.retention.30d', 'Gem 30 dage')}
                                </option>
                              </select>
                            </div>
                          </div>
                        </section>
                      </div>
                    </>
                  )}

                </main>
              </div>
              {activeSection !== 'booking' ? (
                <div className="usersettings-actions">
                  <button
                    type="button"
                    className="usersettings-top-btn primary"
                    onClick={handleSaveProfile}
                    disabled={
                      isSaving ||
                      isAvatarUploading ||
                      hasWorkHoursErrors ||
                      hasWorkHoursExceptionErrors
                    }
                    aria-busy={isSaving || isAvatarUploading}
                  >
                    {isSaving || isAvatarUploading
                      ? t('settings.saving', 'Gemmer…')
                      : t('settings.save', 'Gem')}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
    </BookingSidebarLayout>
  );
}

export default UserSettings;
