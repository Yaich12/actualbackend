import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Banknote,
  Check,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  CreditCard,
  Gift,
  MoreHorizontal,
  QrCode,
  Search,
  SlidersHorizontal,
  Smartphone,
  X,
} from "lucide-react";
import { addDoc, collection, doc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { cn } from "../../../lib/utils";
import { useAuth } from "../../../AuthContext";
import useAppointments from "../../../hooks/useAppointments";
import useStripeConnectStatus from "../../../hooks/useStripeConnectStatus";
import { useUserServices } from "../Ydelser/hooks/useUserServices";
import { useUserClients } from "../Klienter/hooks/useUserClients";
import { useUserProducts } from "../Product/hooks/useUserProducts";
import { dedupeClinicMembers, mapClinicMemberDoc, normalizeMemberName } from "../team/clinicMembers";
import { db } from "../../../firebase";
import { getIdToken } from "../../../utils/auth";
import { buildApiUrl } from "../../../utils/runtimeUrls";

const tabs = [
  { id: "appointments", label: "Aftaler" },
  { id: "services", label: "Ydelser" },
  { id: "products", label: "Produkter" },
] as const;

const datePresetOptions = [
  { id: "today", label: "I dag" },
  { id: "yesterday", label: "I går" },
  { id: "last7", label: "Seneste 7 dage" },
  { id: "last30", label: "Seneste 30 dage" },
  { id: "last90", label: "Seneste 90 dage" },
  { id: "lastYear", label: "Sidste år" },
  { id: "weekToDate", label: "Ugen til dato" },
  { id: "monthToDate", label: "Måned til dato" },
  { id: "quarterToDate", label: "Kvartal til dato" },
  { id: "yearToDate", label: "Året til dato" },
  { id: "tomorrow", label: "I morgen" },
  { id: "next7", label: "Næste 7 dage" },
  { id: "next30", label: "Næste 30 dage" },
] as const;

const defaultEmployeeFilter = "Alle medarbejdere";

type DrawerTab = (typeof tabs)[number]["id"];

type DrawerStep = "cart" | "payment" | "success";

type DateRange = {
  start: Date | null;
  end: Date | null;
};

type TeamMember = {
  id: string;
  name: string;
};

type LineItem = {
  id: string;
  name: string;
  price: number;
  duration?: string;
  owner?: string;
  color?: string;
  source: "appointment" | "service" | "product";
  referenceId?: string;
};

type ProductItem = {
  id: string;
  name: string;
  price: number;
  currency?: string;
  amount?: number | null;
  unit?: string;
  shortDescription?: string;
  description?: string;
  brand?: string;
  category?: string;
  sku?: string;
};

type SelectedCustomer = {
  id?: string | null;
  name: string;
  email?: string;
  phone?: string;
};

type PaymentMethod = {
  id: string;
  label: string;
  group: "core" | "fresha";
  connectRequired?: boolean;
  icon: React.ComponentType<{ className?: string }>;
};

type AddNowDrawerProps = {
  open: boolean;
  onClose: () => void;
  initialAppointmentId?: string | null;
  initialStep?: DrawerStep;
};

const paymentMethods: PaymentMethod[] = [
  {
    id: "kortterminal",
    label: "Kreditkort",
    group: "fresha",
    connectRequired: true,
    icon: CreditCard,
  },
  {
    id: "selvbetjening",
    label: "MobilePay",
    group: "fresha",
    connectRequired: true,
    icon: Smartphone,
  },
  { id: "qr", label: "QR-kode", group: "fresha", connectRequired: true, icon: QrCode },
  { id: "kontanter", label: "Kontanter", group: "core", icon: Banknote },
  { id: "gavekort", label: "Gavekort", group: "core", icon: Gift },
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("da-DK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);

const getInitials = (value?: string) => {
  if (!value) return "?";
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
};

const resolveAppointmentService = (appointment: any, services: any[]) => {
  if (!appointment) return null;

  if (appointment.serviceId) {
    const match = services.find((svc) => svc.id === appointment.serviceId);
    if (match) {
      return match;
    }
  }

  if (appointment.service) {
    const matchByName = services.find((svc) => svc.navn === appointment.service);
    if (matchByName) {
      return matchByName;
    }
    return {
      id: "appointment-service",
      navn: appointment.service,
      varighed: appointment.serviceDuration || "1 time",
      pris: appointment.servicePrice ?? 0,
      color: "#6366f1",
    };
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

const resolveAppointmentOwner = (appointment: any) =>
  appointment?.calendarOwner ||
  appointment?.ownerName ||
  appointment?.staffName ||
  appointment?.employeeName ||
  appointment?.teamMember ||
  appointment?.assignedTo ||
  "fælles konto";

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
    case "next30": {
      const start = addDays(todayStart, 1);
      const end = addDays(start, 29);
      return { start, end: endOfDay(end) };
    }
    default:
      return { start: todayStart, end: endOfDay(todayStart) };
  }
};

const formatDateTime = (date: Date | null) => {
  if (!date) return "";
  const day = date.getDate();
  const month = date.toLocaleString("da-DK", { month: "short" });
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day} ${month} ${year} kl. ${hours}:${minutes}`;
};

const getSaleNumber = (sale: any) => {
  const ref = sale?.saleNumber || sale?.appointmentRef || sale?.id || "";
  return ref ? String(ref).replace(/^#/, "") : "";
};

const parseRequestError = (payload: any, status: number) => {
  const rawMessage = payload?.error || payload?.message || "";
  if (typeof rawMessage === "string" && rawMessage.trim()) {
    return rawMessage;
  }
  return `Request failed (${status})`;
};

const resolveConnectCheckoutTypes = (paymentMethodId?: string | null) => {
  const methodId = `${paymentMethodId || ""}`.trim().toLowerCase();
  if (methodId === "qr" || methodId === "selvbetjening") {
    return ["card", "mobilepay"];
  }
  return ["card"];
};

export default function AddNowDrawer({
  open,
  onClose,
  initialAppointmentId = null,
  initialStep = "cart",
}: AddNowDrawerProps) {
  const { user, workspaceUid, sessionUid, activeClinicId: authClinicId } = useAuth();
  const { status: stripeConnectStatus, loading: stripeConnectLoading } = useStripeConnectStatus({
    enabled: Boolean(user?.uid && open),
  });
  const { appointments, loading: appointmentsLoading, error: appointmentsError } = useAppointments(
    authClinicId || workspaceUid || null
  );
  const { services, loading: servicesLoading } = useUserServices();
  const { clients, loading: clientsLoading } = useUserClients();
  const { products, loading: productsLoading, error: productsError } = useUserProducts();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [activeClinicId, setActiveClinicId] = useState<string | null>(authClinicId || null);
  const datePresetRef = useRef<HTMLDivElement | null>(null);
  const employeeMenuRef = useRef<HTMLDivElement | null>(null);

  const [activeTab, setActiveTab] = useState<DrawerTab>("appointments");
  const [searchTerm, setSearchTerm] = useState("");
  const [datePresetOpen, setDatePresetOpen] = useState(false);
  const [selectedDatePreset, setSelectedDatePreset] = useState<string>("today");
  const [employeeFilterOpen, setEmployeeFilterOpen] = useState(false);
  const [employeeMenuOpen, setEmployeeMenuOpen] = useState(false);
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState(defaultEmployeeFilter);
  const [draftEmployeeFilter, setDraftEmployeeFilter] = useState(defaultEmployeeFilter);
  const [clientSearch, setClientSearch] = useState("");
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<SelectedCustomer | null>(null);
  const [extraItems, setExtraItems] = useState<LineItem[]>([]);
  const [step, setStep] = useState<DrawerStep>("cart");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [paymentInfo, setPaymentInfo] = useState("");
  const [completedSale, setCompletedSale] = useState<any>(null);

  const ownerFallbackName = user?.displayName || user?.email || "Medarbejder";
  const employeeName = user?.displayName || user?.email || "Medarbejder";
  const connectStatus = stripeConnectStatus?.connect || null;
  const isConnectReady = Boolean(connectStatus?.onboardingComplete);
  const teamMemberById = useMemo(() => {
    const entries: Array<[string, string]> = teamMembers
      .map((member): [string, string] => [String(member.id || "").trim(), member.name.trim()])
      .filter(([id, name]) => Boolean(id && name));
    return new Map<string, string>(entries);
  }, [teamMembers]);

  const resolveDrawerAppointmentOwner = useCallback((appointment: any) => {
    const ownerName = normalizeMemberName(resolveAppointmentOwner(appointment));
    if (ownerName && ownerName !== "fælles konto") return ownerName;
    const ownerId = String(
      appointment?.calendarOwnerId || appointment?.staffUid || appointment?.therapistId || ""
    ).trim();
    if (ownerId && teamMemberById.has(ownerId)) {
      return normalizeMemberName(teamMemberById.get(ownerId) || ownerName);
    }
    return ownerName;
  }, [teamMemberById]);

  const selectedDatePresetLabel = useMemo(
    () => datePresetOptions.find((option) => option.id === selectedDatePreset)?.label || "I dag",
    [selectedDatePreset]
  );
  const datePresetRange = useMemo(() => resolvePresetRange(selectedDatePreset), [selectedDatePreset]);
  const appointmentsHeading = selectedDatePreset === "today" ? "Tidligere i dag" : selectedDatePresetLabel;
  const employeeFilterActive = selectedEmployeeFilter !== defaultEmployeeFilter;

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    setActiveTab("appointments");
    setSearchTerm("");
    setDatePresetOpen(false);
    setSelectedDatePreset("today");
    setEmployeeFilterOpen(false);
    setEmployeeMenuOpen(false);
    setSelectedEmployeeFilter(defaultEmployeeFilter);
    setDraftEmployeeFilter(defaultEmployeeFilter);
    setClientSearch("");
    setShowClientPicker(false);
    setSelectedAppointmentId(initialAppointmentId);
    setSelectedCustomer(null);
    setExtraItems([]);
    setStep(initialStep);
    setSelectedPaymentMethod(null);
    setPaymentError("");
    setPaymentInfo("");
    setCompletedSale(null);
  }, [open, initialAppointmentId, initialStep]);

  useEffect(() => {
    if (!open) {
      setActiveClinicId(null);
      return;
    }
    const resolvedClinicId = String(authClinicId || "").trim() || null;
    setActiveClinicId(resolvedClinicId);
  }, [authClinicId, open]);

  useEffect(() => {
    if (!sessionUid || !open || !activeClinicId) {
      setTeamMembers([]);
      return;
    }
    const teamRef = collection(db, "clinics", activeClinicId, "members");
    const unsubscribe = onSnapshot(
      teamRef,
      (snapshot) => {
        const normalizedOwnerFallback = normalizeMemberName(ownerFallbackName);
        const loaded = dedupeClinicMembers(
          snapshot.docs.map((docSnap) => mapClinicMemberDoc(docSnap, "Medarbejder"))
        )
          .map((member) => ({
            id: member.id,
            name:
              String(member.id || "").trim() === String(sessionUid || "").trim() &&
              normalizeMemberName(member.name).toLowerCase() === "medarbejder" &&
              normalizedOwnerFallback.toLowerCase() !== "medarbejder"
                ? normalizedOwnerFallback
                : normalizeMemberName(member.name),
          }))
          .filter((member) => Boolean(member.id && member.name)) as TeamMember[];
        setTeamMembers(loaded);
      },
      (error) => {
        console.error("[AddNowDrawer] Failed to load team members", error);
        setTeamMembers([]);
      }
    );
    return () => unsubscribe();
  }, [activeClinicId, open, ownerFallbackName, sessionUid]);

  useEffect(() => {
    if (selectedPaymentMethod?.connectRequired && !isConnectReady) {
      setSelectedPaymentMethod(null);
    }
  }, [isConnectReady, selectedPaymentMethod]);

  useEffect(() => {
    if (activeTab === "appointments") return;
    setDatePresetOpen(false);
    setEmployeeFilterOpen(false);
    setEmployeeMenuOpen(false);
  }, [activeTab]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (datePresetRef.current && !datePresetRef.current.contains(target)) {
        setDatePresetOpen(false);
      }
      if (employeeMenuRef.current && !employeeMenuRef.current.contains(target)) {
        setEmployeeMenuOpen(false);
      }
    };
    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  const selectedAppointment = useMemo(
    () => appointments.find((item: any) => item.id === selectedAppointmentId) || null,
    [appointments, selectedAppointmentId]
  );

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const employeeOptions = useMemo(() => {
    const values = new Map<string, string>();
    const addValue = (value?: string | null) => {
      const normalized = normalizeMemberName(value);
      if (!normalized) return;
      const key = normalized.toLowerCase();
      if (!values.has(key)) {
        values.set(key, normalized);
      }
    };
    addValue(ownerFallbackName);
    teamMembers.forEach((member) => {
      addValue(member.name);
    });
    return [
      defaultEmployeeFilter,
      ...Array.from(values.values()).sort((a, b) => a.localeCompare(b, "da-DK")),
    ];
  }, [ownerFallbackName, teamMembers]);

  const filteredAppointments = useMemo(() => {
    const start = datePresetRange.start ? startOfDay(datePresetRange.start) : null;
    const end = datePresetRange.end ? endOfDay(datePresetRange.end) : null;
    const selectedOwnerNormalized = normalizeMemberName(selectedEmployeeFilter).toLowerCase();

    return appointments.filter((appointment: any) => {
      const appointmentDate = resolveAppointmentDateTime(appointment);
      if (!appointmentDate) return false;
      if (start && appointmentDate < start) return false;
      if (end && appointmentDate > end) return false;

      const owner = resolveDrawerAppointmentOwner(appointment);
      if (
        selectedEmployeeFilter !== defaultEmployeeFilter &&
        normalizeMemberName(owner).toLowerCase() !== selectedOwnerNormalized
      ) {
        return false;
      }

      if (!normalizedSearch) return true;
      return [appointment.client, appointment.service, appointment.clientEmail, owner]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch));
    });
  }, [appointments, datePresetRange, normalizedSearch, resolveDrawerAppointmentOwner, selectedEmployeeFilter]);

  const filteredServices = useMemo(() => {
    if (!normalizedSearch) return services;
    return services.filter((service: any) =>
      [service.navn, service.description]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedSearch))
    );
  }, [services, normalizedSearch]);

  const filteredProducts = useMemo(() => {
    if (!normalizedSearch) return products;
    return products.filter((product) =>
      [
        product.name,
        product.sku,
        product.brand,
        product.category,
        product.shortDescription,
        product.description,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch))
    );
  }, [normalizedSearch, products]);

  const filteredClients = useMemo(() => {
    const queryText = clientSearch.trim().toLowerCase();
    if (!queryText) return clients;
    return clients.filter((client: any) => {
      return [client.navn, client.email, client.telefon]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(queryText));
    });
  }, [clientSearch, clients]);

  const appointmentLineItems = useMemo(() => {
    if (!selectedAppointment) return [] as LineItem[];
    const service = resolveAppointmentService(selectedAppointment, services);
    const name = service?.navn || selectedAppointment.service || selectedAppointment.title || "Aftale";
    const duration = selectedAppointment.serviceDuration || service?.varighed || "1 time";
    const price =
      typeof selectedAppointment.servicePrice === "number"
        ? selectedAppointment.servicePrice
        : service?.pris || 0;
    const owner = resolveDrawerAppointmentOwner(selectedAppointment);

    return [
      {
        id: `appointment-${selectedAppointment.id}`,
        name,
        duration,
        price,
        owner,
        color: selectedAppointment.color || service?.color || "#6366f1",
        source: "appointment",
        referenceId: selectedAppointment.id,
      },
    ];
  }, [resolveDrawerAppointmentOwner, selectedAppointment, services]);

  useEffect(() => {
    if (!selectedAppointment) return;
    const name =
      selectedAppointment.client ||
      selectedAppointment.clientEmail ||
      selectedAppointment.clientPhone ||
      "Ukendt kunde";
    setSelectedCustomer({
      id: selectedAppointment.clientId || selectedAppointment.id,
      name,
      email: selectedAppointment.clientEmail || "",
      phone: selectedAppointment.clientPhone || "",
    });
    setShowClientPicker(false);
  }, [selectedAppointment]);

  const serviceCounts = useMemo(() => {
    return extraItems.reduce<Record<string, number>>((acc, item) => {
      if (item.source !== "service" || !item.referenceId) return acc;
      acc[item.referenceId] = (acc[item.referenceId] || 0) + 1;
      return acc;
    }, {});
  }, [extraItems]);

  const productCounts = useMemo(() => {
    return extraItems.reduce<Record<string, number>>((acc, item) => {
      if (item.source !== "product" || !item.referenceId) return acc;
      acc[item.referenceId] = (acc[item.referenceId] || 0) + 1;
      return acc;
    }, {});
  }, [extraItems]);

  const lineItems = useMemo(
    () => [...appointmentLineItems, ...extraItems],
    [appointmentLineItems, extraItems]
  );

  const totals = useMemo(() => {
    const subtotal = lineItems.reduce((sum, item) => sum + (item.price || 0), 0);
    return {
      subtotal,
      vat: 0,
      total: subtotal,
    };
  }, [lineItems]);

  const saleItems = useMemo(
    () =>
      lineItems.map((item) => ({
        name: item.name,
        price: item.price,
        quantity: 1,
        type: item.source,
        referenceId: item.referenceId || null,
        duration: item.duration || "",
        owner: item.owner || "",
        color: item.color || "",
      })),
    [lineItems]
  );

  const handleSelectAppointment = (appointmentId: string) => {
    setSelectedAppointmentId(appointmentId);
  };

  const handleAddService = (service: any) => {
    setExtraItems((prev) => [
      ...prev,
      {
        id: `service-${service.id}-${Date.now()}`,
        name: service.navn,
        duration: service.varighed || "1 time",
        price: service.pris || 0,
        owner: "fælles konto",
        color: service.color || "#93c5fd",
        source: "service",
        referenceId: service.id,
      },
    ]);
  };

  const getProductMeta = (product: ProductItem) => {
    const amountValue =
      product.amount !== null && product.amount !== undefined ? product.amount : null;
    if (amountValue !== null) {
      return `${amountValue} ${product.unit || ""}`.trim();
    }
    if (product.shortDescription) return product.shortDescription;
    if (product.description) return product.description;
    if (product.brand) return product.brand;
    return "";
  };

  const handleAddProduct = (product: ProductItem) => {
    const meta = getProductMeta(product);
    setExtraItems((prev) => [
      ...prev,
      {
        id: `product-${product.id}-${Date.now()}`,
        name: product.name || "Produkt",
        duration: meta,
        price: product.price || 0,
        owner: "Butik",
        color: "#94a3b8",
        source: "product",
        referenceId: product.id,
      },
    ]);
  };

  const handleRemoveItem = (id: string) => {
    setExtraItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSelectCustomer = (client: any) => {
    setSelectedCustomer({
      id: client.id,
      name: client.navn || "Uden navn",
      email: client.email || "",
      phone: client.telefon || "",
    });
    setShowClientPicker(false);
  };

  const handleSelectDatePreset = (presetId: string) => {
    setSelectedDatePreset(presetId);
    setDatePresetOpen(false);
  };

  const handleOpenEmployeeFilters = () => {
    setDraftEmployeeFilter(selectedEmployeeFilter);
    setEmployeeMenuOpen(false);
    setEmployeeFilterOpen(true);
  };

  const handleCloseEmployeeFilters = () => {
    setEmployeeFilterOpen(false);
    setEmployeeMenuOpen(false);
  };

  const handleResetEmployeeFilters = () => {
    setDraftEmployeeFilter(defaultEmployeeFilter);
  };

  const handleApplyEmployeeFilters = () => {
    setSelectedEmployeeFilter(draftEmployeeFilter);
    setEmployeeFilterOpen(false);
    setEmployeeMenuOpen(false);
  };

  const handleContinueToPayment = () => {
    if (!lineItems.length) return;
    setStep("payment");
    setPaymentError("");
    setPaymentInfo("");
  };

  const handlePaymentMethodSelect = (method: PaymentMethod) => {
    if (method.connectRequired && !isConnectReady) {
      setPaymentError("Aktivér betalinger i salg før du bruger kortmetoder.");
      setPaymentInfo("");
      return;
    }
    setSelectedPaymentMethod(method);
    setPaymentError("");
    setPaymentInfo("");
  };

  const handlePayNow = async () => {
    if (!sessionUid || (!activeClinicId && !workspaceUid) || !selectedPaymentMethod || !lineItems.length) return;
    if (selectedPaymentMethod.connectRequired && !isConnectReady) {
      setPaymentError("Kortbetalinger er låst indtil betalinger er aktiveret.");
      setPaymentInfo("");
      return;
    }
    const shouldSendPaymentLinkByEmail =
      selectedPaymentMethod.id === "kortterminal" || selectedPaymentMethod.id === "selvbetjening";
    if (shouldSendPaymentLinkByEmail && !selectedCustomer?.email) {
      setPaymentError("Tilføj patientens e-mail for at sende et betalingslink.");
      setPaymentInfo("");
      return;
    }
    setPaymentSaving(true);
    setPaymentError("");
    setPaymentInfo("");

    try {
      const appointmentRef = selectedAppointment?.referenceNumber || selectedAppointment?.id || null;
      if (selectedPaymentMethod.connectRequired) {
        const token = await getIdToken();
        const response = await fetch(buildApiUrl("/api/stripe/connect/create-sale-checkout-session"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            appointmentId: selectedAppointment?.id || null,
            appointmentRef,
            customerId: selectedCustomer?.id || null,
            customerName: selectedCustomer?.name || "",
            customerEmail: selectedCustomer?.email || "",
            customerPhone: selectedCustomer?.phone || "",
            items: saleItems,
            totals,
            location: selectedAppointment?.location || "",
            paymentMethodId: selectedPaymentMethod.id,
            paymentMethodLabel: selectedPaymentMethod.label,
            paymentMethodTypes: resolveConnectCheckoutTypes(selectedPaymentMethod.id),
            sendPaymentLinkByEmail: shouldSendPaymentLinkByEmail,
            currency: "dkk",
            successUrl:
              shouldSendPaymentLinkByEmail
                ? "/betaling/kvittering?payment=success&session_id={CHECKOUT_SESSION_ID}"
                : "/booking/fakturaer/salg?stripeCheckout=success&session_id={CHECKOUT_SESSION_ID}",
            cancelUrl:
              shouldSendPaymentLinkByEmail
                ? "/betaling/kvittering?payment=cancel"
                : "/booking/fakturaer/salg?stripeCheckout=cancel",
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(parseRequestError(data, response.status));
        }
        if (!data?.url) {
          throw new Error("Mangler checkout-link fra Stripe.");
        }
        if (shouldSendPaymentLinkByEmail) {
          const recipient = data?.paymentLinkEmail?.to || selectedCustomer?.email || "";
          setPaymentInfo(
            recipient
              ? `Betalingslink sendt til ${recipient}. Patienten kan betale fra sin mail.`
              : "Betalingslink er sendt til patientens mail."
          );
          return;
        }
        window.location.assign(data.url);
        return;
      }

      const salePayload = {
        clinicId: activeClinicId || null,
        createdByUid: sessionUid || null,
        status: "completed",
        appointmentId: selectedAppointment?.id || null,
        appointmentRef,
        customerId: selectedCustomer?.id || null,
        customerName: selectedCustomer?.name || "",
        customerEmail: selectedCustomer?.email || "",
        customerPhone: selectedCustomer?.phone || "",
        items: saleItems,
        totals,
        paymentMethod: selectedPaymentMethod.label,
        paymentProvider: "manual",
        employeeId: sessionUid || null,
        employeeName,
        completedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      };

      const salesCollectionRef = activeClinicId
        ? collection(db, "clinics", activeClinicId, "sales")
        : collection(db, "users", workspaceUid, "sales");
      const saleRef = await addDoc(salesCollectionRef, salePayload);

      if (selectedAppointment?.id) {
        const appointmentDocRef = activeClinicId
          ? doc(db, "clinics", activeClinicId, "appointments", selectedAppointment.id)
          : doc(db, "users", workspaceUid, "appointments", selectedAppointment.id);
        await updateDoc(appointmentDocRef, {
          status: "completed",
          completedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      const now = new Date();
      setCompletedSale({
        id: saleRef.id,
        ...salePayload,
        completedAt: now,
        completedAtDate: now,
        saleNumber: appointmentRef || saleRef.id.slice(0, 6),
      });
      setStep("success");
    } catch (err) {
      console.error("[AddNowDrawer] Failed to complete payment", err);
      const message = typeof err === "object" && err && "message" in err ? String(err.message) : "";
      setPaymentError(message || "Kunne ikke gennemføre betalingen. Prøv igen.");
    } finally {
      setPaymentSaving(false);
    }
  };

  const handleClose = () => {
    if (paymentSaving) return;
    onClose();
  };

  const corePaymentMethods = paymentMethods.filter((method) => method.group === "core");
  const freshaPaymentMethods = paymentMethods.filter((method) => method.group === "fresha");

  const paymentRow = selectedPaymentMethod ? (
    <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
      <span>{selectedPaymentMethod.label}</span>
      <span>{formatCurrency(totals.total)} kr.</span>
    </div>
  ) : null;

  const headerTitle =
    step === "payment" ? "Vælg betaling" : step === "success" ? "Salg" : "Læg i kurv";
  const headerSubtitle =
    step === "success" ? "Gennemført" : "Kurv › Betaling";

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex",
        open ? "pointer-events-auto" : "pointer-events-none"
      )}
      aria-hidden={!open}
    >
      <div
        className={cn(
          "absolute inset-0 bg-black/30 transition-opacity duration-200",
          open ? "opacity-100" : "opacity-0"
        )}
        onClick={handleClose}
      />
      <div
        className={cn(
          "absolute right-0 top-0 h-full w-full max-w-[980px] bg-white shadow-2xl transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <div>
              <p className="text-xs text-slate-400">{headerSubtitle}</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-900">
                {headerTitle}
              </h2>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50"
              aria-label="Luk"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden">
            {step === "success" ? (
              <div className="grid h-full min-h-0 grid-cols-[120px_minmax(0,1fr)]">
                <div className="border-r border-slate-200 bg-white px-4 py-6">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-xl bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-600"
                  >
                    Detaljer
                  </button>
                  <button
                    type="button"
                    className="mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-400"
                  >
                    Aktivitet
                  </button>
                </div>

                <div className="flex h-full min-h-0 flex-col overflow-auto px-10 py-8">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white">
                      <CircleCheck className="h-4 w-4" />
                      Gennemført
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                      >
                        Book igen
                      </button>
                      <button
                        type="button"
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200"
                      >
                        <MoreHorizontal className="h-4 w-4 text-slate-600" />
                      </button>
                    </div>
                  </div>

                  <h1 className="mt-6 text-3xl font-semibold text-slate-900">Salg</h1>
                  <p className="mt-1 text-sm text-slate-500">
                    {completedSale?.completedAtDate
                      ? `${completedSale.completedAtDate.toLocaleDateString("da-DK", {
                          weekday: "short",
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}`
                      : ""}
                    {selectedAppointment?.location ? ` · ${selectedAppointment.location}` : ""}
                  </p>

                  <div className="mt-6 space-y-4">
                    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4">
                      <div>
                        <p className="text-base font-semibold text-slate-900">
                          {selectedCustomer?.name || "Ukendt kunde"}
                        </p>
                        <p className="text-sm text-slate-500">
                          {selectedCustomer?.email || ""}
                        </p>
                      </div>
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-base font-semibold text-indigo-600">
                        {getInitials(selectedCustomer?.name)}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-xs text-slate-400">
                        Salg #{getSaleNumber(completedSale)}
                      </p>
                      <p className="text-sm text-slate-500">
                        {completedSale?.completedAtDate
                          ? completedSale.completedAtDate.toLocaleDateString("da-DK")
                          : ""}
                      </p>

                      <div className="mt-4 space-y-3">
                        {lineItems.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-start justify-between border-l-2 pl-3"
                            style={{ borderColor: item.color || "#cbd5f5" }}
                          >
                            <div>
                              <p className="text-sm font-semibold text-slate-900">
                                {item.name}
                              </p>
                              <p className="text-xs text-slate-500">
                                {getAppointmentTimeRange(selectedAppointment) || ""}
                                {item.duration ? ` • ${item.duration}` : ""}
                                {item.owner ? ` • ${item.owner}` : ""}
                              </p>
                            </div>
                            <p className="text-sm font-semibold text-slate-900">
                              {formatCurrency(item.price)} kr.
                            </p>
                          </div>
                        ))}
                      </div>

                      <div className="mt-4 border-t border-slate-100 pt-4 text-sm text-slate-500">
                        <div className="flex items-center justify-between">
                          <span>Subtotal</span>
                          <span>{formatCurrency(totals.subtotal)} kr.</span>
                        </div>
                        <div className="mt-2 flex items-center justify-between font-semibold text-slate-900">
                          <span>I alt</span>
                          <span>{formatCurrency(totals.total)} kr.</span>
                        </div>
                      </div>

                      <div className="mt-4 border-t border-slate-100 pt-4 text-sm text-slate-500">
                        <div className="flex items-center justify-between">
                          <span>
                            Betalt med {selectedPaymentMethod?.label || ""}
                          </span>
                          <span>{formatCurrency(totals.total)} kr.</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-400">
                          {formatDateTime(completedSale?.completedAtDate || null)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="flex h-full min-h-0 flex-col border-r border-slate-200 bg-white">
                  {step === "payment" ? (
                    <div className="flex h-full min-h-0 flex-col overflow-auto px-6 py-6">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">Vælg betaling</h3>
                        <p className="mt-1 text-sm text-slate-500">Betalingsmetoder</p>
                      </div>

                      <div className="mt-8">
                        <p className="text-sm font-semibold text-slate-700">
                          Kortbetalinger via Stripe
                        </p>
                        {!isConnectReady && (
                          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                            {stripeConnectLoading
                              ? "Henter betalingsstatus..."
                              : "Kortmetoder er låst. Aktivér betalinger i salgssektionen først."}
                          </div>
                        )}
                        <div className="mt-3 grid grid-cols-2 gap-3">
                          {freshaPaymentMethods.map((method) => {
                            const Icon = method.icon;
                            const isSelected = selectedPaymentMethod?.id === method.id;
                            const isDisabled = Boolean(method.connectRequired && !isConnectReady);
                            return (
                              <button
                                key={method.id}
                                type="button"
                                onClick={() => handlePaymentMethodSelect(method)}
                                disabled={isDisabled}
                                className={cn(
                                  "flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-2xl border px-4 py-4 text-sm font-medium text-slate-700",
                                  isSelected
                                    ? "border-indigo-500 bg-indigo-50/40"
                                    : "border-slate-200 hover:border-slate-300",
                                  isDisabled ? "cursor-not-allowed opacity-50" : ""
                                )}
                              >
                                <Icon className="h-5 w-5 text-emerald-500" />
                                {method.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="mt-8">
                        <p className="text-sm font-semibold text-slate-700">
                          Øvrige metoder
                        </p>
                        <div className="mt-3 grid grid-cols-2 gap-3">
                          {corePaymentMethods.map((method) => {
                            const Icon = method.icon;
                            const isSelected = selectedPaymentMethod?.id === method.id;
                            return (
                              <button
                                key={method.id}
                                type="button"
                                onClick={() => handlePaymentMethodSelect(method)}
                                className={cn(
                                  "flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-2xl border px-4 py-4 text-sm font-medium text-slate-700",
                                  isSelected
                                    ? "border-indigo-500 bg-indigo-50/40"
                                    : "border-slate-200 hover:border-slate-300"
                                )}
                              >
                                <Icon className="h-5 w-5 text-emerald-500" />
                                {method.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="px-6 pt-6">
                        <label className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm">
                          <Search className="h-4 w-4 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Søg"
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                            className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
                          />
                        </label>
                      </div>

                      <div className="px-6 pb-4 pt-4">
                        <div className="flex flex-wrap gap-2">
                          {tabs.map((tab) => (
                            <button
                              key={tab.id}
                              type="button"
                              onClick={() => setActiveTab(tab.id)}
                              className={cn(
                                "rounded-full px-4 py-2 text-sm font-medium",
                                activeTab === tab.id
                                  ? "bg-slate-900 text-white"
                                  : "text-slate-600 hover:bg-slate-100"
                              )}
                            >
                              {tab.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex-1 min-h-0 overflow-auto px-6 pb-6">
                        {activeTab === "appointments" && (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between text-xs text-slate-400">
                              <span>{appointmentsHeading}</span>
                              <div className="flex items-center gap-2">
                                <div className="relative" ref={datePresetRef}>
                                  <button
                                    type="button"
                                    onClick={() => setDatePresetOpen((prev) => !prev)}
                                    className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600"
                                  >
                                    {selectedDatePresetLabel}
                                    <ChevronDown className="h-3 w-3" />
                                  </button>
                                  {datePresetOpen && (
                                    <div className="absolute right-0 top-full z-20 mt-2 max-h-72 w-56 overflow-auto rounded-2xl border border-slate-200 bg-white py-2 shadow-xl">
                                      {datePresetOptions.map((option) => (
                                        <button
                                          key={option.id}
                                          type="button"
                                          onClick={() => handleSelectDatePreset(option.id)}
                                          className={cn(
                                            "flex w-full items-center justify-between px-4 py-2 text-left text-sm",
                                            option.id === selectedDatePreset
                                              ? "bg-indigo-50 text-indigo-600"
                                              : "text-slate-700 hover:bg-slate-50"
                                          )}
                                        >
                                          <span>{option.label}</span>
                                          {option.id === selectedDatePreset && (
                                            <Check className="h-4 w-4" />
                                          )}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={handleOpenEmployeeFilters}
                                  className={cn(
                                    "flex h-8 w-8 items-center justify-center rounded-full border",
                                    employeeFilterActive
                                      ? "border-indigo-500 text-indigo-600"
                                      : "border-slate-200 text-slate-500"
                                  )}
                                >
                                  <SlidersHorizontal className="h-3 w-3" />
                                </button>
                              </div>
                            </div>

                            {appointmentsLoading && (
                              <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
                                Henter aftaler...
                              </div>
                            )}

                            {!appointmentsLoading && appointmentsError && (
                              <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
                                Kan ikke hente aftaler lige nu.
                              </div>
                            )}

                            {!appointmentsLoading && filteredAppointments.length === 0 && (
                              <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
                                Ingen aftaler matcher dine filtre.
                              </div>
                            )}

                            <div className="space-y-3">
                              {filteredAppointments.map((appointment: any) => {
                                const service = resolveAppointmentService(appointment, services);
                                const appointmentName =
                                  appointment.client || appointment.clientEmail || "Uden navn";
                                const timeRange = getAppointmentTimeRange(appointment);
                                const duration =
                                  appointment.serviceDuration || service?.varighed || "1t";
                                const owner = resolveDrawerAppointmentOwner(appointment);
                                const serviceName = service?.navn || appointment.service || "";
                                const price =
                                  typeof appointment.servicePrice === "number"
                                    ? appointment.servicePrice
                                    : service?.pris || 0;
                                const isSelected = appointment.id === selectedAppointmentId;

                                return (
                                  <button
                                    key={appointment.id}
                                    type="button"
                                    onClick={() => handleSelectAppointment(appointment.id)}
                                    className={cn(
                                      "w-full rounded-2xl border px-4 py-4 text-left transition",
                                      isSelected
                                        ? "border-indigo-500 bg-indigo-50/40"
                                        : "border-slate-200 hover:border-slate-300"
                                    )}
                                  >
                                    <div className="flex items-start justify-between">
                                      <div>
                                        <p className="text-sm font-semibold text-slate-900">
                                          {appointmentName}
                                        </p>
                                        <p className="mt-1 text-xs text-slate-500">{timeRange}</p>
                                      </div>
                                      <p className="text-sm font-semibold text-slate-900">
                                        {formatCurrency(price)} kr.
                                      </p>
                                    </div>
                                    <p className="mt-3 text-xs text-slate-500">
                                      {duration} • {owner}
                                      {serviceName ? ` • ${serviceName}` : ""}
                                    </p>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {activeTab === "services" && (
                          <div className="space-y-3">
                            {servicesLoading && (
                              <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
                                Henter ydelser...
                              </div>
                            )}

                            {!servicesLoading && filteredServices.length === 0 && (
                              <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
                                Ingen ydelser matcher din søgning.
                              </div>
                            )}

                            {filteredServices.map((service: any) => {
                              const count = serviceCounts[service.id] || 0;
                              return (
                                <button
                                  key={service.id}
                                  type="button"
                                  onClick={() => handleAddService(service)}
                                  className="flex w-full items-center justify-between rounded-2xl border border-slate-200 px-4 py-4 text-left transition hover:border-slate-300"
                                >
                                  <div>
                                    <p className="text-sm font-semibold text-slate-900">
                                      {service.navn}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500">
                                      {service.varighed || "1 time"} • {formatCurrency(service.pris)} kr.
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    {count > 0 && (
                                      <span className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 text-xs text-slate-600">
                                        {count}
                                      </span>
                                    )}
                                    <ChevronRight className="h-4 w-4 text-slate-400" />
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {activeTab === "products" && (
                          <div className="space-y-3">
                            {productsLoading && (
                              <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
                                Henter produkter...
                              </div>
                            )}

                            {!productsLoading && productsError && (
                              <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
                                Kan ikke hente produkter lige nu.
                              </div>
                            )}

                            {!productsLoading &&
                              !productsError &&
                              filteredProducts.length === 0 && (
                                <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
                                  Ingen produkter matcher din søgning.
                                </div>
                              )}

                            {filteredProducts.map((product) => {
                              const count = productCounts[product.id] || 0;
                              const meta = getProductMeta(product);
                              return (
                                <button
                                  key={product.id}
                                  type="button"
                                  onClick={() => handleAddProduct(product)}
                                  className="flex w-full items-center justify-between rounded-2xl border border-slate-200 px-4 py-4 text-left transition hover:border-slate-300"
                                >
                                  <div>
                                    <p className="text-sm font-semibold text-slate-900">
                                      {product.name || "Produkt"}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500">
                                      {meta || "—"} • {formatCurrency(product.price)} kr.
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    {count > 0 && (
                                      <span className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 text-xs text-slate-600">
                                        {count}
                                      </span>
                                    )}
                                    <ChevronRight className="h-4 w-4 text-slate-400" />
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>

                <div className="flex h-full min-h-0 flex-col bg-white">
                  <div className="border-b border-slate-200 px-6 py-6">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      {step === "payment" ? (
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">Tilføj kunde</p>
                            <p className="text-xs text-slate-500">
                              Efterlad feltet tomt til drop-in-kunder
                            </p>
                          </div>
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                            {getInitials(selectedCustomer?.name)}
                          </div>
                        </div>
                      ) : null}

                      {selectedCustomer ? (
                        <div className={cn(step === "payment" ? "mt-4" : "")}> 
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">
                                {selectedCustomer.name}
                              </p>
                              <p className="text-xs text-slate-500">
                                {selectedCustomer.email || selectedCustomer.phone || ""}
                              </p>
                            </div>
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-600">
                              {getInitials(selectedCustomer.name)}
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600"
                            >
                              Handlinger
                              <ChevronDown className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowClientPicker(true)}
                              className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600"
                            >
                              Skift kunde
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowClientPicker(true)}
                          className="flex w-full items-center justify-center rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600"
                        >
                          Tilføj kunde
                        </button>
                      )}
                    </div>

                    {showClientPicker && (
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                        <label className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                          <Search className="h-3 w-3 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Søg efter kunde"
                            value={clientSearch}
                            onChange={(event) => setClientSearch(event.target.value)}
                            className="w-full bg-transparent text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none"
                          />
                        </label>

                        <div className="mt-3 max-h-40 overflow-auto">
                          {clientsLoading && (
                            <p className="py-4 text-center text-xs text-slate-400">
                              Henter kunder...
                            </p>
                          )}
                          {!clientsLoading && filteredClients.length === 0 && (
                            <p className="py-4 text-center text-xs text-slate-400">
                              Ingen kunder matcher din søgning.
                            </p>
                          )}
                          {!clientsLoading &&
                            filteredClients.map((client: any) => (
                              <button
                                key={client.id}
                                type="button"
                                onClick={() => handleSelectCustomer(client)}
                                className="flex w-full flex-col gap-1 rounded-xl px-3 py-2 text-left text-xs text-slate-600 hover:bg-slate-50"
                              >
                                <span className="text-sm font-semibold text-slate-900">
                                  {client.navn || "Uden navn"}
                                </span>
                                <span>
                                  {client.email || "Ingen e-mail"}
                                  {client.telefon ? ` · ${client.telefon}` : ""}
                                </span>
                              </button>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-h-0 overflow-auto px-6 py-4">
                    {lineItems.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
                        Vælg en aftale eller ydelse for at komme i gang.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {lineItems.map((item) => {
                          const meta = [item.duration, item.owner].filter(Boolean).join(" • ");
                          return (
                            <div
                              key={item.id}
                              className="flex items-start justify-between gap-3 border-l-2 pl-3"
                              style={{ borderColor: item.color || "#cbd5f5" }}
                            >
                              <div>
                                <p className="text-sm font-semibold text-slate-900">
                                  {item.name}
                                </p>
                                {meta && (
                                  <p className="text-xs text-slate-500">{meta}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold text-slate-900">
                                  {formatCurrency(item.price)} kr.
                                </p>
                                {item.source !== "appointment" && step === "cart" && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveItem(item.id)}
                                    className="text-xs text-slate-400 hover:text-slate-600"
                                  >
                                    ×
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="border-t border-slate-200 px-6 py-5">
                    <div className="space-y-2 text-sm text-slate-500">
                      <div className="flex items-center justify-between">
                        <span>Subtotal</span>
                        <span>{formatCurrency(totals.subtotal)} kr.</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Moms</span>
                        <span>{formatCurrency(totals.vat)} kr.</span>
                      </div>
                      <div className="flex items-center justify-between text-base font-semibold text-slate-900">
                        <span>I alt</span>
                        <span>{formatCurrency(totals.total)} kr.</span>
                      </div>
                    </div>

                    {step === "payment" && paymentRow}
                    {step === "payment" && selectedPaymentMethod && (
                      <p className="mt-3 text-sm font-semibold text-slate-700">
                        Fuld betaling tilføjet
                      </p>
                    )}

                    {paymentError && (
                      <p className="mt-3 text-sm text-rose-500">{paymentError}</p>
                    )}
                    {paymentInfo && (
                      <p className="mt-3 text-sm text-emerald-600">{paymentInfo}</p>
                    )}

                    <div className="mt-5 flex items-center gap-3">
                      <button
                        type="button"
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-600"
                      >
                        ...
                      </button>
                      {step === "payment" ? (
                        <button
                          type="button"
                          onClick={handlePayNow}
                          disabled={!selectedPaymentMethod || !lineItems.length || paymentSaving}
                          className={cn(
                            "flex-1 rounded-full px-4 py-3 text-sm font-semibold",
                            !selectedPaymentMethod || !lineItems.length || paymentSaving
                              ? "cursor-not-allowed bg-slate-200 text-slate-500"
                              : "bg-slate-900 text-white"
                          )}
                        >
                          {paymentSaving
                            ? selectedPaymentMethod?.id === "kortterminal"
                              ? "Sender link..."
                              : selectedPaymentMethod?.connectRequired
                              ? "Åbner Stripe..."
                              : "Behandler..."
                            : selectedPaymentMethod?.id === "kortterminal"
                            ? "Send betalingslink"
                            : "Betal nu"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={!lineItems.length}
                          onClick={handleContinueToPayment}
                          className={cn(
                            "flex-1 rounded-full px-4 py-3 text-sm font-semibold",
                            !lineItems.length
                              ? "cursor-not-allowed bg-slate-200 text-slate-500"
                              : "bg-slate-900 text-white"
                          )}
                        >
                          Fortsæt til betaling
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {employeeFilterOpen && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
              <div
                className="absolute inset-0 bg-black/30"
                onClick={handleCloseEmployeeFilters}
              />
              <div className="relative w-full max-w-[920px] rounded-[32px] bg-white px-8 py-7 shadow-2xl">
                <div className="flex items-center justify-between">
                  <h2 className="text-3xl font-semibold text-slate-900">Filtre</h2>
                  <button
                    type="button"
                    onClick={handleCloseEmployeeFilters}
                    className="flex h-10 w-10 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"
                    aria-label="Luk filtre"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <div className="mt-10">
                  <p className="text-xl font-semibold text-slate-900">Medarbejder</p>
                  <div className="relative mt-4" ref={employeeMenuRef}>
                    <button
                      type="button"
                      onClick={() => setEmployeeMenuOpen((prev) => !prev)}
                      className="flex w-full items-center justify-between rounded-2xl border border-indigo-500 px-5 py-4 text-lg font-medium text-slate-900"
                    >
                      {draftEmployeeFilter}
                      <ChevronDown className="h-5 w-5 text-slate-700" />
                    </button>
                    {employeeMenuOpen && (
                      <div className="absolute left-0 right-0 top-full z-10 mt-2 max-h-72 overflow-auto rounded-2xl border border-slate-200 bg-white py-2 shadow-xl">
                        {employeeOptions.map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => {
                              setDraftEmployeeFilter(option);
                              setEmployeeMenuOpen(false);
                            }}
                            className={cn(
                              "flex w-full items-center justify-between px-5 py-3 text-left text-sm",
                              option === draftEmployeeFilter
                                ? "bg-indigo-50 text-indigo-600"
                                : "text-slate-700 hover:bg-slate-50"
                            )}
                          >
                            <span>{option}</span>
                            {option === draftEmployeeFilter && <Check className="h-5 w-5" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-12 flex items-center justify-end gap-4">
                  <button
                    type="button"
                    onClick={handleResetEmployeeFilters}
                    className="rounded-full border border-slate-300 px-8 py-3 text-lg font-semibold text-slate-800"
                  >
                    Ryd filtre
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyEmployeeFilters}
                    className="rounded-full bg-black px-8 py-3 text-lg font-semibold text-white"
                  >
                    Godkend
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
