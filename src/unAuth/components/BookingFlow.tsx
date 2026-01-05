import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  Brain,
  HandHeart,
  HeartPulse,
  Sparkles,
  Stethoscope,
  UserRound,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useLanguage } from '../language/LanguageProvider';

type Category = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
};

type Service = {
  id: string;
  name: string;
  duration: number;
  price: number;
};

type Practitioner = {
  id: string;
  name: string;
  title: string;
  avatar: string;
};

type Slot = {
  id: string;
  time: string;
  practitionerId: string;
};

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  physio: Activity,
  chiro: Stethoscope,
  osteopathy: HandHeart,
  sports: HeartPulse,
  mind: Brain,
  recovery: Sparkles,
};

const baseTimes = ['08:30', '09:15', '10:00', '11:30', '13:00', '14:15', '15:00', '16:30'];

const BookingFlow: React.FC = () => {
  const { t, getArray, language } = useLanguage();
  const locale = language === 'en' ? 'en-US' : 'da-DK';
  const minutesLabel = t('common.units.minutes');
  const currencyLabel = t('common.units.currency');
  const placeholder = t('common.placeholder');
  const [step, setStep] = useState(1);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [selectedDateKey, setSelectedDateKey] = useState<string>('');
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<'sms' | 'guest'>('sms');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactAddress, setContactAddress] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  const categories: Category[] = useMemo(() => {
    const items = getArray('features.websiteBuilder.bookingFlow.categories', []);
    return items.map((item) => ({
      ...item,
      icon: CATEGORY_ICONS[item.id] || Sparkles,
    }));
  }, [getArray]);

  const servicesByCategory: Record<string, Service[]> = useMemo(
    () => ({
      physio: getArray('features.websiteBuilder.bookingFlow.services.physio', []),
      chiro: getArray('features.websiteBuilder.bookingFlow.services.chiro', []),
      osteopathy: getArray('features.websiteBuilder.bookingFlow.services.osteopathy', []),
      sports: getArray('features.websiteBuilder.bookingFlow.services.sports', []),
      mind: getArray('features.websiteBuilder.bookingFlow.services.mind', []),
      recovery: getArray('features.websiteBuilder.bookingFlow.services.recovery', []),
    }),
    [getArray]
  );

  const practitioners: Practitioner[] = useMemo(
    () => getArray('features.websiteBuilder.bookingFlow.practitioners', []),
    [getArray]
  );

  const stepLabels = getArray('features.websiteBuilder.bookingFlow.steps', []);
  const weekdayLabels = getArray('features.websiteBuilder.bookingFlow.weekdays', []);

  const dates = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 14 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() + index);
      return {
        key: date.toISOString().slice(0, 10),
        label: date.toLocaleDateString(locale, { weekday: 'short' }),
        day: date.getDate(),
        month: date.toLocaleDateString(locale, { month: 'long' }),
        year: date.getFullYear(),
      };
    });
  }, [locale]);

  const calendarLabel = useMemo(() => {
    const first = dates[0];
    if (!first) return '';
    return `${first.month} ${first.year}`;
  }, [dates]);

  const selectedService = useMemo(() => {
    if (!categoryId || !serviceId) return null;
    return servicesByCategory[categoryId]?.find((service) => service.id === serviceId) ?? null;
  }, [categoryId, serviceId]);

  const slots = useMemo<Slot[]>(() => {
    if (!selectedDateKey) return [];
    return baseTimes.map((time, index) => {
      const practitioner = practitioners[index % practitioners.length];
      return {
        id: `${selectedDateKey}-${time}`,
        time,
        practitionerId: practitioner.id,
      };
    });
  }, [selectedDateKey]);

  const selectedSlot = useMemo(() => {
    if (!selectedSlotId) return null;
    return slots.find((slot) => slot.id === selectedSlotId) ?? null;
  }, [slots, selectedSlotId]);

  const selectedPractitioner = useMemo(() => {
    if (!selectedSlot) return null;
    return practitioners.find((person) => person.id === selectedSlot.practitionerId) ?? null;
  }, [selectedSlot]);

  const canProceed =
    (step === 1 && Boolean(categoryId)) ||
    (step === 2 && Boolean(serviceId)) ||
    (step === 3 && Boolean(selectedSlotId)) ||
    step === 4;

  const handleCategorySelect = (id: string) => {
    setCategoryId(id);
    setServiceId(null);
    setSelectedSlotId(null);
    setSelectedDateKey('');
    setStep(2);
  };

  const handleServiceSelect = (id: string) => {
    setServiceId(id);
    if (dates[0]) {
      setSelectedDateKey(dates[0].key);
    }
    setSelectedSlotId(null);
    setStep(3);
  };

  const handleNext = () => {
    if (step === 1 && categoryId) setStep(2);
    if (step === 2 && serviceId) setStep(3);
    if (step === 3 && selectedSlotId) setStep(4);
  };

  const handleBack = () => {
    setStep((prev) => Math.max(1, prev - 1));
  };

  return (
    <section id="booking-flow" className="w-full scroll-mt-24 bg-slate-50 py-16">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4">
        <header className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                {t('features.websiteBuilder.bookingFlow.eyebrow')}
              </p>
              <h2 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
                {t('features.websiteBuilder.bookingFlow.title')}
              </h2>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600">
              <UserRound className="h-4 w-4 text-slate-400" />
              {t('features.websiteBuilder.bookingFlow.viewTag')}
            </div>
          </div>
          <div className="flex flex-wrap gap-3 text-sm font-medium text-slate-500">
            {stepLabels.map((label, index) => {
              const current = index + 1 === step;
              const done = index + 1 < step;
              return (
                <div
                  key={label}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1 ${
                    current
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : done
                        ? 'border-slate-200 bg-white text-slate-700'
                        : 'border-transparent bg-slate-100 text-slate-400'
                  }`}
                >
                  <span className="text-xs font-semibold">{index + 1}</span>
                  {label}
                </div>
              );
            })}
          </div>
        </header>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.35 }}
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/40 sm:p-8"
          >
            {step === 1 ? (
              <div className="space-y-6">
                <div>
                  <h3 className="text-2xl font-semibold text-slate-900">
                    {t('features.websiteBuilder.bookingFlow.step1.title')}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">
                    {t('features.websiteBuilder.bookingFlow.step1.description')}
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {categories.map((category) => {
                    const Icon = category.icon;
                    const selected = categoryId === category.id;
                    return (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => handleCategorySelect(category.id)}
                        className={`group flex flex-col items-center justify-center gap-3 rounded-2xl border bg-white p-5 text-left transition-all ${
                          selected
                            ? 'border-blue-600 shadow-lg shadow-blue-100'
                            : 'border-slate-200 hover:-translate-y-1 hover:shadow-lg'
                        }`}
                      >
                        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition-colors group-hover:bg-blue-50 group-hover:text-blue-700">
                          <Icon className="h-6 w-6" />
                        </span>
                        <div className="text-center">
                          <p className="text-lg font-semibold text-slate-900">{category.title}</p>
                          <p className="mt-1 text-sm text-slate-500">{category.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-6">
                <div>
                  <h3 className="text-2xl font-semibold text-slate-900">
                    {t('features.websiteBuilder.bookingFlow.step2.title')}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">
                    {t('features.websiteBuilder.bookingFlow.step2.description')}
                  </p>
                </div>
                <div className="space-y-3">
                  {(categoryId ? servicesByCategory[categoryId] : []).map((service) => (
                    <div
                      key={service.id}
                      className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="text-lg font-semibold text-slate-900">{service.name}</p>
                        <p className="text-sm text-slate-500">
                          {service.duration} {minutesLabel} · {service.price} {currencyLabel}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleServiceSelect(service.id)}
                        className="rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                      >
                        {t('features.websiteBuilder.bookingFlow.actions.select')}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="space-y-6">
                <div>
                  <h3 className="text-2xl font-semibold text-slate-900">
                    {t('features.websiteBuilder.bookingFlow.step3.title')}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">
                    {t('features.websiteBuilder.bookingFlow.step3.description')}
                  </p>
                </div>
                <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between text-sm font-semibold text-slate-700">
                      <span>{calendarLabel}</span>
                      <span className="text-xs text-slate-400">
                        {t('features.websiteBuilder.bookingFlow.calendar.selectDate')}
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-7 gap-2 text-center text-xs text-slate-500">
                      {weekdayLabels.map((day) => (
                        <span key={day} className="uppercase tracking-wider">
                          {day}
                        </span>
                      ))}
                    </div>
                    <div className="mt-3 grid grid-cols-7 gap-2">
                      {dates.map((date) => {
                        const selected = date.key === selectedDateKey;
                        return (
                          <button
                            key={date.key}
                            type="button"
                            onClick={() => setSelectedDateKey(date.key)}
                            className={`flex flex-col items-center justify-center rounded-xl border px-2 py-3 text-sm font-semibold transition ${
                              selected
                                ? 'border-blue-600 bg-blue-50 text-blue-700'
                                : 'border-transparent bg-white text-slate-700 hover:border-slate-200'
                            }`}
                          >
                            <span className="text-xs uppercase text-slate-400">{date.label}</span>
                            <span>{date.day}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="space-y-3">
                    {slots.map((slot) => {
                      const practitioner = practitioners.find(
                        (person) => person.id === slot.practitionerId
                      );
                      const selected = slot.id === selectedSlotId;
                      return (
                        <button
                          key={slot.id}
                          type="button"
                          onClick={() => setSelectedSlotId(slot.id)}
                          className={`flex w-full items-center justify-between gap-4 rounded-2xl border px-4 py-3 text-left transition ${
                            selected
                              ? 'border-blue-600 bg-blue-50'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <img
                              src={practitioner?.avatar}
                              alt={practitioner?.name}
                              className="h-12 w-12 rounded-full object-cover"
                            />
                            <div>
                              <p className="text-sm font-semibold text-slate-900">
                                {slot.time}
                              </p>
                              <p className="text-xs text-slate-500">
                                {practitioner?.name} · {practitioner?.title}
                              </p>
                            </div>
                          </div>
                          <span className="text-xs font-semibold text-blue-600">
                            {t('features.websiteBuilder.bookingFlow.actions.select')}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}

            {step === 4 ? (
              <div className="space-y-6">
                <div>
                  <h3 className="text-2xl font-semibold text-slate-900">
                    {t('features.websiteBuilder.bookingFlow.step4.title')}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">
                    {t('features.websiteBuilder.bookingFlow.step4.description')}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  <p className="font-semibold text-slate-900">
                    {t('features.websiteBuilder.bookingFlow.step4.summaryTitle')}
                  </p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <div>
                      <span className="text-slate-400">
                        {t('features.websiteBuilder.bookingFlow.step4.summaryService')}
                      </span>
                      <p>{selectedService?.name || placeholder}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">
                        {t('features.websiteBuilder.bookingFlow.step4.summaryTime')}
                      </span>
                      <p>
                        {selectedSlot?.time || placeholder} · {selectedPractitioner?.name || placeholder}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setAuthMode('sms')}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      authMode === 'sms'
                        ? 'bg-blue-600 text-white'
                        : 'border border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    {t('features.websiteBuilder.bookingFlow.step4.sms')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthMode('guest')}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      authMode === 'guest'
                        ? 'bg-blue-600 text-white'
                        : 'border border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    {t('features.websiteBuilder.bookingFlow.step4.guest')}
                  </button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-semibold text-slate-700">
                      {t('features.websiteBuilder.bookingFlow.step4.nameLabel')}
                    </label>
                    <input
                      value={contactName}
                      onChange={(event) => setContactName(event.target.value)}
                      placeholder={t('features.websiteBuilder.bookingFlow.step4.namePlaceholder')}
                      className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700">
                      {t('features.websiteBuilder.bookingFlow.step4.emailLabel')}
                    </label>
                    <input
                      value={contactEmail}
                      onChange={(event) => setContactEmail(event.target.value)}
                      placeholder={t('features.websiteBuilder.bookingFlow.step4.emailPlaceholder')}
                      className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-sm font-semibold text-slate-700">
                      {t('features.websiteBuilder.bookingFlow.step4.addressLabel')}
                    </label>
                    <input
                      value={contactAddress}
                      onChange={(event) => setContactAddress(event.target.value)}
                      placeholder={t('features.websiteBuilder.bookingFlow.step4.addressPlaceholder')}
                      className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700">
                      {t('features.websiteBuilder.bookingFlow.step4.phoneLabel')}
                    </label>
                    <input
                      value={contactPhone}
                      onChange={(event) => setContactPhone(event.target.value)}
                      placeholder={t('features.websiteBuilder.bookingFlow.step4.phonePlaceholder')}
                      className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500"
                    />
                  </div>
                </div>

                {authMode === 'sms' ? (
                  <div className="grid gap-3 sm:max-w-md">
                    <button
                      type="button"
                      className="w-full rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                    >
                      {t('features.websiteBuilder.bookingFlow.step4.smsCta')}
                    </button>
                    <p className="text-xs text-slate-500">
                      {t('features.websiteBuilder.bookingFlow.step4.smsHint', {
                        phone: contactPhone || t('features.websiteBuilder.bookingFlow.step4.phoneFallback'),
                      })}
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:max-w-md">
                    <button
                      type="button"
                      className="w-full rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                    >
                      {t('features.websiteBuilder.bookingFlow.step4.confirmCta')}
                    </button>
                    <p className="text-xs text-slate-500">
                      {t('features.websiteBuilder.bookingFlow.step4.confirmHint', {
                        email: contactEmail || t('features.websiteBuilder.bookingFlow.step4.emailFallback'),
                      })}
                    </p>
                  </div>
                )}
              </div>
            ) : null}
          </motion.div>
        </AnimatePresence>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleBack}
            disabled={step === 1}
            className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('features.websiteBuilder.bookingFlow.actions.back')}
          </button>
          {step < 4 ? (
            <button
              type="button"
              onClick={handleNext}
              disabled={!canProceed}
              className="rounded-full bg-slate-900 px-6 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('features.websiteBuilder.bookingFlow.actions.next')}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
};

export default BookingFlow;
