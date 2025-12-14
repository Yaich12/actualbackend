"use client";

import React, { useEffect, useState } from "react";
import { Sidebar, SidebarBody, SidebarLink } from "./sidebar";
import {
  Calendar,
  Users,
  BadgeDollarSign,
  FileText,
  BarChart3,
  Settings,
  AppWindow,
  Link2,
  LogOut,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { cn } from "../../lib/utils";
import { useAuth } from "../../AuthContext";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase";

type BookingSidebarLayoutProps = {
  children: React.ReactNode;
};

export function BookingSidebarLayout({ children }: BookingSidebarLayoutProps) {
  const [open, setOpen] = useState(true);
  const [clinicName, setClinicName] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOutUser } = useAuth();
  const userName = user?.displayName || user?.email || "Selma bruger";
  const clinicLabel = clinicName || "Klinikindstillinger";

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.uid) {
        setClinicName("");
        return;
      }
      try {
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          if (typeof data?.clinicName === "string") {
            setClinicName(data.clinicName);
          }
        }
      } catch (err) {
        console.error("[BookingSidebarLayout] Failed to load clinic name", err);
      }
    };
    fetchProfile();
  }, [user?.uid]);

  const links = [
    { label: "Kalender", href: "/booking", icon: <Calendar className="h-5 w-5 flex-shrink-0" /> },
    { label: "Klienter", href: "/booking/klienter", icon: <Users className="h-5 w-5 flex-shrink-0" /> },
    { label: "Ydelser", href: "/booking/ydelser", icon: <BadgeDollarSign className="h-5 w-5 flex-shrink-0" /> },
    { label: "Forløb", href: "/booking/forloeb", icon: <Link2 className="h-5 w-5 flex-shrink-0" /> },
    { label: "Fakturaer", href: "/booking/fakturaer", icon: <FileText className="h-5 w-5 flex-shrink-0" /> },
    { label: "Statistik", href: "/booking/statistik", icon: <BarChart3 className="h-5 w-5 flex-shrink-0" /> },
    { label: "Indstillinger", href: "/booking/settings", icon: <Settings className="h-5 w-5 flex-shrink-0" /> },
    { label: "Apps", href: "/booking/apps", icon: <AppWindow className="h-5 w-5 flex-shrink-0" /> },
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50">
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
                const isActive = location.pathname === link.href;
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
              <div className="h-8 w-8 flex-shrink-0 rounded-full bg-gradient-to-tr from-sky-500 to-violet-500 flex items-center justify-center text-xs font-semibold text-white">
                S+
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
                label: "Log ud",
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

      <div className="flex-1 flex flex-col overflow-hidden">{children}</div>
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

