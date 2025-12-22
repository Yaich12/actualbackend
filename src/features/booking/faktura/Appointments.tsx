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
import useAppointments from "../../../hooks/useAppointments";
import { useUserServices } from "../Ydelser/hooks/useUserServices";
import AddNowDrawer from "./AddNowDrawer";
import AppointmentDetailDrawer from "./AppointmentDetailDrawer";

const statusLabels: Record<string, string> = {
  booked: "Booket",
  confirmed: "Bekr\u00e6ftet",
  arrived: "Ankommet",
  started: "Begyndt",
  completed: "Gennemf\u00f8rt",
  cancelled: "Aflyst",
  pending: "Afventer",
  noshow: "Udeblivelse",
  "no-show": "Udeblivelse",
  "no_show": "Udeblivelse",
};

const statusClasses = (status: string) => {
  if (status === "Booket" || status === "Bekr\u00e6ftet" || status === "Ankommet" || status === "Begyndt") {
    return "bg-blue-50 text-blue-600";
  }
  if (status === "Gennemf\u00f8rt") {
    return "bg-slate-100 text-slate-600";
  }
  if (status === "Aflyst") {
    return "bg-rose-50 text-rose-600";
  }
  if (status === "Udeblivelse" || status === "Afventer") {
    return "bg-amber-50 text-amber-700";
  }
  return "bg-slate-100 text-slate-600";
};

const defaultEmployeeFilter = "Alle medarbejdere";
const defaultStatusFilter = "Alle statuser";

const statusOptions = [
  { id: "all", label: defaultStatusFilter },
  { id: "booked", label: "Booket" },
  { id: "confirmed", label: "Bekr\u00e6ftet" },
  { id: "arrived", label: "Ankommet" },
  { id: "started", label: "Begyndt" },
  { id: "completed", label: "Gennemf\u00f8rt" },
  { id: "cancelled", label: "Aflyst" },
  { id: "noshow", label: "Udeblivelse" },
];

const sortOptions: SortOption[] = [
  {
    id: "createdAtAsc",
    label: "Oprettelsesdato (\u00e6ldste f\u00f8rst)",
    field: "createdAt",
    direction: "asc",
  },
  {
    id: "createdAtDesc",
    label: "Oprettelsesdato (nyeste f\u00f8rst)",
    field: "createdAt",
    direction: "desc",
  },
  {
    id: "scheduledAtAsc",
    label: "Planlagt dato (\u00e6ldste f\u00f8rst)",
    field: "scheduledAt",
    direction: "asc",
  },
  {
    id: "scheduledAtDesc",
    label: "Planlagt dato (nyeste f\u00f8rst)",
    field: "scheduledAt",
    direction: "desc",
  },
  {
    id: "durationAsc",
    label: "Varighed (korteste f\u00f8rst)",
    field: "duration",
    direction: "asc",
  },
  {
    id: "durationDesc",
    label: "Varighed (l\u00e6ngste f\u00f8rst)",
    field: "duration",
    direction: "desc",
  },
];

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

type DateRange = {
  start: Date | null;
  end: Date | null;
};

type SortOption = {
  id: string;
  label: string;
  field: "createdAt" | "scheduledAt" | "duration";
  direction: "asc" | "desc";
};

const resolveDateValue = (value: any) => {
  if (!value) return null;
  if (value?.toDate) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
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

const resolveAppointmentDate = (appointment: any) => {
  const fromStartDate = parseDateString(appointment?.startDate);
  if (fromStartDate) return fromStartDate;
  const isoValue = appointment?.start || appointment?.startIso || "";
  if (isoValue) {
    const parsed = new Date(isoValue);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
};

const resolveAppointmentDateTime = (appointment: any) => {
  const date = parseDateString(appointment?.startDate);
  if (date && appointment?.startTime) {
    const [hours, minutes] = appointment.startTime.split(":").map(Number);
    if (!Number.isNaN(hours) && !Number.isNaN(minutes)) {
      date.setHours(hours, minutes, 0, 0);
    }
    return date;
  }
  if (date) return date;
  const isoValue = appointment?.start || appointment?.startIso || "";
  if (isoValue) {
    const parsed = new Date(isoValue);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
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
  if (!range.start || !range.end) return "Vælg dato";
  const format = (date: Date) => {
    const day = date.getDate();
    const month = monthNames[date.getMonth()] || "";
    const year = date.getFullYear();
    return `${day} ${month}, ${year}`;
  };
  return `${format(range.start)}–${format(range.end)}`;
};

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

const parseDurationToMinutes = (value: unknown) => {
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  if (!value || typeof value !== "string") return null;
  const text = value.toLowerCase();
  let total = 0;
  const hoursMatch = text.match(/(\d+)\s*(t|time|timer)/);
  const minutesMatch = text.match(/(\d+)\s*(min|minute|minutter)/);
  if (hoursMatch) total += Number(hoursMatch[1]) * 60;
  if (minutesMatch) total += Number(minutesMatch[1]);
  if (total > 0) return total;
  const numeric = text.match(/(\d+)/);
  return numeric ? Number(numeric[1]) : null;
};

const getStatusLabel = (value: any) => {
  if (!value) return "Booket";
  const normalized = String(value).toLowerCase();
  if (statusLabels[normalized]) return statusLabels[normalized];
  const match = statusOptions.find(
    (option) => option.label.toLowerCase() === normalized
  );
  return match?.label || "Booket";
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

const formatDateTime = (dateStr?: string, timeStr?: string) => {
  if (!dateStr) return "";
  const [day, month, year] = dateStr.split("-");
  if (!day || !month || !year) return "";
  const monthIndex = Number(month) - 1;
  const monthLabel = monthNames[monthIndex] || month;
  const base = `${Number(day)} ${monthLabel} ${year}`;
  if (!timeStr) return base;
  return `${base}, ${timeStr}`;
};

const formatDateTimeFromDate = (date: Date | null) => {
  if (!date) return "";
  const day = date.getDate();
  const monthLabel = monthNames[date.getMonth()] || "";
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day} ${monthLabel} ${year}, ${hours}:${minutes}`;
};

const resolveAppointmentService = (appointment: any, services: any[]) => {
  if (!appointment) return null;

  if (appointment.serviceId) {
    const match = services.find((svc) => svc.id === appointment.serviceId);
    if (match) return match;
  }

  if (appointment.service) {
    const matchByName = services.find((svc) => svc.navn === appointment.service);
    if (matchByName) return matchByName;
    return {
      id: "appointment-service",
      navn: appointment.service,
      varighed: appointment.serviceDuration || "1 time",
      pris: appointment.servicePrice ?? 0,
    };
  }

  return null;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("da-DK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);

export default function Appointments() {
  const { user } = useAuth();
  const { appointments, loading, error } = useAppointments(user?.uid || null);
  const { services } = useUserServices();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [paymentAppointmentId, setPaymentAppointmentId] = useState<string | null>(null);
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
  const [calendarMonth, setCalendarMonth] = useState(
    new Date(dateRange.start?.getFullYear() || new Date().getFullYear(), dateRange.start?.getMonth() || new Date().getMonth(), 1)
  );
  const [filterOpen, setFilterOpen] = useState(false);
  const [employeeMenuOpen, setEmployeeMenuOpen] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [channelMenuOpen, setChannelMenuOpen] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [selectedSortId, setSelectedSortId] = useState("scheduledAtDesc");
  const sortMenuRef = useRef<HTMLDivElement | null>(null);
  const [appliedFilters, setAppliedFilters] = useState({
    employee: defaultEmployeeFilter,
    status: defaultStatusFilter,
  });
  const [draftFilters, setDraftFilters] = useState(appliedFilters);
  const [draftChannel, setDraftChannel] = useState("Alle kanaler");

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const earliestAppointmentDate = useMemo(() => {
    const dates = appointments
      .map((appointment: any) => resolveAppointmentDate(appointment))
      .filter((value): value is Date => Boolean(value));
    if (dates.length === 0) return null;
    const earliestTime = Math.min(...dates.map((date) => date.getTime()));
    return new Date(earliestTime);
  }, [appointments]);

  const employeeOptions = useMemo(() => {
    const names = new Set<string>();
    appointments.forEach((appointment: any) => {
      const name = appointment.calendarOwner || appointment.staffName || "";
      if (name) names.add(name);
    });
    if (names.size === 0) {
      return ["geg ded", "f\u00e6lles konto", "Wendy Smith (Demo)"];
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b, "da-DK"));
  }, [appointments]);

  const employeeSelectOptions = useMemo(
    () => [defaultEmployeeFilter, ...employeeOptions],
    [employeeOptions]
  );

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
        const start = earliestAppointmentDate
          ? startOfDay(earliestAppointmentDate)
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

  const hasActiveFilters =
    appliedFilters.employee !== defaultEmployeeFilter ||
    appliedFilters.status !== defaultStatusFilter;

  const handleOpenFilters = () => {
    setDraftFilters({ ...appliedFilters });
    setDraftChannel("Alle kanaler");
    setEmployeeMenuOpen(false);
    setStatusMenuOpen(false);
    setChannelMenuOpen(false);
    setFilterOpen(true);
    setRangePickerOpen(false);
    setPresetOpen(false);
    setSortMenuOpen(false);
  };

  const handleCloseFilters = () => {
    setFilterOpen(false);
    setEmployeeMenuOpen(false);
    setStatusMenuOpen(false);
    setChannelMenuOpen(false);
  };

  const handleApplyFilters = () => {
    setAppliedFilters({ ...draftFilters });
    handleCloseFilters();
  };

  const handleToggleSortMenu = () => {
    setSortMenuOpen((prev) => !prev);
    setRangePickerOpen(false);
    setPresetOpen(false);
  };

  const handleClearFilters = () => {
    const cleared = { employee: defaultEmployeeFilter, status: defaultStatusFilter };
    setAppliedFilters(cleared);
    setDraftFilters(cleared);
    setDraftChannel("Alle kanaler");
    setEmployeeMenuOpen(false);
    setStatusMenuOpen(false);
    setChannelMenuOpen(false);
  };

  const handleRemoveEmployeeFilter = () => {
    const cleared = { ...appliedFilters, employee: defaultEmployeeFilter };
    setAppliedFilters(cleared);
    setDraftFilters((prev) => ({ ...prev, employee: defaultEmployeeFilter }));
  };

  const handleRemoveStatusFilter = () => {
    const cleared = { ...appliedFilters, status: defaultStatusFilter };
    setAppliedFilters(cleared);
    setDraftFilters((prev) => ({ ...prev, status: defaultStatusFilter }));
  };

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

  const rangeStart = dateRange.start ? startOfDay(dateRange.start) : null;
  const rangeEnd = dateRange.end ? endOfDay(dateRange.end) : null;

  const filteredAppointments = useMemo(() => {
    if (!normalizedSearch) return appointments;
    return appointments.filter((appointment: any) => {
      const refRaw = appointment.referenceNumber || appointment.id || "";
      const queryFields = [
        String(refRaw),
        appointment.client || "",
        appointment.clientEmail || "",
        appointment.service || "",
      ];
      return queryFields.some((value) =>
        value.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [appointments, normalizedSearch]);

  const visibleAppointments = useMemo(() => {
    return filteredAppointments.filter((appointment: any) => {
      if (rangeStart && rangeEnd) {
        const appointmentDate = resolveAppointmentDate(appointment);
        if (!appointmentDate) return false;
        const normalized = startOfDay(appointmentDate);
        if (normalized < rangeStart || normalized > rangeEnd) return false;
      }
      if (appliedFilters.employee !== defaultEmployeeFilter) {
        const staffName = appointment.calendarOwner || "f\u00e6lles konto";
        if (staffName !== appliedFilters.employee) return false;
      }
      if (appliedFilters.status !== defaultStatusFilter) {
        const statusLabel = getStatusLabel(appointment.status);
        if (statusLabel !== appliedFilters.status) return false;
      }
      return true;
    });
  }, [appliedFilters, filteredAppointments, rangeEnd, rangeStart]);

  const sortedAppointments = useMemo(() => {
    const option =
      sortOptions.find((item) => item.id === selectedSortId) || sortOptions[0];
    if (!option) return visibleAppointments;
    const direction = option.direction === "asc" ? 1 : -1;
    const compareValues = (aValue: number | null, bValue: number | null) => {
      if (aValue === null && bValue === null) return 0;
      if (aValue === null) return 1;
      if (bValue === null) return -1;
      return (aValue - bValue) * direction;
    };
    const getDateSortValue = (date: Date | null) => (date ? date.getTime() : null);

    const sorted = [...visibleAppointments];
    sorted.sort((a: any, b: any) => {
      if (option.field === "createdAt") {
        const aDate = resolveDateValue(a.createdAt) || resolveAppointmentDateTime(a);
        const bDate = resolveDateValue(b.createdAt) || resolveAppointmentDateTime(b);
        return compareValues(getDateSortValue(aDate), getDateSortValue(bDate));
      }
      if (option.field === "duration") {
        const aDuration = parseDurationToMinutes(a.serviceDuration || a.duration);
        const bDuration = parseDurationToMinutes(b.serviceDuration || b.duration);
        return compareValues(aDuration, bDuration);
      }
      const aDate = resolveAppointmentDateTime(a);
      const bDate = resolveAppointmentDateTime(b);
      return compareValues(getDateSortValue(aDate), getDateSortValue(bDate));
    });
    return sorted;
  }, [selectedSortId, visibleAppointments]);

  const selectedSortLabel =
    sortOptions.find((option) => option.id === selectedSortId)?.label ||
    "Planlagt dato (nyeste f\u00f8rst)";

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 bg-white px-8 pb-6 pt-8">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Aftaler</h1>
          <p className="mt-1 text-sm text-slate-500">
            Se, filtrer og eksport\u00e9r aftaler, der er booket af dine kunder.
          </p>
        </div>
        <button type="button" className="toolbar-pill">
          Eksport\u00e9r
          <ChevronDown className="toolbar-caret" />
        </button>
      </div>

      <div className="flex-1 overflow-auto bg-slate-50 px-8 pb-10">
        <div className="mt-6 rounded-2xl bg-slate-50 px-2 py-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="S\u00f8g efter reference eller kunde"
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
                            aria-label="Forrige m\u00e5ned"
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
                            aria-label="N\u00e6ste m\u00e5ned"
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
                {selectedSortLabel}
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </button>

              {sortMenuOpen && (
                <div className="absolute right-0 top-12 z-20 w-[320px] rounded-2xl border border-slate-200 bg-white py-2 shadow-xl">
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

          {hasActiveFilters && (
            <div className="mt-3 flex flex-wrap items-center gap-2 px-2 pb-1">
              {appliedFilters.employee !== defaultEmployeeFilter && (
                <span className="inline-flex items-center gap-2 rounded-full border border-indigo-500 px-3 py-1 text-xs font-semibold text-indigo-600">
                  {appliedFilters.employee}
                  <button
                    type="button"
                    onClick={handleRemoveEmployeeFilter}
                    className="text-indigo-400 hover:text-indigo-600"
                    aria-label="Fjern medarbejderfilter"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {appliedFilters.status !== defaultStatusFilter && (
                <span className="inline-flex items-center gap-2 rounded-full border border-indigo-500 px-3 py-1 text-xs font-semibold text-indigo-600">
                  {appliedFilters.status}
                  <button
                    type="button"
                    onClick={handleRemoveStatusFilter}
                    className="text-indigo-400 hover:text-indigo-600"
                    aria-label="Fjern statusfilter"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-sm font-medium text-slate-500 hover:text-slate-700"
              >
                Ryd alle
              </button>
            </div>
          )}
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
                  <p className="text-sm font-semibold text-slate-700">Medarbejder</p>
                  <button
                    type="button"
                    onClick={() => {
                      setEmployeeMenuOpen((prev) => !prev);
                      setStatusMenuOpen(false);
                      setChannelMenuOpen(false);
                    }}
                    className="mt-2 flex w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700"
                  >
                    {draftFilters.employee}
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  </button>
                  {employeeMenuOpen && (
                    <div className="absolute left-0 right-0 top-full z-10 mt-2 max-h-64 overflow-auto rounded-2xl border border-slate-200 bg-white py-2 shadow-xl">
                      {employeeSelectOptions.map((option) => (
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
                          {option === draftFilters.employee && (
                            <Check className="h-4 w-4" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="relative">
                  <p className="text-sm font-semibold text-slate-700">Kanal</p>
                  <button
                    type="button"
                    onClick={() => {
                      setChannelMenuOpen((prev) => !prev);
                      setEmployeeMenuOpen(false);
                      setStatusMenuOpen(false);
                    }}
                    className="mt-2 flex w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700"
                  >
                    {draftChannel}
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  </button>
                  {channelMenuOpen && (
                    <div className="absolute left-0 right-0 top-full z-10 mt-2 rounded-2xl border border-slate-200 bg-white py-2 shadow-xl">
                      <button
                        type="button"
                        onClick={() => {
                          setDraftChannel("Alle kanaler");
                          setChannelMenuOpen(false);
                        }}
                        className="flex w-full items-center justify-between px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        Alle kanaler
                      </button>
                    </div>
                  )}
                </div>

                <div className="relative">
                  <p className="text-sm font-semibold text-slate-700">Status</p>
                  <button
                    type="button"
                    onClick={() => {
                      setStatusMenuOpen((prev) => !prev);
                      setEmployeeMenuOpen(false);
                      setChannelMenuOpen(false);
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
                          key={option.id}
                          type="button"
                          onClick={() => {
                            setDraftFilters((prev) => ({ ...prev, status: option.label }));
                            setStatusMenuOpen(false);
                          }}
                          className={`flex w-full items-center justify-between px-4 py-2 text-sm ${
                            option.label === draftFilters.status
                              ? "bg-indigo-50 text-indigo-600"
                              : "text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <span>{option.label}</span>
                          {option.label === draftFilters.status && (
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
            <table className="min-w-[1100px] w-full text-sm">
              <thead className="text-xs font-semibold text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-3 text-left">Ref nr</th>
                  <th className="px-4 py-3 text-left">Kunde</th>
                  <th className="px-4 py-3 text-left">Tjeneste</th>
                  <th className="px-4 py-3 text-left">Oprettet af</th>
                  <th className="px-4 py-3 text-left">
                    <span className="inline-flex items-center gap-1">
                      Oprettelsesdato
                      <ArrowUpDown className="h-3 w-3" />
                    </span>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <span className="inline-flex items-center gap-1">
                      Planlagt dato
                      <ArrowUpDown className="h-3 w-3" />
                    </span>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <span className="inline-flex items-center gap-1">
                      Varighed
                      <ArrowUpDown className="h-3 w-3" />
                    </span>
                  </th>
                  <th className="px-4 py-3 text-left">Medarbejder</th>
                  <th className="px-4 py-3 text-right">Pris</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-4 py-8 text-center text-xs text-slate-400"
                    >
                      Henter aftaler...
                    </td>
                  </tr>
                )}

                {!loading && error && (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-4 py-8 text-center text-xs text-slate-400"
                    >
                      Kunne ikke hente aftaler lige nu.
                    </td>
                  </tr>
                )}

                {!loading && !error && sortedAppointments.length === 0 && (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-4 py-8 text-center text-xs text-slate-400"
                    >
                      Ingen aftaler matcher din s\u00f8gning.
                    </td>
                  </tr>
                )}

                {!loading &&
                  !error &&
                  sortedAppointments.map((appointment: any) => {
                    const service = resolveAppointmentService(appointment, services);
                    const refRaw = appointment.referenceNumber || appointment.id || "";
                    const refLabel = refRaw
                      ? String(refRaw).startsWith("#")
                        ? String(refRaw)
                        : `#${refRaw}`
                      : "\u2014";
                    const customerName =
                      appointment.client || appointment.clientEmail || "Ind fra gaden";
                    const serviceName =
                      appointment.service || service?.navn || appointment.title || "\u2014";
                    const createdBy = appointment.calendarOwner || "f\u00e6lles konto";
                    const createdAtSource = resolveDateValue(appointment.createdAt);
                    const createdAt = createdAtSource
                      ? formatDateTimeFromDate(createdAtSource)
                      : formatDateTime(appointment.startDate, appointment.startTime);
                    const scheduledAt = formatDateTime(
                      appointment.startDate,
                      appointment.startTime
                    );
                    const duration =
                      appointment.serviceDuration || service?.varighed || "\u2014";
                    const staff = appointment.calendarOwner || "f\u00e6lles konto";
                    const price =
                      typeof appointment.servicePrice === "number"
                        ? appointment.servicePrice
                        : service?.pris || 0;
                    const statusLabel = getStatusLabel(appointment.status);

                    return (
                      <tr
                        key={appointment.id}
                        className="border-b border-slate-100 text-slate-700"
                      >
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            className="font-medium text-indigo-500 hover:underline"
                            onClick={() => setSelectedAppointmentId(appointment.id)}
                          >
                            {refLabel}
                          </button>
                        </td>
                        <td className="px-4 py-3">{customerName}</td>
                        <td className="px-4 py-3">{serviceName}</td>
                        <td className="px-4 py-3">{createdBy}</td>
                        <td className="px-4 py-3">{createdAt}</td>
                        <td className="px-4 py-3">{scheduledAt}</td>
                        <td className="px-4 py-3">{duration}</td>
                        <td className="px-4 py-3">{staff}</td>
                        <td className="px-4 py-3 text-right">
                          {formatCurrency(price)} kr.
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusClasses(
                              statusLabel
                            )}`}
                          >
                            {statusLabel}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-100 py-4 text-center text-xs text-slate-400">
            Viser {sortedAppointments.length} af {appointments.length} resultater
          </div>
        </div>
      </div>

      <AppointmentDetailDrawer
        open={Boolean(selectedAppointmentId)}
        appointmentId={selectedAppointmentId}
        onClose={() => setSelectedAppointmentId(null)}
        onOpenPayment={(appointmentId) => {
          setSelectedAppointmentId(null);
          setPaymentAppointmentId(appointmentId);
        }}
      />

      <AddNowDrawer
        open={Boolean(paymentAppointmentId)}
        onClose={() => setPaymentAppointmentId(null)}
        initialAppointmentId={paymentAppointmentId}
        initialStep="payment"
      />
    </div>
  );
}
