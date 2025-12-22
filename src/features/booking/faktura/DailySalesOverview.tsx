import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "../../../AuthContext";
import useSales from "../../../hooks/useSales";
import AddNowDrawer from "./AddNowDrawer";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("da-DK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseDateKey = (value: string) => {
  const [year, month, day] = value.split("-").map((part) => Number(part));
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const weekdayLabels = [
  "mandag",
  "tirsdag",
  "onsdag",
  "torsdag",
  "fredag",
  "l\u00f8rdag",
  "s\u00f8ndag",
];

const weekdayShortLabels = ["ma", "ti", "on", "to", "fr", "l\u00f8", "s\u00f8"];

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

const monthLongLabels = [
  "januar",
  "februar",
  "marts",
  "april",
  "maj",
  "juni",
  "juli",
  "august",
  "september",
  "oktober",
  "november",
  "december",
];

const formatDisplayDate = (value: string) => {
  const date = parseDateKey(value);
  if (!date) return "";
  const weekday = weekdayLabels[(date.getDay() + 6) % 7] || "";
  const month = monthShortLabels[date.getMonth()] || "";
  return `${weekday} ${date.getDate()} ${month}, ${date.getFullYear()}`;
};

const buildTransactionRows = (sales: any[]) => {
  const summary = {
    services: { label: "Tjenester", count: 0, total: 0 },
    addons: { label: "Till\u00e6gsydelser", count: 0, total: 0 },
    products: { label: "Produkter", count: 0, total: 0 },
    shipping: { label: "Forsendelse", count: 0, total: 0 },
    giftcards: { label: "Gavekort", count: 0, total: 0 },
    memberships: { label: "Medlemskaber", count: 0, total: 0 },
    lateCancel: { label: "Gebyr for sen aflysning", count: 0, total: 0 },
    noShow: { label: "Udeblivelsesgebyrer", count: 0, total: 0 },
    refunds: { label: "Refundering", count: 0, total: 0 },
  };

  sales.forEach((sale) => {
    const items = Array.isArray(sale.items) ? sale.items : [];
    items.forEach((item: any) => {
      const quantity = item.quantity || 1;
      const total = (item.price || 0) * quantity;
      const type = item.type || item.source || "service";
      if (type === "product") {
        summary.products.count += quantity;
        summary.products.total += total;
      } else {
        summary.services.count += quantity;
        summary.services.total += total;
      }
    });
  });

  const totalCount =
    summary.services.count +
    summary.addons.count +
    summary.products.count +
    summary.shipping.count +
    summary.giftcards.count +
    summary.memberships.count +
    summary.lateCancel.count +
    summary.noShow.count +
    summary.refunds.count;

  const totalAmount =
    summary.services.total +
    summary.addons.total +
    summary.products.total +
    summary.shipping.total +
    summary.giftcards.total +
    summary.memberships.total +
    summary.lateCancel.total +
    summary.noShow.total +
    summary.refunds.total;

  return [
    {
      label: summary.services.label,
      sales: summary.services.count,
      refunds: 0,
      total: summary.services.total,
    },
    {
      label: summary.addons.label,
      sales: summary.addons.count,
      refunds: 0,
      total: summary.addons.total,
    },
    {
      label: summary.products.label,
      sales: summary.products.count,
      refunds: 0,
      total: summary.products.total,
    },
    {
      label: summary.shipping.label,
      sales: summary.shipping.count,
      refunds: 0,
      total: summary.shipping.total,
    },
    {
      label: summary.giftcards.label,
      sales: summary.giftcards.count,
      refunds: 0,
      total: summary.giftcards.total,
    },
    {
      label: summary.memberships.label,
      sales: summary.memberships.count,
      refunds: 0,
      total: summary.memberships.total,
    },
    {
      label: summary.lateCancel.label,
      sales: summary.lateCancel.count,
      refunds: 0,
      total: summary.lateCancel.total,
    },
    {
      label: summary.noShow.label,
      sales: summary.noShow.count,
      refunds: 0,
      total: summary.noShow.total,
    },
    {
      label: summary.refunds.label,
      sales: summary.refunds.count,
      refunds: 0,
      total: summary.refunds.total,
    },
    { label: "Salg i alt", sales: totalCount, refunds: 0, total: totalAmount, isTotal: true },
  ];
};

const buildPaymentRows = (sales: any[]) => {
  const byMethod: Record<string, number> = {};
  sales.forEach((sale) => {
    const method = sale.paymentMethod || "Andet";
    byMethod[method] = (byMethod[method] || 0) + (sale.totals?.total ?? 0);
  });

  const rows = Object.entries(byMethod).map(([label, received]) => ({
    label,
    received,
    refunded: 0,
  }));

  const totalReceived = rows.reduce((sum, row) => sum + row.received, 0);

  return {
    rows,
    totalReceived,
  };
};

export default function DailySalesOverview() {
  const { user } = useAuth();
  const { sales, loading, error } = useSales(user?.uid || null, {
    status: "completed",
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()));
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const initial = parseDateKey(toDateKey(new Date()));
    return initial ? new Date(initial.getFullYear(), initial.getMonth(), 1) : new Date();
  });
  const calendarRef = useRef<HTMLDivElement | null>(null);

  const filteredSales = useMemo(() => {
    const selected = parseDateKey(selectedDate);
    if (!selected) return sales;
    const key = toDateKey(selected);
    return sales.filter((sale: any) => {
      const saleDate = sale.completedAtDate || null;
      if (!saleDate) return false;
      return toDateKey(saleDate) === key;
    });
  }, [sales, selectedDate]);

  const transactionRows = useMemo(
    () => buildTransactionRows(filteredSales),
    [filteredSales]
  );

  const paymentData = useMemo(
    () => buildPaymentRows(filteredSales),
    [filteredSales]
  );

  const handlePrevDay = () => {
    const current = parseDateKey(selectedDate);
    if (!current) return;
    const previous = new Date(current);
    previous.setDate(previous.getDate() - 1);
    setSelectedDate(toDateKey(previous));
  };

  const handleToggleCalendar = () => {
    if (!calendarOpen) {
      const selected = parseDateKey(selectedDate) || new Date();
      setCalendarMonth(new Date(selected.getFullYear(), selected.getMonth(), 1));
    }
    setCalendarOpen((prev) => !prev);
  };

  const handleSelectDate = (date: Date) => {
    setSelectedDate(toDateKey(date));
    setCalendarOpen(false);
  };

  const handlePrevMonth = () => {
    setCalendarMonth(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
    );
  };

  const handleNextMonth = () => {
    setCalendarMonth(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
    );
  };

  useEffect(() => {
    if (!calendarOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (!calendarRef.current) return;
      if (!calendarRef.current.contains(event.target as Node)) {
        setCalendarOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [calendarOpen]);

  useEffect(() => {
    const selected = parseDateKey(selectedDate);
    if (!selected) return;
    setCalendarMonth((prev) => {
      if (
        prev.getFullYear() === selected.getFullYear() &&
        prev.getMonth() === selected.getMonth()
      ) {
        return prev;
      }
      return new Date(selected.getFullYear(), selected.getMonth(), 1);
    });
  }, [selectedDate]);

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const startOfMonth = new Date(year, month, 1);
    const startWeekday = (startOfMonth.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    return Array.from({ length: 42 }, (_, index) => {
      const dayOffset = index - startWeekday + 1;
      if (dayOffset < 1) {
        const date = new Date(year, month - 1, daysInPrevMonth + dayOffset);
        return { date, inCurrentMonth: false };
      }
      if (dayOffset > daysInMonth) {
        const date = new Date(year, month, dayOffset);
        return { date, inCurrentMonth: false };
      }
      return { date: new Date(year, month, dayOffset), inCurrentMonth: true };
    });
  }, [calendarMonth]);

  const calendarMonthLabel =
    monthLongLabels[calendarMonth.getMonth()] || "";

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 bg-white px-8 pb-6 pt-8">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Daglige salg</h1>
          <p className="mt-1 text-sm text-slate-500">
            Se, filtrer og eksport\u00e9r dagens transaktioner og
            kontanttransaktioner.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" className="toolbar-pill">
            Eksport\u00e9r
            <ChevronDown className="toolbar-caret" />
          </button>
          <button
            type="button"
            className="toolbar-pill toolbar-primary"
            onClick={() => setDrawerOpen(true)}
          >
            Tilf\u00f8j nu
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-slate-50 px-8 pb-10">
        <div className="mt-6 rounded-2xl bg-white px-6 py-4 shadow-sm">
          <div className="relative" ref={calendarRef}>
            <div className="inline-flex items-center rounded-full border border-slate-200 bg-white text-sm text-slate-700 shadow-sm">
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-50"
                aria-label="Forrige dag"
                onClick={handlePrevDay}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="h-6 w-px bg-slate-200" />
              <button
                type="button"
                onClick={() => {
                  setSelectedDate(toDateKey(new Date()));
                  setCalendarOpen(false);
                }}
                className="px-4 py-2 font-medium"
              >
                I dag
              </button>
              <span className="h-6 w-px bg-slate-200" />
              <button
                type="button"
                onClick={handleToggleCalendar}
                aria-expanded={calendarOpen}
                className="flex items-center gap-2 px-4 py-2 font-medium"
              >
                {formatDisplayDate(selectedDate)}
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </button>
            </div>

            {calendarOpen && (
              <div className="absolute left-0 top-14 z-20 w-[360px] rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50"
                    aria-label="Forrige m\u00e5ned"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <div className="text-base font-semibold text-slate-900">
                    {calendarMonthLabel}
                  </div>
                  <button
                    type="button"
                    onClick={handleNextMonth}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50"
                    aria-label="N\u00e6ste m\u00e5ned"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-6 grid grid-cols-7 text-xs font-semibold text-slate-500">
                  {weekdayShortLabels.map((label) => (
                    <span key={label} className="text-center">
                      {label}
                    </span>
                  ))}
                </div>

                <div className="mt-4 grid grid-cols-7 gap-y-3 text-sm">
                  {calendarDays.map((day) => {
                    const dayKey = toDateKey(day.date);
                    const isSelected = dayKey === selectedDate;
                    return (
                      <button
                        key={dayKey}
                        type="button"
                        onClick={() => handleSelectDate(day.date)}
                        className={[
                          "flex h-10 w-10 items-center justify-center rounded-full",
                          isSelected
                            ? "bg-slate-900 text-white"
                            : day.inCurrentMonth
                            ? "text-slate-700 hover:bg-slate-100"
                            : "text-slate-300 hover:bg-slate-50",
                        ].join(" ")}
                      >
                        {day.date.getDate()}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {loading && (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-400">
            Henter daglige salg...
          </div>
        )}

        {!loading && error && (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-400">
            Kunne ikke hente daglige salg lige nu.
          </div>
        )}

        {!loading && !error && (
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">
                Oversigt over transaktioner
              </h2>
              <div className="mt-4 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="text-xs font-semibold text-slate-500">
                    <tr className="border-b border-slate-200">
                      <th className="py-2 text-left">Varetype</th>
                      <th className="py-2 text-right">Salgsantal</th>
                      <th className="py-2 text-right">Antal refusioner</th>
                      <th className="py-2 text-right">Brutto i alt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactionRows.map((row: any) => (
                      <tr
                        key={row.label}
                        className={
                          row.isTotal
                            ? "border-t border-slate-200 font-semibold text-slate-900"
                            : "border-b border-slate-100 text-slate-700"
                        }
                      >
                        <td className="py-2 pr-4">{row.label}</td>
                        <td className="py-2 text-right">{row.sales}</td>
                        <td className="py-2 text-right">{row.refunds}</td>
                        <td className="py-2 text-right">
                          {formatCurrency(row.total)} kr.
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">
                Oversigt over transaktioner
              </h2>
              <div className="mt-4 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="text-xs font-semibold text-slate-500">
                    <tr className="border-b border-slate-200">
                      <th className="py-2 text-left">Betalingstype</th>
                      <th className="py-2 text-right">Modtagne betalinger</th>
                      <th className="py-2 text-right">Betalte refusioner</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentData.rows.length === 0 && (
                      <tr>
                        <td className="py-4 text-sm text-slate-400" colSpan={3}>
                          Ingen betalinger for denne dato.
                        </td>
                      </tr>
                    )}
                    {paymentData.rows.map((row) => (
                      <tr
                        key={row.label}
                        className="border-b border-slate-100 text-slate-700"
                      >
                        <td className="py-2 pr-4">{row.label}</td>
                        <td className="py-2 text-right">
                          {formatCurrency(row.received)} kr.
                        </td>
                        <td className="py-2 text-right">
                          {formatCurrency(row.refunded)} kr.
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t border-slate-200 font-semibold text-slate-900">
                      <td className="py-2 pr-4">Modtagne betalinger</td>
                      <td className="py-2 text-right">
                        {formatCurrency(paymentData.totalReceived)} kr.
                      </td>
                      <td className="py-2 text-right">0,00 kr.</td>
                    </tr>
                    <tr className="border-t border-slate-200 font-semibold text-slate-900">
                      <td className="py-2 pr-4">Heraf drikkepenge</td>
                      <td className="py-2 text-right">0,00 kr.</td>
                      <td className="py-2 text-right">0,00 kr.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      <AddNowDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}
