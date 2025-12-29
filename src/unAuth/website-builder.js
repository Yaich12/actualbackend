import React from 'react';
import { CheckCircle2, MessageCircle, ShieldCheck, Sparkles } from 'lucide-react';
import LandingBuilder from './components/LandingBuilder';
import BookingFlow from './components/BookingFlow';

function WebsiteBuilderPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-white">
      <section className="bg-white text-slate-900">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div className="relative">
            <img
              src="/hero-2/pexels-rdne-7755558.jpg"
              alt="Clinician working on a laptop"
              className="h-[320px] w-full rounded-3xl object-cover shadow-2xl shadow-slate-200/60 sm:h-[420px]"
              loading="lazy"
            />
            <div className="absolute left-6 top-6 rounded-2xl bg-white/90 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-700 shadow-md">
              Appointment booked
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
              Why it matters
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">
              Why you need a Selma+ booking website
            </h2>
            <p className="mt-4 max-w-xl text-base text-slate-600">
              Patients want to book online and move on. A Selma+ website is made for
              healthcare practitioners and connects directly to your booking system, so
              patients can choose the right service and time without calling your clinic.
            </p>
            <ul className="mt-6 list-disc space-y-3 pl-5 text-sm text-slate-600">
              <li>Show full availability or filter by appointment type.</li>
              <li>Add a clear booking button that opens your Selma+ schedule.</li>
              <li>Highlight the right treatment and practitioner on every page.</li>
              <li>Keep booking visible with a banner or call-to-action block.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="bg-slate-900 text-white">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="space-y-6">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
              Selma+ Website + AI
            </p>
            <h2 className="text-3xl font-semibold leading-tight text-white md:text-4xl">
              Your 24/7 Digital Receptionist
            </h2>
            <p className="max-w-2xl text-base leading-relaxed text-slate-200">
              Say hello to new patients anytime. Your new Selma+ website comes powered by an intelligent AI agent
              that answers questions about your services and helps patients book instantly.
            </p>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                {
                  icon: Sparkles,
                  title: 'Auto-generated design',
                  description: 'Beautiful clinic websites ready in minutes.',
                },
                {
                  icon: MessageCircle,
                  title: 'Smart AI Agent',
                  description: 'Answers patient questions about prices, treatments, and availability.',
                },
                {
                  icon: ShieldCheck,
                  title: 'Never miss a lead',
                  description: 'Captures bookings while you sleep or treat patients.',
                },
              ].map((feature) => (
                <div
                  key={feature.title}
                  className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-lg shadow-slate-900/40"
                >
                  <feature.icon className="h-6 w-6 text-blue-300" />
                  <div>
                    <div className="text-sm font-semibold text-white">{feature.title}</div>
                    <p className="text-sm text-slate-300">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            <img
              src="/hero-2/physio-hero-02.jpg"
              alt="Selma+ AI agent overlay"
              className="h-[360px] w-full rounded-[32px] object-cover shadow-2xl shadow-slate-900/60 lg:h-[420px]"
              loading="lazy"
            />
            <div className="absolute bottom-6 right-6 max-w-xs rounded-3xl bg-white/90 p-4 shadow-2xl shadow-slate-900/60">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-slate-900/80 p-1 text-sm font-semibold uppercase tracking-wide text-white">
                  S+
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Live chat</p>
                  <p className="text-sm font-semibold text-slate-900">Selma+ Agent</p>
                </div>
              </div>
              <div className="mt-3 space-y-3 text-sm">
                <div className="rounded-2xl bg-blue-900/90 px-3 py-2 text-slate-50">
                  <p className="text-xs font-semibold text-blue-200">Selma+ Agent</p>
                  <p>Hi! Do you have questions about our treatments?</p>
                </div>
                <div className="rounded-2xl bg-slate-100/80 px-3 py-2 text-slate-900">
                  <p className="text-xs font-semibold text-slate-500">Patient</p>
                  <p>Do you treat sports injuries?</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-50 text-slate-900">
        <div className="mx-auto w-full max-w-6xl px-4 py-14">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
              Built for clinics
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">
              Design the perfect booking website with Selma+
            </h2>
          </div>
          <div className="mt-10 grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="rounded-[36px] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/50">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                <span>Clinic website</span>
                <span>Services</span>
              </div>
              <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
                <img
                  src="/hero-2/physio-hero-02.jpg"
                  alt="Patient consultation"
                  className="h-56 w-full rounded-3xl object-cover"
                  loading="lazy"
                />
                <div>
                  <h3 className="text-2xl font-semibold text-slate-900">Services and booking</h3>
                  <ul className="mt-4 space-y-3 text-sm text-slate-600">
                    <li className="flex items-center justify-between border-b border-slate-200 pb-2">
                      Consultation <span className="text-slate-400">+</span>
                    </li>
                    <li className="flex items-center justify-between border-b border-slate-200 pb-2">
                      Follow-up session <span className="text-slate-400">+</span>
                    </li>
                    <li className="flex items-center justify-between border-b border-slate-200 pb-2">
                      Online check-in <span className="text-slate-400">+</span>
                    </li>
                  </ul>
                  <button className="mt-5 rounded-full bg-slate-900 px-6 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white">
                    Book your appointment
                  </button>
                </div>
              </div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-6">
              <h3 className="text-lg font-semibold text-slate-900">
                One system for your brand and your calendar
              </h3>
              <p className="mt-3 text-sm text-slate-600">
                Customize your Selma+ website to match your clinic, while every booking
                stays connected to your live schedule.
              </p>
              <ul className="mt-5 list-disc space-y-3 pl-5 text-sm text-slate-600">
                <li>Match your colors, typography, and tone of voice.</li>
                <li>Show all appointment types or spotlight one service.</li>
                <li>Keep patients on your site while they book.</li>
                <li>Update services once in Selma+ and stay in sync.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#eef2fb] text-slate-900">
        <div className="mx-auto w-full max-w-6xl px-4 py-14">
          <div className="rounded-[40px] bg-white px-6 py-10 shadow-xl shadow-slate-200/60 lg:px-10">
            <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                  One place to grow
                </p>
                <h2 className="mt-3 text-3xl font-semibold text-slate-900 sm:text-4xl">
                  Grow your online presence and your appointment calendar together
                </h2>
                <p className="mt-4 text-base text-slate-600">
                  Selma+ connects your website, services, and bookings in one flow. Patients get
                  clarity, while you get fewer admin tasks and fewer no-shows.
                </p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                <ul className="list-disc space-y-3 pl-5 text-sm text-slate-600">
                  <li>Let patients book without leaving your website.</li>
                  <li>Surface availability across your team and locations.</li>
                  <li>Collect deposits or payments directly in Selma+.</li>
                  <li>Automate reminders so patients show up prepared.</li>
                </ul>
                <div className="mt-6 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700">
                  Booking stays connected to Selma+ so you always stay in control.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#f7f0ff] text-slate-900">
        <div className="mx-auto w-full max-w-6xl px-4 pb-14 pt-12">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
              Klinik-hjemmeside
            </p>
            <h2 className="mt-3 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              Din professionelle klinik-side. Klar på få minutter.
            </h2>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-700">
              <CheckCircle2 className="h-4 w-4" />
              100% integreret: Bookinger lander direkte i din kalender.
            </div>
            <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
              Glem alt om teknisk besvær. Selma+ genererer automatisk en smuk bookingside baseret på din profil, så du kan fokusere på dine patienter.
            </p>
          </div>
          <div className="mt-10 flex justify-center">
            <img
              src="/hero-2/physio-gallery-01.jpg"
              alt="Website builder preview"
              className="h-[320px] w-full max-w-4xl rounded-[32px] object-cover shadow-2xl shadow-slate-200/60 sm:h-[420px]"
              loading="lazy"
            />
          </div>
        </div>
      </section>

      <BookingFlow />
      <LandingBuilder />
    </div>
  );
}

export default WebsiteBuilderPage;
