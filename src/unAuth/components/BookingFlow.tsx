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

const categories: Category[] = [
  {
    id: 'physio',
    title: 'Fysioterapi',
    description: 'Smerter, bevægelighed og genoptræning.',
    icon: Activity,
  },
  {
    id: 'chiro',
    title: 'Kiropraktik',
    description: 'Ryg, nakke og holdningsjusteringer.',
    icon: Stethoscope,
  },
  {
    id: 'osteopathy',
    title: 'Osteopati',
    description: 'Helhedsorienteret behandling.',
    icon: HandHeart,
  },
  {
    id: 'sports',
    title: 'Sportsbehandling',
    description: 'Skader og performance.',
    icon: HeartPulse,
  },
  {
    id: 'mind',
    title: 'Psykologisk støtte',
    description: 'Stress, angst og mental ro.',
    icon: Brain,
  },
  {
    id: 'recovery',
    title: 'Recovery',
    description: 'Pleje og restitution.',
    icon: Sparkles,
  },
];

const servicesByCategory: Record<string, Service[]> = {
  physio: [
    { id: 'physio-1', name: 'Førstegangskonsultation', duration: 45, price: 520 },
    { id: 'physio-2', name: 'Opfølgende behandling', duration: 30, price: 360 },
    { id: 'physio-3', name: 'Udvidet behandling', duration: 60, price: 690 },
  ],
  chiro: [
    { id: 'chiro-1', name: 'Ryganalyse', duration: 40, price: 580 },
    { id: 'chiro-2', name: 'Justering', duration: 25, price: 420 },
    { id: 'chiro-3', name: 'Kombi-session', duration: 55, price: 720 },
  ],
  osteopathy: [
    { id: 'osteo-1', name: 'Helkropsbehandling', duration: 50, price: 610 },
    { id: 'osteo-2', name: 'Fascia & mobilitet', duration: 35, price: 440 },
    { id: 'osteo-3', name: 'Dybdeterapi', duration: 60, price: 740 },
  ],
  sports: [
    { id: 'sport-1', name: 'Skadescreening', duration: 30, price: 390 },
    { id: 'sport-2', name: 'Performance check', duration: 50, price: 610 },
    { id: 'sport-3', name: 'Return to play', duration: 60, price: 760 },
  ],
  mind: [
    { id: 'mind-1', name: 'Samtaleforløb', duration: 50, price: 720 },
    { id: 'mind-2', name: 'Akut stress-session', duration: 30, price: 520 },
    { id: 'mind-3', name: 'Forløbsplan', duration: 60, price: 840 },
  ],
  recovery: [
    { id: 'recovery-1', name: 'Kropsscanning', duration: 35, price: 360 },
    { id: 'recovery-2', name: 'Genopladning', duration: 45, price: 520 },
    { id: 'recovery-3', name: 'Restitution plus', duration: 60, price: 690 },
  ],
};

const practitioners: Practitioner[] = [
  {
    id: 'practitioner-1',
    name: 'Anna Madsen',
    title: 'Senior behandler',
    avatar: '/hero-2/physio-hero-01.jpg',
  },
  {
    id: 'practitioner-2',
    name: 'Jonas Kragh',
    title: 'Fysioterapeut',
    avatar: '/hero-2/physio-hero-02.jpg',
  },
  {
    id: 'practitioner-3',
    name: 'Maria Lyng',
    title: 'Osteopat',
    avatar: '/hero-2/physio-hero-03.jpg',
  },
];

const baseTimes = ['08:30', '09:15', '10:00', '11:30', '13:00', '14:15', '15:00', '16:30'];

const BookingFlow: React.FC = () => {
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

  const dates = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 14 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() + index);
      return {
        key: date.toISOString().slice(0, 10),
        label: date.toLocaleDateString('da-DK', { weekday: 'short' }),
        day: date.getDate(),
        month: date.toLocaleDateString('da-DK', { month: 'long' }),
        year: date.getFullYear(),
      };
    });
  }, []);

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

  const stepLabels = ['Behandling', 'Ydelse', 'Tid & behandler', 'Bekræft'];
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
                Booking-flow
              </p>
              <h2 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
                Book din tid hurtigt og trygt
              </h2>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600">
              <UserRound className="h-4 w-4 text-slate-400" />
              Patient-visning
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
                    Trin 1 · Vælg behandlingstype
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">
                    Vælg det område, der passer bedst til dine behov.
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
                    Trin 2 · Vælg specifik ydelse
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">
                    Se varighed og pris, og vælg den ydelse der passer bedst.
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
                          {service.duration} min · {service.price} kr
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleServiceSelect(service.id)}
                        className="rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                      >
                        Vælg
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
                    Trin 3 · Vælg tid og behandler
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">
                    Vælg en dato og se ledige tider med din behandler.
                  </p>
                </div>
                <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between text-sm font-semibold text-slate-700">
                      <span>{calendarLabel}</span>
                      <span className="text-xs text-slate-400">Vælg dato</span>
                    </div>
                    <div className="mt-4 grid grid-cols-7 gap-2 text-center text-xs text-slate-500">
                      {['ma', 'ti', 'on', 'to', 'fr', 'lø', 'sø'].map((day) => (
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
                          <span className="text-xs font-semibold text-blue-600">Vælg</span>
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
                    Trin 4 · Bekræftelse
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">
                    Vælg hvordan du vil bekræfte din tid. Det tager kun et øjeblik.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  <p className="font-semibold text-slate-900">Dit valg</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <div>
                      <span className="text-slate-400">Behandling</span>
                      <p>{selectedService?.name || '—'}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Tid</span>
                      <p>
                        {selectedSlot?.time || '—'} · {selectedPractitioner?.name || '—'}
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
                    SMS-kode
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
                    Fortsæt som gæst
                  </button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-semibold text-slate-700">Navn</label>
                    <input
                      value={contactName}
                      onChange={(event) => setContactName(event.target.value)}
                      placeholder="Dit navn"
                      className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700">Email</label>
                    <input
                      value={contactEmail}
                      onChange={(event) => setContactEmail(event.target.value)}
                      placeholder="din@email.dk"
                      className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-sm font-semibold text-slate-700">Adresse</label>
                    <input
                      value={contactAddress}
                      onChange={(event) => setContactAddress(event.target.value)}
                      placeholder="Gade, postnummer, by"
                      className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700">
                      Telefonnummer
                    </label>
                    <input
                      value={contactPhone}
                      onChange={(event) => setContactPhone(event.target.value)}
                      placeholder="+45 12 34 56 78"
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
                      Send SMS-kode
                    </button>
                    <p className="text-xs text-slate-500">
                      Vi sender en kort kode til {contactPhone || 'dit nummer'}.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:max-w-md">
                    <button
                      type="button"
                      className="w-full rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                    >
                      Bekræft booking
                    </button>
                    <p className="text-xs text-slate-500">
                      Vi sender en bekræftelse til {contactEmail || 'din email'}.
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
            Tilbage
          </button>
          {step < 4 ? (
            <button
              type="button"
              onClick={handleNext}
              disabled={!canProceed}
              className="rounded-full bg-slate-900 px-6 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Næste trin
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
};

export default BookingFlow;
