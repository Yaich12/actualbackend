"use client";

import React, { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AppWindow,
  BadgeDollarSign,
  Calendar,
  FileText,
  Link2,
  LogOut,
  Settings,
  Users,
} from "lucide-react";

import { Sidebar, SidebarBody, SidebarLink } from "./sidebar";
import { cn } from "../../lib/utils";

type BookingSidebarDemoProps = {
  children?: React.ReactNode;
};

export function BookingSidebarDemo({ children }: BookingSidebarDemoProps) {
  const [open, setOpen] = useState(false);

  const mainLinks = [
    {
      label: "Kalender",
      href: "/booking",
      icon: (
        <Calendar className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
      ),
    },
    {
      label: "Klienter",
      href: "/booking/klienter",
      icon: (
        <Users className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
      ),
    },
    {
      label: "Ydelser",
      href: "/booking/ydelser",
      icon: (
        <BadgeDollarSign className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
      ),
    },
    {
      label: "Forløb",
      href: "/booking/forloeb",
      icon: (
        <Link2 className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
      ),
    },
    {
      label: "Salg",
      href: "/booking/fakturaer",
      icon: (
        <FileText className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
      ),
    },
    {
      label: "Indstillinger",
      href: "/booking/indstillinger",
      icon: (
        <Settings className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
      ),
    },
    {
      label: "Integrationer",
      href: "/booking/apps",
      icon: (
        <AppWindow className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
      ),
    },
  ];

  return (
    <div
      className={cn(
        "rounded-md flex flex-col md:flex-row bg-gray-100 dark:bg-neutral-900 w-full flex-1 max-w-7xl mx-auto border border-neutral-200 dark:border-neutral-800 overflow-hidden",
        "h-screen"
      )}
    >
      <Sidebar open={open} setOpen={setOpen}>
        <SidebarBody className="justify-between gap-10">
          {/* Top: logo + links */}
          <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
            {open ? <SelmaLogoFull /> : <SelmaLogoIcon />}
            <div className="mt-8 flex flex-col gap-2">
              {mainLinks.map((link, idx) => (
                <SidebarLink key={idx} link={link} />
              ))}
            </div>
          </div>

          {/* Bottom: “bruger” / klinik-info + evt. logout */}
          <div className="flex flex-col gap-2 pb-2">
            <SidebarLink
              link={{
                label: "Selma Klinik",
                href: "/booking/settings",
                icon: (
                  <div className="h-7 w-7 flex-shrink-0 rounded-full bg-gradient-to-tr from-sky-500 to-violet-500 flex items-center justify-center text-xs font-semibold text-white">
                    S+
                  </div>
                ),
              }}
            />
            <SidebarLink
              link={{
                label: "Log ud",
                href: "/logout",
                icon: (
                  <LogOut className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
                ),
              }}
            />
          </div>
        </SidebarBody>
      </Sidebar>

      {/* Booking page content goes here */}
      <div className="flex-1">{children}</div>
    </div>
  );
}

const SelmaLogoFull = () => {
  return (
    <Link
      to="/booking"
      className="font-normal flex space-x-2 items-center text-sm text-black dark:text-white py-1 relative z-20"
    >
      <div className="h-6 w-7 bg-black dark:bg-white rounded-br-lg rounded-tr-sm rounded-tl-lg rounded-bl-sm flex-shrink-0 flex items-center justify-center text-[10px] font-semibold text-white dark:text-black">
        S+
      </div>
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="font-medium text-black dark:text-white whitespace-pre"
      >
        Selma Booking
      </motion.span>
    </Link>
  );
};

const SelmaLogoIcon = () => {
  return (
    <Link
      to="/booking"
      className="font-normal flex space-x-2 items-center text-sm text-black dark:text-white py-1 relative z-20"
    >
      <div className="h-6 w-7 bg-black dark:bg-white rounded-br-lg rounded-tr-sm rounded-tl-lg rounded-bl-sm flex-shrink-0 flex items-center justify-center text-[10px] font-semibold text-white dark:text-black">
        S+
      </div>
    </Link>
  );
};
