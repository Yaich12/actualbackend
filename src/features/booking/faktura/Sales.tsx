import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpDown,
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
import useSales from "../../../hooks/useSales";
import AddNowDrawer from "./AddNowDrawer";

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

type DateRange = {
  start: Date | null;
  end: Date | null;
};

type SalesFilters = {
  status: string;
  minAmount: string;
  maxAmount: string;
  itemType: string;
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

const defaultStatusFilter = "Alle statuser";
const defaultItemFilter = "Vælg artikeltype";

const statusOptions = [
  defaultStatusFilter,
  "Gennemført",
  "Afventer",
  "Annulleret",
  "Refunderet",
];

const itemTypeOptions = [
  defaultItemFilter,
  "Ydelser",
  "Produkter",
  "Gavekort",
  "Medlemskaber",
];

const sortOptions = [
  { id: "saleNumberDesc", label: "Udsalg # (Å-A)" },
  { id: "saleNumberAsc", label: "Udsalg # (A-Å)" },
  { id: "customerDesc", label: "Kunde (Å-A)" },
  { id: "customerAsc", label: "Kunde (A-Å)" },
  { id: "dateDesc", label: "Salgsdato (nyeste først)" },
  { id: "dateAsc", label: "Salgsdato (ældste først)" },
  { id: "locationDesc", label: "Lokation (Å-A)" },
  { id: "locationAsc", label: "Lokation (A-Å)" },
  { id: "tipsDesc", label: "Drikkepenge (højeste først)" },
  { id: "tipsAsc", label: "Drikkepenge (laveste først)" },
  { id: "totalDesc", label: "Brutto i alt (højeste først)" },
  { id: "totalAsc", label: "Brutto i alt (laveste først)" },
];

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

const getSaleStatusLabel = (status: any) => {
  if (!status) return "Gennemført";
  const normalized = String(status).toLowerCase();
  if (normalized === "completed") return "Gennemført";
  if (normalized === "pending") return "Afventer";
  if (normalized === "cancelled") return "Annulleret";
  if (normalized === "refunded") return "Refunderet";
  return String(status);
};

export default function Sales() {
  const { user } = useAuth();
  const { sales, loading, error } = useSales(user?.uid || null, {
    status: "completed",
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const rangePickerRef = useRef<HTMLDivElement | null>(null);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const today = new Date();
    return { start: today, end: today };
  });
  const [draftRange, setDraftRange] = useState<DateRange>(dateRange);
  const [rangePickerOpen, setRangePickerOpen] = useState(false);
  const [presetOpen, setPresetOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState("today");
  const [draftPreset, setDraftPreset] = useState("today");
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [filterOpen, setFilterOpen] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [itemMenuOpen, setItemMenuOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<SalesFilters>({
    status: defaultStatusFilter,
    minAmount: "",
    maxAmount: "",
    itemType: defaultItemFilter,
  });
  const [draftFilters, setDraftFilters] = useState<SalesFilters>(appliedFilters);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [selectedSortId, setSelectedSortId] = useState("dateDesc");

  const earliestSaleDate = useMemo(() => {
    const dates = sales
      .map((sale: any) => sale.completedAtDate || sale.createdAtDate)
      .filter(Boolean) as Date[];
    if (!dates.length) return null;
    const earliestTime = Math.min(...dates.map((date) => date.getTime()));
    return new Date(earliestTime);
  }, [sales]);

  const hasActiveFilters =
    appliedFilters.status !== defaultStatusFilter ||
    appliedFilters.itemType !== defaultItemFilter ||
    appliedFilters.minAmount.trim() !== "" ||
    appliedFilters.maxAmount.trim() !== "";

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
    setSortMenuOpen(false);
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
    setStatusMenuOpen(false);
    setItemMenuOpen(false);
    setFilterOpen(true);
    setRangePickerOpen(false);
    setPresetOpen(false);
    setSortMenuOpen(false);
  };

  const handleCloseFilters = () => {
    setFilterOpen(false);
    setStatusMenuOpen(false);
    setItemMenuOpen(false);
  };

  const handleApplyFilters = () => {
    setAppliedFilters({ ...draftFilters });
    handleCloseFilters();
  };

  const handleClearFilters = () => {
    const cleared = {
      status: defaultStatusFilter,
      minAmount: "",
      maxAmount: "",
      itemType: defaultItemFilter,
    };
    setAppliedFilters(cleared);
    setDraftFilters(cleared);
    setStatusMenuOpen(false);
    setItemMenuOpen(false);
  };

  const handleToggleSortMenu = () => {
    setSortMenuOpen((prev) => !prev);
    setRangePickerOpen(false);
    setPresetOpen(false);
    setFilterOpen(false);
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
    if (!sortMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (!sortMenuRef.current) return;
      if (!sortMenuRef.current.contains(event.target as Node)) {
        setSortMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [sortMenuOpen]);

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

  const searchedSales = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return sales;
    return sales.filter((sale: any) => {
      const candidates = [
        getSaleNumber(sale),
        sale.customerName || "",
        sale.customerEmail || "",
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
      const saleDate = sale.completedAtDate || sale.createdAtDate;
      if (!saleDate) return false;
      return saleDate >= start && saleDate <= end;
    });
  }, [dateRange, searchedSales]);

  const filteredSales = useMemo(() => {
    const minAmount = parseAmount(appliedFilters.minAmount);
    const maxAmount = parseAmount(appliedFilters.maxAmount);
    return dateFilteredSales.filter((sale: any) => {
      if (appliedFilters.status !== defaultStatusFilter) {
        const statusLabel = getSaleStatusLabel(sale.status);
        if (statusLabel !== appliedFilters.status) return false;
      }
      const total = sale.totals?.total ?? 0;
      if (minAmount !== null && total < minAmount) return false;
      if (maxAmount !== null && total > maxAmount) return false;
      if (appliedFilters.itemType !== defaultItemFilter) {
        const items = Array.isArray(sale.items) ? sale.items : [];
        if (!items.length) return false;
        const matches = items.some((item: any) => {
          const type = String(item.type || item.source || "").toLowerCase();
          if (appliedFilters.itemType === "Ydelser") {
            return type === "service" || type === "appointment" || type === "services";
          }
          if (appliedFilters.itemType === "Produkter") {
            return type === "product" || type === "products";
          }
          if (appliedFilters.itemType === "Gavekort") {
            return type === "giftcard" || type === "gift_card";
          }
          if (appliedFilters.itemType === "Medlemskaber") {
            return type === "membership" || type === "memberships";
          }
          return true;
        });
        if (!matches) return false;
      }
      return true;
    });
  }, [appliedFilters, dateFilteredSales]);

  const sortedSales = useMemo(() => {
    const sorted = [...filteredSales];
    const compareText = (a: string, b: string, direction: number) => {
      if (!a && !b) return 0;
      if (!a) return 1;
      if (!b) return -1;
      return a.localeCompare(b, "da-DK", { numeric: true, sensitivity: "base" }) * direction;
    };
    const compareNumber = (a: number | null, b: number | null, direction: number) => {
      if (a === null && b === null) return 0;
      if (a === null) return 1;
      if (b === null) return -1;
      return (a - b) * direction;
    };
    const getSaleDateValue = (sale: any) => {
      const date = sale.completedAtDate || sale.createdAtDate;
      return date ? date.getTime() : null;
    };

    sorted.sort((a: any, b: any) => {
      switch (selectedSortId) {
        case "saleNumberAsc":
          return compareText(getSaleNumber(a), getSaleNumber(b), 1);
        case "saleNumberDesc":
          return compareText(getSaleNumber(a), getSaleNumber(b), -1);
        case "customerAsc":
          return compareText(a.customerName || a.customerEmail || "", b.customerName || b.customerEmail || "", 1);
        case "customerDesc":
          return compareText(a.customerName || a.customerEmail || "", b.customerName || b.customerEmail || "", -1);
        case "dateAsc":
          return compareNumber(getSaleDateValue(a), getSaleDateValue(b), 1);
        case "dateDesc":
          return compareNumber(getSaleDateValue(a), getSaleDateValue(b), -1);
        case "locationAsc":
          return compareText(a.location || "", b.location || "", 1);
        case "locationDesc":
          return compareText(a.location || "", b.location || "", -1);
        case "tipsAsc":
          return compareNumber(typeof a.tips === "number" ? a.tips : 0, typeof b.tips === "number" ? b.tips : 0, 1);
        case "tipsDesc":
          return compareNumber(typeof a.tips === "number" ? a.tips : 0, typeof b.tips === "number" ? b.tips : 0, -1);
        case "totalAsc":
          return compareNumber(a.totals?.total ?? 0, b.totals?.total ?? 0, 1);
        case "totalDesc":
          return compareNumber(a.totals?.total ?? 0, b.totals?.total ?? 0, -1);
        default:
          return 0;
      }
    });

    return sorted;
  }, [filteredSales, selectedSortId]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 bg-white px-8 pb-6 pt-8">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Salg</h1>
          <p className="mt-1 text-sm text-slate-500">
            Vis, filtrer og eksportér din salgshistorik. {" "}
            <a href="#" className="text-indigo-500">
              Læs mere
            </a>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" className="toolbar-pill">
            Muligheder
            <ChevronDown className="toolbar-caret" />
          </button>
          <button
            type="button"
            className="toolbar-pill toolbar-primary"
            onClick={() => setDrawerOpen(true)}
          >
            Tilføj nu
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-slate-50 px-8 pb-10">
        <div className="mt-6 flex items-center gap-2">
          <button
            type="button"
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            Salg
          </button>
          <button
            type="button"
            className="rounded-full px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100"
          >
            Kladder
          </button>
        </div>

        <div className="mt-4 rounded-2xl bg-slate-50 px-2 py-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
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
            <div className="relative" ref={sortMenuRef}>
              <button
                type="button"
                onClick={handleToggleSortMenu}
                className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm"
                aria-expanded={sortMenuOpen}
              >
                Sorter efter
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </button>

              {sortMenuOpen && (
                <div className="absolute right-0 top-12 z-20 w-[280px] rounded-2xl border border-slate-200 bg-white py-2 shadow-xl">
                  {sortOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        setSelectedSortId(option.id);
                        setSortMenuOpen(false);
                      }}
                      className={`flex w-full items-center justify-between px-4 py-2 text-sm ${
                        option.id === selectedSortId
                          ? "bg-slate-100 text-slate-900"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {filterOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/30"
              onClick={handleCloseFilters}
            />
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
                  <p className="text-sm font-semibold text-slate-700">Status</p>
                  <button
                    type="button"
                    onClick={() => {
                      setStatusMenuOpen((prev) => !prev);
                      setItemMenuOpen(false);
                    }}
                    className="mt-2 flex w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700"
                  >
                    {draftFilters.status}
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  </button>
                  {statusMenuOpen && (
                    <div className="absolute left-0 right-0 top-full z-10 mt-2 max-h-64 overflow-auto rounded-2xl border border-slate-200 bg-white py-2 shadow-xl">
                      {statusOptions.map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => {
                            setDraftFilters((prev) => ({ ...prev, status: option }));
                            setStatusMenuOpen(false);
                          }}
                          className={`flex w-full items-center justify-between px-4 py-2 text-sm ${
                            option === draftFilters.status
                              ? "bg-indigo-50 text-indigo-600"
                              : "text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <span>{option}</span>
                          {option === draftFilters.status && (
                            <Check className="h-4 w-4" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Fra-beløb</p>
                    <div className="mt-2 flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">
                      <span className="text-slate-400">kr</span>
                      <input
                        type="text"
                        value={draftFilters.minAmount}
                        onChange={(event) =>
                          setDraftFilters((prev) => ({ ...prev, minAmount: event.target.value }))
                        }
                        placeholder="0,00"
                        className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Til-beløb</p>
                    <div className="mt-2 flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">
                      <span className="text-slate-400">kr</span>
                      <input
                        type="text"
                        value={draftFilters.maxAmount}
                        onChange={(event) =>
                          setDraftFilters((prev) => ({ ...prev, maxAmount: event.target.value }))
                        }
                        placeholder="Til"
                        className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="relative">
                  <p className="text-sm font-semibold text-slate-700">Inklusive varer</p>
                  <button
                    type="button"
                    onClick={() => {
                      setItemMenuOpen((prev) => !prev);
                      setStatusMenuOpen(false);
                    }}
                    className="mt-2 flex w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700"
                  >
                    {draftFilters.itemType}
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  </button>
                  {itemMenuOpen && (
                    <div className="absolute left-0 right-0 top-full z-10 mt-2 max-h-64 overflow-auto rounded-2xl border border-slate-200 bg-white py-2 shadow-xl">
                      {itemTypeOptions.map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => {
                            setDraftFilters((prev) => ({ ...prev, itemType: option }));
                            setItemMenuOpen(false);
                          }}
                          className={`flex w-full items-center justify-between px-4 py-2 text-sm ${
                            option === draftFilters.itemType
                              ? "bg-indigo-50 text-indigo-600"
                              : "text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <span>{option}</span>
                          {option === draftFilters.itemType && (
                            <Check className="h-4 w-4" />
                          )}
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
            <table className="min-w-[900px] w-full text-sm">
              <thead className="text-xs font-semibold text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-3 text-left">
                    <span className="inline-flex items-center gap-1">
                      Salg nr.
                      <ArrowUpDown className="h-3 w-3" />
                    </span>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <span className="inline-flex items-center gap-1">
                      Kunde
                      <ArrowUpDown className="h-3 w-3" />
                    </span>
                  </th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">
                    <span className="inline-flex items-center gap-1">
                      Salgsdato
                      <ArrowUpDown className="h-3 w-3" />
                    </span>
                  </th>
                  <th className="px-4 py-3 text-right">
                    <span className="inline-flex items-center gap-1">
                      Drikkepenge
                      <ArrowUpDown className="h-3 w-3" />
                    </span>
                  </th>
                  <th className="px-4 py-3 text-right">
                    <span className="inline-flex items-center gap-1">
                      Brutto i alt
                      <ArrowUpDown className="h-3 w-3" />
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-xs text-slate-400"
                    >
                      Henter salg...
                    </td>
                  </tr>
                )}
                {!loading && error && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-xs text-slate-400"
                    >
                      Kunne ikke hente salg lige nu.
                    </td>
                  </tr>
                )}
                {!loading && !error && sortedSales.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-xs text-slate-400"
                    >
                      Ingen gennemførte salg endnu.
                    </td>
                  </tr>
                )}
                {!loading &&
                  !error &&
                  sortedSales.map((sale: any) => {
                    const saleNumber = getSaleNumber(sale) || "—";
                    const customer = sale.customerName || sale.customerEmail || "—";
                    const saleDate = formatDateTime(sale.completedAtDate || null);
                    const tips = sale.tips || 0;
                    const total = sale.totals?.total ?? 0;
                    return (
                      <tr key={sale.id} className="border-b border-slate-100">
                        <td className="px-4 py-3 font-medium text-indigo-500">
                          {saleNumber}
                        </td>
                        <td className="px-4 py-3 text-slate-700">{customer}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                            Gennemført
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{saleDate}</td>
                        <td className="px-4 py-3 text-right text-slate-700">
                          {formatCurrency(tips)} kr.
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700">
                          {formatCurrency(total)} kr.
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-100 py-4 text-center text-xs text-slate-400">
            Viser {sortedSales.length} af {sales.length} resultater
          </div>
        </div>
      </div>

      <AddNowDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}
