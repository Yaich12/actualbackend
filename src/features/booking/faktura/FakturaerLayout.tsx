import React from "react";
import { NavLink } from "react-router-dom";
import { BookingSidebarLayout } from "../../../components/ui/BookingSidebarLayout";
import { useLanguage } from "../../../LanguageContext";
import { cn } from "../../../lib/utils";

type FakturaerLayoutProps = {
  children: React.ReactNode;
};

export default function FakturaerLayout({ children }: FakturaerLayoutProps) {
  const { t } = useLanguage();
  const fakturaLinks = [
    {
      label: t("booking.invoices.sidebar.dailyOverview", "Daglig Salgsoverblik"),
      href: "/booking/fakturaer",
      end: true,
    },
    { label: t("booking.invoices.sidebar.appointments", "Aftaler"), href: "/booking/fakturaer/aftaler" },
    { label: t("booking.invoices.sidebar.sales", "Salg"), href: "/booking/fakturaer/salg" },
    {
      label: t("booking.invoices.sidebar.payments", "Betalinger"),
      href: "/booking/fakturaer/betalinger",
    },
  ];
  return (
    <BookingSidebarLayout>
      <div className="booking-page">
        <div className="booking-content">
          <aside className="flex h-full w-64 flex-shrink-0 flex-col border-r border-slate-200 bg-white">
            <div className="px-6 pb-4 pt-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                {t("booking.invoices.sidebar.title", "Fakturaer")}
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">
                {t("booking.invoices.sidebar.subtitle", "Salg")}
              </h2>
            </div>
            <div className="flex flex-col gap-1 px-3">
              {fakturaLinks.map((link) => (
                <NavLink
                  key={link.href}
                  to={link.href}
                  end={link.end}
                  className={({ isActive }) =>
                    cn(
                      "rounded-xl px-3 py-2 text-sm font-medium transition",
                      isActive
                        ? "bg-slate-900 text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    )
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            </div>
          </aside>
          <div className="flex-1 min-w-0 overflow-hidden bg-slate-50">
            {children}
          </div>
        </div>
      </div>
    </BookingSidebarLayout>
  );
}
