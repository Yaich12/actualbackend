import React, { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { BookingSidebarLayout } from "../../../components/ui/BookingSidebarLayout";
import { useLanguage } from "../../../LanguageContext";
import { useAuth } from "../../../AuthContext";
import useStripeConnectStatus from "../../../hooks/useStripeConnectStatus";
import { cn } from "../../../lib/utils";

type FakturaerLayoutProps = {
  children: React.ReactNode;
};

type SelmaPayCardProps = {
  loading: boolean;
  error: string;
  actionLoading: string;
  isConnectActive: boolean;
  hasConnectAccount: boolean;
  onPrimaryAction: () => void;
  onRefresh: () => void;
  lastCheckedAt: Date | null;
};

function SelmaPayCard({
  loading,
  error,
  actionLoading,
  isConnectActive,
  hasConnectAccount,
  onPrimaryAction,
  onRefresh,
  lastCheckedAt,
}: SelmaPayCardProps) {
  const currentStatus = loading
    ? {
        label: "Tjekker status",
        dotClass: "bg-slate-400",
        textClass: "text-slate-700",
        subtext: "Vi henter den seneste betalingsstatus.",
      }
    : isConnectActive
    ? {
        label: "Aktiv",
        dotClass: "bg-emerald-500",
        textClass: "text-emerald-700",
        subtext: "Online betalinger er sat korrekt op og klar til brug.",
      }
    : hasConnectAccount
    ? {
        label: "Kræver handling",
        dotClass: "bg-amber-500",
        textClass: "text-amber-700",
        subtext: "Fuldfør opsætningen for at aktivere kortbetalinger.",
      }
    : {
        label: "Ikke aktiveret",
        dotClass: "bg-rose-500",
        textClass: "text-rose-700",
        subtext: "Aktivér SelmaPay for at åbne online betalingsmetoder.",
      };

  const lastCheckedLabel = lastCheckedAt
    ? new Intl.DateTimeFormat("da-DK", { hour: "2-digit", minute: "2-digit" }).format(lastCheckedAt)
    : "—";

  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-semibold tracking-wide text-slate-900">SelmaPay</p>
        <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold">
          <span className={cn("h-2 w-2 rounded-full", currentStatus.dotClass)} />
          <span className={currentStatus.textClass}>{currentStatus.label}</span>
        </span>
      </div>

      <p className="mt-2 text-xs leading-5 text-slate-600">{currentStatus.subtext}</p>

      {error && (
        <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 text-xs text-rose-700">
          {error}
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2">
        <button
          type="button"
          onClick={onPrimaryAction}
          disabled={Boolean(actionLoading)}
          className={cn(
            "w-full rounded-xl px-3 py-2.5 text-sm font-semibold",
            isConnectActive
              ? "bg-slate-900 text-white hover:bg-slate-800"
              : "bg-slate-900 text-white hover:bg-slate-800",
            actionLoading ? "cursor-wait opacity-70" : ""
          )}
        >
          {actionLoading === "onboarding" && "Opretter link..."}
          {actionLoading === "dashboard" && "Åbner Stripe..."}
          {!actionLoading && (isConnectActive ? "Administrér SelmaPay" : "Aktivér SelmaPay")}
        </button>

        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Opdatér status
        </button>
      </div>

      <div className="mt-3 border-t border-slate-200 pt-3">
        <p className="text-[11px] text-slate-500">Sidst tjekket: {lastCheckedLabel}</p>
        <p className="mt-1 text-[11px] text-slate-500">SelmaPay drives af Stripe (Express).</p>
      </div>
    </div>
  );
}

export default function FakturaerLayout({ children }: FakturaerLayoutProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const {
    status: stripeConnectStatus,
    loading: stripeConnectLoading,
    error: stripeConnectError,
    actionLoading: stripeActionLoading,
    refreshStatus,
    createOnboardingLink,
    createDashboardLink,
  } = useStripeConnectStatus({ enabled: Boolean(user?.uid) });

  const connectStatus = stripeConnectStatus?.connect || null;
  const hasConnectAccount = Boolean(stripeConnectStatus?.hasConnectAccount);
  const isConnectActive = Boolean(connectStatus?.onboardingComplete);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!stripeConnectLoading) {
      setLastCheckedAt(new Date());
    }
  }, [stripeConnectLoading, stripeConnectStatus, stripeConnectError]);

  const handleActivatePayments = async () => {
    try {
      await createOnboardingLink({
        returnUrl: "/booking/fakturaer/betalinger?stripeConnect=return",
        refreshUrl: "/booking/fakturaer/betalinger?stripeConnect=refresh",
      });
    } catch (_error) {
      // Error state is already surfaced by the hook.
    }
  };

  const handleOpenDashboard = async () => {
    try {
      await createDashboardLink();
    } catch (_error) {
      // Error state is already surfaced by the hook.
    }
  };

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
            <div className="mt-6 border-t border-slate-200 px-3 pb-6 pt-4">
              <SelmaPayCard
                loading={stripeConnectLoading}
                error={stripeConnectError}
                actionLoading={stripeActionLoading}
                isConnectActive={isConnectActive}
                hasConnectAccount={hasConnectAccount}
                onPrimaryAction={isConnectActive ? handleOpenDashboard : handleActivatePayments}
                onRefresh={refreshStatus}
                lastCheckedAt={lastCheckedAt}
              />
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
