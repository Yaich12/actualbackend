"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Sidebar, SidebarBody, SidebarLink } from "./sidebar";
import {
  Calendar,
  Users,
  BadgeDollarSign,
  FileText,
  Settings,
  LogOut,
  Bell,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "../../lib/utils";
import { useAuth } from "../../AuthContext";
import { useLanguage } from "../../LanguageContext";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../firebase";
import useAppointments from "../../hooks/useAppointments";
import { useUserServices } from "../../features/booking/Ydelser/hooks/useUserServices";

type BookingSidebarLayoutProps = {
  children: React.ReactNode;
};

type PaymentNotificationItem = {
  id: string;
  title: string;
  message: string;
  customerName: string;
  amountLabel: string;
  appointmentRef: string;
  createdAt: Date | null;
};

const getInitials = (value?: string | null) => {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) return "—";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  const candidateParts =
    parts.length > 1 ? parts : parts[0].split(/[@._-]+/).filter(Boolean);
  return candidateParts
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
};

const toDateValue = (value: any): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === "function") {
    const converted = value.toDate();
    return converted instanceof Date ? converted : null;
  }
  if (typeof value === "object" && typeof value.seconds === "number") {
    return new Date(value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1e6));
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
};

const formatBadgeCount = (count: number) => (count > 99 ? "99+" : String(count));

export function BookingSidebarLayout({ children }: BookingSidebarLayoutProps) {
  const [open, setOpen] = useState(true);
  const [clinicName, setClinicName] = useState("");
  const [hasTeamAccess, setHasTeamAccess] = useState(false);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string>("");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [userMenuView, setUserMenuView] = useState<"overview" | "notifications">("overview");
  const [notificationError, setNotificationError] = useState("");
  const [approvingNotificationIds, setApprovingNotificationIds] = useState<string[]>([]);
  const [paymentNotifications, setPaymentNotifications] = useState<PaymentNotificationItem[]>([]);
  const [paymentNotificationsLoading, setPaymentNotificationsLoading] = useState(false);
  const [markingPaymentNotificationIds, setMarkingPaymentNotificationIds] = useState<string[]>([]);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOutUser } = useAuth();
  const { t, language, languageOptions, locale } = useLanguage();
  const {
    appointments = [],
    loading: appointmentsLoading,
  } = useAppointments(user?.uid || null);
  const { services: userServices = [] } = useUserServices();
  const userName =
    user?.displayName || user?.email || t("booking.topbar.defaultUser", "Selma bruger");
  const clinicDisplayName =
    clinicName || t("booking.topbar.clinicSettings", "Klinik overblik");
  const clinicOverviewLabel = clinicDisplayName;
  const userInitials = getInitials(user?.displayName || user?.email);
  const currentLanguageLabel = useMemo(() => {
    const match = languageOptions.find((option) => option.code === language);
    return match?.label || language.toUpperCase();
  }, [language, languageOptions]);
  const isCatalogRoute =
    location.pathname.startsWith("/booking/ydelser") ||
    location.pathname.startsWith("/booking/forloeb") ||
    location.pathname.startsWith("/booking/produkt");
  const pendingBookingNotifications = useMemo(() => {
    const serviceNameById = new Map(
      userServices.map((service) => [String(service?.id || ""), String(service?.navn || "").trim()])
    );
    const items = appointments
      .filter((appointment) => {
        const status = String(appointment?.status || "").toLowerCase();
        const source = String(appointment?.source || "").toLowerCase();
        const createdBy = String(appointment?.createdBy || "").trim();
        const acknowledged =
          Boolean(appointment?.notificationAcknowledged) ||
          Boolean(appointment?.notificationAcknowledgedAt);
        const isExternalSource =
          source.includes("publicbooking") ||
          source.includes("public_booking") ||
          source.includes("public");
        const isCreatedByOther = Boolean(user?.uid && createdBy && createdBy !== user.uid);
        const isExternalBooking = status === "requested" || isExternalSource || isCreatedByOther;
        return isExternalBooking && !acknowledged;
      })
      .map((appointment) => {
        const start = toDateValue(appointment?.start || appointment?.startIso);
        const end = toDateValue(appointment?.end || appointment?.endIso);
        const bookedAt =
          toDateValue(appointment?.createdAt) ||
          toDateValue(appointment?.createdAtIso) ||
          toDateValue(appointment?.updatedAt) ||
          start;
        const fullName = [appointment?.firstName, appointment?.lastName]
          .map((part) => String(part || "").trim())
          .filter(Boolean)
          .join(" ");
        const clientName =
          String(appointment?.client || "").trim() ||
          fullName ||
          String(appointment?.title || "").trim() ||
          t("booking.notifications.unknownClient", "Ukendt klient");
        const rawServiceId = String(appointment?.serviceId || "").trim();
        const rawServiceValue = String(appointment?.service || "").trim();
        const resolvedServiceName = rawServiceId ? serviceNameById.get(rawServiceId) : "";
        const serviceValueLooksLikeId =
          Boolean(rawServiceValue) &&
          (rawServiceValue === rawServiceId || /^[a-zA-Z0-9_-]{16,}$/.test(rawServiceValue));
        const serviceLabel =
          resolvedServiceName ||
          (!serviceValueLooksLikeId && rawServiceValue ? rawServiceValue : "") ||
          t("booking.notifications.unknownService", "Ikke angivet");
        const notes = String(appointment?.notes || "").trim();

        return {
          id: String(appointment?.id || ""),
          status: String(appointment?.status || ""),
          clientName,
          phone:
            String(appointment?.clientPhone || "").trim() ||
            String(appointment?.phone || "").trim() ||
            "—",
          service:
            serviceLabel,
          notes,
          start,
          end,
          bookedAt,
        };
      })
      .filter((appointment) => Boolean(appointment.id));

    items.sort((a, b) => {
      const aTime = a.bookedAt ? a.bookedAt.getTime() : 0;
      const bTime = b.bookedAt ? b.bookedAt.getTime() : 0;
      return bTime - aTime;
    });

    return items;
  }, [appointments, t, user?.uid, userServices]);
  const notificationFeed = useMemo(() => {
    const paymentItems = paymentNotifications.map((notification) => ({
      id: notification.id,
      kind: "payment" as const,
      createdAt: notification.createdAt,
      payment: notification,
    }));
    const bookingItems = pendingBookingNotifications.map((notification) => ({
      id: notification.id,
      kind: "booking" as const,
      createdAt: notification.bookedAt,
      booking: notification,
    }));
    return [...paymentItems, ...bookingItems].sort((a, b) => {
      const aTime = a.createdAt ? a.createdAt.getTime() : 0;
      const bTime = b.createdAt ? b.createdAt.getTime() : 0;
      return bTime - aTime;
    });
  }, [paymentNotifications, pendingBookingNotifications]);
  const unreadNotificationCount = notificationFeed.length;
  const unreadNotificationCountLabel = formatBadgeCount(unreadNotificationCount);

  const formatDateTime = React.useCallback(
    (dateValue: Date | null | undefined, options?: Intl.DateTimeFormatOptions) => {
      if (!dateValue) return "—";
      try {
        return new Intl.DateTimeFormat(locale || "da-DK", options).format(dateValue);
      } catch {
        return dateValue.toLocaleString();
      }
    },
    [locale]
  );

  const formatBookingWindow = React.useCallback(
    (start: Date | null, end: Date | null) => {
      if (!start) return "—";
      const dayPart = formatDateTime(start, {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
      const startTimePart = formatDateTime(start, {
        hour: "2-digit",
        minute: "2-digit",
      });
      const endTimePart = end
        ? formatDateTime(end, {
            hour: "2-digit",
            minute: "2-digit",
          })
        : null;
      return endTimePart ? `${dayPart} · ${startTimePart} - ${endTimePart}` : `${dayPart} · ${startTimePart}`;
    },
    [formatDateTime]
  );

  useEffect(() => {
    if (!user?.uid) {
      setClinicName("");
      setHasTeamAccess(false);
      return;
    }

    const ref = doc(db, "users", user.uid);
    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setClinicName("");
          setHasTeamAccess(false);
          setProfilePhotoUrl("");
          return;
        }
        const data = snap.data();
        if (typeof data?.clinicName === "string") {
          setClinicName(data.clinicName);
        } else {
          setClinicName("");
        }
        if (typeof data?.photoURL === "string") {
          setProfilePhotoUrl(data.photoURL);
        } else {
          setProfilePhotoUrl(user?.photoURL || "");
        }
        setHasTeamAccess(data?.accountType === "team" || data?.hasTeam === true);
      },
      (err) => {
        console.error("[BookingSidebarLayout] Failed to load clinic name", err);
        setClinicName("");
        setHasTeamAccess(false);
        setProfilePhotoUrl(user?.photoURL || "");
      }
    );

    return () => unsubscribe();
  }, [user?.photoURL, user?.uid]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!userMenuRef.current) return;
      if (!userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
        setUserMenuView("overview");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      setPaymentNotifications([]);
      setPaymentNotificationsLoading(false);
      return;
    }

    setPaymentNotificationsLoading(true);
    const notificationsQuery = query(
      collection(db, "users", user.uid, "notifications"),
      orderBy("createdAt", "desc"),
      limit(25)
    );
    const unsubscribe = onSnapshot(
      notificationsQuery,
      (snap) => {
        const items: PaymentNotificationItem[] = snap.docs
          .map((docSnap) => {
            const data = docSnap.data() || {};
            const type = String(data?.type || "").toLowerCase();
            if (type !== "payment_received") return null;
            const readAt = toDateValue(data?.readAt);
            if (readAt) return null;

            return {
              id: docSnap.id,
              title: String(data?.title || "Betaling modtaget"),
              message: String(data?.message || ""),
              customerName: String(data?.customerName || "").trim(),
              amountLabel: String(data?.amountLabel || "").trim(),
              appointmentRef: String(data?.appointmentRef || "").trim(),
              createdAt: toDateValue(data?.createdAt) || toDateValue(data?.updatedAt),
            };
          })
          .filter(Boolean) as PaymentNotificationItem[];

        items.sort((a, b) => {
          const aTime = a?.createdAt ? a.createdAt.getTime() : 0;
          const bTime = b?.createdAt ? b.createdAt.getTime() : 0;
          return bTime - aTime;
        });

        setPaymentNotifications(items);
        setPaymentNotificationsLoading(false);
      },
      (error) => {
        console.error("[BookingSidebarLayout] Failed to load payment notifications", error);
        setPaymentNotifications([]);
        setPaymentNotificationsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  const handleCalendarClick = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("booking:calendarClick"));
      }
      navigate("/booking");
    },
    [navigate]
  );

  const handleApproveNotification = React.useCallback(
    async (appointmentId: string, status: string) => {
      if (!user?.uid || !appointmentId) return;
      if (approvingNotificationIds.includes(appointmentId)) return;
      setNotificationError("");
      setApprovingNotificationIds((prev) => [...prev, appointmentId]);
      try {
        const ref = doc(db, "users", user.uid, "appointments", appointmentId);
        const payload: Record<string, unknown> = {
          notificationAcknowledged: true,
          notificationAcknowledgedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        if (String(status || "").toLowerCase() === "requested") {
          payload.status = "booked";
        }
        await updateDoc(ref, payload);
      } catch (error) {
        console.error("[BookingSidebarLayout] Failed to approve booking notification", error);
        setNotificationError(
          t("booking.notifications.errors.approveFailed", "Kunne ikke godkende notifikationen.")
        );
      } finally {
        setApprovingNotificationIds((prev) => prev.filter((id) => id !== appointmentId));
      }
    },
    [approvingNotificationIds, t, user?.uid]
  );

  const handleMarkPaymentNotificationRead = React.useCallback(
    async (notificationId: string) => {
      if (!user?.uid || !notificationId) return;
      if (markingPaymentNotificationIds.includes(notificationId)) return;
      setNotificationError("");
      setMarkingPaymentNotificationIds((prev) => [...prev, notificationId]);
      try {
        const ref = doc(db, "users", user.uid, "notifications", notificationId);
        await updateDoc(ref, {
          status: "read",
          readAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        console.error("[BookingSidebarLayout] Failed to mark payment notification as read", error);
        setNotificationError(
          t("booking.notifications.errors.markReadFailed", "Kunne ikke markere notifikationen som læst.")
        );
      } finally {
        setMarkingPaymentNotificationIds((prev) => prev.filter((id) => id !== notificationId));
      }
    },
    [markingPaymentNotificationIds, t, user?.uid]
  );

  const links = [
    {
      label: t("booking.sidebar.calendar", "Kalender"),
      href: "/booking",
      icon: <Calendar className="h-5 w-5 flex-shrink-0" />,
      onClick: handleCalendarClick,
    },
    {
      label: t("booking.sidebar.clients", "Klienter"),
      href: "/booking/klienter",
      icon: <Users className="h-5 w-5 flex-shrink-0" />,
    },
    {
      label: t("booking.sidebar.services", "Ydelser"),
      href: "/booking/ydelser",
      icon: <BadgeDollarSign className="h-5 w-5 flex-shrink-0" />,
    },
    {
      label: t("booking.sidebar.invoices", "Salg"),
      href: "/booking/fakturaer",
      icon: <FileText className="h-5 w-5 flex-shrink-0" />,
    },
    ...(hasTeamAccess
      ? [
          {
            label: t("booking.sidebar.team", "Team"),
            href: "/booking/team",
            icon: <Users className="h-5 w-5 flex-shrink-0" />,
          },
        ]
      : []),
    {
      label: t("booking.sidebar.settings", "Indstillinger"),
      href: "/booking/settings",
      icon: <Settings className="h-5 w-5 flex-shrink-0" />,
    },
  ];
  const catalogLinks = [
    { label: t("booking.sidebar.services", "Ydelser"), href: "/booking/ydelser" },
    { label: t("booking.sidebar.forloeb", "Forløb"), href: "/booking/forloeb" },
    { label: t("booking.sidebar.product", "Produkt"), href: "/booking/produkt" },
  ];
  return (
    <div className="booking-shell">
      <header className="booking-shell-topbar">
        <div className="booking-shell-topbar-left">
          <SelmaLogoMark />
        </div>
        <div className="booking-shell-topbar-right">
          <div className="booking-shell-user-menu" ref={userMenuRef}>
            <button
              type="button"
              className="booking-shell-user"
              onClick={() => {
                setUserMenuOpen((openState) => {
                  const nextOpen = !openState;
                  if (nextOpen) {
                    setUserMenuView("overview");
                    setNotificationError("");
                  }
                  return nextOpen;
                });
              }}
              aria-haspopup="menu"
              aria-expanded={userMenuOpen}
            >
              {profilePhotoUrl ? (
                <img src={profilePhotoUrl} alt={userName} />
              ) : (
                <span>{userInitials}</span>
              )}
              {unreadNotificationCount > 0 ? (
                <span className="booking-shell-user-badge">{unreadNotificationCountLabel}</span>
              ) : null}
            </button>
            {userMenuOpen && (
              <div
                className={cn(
                  "booking-user-menu",
                  userMenuView === "notifications" ? "booking-user-menu--notifications" : ""
                )}
                role="menu"
              >
                {userMenuView === "overview" ? (
                  <>
                    <div className="booking-user-summary">
                      <div className="booking-user-summary-avatar">
                        {profilePhotoUrl ? (
                          <img src={profilePhotoUrl} alt={userName} />
                        ) : (
                          <span>{userInitials}</span>
                        )}
                      </div>
                      <div className="booking-user-summary-text">
                        <div className="booking-user-name">{userName}</div>
                        <div className="booking-user-email">{user?.email || "—"}</div>
                      </div>
                    </div>
                    <div className="booking-user-menu-list">
                      <button
                        type="button"
                        className="booking-user-menu-item"
                        onClick={() => {
                          setUserMenuOpen(false);
                          setUserMenuView("overview");
                          navigate("/booking/settings");
                        }}
                      >
                        {t("booking.topbar.profile", "Min profil")}
                      </button>
                      <button type="button" className="booking-user-menu-item">
                        {t("booking.topbar.personalSettings", "Personlige indstillinger")}
                      </button>
                      <button
                        type="button"
                        className="booking-user-menu-item booking-user-menu-item--row"
                        onClick={() => {
                          setUserMenuView("notifications");
                          setNotificationError("");
                        }}
                      >
                        <span className="booking-user-menu-item-row-left">
                          <Bell className="h-4 w-4" />
                          <span>{t("booking.notifications.title", "Notifikationer")}</span>
                        </span>
                        <span className="booking-user-menu-item-row-right">
                          {unreadNotificationCount > 0 ? (
                            <span className="booking-user-menu-count">{unreadNotificationCountLabel}</span>
                          ) : null}
                          <ChevronRight className="h-4 w-4" />
                        </span>
                      </button>
                    </div>
                    <div className="booking-user-menu-divider" />
                    <div className="booking-user-menu-list">
                      <button
                        type="button"
                        className="booking-user-menu-item booking-user-menu-item--inline-support"
                      >
                        <span>{t("booking.topbar.help", "Hjælp og support")}</span>
                        <span className="booking-user-menu-item-meta">+45 24 75 22 92</span>
                      </button>
                      <button type="button" className="booking-user-menu-item">
                        {currentLanguageLabel}
                      </button>
                      <button
                        type="button"
                        className="booking-user-menu-item booking-user-menu-logout"
                        onClick={async () => {
                          setUserMenuOpen(false);
                          setUserMenuView("overview");
                          try {
                            await signOutUser();
                          } catch (err) {
                            console.error("[BookingSidebarLayout] logout failed", err);
                          } finally {
                            navigate("/");
                          }
                        }}
                      >
                        {t("booking.topbar.logout", "Log ud")}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="booking-user-notifications-panel">
                    <div className="booking-user-notifications-header">
                      <button
                        type="button"
                        className="booking-user-notifications-back"
                        onClick={() => {
                          setUserMenuView("overview");
                          setNotificationError("");
                        }}
                      >
                        <ArrowLeft className="h-4 w-4" />
                        <span>{t("booking.notifications.back", "Tilbage")}</span>
                      </button>
                      <div className="booking-user-notifications-title-wrap">
                        <div className="booking-user-notifications-title">
                          {t("booking.notifications.title", "Notifikationer")}
                        </div>
                        <div className="booking-user-notifications-subtitle">
                          {t(
                            "booking.notifications.subtitle",
                            "Nye bookinganmodninger og betalinger."
                          )}
                        </div>
                      </div>
                    </div>

                    {notificationError ? (
                      <div className="booking-user-notifications-error">{notificationError}</div>
                    ) : null}

                    <div className="booking-user-notifications-list">
                      {appointmentsLoading || paymentNotificationsLoading ? (
                        <div className="booking-user-notifications-empty">
                          {t("booking.notifications.loading", "Henter notifikationer...")}
                        </div>
                      ) : notificationFeed.length === 0 ? (
                        <div className="booking-user-notifications-empty">
                          {t("booking.notifications.empty", "Ingen nye notifikationer.")}
                        </div>
                      ) : (
                        notificationFeed.map((entry) => {
                          if (entry.kind === "payment") {
                            const payment = entry.payment;
                            const isMarkingRead = markingPaymentNotificationIds.includes(payment.id);
                            return (
                              <article className="booking-user-notification-card" key={`payment-${payment.id}`}>
                                <div className="booking-user-notification-top">
                                  <h4 className="booking-user-notification-client">
                                    {payment.title || t("booking.notifications.payment.title", "Betaling modtaget")}
                                  </h4>
                                  <p className="booking-user-notification-booked-at">
                                    {t("booking.notifications.payment.paidAt", "Betalt")}:{" "}
                                    {formatDateTime(payment.createdAt, {
                                      day: "2-digit",
                                      month: "2-digit",
                                      year: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </p>
                                </div>
                                <div className="booking-user-notification-grid">
                                  <div className="booking-user-notification-item booking-user-notification-item--full">
                                    <span className="booking-user-notification-label">
                                      {t("booking.notifications.payment.customer", "Patient")}
                                    </span>
                                    <span className="booking-user-notification-value">
                                      {payment.customerName || "—"}
                                    </span>
                                  </div>
                                  <div className="booking-user-notification-item">
                                    <span className="booking-user-notification-label">
                                      {t("booking.notifications.payment.amount", "Beløb")}
                                    </span>
                                    <span className="booking-user-notification-value">
                                      {payment.amountLabel || "—"}
                                    </span>
                                  </div>
                                  <div className="booking-user-notification-item">
                                    <span className="booking-user-notification-label">
                                      {t("booking.notifications.payment.reference", "Reference")}
                                    </span>
                                    <span className="booking-user-notification-value">
                                      {payment.appointmentRef || "—"}
                                    </span>
                                  </div>
                                  {payment.message ? (
                                    <div className="booking-user-notification-item booking-user-notification-item--full">
                                      <span className="booking-user-notification-label">
                                        {t("booking.notifications.payment.note", "Besked")}
                                      </span>
                                      <span className="booking-user-notification-value booking-user-notification-value--multiline">
                                        {payment.message}
                                      </span>
                                    </div>
                                  ) : null}
                                </div>
                                <div className="booking-user-notification-actions">
                                  <button
                                    type="button"
                                    className="booking-user-notification-approve"
                                    onClick={() => handleMarkPaymentNotificationRead(payment.id)}
                                    disabled={isMarkingRead}
                                  >
                                    {isMarkingRead
                                      ? t("booking.notifications.markingRead", "Opdaterer...")
                                      : t("booking.notifications.markRead", "Markér som læst")}
                                  </button>
                                </div>
                              </article>
                            );
                          }

                          const notification = entry.booking;
                          const isApproving = approvingNotificationIds.includes(notification.id);
                          return (
                            <article className="booking-user-notification-card" key={`booking-${notification.id}`}>
                              <div className="booking-user-notification-top">
                                <h4 className="booking-user-notification-client">
                                  {notification.clientName}
                                </h4>
                                <p className="booking-user-notification-booked-at">
                                  {t("booking.notifications.bookedAt", "Booket")}:{" "}
                                  {formatDateTime(notification.bookedAt, {
                                    day: "2-digit",
                                    month: "2-digit",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </p>
                              </div>

                              <div className="booking-user-notification-grid">
                                <div className="booking-user-notification-item booking-user-notification-item--full booking-user-notification-item--when">
                                  <span className="booking-user-notification-label">
                                    {t("booking.notifications.when", "Hvornår")}
                                  </span>
                                  <span className="booking-user-notification-value booking-user-notification-value--single-line">
                                    {formatBookingWindow(notification.start, notification.end)}
                                  </span>
                                </div>
                                <div className="booking-user-notification-item">
                                  <span className="booking-user-notification-label">
                                    {t("booking.notifications.phone", "Telefon")}
                                  </span>
                                  <span className="booking-user-notification-value">
                                    {notification.phone}
                                  </span>
                                </div>
                                <div className="booking-user-notification-item booking-user-notification-item--full">
                                  <span className="booking-user-notification-label">
                                    {t("booking.notifications.service", "Ydelse")}
                                  </span>
                                  <span className="booking-user-notification-value">
                                    {notification.service}
                                  </span>
                                </div>
                                {notification.notes ? (
                                  <div className="booking-user-notification-item booking-user-notification-item--full">
                                    <span className="booking-user-notification-label">
                                      {t("booking.notifications.notes", "Bemærkninger")}
                                    </span>
                                    <span className="booking-user-notification-value booking-user-notification-value--multiline">
                                      {notification.notes}
                                    </span>
                                  </div>
                                ) : null}
                              </div>

                              <div className="booking-user-notification-actions">
                                <button
                                  type="button"
                                  className="booking-user-notification-approve"
                                  onClick={() =>
                                    handleApproveNotification(notification.id, notification.status)
                                  }
                                  disabled={isApproving}
                                >
                                  {isApproving
                                    ? t("booking.notifications.approving", "Godkender...")
                                    : t("booking.notifications.approve", "Godkend")}
                                </button>
                              </div>
                            </article>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="booking-shell-body">
        <div className="booking-shell-layout flex h-full w-full overflow-hidden bg-slate-50">
          <Sidebar open={open} setOpen={setOpen}>
            <SidebarBody
              className={cn(
                "justify-between gap-10 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800"
              )}
            >
              <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
                <button
                  type="button"
                  onClick={() => navigate("/booking/overview")}
                  className="flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-white/10 transition"
                >
                  <div className="h-8 w-8 flex-shrink-0 rounded-full bg-gradient-to-br from-indigo-400 via-sky-400 to-violet-500 shadow-[0_0_0_1px_rgba(255,255,255,0.2)] flex items-center justify-center text-xs font-semibold text-white">
                    S+
                  </div>
                  {open && (
                    <div className="flex flex-col text-left text-base text-white">
                      <span className="font-semibold">{clinicOverviewLabel}</span>
                    </div>
                  )}
                </button>

                <div className="mt-6 flex flex-col gap-1">
                  {links.map((link) => {
                    const isActive =
                      link.href === "/booking"
                        ? location.pathname === "/booking"
                        : link.href === "/booking/ydelser"
                        ? isCatalogRoute
                        : location.pathname === link.href ||
                          location.pathname.startsWith(`${link.href}/`);
                    const iconNode = React.cloneElement(link.icon as any, {
                      className:
                        "h-6 w-6 flex-shrink-0 " +
                        (isActive
                          ? "text-slate-900"
                          : "text-white group-hover/sidebar:text-white"),
                    });
                    const shouldShowSettingsBadge =
                      link.href === "/booking/settings" && unreadNotificationCount > 0;
                    return (
                      <SidebarLink
                        key={link.href}
                        link={{
                          ...link,
                          icon: shouldShowSettingsBadge ? (
                            <span className="booking-sidebar-icon-badge-wrap">
                              {iconNode}
                              <span className="booking-sidebar-icon-badge">
                                {unreadNotificationCountLabel}
                              </span>
                            </span>
                          ) : (
                            iconNode
                          ),
                        }}
                        className={cn(
                          "rounded-xl px-2 text-base font-semibold",
                          isActive
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-white hover:bg-white/15"
                        )}
                      />
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-2 pb-3">
                <SidebarLink
                  link={{
                    label: t("booking.sidebar.logout", "Log ud"),
                    href: "/",
                    icon: (
                      <LogOut className="h-6 w-6 flex-shrink-0 text-white group-hover/sidebar:text-white" />
                    ),
                    onClick: async (e) => {
                      e.preventDefault();
                      try {
                        await signOutUser();
                      } catch (err) {
                        console.error("[BookingSidebarLayout] logout failed", err);
                      } finally {
                        navigate("/");
                      }
                    },
                  }}
                  className="rounded-xl px-2 text-base text-white hover:bg-white/15 text-left"
                />
              </div>
            </SidebarBody>
          </Sidebar>

          {isCatalogRoute && (
            <aside className="flex h-full w-64 flex-shrink-0 flex-col border-r border-slate-200 bg-white">
              <div className="px-6 pb-4 pt-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                  {t("booking.sidebar.catalog", "Katalog")}
                </p>
                <h2 className="mt-2 text-xl font-semibold text-slate-900">
                  {t("booking.sidebar.services", "Ydelser")}
                </h2>
              </div>
              <div className="flex flex-col gap-1 px-3">
                {catalogLinks.map((link) => {
                  const isActive =
                    location.pathname === link.href ||
                    location.pathname.startsWith(`${link.href}/`);
                  return (
                    <Link
                      key={link.href}
                      to={link.href}
                      className={cn(
                        "rounded-xl px-3 py-2 text-sm font-medium transition",
                        isActive
                          ? "bg-slate-900 text-white shadow-sm"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      )}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            </aside>
          )}

          <div className="flex-1 flex flex-col overflow-hidden">{children}</div>
        </div>
      </div>
    </div>
  );
}

const SelmaLogoMark = () => (
  <div className="booking-shell-logo">
    <span className="booking-shell-logo-mark">S+</span>
    <span className="booking-shell-logo-text">Selma+</span>
  </div>
);
