import React, { useMemo } from "react";
import "./Overview.css";
import { BookingSidebarLayout } from "../../../components/ui/BookingSidebarLayout";
import { Activity, BarChart3, CalendarDays, Users } from "lucide-react";
import { useAuth } from "../../../AuthContext";
import useAppointments from "../../../hooks/useAppointments";
import useSales from "../../../hooks/useSales";

const formatCurrency = (value) =>
  new Intl.NumberFormat("da-DK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);

const monthShortLabels = [
  "jan",
  "feb",
  "mar",
  "apr",
  "maj",
  "jun",
  "jul",
  "aug",
  "sep",
  "okt",
  "nov",
  "dec",
];

const weekdayShortLabels = ["søn", "man", "tir", "ons", "tor", "fre", "lør"];

const statusLabels = {
  booked: "Booket",
  confirmed: "Bekræftet",
  arrived: "Ankommet",
  started: "Begyndt",
  completed: "Gennemført",
  cancelled: "Aflyst",
  pending: "Afventer",
  noshow: "Udeblivelse",
  "no-show": "Udeblivelse",
  "no_show": "Udeblivelse",
};

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

const getAppointmentStatusLabel = (status) => {
  if (!status) return "Booket";
  return statusLabels[String(status)] || status;
};

const getAppointmentPrice = (appointment) => {
  if (typeof appointment?.servicePriceInclVat === "number") {
    return appointment.servicePriceInclVat;
  }
  if (typeof appointment?.servicePrice === "number") {
    return appointment.servicePrice;
  }
  return 0;
};

const formatDayMonth = (date) => {
  const day = String(date.getDate()).padStart(2, "0");
  const month = monthShortLabels[date.getMonth()] || "";
  return { day, month };
};

const formatDateTimeLabel = (date) => {
  const weekday = weekdayShortLabels[date.getDay()] || "";
  const day = String(date.getDate()).padStart(2, "0");
  const month = monthShortLabels[date.getMonth()] || "";
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${weekday}, ${day} ${month} ${year} ${hours}:${minutes}`;
};

const statusClassName = (status) => {
  if (status === "Gennemført") return "overview-status overview-status--complete";
  if (status === "Booket") return "overview-status overview-status--booked";
  return "overview-status";
};

const statusGroup = (status) => {
  if (!status) return "booked";
  const normalized = String(status).toLowerCase();
  if (normalized.includes("aflyst") || normalized.includes("cancel")) return "cancelled";
  if (normalized.includes("bekræft") || normalized.includes("confirm")) return "confirmed";
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

  const today = useMemo(() => new Date(), []);
  const todayStart = startOfDay(today);
  const todayEnd = endOfDay(today);
  const last7Start = startOfDay(addDays(todayStart, -6));
  const next7End = endOfDay(addDays(todayStart, 6));
  const tomorrowStart = startOfDay(addDays(todayStart, 1));
  const last7Dates = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(last7Start, index)),
    [last7Start]
  );
  const next7Dates = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(tomorrowStart, index)),
    [tomorrowStart]
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

  const appointmentsLast7 = useMemo(() => {
    return appointmentEntries.filter(({ date }) => date >= last7Start && date <= todayEnd);
  }, [appointmentEntries, last7Start, todayEnd]);

  const appointmentsToday = useMemo(() => {
    return appointmentEntries.filter(({ date }) => date >= todayStart && date <= todayEnd);
  }, [appointmentEntries, todayStart, todayEnd]);

  const appointmentsUpcoming = useMemo(() => {
    return appointmentEntries
      .filter(({ date }) => date >= tomorrowStart && date <= next7End)
      .sort((a, b) => a.date - b.date);
  }, [appointmentEntries, next7End, tomorrowStart]);

  const appointmentsPast = useMemo(() => {
    return appointmentEntries
      .filter(({ date }) => date < todayStart)
      .sort((a, b) => b.date - a.date);
  }, [appointmentEntries, todayStart]);

  const salesLast7 = useMemo(() => {
    return sales.filter((sale) => {
      const date = getSaleDate(sale);
      if (!date) return false;
      return date >= last7Start && date <= todayEnd;
    });
  }, [sales, last7Start, todayEnd]);

  const salesToday = useMemo(() => {
    return sales.filter((sale) => {
      const date = getSaleDate(sale);
      if (!date) return false;
      return date >= todayStart && date <= todayEnd;
    });
  }, [sales, todayStart, todayEnd]);

  const salesTotalsByDate = useMemo(() => {
    const map = new Map();
    salesLast7.forEach((sale) => {
      const date = getSaleDate(sale);
      if (!date) return;
      const key = formatDateKey(date);
      const current = map.get(key) || 0;
      map.set(key, current + (sale.totals?.total ?? 0));
    });
    return map;
  }, [salesLast7]);

  const appointmentValueByDate = useMemo(() => {
    const map = new Map();
    appointmentsLast7.forEach(({ appointment, date }) => {
      const key = formatDateKey(date);
      const current = map.get(key) || 0;
      map.set(key, current + getAppointmentPrice(appointment));
    });
    return map;
  }, [appointmentsLast7]);

  const salesSeries = useMemo(
    () => last7Dates.map((date) => salesTotalsByDate.get(formatDateKey(date)) || 0),
    [last7Dates, salesTotalsByDate]
  );

  const appointmentSeries = useMemo(
    () => last7Dates.map((date) => appointmentValueByDate.get(formatDateKey(date)) || 0),
    [last7Dates, appointmentValueByDate]
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

  const lineChartLabels = useMemo(
    () =>
      last7Dates.map((date) => {
        const weekday = weekdayShortLabels[date.getDay()] || "";
        return `${weekday} ${date.getDate()}`;
      }),
    [last7Dates]
  );

  const upcomingStatusByDate = useMemo(() => {
    const map = new Map();
    next7Dates.forEach((date) => {
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
  }, [appointmentsUpcoming, next7Dates]);

  const confirmedSeries = useMemo(
    () => next7Dates.map((date) => upcomingStatusByDate.get(formatDateKey(date))?.confirmed || 0),
    [next7Dates, upcomingStatusByDate]
  );

  const cancelledSeries = useMemo(
    () => next7Dates.map((date) => upcomingStatusByDate.get(formatDateKey(date))?.cancelled || 0),
    [next7Dates, upcomingStatusByDate]
  );

  const barChartConfig = useMemo(() => {
    const width = 420;
    const height = 160;
    const padding = { top: 8, bottom: 18, left: 6, right: 6 };
    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;
    const maxValue = toNiceCountMax(Math.max(...confirmedSeries, ...cancelledSeries, 0));
    const safeMax = maxValue || 1;
    const groupWidth =
      confirmedSeries.length > 0 ? innerWidth / confirmedSeries.length : innerWidth;
    const barGap = 6;
    const barWidth = Math.max(8, Math.min(16, (groupWidth - barGap) / 2));
    const groupOffset = (groupWidth - (barWidth * 2 + barGap)) / 2;

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
      groupWidth,
      barWidth,
      barGap,
      groupOffset,
      ticks,
    };
  }, [confirmedSeries, cancelledSeries]);

  const barChartLabels = useMemo(
    () =>
      next7Dates.map((date) => {
        const weekday = weekdayShortLabels[date.getDay()] || "";
        return `${weekday} ${date.getDate()}`;
      }),
    [next7Dates]
  );

  const salesSummaryTotal = useMemo(() => {
    return salesLast7.reduce((sum, sale) => sum + (sale.totals?.total ?? 0), 0);
  }, [salesLast7]);

  const appointmentValueLast7 = useMemo(() => {
    return appointmentsLast7.reduce(
      (sum, entry) => sum + getAppointmentPrice(entry.appointment),
      0
    );
  }, [appointmentsLast7]);

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
      const name = sale.employeeName || "fælles konto";
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
        monthLabel: `${formatCurrency(entry.month)} kr.`,
        lastMonthLabel: `${formatCurrency(entry.lastMonth)} kr.`,
      }));
  }, [sales, currentMonthStart, nextMonthStart, previousMonthEnd, previousMonthStart]);

  const newClientsToday = useMemo(() => {
    const clients = new Set();
    appointmentsToday.forEach(({ appointment }) => {
      const key = appointment.clientId || appointment.clientEmail || appointment.client || null;
      if (key) clients.add(String(key));
    });
    return clients.size;
  }, [appointmentsToday]);

  const salesSummaryTotalLabel =
    salesLoading || salesError ? "—" : `${formatCurrency(salesSummaryTotal)} kr.`;
  const appointmentsLast7Label =
    appointmentsLoading || appointmentsError ? "—" : String(appointmentsLast7.length);
  const appointmentValueLabel =
    appointmentsLoading || appointmentsError ? "—" : `${formatCurrency(appointmentValueLast7)} kr.`;
  const salesTodayLabel =
    salesLoading || salesError ? "—" : `${formatCurrency(salesTodayTotal)} kr.`;
  const newClientsLabel =
    appointmentsLoading || appointmentsError ? "—" : String(newClientsToday);
  const upcomingTotalLabel =
    appointmentsLoading || appointmentsError
      ? "—"
      : `${appointmentsUpcoming.length} booket`;
  const upcomingConfirmedLabel =
    appointmentsLoading || appointmentsError
      ? "—"
      : String(confirmedSeries.reduce((sum, value) => sum + value, 0));
  const upcomingCancelledLabel =
    appointmentsLoading || appointmentsError
      ? "—"
      : String(cancelledSeries.reduce((sum, value) => sum + value, 0));

  return (
    <BookingSidebarLayout>
      <div className="overview-page">
        <div className="overview-header">
          <div>
            <h1>Klinik overblik</h1>
            <p>Et hurtigt overblik over dagens drift og de seneste resultater.</p>
          </div>
          <button type="button" className="overview-pill">
            Seneste 7 dage
          </button>
        </div>

        <div className="overview-grid overview-grid--top">
          <div className="overview-card overview-card--chart">
            <div className="overview-card-header">
              <div>
                <h3>Seneste salg</h3>
                <span>Seneste 7 dage</span>
              </div>
              <button type="button" className="overview-icon-button" aria-label="Flere muligheder">
                <span>...</span>
              </button>
            </div>
            <div className="overview-kpi">
              <div className="overview-kpi-value">{salesSummaryTotalLabel}</div>
              <div className="overview-kpi-meta">
                <span>Aftaler {appointmentsLast7Label}</span>
                <span>Aftalens værdi {appointmentValueLabel}</span>
              </div>
            </div>
            <div className="overview-chart">
              <div className="overview-chart-axis">
                {lineChartConfig.ticks.map((tick, index) => (
                  <span key={`line-tick-${index}`}>{formatCurrency(tick)} kr.</span>
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
                    {lineChartLabels.map((_, index) => {
                      const x = lineChartConfig.padding.left + index * lineChartConfig.stepX;
                      return (
                        <line
                          key={`line-vertical-${index}`}
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
                <div className="overview-chart-x">
                  {lineChartLabels.map((label, index) => (
                    <span key={`line-label-${index}`}>{label}</span>
                  ))}
                </div>
              </div>
            </div>
            <div className="overview-legend">
              <span className="overview-legend-dot overview-legend-dot--primary" />
              <span>Salg</span>
              <span className="overview-legend-dot overview-legend-dot--secondary" />
              <span>Aftaler</span>
            </div>
          </div>

          <div className="overview-card">
            <div className="overview-card-header">
              <div>
                <h3>Kommende aftaler</h3>
                <span>Næste 7 dage</span>
              </div>
              <button type="button" className="overview-icon-button" aria-label="Flere muligheder">
                <span>...</span>
              </button>
            </div>
            <div className="overview-kpi">
              <div className="overview-kpi-value">{upcomingTotalLabel}</div>
              <div className="overview-kpi-meta overview-kpi-meta--split">
                <span>
                  Bekræftede aftaler <strong>{upcomingConfirmedLabel}</strong>
                </span>
                <span>
                  Aflyste aftaler <strong>{upcomingCancelledLabel}</strong>
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
                <div className="overview-chart-x">
                  {barChartLabels.map((label, index) => (
                    <span key={`bar-label-${index}`}>{label}</span>
                  ))}
                </div>
              </div>
            </div>
            <div className="overview-legend">
              <span className="overview-legend-dot overview-legend-dot--primary" />
              <span>Bekræftet</span>
              <span className="overview-legend-dot overview-legend-dot--alert" />
              <span>Aflysning</span>
            </div>
          </div>
        </div>

        <div className="overview-grid overview-grid--middle">
          <div className="overview-card">
            <div className="overview-card-header">
              <h3>Aftaleaktivitet</h3>
            </div>
            <div className="overview-list">
              {appointmentsLoading && (
                <div className="overview-empty-state">
                  <div className="overview-empty-icon">
                    <Activity size={28} />
                  </div>
                  <h4>Henter aftaler...</h4>
                  <p>Vi opdaterer historikken lige nu</p>
                </div>
              )}
              {!appointmentsLoading && appointmentsError && (
                <div className="overview-empty-state">
                  <div className="overview-empty-icon">
                    <Activity size={28} />
                  </div>
                  <h4>Kunne ikke hente aftaler</h4>
                  <p>Prøv igen om lidt</p>
                </div>
              )}
              {!appointmentsLoading &&
                !appointmentsError &&
                pastAppointments.length === 0 && (
                  <div className="overview-empty-state">
                    <div className="overview-empty-icon">
                      <Activity size={28} />
                    </div>
                    <h4>Ingen tidligere aftaler</h4>
                    <p>Historik vises her, når du har afsluttede aftaler</p>
                  </div>
                )}
              {!appointmentsLoading &&
                !appointmentsError &&
                pastAppointments.map(({ appointment, date }) => {
                  const { day, month } = formatDayMonth(date);
                  const clientName =
                    appointment.client || appointment.clientEmail || "Ukendt kunde";
                  const serviceName = appointment.service || appointment.title || "Aftale";
                  const statusLabel = getAppointmentStatusLabel(appointment.status);
                  const noteParts = [clientName];
                  if (appointment.serviceDuration) {
                    noteParts.push(appointment.serviceDuration);
                  }
                  if (appointment.calendarOwner) {
                    noteParts.push(`med ${appointment.calendarOwner}`);
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
                          <span className={statusClassName(statusLabel)}>{statusLabel}</span>
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
              <h3>Næste aftaler i dag</h3>
            </div>
            {appointmentsLoading ? (
              <div className="overview-empty-state">
                <div className="overview-empty-icon">
                  <CalendarDays size={28} />
                </div>
                <h4>Henter aftaler...</h4>
                <p>Vi opdaterer dagens plan</p>
              </div>
            ) : appointmentsError ? (
              <div className="overview-empty-state">
                <div className="overview-empty-icon">
                  <CalendarDays size={28} />
                </div>
                <h4>Kunne ikke hente aftaler</h4>
                <p>Prøv igen om lidt</p>
              </div>
            ) : todayAppointments.length === 0 ? (
              <div className="overview-empty-state">
                <div className="overview-empty-icon">
                  <CalendarDays size={28} />
                </div>
                <h4>Ingen aftaler i dag</h4>
                <p>
                  Gå til afsnittet med din <span className="overview-link">kalender</span> for at
                  tilføje aftaler
                </p>
              </div>
            ) : (
              <div className="overview-mini-list">
                {todayAppointments.map(({ appointment, date }) => {
                  const clientName =
                    appointment.client || appointment.clientEmail || "Ukendt kunde";
                  const serviceName = appointment.service || appointment.title || "Aftale";
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
              <h3>Toptjenester</h3>
            </div>
            <table className="overview-table">
              <thead>
                <tr>
                  <th>Tjeneste</th>
                  <th>Denne måned</th>
                  <th>Sidste måned</th>
                </tr>
              </thead>
              <tbody>
                {appointmentsLoading && (
                  <tr>
                    <td colSpan={3}>Henter data...</td>
                  </tr>
                )}
                {!appointmentsLoading && appointmentsError && (
                  <tr>
                    <td colSpan={3}>Kunne ikke hente data.</td>
                  </tr>
                )}
                {!appointmentsLoading &&
                  !appointmentsError &&
                  topServices.length === 0 && (
                    <tr>
                      <td colSpan={3}>Ingen data endnu.</td>
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
              <h3>Topmedarbejder</h3>
            </div>
            <table className="overview-table">
              <thead>
                <tr>
                  <th>Medarbejder</th>
                  <th>Denne måned</th>
                  <th>Sidste måned</th>
                </tr>
              </thead>
              <tbody>
                {salesLoading && (
                  <tr>
                    <td colSpan={3}>Henter data...</td>
                  </tr>
                )}
                {!salesLoading && salesError && (
                  <tr>
                    <td colSpan={3}>Kunne ikke hente data.</td>
                  </tr>
                )}
                {!salesLoading && !salesError && topStaff.length === 0 && (
                  <tr>
                    <td colSpan={3}>Ingen data endnu.</td>
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
                <p>Omsætning i dag</p>
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
                <p>Nye klienter</p>
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
