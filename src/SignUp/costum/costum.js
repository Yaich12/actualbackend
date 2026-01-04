import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, MapPin } from 'lucide-react';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useAuth } from '../../AuthContext';
import { useLanguage } from '../../LanguageContext';
import { db } from '../../firebase';
import './costum.css';

const CATEGORY_CARDS = [
  {
    value: 'Physiotherapist',
    fallbackLabel: 'Physiotherapist',
    image: '/hero-3/pexels-cottonbro-3998012.jpg',
  },
  {
    value: 'Osteopath',
    fallbackLabel: 'Osteopath',
    image: encodeURI('/hero-3/pexels-karola-g-4506208.jpg'),
  },
  {
    value: 'Chiropractor',
    fallbackLabel: 'Chiropractor',
    image: '/hero-3/pexels-yankrukov-5793798-1.jpg',
  },
];

const DEFAULT_CATEGORY_LABELS = CATEGORY_CARDS.map((card) => card.fallbackLabel);

const DEFAULT_TEAM_SIZE_OPTIONS = ['2-5 personer', '6-10 personer', '11+ personer'];

const DEFAULT_SERVICE_MODEL_OPTIONS = [
  'Kunder besøger mig på et fysisk sted',
  'Jeg rejser rundt og besøger mine kunder',
  'Jeg tilbyder virtuelle tjenester online',
];

const DEFAULT_SOFTWARE_OPTIONS = [
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

const MAX_CATEGORIES = 1;

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
    businessName: '',
    website: '',
    categories: [],
    accountType: '',
    teamSize: '',
    serviceModel: '',
    address: '',
    software: '',
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

  const categoryLabels = useMemo(
    () => getArray('onboarding.steps.categories.options', DEFAULT_CATEGORY_LABELS),
    [getArray]
  );
  const categoryCards = useMemo(
    () =>
      CATEGORY_CARDS.map((card, index) => ({
        ...card,
        label: categoryLabels[index] || card.fallbackLabel,
      })),
    [categoryLabels]
  );
  const teamSizeOptions = useMemo(
    () => getArray('onboarding.steps.teamSize.options', DEFAULT_TEAM_SIZE_OPTIONS),
    [getArray]
  );
  const serviceModelOptions = useMemo(
    () => getArray('onboarding.steps.serviceModel.options', DEFAULT_SERVICE_MODEL_OPTIONS),
    [getArray]
  );
  const softwareOptions = useMemo(
    () => getArray('onboarding.steps.software.options', DEFAULT_SOFTWARE_OPTIONS),
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
        setIsCheckingOnboarding(false);
        return;
      }

      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        const data = snap.exists() ? snap.data() : null;
        if (data?.onboardingComplete === true) {
          navigate('/booking', { replace: true });
          return;
        }
      } catch (error) {
        console.error('[OnboardingSlides] Failed to check onboarding status', error);
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
      navigate('/signup', { replace: true });
    }
  }, [loading, navigate, user]);

  const steps = useMemo(() => {
    const flow = ['language', 'business', 'categories', 'accountType'];
    if (formData.accountType === 'team') {
      flow.push('teamSize');
    }
    flow.push('serviceModel', 'address', 'software', 'heardFrom', 'complete');
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
        return formData.businessName.trim().length > 1;
      case 'categories':
        return formData.categories.length > 0;
      case 'accountType':
        return Boolean(formData.accountType);
      case 'teamSize':
        return Boolean(formData.teamSize);
      case 'serviceModel':
        return Boolean(formData.serviceModel);
      case 'address':
        return formData.address.trim().length > 2;
      case 'software':
        return Boolean(formData.software);
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

    const trimmedBusinessName = formData.businessName.trim();
    const trimmedWebsite = formData.website.trim();
    const trimmedAddress = formData.address.trim();

    if (trimmedBusinessName) update.clinicName = trimmedBusinessName;
    if (trimmedWebsite) update.website = trimmedWebsite;
    if (formData.categories.length) {
      update.categories = formData.categories;
      update.jobTitle = formData.categories[0];
    }
    if (formData.currency) update.currency = formData.currency;
    if (formData.accountType) update.accountType = formData.accountType;
    if (formData.teamSize) update.teamSize = formData.teamSize;
    if (formData.serviceModel) update.serviceModel = formData.serviceModel;
    if (trimmedAddress) update.address = trimmedAddress;
    if (formData.software) update.software = formData.software;
    if (formData.heardFrom) update.heardFrom = formData.heardFrom;

    if (markComplete) {
      update.onboardingComplete = true;
      update.onboardingCompletedAt = serverTimestamp();
    }

    return update;
  };

  const persistProfile = async (markComplete) => {
    if (!user?.uid) return;
    const update = buildProfileUpdate(markComplete);
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
      navigate('/booking');
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

  const handleNext = () => {
    if (!canContinue) return;
    if (isLastStep) {
      if (currentStep === 'complete') {
        void handleFinish();
        return;
      }
      return;
    }
    setStepIndex((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const handleBack = () => {
    if (stepIndex === 0) return;
    setStepIndex((prev) => Math.max(prev - 1, 0));
  };

  const toggleCategory = (category) => {
    setFormData((prev) => {
      const exists = prev.categories.includes(category);
      if (exists) {
        return { ...prev, categories: [] };
      }
      return { ...prev, categories: [category] };
    });
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
      <h1 className="onboarding-title">{t('onboarding.steps.business.title', 'Hvad hedder din virksomhed?')}</h1>
      <p className="onboarding-subtitle">
        {t(
          'onboarding.steps.business.subtitle',
          'Dette er det varemærke, dine kunder vil se. Din fakturering og dit juridiske navn kan tilføjes senere.'
        )}
      </p>
      <div className="onboarding-form">
        <FormLabel>{t('onboarding.steps.business.nameLabel', 'Virksomhedens navn')}</FormLabel>
        <input
          type="text"
          placeholder={t('onboarding.steps.business.namePlaceholder', 'F.eks. Selma Klinik')}
          value={formData.businessName}
          onChange={(e) => setFormData((prev) => ({ ...prev, businessName: e.target.value }))}
        />
        <FormLabel>{t('onboarding.steps.business.websiteLabel', 'Websted (Valgfrit)')}</FormLabel>
        <input
          type="url"
          placeholder={t('onboarding.steps.business.websitePlaceholder', 'www.ditwebsted.com')}
          value={formData.website}
          onChange={(e) => setFormData((prev) => ({ ...prev, website: e.target.value }))}
        />
      </div>
    </div>
  );

  const renderCategoriesStep = () => (
    <div className="onboarding-content">
      <p className="onboarding-eyebrow">{t('onboarding.eyebrow', 'Kontoopsætning')}</p>
      <h1 className="onboarding-title">
        {t('onboarding.steps.categories.title', 'Vælg den mulighed der passer bedst til din virksomhed')}
      </h1>
      <p className="onboarding-subtitle">{t('onboarding.steps.categories.subtitle', 'Du kan ændre dette senere')}</p>
      <div className="category-hero">
        {categoryCards.map((card) => (
          <button
            key={card.value}
            type="button"
            onClick={() => toggleCategory(card.value)}
            className={`category-hero-card ${
              formData.categories.includes(card.value) ? 'is-selected' : ''
            }`}
          >
            <div
              className="category-hero-img"
              style={{ backgroundImage: `url('${card.image}')` }}
              role="img"
              aria-label={card.label}
            />
            <span className="category-hero-label">{card.label}</span>
          </button>
        ))}
      </div>
      <div className="onboarding-hint">
        {t('onboarding.steps.categories.hint', '{count}/{max} valgt', {
          count: formData.categories.length,
          max: MAX_CATEGORIES,
        })}
      </div>
    </div>
  );

  const renderAccountTypeStep = () => (
    <div className="onboarding-content">
      <p className="onboarding-eyebrow">{t('onboarding.eyebrow', 'Kontoopsætning')}</p>
      <h1 className="onboarding-title">{t('onboarding.steps.accountType.title', 'Vælg kontotype')}</h1>
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
      <h1 className="onboarding-title">{t('onboarding.steps.teamSize.title', 'Hvor mange medarbejdere har du')}</h1>
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

  const renderServiceModelStep = () => (
    <div className="onboarding-content">
      <p className="onboarding-eyebrow">{t('onboarding.eyebrow', 'Kontoopsætning')}</p>
      <h1 className="onboarding-title">{t('onboarding.steps.serviceModel.title', 'Hvor tilbyder du dine tjenester?')}</h1>
      <div className="onboarding-stack">
        {serviceModelOptions.map((option) => (
          <OptionCard
            key={option}
            label={option}
            selected={formData.serviceModel === option}
            onClick={() => setFormData((prev) => ({ ...prev, serviceModel: option }))}
            size="lg"
          />
        ))}
      </div>
    </div>
  );

  const renderAddressStep = () => (
    <div className="onboarding-content">
      <p className="onboarding-eyebrow">{t('onboarding.eyebrow', 'Kontoopsætning')}</p>
      <h1 className="onboarding-title">{t('onboarding.steps.address.title', 'Angiv din virksomheds fysiske placering')}</h1>
      <p className="onboarding-subtitle">
        {t(
          'onboarding.steps.address.subtitle',
          'Tilføj din primære virksomhedsplacering, så kunderne nemt kan finde dig. Du kan tilføje flere steder senere.'
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

  const renderSoftwareStep = () => (
    <div className="onboarding-content">
      <p className="onboarding-eyebrow">{t('onboarding.eyebrow', 'Kontoopsætning')}</p>
      <h1 className="onboarding-title">{t('onboarding.steps.software.title', 'Hvilken software bruger du i øjeblikket?')}</h1>
      <p className="onboarding-subtitle">
        {t(
          'onboarding.steps.software.subtitle',
          'Hvis du vil skifte, kan vi hjælpe med at fremskynde din virksomhedopsætning og importere dine data til din nye Selma-konto.'
        )}
      </p>
      <div className="onboarding-stack">
        {softwareOptions.map((option) => (
          <OptionCard
            key={option}
            label={option}
            selected={formData.software === option}
            onClick={() => setFormData((prev) => ({ ...prev, software: option }))}
          />
        ))}
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
      case 'categories':
        return renderCategoriesStep();
      case 'accountType':
        return renderAccountTypeStep();
      case 'teamSize':
        return renderTeamSizeStep();
      case 'serviceModel':
        return renderServiceModelStep();
      case 'address':
        return renderAddressStep();
      case 'software':
        return renderSoftwareStep();
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
        {t('onboarding.completion.title', 'Din virksomhed er oprettet!')}
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
          : t('onboarding.completion.button', 'Færdig')}
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
                  disabled={!canContinue}
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
