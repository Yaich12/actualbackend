import React, { useMemo, useState, useRef, useEffect } from "react";
import "./Overview.css";
import { BookingSidebarLayout } from "../../../components/ui/BookingSidebarLayout";
import { Activity, BarChart3, CalendarDays, Users } from "lucide-react";
import { useAuth } from "../../../AuthContext";
import { useLanguage } from "../../../LanguageContext";
import useAppointments from "../../../hooks/useAppointments";
import useSales from "../../../hooks/useSales";
import { formatServiceDuration } from "../../../utils/serviceLabels";

const parseDateString = (value) => {
  if (!value) return null;
  const parts = value.split("-");
  if (parts.length !== 3) return null;
  const [day, month, year] = parts.map((part) => Number(part));
  if (!day || !month || !year) return null;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
};

const resolveAppointmentDateTime = (appointment) => {
  const fromStartDate = parseDateString(appointment?.startDate);
  if (fromStartDate) {
    if (appointment?.startTime) {
      const [hours, minutes] = appointment.startTime.split(":").map(Number);
      if (!Number.isNaN(hours) && !Number.isNaN(minutes)) {
        fromStartDate.setHours(hours, minutes, 0, 0);
      }
    }
    return fromStartDate;
  }
  const isoValue = appointment?.start || appointment?.startIso || "";
  if (isoValue) {
    const parsed = new Date(isoValue);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
};

const startOfDay = (date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const endOfDay = (date) => {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
};

const addDays = (date, amount) => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
};

const formatDateKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;

const toNiceMax = (value) => {
  if (!value || value <= 0) return 3000;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const scaled = value / magnitude;
  let niceScaled = 1;
  if (scaled <= 1) niceScaled = 1;
  else if (scaled <= 2) niceScaled = 2;
  else if (scaled <= 3) niceScaled = 3;
  else if (scaled <= 4) niceScaled = 4;
  else if (scaled <= 5) niceScaled = 5;
  else if (scaled <= 7.5) niceScaled = 7.5;
  else niceScaled = 10;
  return niceScaled * magnitude;
};

const toNiceCountMax = (value) => {
  if (!value || value <= 0) return 4;
  if (value <= 4) return 4;
  if (value <= 6) return 6;
  if (value <= 8) return 8;
  if (value <= 10) return 10;
  return Math.ceil(value / 5) * 5;
};

const getSaleDate = (sale) => sale.completedAtDate || sale.createdAtDate || null;

const getAppointmentPrice = (appointment) => {
  if (typeof appointment?.servicePriceInclVat === "number") {
    return appointment.servicePriceInclVat;
  }
  if (typeof appointment?.servicePrice === "number") {
    return appointment.servicePrice;
  }
  return 0;
};

const normalizeStatus = (status) => {
  if (!status) return "booked";
  const normalized = String(status).toLowerCase();
  if (
    normalized.includes("aflyst") ||
    normalized.includes("cancel") ||
    normalized.includes("no-show") ||
    normalized.includes("noshow") ||
    normalized.includes("no_show")
  ) {
    return "cancelled";
  }
  if (normalized.includes("confirm") || normalized.includes("bekræft")) return "confirmed";
  if (normalized.includes("arriv")) return "arrived";
  if (normalized.includes("start")) return "started";
  if (normalized.includes("complete") || normalized.includes("gennemført"))
    return "completed";
  if (normalized.includes("pending") || normalized.includes("afvent")) return "pending";
  if (normalized.includes("book")) return "booked";
  return "booked";
};

const ChartSvg = ({ width, height, children }) => (
  <svg viewBox={`0 0 ${width} ${height}`} className="overview-chart-svg">
    {children}
  </svg>
);

function Overview() {
  const { user } = useAuth();
  const { t, locale } = useLanguage();
  const {
    appointments,
    loading: appointmentsLoading,
    error: appointmentsError,
  } = useAppointments(user?.uid || null);
  const {
    sales,
    loading: salesLoading,
    error: salesError,
  } = useSales(user?.uid || null, { status: "completed" });

  // State for period selection for both cards
  const [salesPeriod, setSalesPeriod] = useState("7"); // "7" or "30"
  const [appointmentsPeriod, setAppointmentsPeriod] = useState("7"); // "7" or "30"
  const [showSalesDropdown, setShowSalesDropdown] = useState(false);
  const [showAppointmentsDropdown, setShowAppointmentsDropdown] = useState(false);
  
  const salesDropdownRef = useRef(null);
  const appointmentsDropdownRef = useRef(null);
  const formatCurrency = (value) =>
    new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value || 0);
  const currencySuffix = t("booking.overview.currencySuffix", "kr.");
  const weekdayShortFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: "short" }),
    [locale]
  );
  const weekdayLongFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: "long" }),
    [locale]
  );
  const monthShortFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: "short" }),
    [locale]
  );
  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    [locale]
  );
  const formatDayMonth = (date) => {
    const day = String(date.getDate()).padStart(2, "0");
    const month = monthShortFormatter.format(date);
    return { day, month };
  };
  const formatDateTimeLabel = (date) => dateTimeFormatter.format(date);
  const statusLabels = useMemo(
    () => ({
      booked: t("booking.overview.status.booked", "Booket"),
      confirmed: t("booking.overview.status.confirmed", "Bekræftet"),
      arrived: t("booking.overview.status.arrived", "Ankommet"),
      started: t("booking.overview.status.started", "Begyndt"),
      completed: t("booking.overview.status.completed", "Gennemført"),
      cancelled: t("booking.overview.status.cancelled", "Aflyst"),
      pending: t("booking.overview.status.pending", "Afventer"),
      noshow: t("booking.overview.status.noshow", "Udeblivelse"),
    }),
    [t]
  );
  const getAppointmentStatusLabel = (status) => {
    const normalized = normalizeStatus(status);
    return statusLabels[normalized] || statusLabels.booked;
  };
  const statusClassName = (status) => {
    const normalized = normalizeStatus(status);
    if (normalized === "completed") return "overview-status overview-status--complete";
    if (normalized === "booked" || normalized === "confirmed")
      return "overview-status overview-status--booked";
    return "overview-status";
  };
  const statusGroup = (status) => {
    const normalized = normalizeStatus(status);
    if (normalized === "cancelled") return "cancelled";
    return "confirmed";
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (salesDropdownRef.current && !salesDropdownRef.current.contains(event.target)) {
        setShowSalesDropdown(false);
      }
      if (appointmentsDropdownRef.current && !appointmentsDropdownRef.current.contains(event.target)) {
        setShowAppointmentsDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const today = useMemo(() => new Date(), []);
  const todayStart = startOfDay(today);
  const todayEnd = endOfDay(today);
  const tomorrowStart = startOfDay(addDays(todayStart, 1));
  
  // Calculate date ranges based on selected periods
  const salesDays = parseInt(salesPeriod, 10);
  const appointmentsDays = parseInt(appointmentsPeriod, 10);
  
  const lastSalesStart = startOfDay(addDays(todayStart, -(salesDays - 1)));
  const nextAppointmentsEnd = endOfDay(addDays(todayStart, appointmentsDays));
  
  const lastSalesDates = useMemo(
    () => Array.from({ length: salesDays }, (_, index) => addDays(lastSalesStart, index)),
    [lastSalesStart, salesDays]
  );
  const nextAppointmentsDates = useMemo(
    () => Array.from({ length: appointmentsDays }, (_, index) => addDays(tomorrowStart, index)),
    [tomorrowStart, appointmentsDays]
  );

  const appointmentEntries = useMemo(() => {
    return appointments
      .map((appointment) => {
        const date = resolveAppointmentDateTime(appointment);
        if (!date) return null;
        return { appointment, date };
      })
      .filter(Boolean);
  }, [appointments]);

  const appointmentsLastSales = useMemo(() => {
    return appointmentEntries.filter(({ date }) => date >= lastSalesStart && date <= todayEnd);
  }, [appointmentEntries, lastSalesStart, todayEnd]);

  const appointmentsToday = useMemo(() => {
    return appointmentEntries.filter(({ date }) => date >= todayStart && date <= todayEnd);
  }, [appointmentEntries, todayStart, todayEnd]);

  const appointmentsUpcoming = useMemo(() => {
    return appointmentEntries
      .filter(({ date }) => date >= tomorrowStart && date <= nextAppointmentsEnd)
      .sort((a, b) => a.date - b.date);
  }, [appointmentEntries, nextAppointmentsEnd, tomorrowStart]);

  const appointmentsPast = useMemo(() => {
    return appointmentEntries
      .filter(({ date }) => date < todayStart)
      .sort((a, b) => b.date - a.date);
  }, [appointmentEntries, todayStart]);

  const salesLastPeriod = useMemo(() => {
    return sales.filter((sale) => {
      const date = getSaleDate(sale);
      if (!date) return false;
      return date >= lastSalesStart && date <= todayEnd;
    });
  }, [sales, lastSalesStart, todayEnd]);

  const salesToday = useMemo(() => {
    return sales.filter((sale) => {
      const date = getSaleDate(sale);
      if (!date) return false;
      return date >= todayStart && date <= todayEnd;
    });
  }, [sales, todayStart, todayEnd]);

  const salesTotalsByDate = useMemo(() => {
    const map = new Map();
    salesLastPeriod.forEach((sale) => {
      const date = getSaleDate(sale);
      if (!date) return;
      const key = formatDateKey(date);
      const current = map.get(key) || 0;
      map.set(key, current + (sale.totals?.total ?? 0));
    });
    return map;
  }, [salesLastPeriod]);

  const appointmentValueByDate = useMemo(() => {
    const map = new Map();
    appointmentsLastSales.forEach(({ appointment, date }) => {
      const key = formatDateKey(date);
      const current = map.get(key) || 0;
      map.set(key, current + getAppointmentPrice(appointment));
    });
    return map;
  }, [appointmentsLastSales]);

  const salesSeries = useMemo(
    () => lastSalesDates.map((date) => salesTotalsByDate.get(formatDateKey(date)) || 0),
    [lastSalesDates, salesTotalsByDate]
  );

  const appointmentSeries = useMemo(
    () => lastSalesDates.map((date) => appointmentValueByDate.get(formatDateKey(date)) || 0),
    [lastSalesDates, appointmentValueByDate]
  );

  const lineChartConfig = useMemo(() => {
    const width = 420;
    const height = 160;
    const padding = { top: 8, bottom: 18, left: 6, right: 6 };
    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;
    const maxValue = toNiceMax(Math.max(...salesSeries, ...appointmentSeries, 0));
    const safeMax = maxValue || 1;
    const stepX = salesSeries.length > 1 ? innerWidth / (salesSeries.length - 1) : 0;

    const buildPoints = (series) =>
      series.map((value, index) => {
        const ratio = safeMax === 0 ? 0 : value / safeMax;
        return {
          x: padding.left + index * stepX,
          y: padding.top + (1 - ratio) * innerHeight,
        };
      });

    const buildPath = (points) =>
      points
        .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
        .join(" ");

    const ticks = Array.from({ length: 5 }, (_, index) => {
      const value = maxValue - (maxValue / 4) * index;
      return value < 0 ? 0 : Math.round(value);
    });

    const salesPoints = buildPoints(salesSeries);
    const appointmentPoints = buildPoints(appointmentSeries);

    return {
      width,
      height,
      padding,
      innerWidth,
      innerHeight,
      stepX,
      ticks,
      salesPoints,
      appointmentPoints,
      salesPath: buildPath(salesPoints),
      appointmentPath: buildPath(appointmentPoints),
    };
  }, [salesSeries, appointmentSeries]);

  const lineChartLabelEntries = useMemo(() => {
    return lastSalesDates
      .map((date, index) => ({ date, index }))
      .filter(({ index }) => salesPeriod === "7" || index % 3 === 0)
      .map(({ date, index }) => {
        const weekday = weekdayShortFormatter.format(date);
        return {
          label: `${weekday} ${date.getDate()}`,
          index,
        };
      });
  }, [lastSalesDates, salesPeriod, weekdayShortFormatter]);

  const upcomingStatusByDate = useMemo(() => {
    const map = new Map();
    nextAppointmentsDates.forEach((date) => {
      map.set(formatDateKey(date), { confirmed: 0, cancelled: 0 });
    });
    appointmentsUpcoming.forEach(({ appointment, date }) => {
      const key = formatDateKey(date);
      const entry = map.get(key);
      if (!entry) return;
      const group = statusGroup(appointment.status);
      if (group === "confirmed") entry.confirmed += 1;
      if (group === "cancelled") entry.cancelled += 1;
    });
    return map;
  }, [appointmentsUpcoming, nextAppointmentsDates]);

  const confirmedSeries = useMemo(
    () => nextAppointmentsDates.map((date) => upcomingStatusByDate.get(formatDateKey(date))?.confirmed || 0),
    [nextAppointmentsDates, upcomingStatusByDate]
  );

  const cancelledSeries = useMemo(
    () => nextAppointmentsDates.map((date) => upcomingStatusByDate.get(formatDateKey(date))?.cancelled || 0),
    [nextAppointmentsDates, upcomingStatusByDate]
  );

  const barChartConfig = useMemo(() => {
    const width = 420;
    const height = 160;
    const padding = { top: 8, bottom: 18, left: 6, right: 6 };
    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;
    const maxValue = toNiceCountMax(Math.max(...confirmedSeries, ...cancelledSeries, 0));
    const safeMax = maxValue || 1;
    
    // For 30 days, we show labels for every 3rd day, but bars for all days
    const visibleLabelsCount = appointmentsPeriod === "7" 
      ? confirmedSeries.length 
      : Math.ceil(confirmedSeries.length / 3);
    const totalDays = confirmedSeries.length;
    
    // Calculate group width based on visible labels (for positioning)
    const groupWidth =
      visibleLabelsCount > 0 ? innerWidth / visibleLabelsCount : innerWidth;
    
    // For 30 days, each group represents 3 days, so we need to adjust
    const actualGroupWidth = appointmentsPeriod === "7" 
      ? groupWidth 
      : innerWidth / totalDays;
    
    const barGap = appointmentsPeriod === "7" ? 6 : 4;
    const baseBarWidth = appointmentsPeriod === "7" ? 12 : 6;
    const barWidth = Math.max(4, Math.min(baseBarWidth, (actualGroupWidth - barGap) / 2));
    const groupOffset = (actualGroupWidth - (barWidth * 2 + barGap)) / 2;

    const ticks = Array.from({ length: 5 }, (_, index) => {
      const value = maxValue - (maxValue / 4) * index;
      return value < 0 ? 0 : Math.round(value);
    });

    return {
      width,
      height,
      padding,
      innerWidth,
      innerHeight,
      maxValue,
      safeMax,
      groupWidth: actualGroupWidth, // Use actual group width for bar positioning
      visibleGroupWidth: groupWidth, // Use visible group width for label positioning
      barWidth,
      barGap,
      groupOffset,
      ticks,
      totalDays,
      visibleLabelsCount,
    };
  }, [confirmedSeries, cancelledSeries, appointmentsPeriod]);

  const barChartLabelEntries = useMemo(() => {
    return nextAppointmentsDates
      .map((date, index) => ({ date, index }))
      .filter(({ index }) => appointmentsPeriod === "7" || index % 3 === 0)
      .map(({ date, index }) => {
        const weekday =
          appointmentsPeriod === "7"
            ? weekdayShortFormatter.format(date)
            : weekdayLongFormatter.format(date);
        return {
          label: `${weekday} ${date.getDate()}`,
          index,
        };
      });
  }, [
    nextAppointmentsDates,
    appointmentsPeriod,
    weekdayLongFormatter,
    weekdayShortFormatter,
  ]);

  const salesSummaryTotal = useMemo(() => {
    return salesLastPeriod.reduce((sum, sale) => sum + (sale.totals?.total ?? 0), 0);
  }, [salesLastPeriod]);

  const appointmentValueLastPeriod = useMemo(() => {
    return appointmentsLastSales.reduce(
      (sum, entry) => sum + getAppointmentPrice(entry.appointment),
      0
    );
  }, [appointmentsLastSales]);

  const salesTodayTotal = useMemo(() => {
    return salesToday.reduce((sum, sale) => sum + (sale.totals?.total ?? 0), 0);
  }, [salesToday]);

  const todayAppointments = [...appointmentsToday].sort((a, b) => a.date - b.date).slice(0, 4);
  const pastAppointments = appointmentsPast.slice(0, 5);

  const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const previousMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const previousMonthEnd = endOfDay(new Date(today.getFullYear(), today.getMonth(), 0));

  const topServices = useMemo(() => {
    const map = new Map();
    appointmentEntries.forEach(({ appointment, date }) => {
      const serviceName = appointment.service || appointment.title || "Ukendt";
      if (!map.has(serviceName)) {
        map.set(serviceName, { name: serviceName, month: 0, lastMonth: 0 });
      }
      const entry = map.get(serviceName);
      if (date >= currentMonthStart && date < nextMonthStart) {
        entry.month += 1;
      } else if (date >= previousMonthStart && date <= previousMonthEnd) {
        entry.lastMonth += 1;
      }
    });
    return Array.from(map.values())
      .sort((a, b) => b.month - a.month)
      .slice(0, 5);
  }, [appointmentEntries, currentMonthStart, nextMonthStart, previousMonthEnd, previousMonthStart]);

  const topStaff = useMemo(() => {
    const map = new Map();
    sales.forEach((sale) => {
      const date = getSaleDate(sale);
      if (!date) return;
      const name = sale.employeeName || t("booking.overview.sharedAccount", "fælles konto");
      if (!map.has(name)) {
        map.set(name, { name, month: 0, lastMonth: 0 });
      }
      const entry = map.get(name);
      const total = sale.totals?.total ?? 0;
      if (date >= currentMonthStart && date < nextMonthStart) {
        entry.month += total;
      } else if (date >= previousMonthStart && date <= previousMonthEnd) {
        entry.lastMonth += total;
      }
    });
    return Array.from(map.values())
      .sort((a, b) => b.month - a.month)
      .slice(0, 5)
      .map((entry) => ({
        ...entry,
        monthLabel: `${formatCurrency(entry.month)} ${currencySuffix}`,
        lastMonthLabel: `${formatCurrency(entry.lastMonth)} ${currencySuffix}`,
      }));
  }, [
    sales,
    currentMonthStart,
    nextMonthStart,
    previousMonthEnd,
    previousMonthStart,
    t,
  ]);

  const newClientsToday = useMemo(() => {
    const clients = new Set();
    appointmentsToday.forEach(({ appointment }) => {
      const key = appointment.clientId || appointment.clientEmail || appointment.client || null;
      if (key) clients.add(String(key));
    });
    return clients.size;
  }, [appointmentsToday]);

  const salesSummaryTotalLabel =
    salesLoading || salesError
      ? "—"
      : `${formatCurrency(salesSummaryTotal)} ${currencySuffix}`;
  const appointmentsLastPeriodLabel =
    appointmentsLoading || appointmentsError ? "—" : String(appointmentsLastSales.length);
  const appointmentValueLabel =
    appointmentsLoading || appointmentsError
      ? "—"
      : `${formatCurrency(appointmentValueLastPeriod)} ${currencySuffix}`;
  const salesTodayLabel =
    salesLoading || salesError
      ? "—"
      : `${formatCurrency(salesTodayTotal)} ${currencySuffix}`;
  const newClientsLabel =
    appointmentsLoading || appointmentsError ? "—" : String(newClientsToday);
  const upcomingTotalLabel =
    appointmentsLoading || appointmentsError
      ? "—"
      : t("booking.overview.upcoming.bookedCount", "{count} booket", {
          count: appointmentsUpcoming.length,
        });
  const upcomingConfirmedLabel =
    appointmentsLoading || appointmentsError
      ? "—"
      : String(confirmedSeries.reduce((sum, value) => sum + value, 0));
  const upcomingCancelledLabel =
    appointmentsLoading || appointmentsError
      ? "—"
      : String(cancelledSeries.reduce((sum, value) => sum + value, 0));
  const calendarToken = "{calendar}";
  const emptyTodaySubtitle = t(
    "booking.overview.today.emptySubtitle",
    "Gå til afsnittet med din {calendar} for at tilføje aftaler",
    { calendar: calendarToken }
  );
  const [emptyTodayPrefix, emptyTodaySuffix] = emptyTodaySubtitle.split(calendarToken);

  return (
    <BookingSidebarLayout>
      <div className="overview-page">
        <div className="overview-header">
          <div>
            <h1>{t("booking.overview.title", "Klinik overblik")}</h1>
            <p>
              {t(
                "booking.overview.subtitle",
                "Et hurtigt overblik over dagens drift og de seneste resultater."
              )}
            </p>
          </div>
          <button type="button" className="overview-pill">
            {t("booking.overview.period.last7", "Seneste 7 dage")}
          </button>
        </div>

        <div className="overview-grid overview-grid--top">
          <div className="overview-card overview-card--chart">
            <div className="overview-card-header">
              <div>
                <h3>{t("booking.overview.sales.title", "Seneste salg")}</h3>
                <span>
                  {t("booking.overview.sales.range", "Seneste {count} dage", {
                    count: salesPeriod,
                  })}
                </span>
              </div>
              <div style={{ position: "relative" }} ref={salesDropdownRef}>
                <button 
                  type="button" 
                  className="overview-icon-button" 
                  aria-label={t("booking.overview.actions.more", "Flere muligheder")}
                  onClick={() => setShowSalesDropdown(!showSalesDropdown)}
                >
                  <span>...</span>
                </button>
                {showSalesDropdown && (
                  <div className="overview-dropdown">
                    <div className="overview-dropdown-header">
                      {t("booking.overview.dropdown.period", "Periode")}
                    </div>
                    <button
                      className={`overview-dropdown-item ${salesPeriod === "7" ? "overview-dropdown-item--active" : ""}`}
                      onClick={() => {
                        setSalesPeriod("7");
                        setShowSalesDropdown(false);
                      }}
                    >
                      {salesPeriod === "7" && "✓ "}
                      {t("booking.overview.sales.option7", "Seneste 7 dage")}
                    </button>
                    <button
                      className={`overview-dropdown-item ${salesPeriod === "30" ? "overview-dropdown-item--active" : ""}`}
                      onClick={() => {
                        setSalesPeriod("30");
                        setShowSalesDropdown(false);
                      }}
                    >
                      {salesPeriod === "30" && "✓ "}
                      {t("booking.overview.sales.option30", "Seneste 30 dage")}
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="overview-kpi">
              <div className="overview-kpi-value">{salesSummaryTotalLabel}</div>
              <div className="overview-kpi-meta">
                <span>
                  {t("booking.overview.sales.appointments", "Aftaler")}{" "}
                  <strong>{appointmentsLastPeriodLabel}</strong>
                </span>
                <span>
                  {t("booking.overview.sales.appointmentValue", "Aftalens værdi")}{" "}
                  <strong>{appointmentValueLabel}</strong>
                </span>
              </div>
            </div>
            <div className="overview-chart">
              <div className="overview-chart-axis">
                {lineChartConfig.ticks.map((tick, index) => (
                  <span key={`line-tick-${index}`}>
                    {formatCurrency(tick)} {currencySuffix}
                  </span>
                ))}
              </div>
              <div className="overview-chart-area">
                <ChartSvg width={lineChartConfig.width} height={lineChartConfig.height}>
                  <g>
                    {lineChartConfig.ticks.map((_, index) => {
                      const tickCount = lineChartConfig.ticks.length - 1 || 1;
                      const y =
                        lineChartConfig.padding.top +
                        (lineChartConfig.innerHeight / tickCount) * index;
                      return (
                        <line
                          key={`line-grid-${index}`}
                          x1={lineChartConfig.padding.left}
                          y1={y}
                          x2={lineChartConfig.width - lineChartConfig.padding.right}
                          y2={y}
                          className="overview-chart-gridline"
                        />
                      );
                    })}
                    {lineChartLabelEntries.map((entry) => {
                      const x =
                        lineChartConfig.padding.left +
                        entry.index * lineChartConfig.stepX;
                      return (
                        <line
                          key={`line-vertical-${entry.index}`}
                          x1={x}
                          y1={lineChartConfig.padding.top}
                          x2={x}
                          y2={lineChartConfig.height - lineChartConfig.padding.bottom}
                          className="overview-chart-gridline"
                        />
                      );
                    })}
                  </g>
                  <path
                    d={lineChartConfig.salesPath}
                    className="overview-chart-series overview-chart-series--primary"
                  />
                  <path
                    d={lineChartConfig.appointmentPath}
                    className="overview-chart-series overview-chart-series--secondary"
                  />
                  {lineChartConfig.salesPoints.map((point, index) => (
                    <circle
                      key={`line-primary-${index}`}
                      cx={point.x}
                      cy={point.y}
                      r={3}
                      className="overview-chart-dot overview-chart-dot--primary"
                    />
                  ))}
                  {lineChartConfig.appointmentPoints.map((point, index) => (
                    <circle
                      key={`line-secondary-${index}`}
                      cx={point.x}
                      cy={point.y}
                      r={3}
                      className="overview-chart-dot overview-chart-dot--secondary"
                    />
                  ))}
                </ChartSvg>
                <div 
                  className={`overview-chart-x ${salesPeriod === "30" ? "overview-chart-x--rotated" : ""}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${lastSalesDates.length}, minmax(0, 1fr))`
                  }}
                >
                  {lineChartLabelEntries.map((entry) => (
                    <span
                      key={`line-label-${entry.index}`}
                      style={
                        salesPeriod === "30"
                          ? { gridColumn: `${entry.index + 1} / span 3` }
                          : undefined
                      }
                    >
                      {entry.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="overview-legend">
              <span className="overview-legend-dot overview-legend-dot--primary" />
              <span>{t("booking.overview.legend.sales", "Salg")}</span>
              <span className="overview-legend-dot overview-legend-dot--secondary" />
              <span>{t("booking.overview.legend.appointments", "Aftaler")}</span>
            </div>
          </div>

          <div className="overview-card">
            <div className="overview-card-header">
              <div>
                <h3>{t("booking.overview.upcoming.title", "Kommende aftaler")}</h3>
                <span>
                  {t("booking.overview.upcoming.range", "Næste {count} dage", {
                    count: appointmentsPeriod,
                  })}
                </span>
              </div>
              <div style={{ position: "relative" }} ref={appointmentsDropdownRef}>
                <button 
                  type="button" 
                  className="overview-icon-button" 
                  aria-label={t("booking.overview.actions.more", "Flere muligheder")}
                  onClick={() => setShowAppointmentsDropdown(!showAppointmentsDropdown)}
                >
                  <span>...</span>
                </button>
                {showAppointmentsDropdown && (
                  <div className="overview-dropdown">
                    <div className="overview-dropdown-header">
                      {t("booking.overview.dropdown.period", "Periode")}
                    </div>
                    <button
                      className={`overview-dropdown-item ${appointmentsPeriod === "7" ? "overview-dropdown-item--active" : ""}`}
                      onClick={() => {
                        setAppointmentsPeriod("7");
                        setShowAppointmentsDropdown(false);
                      }}
                    >
                      {appointmentsPeriod === "7" && "✓ "}
                      {t("booking.overview.upcoming.option7", "Næste 7 dage")}
                    </button>
                    <button
                      className={`overview-dropdown-item ${appointmentsPeriod === "30" ? "overview-dropdown-item--active" : ""}`}
                      onClick={() => {
                        setAppointmentsPeriod("30");
                        setShowAppointmentsDropdown(false);
                      }}
                    >
                      {appointmentsPeriod === "30" && "✓ "}
                      {t("booking.overview.upcoming.option30", "Næste 30 dage")}
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="overview-kpi">
              <div className="overview-kpi-value">{upcomingTotalLabel}</div>
              <div className="overview-kpi-meta overview-kpi-meta--split">
                <span>
                  {t("booking.overview.upcoming.confirmed", "Bekræftede aftaler")}{" "}
                  <strong>{upcomingConfirmedLabel}</strong>
                </span>
                <span>
                  {t("booking.overview.upcoming.cancelled", "Aflyste aftaler")}{" "}
                  <strong>{upcomingCancelledLabel}</strong>
                </span>
              </div>
            </div>
            <div className="overview-chart">
              <div className="overview-chart-axis">
                {barChartConfig.ticks.map((tick, index) => (
                  <span key={`bar-tick-${index}`}>{tick}</span>
                ))}
              </div>
              <div className="overview-chart-area">
                <ChartSvg width={barChartConfig.width} height={barChartConfig.height}>
                  <g>
                    {barChartConfig.ticks.map((_, index) => {
                      const tickCount = barChartConfig.ticks.length - 1 || 1;
                      const y =
                        barChartConfig.padding.top +
                        (barChartConfig.innerHeight / tickCount) * index;
                      return (
                        <line
                          key={`bar-grid-${index}`}
                          x1={barChartConfig.padding.left}
                          y1={y}
                          x2={barChartConfig.width - barChartConfig.padding.right}
                          y2={y}
                          className="overview-chart-gridline"
                        />
                      );
                    })}
                  </g>
                  {confirmedSeries.map((value, index) => {
                    const height =
                      (value / barChartConfig.safeMax) * barChartConfig.innerHeight;
                    const x =
                      barChartConfig.padding.left +
                      index * barChartConfig.groupWidth +
                      barChartConfig.groupOffset;
                    const y =
                      barChartConfig.padding.top +
                      (barChartConfig.innerHeight - height);
                    return (
                      <rect
                        key={`bar-confirmed-${index}`}
                        x={x}
                        y={y}
                        width={barChartConfig.barWidth}
                        height={height}
                        rx={6}
                        className="overview-chart-bar overview-chart-bar--primary"
                      />
                    );
                  })}
                  {cancelledSeries.map((value, index) => {
                    const height =
                      (value / barChartConfig.safeMax) * barChartConfig.innerHeight;
                    const x =
                      barChartConfig.padding.left +
                      index * barChartConfig.groupWidth +
                      barChartConfig.groupOffset +
                      barChartConfig.barWidth +
                      barChartConfig.barGap;
                    const y =
                      barChartConfig.padding.top +
                      (barChartConfig.innerHeight - height);
                    return (
                      <rect
                        key={`bar-cancel-${index}`}
                        x={x}
                        y={y}
                        width={barChartConfig.barWidth}
                        height={height}
                        rx={6}
                        className="overview-chart-bar overview-chart-bar--secondary"
                      />
                    );
                  })}
                </ChartSvg>
                <div
                  className={`overview-chart-x ${appointmentsPeriod === "30" ? "overview-chart-x--rotated" : ""}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${nextAppointmentsDates.length}, minmax(0, 1fr))`
                  }}
                >
                  {barChartLabelEntries.map((entry) => (
                    <span
                      key={`bar-label-${entry.index}`}
                      style={
                        appointmentsPeriod === "30"
                          ? { gridColumn: `${entry.index + 1} / span 3` }
                          : undefined
                      }
                    >
                      {entry.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="overview-legend">
              <span className="overview-legend-dot overview-legend-dot--primary" />
              <span>{t("booking.overview.legend.confirmed", "Bekræftet")}</span>
              <span className="overview-legend-dot overview-legend-dot--alert" />
              <span>{t("booking.overview.legend.cancelled", "Aflysning")}</span>
            </div>
          </div>
        </div>

        <div className="overview-grid overview-grid--middle">
          <div className="overview-card">
            <div className="overview-card-header">
              <h3>{t("booking.overview.activity.title", "Aftaleaktivitet")}</h3>
            </div>
            <div className="overview-list">
              {appointmentsLoading && (
                <div className="overview-empty-state">
                  <div className="overview-empty-icon">
                    <Activity size={28} />
                  </div>
                  <h4>{t("booking.overview.activity.loadingTitle", "Henter aftaler...")}</h4>
                  <p>{t("booking.overview.activity.loadingSubtitle", "Vi opdaterer historikken lige nu")}</p>
                </div>
              )}
              {!appointmentsLoading && appointmentsError && (
                <div className="overview-empty-state">
                  <div className="overview-empty-icon">
                    <Activity size={28} />
                  </div>
                  <h4>{t("booking.overview.activity.errorTitle", "Kunne ikke hente aftaler")}</h4>
                  <p>{t("booking.overview.activity.errorSubtitle", "Prøv igen om lidt")}</p>
                </div>
              )}
              {!appointmentsLoading &&
                !appointmentsError &&
                pastAppointments.length === 0 && (
                  <div className="overview-empty-state">
                    <div className="overview-empty-icon">
                      <Activity size={28} />
                    </div>
                    <h4>{t("booking.overview.activity.emptyTitle", "Ingen tidligere aftaler")}</h4>
                    <p>
                      {t(
                        "booking.overview.activity.emptySubtitle",
                        "Historik vises her, når du har afsluttede aftaler"
                      )}
                    </p>
                  </div>
                )}
              {!appointmentsLoading &&
                !appointmentsError &&
                pastAppointments.map(({ appointment, date }) => {
                  const { day, month } = formatDayMonth(date);
                  const clientName =
                    appointment.client ||
                    appointment.clientEmail ||
                    t("booking.overview.activity.unknownClient", "Ukendt kunde");
                  const serviceName =
                    appointment.service ||
                    appointment.title ||
                    t("booking.overview.activity.defaultService", "Aftale");
                  const statusKey = normalizeStatus(appointment.status);
                  const statusLabel = getAppointmentStatusLabel(appointment.status);
                  const noteParts = [clientName];
                  if (appointment.serviceDuration) {
                    noteParts.push(
                      formatServiceDuration(appointment.serviceDuration, t) ||
                        appointment.serviceDuration
                    );
                  }
                  if (appointment.calendarOwner) {
                    noteParts.push(
                      t("booking.overview.activity.withStaff", "med {name}", {
                        name: appointment.calendarOwner,
                      })
                    );
                  }
                  return (
                    <div key={appointment.id} className="overview-list-item">
                      <div className="overview-list-date">
                        <span className="overview-list-day">{day}</span>
                        <span className="overview-list-month">{month}</span>
                      </div>
                      <div className="overview-list-body">
                        <div className="overview-list-meta">
                          <span>{formatDateTimeLabel(date)}</span>
                          <span className={statusClassName(statusKey)}>{statusLabel}</span>
                        </div>
                        <div className="overview-list-title">{serviceName}</div>
                        <div className="overview-list-note">{noteParts.join(" • ")}</div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          <div className="overview-card">
            <div className="overview-card-header">
              <h3>{t("booking.overview.today.title", "Næste aftaler i dag")}</h3>
            </div>
            {appointmentsLoading ? (
              <div className="overview-empty-state">
                <div className="overview-empty-icon">
                  <CalendarDays size={28} />
                </div>
                <h4>{t("booking.overview.today.loadingTitle", "Henter aftaler...")}</h4>
                <p>{t("booking.overview.today.loadingSubtitle", "Vi opdaterer dagens plan")}</p>
              </div>
            ) : appointmentsError ? (
              <div className="overview-empty-state">
                <div className="overview-empty-icon">
                  <CalendarDays size={28} />
                </div>
                <h4>{t("booking.overview.today.errorTitle", "Kunne ikke hente aftaler")}</h4>
                <p>{t("booking.overview.today.errorSubtitle", "Prøv igen om lidt")}</p>
              </div>
            ) : todayAppointments.length === 0 ? (
              <div className="overview-empty-state">
                <div className="overview-empty-icon">
                  <CalendarDays size={28} />
                </div>
                <h4>{t("booking.overview.today.emptyTitle", "Ingen aftaler i dag")}</h4>
                <p>
                  {emptyTodayPrefix}
                  <span className="overview-link">
                    {t("booking.overview.today.calendarLink", "kalender")}
                  </span>
                  {emptyTodaySuffix}
                </p>
              </div>
            ) : (
              <div className="overview-mini-list">
                {todayAppointments.map(({ appointment, date }) => {
                  const clientName =
                    appointment.client ||
                    appointment.clientEmail ||
                    t("booking.overview.activity.unknownClient", "Ukendt kunde");
                  const serviceName =
                    appointment.service ||
                    appointment.title ||
                    t("booking.overview.activity.defaultService", "Aftale");
                  return (
                    <div key={appointment.id} className="overview-mini-item">
                      <div>
                        <div className="overview-mini-title">{serviceName}</div>
                        <div className="overview-mini-meta">{clientName}</div>
                      </div>
                      <div className="overview-mini-time">{formatDateTimeLabel(date)}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="overview-grid overview-grid--bottom">
          <div className="overview-card">
            <div className="overview-card-header">
              <h3>{t("booking.overview.topServices.title", "Toptjenester")}</h3>
            </div>
            <table className="overview-table">
              <thead>
                <tr>
                  <th>{t("booking.overview.topServices.columns.service", "Tjeneste")}</th>
                  <th>{t("booking.overview.columns.thisMonth", "Denne måned")}</th>
                  <th>{t("booking.overview.columns.lastMonth", "Sidste måned")}</th>
                </tr>
              </thead>
              <tbody>
                {appointmentsLoading && (
                  <tr>
                    <td colSpan={3}>
                      {t("booking.overview.table.loading", "Henter data...")}
                    </td>
                  </tr>
                )}
                {!appointmentsLoading && appointmentsError && (
                  <tr>
                    <td colSpan={3}>
                      {t("booking.overview.table.error", "Kunne ikke hente data.")}
                    </td>
                  </tr>
                )}
                {!appointmentsLoading &&
                  !appointmentsError &&
                  topServices.length === 0 && (
                    <tr>
                      <td colSpan={3}>
                        {t("booking.overview.table.empty", "Ingen data endnu.")}
                      </td>
                    </tr>
                  )}
                {!appointmentsLoading &&
                  !appointmentsError &&
                  topServices.map((service) => (
                    <tr key={service.name}>
                      <td>{service.name}</td>
                      <td>{service.month}</td>
                      <td>{service.lastMonth}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div className="overview-card">
            <div className="overview-card-header">
              <h3>{t("booking.overview.topStaff.title", "Topmedarbejder")}</h3>
            </div>
            <table className="overview-table">
              <thead>
                <tr>
                  <th>{t("booking.overview.topStaff.columns.staff", "Medarbejder")}</th>
                  <th>{t("booking.overview.columns.thisMonth", "Denne måned")}</th>
                  <th>{t("booking.overview.columns.lastMonth", "Sidste måned")}</th>
                </tr>
              </thead>
              <tbody>
                {salesLoading && (
                  <tr>
                    <td colSpan={3}>
                      {t("booking.overview.table.loading", "Henter data...")}
                    </td>
                  </tr>
                )}
                {!salesLoading && salesError && (
                  <tr>
                    <td colSpan={3}>
                      {t("booking.overview.table.error", "Kunne ikke hente data.")}
                    </td>
                  </tr>
                )}
                {!salesLoading && !salesError && topStaff.length === 0 && (
                  <tr>
                    <td colSpan={3}>
                      {t("booking.overview.table.empty", "Ingen data endnu.")}
                    </td>
                  </tr>
                )}
                {!salesLoading &&
                  !salesError &&
                  topStaff.map((staff) => (
                    <tr key={staff.name}>
                      <td>{staff.name}</td>
                      <td>{staff.monthLabel}</td>
                      <td>{staff.lastMonthLabel}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="overview-grid overview-grid--footer">
          <div className="overview-card overview-card--compact">
            <div className="overview-compact">
              <div className="overview-compact-icon">
                <BarChart3 size={20} />
              </div>
              <div>
                <p>{t("booking.overview.footer.revenueToday", "Omsætning i dag")}</p>
                <strong>{salesTodayLabel}</strong>
              </div>
            </div>
          </div>
          <div className="overview-card overview-card--compact">
            <div className="overview-compact">
              <div className="overview-compact-icon">
                <Users size={20} />
              </div>
              <div>
                <p>{t("booking.overview.footer.newClients", "Nye klienter")}</p>
                <strong>{newClientsLabel}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </BookingSidebarLayout>
  );
}

export default Overview;
