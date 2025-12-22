import React, { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  CircleDollarSign,
  CreditCard,
  Gift,
  Keyboard,
  MoreHorizontal,
  QrCode,
  Search,
  SlidersHorizontal,
  Smartphone,
  Split,
  X,
} from "lucide-react";
import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { cn } from "../../../lib/utils";
import { useAuth } from "../../../AuthContext";
import useAppointments from "../../../hooks/useAppointments";
import { useUserServices } from "../Ydelser/hooks/useUserServices";
import { useUserClients } from "../Klienter/hooks/useUserClients";
import { db } from "../../../firebase";

const tabs = [
  { id: "appointments", label: "Aftaler" },
  { id: "services", label: "Ydelser" },
  { id: "products", label: "Produkter" },
] as const;

type DrawerTab = (typeof tabs)[number]["id"];

type DrawerStep = "cart" | "payment" | "success";

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
  icon: React.ComponentType<{ className?: string }>;
};

type AddNowDrawerProps = {
  open: boolean;
  onClose: () => void;
  initialAppointmentId?: string | null;
  initialStep?: DrawerStep;
};

const productOptions = [
  {
    id: "product-1",
    name: "Smooth Keratin Shampoo",
    price: 199,
    description: "250 ml",
  },
  {
    id: "product-2",
    name: "Volume Mousse",
    price: 149,
    description: "200 ml",
  },
  {
    id: "product-3",
    name: "Argan H\u00e5rolie",
    price: 179,
    description: "100 ml",
  },
];

const paymentMethods: PaymentMethod[] = [
  { id: "kontanter", label: "Kontanter", group: "core", icon: Banknote },
  { id: "gavekort", label: "Gavekort", group: "core", icon: Gift },
  { id: "opdel", label: "Opdel betaling", group: "core", icon: Split },
  { id: "andet", label: "Andet", group: "core", icon: CircleDollarSign },
  { id: "kortterminal", label: "Kortterminal", group: "fresha", icon: CreditCard },
  { id: "selvbetjening", label: "Selvbetjening", group: "fresha", icon: Smartphone },
  { id: "qr", label: "QR-kode", group: "fresha", icon: QrCode },
  { id: "manuel", label: "Manual kortindtastning", group: "fresha", icon: Keyboard },
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
  if (endTime) return `${startTime} \u2013 ${endTime}`;
  const [hours, minutes] = startTime.split(":").map((part: string) => Number(part));
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return startTime;
  const nextHour = (hours + 1) % 24;
  return `${startTime} \u2013 ${String(nextHour).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
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

export default function AddNowDrawer({
  open,
  onClose,
  initialAppointmentId = null,
  initialStep = "cart",
}: AddNowDrawerProps) {
  const { user } = useAuth();
  const { appointments, loading: appointmentsLoading, error: appointmentsError } = useAppointments(
    user?.uid || null
  );
  const { services, loading: servicesLoading } = useUserServices();
  const { clients, loading: clientsLoading } = useUserClients();

  const [activeTab, setActiveTab] = useState<DrawerTab>("appointments");
  const [searchTerm, setSearchTerm] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<SelectedCustomer | null>(null);
  const [extraItems, setExtraItems] = useState<LineItem[]>([]);
  const [step, setStep] = useState<DrawerStep>("cart");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [completedSale, setCompletedSale] = useState<any>(null);

  const employeeName = user?.displayName || user?.email || "Medarbejder";

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
    setClientSearch("");
    setShowClientPicker(false);
    setSelectedAppointmentId(initialAppointmentId);
    setSelectedCustomer(null);
    setExtraItems([]);
    setStep(initialStep);
    setSelectedPaymentMethod(null);
    setPaymentError("");
    setCompletedSale(null);
  }, [open, initialAppointmentId, initialStep]);

  const selectedAppointment = useMemo(
    () => appointments.find((item: any) => item.id === selectedAppointmentId) || null,
    [appointments, selectedAppointmentId]
  );

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredAppointments = useMemo(() => {
    if (!normalizedSearch) return appointments;
    return appointments.filter((appointment: any) => {
      return [appointment.client, appointment.service, appointment.clientEmail]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedSearch));
    });
  }, [appointments, normalizedSearch]);

  const filteredServices = useMemo(() => {
    if (!normalizedSearch) return services;
    return services.filter((service: any) =>
      [service.navn, service.description]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedSearch))
    );
  }, [services, normalizedSearch]);

  const filteredProducts = useMemo(() => {
    if (!normalizedSearch) return productOptions;
    return productOptions.filter((product) =>
      [product.name, product.description]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedSearch))
    );
  }, [normalizedSearch]);

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
    const owner = selectedAppointment.calendarOwner || "f\u00e6lles konto";

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
  }, [selectedAppointment, services]);

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
        owner: "f\u00e6lles konto",
        color: service.color || "#93c5fd",
        source: "service",
        referenceId: service.id,
      },
    ]);
  };

  const handleAddProduct = (product: (typeof productOptions)[number]) => {
    setExtraItems((prev) => [
      ...prev,
      {
        id: `product-${product.id}-${Date.now()}`,
        name: product.name,
        duration: product.description,
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

  const handleContinueToPayment = () => {
    if (!lineItems.length) return;
    setStep("payment");
    setPaymentError("");
  };

  const handlePaymentMethodSelect = (method: PaymentMethod) => {
    setSelectedPaymentMethod(method);
    setPaymentError("");
  };

  const handlePayNow = async () => {
    if (!user?.uid || !selectedPaymentMethod || !lineItems.length) return;
    setPaymentSaving(true);
    setPaymentError("");

    try {
      const appointmentRef = selectedAppointment?.referenceNumber || selectedAppointment?.id || null;
      const salePayload = {
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
        employeeId: user.uid,
        employeeName,
        completedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      };

      const saleRef = await addDoc(
        collection(db, "users", user.uid, "sales"),
        salePayload
      );

      if (selectedAppointment?.id) {
        await updateDoc(
          doc(db, "users", user.uid, "appointments", selectedAppointment.id),
          {
            status: "completed",
            completedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }
        );
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
      setPaymentError("Kunne ikke gennemf\u00f8re betalingen. Pr\u00f8v igen.");
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
    step === "payment" ? "V\u00e6lg betaling" : step === "success" ? "Salg" : "L\u00e6g i kurv";
  const headerSubtitle =
    step === "success" ? "Gennemf\u00f8rt" : "Kurv \u203a Drikkepenge \u203a Betaling";

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
        <div className="flex h-full flex-col">
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

          <div className="flex-1 overflow-hidden">
            {step === "success" ? (
              <div className="grid h-full grid-cols-[120px_minmax(0,1fr)]">
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

                <div className="flex h-full flex-col overflow-auto px-10 py-8">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white">
                      <CircleCheck className="h-4 w-4" />
                      Gennemf\u00f8rt
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
                    {selectedAppointment?.location ? ` \u00b7 ${selectedAppointment.location}` : ""}
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
                                {item.duration ? ` \u2022 ${item.duration}` : ""}
                                {item.owner ? ` \u2022 ${item.owner}` : ""}
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
              <div className="grid h-full grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="flex h-full flex-col border-r border-slate-200 bg-white">
                  {step === "payment" ? (
                    <div className="flex h-full flex-col overflow-auto px-6 py-6">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">V\u00e6lg betaling</h3>
                        <p className="mt-1 text-sm text-slate-500">Betalingsmetoder</p>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3">
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

                      <div className="mt-8">
                        <p className="text-sm font-semibold text-slate-700">
                          Betalingsmetoder hos Fresha
                        </p>
                        <div className="mt-3 grid grid-cols-2 gap-3">
                          {freshaPaymentMethods.map((method) => {
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
                            placeholder="S\u00f8g"
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

                      <div className="flex-1 overflow-auto px-6 pb-6">
                        {activeTab === "appointments" && (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between text-xs text-slate-400">
                              <span>Tidligere i dag</span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600"
                                >
                                  I dag
                                  <ChevronDown className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200"
                                >
                                  <SlidersHorizontal className="h-3 w-3 text-slate-500" />
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
                                Ingen aftaler matcher din s\u00f8gning.
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
                                const owner = appointment.calendarOwner || "f\u00e6lles konto";
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
                                      {duration} \u2022 {owner}
                                      {serviceName ? ` \u2022 ${serviceName}` : ""}
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
                                Ingen ydelser matcher din s\u00f8gning.
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
                                      {service.varighed || "1 time"} \u2022 {formatCurrency(service.pris)} kr.
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
                            {filteredProducts.map((product) => {
                              const count = productCounts[product.id] || 0;
                              return (
                                <button
                                  key={product.id}
                                  type="button"
                                  onClick={() => handleAddProduct(product)}
                                  className="flex w-full items-center justify-between rounded-2xl border border-slate-200 px-4 py-4 text-left transition hover:border-slate-300"
                                >
                                  <div>
                                    <p className="text-sm font-semibold text-slate-900">
                                      {product.name}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500">
                                      {product.description} \u2022 {formatCurrency(product.price)} kr.
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

                <div className="flex h-full flex-col bg-white">
                  <div className="border-b border-slate-200 px-6 py-6">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      {step === "payment" ? (
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">Tilf\u00f8j kunde</p>
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
                          Tilf\u00f8j kunde
                        </button>
                      )}
                    </div>

                    {showClientPicker && (
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                        <label className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                          <Search className="h-3 w-3 text-slate-400" />
                          <input
                            type="text"
                            placeholder="S\u00f8g efter kunde"
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
                              Ingen kunder matcher din s\u00f8gning.
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
                                  {client.telefon ? ` \u00b7 ${client.telefon}` : ""}
                                </span>
                              </button>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 overflow-auto px-6 py-4">
                    {lineItems.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
                        V\u00e6lg en aftale eller ydelse for at komme i gang.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {lineItems.map((item) => {
                          const meta = [item.duration, item.owner].filter(Boolean).join(" \u2022 ");
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
                                    \u00d7
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
                        Fuld betaling tilf\u00f8jet
                      </p>
                    )}

                    {paymentError && (
                      <p className="mt-3 text-sm text-rose-500">{paymentError}</p>
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
                          {paymentSaving ? "Behandler..." : "Betal nu"}
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
                          Forts\u00e6t til betaling
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
