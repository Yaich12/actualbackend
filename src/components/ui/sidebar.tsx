"use client";

import React, { createContext, useContext } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

import { cn } from "../../lib/utils";

type SidebarContextValue = {
  open: boolean;
};

const SidebarContext = createContext<SidebarContextValue>({ open: true });

type SidebarProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
};

export const Sidebar = ({ open, setOpen, children, className }: SidebarProps) => {
  return (
    <SidebarContext.Provider value={{ open }}>
      <motion.aside
        initial={false}
        animate={{ width: open ? 256 : 72 }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className={cn(
          "group/sidebar relative z-40 flex h-full flex-col border-r border-neutral-200 bg-white/70 shadow-sm backdrop-blur-xl transition-colors dark:border-neutral-800 dark:bg-neutral-900/70",
          className
        )}
      >
        <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover/sidebar:opacity-100">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.08),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(168,85,247,0.06),transparent_25%),radial-gradient(circle_at_20%_80%,rgba(34,211,238,0.07),transparent_30%)]" />
        </div>
        <div className="relative flex h-full flex-col overflow-hidden">{children}</div>
      </motion.aside>
    </SidebarContext.Provider>
  );
};

type SidebarBodyProps = {
  className?: string;
  children?: React.ReactNode;
};

export const SidebarBody = ({ className, children }: SidebarBodyProps) => {
  return <div className={cn("flex h-full flex-col gap-6 px-3 py-4", className)}>{children}</div>;
};

type SidebarLink = {
  label: string;
  href: string;
  icon: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
};

type SidebarLinkProps = {
  link: SidebarLink;
  className?: string;
};

export const SidebarLink = ({ link, className }: SidebarLinkProps) => {
  const { open } = useContext(SidebarContext);

  return (
    <Link
      to={link.href}
      onClick={link.onClick}
      className={cn(
        "group flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white",
        className
      )}
    >
      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-transparent text-neutral-500 group-hover:text-neutral-900 dark:text-neutral-400 dark:group-hover:text-white">
        {link.icon}
      </span>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.span
            key="label"
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="whitespace-pre text-sm font-medium text-neutral-700 dark:text-neutral-100"
          >
            {link.label}
          </motion.span>
        ) : null}
      </AnimatePresence>
      {!open ? <span className="sr-only">{link.label}</span> : null}
    </Link>
  );
};

