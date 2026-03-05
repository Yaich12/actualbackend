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

const THEME_STORAGE_KEY = 'selma_theme_mode';
const NIGHT_START_HOUR = 18; // 18:00
const NIGHT_END_HOUR = 5;    // 05:00

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

const mapTeamDocToScheduleMember = (docSnap, fallbackLabel) => {
  const data = docSnap.data() || {};
  const name =
    (typeof data.name === 'string' && data.name.trim()) ||
    `${data.firstName || ''}${data.lastName ? ` ${data.lastName}` : ''}`.trim() ||
    fallbackLabel;
  const memberUid =
    (typeof data.memberUid === 'string' && data.memberUid.trim()) ||
    (typeof data.uid === 'string' && data.uid.trim()) ||
    '';
  return {
    id: docSnap.id,
    name,
    memberUid: memberUid || null,
    isOwner: data.isOwner === true,
  };
};

function UserSettings() {
  const { user, updateUserProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { language, preferredLanguage, setPreferredLanguage, languageOptions, t } = useLanguage();
  const resolveSectionFromPath = () => 'profile';
  const [activeSection, setActiveSection] = useState(() =>
    resolveSectionFromPath(location.pathname)
  ); // profile | account | booking | workHours | appearance | language | ai
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [publicClinicName, setPublicClinicName] = useState('');
  const [publicClinicSlug, setPublicClinicSlug] = useState('');
  const [website, setWebsite] = useState('');
  const [category, setCategory] = useState('');
  const [address, setAddress] = useState('');
  const [currency, setCurrency] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState('');
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [workHours, setWorkHours] = useState(() => createDefaultWorkHours());
  const [colorMode, setColorMode] = useState('system');
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
  const activeBookingStatusMessage = bookingIsActive
    ? t(
        'settings.publicBooking.success',
        'Booking page is active: {url}',
        { url: resolvedBookingAbsoluteUrl || resolvedBookingUrl }
      )
    : '';
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

  const applyTheme = (mode) => {
    let resolvedMode = mode;

    if (mode === 'system') {
      const hour = new Date().getHours();
      const isNight = hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR;
      resolvedMode = isNight ? 'dark' : 'light';
    }

    document.documentElement.setAttribute('data-theme', resolvedMode);
  };

  useEffect(() => {
    const storedMode = localStorage.getItem(THEME_STORAGE_KEY);
    if (storedMode === 'light' || storedMode === 'dark' || storedMode === 'system') {
      setColorMode(storedMode);
      applyTheme(storedMode);
    } else {
      applyTheme('system');
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
          const teamAllowed = data?.accountType === 'team' || data?.hasTeam === true;
          setHasTeamAccess(teamAllowed);
          setSettingsSnapshot(data.settings || {});
          setFullName(data.displayName || user.displayName || '');
          setEmail(data.email || user.email || '');
          setClinicName(data.clinicName || '');
          setPublicClinicName(data.publicClinicName || data.clinicName || '');
          setPublicClinicSlug(data.publicClinicSlug || '');
          setWebsite(data.website || '');
          setPhotoURL(data.photoURL || user.photoURL || '');
          setAvatarPreviewUrl('');
          setAvatarFile(null);
          setRemoveAvatar(false);
          const loadedCategory =
            (Array.isArray(data.categories) && data.categories[0]) ||
            data.category ||
            '';
          setCategory(loadedCategory || '');
          setAddress(data.address || '');
          const loadedCurrency =
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
          if (data.themeMode === 'light' || data.themeMode === 'dark' || data.themeMode === 'system') {
            setColorMode(data.themeMode);
            applyTheme(data.themeMode);
            localStorage.setItem(THEME_STORAGE_KEY, data.themeMode);
          }
        } else {
          setHasTeamAccess(false);
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
          setCurrency('');
          setWorkHours(createDefaultWorkHours());
          setWorkHoursExceptionPreviews([]);
          setDictationLanguage('auto');
        }
      } catch (error) {
        console.error('[UserSettings] Failed to load profile', error);
        setHasTeamAccess(false);
      }
    };

    loadProfile();
  }, [user]);

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
    if (!user?.uid || !hasTeamAccess) {
      return undefined;
    }

    const teamRef = collection(db, 'users', user.uid, 'team');
    const unsubscribe = onSnapshot(
      teamRef,
      (snap) => {
        const fallbackLabel = t('settings.publicBooking.scheduleMemberFallback', 'Behandler');
        const loaded = snap.docs.map((docSnap) => mapTeamDocToScheduleMember(docSnap, fallbackLabel));
        const hasOwnerOption = loaded.some(
          (member) =>
            member.id === user.uid || member.memberUid === user.uid || member.isOwner === true
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
  }, [hasTeamAccess, ownerScheduleMember, t, user?.uid]);

  useEffect(() => {
    const selectedMemberId = selectedScheduleMember?.id || '';
    const selectedMemberUid = selectedScheduleMember?.memberUid || '';
    if (!user?.uid || !selectedMemberId) return;

    let isCancelled = false;
    const loadSelectedSchedule = async () => {
      setIsScheduleLoading(true);
      setShowWorkHoursExceptionsPreview(false);
      try {
        let sourceData = {};

        if (selectedMemberId === user.uid) {
          const ownerSnap = await getDoc(doc(db, 'users', user.uid));
          sourceData = ownerSnap.exists() ? ownerSnap.data() || {} : {};
        } else {
          const teamSnap = await getDoc(doc(db, 'users', user.uid, 'team', selectedMemberId));
          const teamData = teamSnap.exists() ? teamSnap.data() || {} : {};
          sourceData = teamData;

          const hasTeamHours = Boolean(
            teamData?.workHours && typeof teamData.workHours === 'object'
          );
          const hasTeamExceptions = Array.isArray(teamData?.workHoursExceptions);
          const linkedMemberUid = String(
            teamData?.memberUid || teamData?.uid || selectedMemberUid || ''
          ).trim();

          if ((!hasTeamHours || !hasTeamExceptions) && linkedMemberUid && linkedMemberUid !== user.uid) {
            const linkedUserSnap = await getDoc(doc(db, 'users', linkedMemberUid));
            if (linkedUserSnap.exists()) {
              const linkedUserData = linkedUserSnap.data() || {};
              sourceData = {
                ...linkedUserData,
                ...teamData,
                workHours: hasTeamHours ? teamData.workHours : linkedUserData.workHours,
                workHoursExceptions: hasTeamExceptions
                  ? teamData.workHoursExceptions
                  : linkedUserData.workHoursExceptions,
                workingHours: teamData.workingHours || linkedUserData.workingHours,
              };
            }
          }
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
  }, [selectedScheduleMember?.id, selectedScheduleMember?.memberUid, user?.uid]);

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
    applyTheme(colorMode);
    localStorage.setItem(THEME_STORAGE_KEY, colorMode);
  }, [colorMode]);

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

  useEffect(() => {
    if (colorMode !== 'system') return;

    const update = () => applyTheme('system');
    update();
    const intervalId = setInterval(update, 5 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, [colorMode]);

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
        selectedScheduleMemberId &&
        selectedScheduleMemberId !== user.uid;

      if (isBookingTeamScheduleSave) {
        const teamMemberRef = doc(db, 'users', user.uid, 'team', selectedScheduleMemberId);
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
        themeMode: colorMode,
        displayName: fullName,
        photoURL: resolvedPhotoURL || null,
        jobTitle: jobTitleForSave,
        clinicName,
        website,
        categories: category ? [category] : [],
        address,
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
      const clinicRef = doc(db, 'publicClinics', sanitizedSlug);
      const clinicSnap = await getDoc(clinicRef);
      if (clinicSnap.exists()) {
        const data = clinicSnap.data() || {};
        if (data.ownerUid && data.ownerUid !== user.uid) {
          setSlugStatus({
            tone: 'error',
            message: t('settings.publicBooking.errors.slugTaken', 'Slug er optaget. Prøv en anden.'),
          });
          return;
        }
      }

      const clinicPayload = {
        ownerUid: user.uid,
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

  const renderThemeCard = (mode, label, previewClass) => (
    <button
      type="button"
      className={`theme-card ${previewClass} ${colorMode === mode ? 'selected' : ''}`}
      onClick={() => setColorMode(mode)}
    >
      <div className="theme-card-preview" />
      <span className="theme-card-label">{label}</span>
    </button>
  );

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

  return (
    <BookingSidebarLayout>
      <div className="booking-page">
        <div className="booking-content">
          {/* Main Content */}
          <div className="usersettings-main">
          <div className="usersettings-page">
            <div className="usersettings-card">
              <div className="usersettings-layout">
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
                      <div className="usersettings-profile-fields">
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
                              <button
                                type="button"
                                className="usersettings-claim-btn usersettings-claim-btn-primary"
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
                          </div>

                          {bookingIsActive ? (
                            <div className="usersettings-status success">
                              {activeBookingStatusMessage}
                            </div>
                          ) : null}
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

                  {activeSection === 'appearance' && (
                    <>
                      <div className="usersettings-header">
                        <div className="usersettings-title">
                          {t('settings.appearance.title', 'Appearance')}
                        </div>
                        <div className="usersettings-subtitle">
                          {t('settings.appearance.subtitle', 'Vælg hvordan Selma skal se ud')}
                        </div>
                      </div>

                      <div className="usersettings-theme-grid">
                        {renderThemeCard('light', t('settings.appearance.light', 'Light'), 'theme-light')}
                        {renderThemeCard('system', t('settings.appearance.system', 'Match system'), 'theme-system')}
                        {renderThemeCard('dark', t('settings.appearance.dark', 'Dark'), 'theme-dark')}
                      </div>
                    </>
                  )}

                  {activeSection === 'language' && (
                    <>
                      <div className="usersettings-header">
                        <div className="usersettings-title">
                          {t('settings.language.title', 'Sprog')}
                        </div>
                      </div>

                      <div className="usersettings-profile-fields">
                        <div className="usersettings-section">
                          <label className="usersettings-label">
                            {t('settings.language.label', 'Foretrukket sprog')}
                          </label>
                          <select
                            className="usersettings-input"
                            value={language}
                            onChange={(e) => {
                              void setPreferredLanguage(e.target.value, { persist: false });
                            }}
                          >
                            {languageOptions.map((option) => (
                              <option key={option.code} value={option.code}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="usersettings-section">
                          <label className="usersettings-label">
                            {t('settings.language.dictationLabel', 'Dictation language')}
                          </label>
                          <select
                            className="usersettings-input"
                            value={dictationLanguage}
                            onChange={(e) => setDictationLanguage(e.target.value)}
                          >
                            <option value="auto">
                              {t('settings.language.dictationAuto', 'Auto (recommended)')}
                            </option>
                            {dictationLanguageOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="usersettings-section">
                          <label className="usersettings-label">
                            {t('settings.currency.label', 'Valuta')}
                          </label>
                          <select
                            className="usersettings-input"
                            value={currency}
                            onChange={(e) => setCurrency(e.target.value)}
                          >
                            <option value="">
                              {t('settings.currency.placeholder', 'Vælg valuta')}
                            </option>
                            {CURRENCY_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </>
                  )}

                  {activeSection === 'ai' && (
                    <>
                      <div className="usersettings-header">
                        <div className="usersettings-title">
                          {t('settings.ai.title', 'AI indstillinger')}
                        </div>
                      </div>

                      <div className="usersettings-profile-fields">
                        <div className="usersettings-section">
                          <label className="usersettings-label">
                            {t('settings.ai.audio.title', 'Lydoptagelse')}
                          </label>
                          <p className="usersettings-subtitle">
                            {t(
                              'settings.ai.audio.description',
                              'Selve lyden som optaget af mikrofonen. Lydfilen kan være hjælpsom, hvis vi efterfølgende skal ind og høre efter, om der er bestemte ord, udtaler eller dialekter vi misforstår.'
                            )}
                          </p>
                          <select
                            className="usersettings-input"
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

                        <div className="usersettings-section">
                          <label className="usersettings-label">
                            {t('settings.ai.transcript.title', 'Transkription')}
                          </label>
                          <p className="usersettings-subtitle">
                            {t(
                              'settings.ai.transcript.description',
                              'Tekstudgaven af hvad systemet har "hørt". Vi har brug for transkriptionen, hvis vi skal hjælpe dig med "redningsforsøg", hvis en optagelse afbrydes, eller hvis der opstår andre tekniske problemer.'
                            )}
                          </p>
                          <select
                            className="usersettings-input"
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

                        <div className="usersettings-section">
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
                            className="usersettings-input"
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
