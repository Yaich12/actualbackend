"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Sidebar, SidebarBody, SidebarLink } from "./sidebar";
import {
  Calendar,
  Users,
  BadgeDollarSign,
  FileText,
  BarChart3,
  Settings,
  AppWindow,
  LogOut,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { cn } from "../../lib/utils";
import { useAuth } from "../../AuthContext";
import { useLanguage } from "../../LanguageContext";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";

type BookingSidebarLayoutProps = {
  children: React.ReactNode;
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

export function BookingSidebarLayout({ children }: BookingSidebarLayoutProps) {
  const [open, setOpen] = useState(true);
  const [clinicName, setClinicName] = useState("");
  const [hasTeamAccess, setHasTeamAccess] = useState(false);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string>("");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOutUser } = useAuth();
  const { t, language, languageOptions } = useLanguage();
  const userName =
    user?.displayName || user?.email || t("booking.topbar.defaultUser", "Selma bruger");
  const clinicLabel = clinicName || t("booking.topbar.clinicSettings", "Klinikindstillinger");
  const userInitials = getInitials(user?.displayName || user?.email);
  const currentLanguageLabel = useMemo(() => {
    const match = languageOptions.find((option) => option.code === language);
    return match?.label || language.toUpperCase();
  }, [language, languageOptions]);
  const isCatalogRoute =
    location.pathname.startsWith("/booking/ydelser") ||
    location.pathname.startsWith("/booking/forloeb");

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
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const links = [
    {
      label: t("booking.sidebar.calendar", "Kalender"),
      href: "/booking",
      icon: <Calendar className="h-5 w-5 flex-shrink-0" />,
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
      label: t("booking.sidebar.invoices", "Fakturaer"),
      href: "/booking/fakturaer",
      icon: <FileText className="h-5 w-5 flex-shrink-0" />,
    },
    {
      label: t("booking.sidebar.stats", "Statistik"),
      href: "/booking/statistik",
      icon: <BarChart3 className="h-5 w-5 flex-shrink-0" />,
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
    {
      label: t("booking.sidebar.apps", "Apps"),
      href: "/booking/apps",
      icon: <AppWindow className="h-5 w-5 flex-shrink-0" />,
    },
  ];
  const catalogLinks = [
    { label: t("booking.sidebar.services", "Ydelser"), href: "/booking/ydelser" },
    { label: t("booking.sidebar.forloeb", "Forløb"), href: "/booking/forloeb" },
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
              onClick={() => setUserMenuOpen((openState) => !openState)}
              aria-haspopup="menu"
              aria-expanded={userMenuOpen}
            >
              {profilePhotoUrl ? (
                <img src={profilePhotoUrl} alt={userName} />
              ) : (
                <span>{userInitials}</span>
              )}
            </button>
            {userMenuOpen && (
              <div className="booking-user-menu" role="menu">
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
                <button type="button" className="booking-user-highlight">
                  <div>
                    <div className="booking-user-highlight-title">
                      {t("booking.topbar.confirmEmail", "Bekræft din e-mailadresse")}
                    </div>
                    <div className="booking-user-highlight-sub">
                      {t("booking.topbar.protectAccount", "Beskyt din konto")}
                    </div>
                  </div>
                  <span className="booking-user-highlight-arrow">›</span>
                </button>
                <div className="booking-user-menu-list">
                  <button
                    type="button"
                    className="booking-user-menu-item"
                    onClick={() => {
                      setUserMenuOpen(false);
                      navigate("/booking/settings");
                    }}
                  >
                    {t("booking.topbar.profile", "Min profil")}
                  </button>
                  <button type="button" className="booking-user-menu-item">
                    {t("booking.topbar.personalSettings", "Personlige indstillinger")}
                  </button>
                </div>
                <div className="booking-user-menu-divider" />
                <div className="booking-user-menu-list">
                  <button type="button" className="booking-user-menu-item">
                    {t("booking.topbar.help", "Hjælp og support")}
                  </button>
                  <button type="button" className="booking-user-menu-item">
                    {currentLanguageLabel}
                  </button>
                  <button
                    type="button"
                    className="booking-user-menu-item booking-user-menu-logout"
                    onClick={async () => {
                      setUserMenuOpen(false);
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
                {open ? <SelmaLogoFull /> : <SelmaLogoIcon />}
                <div className="mt-8 flex flex-col gap-1">
                  {links.map((link) => {
                    const isActive =
                      link.href === "/booking/ydelser"
                        ? isCatalogRoute
                        : location.pathname === link.href ||
                          location.pathname.startsWith(`${link.href}/`);
                    return (
                      <SidebarLink
                        key={link.href}
                        link={{
                          ...link,
                          icon: React.cloneElement(link.icon as any, {
                            className:
                              "h-5 w-5 flex-shrink-0 " +
                              (isActive
                                ? "text-slate-900"
                                : "text-slate-200 group-hover/sidebar:text-white"),
                          }),
                        }}
                        className={cn(
                          "rounded-xl px-2",
                          isActive
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-200 hover:bg-white/10"
                        )}
                      />
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-2 pb-3">
                <button
                  type="button"
                  onClick={() => navigate("/booking/settings")}
                  className="flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-white/10 transition"
                >
                  <div className="h-8 w-8 flex-shrink-0 rounded-full bg-gradient-to-tr from-sky-500 to-violet-500 flex items-center justify-center text-xs font-semibold text-white overflow-hidden">
                    {profilePhotoUrl ? (
                      <img
                        src={profilePhotoUrl}
                        alt={t("booking.topbar.profile", "Min profil")}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      "S+"
                    )}
                  </div>
                  {open && (
                    <div className="flex flex-col text-left text-xs text-slate-100">
                      <span className="font-medium">{userName}</span>
                      <span className="opacity-70">{clinicLabel}</span>
                    </div>
                  )}
                </button>

                <SidebarLink
                  link={{
                    label: t("booking.sidebar.logout", "Log ud"),
                    href: "/",
                    icon: (
                      <LogOut className="h-5 w-5 flex-shrink-0 text-slate-200 group-hover/sidebar:text-white" />
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
                  className="rounded-xl px-2 text-slate-200 hover:bg-white/10 text-left"
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

const SelmaLogoFull = () => (
  <button
    type="button"
    className="font-normal flex space-x-2 items-center text-sm text-white py-1 relative z-20"
  >
    <div className="h-6 w-7 bg-white rounded-br-lg rounded-tr-sm rounded-tl-lg rounded-bl-sm flex-shrink-0 flex items-center justify-center text-[10px] font-semibold text-slate-900">
      S+
    </div>
    <motion.span
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="font-medium text-white whitespace-pre"
    >
      Selma Booking
    </motion.span>
  </button>
);

const SelmaLogoIcon = () => (
  <button
    type="button"
    className="font-normal flex space-x-2 items-center text-sm text-white py-1 relative z-20"
  >
    <div className="h-6 w-7 bg-white rounded-br-lg rounded-tr-sm rounded-tl-lg rounded-bl-sm flex-shrink-0 flex items-center justify-center text-[10px] font-semibold text-slate-900">
      S+
    </div>
  </button>
);

const SelmaLogoMark = () => (
  <div className="booking-shell-logo">
    <span className="booking-shell-logo-mark">S+</span>
    <span className="booking-shell-logo-text">Selma+</span>
  </div>
);
