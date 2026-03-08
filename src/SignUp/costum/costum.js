import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, MapPin } from 'lucide-react';
import { collection, doc, getDoc, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { useAuth } from '../../AuthContext';
import { useLanguage } from '../../LanguageContext';
import { db } from '../../firebase';
import { ensureMemberWorkspaceGuard } from '../../utils/employeeWorkspace';
import { resolveWorkspaceContext } from '../../utils/workspaceContext';
import './costum.css';

const DEFAULT_TEAM_SIZE_OPTIONS = ['2-5 personer', '6-10 personer', '11+ personer'];

export const DEFAULT_SOFTWARE_OPTIONS = [
  'Acuity',
  'Booksy',
  'Calendly',
  'Goldie',
  'Janeapp',
  'Mindbody',
  'Salon Iris',
  'Setmore',
  'Shortcuts',
  'Square',
  'Styleseat',
  'Timely',
  'Treatwell',
  'Vagaro',
  'Zenoti',
  'Jeg bruger ikke nogen software',
  'Andet',
];

const DEFAULT_HEARD_FROM_OPTIONS = [
  'Anbefalet af en ven',
  'Søgemaskine (f.eks. Google eller Yahoo)',
  'Sociale medier',
  'Annonce i e-mailen',
  'Annonce i et magasin',
  'Websteder med anmeldelser (f.eks. Capterra, Trustpilot)',
  'AI Chatbot (f.eks. ChatGPT, Gemini, DeepSeek)',
  'Andet',
];

const CURRENCY_OPTIONS = [
  { value: 'DKK', label: 'DKK' },
  { value: 'EUR', label: 'EURO' },
  { value: 'USD', label: 'USD' },
  { value: 'NOK', label: 'NOK' },
  { value: 'SEK', label: 'SEK' },
  { value: 'AED', label: 'AED' },
];

const FormLabel = ({ children }) => (
  <label className="onboarding-label">{children}</label>
);

const OptionCard = ({ label, selected, onClick, size = 'md' }) => (
  <button
    type="button"
    className={`onboarding-option ${selected ? 'is-selected' : ''} size-${size}`}
    onClick={onClick}
  >
    <div className="option-check">
      <Check size={16} strokeWidth={2.5} />
    </div>
    <span>{label}</span>
  </button>
);

function OnboardingSlides() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { language, setLanguage, languageOptions, t, getArray } = useLanguage();
  const [stepIndex, setStepIndex] = useState(0);
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [isPersisting, setIsPersisting] = useState(false);
  const [isCheckingOnboarding, setIsCheckingOnboarding] = useState(true);
  const [formData, setFormData] = useState({
    language: language || 'da',
    currency: '',
    clinicName: '',
    accountType: '',
    teamSize: '',
    address: '',
    heardFrom: '',
  });
  const addressInputRef = useRef(null);
  const autocompleteRef = useRef(null);

  useEffect(() => {
    if (!language) return;
    setFormData((prev) =>
      prev.language === language ? prev : { ...prev, language }
    );
  }, [language]);

  const teamSizeOptions = useMemo(
    () => getArray('onboarding.steps.teamSize.options', DEFAULT_TEAM_SIZE_OPTIONS),
    [getArray]
  );
  const heardFromOptions = useMemo(
    () => getArray('onboarding.steps.heardFrom.options', DEFAULT_HEARD_FROM_OPTIONS),
    [getArray]
  );

  useEffect(() => {
    if (loading) return;

    let isMounted = true;

    const run = async () => {
      if (!user?.uid) {
        console.info('[ONBOARDING DEBUG] no authenticated user in onboarding guard', {
          uid: null,
          target: '/signup',
          reason: 'missing-user',
        });
        setIsCheckingOnboarding(false);
        return;
      }

      try {
        const memberGuard = await ensureMemberWorkspaceGuard(user, {
          context: 'onboarding-guard',
        });
        if (memberGuard?.isMember && memberGuard?.workspace?.clinicId) {
          console.info('[MEMBER GUARD] onboarding guard matched member', {
            uid: user.uid,
            workspace: memberGuard.workspace,
          });
          navigate('/booking', { replace: true });
          return;
        }
        console.info('[ONBOARDING DEBUG] running onboarding workspace guard', {
          uid: user.uid,
          email: user.email || null,
        });
        const workspace = await resolveWorkspaceContext(user);
        console.info('[ONBOARDING DEBUG] onboarding workspace guard result', {
          uid: user.uid,
          workspace,
        });
        if (workspace?.hasWorkspace) {
          console.info('[ONBOARDING DEBUG] redirecting away from onboarding', {
            uid: user.uid,
            target: '/booking',
            reason: `workspace-found:${workspace?.source || 'unknown'}`,
          });
          navigate('/booking', { replace: true });
          return;
        }
      } catch (error) {
        console.error('[OnboardingSlides] Failed to resolve workspace before onboarding', error);
      } finally {
        if (isMounted) {
          setIsCheckingOnboarding(false);
        }
      }
    };

    void run();

    return () => {
      isMounted = false;
    };
  }, [loading, navigate, user?.uid]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      console.info('[ONBOARDING DEBUG] redirecting to signup from onboarding', {
        uid: null,
        target: '/signup',
        reason: 'not-authenticated',
      });
      navigate('/signup', { replace: true });
    }
  }, [loading, navigate, user]);

  const steps = useMemo(() => {
    const flow = ['language', 'business', 'accountType'];
    if (formData.accountType === 'team') {
      flow.push('teamSize');
    }
    flow.push('address', 'heardFrom', 'complete');
    return flow;
  }, [formData.accountType]);

  const currentStep = steps[stepIndex];
  const isLastStep = stepIndex === steps.length - 1;

  const progressSteps = useMemo(
    () => steps.filter((step) => step !== 'complete'),
    [steps]
  );

  useEffect(() => {
    if (stepIndex > steps.length - 1) {
      setStepIndex(Math.max(steps.length - 1, 0));
    }
  }, [stepIndex, steps]);

  useEffect(() => {
    if (!mapsLoaded || currentStep !== 'address') return;
    if (!addressInputRef.current || !window.google?.maps?.places) return;
    if (autocompleteRef.current) return;

    const autocomplete = new window.google.maps.places.Autocomplete(addressInputRef.current, {
      types: ['address'],
      fields: ['formatted_address', 'name', 'address_components', 'geometry'],
    });

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      const formatted = place?.formatted_address || place?.name || addressInputRef.current.value;
      setFormData((prev) => ({ ...prev, address: formatted || '' }));
    });

    autocompleteRef.current = autocomplete;

    return () => {
      if (window.google?.maps?.event && autocomplete) {
        window.google.maps.event.clearInstanceListeners(autocomplete);
      }
      autocompleteRef.current = null;
    };
  }, [mapsLoaded, currentStep]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
    if (!apiKey) return;
    const mapsLanguage = language || 'da';

    if (window.google?.maps?.places) {
      setMapsLoaded(true);
      return;
    }

    const existingScript = document.getElementById('google-maps-script');
    const handleLoad = () => setMapsLoaded(true);
    if (existingScript) {
      existingScript.addEventListener('load', handleLoad);
      return () => existingScript.removeEventListener('load', handleLoad);
    }

    const script = document.createElement('script');
    script.id = 'google-maps-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=${mapsLanguage}`;
    script.dataset.language = mapsLanguage;
    script.async = true;
    script.onload = () => setMapsLoaded(true);
    document.head.appendChild(script);

    return () => {
      script.onload = null;
    };
  }, [language]);

  const isStepComplete = (step) => {
    switch (step) {
      case 'language':
        return Boolean(formData.language && formData.currency);
      case 'business':
        return formData.clinicName.trim().length > 1;
      case 'accountType':
        return Boolean(formData.accountType);
      case 'teamSize':
        return Boolean(formData.teamSize);
      case 'address':
        return formData.address.trim().length > 2;
      case 'heardFrom':
        return Boolean(formData.heardFrom);
      case 'complete':
        return true;
      default:
        return true;
    }
  };

  const canContinue = isStepComplete(currentStep);

  const buildProfileUpdate = (markComplete) => {
    const update = {
      updatedAt: serverTimestamp(),
    };

    const trimmedClinicName = formData.clinicName.trim();
    const trimmedAddress = formData.address.trim();

    if (trimmedClinicName) update.clinicName = trimmedClinicName;
    if (formData.currency) update.currency = formData.currency;
    if (formData.accountType) update.accountType = formData.accountType;
    if (formData.teamSize) update.teamSize = formData.teamSize;
    if (trimmedAddress) update.address = trimmedAddress;
    if (formData.heardFrom) update.heardFrom = formData.heardFrom;

    if (markComplete) {
      update.onboardingComplete = true;
      update.onboardingCompletedAt = serverTimestamp();
    }

    return update;
  };

  const ensureClinicBootstrap = async (accountTypeValue = formData.accountType) => {
    if (!user?.uid || !accountTypeValue) return null;
    const memberGuard = await ensureMemberWorkspaceGuard(user, {
      context: 'onboarding-bootstrap',
    });
    if (memberGuard?.isMember && memberGuard?.workspace?.clinicId) {
      console.info('[SOLO BOOTSTRAP BLOCKED] member already belongs to clinic workspace', {
        uid: user.uid,
        requestedAccountType: accountTypeValue,
        clinicId: memberGuard.workspace.clinicId,
        ownerUid: memberGuard.workspace.ownerUid || null,
      });
      return memberGuard.workspace.clinicId;
    }
    const clinicType = accountTypeValue === 'team' ? 'team' : 'solo';
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    const userData = userSnap.exists() ? userSnap.data() || {} : {};
    let clinicId = `${userData.activeClinicId || ''}`.trim() || null;

    if (!clinicId) {
      clinicId = doc(collection(db, 'clinics')).id;
    }

    const clinicRef = doc(db, 'clinics', clinicId);
    const memberRef = doc(db, 'clinics', clinicId, 'members', user.uid);
    const clinicSnap = await getDoc(clinicRef);
    const memberSnap = await getDoc(memberRef);

    const trimmedClinicName = formData.clinicName.trim();
    const displayName = user.displayName || userData.displayName || '';
    const email = user.email || userData.email || '';

    const clinicPayload = {
      ownerUid: user.uid,
      clinicType,
      updatedAt: serverTimestamp(),
      ...(trimmedClinicName ? { name: trimmedClinicName } : {}),
    };
    if (!clinicSnap.exists()) {
      clinicPayload.createdAt = serverTimestamp();
    }

    const memberPayload = {
      role: 'owner',
      displayName,
      email,
      updatedAt: serverTimestamp(),
    };
    if (!memberSnap.exists()) {
      memberPayload.createdAt = serverTimestamp();
    }

    const batch = writeBatch(db);
    batch.set(clinicRef, clinicPayload, { merge: true });
    batch.set(memberRef, memberPayload, { merge: true });
    batch.set(
      userRef,
      {
        activeClinicId: clinicId,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    await batch.commit();

    if (process.env.NODE_ENV !== 'production') {
      console.info('[OnboardingSlides] clinic bootstrap complete', {
        uid: user.uid,
        clinicId,
        clinicType,
      });
    }

    return clinicId;
  };

  const persistProfile = async (markComplete) => {
    if (!user?.uid) return;
    const update = buildProfileUpdate(markComplete);
    const memberGuard = await ensureMemberWorkspaceGuard(user, {
      context: 'onboarding-persist',
    });
    if (memberGuard?.isMember && memberGuard?.workspace?.clinicId) {
      const ownerUid = `${memberGuard.workspace.ownerUid || ''}`.trim();
      update.activeClinicId = memberGuard.workspace.clinicId;
      update.clinicId = memberGuard.workspace.clinicId;
      update.role = 'member';
      update.accountType = 'team';
      update.hasTeam = true;
      if (ownerUid) {
        update.clinicOwnerUid = ownerUid;
        update.dataOwnerUid = ownerUid;
      }
      console.info('[SOLO BOOTSTRAP BLOCKED] onboarding persist forced to member workspace', {
        uid: user.uid,
        clinicId: memberGuard.workspace.clinicId,
        ownerUid: ownerUid || null,
      });
      await setDoc(doc(db, 'users', user.uid), update, { merge: true });
      return;
    }
    const clinicId = await ensureClinicBootstrap(formData.accountType);
    if (clinicId) {
      update.activeClinicId = clinicId;
      const trimmedClinicName = formData.clinicName.trim();
      const trimmedAddress = formData.address.trim();
      const trimmedCurrency = formData.currency.trim();
      const batch = writeBatch(db);

      batch.set(doc(db, 'users', user.uid), update, { merge: true });
      batch.set(
        doc(db, 'clinics', clinicId),
        {
          name: trimmedClinicName || '',
          clinicName: trimmedClinicName || '',
          address: trimmedAddress,
          currency: trimmedCurrency || '',
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      batch.set(
        doc(db, 'clinics', clinicId, 'settings', 'general'),
        {
          clinicName: trimmedClinicName || '',
          address: trimmedAddress,
          currency: trimmedCurrency || '',
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      await batch.commit();
      return;
    }
    await setDoc(doc(db, 'users', user.uid), update, { merge: true });
  };

  const handleExit = async () => {
    if (isPersisting) return;
    setIsPersisting(true);
    try {
      await persistProfile(false);
    } catch (error) {
      console.error('[OnboardingSlides] Failed to save onboarding progress', error);
    } finally {
      setIsPersisting(false);
      navigate('/', { replace: true });
    }
  };

  const handleFinish = async () => {
    if (isPersisting) return;
    setIsPersisting(true);
    try {
      await persistProfile(true);
    } catch (error) {
      console.error('[OnboardingSlides] Failed to save onboarding answers', error);
    } finally {
      setIsPersisting(false);
      navigate('/booking');
    }
  };

  const handleNext = async () => {
    if (!canContinue || isPersisting) return;
    if (isLastStep) {
      if (currentStep === 'complete') {
        void handleFinish();
        return;
      }
      return;
    }
    if (currentStep === 'accountType' && formData.accountType) {
      try {
        setIsPersisting(true);
        await ensureClinicBootstrap(formData.accountType);
      } catch (error) {
        console.error('[OnboardingSlides] Failed to bootstrap clinic on account type step', error);
      } finally {
        setIsPersisting(false);
      }
    }
    setStepIndex((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const handleBack = () => {
    if (stepIndex === 0) return;
    setStepIndex((prev) => Math.max(prev - 1, 0));
  };

  const selectAccountType = (type) => {
    setFormData((prev) => ({
      ...prev,
      accountType: type,
      teamSize: type === 'team' ? prev.teamSize : '',
    }));
  };

  const progressActiveIndex = Math.min(stepIndex, progressSteps.length - 1);

  const renderLanguageStep = () => (
    <div className="onboarding-content">
      <p className="onboarding-eyebrow">{t('onboarding.eyebrow', 'Kontoopsætning')}</p>
      <h1 className="onboarding-title">{t('language.title', 'Vælg sprog')}</h1>
      <p className="onboarding-subtitle">
        {t('language.subtitle', 'Du kan ændre sproget senere i indstillinger.')}
      </p>
      <div className="onboarding-grid">
        {languageOptions.map((option) => (
          <OptionCard
            key={option.code}
            label={option.label}
            selected={formData.language === option.code}
            onClick={() => {
              setFormData((prev) => ({ ...prev, language: option.code }));
              void setLanguage(option.code);
            }}
            size="lg"
          />
        ))}
      </div>
      <FormLabel>{t('onboarding.currency.label', 'Valuta')}</FormLabel>
      <p className="onboarding-subtitle">
        {t('onboarding.currency.subtitle', 'Du kan ændre valuta senere i indstillinger.')}
      </p>
      <div className="onboarding-grid two-cols">
        {CURRENCY_OPTIONS.map((option) => (
          <OptionCard
            key={option.value}
            label={option.label}
            selected={formData.currency === option.value}
            onClick={() => setFormData((prev) => ({ ...prev, currency: option.value }))}
            size="lg"
          />
        ))}
      </div>
    </div>
  );

  const renderBusinessStep = () => (
    <div className="onboarding-content">
      <p className="onboarding-eyebrow">{t('onboarding.eyebrow', 'Kontoopsætning')}</p>
      <h1 className="onboarding-title">{t('onboarding.steps.business.title', 'Hvad hedder din klinik?')}</h1>
      <div className="onboarding-form">
        <FormLabel>{t('onboarding.steps.business.nameLabel', 'Klinikkens navn')}</FormLabel>
        <input
          type="text"
          placeholder={t('onboarding.steps.business.namePlaceholder', 'F.eks. Selma Klinik')}
          value={formData.clinicName}
          onChange={(e) => setFormData((prev) => ({ ...prev, clinicName: e.target.value }))}
        />
      </div>
    </div>
  );

  const renderAccountTypeStep = () => (
    <div className="onboarding-content">
      <p className="onboarding-eyebrow">{t('onboarding.eyebrow', 'Kontoopsætning')}</p>
      <h1 className="onboarding-title">{t('onboarding.steps.accountType.title', 'Vælg størrelse')}</h1>
      <p className="onboarding-subtitle">
        {t('onboarding.steps.accountType.subtitle', 'Dette hjælper os med at konfigurere din konto korrekt')}
      </p>
      <div className="onboarding-grid two-cols">
        <OptionCard
          label={t('onboarding.steps.accountType.solo', 'Jeg er selvstændig')}
          selected={formData.accountType === 'solo'}
          onClick={() => selectAccountType('solo')}
          size="lg"
        />
        <OptionCard
          label={t('onboarding.steps.accountType.team', 'Jeg har et team')}
          selected={formData.accountType === 'team'}
          onClick={() => selectAccountType('team')}
          size="lg"
        />
      </div>
    </div>
  );

  const renderTeamSizeStep = () => (
    <div className="onboarding-content">
      <p className="onboarding-eyebrow">{t('onboarding.eyebrow', 'Kontoopsætning')}</p>
      <h1 className="onboarding-title">{t('onboarding.steps.teamSize.title', 'Hvor mange er i')}</h1>
      <p className="onboarding-subtitle">
        {t('onboarding.steps.teamSize.subtitle', 'Det er muligt at tilføje flere senere hen')}
      </p>
      <div className="onboarding-stack">
        {teamSizeOptions.map((option) => (
          <OptionCard
            key={option}
            label={option}
            selected={formData.teamSize === option}
            onClick={() => setFormData((prev) => ({ ...prev, teamSize: option }))}
            size="lg"
          />
        ))}
      </div>
    </div>
  );

  const renderAddressStep = () => (
    <div className="onboarding-content">
      <p className="onboarding-eyebrow">{t('onboarding.eyebrow', 'Kontoopsætning')}</p>
      <h1 className="onboarding-title">{t('onboarding.steps.address.title', 'Angiv virksomhedens adresse')}</h1>
      <p className="onboarding-subtitle">
        {t(
          'onboarding.steps.address.subtitle',
          'Adresse bruges til fakturering, betaling og opsætning af bookingsystemet til jeres/ din praksis'
        )}
      </p>
      <div className="onboarding-form single">
        <FormLabel>{t('onboarding.steps.address.label', 'Hvor har din virksomheds adresse?')}</FormLabel>
        <div className="onboarding-input-icon">
          <MapPin size={18} />
          <input
            type="text"
            placeholder={t('onboarding.steps.address.placeholder', 'Indtast adresse')}
            value={formData.address}
            ref={addressInputRef}
            onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
          />
        </div>
      </div>
    </div>
  );

  const renderHeardFromStep = () => (
    <div className="onboarding-content">
      <p className="onboarding-eyebrow">{t('onboarding.eyebrow', 'Kontoopsætning')}</p>
      <h1 className="onboarding-title">{t('onboarding.steps.heardFrom.title', 'Hvordan hørte du om Selma?')}</h1>
      <div className="onboarding-stack">
        {heardFromOptions.map((option) => (
          <OptionCard
            key={option}
            label={option}
            selected={formData.heardFrom === option}
            onClick={() => setFormData((prev) => ({ ...prev, heardFrom: option }))}
          />
        ))}
      </div>
    </div>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 'language':
        return renderLanguageStep();
      case 'business':
        return renderBusinessStep();
      case 'accountType':
        return renderAccountTypeStep();
      case 'teamSize':
        return renderTeamSizeStep();
      case 'address':
        return renderAddressStep();
      case 'heardFrom':
        return renderHeardFromStep();
      default:
        return null;
    }
  };

  const renderCompleteStep = () => (
    <div className="completion-screen">
      <div className="completion-icon">
        <Check size={28} />
      </div>
      <h2 className="completion-title">
        {t('onboarding.completion.title', 'Din profil er oprettet')}
      </h2>
      <p className="completion-subtitle">
        {t('onboarding.completion.subtitle', 'Få 14 dages gratis brug af Selma for virksomheder')}
      </p>
      <button
        type="button"
        className="primary-button"
        onClick={handleFinish}
        disabled={isPersisting}
        aria-busy={isPersisting}
      >
        {isPersisting
          ? t('onboarding.actions.saving', 'Gemmer…')
          : t('onboarding.completion.button', 'Kom i gang')}
      </button>
    </div>
  );

  if (loading || isCheckingOnboarding) {
    return (
      <div className="onboarding-root">
        <div className="onboarding-card">
          <div className="completion-screen">
            <div className="completion-icon" aria-hidden="true">
              <Check size={28} />
            </div>
            <h2 className="completion-title">
              {t('onboarding.loading', 'Indlæser…')}
            </h2>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="onboarding-root">
      <div className="onboarding-card">
        {currentStep !== 'complete' && (
          <div className="onboarding-top">
            <div
              className="segment-track"
              style={{ gridTemplateColumns: `repeat(${progressSteps.length || 1}, 1fr)` }}
            >
              {progressSteps.map((step, idx) => (
                <span
                  key={step}
                  className={`segment ${idx <= progressActiveIndex ? 'is-active' : ''}`}
                />
              ))}
            </div>
            <div className="top-bar">
              <button
                type="button"
                className="circle-button"
                onClick={handleBack}
                disabled={stepIndex === 0}
                aria-label={t('onboarding.aria.back', 'Tilbage')}
              >
                <ArrowLeft size={18} />
              </button>
              <span className="top-label">
                {t('onboarding.topLabel', 'Kontoopsætning')}
              </span>
              <div className="top-actions">
                <button
                  type="button"
                  className="ghost-pill"
                  onClick={handleExit}
                  disabled={isPersisting}
                >
                  {t('onboarding.actions.close', 'Luk')}
                </button>
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleNext}
                  disabled={!canContinue || isPersisting}
                >
                  {isLastStep
                    ? t('onboarding.actions.finish', 'Færdig')
                    : t('onboarding.actions.continue', 'Fortsæt')}
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}

        {currentStep === 'complete' ? renderCompleteStep() : renderStepContent()}
      </div>
    </div>
  );
}

export default OnboardingSlides;
