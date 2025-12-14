import React, { useMemo, useState } from 'react';
import { BookingSidebarLayout } from '../../../components/ui/BookingSidebarLayout';
import { useAuth } from '../../../AuthContext';
import useAppointments from '../../../hooks/useAppointments';
import { useUserClients } from '../Klienter/hooks/useUserClients';
import { BarChart3, CalendarDays, Users, Activity, AlertTriangle } from 'lucide-react';

function StatistikPage() {
  const { user } = useAuth();
  const { appointments = [], loading, error } = useAppointments(user?.uid || null);
  const { clients = [] } = useUserClients();
  const [period, setPeriod] = useState('week'); // 'today' | 'week' | 'month' | 'year' | 'all'

  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

  const getWeekBounds = (now) => {
    const day = now.getDay(); // 0 = søndag
    const diffToMonday = (day + 6) % 7; // 0 for mandag
    const monday = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday));
    const nextMonday = new Date(monday);
    nextMonday.setDate(monday.getDate() + 7);
    return { start: monday, end: nextMonday };
  };

  const getMonthBounds = (now) => {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { start: first, end: next };
  };

  const getYearBounds = (now) => {
    const first = new Date(now.getFullYear(), 0, 1);
    const next = new Date(now.getFullYear() + 1, 0, 1);
    return { start: first, end: next };
  };

  const parseDateTime = (isoString, dateStr, timeStr) => {
    if (isoString) {
      const parsed = new Date(isoString);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }

    if (dateStr && timeStr) {
      const [day, month, year] = dateStr.split('-').map((part) => parseInt(part, 10));
      const [hours, minutes] = timeStr.split(':').map((part) => parseInt(part, 10));
      if ([day, month, year, hours, minutes].every((v) => !Number.isNaN(v))) {
        return new Date(year, month - 1, day, hours, minutes);
      }
    }

    return null;
  };

  const parseAppointmentDateTimes = (appointment) => {
    const startDate = parseDateTime(
      appointment.start || appointment.startIso,
      appointment.startDate,
      appointment.startTime
    );
    const endDate = parseDateTime(
      appointment.end || appointment.endIso,
      appointment.endDate || appointment.startDate,
      appointment.endTime || appointment.startTime
    );
    return { startDate, endDate: endDate || startDate };
  };

  const getPeriodBounds = (periodKey) => {
    const now = new Date();
    if (periodKey === 'today') {
      const start = startOfDay(now);
      const end = new Date(start);
      end.setDate(start.getDate() + 1);
      return { start, end };
    }
    if (periodKey === 'week') return getWeekBounds(now);
    if (periodKey === 'month') return getMonthBounds(now);
    if (periodKey === 'year') return getYearBounds(now);
    return null; // 'all'
  };

  const {
    inPeriod,
    totalRevenue,
    totalAppointments,
    uniqueClientsInPeriod,
    cancelRate,
    avgHoursPerActiveDay,
    topServices,
  } = useMemo(() => {
    if (!appointments || appointments.length === 0) {
      return {
        inPeriod: [],
        totalRevenue: 0,
        totalAppointments: 0,
        uniqueClientsInPeriod: 0,
        cancelRate: 0,
        avgHoursPerActiveDay: 0,
        topServices: [],
      };
    }

    const bounds = getPeriodBounds(period);
    let filtered = appointments;

    if (bounds) {
      const { start, end } = bounds;
      filtered = appointments.filter((appt) => {
        const { startDate } = parseAppointmentDateTimes(appt);
        if (!startDate) return false;
        return startDate >= start && startDate < end;
      });
    }

    const totalRevenueCalc = filtered.reduce((sum, appt) => {
      const price =
        typeof appt.servicePriceInclVat === 'number'
          ? appt.servicePriceInclVat
          : typeof appt.servicePrice === 'number'
          ? appt.servicePrice
          : 0;
      return sum + price;
    }, 0);

    const clientIds = new Set();
    const clientNames = new Set();
    filtered.forEach((appt) => {
      if (appt.clientId) clientIds.add(appt.clientId);
      else if (appt.client) clientNames.add(appt.client);
    });
    const uniqueClientsCount = clientIds.size || clientNames.size;

    const cancelled = filtered.filter(
      (appt) => appt.status === 'cancelled' || appt.status === 'no-show' || appt.status === 'aflyst'
    ).length;
    const total = filtered.length || 1;
    const cancelRateCalc = (cancelled / total) * 100;

    const minutesBooked = filtered.reduce((sum, appt) => {
      const { startDate, endDate } = parseAppointmentDateTimes(appt);
      if (!startDate || !endDate) return sum;
      const diffMinutes = (endDate.getTime() - startDate.getTime()) / (1000 * 60);
      return sum + Math.max(diffMinutes, 0);
    }, 0);

    const activeDayKeys = new Set(
      filtered
        .map((appt) => parseAppointmentDateTimes(appt).startDate)
        .filter(Boolean)
        .map((d) => d.toDateString())
    );
    const activeDays = activeDayKeys.size || 1;
    const avgHours = minutesBooked / activeDays / 60;

    const serviceCount = {};
    filtered.forEach((appt) => {
      const key = appt.service || 'Andet';
      serviceCount[key] = (serviceCount[key] || 0) + 1;
    });

    const topServicesArr = Object.entries(serviceCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    return {
      inPeriod: filtered,
      totalRevenue: totalRevenueCalc,
      totalAppointments: filtered.length,
      uniqueClientsInPeriod: uniqueClientsCount,
      cancelRate: cancelRateCalc,
      avgHoursPerActiveDay: avgHours,
      topServices: topServicesArr,
    };
  }, [appointments, period]);

  const totalClients = clients?.length || 0;

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('da-DK', {
      style: 'currency',
      currency: 'DKK',
      maximumFractionDigits: 0,
    }).format(amount);

  const formatPercent = (value) => `${value.toLocaleString('da-DK', { maximumFractionDigits: 1 })}%`;

  const formatHours = (hours) => `${hours.toLocaleString('da-DK', { maximumFractionDigits: 1 })} t`;

  return (
    <BookingSidebarLayout>
      <div className="flex flex-col h-full w-full bg-slate-50">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b bg-white">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-slate-700" />
              <h1 className="text-lg font-semibold text-slate-900">Statistik</h1>
            </div>
            <p className="text-xs text-slate-500">
              Overblik over aftaler og omsætning baseret på dine rigtige booking-data.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            {[
              { key: 'today', label: 'I dag' },
              { key: 'week', label: 'Denne uge' },
              { key: 'month', label: 'Denne måned' },
              { key: 'year', label: 'Dette år' },
              { key: 'all', label: 'Alt' },
            ].map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setPeriod(opt.key)}
                className={
                  'px-3 py-1 rounded-full border text-xs transition ' +
                  (period === opt.key
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100')
                }
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {(!user || error) && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span>
                Kan ikke hente statistik lige nu. Sørg for at du er logget ind, og at der findes aftaler i Firestore.
              </span>
            </div>
          )}

          {loading && <div className="text-xs text-slate-500 mb-4">Indlæser data fra klinikken…</div>}

          {!loading && inPeriod.length === 0 && (
            <div className="text-xs text-slate-500 mb-4">
              Ingen aftaler i den valgte periode. Skift periode eller opret nye aftaler.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            <StatCard
              title="Omsætning"
              subtitle="Valgt periode"
              icon={<CalendarDays className="h-5 w-5" />}
              value={formatCurrency(totalRevenue)}
            />
            <StatCard
              title="Aftaler"
              subtitle="Bookede i perioden"
              icon={<Activity className="h-5 w-5" />}
              value={totalAppointments}
            />
            <StatCard
              title="Unikke klienter"
              subtitle="I perioden"
              icon={<Users className="h-5 w-5" />}
              value={uniqueClientsInPeriod}
              extra={totalClients ? `${totalClients} klienter i alt` : ''}
            />
            <StatCard
              title="Afbud / no-show"
              subtitle="Andel af aftaler"
              icon={<AlertTriangle className="h-5 w-5" />}
              value={formatPercent(cancelRate)}
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-slate-900 mb-1">Gennemsnitlig klinik-belastning</h2>
              <p className="text-xs text-slate-500 mb-4">
                Hvor mange timer du i gennemsnit er booket de dage, hvor du faktisk har aftaler.
              </p>
              <div className="text-2xl font-semibold text-slate-900">{formatHours(avgHoursPerActiveDay)}</div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-slate-900 mb-1">Mest bookede ydelser</h2>
              <p className="text-xs text-slate-500 mb-4">Dine 5 mest anvendte ydelser i den valgte periode.</p>
              {topServices.length === 0 ? (
                <p className="text-xs text-slate-500">Ingen data i perioden.</p>
              ) : (
                <ul className="space-y-2 text-xs">
                  {topServices.map((service) => (
                    <li
                      key={service.name}
                      className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"
                    >
                      <span className="text-slate-700">{service.name}</span>
                      <span className="font-medium text-slate-900">{service.count}×</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </BookingSidebarLayout>
  );
}

function StatCard({ title, subtitle, icon, value, extra }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-slate-500">{title}</p>
          {subtitle && <p className="text-[11px] text-slate-400">{subtitle}</p>}
        </div>
        <div className="h-8 w-8 rounded-full bg-slate-900/5 flex items-center justify-center text-slate-700">
          {icon}
        </div>
      </div>
      <div className="text-2xl font-semibold text-slate-900">{value}</div>
      {extra && <p className="text-[11px] text-slate-500">{extra}</p>}
    </div>
  );
}

export default StatistikPage;

