import React, { useEffect, useMemo } from "react";
import {
  CalendarDays,
  ChevronDown,
  MapPin,
  UserRound,
  UserRoundPlus,
  X,
} from "lucide-react";
import { cn } from "../../../lib/utils";
import { useAuth } from "../../../AuthContext";
import useAppointments from "../../../hooks/useAppointments";
import { useUserServices } from "../Ydelser/hooks/useUserServices";

type AppointmentDetailDrawerProps = {
  open: boolean;
  appointmentId: string | null;
  onClose: () => void;
  onOpenPayment?: (appointmentId: string) => void;
};

const statusLabels: Record<string, string> = {
  booked: "Booket",
  completed: "Gennemf\u00f8rt",
  cancelled: "Aflyst",
  pending: "Afventer",
};

const monthNames = [
  "jan.",
  "feb.",
  "mar.",
  "apr.",
  "maj",
  "jun.",
  "jul.",
  "aug.",
  "sep.",
  "okt.",
  "nov.",
  "dec.",
];

const dayNames = ["s\u00f8n.", "man.", "tir.", "ons.", "tor.", "fre.", "l\u00f8r."];

const formatDateShort = (dateStr?: string) => {
  if (!dateStr) return "";
  const [day, month, year] = dateStr.split("-").map((part) => Number(part));
  if (!day || !month || !year) return "";
  return `${day} ${monthNames[month - 1]} ${year}`;
};

const formatHeaderDate = (dateStr?: string) => {
  if (!dateStr) return "";
  const [day, month, year] = dateStr.split("-").map((part) => Number(part));
  if (!day || !month || !year) return "";
  const date = new Date(year, month - 1, day);
  const dayLabel = dayNames[date.getDay()];
  return `${dayLabel} ${day} ${monthNames[month - 1]}`;
};

const formatDateTime = (dateStr?: string, timeStr?: string) => {
  const dateLabel = formatDateShort(dateStr);
  if (!dateLabel) return "";
  if (!timeStr) return dateLabel;
  return `${dateLabel}, ${timeStr}`;
};

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
      color: "#60a5fa",
    };
  }

  return null;
};

const getTimeRange = (appointment: any) => {
  const startTime = appointment?.startTime || "";
  const endTime = appointment?.endTime || "";
  if (!startTime) return "";
  if (endTime) return `${startTime} \u2013 ${endTime}`;
  const [hours, minutes] = startTime.split(":").map((part: string) => Number(part));
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return startTime;
  const nextHour = (hours + 1) % 24;
  return `${startTime} \u2013 ${String(nextHour).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

const getDurationLabel = (appointment: any, service: any) => {
  if (appointment?.serviceDuration) return appointment.serviceDuration;
  if (service?.varighed) return service.varighed;
  if (!appointment?.startTime || !appointment?.endTime) return "";
  const [startHours, startMinutes] = appointment.startTime.split(":").map(Number);
  const [endHours, endMinutes] = appointment.endTime.split(":").map(Number);
  if ([startHours, startMinutes, endHours, endMinutes].some((value) => Number.isNaN(value))) {
    return "";
  }
  const startTotal = startHours * 60 + startMinutes;
  const endTotal = endHours * 60 + endMinutes;
  const diff = Math.max(endTotal - startTotal, 0);
  if (diff === 0) return "";
  const hours = Math.floor(diff / 60);
  const minutes = diff % 60;
  if (hours && minutes) return `${hours}t ${minutes} min`;
  if (hours) return `${hours}t`;
  return `${minutes} min`;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("da-DK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);

export default function AppointmentDetailDrawer({
  open,
  appointmentId,
  onClose,
  onOpenPayment,
}: AppointmentDetailDrawerProps) {
  const { user } = useAuth();
  const { appointments, loading, error } = useAppointments(user?.uid || null);
  const { services } = useUserServices();

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

  const appointment = useMemo(
    () => appointments.find((item: any) => item.id === appointmentId) || null,
    [appointments, appointmentId]
  );

  const service = useMemo(
    () => resolveAppointmentService(appointment, services),
    [appointment, services]
  );

  const refRaw = appointment?.referenceNumber || appointment?.id || "";
  const refLabel = refRaw
    ? String(refRaw).startsWith("#")
      ? String(refRaw)
      : `#${refRaw}`
    : "";

  const statusLabel = statusLabels[String(appointment?.status || "")] || "Booket";
  const headerDate = formatHeaderDate(appointment?.startDate);
  const headerTime = appointment?.startTime || "";
  const createdAtRaw = appointment?.createdAt?.toDate
    ? appointment.createdAt.toDate()
    : appointment?.createdAt
    ? new Date(appointment.createdAt)
    : null;
  const createdLabel = createdAtRaw
    ? formatDateShort(
        `${String(createdAtRaw.getDate()).padStart(2, "0")}-${String(
          createdAtRaw.getMonth() + 1
        ).padStart(2, "0")}-${createdAtRaw.getFullYear()}`
      )
    : appointment?.startDate
    ? formatDateShort(appointment.startDate)
    : "";

  const appointmentName =
    appointment?.client || appointment?.clientEmail || "Ukendt kunde";
  const appointmentEmail = appointment?.clientEmail || "";
  const serviceName = service?.navn || appointment?.service || appointment?.title || "";
  const durationLabel = getDurationLabel(appointment, service);
  const ownerLabel = appointment?.calendarOwner || "f\u00e6lles konto";
  const priceLabel = formatCurrency(
    typeof appointment?.servicePrice === "number"
      ? appointment.servicePrice
      : service?.pris || 0
  );
  const timeRange = getTimeRange(appointment);
  const canOpenPayment =
    Boolean(onOpenPayment) &&
    Boolean(appointment?.id) &&
    appointment?.status !== "completed" &&
    appointment?.status !== "cancelled";

  const handleOpenPayment = () => {
    if (!canOpenPayment || !appointment?.id) return;
    onOpenPayment?.(appointment.id);
  };

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
        onClick={onClose}
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
              <p className="text-xs text-slate-400">
                Aftale{refLabel ? ` \u00b7 ${refLabel}` : ""}
              </p>
              <h2 className="mt-1 text-lg font-semibold text-slate-900">Aftaledetaljer</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50"
              aria-label="Luk"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {open && loading && (
            <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
              Henter aftale...
            </div>
          )}

          {open && !loading && error && (
            <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
              Kunne ikke hente aftalen lige nu.
            </div>
          )}

          {open && !loading && !error && !appointment && (
            <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
              Aftalen blev ikke fundet.
            </div>
          )}

          {open && !loading && !error && appointment && (
            <div className="flex-1 overflow-hidden">
              <div className="grid h-full grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px]">
                <div className="flex h-full flex-col">
                  <div className="px-8 py-8">
                    <div className="flex flex-col items-center gap-3 text-center">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 text-lg font-semibold text-indigo-600">
                        {getInitials(appointmentName)}
                      </div>
                      <div>
                        <p className="text-base font-semibold text-slate-900">
                          {appointmentName}
                        </p>
                        <p className="text-sm text-slate-500">{appointmentEmail || ""}</p>
                      </div>
                      <div className="mt-2 flex flex-wrap justify-center gap-2">
                        <button
                          type="button"
                          className="flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600"
                        >
                          Handlinger
                          <ChevronDown className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          className="rounded-full border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600"
                        >
                          Se profil
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 border-t border-slate-200 px-8 py-6">
                    <div className="space-y-4 text-sm text-slate-600">
                      <div className="flex items-center gap-3">
                        <UserRound className="h-4 w-4 text-slate-400" />
                        <span>Tilf\u00f8j stedord</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CalendarDays className="h-4 w-4 text-slate-400" />
                        <span>Tilf\u00f8j f\u00f8dselsdato</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <MapPin className="h-4 w-4 text-slate-400" />
                        <span>{appointment?.location || "Tilf\u00f8j sted"}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <UserRoundPlus className="h-4 w-4 text-slate-400" />
                        <span>
                          Oprettet den {createdLabel || "19 dec. 2025"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex h-full flex-col border-l border-slate-200 bg-white">
                  <div className="bg-blue-600 px-6 py-6 text-white">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold">{headerDate || "fre. 19 dec."}</p>
                        <p className="mt-1 text-xs text-white/80">
                          {headerTime || "13:00"} \u00b7 Gentages ikke
                        </p>
                      </div>
                      <button
                        type="button"
                        className="flex items-center gap-2 rounded-full border border-white/40 px-3 py-1 text-xs font-semibold text-white"
                      >
                        {statusLabel}
                        <ChevronDown className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-auto px-6 py-6">
                    <h3 className="text-sm font-semibold text-slate-900">Tjenester</h3>
                    <div className="mt-4 space-y-4">
                      <div
                        className="flex items-start justify-between gap-3 border-l-2 pl-3"
                        style={{ borderColor: service?.color || "#60a5fa" }}
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {serviceName || "Tjeneste"}
                          </p>
                          <p className="text-xs text-slate-500">
                            {timeRange || "13:00"}
                            {durationLabel ? ` \u2022 ${durationLabel}` : ""}
                            {ownerLabel ? ` \u2022 ${ownerLabel}` : ""}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-slate-900">
                          {priceLabel} kr.
                        </p>
                      </div>

                      <button
                        type="button"
                        className="flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700"
                      >
                        <span className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-200">
                          +
                        </span>
                        Tilf\u00f8j tjeneste
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-slate-200 px-6 py-6">
                    <div className="flex items-center justify-between text-sm font-semibold text-slate-900">
                      <span>I alt</span>
                      <span>{priceLabel} kr.</span>
                    </div>
                    <div className="mt-5 flex items-center gap-3">
                      <button
                        type="button"
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-600"
                      >
                        ...
                      </button>
                      <button
                        type="button"
                        onClick={handleOpenPayment}
                        disabled={!canOpenPayment}
                        className={cn(
                          "flex-1 rounded-full border px-4 py-2 text-sm font-semibold",
                          canOpenPayment
                            ? "border-slate-200 text-slate-700"
                            : "cursor-not-allowed border-slate-200 text-slate-400"
                        )}
                      >
                        Betal nu
                      </button>
                      <button
                        type="button"
                        onClick={handleOpenPayment}
                        disabled={!canOpenPayment}
                        className={cn(
                          "flex-1 rounded-full px-4 py-2 text-sm font-semibold",
                          canOpenPayment
                            ? "bg-slate-900 text-white"
                            : "cursor-not-allowed bg-slate-200 text-slate-500"
                        )}
                      >
                        Betaling
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
