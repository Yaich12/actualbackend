import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useAuth } from "../../../AuthContext";
import useAppointments from "../../../hooks/useAppointments";
import useSales from "../../../hooks/useSales";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("da-DK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);

const formatDateTime = (date: Date | null) => {
  if (!date) return "";
  const day = date.getDate();
  const month = date.toLocaleString("da-DK", { month: "short" });
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day} ${month} ${year}, ${hours}:${minutes}`;
};

const getSaleNumber = (sale: any) => {
  const ref = sale?.saleNumber || sale?.appointmentRef || sale?.id || "";
  return ref ? String(ref).replace(/^#/, "") : "";
};

const getItemSummary = (sale: any) => {
  const items = Array.isArray(sale.items) ? sale.items : [];
  if (!items.length) return "";
  const names = items.map((item: any) => item.name).filter(Boolean);
  const summary = names.slice(0, 2).join(", ");
  if (names.length > 2) {
    return `${summary} +${names.length - 2}`;
  }
  return summary;
};

type DateRange = {
  start: Date | null;
  end: Date | null;
};

type PaymentFilters = {
  location: string;
  employee: string;
  type: string;
  minAmount: string;
  maxAmount: string;
  vouchers: string;
  deposits: string;
};

const monthNames = [
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

const monthLongNames = [
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

const weekdayShortLabels = ["ma", "ti", "on", "to", "fr", "lø", "sø"];

const presetOptions = [
  { id: "custom", label: "Tilpasset" },
  { id: "today", label: "I dag" },
  { id: "yesterday", label: "I går" },
  { id: "last7", label: "Seneste 7 dage" },
  { id: "last30", label: "Seneste 30 dage" },
  { id: "last90", label: "Seneste 90 dage" },
  { id: "lastMonth", label: "Sidste måned" },
  { id: "lastYear", label: "Sidste år" },
  { id: "weekToDate", label: "Ugen til dato" },
  { id: "monthToDate", label: "Måned til dato" },
  { id: "quarterToDate", label: "Kvartal til dato" },
  { id: "yearToDate", label: "Året til dato" },
  { id: "tomorrow", label: "I morgen" },
  { id: "next7", label: "Næste 7 dage" },
  { id: "nextMonth", label: "Næste måned" },
  { id: "next30", label: "Næste 30 dage" },
  { id: "sinceStart", label: "Siden start" },
];

const defaultLocationFilter = "Alle placeringer";
const defaultEmployeeFilter = "Alle medarbejdere";
const defaultTypeFilter = "Alle typer";
const defaultVoucherFilter = "Ekskluder voucher redemptions";
const defaultDepositFilter = "Ekskluder deposit redemptions";

const voucherOptions = [defaultVoucherFilter, "Inkluder voucher redemptions"];
const depositOptions = [defaultDepositFilter, "Inkluder deposit redemptions"];

const appointmentStatusLabels: Record<string, string> = {
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

const weekdayLabels = [
  "mandag",
  "tirsdag",
  "onsdag",
  "torsdag",
  "fredag",
  "lørdag",
  "søndag",
];

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const startOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const endOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
};

const addDays = (date: Date, amount: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
};

const formatInputDate = (date: Date | null) => {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseInputDate = (value: string) => {
  if (!value) return null;
  const [year, month, day] = value.split("-").map((part) => Number(part));
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const formatRangeLabel = (range: DateRange) => {
  if (!range.start || !range.end) return "I dag";
  const today = toDateKey(new Date());
  const startKey = toDateKey(range.start);
  const endKey = toDateKey(range.end);
  const format = (date: Date) => {
    const day = date.getDate();
    const month = monthNames[date.getMonth()] || "";
    const year = date.getFullYear();
    return `${day} ${month}, ${year}`;
  };
  if (startKey === today && endKey === today) return "I dag";
  if (startKey === endKey) return format(range.start);
  return `${format(range.start)}–${format(range.end)}`;
};

const getCalendarDays = (monthDate: Date) => {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const startOfMonth = new Date(year, month, 1);
  const startWeekday = (startOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  return Array.from({ length: 42 }, (_, index) => {
    const dayOffset = index - startWeekday + 1;
    if (dayOffset < 1) {
      return {
        date: new Date(year, month - 1, daysInPrevMonth + dayOffset),
        inCurrentMonth: false,
      };
    }
    if (dayOffset > daysInMonth) {
      return {
        date: new Date(year, month, dayOffset),
        inCurrentMonth: false,
      };
    }
    return {
      date: new Date(year, month, dayOffset),
      inCurrentMonth: true,
    };
  });
};

const parseAmount = (value: string) => {
  const normalized = value.replace(",", ".").replace(/[^\d.]/g, "");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? null : parsed;
};

const parseDateString = (value?: string) => {
  if (!value) return null;
  const parts = value.split("-");
  if (parts.length !== 3) return null;
  const [day, month, year] = parts.map((part) => Number(part));
  if (!day || !month || !year) return null;
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const resolveAppointmentDateTime = (appointment: any) => {
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

const getAppointmentTimeRange = (appointment: any) => {
  const startTime = appointment?.startTime || "";
  const endTime = appointment?.endTime || "";
  if (!startTime) return "";
  if (endTime) return `${startTime} – ${endTime}`;
  const [hours, minutes] = startTime.split(":").map((part: string) => Number(part));
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return startTime;
  const nextHour = (hours + 1) % 24;
  return `${startTime} – ${String(nextHour).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

const getAppointmentStatusLabel = (status?: string) => {
  if (!status) return "Booket";
  return appointmentStatusLabels[status] || status;
};

const getSaleDate = (sale: any) => sale.completedAtDate || sale.createdAtDate || null;

const resolveSaleType = (sale: any) => {
  const items = Array.isArray(sale.items) ? sale.items : [];
  if (!items.length) return "Salg";
  let hasServices = false;
  let hasProducts = false;
  let hasGiftcards = false;
  items.forEach((item: any) => {
    const type = String(item.type || item.source || "").toLowerCase();
    if (type.includes("gift")) {
      hasGiftcards = true;
    } else if (type.includes("product")) {
      hasProducts = true;
    } else {
      hasServices = true;
    }
  });
  if (hasGiftcards && !hasServices && !hasProducts) return "Gavekort";
  if (hasProducts && !hasServices) return "Produkter";
  if (hasServices && !hasProducts && !hasGiftcards) return "Ydelser";
  return "Salg";
};

const formatDayHeading = (date: Date) => {
  const weekday = weekdayLabels[(date.getDay() + 6) % 7] || "";
  const day = date.getDate();
  const month = monthNames[date.getMonth()] || "";
  const year = date.getFullYear();
  return `${weekday} ${day} ${month} ${year}`;
};

export default function Payments() {
  const { user } = useAuth();
  const { sales, loading, error } = useSales(user?.uid || null, {
    status: "completed",
  });
  const {
    appointments,
    loading: appointmentsLoading,
    error: appointmentsError,
  } = useAppointments(user?.uid || null);
  const [searchTerm, setSearchTerm] = useState("");
  const rangePickerRef = useRef<HTMLDivElement | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start, end: now };
  });
  const [draftRange, setDraftRange] = useState<DateRange>(dateRange);
  const [rangePickerOpen, setRangePickerOpen] = useState(false);
  const [presetOpen, setPresetOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState("monthToDate");
  const [draftPreset, setDraftPreset] = useState("monthToDate");
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [filterOpen, setFilterOpen] = useState(false);
  const [locationMenuOpen, setLocationMenuOpen] = useState(false);
  const [employeeMenuOpen, setEmployeeMenuOpen] = useState(false);
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const [voucherMenuOpen, setVoucherMenuOpen] = useState(false);
  const [depositMenuOpen, setDepositMenuOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<PaymentFilters>({
    location: defaultLocationFilter,
    employee: defaultEmployeeFilter,
    type: defaultTypeFilter,
    minAmount: "",
    maxAmount: "",
    vouchers: defaultVoucherFilter,
    deposits: defaultDepositFilter,
  });
  const [draftFilters, setDraftFilters] = useState<PaymentFilters>(appliedFilters);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isDayDetailsOpen, setIsDayDetailsOpen] = useState(false);

  const earliestSaleDate = useMemo(() => {
    const dates = sales
      .map((sale: any) => getSaleDate(sale))
      .filter(Boolean) as Date[];
    if (!dates.length) return null;
    const earliestTime = Math.min(...dates.map((date) => date.getTime()));
    return new Date(earliestTime);
  }, [sales]);

  const locationOptions = useMemo(() => {
    const values = new Set<string>();
    sales.forEach((sale: any) => {
      if (sale.location) values.add(sale.location);
    });
    return [defaultLocationFilter, ...Array.from(values).sort((a, b) => a.localeCompare(b, "da-DK"))];
  }, [sales]);

  const employeeOptions = useMemo(() => {
    const values = new Set<string>();
    sales.forEach((sale: any) => {
      if (sale.employeeName) values.add(sale.employeeName);
    });
    return [defaultEmployeeFilter, ...Array.from(values).sort((a, b) => a.localeCompare(b, "da-DK"))];
  }, [sales]);

  const typeOptions = useMemo(() => {
    const base = [defaultTypeFilter, "Salg", "Ydelser", "Produkter", "Gavekort"];
    const values = new Set<string>();
    sales.forEach((sale: any) => values.add(resolveSaleType(sale)));
    values.forEach((value) => {
      if (!base.includes(value)) base.push(value);
    });
    return base;
  }, [sales]);

  const hasActiveFilters =
    appliedFilters.location !== defaultLocationFilter ||
    appliedFilters.employee !== defaultEmployeeFilter ||
    appliedFilters.type !== defaultTypeFilter ||
    appliedFilters.minAmount.trim() !== "" ||
    appliedFilters.maxAmount.trim() !== "" ||
    appliedFilters.vouchers !== defaultVoucherFilter ||
    appliedFilters.deposits !== defaultDepositFilter;

  const resolvePresetRange = (presetId: string): DateRange => {
    const today = new Date();
    const todayStart = startOfDay(today);
    switch (presetId) {
      case "today":
        return { start: todayStart, end: endOfDay(todayStart) };
      case "yesterday": {
        const yesterday = addDays(todayStart, -1);
        return { start: yesterday, end: endOfDay(yesterday) };
      }
      case "last7": {
        const start = addDays(todayStart, -6);
        return { start, end: endOfDay(todayStart) };
      }
      case "last30": {
        const start = addDays(todayStart, -29);
        return { start, end: endOfDay(todayStart) };
      }
      case "last90": {
        const start = addDays(todayStart, -89);
        return { start, end: endOfDay(todayStart) };
      }
      case "lastMonth": {
        const start = new Date(todayStart.getFullYear(), todayStart.getMonth() - 1, 1);
        const end = new Date(todayStart.getFullYear(), todayStart.getMonth(), 0);
        return { start, end: endOfDay(end) };
      }
      case "lastYear": {
        const start = new Date(todayStart.getFullYear() - 1, 0, 1);
        const end = new Date(todayStart.getFullYear() - 1, 11, 31);
        return { start, end: endOfDay(end) };
      }
      case "weekToDate": {
        const weekdayIndex = (todayStart.getDay() + 6) % 7;
        const start = addDays(todayStart, -weekdayIndex);
        return { start, end: endOfDay(todayStart) };
      }
      case "monthToDate": {
        const start = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
        return { start, end: endOfDay(todayStart) };
      }
      case "quarterToDate": {
        const quarter = Math.floor(todayStart.getMonth() / 3);
        const start = new Date(todayStart.getFullYear(), quarter * 3, 1);
        return { start, end: endOfDay(todayStart) };
      }
      case "yearToDate": {
        const start = new Date(todayStart.getFullYear(), 0, 1);
        return { start, end: endOfDay(todayStart) };
      }
      case "tomorrow": {
        const next = addDays(todayStart, 1);
        return { start: next, end: endOfDay(next) };
      }
      case "next7": {
        const start = addDays(todayStart, 1);
        const end = addDays(start, 6);
        return { start, end: endOfDay(end) };
      }
      case "nextMonth": {
        const start = new Date(todayStart.getFullYear(), todayStart.getMonth() + 1, 1);
        const end = new Date(todayStart.getFullYear(), todayStart.getMonth() + 2, 0);
        return { start, end: endOfDay(end) };
      }
      case "next30": {
        const start = addDays(todayStart, 1);
        const end = addDays(start, 29);
        return { start, end: endOfDay(end) };
      }
      case "sinceStart": {
        const start = earliestSaleDate
          ? startOfDay(earliestSaleDate)
          : new Date(todayStart.getFullYear(), 0, 1);
        return { start, end: endOfDay(todayStart) };
      }
      case "custom":
      default:
        return { ...draftRange };
    }
  };

  const handleOpenRangePicker = () => {
    setDraftRange(dateRange);
    setDraftPreset(selectedPreset);
    if (dateRange.start) {
      setCalendarMonth(new Date(dateRange.start.getFullYear(), dateRange.start.getMonth(), 1));
    }
    setRangePickerOpen(true);
    setFilterOpen(false);
  };

  const handleCloseRangePicker = () => {
    setRangePickerOpen(false);
    setPresetOpen(false);
    setDraftRange(dateRange);
    setDraftPreset(selectedPreset);
  };

  const handleApplyRange = () => {
    let nextStart = draftRange.start;
    let nextEnd = draftRange.end;
    if (nextStart && !nextEnd) nextEnd = nextStart;
    if (!nextStart && nextEnd) nextStart = nextEnd;
    if (nextStart && nextEnd && nextEnd < nextStart) {
      const temp = nextStart;
      nextStart = nextEnd;
      nextEnd = temp;
    }
    if (nextStart && nextEnd) {
      setDateRange({ start: startOfDay(nextStart), end: endOfDay(nextEnd) });
      setSelectedPreset(draftPreset);
    }
    setRangePickerOpen(false);
    setPresetOpen(false);
  };

  const handleSelectPreset = (presetId: string) => {
    setDraftPreset(presetId);
    setPresetOpen(false);
    if (presetId === "custom") return;
    const range = resolvePresetRange(presetId);
    setDraftRange(range);
    if (range.start) {
      setCalendarMonth(new Date(range.start.getFullYear(), range.start.getMonth(), 1));
    }
  };

  const handleSelectDate = (date: Date) => {
    if (!draftRange.start || (draftRange.start && draftRange.end)) {
      setDraftRange({ start: date, end: null });
      setDraftPreset("custom");
      return;
    }
    if (draftRange.start && !draftRange.end) {
      if (date < draftRange.start) {
        setDraftRange({ start: date, end: draftRange.start });
      } else {
        setDraftRange({ start: draftRange.start, end: date });
      }
      setDraftPreset("custom");
    }
  };

  const handlePrevMonth = () => {
    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleOpenFilters = () => {
    setDraftFilters({ ...appliedFilters });
    setLocationMenuOpen(false);
    setEmployeeMenuOpen(false);
    setTypeMenuOpen(false);
    setVoucherMenuOpen(false);
    setDepositMenuOpen(false);
    setFilterOpen(true);
    setRangePickerOpen(false);
    setPresetOpen(false);
  };

  const handleCloseFilters = () => {
    setFilterOpen(false);
    setLocationMenuOpen(false);
    setEmployeeMenuOpen(false);
    setTypeMenuOpen(false);
    setVoucherMenuOpen(false);
    setDepositMenuOpen(false);
  };

  const handleApplyFilters = () => {
    setAppliedFilters({ ...draftFilters });
    handleCloseFilters();
  };

  const handleClearFilters = () => {
    const cleared = {
      location: defaultLocationFilter,
      employee: defaultEmployeeFilter,
      type: defaultTypeFilter,
      minAmount: "",
      maxAmount: "",
      vouchers: defaultVoucherFilter,
      deposits: defaultDepositFilter,
    };
    setAppliedFilters(cleared);
    setDraftFilters(cleared);
    setLocationMenuOpen(false);
    setEmployeeMenuOpen(false);
    setTypeMenuOpen(false);
    setVoucherMenuOpen(false);
    setDepositMenuOpen(false);
  };

  const handleOpenDayDetails = (date: Date | null) => {
    if (!date) return;
    setSelectedDate(startOfDay(date));
    setIsDayDetailsOpen(true);
    setFilterOpen(false);
    setRangePickerOpen(false);
  };

  const handleCloseDayDetails = () => {
    setIsDayDetailsOpen(false);
  };

  useEffect(() => {
    if (!rangePickerOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (!rangePickerRef.current) return;
      if (!rangePickerRef.current.contains(event.target as Node)) {
        handleCloseRangePicker();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [rangePickerOpen]);

  useEffect(() => {
    if (!filterOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleCloseFilters();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filterOpen]);

  useEffect(() => {
    if (!isDayDetailsOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleCloseDayDetails();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDayDetailsOpen]);

  const searchedSales = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return sales;
    return sales.filter((sale: any) => {
      const candidates = [
        getSaleNumber(sale),
        sale.customerName || "",
        sale.customerEmail || "",
        sale.employeeName || "",
        sale.paymentMethod || "",
      ];
      return candidates.some((value) =>
        String(value).toLowerCase().includes(query)
      );
    });
  }, [sales, searchTerm]);

  const dateFilteredSales = useMemo(() => {
    const start = dateRange.start ? startOfDay(dateRange.start) : null;
    const end = dateRange.end ? endOfDay(dateRange.end) : null;
    if (!start || !end) return searchedSales;
    return searchedSales.filter((sale: any) => {
      const saleDate = getSaleDate(sale);
      if (!saleDate) return false;
      return saleDate >= start && saleDate <= end;
    });
  }, [dateRange, searchedSales]);

  const filteredSales = useMemo(() => {
    const minAmount = parseAmount(appliedFilters.minAmount);
    const maxAmount = parseAmount(appliedFilters.maxAmount);
    return dateFilteredSales.filter((sale: any) => {
      if (appliedFilters.location !== defaultLocationFilter) {
        if ((sale.location || "") !== appliedFilters.location) return false;
      }
      if (appliedFilters.employee !== defaultEmployeeFilter) {
        if ((sale.employeeName || "") !== appliedFilters.employee) return false;
      }
      if (appliedFilters.type !== defaultTypeFilter) {
        const typeLabel = resolveSaleType(sale);
        if (typeLabel !== appliedFilters.type) return false;
      }
      const total = sale.totals?.total ?? 0;
      if (minAmount !== null && total < minAmount) return false;
      if (maxAmount !== null && total > maxAmount) return false;
      return true;
    });
  }, [appliedFilters, dateFilteredSales]);

  const selectedDateKey = selectedDate ? toDateKey(selectedDate) : null;

  const appointmentsForDate = useMemo(() => {
    if (!selectedDateKey) return [];
    return appointments.filter((appointment: any) => {
      const date = resolveAppointmentDateTime(appointment);
      if (!date) return false;
      return toDateKey(date) === selectedDateKey;
    });
  }, [appointments, selectedDateKey]);

  const salesForDate = useMemo(() => {
    if (!selectedDateKey) return [];
    return sales.filter((sale: any) => {
      const date = getSaleDate(sale);
      if (!date) return false;
      return toDateKey(date) === selectedDateKey;
    });
  }, [sales, selectedDateKey]);

  const sortedAppointmentsForDate = useMemo(() => {
    return [...appointmentsForDate].sort((a: any, b: any) => {
      const left = resolveAppointmentDateTime(a)?.getTime() ?? 0;
      const right = resolveAppointmentDateTime(b)?.getTime() ?? 0;
      return left - right;
    });
  }, [appointmentsForDate]);

  const sortedSalesForDate = useMemo(() => {
    return [...salesForDate].sort((a: any, b: any) => {
      const left = getSaleDate(a)?.getTime() ?? 0;
      const right = getSaleDate(b)?.getTime() ?? 0;
      return left - right;
    });
  }, [salesForDate]);

  const dayMetrics = useMemo(() => {
    const totalRevenue = salesForDate.reduce(
      (sum: number, sale: any) => sum + (sale.totals?.total ?? 0),
      0
    );
    return {
      totalRevenue,
      appointmentCount: appointmentsForDate.length,
      salesCount: salesForDate.length,
    };
  }, [appointmentsForDate, salesForDate]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 bg-white px-8 pb-6 pt-8">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Betalingstransaktioner
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Se, filtrer og eksportér din betalingshistorik.
          </p>
        </div>
        <button type="button" className="toolbar-pill">
          Muligheder
          <ChevronDown className="toolbar-caret" />
        </button>
      </div>

      <div className="flex-1 overflow-auto bg-slate-50 px-8 pb-10">
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-full bg-slate-50 px-2 py-2">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Søg efter salg eller kunde"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="w-48 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
              />
            </label>
            <div className="relative" ref={rangePickerRef}>
              <button
                type="button"
                onClick={() =>
                  rangePickerOpen ? handleCloseRangePicker() : handleOpenRangePicker()
                }
                className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm"
              >
                {formatRangeLabel(dateRange)}
                <Calendar className="h-4 w-4 text-slate-400" />
              </button>

              {rangePickerOpen && (
                <div className="absolute left-0 top-12 z-30 w-[640px] rounded-2xl border border-slate-200 bg-white shadow-xl">
                  <div className="px-5 pt-5">
                    <p className="text-sm font-semibold text-slate-900">Datointerval</p>
                    <div className="relative mt-2">
                      <button
                        type="button"
                        onClick={() => setPresetOpen((prev) => !prev)}
                        className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700"
                        aria-expanded={presetOpen}
                      >
                        {presetOptions.find((preset) => preset.id === draftPreset)?.label ||
                          "Tilpasset"}
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      </button>

                      {presetOpen && (
                        <div className="absolute left-0 top-full z-40 mt-2 max-h-72 w-full overflow-auto rounded-2xl border border-slate-200 bg-white py-2 shadow-2xl">
                          {presetOptions.map((preset) => (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => handleSelectPreset(preset.id)}
                              className={`flex w-full items-center px-4 py-2 text-left text-sm ${
                                preset.id === draftPreset
                                  ? "bg-blue-100 text-blue-700"
                                  : "text-slate-700 hover:bg-slate-50"
                              }`}
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-4">
                      <label className="text-xs font-semibold text-slate-500">
                        Starter
                        <input
                          type="date"
                          value={formatInputDate(draftRange.start)}
                          onChange={(event) => {
                            const next = parseInputDate(event.target.value);
                            setDraftRange((prev) => ({ ...prev, start: next }));
                            setDraftPreset("custom");
                          }}
                          className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700"
                        />
                      </label>
                      <label className="text-xs font-semibold text-slate-500">
                        Slutter
                        <input
                          type="date"
                          value={formatInputDate(draftRange.end)}
                          onChange={(event) => {
                            const next = parseInputDate(event.target.value);
                            setDraftRange((prev) => ({ ...prev, end: next }));
                            setDraftPreset("custom");
                          }}
                          className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="mt-5 border-t border-slate-200 px-5 pb-5 pt-4">
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <div className="flex items-center justify-between">
                          <button
                            type="button"
                            onClick={handlePrevMonth}
                            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50"
                            aria-label="Forrige måned"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </button>
                          <p className="text-sm font-semibold text-slate-900">
                            {monthLongNames[calendarMonth.getMonth()]}
                          </p>
                          <div className="h-8 w-8" />
                        </div>
                        <div className="mt-4 grid grid-cols-7 text-xs font-semibold text-slate-500">
                          {weekdayShortLabels.map((label) => (
                            <span key={`left-${label}`} className="text-center">
                              {label}
                            </span>
                          ))}
                        </div>
                        <div className="mt-2 grid grid-cols-7 gap-y-2 text-sm">
                          {getCalendarDays(calendarMonth).map((day) => {
                            const dayKey = toDateKey(day.date);
                            const startKey = draftRange.start ? toDateKey(draftRange.start) : "";
                            const endKey = draftRange.end ? toDateKey(draftRange.end) : "";
                            const inRange =
                              draftRange.start &&
                              draftRange.end &&
                              day.date >= startOfDay(draftRange.start) &&
                              day.date <= endOfDay(draftRange.end);
                            const isStart = startKey && dayKey === startKey;
                            const isEnd = endKey && dayKey === endKey;
                            return (
                              <button
                                key={`left-${dayKey}`}
                                type="button"
                                onClick={() => handleSelectDate(day.date)}
                                className={[
                                  "flex h-9 w-9 items-center justify-center rounded-full text-sm",
                                  isStart || isEnd
                                    ? "bg-slate-900 text-white"
                                    : inRange
                                    ? "bg-slate-100 text-slate-700"
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

                      <div>
                        <div className="flex items-center justify-between">
                          <div className="h-8 w-8" />
                          <p className="text-sm font-semibold text-slate-900">
                            {monthLongNames[(calendarMonth.getMonth() + 1) % 12]}
                          </p>
                          <button
                            type="button"
                            onClick={handleNextMonth}
                            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50"
                            aria-label="Næste måned"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="mt-4 grid grid-cols-7 text-xs font-semibold text-slate-500">
                          {weekdayShortLabels.map((label) => (
                            <span key={`right-${label}`} className="text-center">
                              {label}
                            </span>
                          ))}
                        </div>
                        <div className="mt-2 grid grid-cols-7 gap-y-2 text-sm">
                          {getCalendarDays(
                            new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1)
                          ).map((day) => {
                            const dayKey = toDateKey(day.date);
                            const startKey = draftRange.start ? toDateKey(draftRange.start) : "";
                            const endKey = draftRange.end ? toDateKey(draftRange.end) : "";
                            const inRange =
                              draftRange.start &&
                              draftRange.end &&
                              day.date >= startOfDay(draftRange.start) &&
                              day.date <= endOfDay(draftRange.end);
                            const isStart = startKey && dayKey === startKey;
                            const isEnd = endKey && dayKey === endKey;
                            return (
                              <button
                                key={`right-${dayKey}`}
                                type="button"
                                onClick={() => handleSelectDate(day.date)}
                                className={[
                                  "flex h-9 w-9 items-center justify-center rounded-full text-sm",
                                  isStart || isEnd
                                    ? "bg-slate-900 text-white"
                                    : inRange
                                    ? "bg-slate-100 text-slate-700"
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
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-5 py-4">
                    <button
                      type="button"
                      onClick={handleCloseRangePicker}
                      className="rounded-full px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Annuller
                    </button>
                    <button
                      type="button"
                      onClick={handleApplyRange}
                      className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white"
                    >
                      Godkend
                    </button>
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={handleOpenFilters}
              className={`flex items-center gap-2 rounded-full border bg-white px-4 py-2 text-sm font-medium shadow-sm ${
                hasActiveFilters
                  ? "border-indigo-500 text-indigo-600"
                  : "border-slate-200 text-slate-700"
              }`}
            >
              Filtre
              <SlidersHorizontal className="h-4 w-4" />
            </button>
          </div>
        </div>

        {filterOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/30" onClick={handleCloseFilters} />
            <div className="relative w-full max-w-[640px] rounded-2xl bg-white px-8 py-6 shadow-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Filtre</h2>
                <button
                  type="button"
                  onClick={handleCloseFilters}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50"
                  aria-label="Luk filtre"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-6 space-y-5">
                <div className="relative">
                  <p className="text-sm font-semibold text-slate-700">Placering</p>
                  <button
                    type="button"
                    onClick={() => {
                      setLocationMenuOpen((prev) => !prev);
                      setEmployeeMenuOpen(false);
                      setTypeMenuOpen(false);
                      setVoucherMenuOpen(false);
                      setDepositMenuOpen(false);
                    }}
                    className="mt-2 flex w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700"
                  >
                    {draftFilters.location}
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  </button>
                  {locationMenuOpen && (
                    <div className="absolute left-0 right-0 top-full z-10 mt-2 max-h-64 overflow-auto rounded-2xl border border-slate-200 bg-white py-2 shadow-xl">
                      {locationOptions.map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => {
                            setDraftFilters((prev) => ({ ...prev, location: option }));
                            setLocationMenuOpen(false);
                          }}
                          className={`flex w-full items-center justify-between px-4 py-2 text-sm ${
                            option === draftFilters.location
                              ? "bg-indigo-50 text-indigo-600"
                              : "text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <span>{option}</span>
                          {option === draftFilters.location && <Check className="h-4 w-4" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="relative">
                  <p className="text-sm font-semibold text-slate-700">Medarbejder</p>
                  <button
                    type="button"
                    onClick={() => {
                      setEmployeeMenuOpen((prev) => !prev);
                      setLocationMenuOpen(false);
                      setTypeMenuOpen(false);
                      setVoucherMenuOpen(false);
                      setDepositMenuOpen(false);
                    }}
                    className="mt-2 flex w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700"
                  >
                    {draftFilters.employee}
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  </button>
                  {employeeMenuOpen && (
                    <div className="absolute left-0 right-0 top-full z-10 mt-2 max-h-64 overflow-auto rounded-2xl border border-slate-200 bg-white py-2 shadow-xl">
                      {employeeOptions.map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => {
                            setDraftFilters((prev) => ({ ...prev, employee: option }));
                            setEmployeeMenuOpen(false);
                          }}
                          className={`flex w-full items-center justify-between px-4 py-2 text-sm ${
                            option === draftFilters.employee
                              ? "bg-indigo-50 text-indigo-600"
                              : "text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <span>{option}</span>
                          {option === draftFilters.employee && <Check className="h-4 w-4" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="relative">
                  <p className="text-sm font-semibold text-slate-700">Type</p>
                  <button
                    type="button"
                    onClick={() => {
                      setTypeMenuOpen((prev) => !prev);
                      setLocationMenuOpen(false);
                      setEmployeeMenuOpen(false);
                      setVoucherMenuOpen(false);
                      setDepositMenuOpen(false);
                    }}
                    className="mt-2 flex w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700"
                  >
                    {draftFilters.type}
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  </button>
                  {typeMenuOpen && (
                    <div className="absolute left-0 right-0 top-full z-10 mt-2 max-h-64 overflow-auto rounded-2xl border border-slate-200 bg-white py-2 shadow-xl">
                      {typeOptions.map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => {
                            setDraftFilters((prev) => ({ ...prev, type: option }));
                            setTypeMenuOpen(false);
                          }}
                          className={`flex w-full items-center justify-between px-4 py-2 text-sm ${
                            option === draftFilters.type
                              ? "bg-indigo-50 text-indigo-600"
                              : "text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <span>{option}</span>
                          {option === draftFilters.type && <Check className="h-4 w-4" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Fra-beløb</p>
                    <div className="mt-2 flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">
                      <span className="text-slate-400">DKK</span>
                      <input
                        type="text"
                        value={draftFilters.minAmount}
                        onChange={(event) =>
                          setDraftFilters((prev) => ({ ...prev, minAmount: event.target.value }))
                        }
                        placeholder="0"
                        className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Til-beløb</p>
                    <div className="mt-2 flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">
                      <span className="text-slate-400">DKK</span>
                      <input
                        type="text"
                        value={draftFilters.maxAmount}
                        onChange={(event) =>
                          setDraftFilters((prev) => ({ ...prev, maxAmount: event.target.value }))
                        }
                        placeholder="0"
                        className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="relative">
                  <p className="text-sm font-semibold text-slate-700">Rabatkuponer</p>
                  <button
                    type="button"
                    onClick={() => {
                      setVoucherMenuOpen((prev) => !prev);
                      setLocationMenuOpen(false);
                      setEmployeeMenuOpen(false);
                      setTypeMenuOpen(false);
                      setDepositMenuOpen(false);
                    }}
                    className="mt-2 flex w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700"
                  >
                    {draftFilters.vouchers}
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  </button>
                  {voucherMenuOpen && (
                    <div className="absolute left-0 right-0 top-full z-10 mt-2 max-h-64 overflow-auto rounded-2xl border border-slate-200 bg-white py-2 shadow-xl">
                      {voucherOptions.map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => {
                            setDraftFilters((prev) => ({ ...prev, vouchers: option }));
                            setVoucherMenuOpen(false);
                          }}
                          className={`flex w-full items-center justify-between px-4 py-2 text-sm ${
                            option === draftFilters.vouchers
                              ? "bg-indigo-50 text-indigo-600"
                              : "text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <span>{option}</span>
                          {option === draftFilters.vouchers && <Check className="h-4 w-4" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="relative">
                  <p className="text-sm font-semibold text-slate-700">Depositummer</p>
                  <button
                    type="button"
                    onClick={() => {
                      setDepositMenuOpen((prev) => !prev);
                      setLocationMenuOpen(false);
                      setEmployeeMenuOpen(false);
                      setTypeMenuOpen(false);
                      setVoucherMenuOpen(false);
                    }}
                    className="mt-2 flex w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700"
                  >
                    {draftFilters.deposits}
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  </button>
                  {depositMenuOpen && (
                    <div className="absolute left-0 right-0 top-full z-10 mt-2 max-h-64 overflow-auto rounded-2xl border border-slate-200 bg-white py-2 shadow-xl">
                      {depositOptions.map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => {
                            setDraftFilters((prev) => ({ ...prev, deposits: option }));
                            setDepositMenuOpen(false);
                          }}
                          className={`flex w-full items-center justify-between px-4 py-2 text-sm ${
                            option === draftFilters.deposits
                              ? "bg-indigo-50 text-indigo-600"
                              : "text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <span>{option}</span>
                          {option === draftFilters.deposits && <Check className="h-4 w-4" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                >
                  Ryd filtre
                </button>
                <button
                  type="button"
                  onClick={handleApplyFilters}
                  className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white"
                >
                  Godkend
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-[1000px] w-full text-sm">
              <thead className="text-xs font-semibold text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-3 text-left">
                    <span className="inline-flex items-center gap-1">
                      Betalingsdato
                      <ArrowDown className="h-3 w-3" />
                    </span>
                  </th>
                  <th className="px-4 py-3 text-left">Placering</th>
                  <th className="px-4 py-3 text-left">Ref nr</th>
                  <th className="px-4 py-3 text-left">Kunde</th>
                  <th className="px-4 py-3 text-left">Medarbejder</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Metode</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-100 bg-slate-50 text-slate-600">
                  <td className="px-4 py-3 font-semibold">I alt</td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3" />
                </tr>

                {loading && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-xs text-slate-400"
                    >
                      Henter betalinger...
                    </td>
                  </tr>
                )}

                {!loading && error && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-xs text-slate-400"
                    >
                      Kunne ikke hente betalinger lige nu.
                    </td>
                  </tr>
                )}

                {!loading && !error && filteredSales.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-xs text-slate-400"
                    >
                      Ingen gennemførte betalinger endnu.
                    </td>
                  </tr>
                )}

                {!loading &&
                  !error &&
                  filteredSales.map((sale: any) => {
                    const saleDate = getSaleDate(sale);
                    const dateLabel = saleDate ? formatDateTime(saleDate) : "";
                    const saleNumber = getSaleNumber(sale) || "—";
                    const customerName =
                      sale.customerName || sale.customerEmail || "—";
                    const itemSummary = getItemSummary(sale);
                    const total = formatCurrency(sale.totals?.total ?? 0);
                    const location = sale.location || "—";
                    const employeeName = sale.employeeName || "—";
                    const paymentMethod = sale.paymentMethod || "—";
                    const typeLabel = resolveSaleType(sale);

                    return (
                      <tr key={sale.id} className="border-b border-slate-100">
                        <td className="px-4 py-3">
                          {saleDate ? (
                            <button
                              type="button"
                              onClick={() => handleOpenDayDetails(saleDate)}
                              className="text-left text-slate-700 hover:text-indigo-600"
                            >
                              {dateLabel}
                            </button>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-700">{location}</td>
                        <td className="px-4 py-3 text-indigo-500">{saleNumber}</td>
                        <td className="px-4 py-3">
                          <div className="text-slate-700">{customerName}</div>
                          {itemSummary && (
                            <div className="text-xs text-slate-400">
                              {itemSummary} • {total} kr.
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-700">{employeeName}</td>
                        <td className="px-4 py-3 text-slate-700">{typeLabel}</td>
                        <td className="px-4 py-3 text-slate-700">{paymentMethod}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-100 py-4 text-center text-xs text-slate-400">
            Viser {filteredSales.length} af {sales.length} resultater
          </div>
        </div>
      </div>

      <div
        className={`fixed inset-0 z-50 flex ${
          isDayDetailsOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
        aria-hidden={!isDayDetailsOpen}
      >
        <div
          className={`absolute inset-0 bg-black/30 transition-opacity duration-200 ${
            isDayDetailsOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={handleCloseDayDetails}
        />
        <div
          className={`absolute right-0 top-0 h-full w-full max-w-[720px] bg-white shadow-2xl transition-transform duration-300 ${
            isDayDetailsOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 pb-4 pt-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Dagsdetaljer
                </p>
                <h2 className="mt-2 text-xl font-semibold text-slate-900">
                  {selectedDate ? formatDayHeading(selectedDate) : ""}
                </h2>
              </div>
              <button
                type="button"
                onClick={handleCloseDayDetails}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50"
                aria-label="Luk dagsdetaljer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-auto px-6 pb-6 pt-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs text-slate-500">Omsætning</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {formatCurrency(dayMetrics.totalRevenue)} kr.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs text-slate-500">Aftaler</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {dayMetrics.appointmentCount}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs text-slate-500">Salg</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {dayMetrics.salesCount}
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900">Aftaler</h3>
                  <span className="text-xs text-slate-400">
                    {sortedAppointmentsForDate.length} aftaler
                  </span>
                </div>
                <div className="mt-3 space-y-3">
                  {appointmentsLoading && (
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-400">
                      Henter aftaler...
                    </div>
                  )}
                  {!appointmentsLoading && appointmentsError && (
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-400">
                      Kunne ikke hente aftaler.
                    </div>
                  )}
                  {!appointmentsLoading &&
                    !appointmentsError &&
                    sortedAppointmentsForDate.length === 0 && (
                      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-400">
                        Ingen aftaler på denne dag.
                      </div>
                    )}
                  {!appointmentsLoading &&
                    !appointmentsError &&
                    sortedAppointmentsForDate.map((appointment: any) => {
                      const timeRange = getAppointmentTimeRange(appointment);
                      const clientName =
                        appointment.client || appointment.clientEmail || "Ukendt kunde";
                      const serviceName = appointment.service || appointment.title || "Aftale";
                      const ownerLabel = appointment.calendarOwner || "fælles konto";
                      const statusLabel = getAppointmentStatusLabel(appointment.status);
                      const priceLabel = formatCurrency(
                        typeof appointment.servicePrice === "number"
                          ? appointment.servicePrice
                          : typeof appointment.servicePriceInclVat === "number"
                          ? appointment.servicePriceInclVat
                          : 0
                      );

                      return (
                        <div
                          key={appointment.id}
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">
                                {clientName}
                              </p>
                              <p className="text-xs text-slate-400">
                                {serviceName}
                                {timeRange ? ` • ${timeRange}` : ""}
                              </p>
                            </div>
                            <div className="text-sm font-semibold text-slate-900">
                              {priceLabel} kr.
                            </div>
                          </div>
                          <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                            <span>{ownerLabel}</span>
                            <span>•</span>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                              {statusLabel}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              <div className="mt-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900">Salg</h3>
                  <span className="text-xs text-slate-400">
                    {sortedSalesForDate.length} salg
                  </span>
                </div>
                <div className="mt-3 space-y-3">
                  {loading && (
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-400">
                      Henter salg...
                    </div>
                  )}
                  {!loading && error && (
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-400">
                      Kunne ikke hente salg.
                    </div>
                  )}
                  {!loading &&
                    !error &&
                    sortedSalesForDate.length === 0 && (
                      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-400">
                        Ingen salg på denne dag.
                      </div>
                    )}
                  {!loading &&
                    !error &&
                    sortedSalesForDate.map((sale: any) => {
                      const saleTotal = formatCurrency(sale.totals?.total ?? 0);
                      const saleNumber = getSaleNumber(sale) || sale.id;
                      const customerName =
                        sale.customerName || sale.customerEmail || "Ukendt kunde";
                      const methodLabel = sale.paymentMethod || "Andet";
                      const itemSummary = getItemSummary(sale);
                      const timeLabel = sale.completedAtDate
                        ? formatDateTime(sale.completedAtDate)
                        : "";

                      return (
                        <div
                          key={sale.id}
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">
                                Salg #{saleNumber}
                              </p>
                              <p className="text-xs text-slate-400">
                                {customerName} • {methodLabel}
                              </p>
                            </div>
                            <div className="text-sm font-semibold text-slate-900">
                              {saleTotal} kr.
                            </div>
                          </div>
                          <div className="mt-2 text-xs text-slate-400">
                            {itemSummary}
                            {itemSummary && timeLabel ? " • " : ""}
                            {timeLabel}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
